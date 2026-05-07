import { Router } from "express";
import rateLimit from "express-rate-limit";
import moment from "moment-business-days";

// Mapeamentos do Monday.com
import {
  BOARDS,
  COLS_GESTAO,
  COLS_SUB_GESTAO,
  COLS_SUB_ADMISSIONAL,
  COLS_CATALOGO,
  COLS_ESTOQUE3,
  COLS_AUDITORIA,
  AS0_PARENT_ITEM_ID,
} from "../config/monday-mapping.js";

import { gql } from "../services/graphql.js";

const router = Router();

// Rate limiting para busca por CPF
const buscaLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  message: { error: "Muitas requisições. Tente novamente mais tarde." },
});

// 1. Recebe payload do N8N após OCR da Cautela
router.post("/webhook/admissao", async (req, res) => {
  try {
    const { nome, cpf, contrato, epis } = req.body;
    
    if (!nome || !cpf || !epis || !Array.isArray(epis)) {
      return res.status(400).json({ error: "Payload inválido. Necessário nome, cpf e epis (array)" });
    }

    const safeColumnValues = JSON.stringify({
      [COLS_GESTAO.CPF]: cpf,
      [COLS_GESTAO.CONTRATO]: contrato || "A definir",
      [COLS_GESTAO.MOTIVO_ACAO]: { label: "Admissão" },
      [COLS_GESTAO.STATUS_ACAO]: { label: "Pendente" },
    });

    // 1. Criar Item Pai (colaborador)
    const createData = await gql(
      `mutation CreateItem($boardId: ID!, $itemName: String!, $colVals: JSON!) {
        create_item(board_id: $boardId, item_name: $itemName, column_values: $colVals) {
          id
        }
      }`,
      {
        boardId: String(BOARDS.GESTAO),
        itemName: nome,
        colVals: safeColumnValues,
      }
    );

    const itemId = createData.create_item.id;

    // 2. Criar subelemento especial para a CAUTELA (onde o PDF será anexado)
    const cautelaSubData = await gql(`
      mutation CreateCautelaSubitem($parentId: ID!, $itemName: String!, $colVals: JSON!) {
        create_subitem(parent_item_id: $parentId, item_name: $itemName, column_values: $colVals) { id }
      }
    `, {
      parentId: String(itemId),
      itemName: "📋 CAUTELA DE ADMISSÃO",
      colVals: JSON.stringify({
        [COLS_SUB_GESTAO.STATUS_INDIVIDUAL]: { label: "A Definir" },
      })
    });

    const cautelaSubitemId = cautelaSubData.create_subitem.id;

    // 3. Criar subelementos de EPIs
    for (const epi of epis) {
      const colVals = {
        [COLS_SUB_GESTAO.TAMANHO]: { labels: [epi.tamanho || "A definir"] },
        [COLS_SUB_GESTAO.STATUS_INDIVIDUAL]: { label: "Pendente de Receber" },
      };
      
      await gql(`
        mutation CreateSubitem($parentId: ID!, $itemName: String!, $colVals: JSON!) {
          create_subitem(parent_item_id: $parentId, item_name: $itemName, column_values: $colVals) { id }
        }
      `, { parentId: String(itemId), itemName: epi.nome, colVals: JSON.stringify(colVals) });
    }

    // 4. Posta update (balão) com o log de recebimento do pacote
    const dataEntrega = new Date().toLocaleDateString("pt-BR");
    const linhasEpis = epis.map(epi => {
      const tam = epi.tamanho ? " — Tam: " + epi.tamanho : "";
      const qtd = epi.quantidade ? " — Qtd: " + epi.quantidade : " — Qtd: 1";
      return "  • " + epi.nome + tam + qtd;
    }).join("\n");
    const textoAdmissao =
      "✅ **Pacote de EPIs Recebido** — " + dataEntrega + "\n\n" +
      nome + " recebeu o pacote do contrato **" + (contrato || "A definir") + "**.\n" +
      "Itens recebidos em " + dataEntrega + ":\n\n" +
      linhasEpis + "\n\n" +
      "_Registro gerado automaticamente pelo sistema de gestão de EPIs._";
    await postarUpdate(itemId, textoAdmissao).catch(e =>
      console.warn("[Admissão] Falha ao postar update:", e.message)
    );

    res.status(200).json({ success: true, itemId, cautelaSubitemId });
  } catch (error) {
    console.error("[Admissão] Erro:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// 1b. Verificação pré-cautela: busca colaborador pelo CPF e lista subitens de CAUTELA
router.get("/cautela/check/:cpf", async (req, res) => {
  try {
    const { cpf } = req.params;
    const cleanCpf = cpf.replace(/\D/g, "");

    const data = await gql(
      `query BuscarCpf($boardId: ID!, $cpf: String!) {
        items_page_by_column_values(
          board_id: $boardId,
          columns: [{ column_id: "${COLS_GESTAO.CPF}", column_values: [$cpf] }],
          limit: 5
        ) {
          items {
            id
            name
            column_values(ids: ["${COLS_GESTAO.CONTRATO}", "${COLS_GESTAO.STATUS_ACAO}"]) { id text }
            subitems {
              id
              name
              column_values(ids: ["${COLS_SUB_GESTAO.STATUS_INDIVIDUAL}"]) { id text }
            }
          }
        }
      }`,
      { boardId: String(BOARDS.GESTAO), cpf: cleanCpf }
    );

    const items = data.items_page_by_column_values?.items ?? [];

    if (!items.length) {
      return res.status(200).json({ encontrado: false, colaboradores: [] });
    }

    const colaboradores = items.map(item => {
      const col = (id) => item.column_values.find(c => c.id === id)?.text ?? "";
      
      // Filtra subitens que são de CAUTELA (nome contém 'CAUTELA')
      const subitens_cautela = (item.subitems ?? []).filter(s =>
        s.name.toUpperCase().includes("CAUTELA")
      ).map(s => ({
        id: s.id,
        nome: s.name,
        status: s.column_values.find(c => c.id === COLS_SUB_GESTAO.STATUS_INDIVIDUAL)?.text ?? "A Definir",
      }));

      return {
        id: item.id,
        nome: item.name,
        contrato: col(COLS_GESTAO.CONTRATO),
        status_acao: col(COLS_GESTAO.STATUS_ACAO),
        total_subitens: (item.subitems ?? []).length,
        subitens_cautela,
      };
    });

    res.status(200).json({ encontrado: true, colaboradores });
  } catch (error) {
    console.error("[Cautela Check] Erro:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// 1c. Criar subitem de CAUTELA avulso (para colaborador já existente)
router.post("/cautela/criar-subitem", async (req, res) => {
  try {
    const { colaborador_item_id, label } = req.body;
    if (!colaborador_item_id) {
      return res.status(400).json({ error: "colaborador_item_id é obrigatório." });
    }

    const nomeSubitem = label || `📋 CAUTELA — ${new Date().toLocaleDateString('pt-BR')}`;

    const data = await gql(`
      mutation CreateCautelaSubitem($parentId: ID!, $itemName: String!, $colVals: JSON!) {
        create_subitem(parent_item_id: $parentId, item_name: $itemName, column_values: $colVals) { id name }
      }
    `, {
      parentId: String(colaborador_item_id),
      itemName: nomeSubitem,
      colVals: JSON.stringify({
        [COLS_SUB_GESTAO.STATUS_INDIVIDUAL]: { label: "A Definir" },
      })
    });

    const subitem = data.create_subitem;
    res.status(200).json({ success: true, subitem_id: subitem.id, nome: subitem.name });
  } catch (error) {
    console.error("[Cautela Criar Subitem] Erro:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// 2. Busca o item do colaborador no board de Gestão pelo CPF
router.get("/colaborador/:cpf", buscaLimiter, async (req, res) => {
  try {
    const { cpf } = req.params;
    
    // As colunas que queremos buscar no Subelemento
    const subCols = `["${COLS_SUB_GESTAO.STATUS_INDIVIDUAL}", "${COLS_SUB_GESTAO.QUANTIDADE}", "${COLS_SUB_GESTAO.TAMANHO}", "${COLS_SUB_GESTAO.DATA_ENTREGA}", "${COLS_SUB_GESTAO.DATA_DEVOLUCAO}", "${COLS_SUB_GESTAO.DATA_LIMITE}", "${COLS_SUB_GESTAO.PRECO_UNITARIO}"]`;

    // As colunas que queremos buscar no Pai
    const parentCols = `["${COLS_GESTAO.CPF}", "${COLS_GESTAO.CONTRATO}", "${COLS_GESTAO.MOTIVO_ACAO}", "${COLS_GESTAO.STATUS_ACAO}"]`;

    const data = await gql(
      `query BuscarCpf($boardId: ID!, $cpf: String!) {
        items_page_by_column_values(
          board_id: $boardId,
          columns: [{ column_id: "${COLS_GESTAO.CPF}", column_values: [$cpf] }],
          limit: 1
        ) {
          items {
            id
            name
            subitems {
              id
              name
              column_values(ids: ${subCols}) { id text }
            }
            column_values(ids: ${parentCols}) {
              id
              text
            }
          }
        }
      }`,
      { boardId: String(BOARDS.GESTAO), cpf }
    );

    const items = data.items_page_by_column_values?.items ?? [];
    if (!items.length) {
      return res.status(404).json({ error: "Colaborador não encontrado." });
    }

    const item = items[0];
    const colParent = (id) => item.column_values.find(c => c.id === id)?.text ?? "";

    const subitens = (item.subitems ?? []).map(sub => {
      const colSub = (id) => sub.column_values.find(c => c.id === id)?.text ?? "";
      return {
        id: sub.id,
        nome: sub.name,
        status: colSub(COLS_SUB_GESTAO.STATUS_INDIVIDUAL) || "A Definir",
        quantidade: colSub(COLS_SUB_GESTAO.QUANTIDADE) || "1",
        tamanho: colSub(COLS_SUB_GESTAO.TAMANHO) || "-",
        data_entrega: colSub(COLS_SUB_GESTAO.DATA_ENTREGA) || null,
        data_devolucao: colSub(COLS_SUB_GESTAO.DATA_DEVOLUCAO) || null,
        data_limite: colSub(COLS_SUB_GESTAO.DATA_LIMITE) || null,
        preco_unitario: parseFloat(colSub(COLS_SUB_GESTAO.PRECO_UNITARIO).replace(",", ".") || "0"),
      };
    });

    res.status(200).json({
      id: item.id,
      nome: item.name,
      cpf,
      contrato: colParent(COLS_GESTAO.CONTRATO),
      status_acao: colParent(COLS_GESTAO.STATUS_ACAO),
      motivo_acao: colParent(COLS_GESTAO.MOTIVO_ACAO),
      subitens,
    });
  } catch (error) {
    console.error("[Busca CPF] Erro:", error.message);
    res.status(500).json({ error: error.message });
  }
});

import { dataUrlToBuffer, uploadArquivo } from "../services/file.js";

// Helper genérico para atualizar o subelemento, foto e justificativa
async function atualizarStatusEpi(subitem_id, novoStatus, fotoBase64, options = {}) {
  const colVals = {
    [COLS_SUB_GESTAO.STATUS_INDIVIDUAL]: { label: novoStatus },
  };

  // Data de Devolução (quando aplicável)
  if (options.data_devolucao) {
    colVals[COLS_SUB_GESTAO.DATA_DEVOLUCAO] = { date: options.data_devolucao };
  }

  // Justificativa / Observação
  if (options.justificativa) {
    colVals[COLS_SUB_GESTAO.JUSTIFICATIVA] = options.justificativa;
  }

  await gql(`
    mutation ChangeSub($boardId: ID!, $itemId: ID!, $colVals: JSON!) {
      change_multiple_column_values(board_id: $boardId, item_id: $itemId, column_values: $colVals) { id }
    }
  `, { boardId: String(BOARDS.SUB_GESTAO), itemId: String(subitem_id), colVals: JSON.stringify(colVals) });

  if (fotoBase64) {
    const { buffer, mimeType, ext } = dataUrlToBuffer(fotoBase64);
    const filename = `Foto_${novoStatus.replace(/\//g, "")}_${subitem_id}.${ext}`;
    await uploadArquivo(subitem_id, COLS_SUB_GESTAO.FOTO_EVIDENCIA, buffer, mimeType, filename);
  }
}

// 3. Muda Status Individual para "Entregue"
router.patch("/epi/:subitem_id/entregar", async (req, res) => {
  try {
    const { subitem_id } = req.params;
    const { tecnico, data_entrega, foto } = req.body;
    
    await atualizarStatusEpi(subitem_id, "Entregue", foto);
    res.status(200).json({ success: true, subitem_id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Processa devolução — MODELO VERSIONADO
// O subitem original é preservado como fotografia permanente.
// Um NOVO subitem [DEV] é criado com os dados do evento de devolução.
router.patch("/epi/:subitem_id/devolver", async (req, res) => {
  try {
    const { subitem_id } = req.params;
    const { status, foto, justificativa, data_devolucao, motivo_acao, colaborador_item_id } = req.body;

    // Foto opcional para "Não Devolvido" — não há item físico para fotografar
    const isNaoDevolvido = status === "Não Devolvido";
    if (!foto && !isNaoDevolvido) return res.status(400).json({ error: "Foto da devolução é obrigatória." });

    // Normaliza acento: Monday usa "Reaproveitavel" (sem acento)
    const statusNorm = status === "Reaproveitável" ? "Reaproveitavel" : status;
    const statusValidos = ["Reaproveitavel", "Descarte/Dano", "Não Devolvido", "Aguardando Devolução"];
    const labelStatus = statusValidos.includes(statusNorm) ? statusNorm : "Descarte/Dano";

    // 1. Busca o subitem original para obter nome e parent_item_id
    const subData = await gql(`
      query GetSub($subId: [ID!]) {
        items(ids: $subId) { id name parent_item { id } }
      }
    `, { subId: [subitem_id] });
    const original = subData.items?.[0];
    if (!original) return res.status(404).json({ error: "Subitem não encontrado." });
    const parentId = colaborador_item_id || original.parent_item?.id;
    const nomeBase = original.name.replace(/^\[DEV\]\s*/i, "").replace(/^\[TROCA\]\s*/i, "");

    // 2. Cria NOVO subitem [DEV] — o original permanece INTOCADO
    const colVals = {
      [COLS_SUB_GESTAO.STATUS_INDIVIDUAL]: { label: labelStatus },
    };
    if (data_devolucao) colVals[COLS_SUB_GESTAO.DATA_DEVOLUCAO] = { date: data_devolucao };
    if (justificativa)  colVals[COLS_SUB_GESTAO.JUSTIFICATIVA]  = justificativa;
    // data_limite: prazo de 3 dias úteis (enviado pelo frontend para Não Devolvido)
    if (req.body.data_limite) colVals[COLS_SUB_GESTAO.DATA_LIMITE] = { date: req.body.data_limite };

    const newSubData = await gql(`
      mutation CreateDevSub($parentId: ID!, $itemName: String!, $colVals: JSON!) {
        create_subitem(parent_item_id: $parentId, item_name: $itemName, column_values: $colVals) { id }
      }
    `, {
      parentId: String(parentId),
      itemName: `[DEV] ${nomeBase}`,
      colVals: JSON.stringify(colVals),
    });
    const newSubitemId = newSubData.create_subitem.id;

    // 3. Upload da foto no NOVO subitem (opcional para "Não Devolvido")
    if (foto) {
      const { buffer, mimeType, ext } = dataUrlToBuffer(foto);
      await uploadArquivo(newSubitemId, COLS_SUB_GESTAO.FOTO_EVIDENCIA, buffer, mimeType, `Dev_${nomeBase}_${newSubitemId}.${ext}`);
    }

    // 4. Atualiza motivo_acao do colaborador (item pai) se informado
    if (motivo_acao && parentId) {
      const pColVals = { [COLS_GESTAO.MOTIVO_ACAO]: { label: motivo_acao } };
      await gql(`
        mutation UpdateParent($boardId: ID!, $itemId: ID!, $colVals: JSON!) {
          change_multiple_column_values(board_id: $boardId, item_id: $itemId, column_values: $colVals) { id }
        }
      `, { boardId: String(BOARDS.GESTAO), itemId: String(parentId), colVals: JSON.stringify(pColVals) });
    }

    // 5. Posta update (balão) no item pai com o registro da devolução
    if (parentId) {
      const dataHoje = new Date().toLocaleDateString("pt-BR");
      let textoUpdate = "";
      if (labelStatus === "Não Devolvido") {
        const prazoFmt = req.body.data_limite
          ? new Date(req.body.data_limite + "T12:00:00").toLocaleDateString("pt-BR")
          : "—";
        textoUpdate =
          "⚠️ **EPI Não Devolvido** — " + dataHoje + "\n\n" +
          "O item **" + nomeBase + "** foi marcado como **Não Devolvido**.\n" +
          (justificativa ? "Observação: " + justificativa + "\n" : "") +
          "Prazo para devolução: **" + prazoFmt + "** (3 dias úteis).\n" +
          "Após o prazo, o valor poderá ser descontado em folha conforme art. 462 da CLT.";
      } else {
        textoUpdate =
          "📦 **Devolução Registrada** — " + dataHoje + "\n\n" +
          "Item devolvido: **" + nomeBase + "**\n" +
          "Destino: **" + labelStatus + "**\n" +
          (justificativa ? "Observação: " + justificativa : "");
      }
      await postarUpdate(parentId, textoUpdate).catch(e =>
        console.warn("[Devolver] Falha ao postar update:", e.message)
      );
    }

    res.status(200).json({ success: true, novo_subitem_id: newSubitemId, status: labelStatus });
  } catch (error) {
    console.error("[Devolver] Erro:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// 4b. Agenda devolução — muda status para "Aguardando Devolução" com data limite
router.patch("/epi/:subitem_id/agendar-devolucao", async (req, res) => {
  try {
    const { subitem_id } = req.params;
    const { data_limite, justificativa, colaborador_item_id, motivo_acao } = req.body;

    const colVals = {
      [COLS_SUB_GESTAO.STATUS_INDIVIDUAL]: { label: "Aguardando Devolução" },
    };
    if (data_limite) colVals[COLS_SUB_GESTAO.DATA_LIMITE] = { date: data_limite };
    if (justificativa) colVals[COLS_SUB_GESTAO.JUSTIFICATIVA] = justificativa;

    await gql(`
      mutation AgendarDev($boardId: ID!, $itemId: ID!, $colVals: JSON!) {
        change_multiple_column_values(board_id: $boardId, item_id: $itemId, column_values: $colVals) { id }
      }
    `, { boardId: String(BOARDS.SUB_GESTAO), itemId: String(subitem_id), colVals: JSON.stringify(colVals) });

    // Atualiza motivo_acao do colaborador (item pai) se informado
    if (motivo_acao && colaborador_item_id) {
      const pColVals = { [COLS_GESTAO.MOTIVO_ACAO]: { label: motivo_acao } };
      await gql(`
        mutation UpdateParentMotivo($boardId: ID!, $itemId: ID!, $colVals: JSON!) {
          change_multiple_column_values(board_id: $boardId, item_id: $itemId, column_values: $colVals) { id }
        }
      `, { boardId: String(BOARDS.GESTAO), itemId: String(colaborador_item_id), colVals: JSON.stringify(pColVals) });
    }

    res.status(200).json({ success: true, subitem_id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4c. Atualiza STATUS_ACAO e/ou MOTIVO_ACAO do item pai (colaborador)
router.patch("/colaborador/:item_id/status", async (req, res) => {
  try {
    const { item_id } = req.params;
    const { status_acao, motivo_acao } = req.body;

    const colVals = {};
    if (status_acao) colVals[COLS_GESTAO.STATUS_ACAO] = { label: status_acao };
    if (motivo_acao) colVals[COLS_GESTAO.MOTIVO_ACAO] = { label: motivo_acao };

    if (!Object.keys(colVals).length) {
      return res.status(400).json({ error: "Informe status_acao ou motivo_acao." });
    }

    await gql(`
      mutation UpdateColabStatus($boardId: ID!, $itemId: ID!, $colVals: JSON!) {
        change_multiple_column_values(board_id: $boardId, item_id: $itemId, column_values: $colVals) { id }
      }
    `, { boardId: String(BOARDS.GESTAO), itemId: String(item_id), colVals: JSON.stringify(colVals) });

    res.status(200).json({ success: true, item_id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4d. Atualiza campos editáveis do subitem (tamanho, quantidade) — edição inline
router.patch("/epi/:subitem_id/atualizar", async (req, res) => {
  try {
    const { subitem_id } = req.params;
    const { tamanho, quantidade, status } = req.body;

    const colVals = {};
    if (tamanho)    colVals[COLS_SUB_GESTAO.TAMANHO]           = { labels: [tamanho] };
    if (quantidade) colVals[COLS_SUB_GESTAO.QUANTIDADE]         = quantidade;
    if (status)     colVals[COLS_SUB_GESTAO.STATUS_INDIVIDUAL]  = { label: status };

    if (!Object.keys(colVals).length) {
      return res.status(400).json({ error: "Nenhum campo informado para atualizar." });
    }

    await gql(`
      mutation UpdateSubitem($boardId: ID!, $itemId: ID!, $colVals: JSON!) {
        change_multiple_column_values(board_id: $boardId, item_id: $itemId, column_values: $colVals) { id }
      }
    `, { boardId: String(BOARDS.SUB_GESTAO), itemId: String(subitem_id), colVals: JSON.stringify(colVals) });

    res.status(200).json({ success: true, subitem_id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Troca — MODELO VERSIONADO
// O subitem original é preservado. Dois NOVOS subitems são criados:
//   [TROCA] {nome} — registra o evento de descarte/avaria com foto
//   {nome}          — o novo item a ser entregue (Pendente de Receber)
router.patch("/epi/:subitem_id/trocar", async (req, res) => {
  try {
    const { subitem_id } = req.params;
    const { motivo, foto, novoTamanho, colaborador_item_id } = req.body;

    if (!foto) return res.status(400).json({ error: "Foto da troca é obrigatória." });

    // 1. Busca o subitem original para obter nome e parent_item_id
    const subData = await gql(`
      query GetSub($subId: [ID!]) {
        items(ids: $subId) { id name parent_item { id } }
      }
    `, { subId: [subitem_id] });
    const original = subData.items?.[0];
    if (!original) return res.status(404).json({ error: "Subitem não encontrado." });
    const parentId = colaborador_item_id || original.parent_item?.id;
    const nomeBase = original.name.replace(/^\[DEV\]\s*/i, "").replace(/^\[TROCA\]\s*/i, "");

    // 2. Cria [TROCA] {nome} — registro do evento de descarte com foto
    const trocaColVals = {
      [COLS_SUB_GESTAO.STATUS_INDIVIDUAL]: { label: "Descarte/Dano" },
    };
    if (motivo) trocaColVals[COLS_SUB_GESTAO.JUSTIFICATIVA] = motivo;

    const trocaSubData = await gql(`
      mutation CreateTrocaSub($parentId: ID!, $itemName: String!, $colVals: JSON!) {
        create_subitem(parent_item_id: $parentId, item_name: $itemName, column_values: $colVals) { id }
      }
    `, {
      parentId: String(parentId),
      itemName: `[TROCA] ${nomeBase}`,
      colVals: JSON.stringify(trocaColVals),
    });
    const trocaSubitemId = trocaSubData.create_subitem.id;

    // 3. Upload foto no subitem [TROCA]
    const { buffer, mimeType, ext } = dataUrlToBuffer(foto);
    await uploadArquivo(trocaSubitemId, COLS_SUB_GESTAO.FOTO_EVIDENCIA, buffer, mimeType, `Troca_${nomeBase}_${trocaSubitemId}.${ext}`);

    // 4. Cria {nome} — novo item a ser entregue (Pendente de Receber)
    const novoColVals = {
      [COLS_SUB_GESTAO.STATUS_INDIVIDUAL]: { label: "Pendente de Receber" },
    };
    if (novoTamanho) novoColVals[COLS_SUB_GESTAO.TAMANHO] = { labels: [novoTamanho] };

    const novoSubData = await gql(`
      mutation CreateNovoSub($parentId: ID!, $itemName: String!, $colVals: JSON!) {
        create_subitem(parent_item_id: $parentId, item_name: $itemName, column_values: $colVals) { id }
      }
    `, {
      parentId: String(parentId),
      itemName: nomeBase,
      colVals: JSON.stringify(novoColVals),
    });

    // 5. Atualiza motivo_acao do colaborador
    const pColVals = { [COLS_GESTAO.MOTIVO_ACAO]: { label: "Troca / Desgaste" } };
    await gql(`
      mutation UpdateParentTroca($boardId: ID!, $itemId: ID!, $colVals: JSON!) {
        change_multiple_column_values(board_id: $boardId, item_id: $itemId, column_values: $colVals) { id }
      }
    `, { boardId: String(BOARDS.GESTAO), itemId: String(parentId), colVals: JSON.stringify(pColVals) });

    // 6. Posta update (balão) no item pai com o registro da troca
    const dataHojeTroca = new Date().toLocaleDateString("pt-BR");
    const textoTroca =
      "🔄 **Troca de EPI** — " + dataHojeTroca + "\n\n" +
      "Item substituído: **" + nomeBase + "**\n" +
      "Motivo: **" + (motivo || "Desgaste / Avaria") + "**\n" +
      (novoTamanho ? "Novo tamanho: " + novoTamanho + "\n" : "") +
      "Um novo item **Pendente de Receber** foi gerado automaticamente.";
    await postarUpdate(parentId, textoTroca).catch(e =>
      console.warn("[Trocar] Falha ao postar update:", e.message)
    );

    res.status(200).json({
      success: true,
      troca_subitem_id: trocaSubitemId,
      novo_subitem_id: novoSubData.create_subitem.id,
    });
  } catch (error) {
    console.error("[Trocar] Erro:", error.message);
    res.status(500).json({ error: error.message });
  }
});




// 5b. Reverter devolução pendente — apaga o subitem [DEV] e reverte o EPI original para "Entregue"
// Usado quando o colaborador aparece para devolver dentro do prazo de 3 dias úteis.
router.patch("/epi/:evento_id/reverter-devolucao", async (req, res) => {
  try {
    const { evento_id } = req.params;
    const { colaborador_item_id } = req.body;

    // 1. Busca o subitem [DEV] para validar que existe e pegar o nome do EPI base
    const subData = await gql(`
      query GetEventoSub($subId: [ID!]) {
        items(ids: $subId) { id name parent_item { id } }
      }
    `, { subId: [evento_id] });
    const evento = subData.items?.[0];
    if (!evento) return res.status(404).json({ error: "Subitem de evento não encontrado." });

    // Valida que é mesmo um evento [DEV]
    if (!/^\[DEV\]/i.test(evento.name)) {
      return res.status(400).json({ error: "Subitem informado não é um evento [DEV]." });
    }

    const parentId = colaborador_item_id || evento.parent_item?.id;
    const nomeBase = evento.name.replace(/^\[DEV\]\s*/i, "").trim();

    // 2. Deleta o subitem [DEV]
    await gql(`
      mutation DeleteEvento($itemId: ID!) {
        delete_item(item_id: $itemId) { id }
      }
    `, { itemId: String(evento_id) });

    // 3. Busca o subitem original pelo nome para reverter o status
    if (parentId) {
      const parentData = await gql(`
        query GetParentSubs($parentId: [ID!]) {
          items(ids: $parentId) {
            subitems { id name column_values(ids: ["${COLS_SUB_GESTAO.STATUS_INDIVIDUAL}"]) { id text } }
          }
        }
      `, { parentId: [parentId] });

      const subitems = parentData.items?.[0]?.subitems ?? [];
      // Encontra o subitem original (exatamente com o nome base, sem prefixo)
      const original = subitems.find(s =>
        s.name.trim().toLowerCase() === nomeBase.toLowerCase() &&
        !/^\[(DEV|TROCA)\]/i.test(s.name)
      );

      if (original) {
        await gql(`
          mutation RevertStatus($boardId: ID!, $itemId: ID!, $colVals: JSON!) {
            change_multiple_column_values(board_id: $boardId, item_id: $itemId, column_values: $colVals) { id }
          }
        `, {
          boardId: String(BOARDS.SUB_GESTAO),
          itemId: String(original.id),
          colVals: JSON.stringify({
            [COLS_SUB_GESTAO.STATUS_INDIVIDUAL]: { label: "Entregue" },
            [COLS_SUB_GESTAO.JUSTIFICATIVA]: "Devolução revertida — colaborador compareceu dentro do prazo.",
          }),
        });
      }
    }

    res.status(200).json({ success: true, revertido: true, nome_base: nomeBase });
  } catch (error) {
    console.error("[Reverter Devolução] Erro:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// 5c. Concluir devolução pendente — atualiza subitem [DEV] existente com status final + foto
router.patch("/epi/:evento_id/concluir-devolucao", async (req, res) => {
  try {
    const { evento_id } = req.params;
    const { status, foto, data_devolucao, motivo_acao, colaborador_item_id } = req.body;

    const statusNorm2 = status === "Reaproveitável" ? "Reaproveitavel" : status;
    const statusValidos = ["Reaproveitavel", "Descarte/Dano", "Não Devolvido"];
    const labelStatus = statusValidos.includes(statusNorm2) ? statusNorm2 : "Descarte/Dano";

    const colVals = {
      [COLS_SUB_GESTAO.STATUS_INDIVIDUAL]: { label: labelStatus },
    };
    if (data_devolucao) colVals[COLS_SUB_GESTAO.DATA_DEVOLUCAO] = { date: data_devolucao };

    await gql(`
      mutation ConcluirDev($boardId: ID!, $itemId: ID!, $colVals: JSON!) {
        change_multiple_column_values(board_id: $boardId, item_id: $itemId, column_values: $colVals) { id }
      }
    `, { boardId: String(BOARDS.SUB_GESTAO), itemId: String(evento_id), colVals: JSON.stringify(colVals) });

    if (foto) {
      const { buffer, mimeType, ext } = dataUrlToBuffer(foto);
      await uploadArquivo(evento_id, COLS_SUB_GESTAO.FOTO_EVIDENCIA, buffer, mimeType, `ConcluirDev_${evento_id}.${ext}`);
    }

    if (motivo_acao && colaborador_item_id) {
      const pColVals = { [COLS_GESTAO.MOTIVO_ACAO]: { label: motivo_acao } };
      await gql(`
        mutation UpdateParentConcluir($boardId: ID!, $itemId: ID!, $colVals: JSON!) {
          change_multiple_column_values(board_id: $boardId, item_id: $itemId, column_values: $colVals) { id }
        }
      `, { boardId: String(BOARDS.GESTAO), itemId: String(colaborador_item_id), colVals: JSON.stringify(pColVals) });
    }

    res.status(200).json({ success: true, evento_id, status: labelStatus });
  } catch (error) {
    console.error("[Concluir Devolução] Erro:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// 6. Trava de preço (Chamado pelo N8N WF4 SLA)
router.post("/epi/:subitem_id/multa", async (req, res) => {
  try {
    const { subitem_id } = req.params;
    
    // 1. Pega preço espelhado (ou no catálogo direto) e salva estático
    const getPriceMutation = await gql(`
      query GetSubPrice($subId: [ID!]) {
        items(ids: $subId) {
          column_values(ids: ["${COLS_SUB_GESTAO.PRECO_UNITARIO}"]) {
            text
          }
        }
      }
    `, { subId: [subitem_id] });

    const priceText = getPriceMutation.items[0]?.column_values[0]?.text || "0";
    const priceNumeric = parseFloat(priceText.replace(",", "."));

    // 2. Trava o preço. Usando um ID hipotético 'numeric_mm2multa' para o valor gravado fixo.
    // O ID terá que ser atualizado no monday-mapping.js após obter do Monday.
    await gql(`
      mutation LockPrice($boardId: ID!, $itemId: ID!, $colVals: JSON!) {
        change_multiple_column_values(board_id: $boardId, item_id: $itemId, column_values: $colVals) { id }
      }
    `, { 
      boardId: String(BOARDS.SUB_GESTAO), 
      itemId: String(subitem_id), 
      colVals: JSON.stringify({ "numeric_mm2multa": priceNumeric }) 
    });

    res.status(200).json({ success: true, subitem_id, changedTo: priceNumeric });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 7. Audit log
router.post("/audit-log", async (req, res) => {
  try {
    const { logName, colaborador, quemDeletou, idRegistro } = req.body;
    
    // Opcional, cria item no board de logs
    if (logName) {
        await gql(`
        mutation CreateLog($boardId: ID!, $itemName: String!, $colVals: JSON!) {
            create_item(board_id: $boardId, item_name: $itemName, column_values: $colVals) { id }
        }
        `, { 
        boardId: String(BOARDS.AUDITORIA), 
        itemName: logName, 
        colVals: JSON.stringify({
            [COLS_AUDITORIA.DATA_HORA]: { date: new Date().toISOString().split("T")[0] }
        }) 
        });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Helper: posta update (balão) em qualquer item do Monday ─────────────────
async function postarUpdate(itemId, texto) {
  await gql(`
    mutation PostUpdate($itemId: ID!, $body: String!) {
      create_update(item_id: $itemId, body: $body) { id }
    }
  `, { itemId: String(itemId), body: texto });
}

// 7b. POST /colaborador/:item_id/update — posta um comentário/balão no item pai
router.post("/colaborador/:item_id/update", async (req, res) => {
  try {
    const { item_id } = req.params;
    const { texto } = req.body;
    if (!texto) return res.status(400).json({ error: "Campo 'texto' é obrigatório." });
    await postarUpdate(item_id, texto);
    res.status(200).json({ success: true, item_id });
  } catch (error) {
    console.error("[Update Balão] Erro:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// 7c. Cria colaborador manualmente no board de Gestão
// POST /colaborador/criar
router.post("/colaborador/criar", async (req, res) => {
  try {
    const { nome, cpf, contrato, funcao, grupo_id } = req.body;
    if (!nome) return res.status(400).json({ error: "Campo 'nome' é obrigatório." });

    const colVals = {};
    if (cpf)      colVals[COLS_GESTAO.CPF]      = cpf.replace(/\D/g, "");
    if (contrato) colVals[COLS_GESTAO.CONTRATO]  = contrato;
    colVals[COLS_GESTAO.STATUS_ACAO]  = { label: "A Definir" };
    colVals[COLS_GESTAO.MOTIVO_ACAO]  = { label: "A Definir" };

    const createData = await gql(`
      mutation CriarColab($boardId: ID!, $itemName: String!, $colVals: JSON, $groupId: String) {
        create_item(board_id: $boardId, item_name: $itemName, column_values: $colVals, group_id: $groupId) { id }
      }
    `, {
      boardId: String(BOARDS.GESTAO),
      itemName: nome,
      colVals: JSON.stringify(colVals),
      groupId: grupo_id || null,
    });

    const itemId = createData.create_item.id;

    // Posta update de criação manual
    const dataHoje = new Date().toLocaleDateString("pt-BR");
    await postarUpdate(itemId,
      "➕ **Colaborador cadastrado manualmente** — " + dataHoje + "\n\n" +
      "Cadastro realizado pelo sistema EPI Manager.\n" +
      (contrato ? "Contrato: " + contrato + "\n" : "") +
      (funcao   ? "Função: " + funcao + "\n" : "")
    ).catch(() => {});

    res.status(200).json({ success: true, itemId });
  } catch (error) {
    console.error("[Criar Colaborador] Erro:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// 8. Consulta Estoque 3
router.get("/estoque3", async (req, res) => {
  try {
    const data = await gql(`
      query {
        boards(ids: [${BOARDS.ESTOQUE3}]) {
          items_page(limit: 500) {
            items {
              id
              name
              column_values(ids: ["${COLS_ESTOQUE3.TAMANHO}", "${COLS_ESTOQUE3.QUANTIDADE}", "${COLS_ESTOQUE3.STATUS_ESTOQUE}"]) {
                id
                text
              }
            }
          }
        }
      }
    `);

    const items = data.boards[0]?.items_page?.items || [];
    const skus = items.map(item => {
      const col = (id) => item.column_values.find(c => c.id === id)?.text ?? "";
      return {
        id: item.id,
        nome: item.name,
        tamanho: col(COLS_ESTOQUE3.TAMANHO),
        quantidade: Number(col(COLS_ESTOQUE3.QUANTIDADE) || 0),
        status: col(COLS_ESTOQUE3.STATUS_ESTOQUE)
      };
    }).filter(i => i.quantidade > 0 && i.status === "Disponível");

    res.status(200).json({ skus });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 9. Upload de cautela PDF para o subitem CAUTELA no Monday (o N8N processa)
// A coluna de arquivo do subitem é file_mkvvbkwx
const CAUTELA_COLUMN_ID = 'file_mkvvbkwx';

router.post('/cautela/upload', async (req, res) => {
  try {
    const { arquivo_base64, nome_arquivo, subitem_id } = req.body;

    if (!arquivo_base64 || !nome_arquivo) {
      return res.status(400).json({ error: 'Campos arquivo_base64 e nome_arquivo são obrigatórios.' });
    }
    if (!subitem_id) {
      return res.status(400).json({ error: 'subitem_id é obrigatório. Use GET /cautela/check/:cpf para encontrar ou POST /cautela/criar-subitem para criar.' });
    }

    const { buffer, mimeType } = dataUrlToBuffer(arquivo_base64);
    const ext = nome_arquivo.split('.').pop() || 'pdf';
    const filename = `Cautela_${Date.now()}.${ext}`;

    await uploadArquivo(subitem_id, CAUTELA_COLUMN_ID, buffer, mimeType, filename);

    res.status(200).json({
      success: true,
      filename,
      subitem_id,
      mensagem: 'Cautela anexada com sucesso. O N8N irá processar em instantes.',
    });
  } catch (error) {
    console.error('[Cautela Upload] Erro:', error.message);
    res.status(500).json({ error: error.message });
  }
});


// ─── Esteira Admissional ──────────────────────────────────────────────────────
// A estrutura do Monday: Item Pai = Lote de Solicitações / Subitens = Colaboradores

const SUB_ADM_COLS = `["${COLS_SUB_ADMISSIONAL.CPF}", "${COLS_SUB_ADMISSIONAL.RG}", "${COLS_SUB_ADMISSIONAL.CIDADE}", "${COLS_SUB_ADMISSIONAL.FUNCAO}", "${COLS_SUB_ADMISSIONAL.ORGAO}", "${COLS_SUB_ADMISSIONAL.DATA_ADMISSAO}", "${COLS_SUB_ADMISSIONAL.DATA_NASCIMENTO}", "${COLS_SUB_ADMISSIONAL.STATUS_ASO}", "${COLS_SUB_ADMISSIONAL.CAUTELA}"]`;

function formatarColaborador(item) {
  const col = (id) => item.column_values.find(c => c.id === id)?.text ?? "";
  return {
    id: item.id,
    nome: item.name,
    cpf: col(COLS_SUB_ADMISSIONAL.CPF),
    rg: col(COLS_SUB_ADMISSIONAL.RG),
    cidade: col(COLS_SUB_ADMISSIONAL.CIDADE),
    funcao: col(COLS_SUB_ADMISSIONAL.FUNCAO),
    orgao: col(COLS_SUB_ADMISSIONAL.ORGAO),
    data_admissao: col(COLS_SUB_ADMISSIONAL.DATA_ADMISSAO),
    data_nascimento: col(COLS_SUB_ADMISSIONAL.DATA_NASCIMENTO),
    status_aso: col(COLS_SUB_ADMISSIONAL.STATUS_ASO),
    tem_cautela: !!col(COLS_SUB_ADMISSIONAL.CAUTELA),
    solicitation: item.parent_item?.name ?? "-",
    parent_item_id: item.parent_item?.id ?? null,
  };
}

// 10. Lista todos os colaboradores da Esteira Admissional (subitens)
router.get("/admissional/colaboradores", async (req, res) => {
  try {
    const data = await gql(`
      query ListColaboradores($boardId: ID!) {
        boards(ids: [$boardId]) {
          items_page(limit: 500) {
            items {
              id
              name
              parent_item { id name }
              column_values(ids: ${SUB_ADM_COLS}) { id text }
            }
          }
        }
      }
    `, { boardId: String(BOARDS.SUB_ADMISSIONAL) });

    const items = data.boards[0]?.items_page?.items ?? [];

    // Filtra apenas itens que têm CPF preenchido (são colaboradores reais)
    const colaboradores = items
      .filter(item => item.column_values.find(c => c.id === COLS_SUB_ADMISSIONAL.CPF)?.text)
      .map(formatarColaborador);

    const stats = {
      total: colaboradores.length,
      com_cautela: colaboradores.filter(c => c.tem_cautela).length,
      sem_cautela: colaboradores.filter(c => !c.tem_cautela).length,
    };

    res.status(200).json({ colaboradores, stats });
  } catch (error) {
    console.error("[Admissional] Erro ao listar colaboradores:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// 11. Busca colaborador por CPF nos subitens da Esteira Admissional
// Tenta formatos: XXX.XXX.XXX-XX e também os 11 dígitos sem formatação
router.get("/admissional/colaborador/cpf/:cpf", buscaLimiter, async (req, res) => {
  try {
    const { cpf } = req.params;
    const digits = cpf.replace(/\D/g, "");
    const formatted = digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");

    async function buscarPorValor(valor) {
      const data = await gql(
        `query BuscarPorCpf($boardId: ID!, $cpf: String!) {
          items_page_by_column_values(
            board_id: $boardId,
            columns: [{ column_id: "${COLS_SUB_ADMISSIONAL.CPF}", column_values: [$cpf] }],
            limit: 5
          ) {
            items {
              id
              name
              parent_item { id name }
              column_values(ids: ${SUB_ADM_COLS}) { id text }
            }
          }
        }`,
        { boardId: String(BOARDS.SUB_ADMISSIONAL), cpf: valor }
      );
      return data.items_page_by_column_values?.items ?? [];
    }

    // 1ª tentativa: formato com pontuação
    let items = await buscarPorValor(formatted);

    // 2ª tentativa: apenas dígitos (Monday pode ter salvo sem formatação)
    if (!items.length) {
      items = await buscarPorValor(digits);
    }

    if (!items.length) {
      return res.status(404).json({ error: "Colaborador não encontrado na esteira admissional." });
    }

    res.status(200).json({ colaboradores: items.map(formatarColaborador) });
  } catch (error) {
    console.error("[Admissional CPF] Erro:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// 12. Lista colaboradores do grupo EXAMES ADMISSIONAIS (AS0) via subitens do item pai
router.get("/admissional/as0/colaboradores", async (req, res) => {
  try {
    const data = await gql(`
      query GetAS0Subitems($itemId: [ID!]) {
        items(ids: $itemId) {
          subitems {
            id
            name
            parent_item { id name }
            column_values(ids: ${`["${COLS_SUB_ADMISSIONAL.CPF}", "${COLS_SUB_ADMISSIONAL.RG}", "${COLS_SUB_ADMISSIONAL.CIDADE}", "${COLS_SUB_ADMISSIONAL.FUNCAO}", "${COLS_SUB_ADMISSIONAL.ORGAO}", "${COLS_SUB_ADMISSIONAL.DATA_ADMISSAO}", "${COLS_SUB_ADMISSIONAL.DATA_NASCIMENTO}", "${COLS_SUB_ADMISSIONAL.STATUS_ASO}", "${COLS_SUB_ADMISSIONAL.CAUTELA}"]`}) { id text }
          }
        }
      }
    `, { itemId: [AS0_PARENT_ITEM_ID] });

    const subitems = data.items?.[0]?.subitems ?? [];

    const colaboradores = subitems
      .filter(item => item.column_values.find(c => c.id === COLS_SUB_ADMISSIONAL.CPF)?.text)
      .map(formatarColaborador);

    const stats = {
      total: colaboradores.length,
      com_cautela: colaboradores.filter(c => c.tem_cautela).length,
      sem_cautela: colaboradores.filter(c => !c.tem_cautela).length,
    };

    res.status(200).json({ colaboradores, stats });
  } catch (error) {
    console.error("[AS0] Erro ao listar colaboradores:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// 13. Dashboard principal — colaboradores + subitems de EPI do board GESTAO
router.get("/gestao/epis", async (req, res) => {
  try {
    const subCols = `["${COLS_SUB_GESTAO.STATUS_INDIVIDUAL}", "${COLS_SUB_GESTAO.QUANTIDADE}", "${COLS_SUB_GESTAO.TAMANHO}", "${COLS_SUB_GESTAO.DATA_ENTREGA}", "${COLS_SUB_GESTAO.DATA_DEVOLUCAO}", "${COLS_SUB_GESTAO.DATA_LIMITE}", "${COLS_SUB_GESTAO.PRECO_UNITARIO}", "${COLS_SUB_GESTAO.JUSTIFICATIVA}"]`;
    const parentCols = `["${COLS_GESTAO.CPF}", "${COLS_GESTAO.CONTRATO}", "${COLS_GESTAO.STATUS_ACAO}", "${COLS_GESTAO.MOTIVO_ACAO}", "${COLS_GESTAO.TECNICO_RESPONSAVEL}", "${COLS_GESTAO.TELEFONE1}", "${COLS_GESTAO.TELEFONE2}", "${COLS_GESTAO.CAUTELA_ASSINADA}"]`;

    const data = await gql(`
      query GestaoEpis($boardId: ID!) {
        boards(ids: [$boardId]) {
          groups {
            id
            title
          }
          items_page(limit: 500) {
            items {
              id
              name
              group { id title }
              column_values(ids: ${parentCols}) { id text value }
              subitems {
                id
                name
                column_values(ids: ${subCols}) { id text }
              }
            }
          }
        }
      }
    `, { boardId: String(BOARDS.GESTAO) });

    const items = data.boards?.[0]?.items_page?.items ?? [];

    let totalEntregues = 0;
    let aguardandoDevolucao = 0;
    let naoDevolvidos = 0;
    let valorEmAberto = 0;

    const colaboradores = items.map(item => {
      const colParent = (id) => item.column_values.find(c => c.id === id)?.text ?? "";
      const colParentVal = (id) => item.column_values.find(c => c.id === id)?.value ?? null;

      // Cautela assinada: tem arquivo se o campo value não é null
      const cautelaVal = colParentVal(COLS_GESTAO.CAUTELA_ASSINADA);
      const cautela_assinada = !!cautelaVal && cautelaVal !== "null";

      const subitens = (item.subitems ?? []).map(sub => {
        const colSub = (id) => sub.column_values.find(c => c.id === id)?.text ?? "";
        const status = colSub(COLS_SUB_GESTAO.STATUS_INDIVIDUAL) || "A Definir";
        const preco = parseFloat(colSub(COLS_SUB_GESTAO.PRECO_UNITARIO).replace(",", ".") || "0");

        if (status === "Entregue") totalEntregues++;
        if (status === "Aguardando Devolução") aguardandoDevolucao++;
        if (status === "Não Devolvido") { naoDevolvidos++; valorEmAberto += preco; }

        return {
          id: sub.id,
          nome: sub.name,
          status,
          quantidade: colSub(COLS_SUB_GESTAO.QUANTIDADE) || "1",
          tamanho: colSub(COLS_SUB_GESTAO.TAMANHO) || "-",
          data_entrega: colSub(COLS_SUB_GESTAO.DATA_ENTREGA) || null,
          data_devolucao: colSub(COLS_SUB_GESTAO.DATA_DEVOLUCAO) || null,
          data_limite: colSub(COLS_SUB_GESTAO.DATA_LIMITE) || null,
          preco_unitario: preco,
          justificativa: colSub(COLS_SUB_GESTAO.JUSTIFICATIVA) || null,
        };
      });

      return {
        id: item.id,
        nome: item.name,
        cpf: colParent(COLS_GESTAO.CPF),
        contrato: colParent(COLS_GESTAO.CONTRATO),
        status_acao: colParent(COLS_GESTAO.STATUS_ACAO),
        motivo_acao: colParent(COLS_GESTAO.MOTIVO_ACAO),
        tecnico_responsavel: colParent(COLS_GESTAO.TECNICO_RESPONSAVEL),
        telefone1: colParent(COLS_GESTAO.TELEFONE1),
        telefone2: colParent(COLS_GESTAO.TELEFONE2),
        cautela_assinada,
        grupo: item.group?.title ?? "Colaboradores",
        grupo_id: item.group?.id ?? "",
        subitens,
      };
    });

    res.status(200).json({
      colaboradores,
      kpis: { totalEntregues, aguardandoDevolucao, naoDevolvidos, valorEmAberto },
    });
  } catch (error) {
    console.error("[Gestao EPIs] Erro:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// 13b. Atualiza campos de texto do colaborador (telefones, técnico responsável)
router.patch("/colaborador/:item_id/info", async (req, res) => {
  try {
    const { item_id } = req.params;
    const { tecnico_responsavel, telefone1, telefone2 } = req.body;

    const colVals = {};
    if (tecnico_responsavel !== undefined) colVals[COLS_GESTAO.TECNICO_RESPONSAVEL] = tecnico_responsavel;
    if (telefone1 !== undefined)           colVals[COLS_GESTAO.TELEFONE1]           = telefone1;
    if (telefone2 !== undefined)           colVals[COLS_GESTAO.TELEFONE2]           = telefone2;

    if (!Object.keys(colVals).length) {
      return res.status(400).json({ error: "Informe ao menos um campo para atualizar." });
    }

    await gql(`
      mutation UpdateColabInfo($boardId: ID!, $itemId: ID!, $colVals: JSON!) {
        change_multiple_column_values(board_id: $boardId, item_id: $itemId, column_values: $colVals) { id }
      }
    `, { boardId: String(BOARDS.GESTAO), itemId: String(item_id), colVals: JSON.stringify(colVals) });

    res.status(200).json({ success: true, item_id });
  } catch (error) {
    console.error("[Colaborador Info] Erro:", error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
