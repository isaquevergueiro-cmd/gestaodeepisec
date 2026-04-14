const MONDAY_URL = "https://api.monday.com/v2";
const MONDAY_FILE_URL = "https://api.monday.com/v2/file";

const BOARD_DEVOLUCOES = 18406415397;
const BOARD_CATALOGO = 18406575530;

import { generateReceiptPdf, generateCautelaPdf } from "./pdf.js";
import { criarDocZapSignCautela } from "./zapsign.js";

// ─── GraphQL client ───────────────────────────────────────────────────────────

async function gql(query, variables = {}) {
  const res = await fetch(MONDAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.MONDAY_API_TOKEN}`,
      "Content-Type": "application/json",
      "API-Version": "2024-10",
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json();

  if (json.errors?.length) {
    const msg = json.errors.map((e) => e.message).join("; ");
    throw new Error(`Monday GraphQL: ${msg}`);
  }

  return json.data;
}

// ─── Fase 1 — Criar Solicitação ───────────────────────────────────────────────

export async function criarSolicitacao({
  nome_colaborador,
  cpf,
  telefone1,
  telefone2,
  contrato,
  motivo,
  data_solicitacao,
  epis_esperados,
  tecnico_responsavel,
  // assinatura_base64 — NaNão é coletada no cadastro; acontece na Conferência
}) {
  const episString = epis_esperados.map(e =>
    `${e.nome} (Tam: ${e.tamanho || '-'} | Qtd: ${e.qtd || 1})`
  ).join(", ");

  const safeColumnValues = JSON.stringify({
    text_mm1yrhrs:      cpf,
    text_mm2c155b:      telefone1 || "",
    text_mm2cz5hh:      telefone2 || "",
    text_mm1ypaa0:      contrato,
    date_mm1ys9b:       { date: data_solicitacao },
    long_text_mm2chet8: { text: episString },
    text_mm1yfgtm:      tecnico_responsavel,
  });

  const createData = await gql(
    `mutation CreateItem($boardId: ID!, $itemName: String!, $colVals: JSON) {
      create_item(board_id: $boardId, item_name: $itemName, column_values: $colVals) {
        id
      }
    }`,
    {
      boardId: String(BOARD_DEVOLUCOES),
      itemName: nome_colaborador,
      colVals: safeColumnValues,
    }
  );

  const itemId = createData.create_item.id;
  console.log(`[Criar] Item criado: ${itemId} (${nome_colaborador})`);

  // ── Status inicial + Motivo da Ação ────────────────────────────────────────
  // Atenção: os labels DEVEM coincidir exatamente com os configurados no Monday
  //
  // color_mm1y1rf2 (Motivo da Ação) possíveis:
  //   - "Admissional"              → Colaborador novo, recebendo EPIs pela 1ª vez
  //   - "Demissional"              → Desligamento, devolvendo todos os itens
  //   - "Renovação com devolução" → Troca; entrega os velhos e recebe novos
  //   - "Renovação sem devolução" → Troca sem retorno físico (exceção)
  //
  // color_mm1y6q34 (Status da Devolução) possíveis (definidos pelo sistema):
  //   - "Pendente"          → Cadastrado, aguardando Conferência
  //   - "Concluída"         → Todos os itens conferidos e regularizados
  //   - "Aguardando Retorno"→ Colaborador tem 3 dias úteis para trazer o item
  //   - "Com Pendências"    → Item definitivamente não devolvido → gera desconto
  //   - "Cancelada"         → Ação cancelada manualmente
  //
  // color_mm1y93j5 (Gera Desconto?) lógica automática:
  //   - "Sim" → quando status = "Com Pendências" (item definitivamente em falta)
  //   - "Não" → todos os demais casos
  const validMotivos = ["Admissional", "Demissional", "Renovação com devolução", "Renovação sem devolução"];
  const safeMotivo   = validMotivos.includes(motivo) ? motivo : "Admissional";

  try {
    const statusVals = JSON.stringify(JSON.stringify({
      color_mm1y1rf2: { label: safeMotivo },
      color_mm1y6q34: { label: "Pendente" },   // Status inicial
      color_mm1y93j5: { label: "Não" },         // Desconto inicial = Não
    }));
    await gql(`
      mutation {
        change_multiple_column_values(
          board_id: ${BOARD_DEVOLUCOES},
          item_id: ${itemId},
          column_values: ${statusVals}
        ) { id }
      }
    `);
    console.log(`[Criar] Motivo="${safeMotivo}" | Status="Pendente" | Desconto="Não" configurados.`);
  } catch (err) {
    // Não quebra o fluxo, mas loga o erro para diagnóstico
    console.error(`[Criar] FALHA ao gravar status/motivo — verifique os labels no Monday (color_mm1y1rf2, color_mm1y6q34, color_mm1y93j5):`, err.message);
  }

  // ── Subelementos (um por EPI/Fardamento) ─────────────────────────────────────
  console.log(`[Criar] Criando ${epis_esperados.length} subelemento(s)...`);
  const catalogoIdMap = await buscarMapeamentoCatalogo(epis_esperados.map(e => e.nome));

  for (const epi of epis_esperados) {
    const idCat = catalogoIdMap[epi.nome];
    const colVals = {
      dropdown_mm2ctr4y: { labels: [epi.tamanho] },
      numeric_mm2cd6vv:  Number(epi.qtd),
      color_mm2csadv:    { label: "A definir" }, // Status Individual inicial
    };
    if (idCat) {
      colVals.board_relation_mm1zxkff = { item_ids: [idCat] };
    }
    try {
      await gql(`
        mutation CreateSubitem($parentId: ID!, $itemName: String!, $colVals: JSON) {
          create_subitem(parent_item_id: $parentId, item_name: $itemName, column_values: $colVals) { id }
        }
      `, { parentId: String(itemId), itemName: epi.nome, colVals: JSON.stringify(colVals) });
      console.log(`  └ Subelemento: "${epi.nome}" (Tam: ${epi.tamanho} | Qtd: ${epi.qtd})`);
    } catch (e) {
      console.error(`  ✔ Falha subelemento "${epi.nome}":`, e.message);
    }
  }

  console.log(`[Criar] Concluído. Item ID: ${itemId}`);
  return { id: itemId, tecnico: tecnico_responsavel };
}

// ─── Fase 2 — Buscar por CPF ──────────────────────────────────────────────────

export async function buscarPorCpf(cpf) {
  const data = await gql(
    `query BuscarCpf($boardId: ID!, $cpf: String!) {
      items_page_by_column_values(
        board_id: $boardId,
        columns: [{ column_id: "text_mm1yrhrs", column_values: [$cpf] }],
        limit: 1
      ) {
        items {
          id
          name
          group { id }
          subitems {
            id
            name
            column_values(ids: ["dropdown_mm2ctr4y", "numeric_mm2cd6vv", "color_mm2csadv"]) {
              id
              text
            }
          }
          column_values(ids: ["long_text_mm2chet8", "text_mm1ypaa0", "text_mm2c155b", "text_mm2cz5hh"]) {
            id
            text
          }
        }
      }
    }`,
    { boardId: String(BOARD_DEVOLUCOES), cpf }
  );

  const items = data.items_page_by_column_values?.items ?? [];
  if (!items.length) throw new Error("Colaborador não encontrado para o CPF informado.");

  const item = items[0];
  const col = (id) => item.column_values.find(c => c.id === id)?.text ?? "";

  const colEpisBase  = col("long_text_mm2chet8");
  const colContrato  = col("text_mm1ypaa0");
  const colTelefone1 = col("text_mm2c155b");
  const colTelefone2 = col("text_mm2cz5hh");

  // is_retorno determinado pelo grupo — se está em group_mm27y9f1 é segunda visita
  const isRetorno = item.group.id === "group_mm27y9f1";

  const subitensRaw = item.subitems ?? [];
  const todosSubitens = subitensRaw.map(sub => ({
    id:      sub.id,
    nome:    sub.name,
    tamanho: sub.column_values.find(c => c.id === "dropdown_mm2ctr4y")?.text ?? "",
    qtd:     Number(sub.column_values.find(c => c.id === "numeric_mm2cd6vv")?.text || 1),
    status:  sub.column_values.find(c => c.id === "color_mm2csadv")?.text ?? "A definir",
  }));

  // Na segunda visita: separar já entregues (Reaproveitável/Descarte) dos pendentes (Não Devolvido)
  const STATUS_PENDENTE = ["Não Devolvido", "A definir"];
  const subitens = isRetorno
    ? todosSubitens.filter(s => STATUS_PENDENTE.includes(s.status))
    : todosSubitens;

  const epis_ja_devolvidos = isRetorno
    ? todosSubitens.filter(s => !STATUS_PENDENTE.includes(s.status)).map(s => s.nome)
    : [];

  // EPIs string: em retorno usa os nomes dos pendentes; em primeira visita usa a coluna base
  const episText = isRetorno
    ? subitens.map(s => s.nome).join(", ")
    : colEpisBase;

  console.log(`[Busca CPF] ${item.name} (ID ${item.id}) | Grupo: ${item.group.id} | Retorno: ${isRetorno} | Subitems: ${todosSubitens.length} (pendentes: ${subitens.length})`);
  return {
    id_monday: item.id,
    nome:      item.name,
    cpf,
    contrato:          colContrato,
    telefone1:         colTelefone1,
    telefone2:         colTelefone2,
    epis_esperados_string: episText,
    is_retorno:        isRetorno,
    epis_ja_devolvidos,
    subitens,
  };
}

// ─── Fase 2 — Buscar por Nome ──────────────────────────────────────────────────

function _mapItem(item) {
  const col = (id) => item.column_values.find(c => c.id === id)?.text ?? "";
  const isRetorno = item.group?.id === "group_mm27y9f1";

  const todosSubitens = (item.subitems ?? []).map(sub => ({
    id:      sub.id,
    nome:    sub.name,
    tamanho: sub.column_values.find(c => c.id === "dropdown_mm2ctr4y")?.text ?? "",
    qtd:     Number(sub.column_values.find(c => c.id === "numeric_mm2cd6vv")?.text || 1),
    status:  sub.column_values.find(c => c.id === "color_mm2csadv")?.text ?? "A definir",
  }));

  const STATUS_PENDENTE = ["Não Devolvido", "A definir"];
  const subitens = isRetorno
    ? todosSubitens.filter(s => STATUS_PENDENTE.includes(s.status))
    : todosSubitens;

  const epis_ja_devolvidos = isRetorno
    ? todosSubitens.filter(s => !STATUS_PENDENTE.includes(s.status)).map(s => s.nome)
    : [];

  const colEpisBase = col("long_text_mm2chet8");
  const episText = isRetorno ? subitens.map(s => s.nome).join(", ") : colEpisBase;

  return {
    id_monday:             item.id,
    nome:                  item.name,
    cpf:                   col("text_mm1yrhrs"),
    contrato:              col("text_mm1ypaa0"),
    telefone1:             col("text_mm2c155b"),
    telefone2:             col("text_mm2cz5hh"),
    epis_esperados_string: episText,
    is_retorno:            isRetorno,
    epis_ja_devolvidos,
    subitens,
  };
}

export async function buscarPorNome(nome) {
  const COLS = `["text_mm1yrhrs", "long_text_mm2chet8", "text_mm1ypaa0", "text_mm2c155b", "text_mm2cz5hh"]`;
  const SUBITEM_COLS = `["dropdown_mm2ctr4y", "numeric_mm2cd6vv", "color_mm2csadv"]`;

  // Busca via column_values (nome exato)
  const data = await gql(
    `query BuscarNome($boardId: ID!, $nome: String!) {
      items_page_by_column_values(
        board_id: $boardId,
        columns: [{ column_id: "name", column_values: [$nome] }],
        limit: 10
      ) {
        items {
          id
          name
          group { id }
          subitems {
            id
            name
            column_values(ids: ${SUBITEM_COLS}) { id text }
          }
          column_values(ids: ${COLS}) { id text }
        }
      }
    }`,
    { boardId: String(BOARD_DEVOLUCOES), nome }
  );

  const items = data.items_page_by_column_values?.items ?? [];

  // Fallback: scan completo por substring
  if (!items.length) {
    console.log(`[Busca Nome] Fallback substring para: "${nome}"`);
    const fallbackData = await gql(
      `query {
        boards(ids: [${BOARD_DEVOLUCOES}]) {
          items_page(limit: 500) {
            items {
              id
              name
              group { id }
              subitems {
                id
                name
                column_values(ids: ${SUBITEM_COLS}) { id text }
              }
              column_values(ids: ${COLS}) { id text }
            }
          }
        }
      }`
    );

    const allItems = fallbackData.boards?.[0]?.items_page?.items ?? [];
    const matched  = allItems.filter(i => i.name.toLowerCase().includes(nome.toLowerCase()));

    if (!matched.length) throw new Error("Nenhum colaborador encontrado com este nome.");
    return matched.map(_mapItem);
  }

  return items.map(_mapItem);
}

// ─── Fase 3 helper — Buscar IDs no Catálogo ──────────────────────────────────

async function buscarIdsCatalogo(nomes) {
  console.log("[Catálogo] Buscando IDs para:", nomes);

  const data = await gql(`
    query {
      boards(ids: [${BOARD_CATALOGO}]) {
        items_page(limit: 500) {
          items { id name }
        }
      }
    }
  `);

  const catalogItems = data.boards?.[0]?.items_page?.items ?? [];
  console.log(`[Catálogo] Total de itens retornados: ${catalogItems.length}`);

  const ids = [];
  for (const nome of nomes) {
    const found = catalogItems.find((item) => item.name === nome);
    if (found) {
      ids.push(parseInt(found.id, 10));
      console.log(`[Catálogo] ✓ "${nome}" → ID ${found.id}`);
    } else {
      console.warn(`[Catálogo] ✗ "${nome}" não encontrado — verifique a string exata`);
    }
  }

  return ids;
}

// ─── Helper para mapear os EPIs para IDs do Catálogo ─────────────────────────

async function buscarMapeamentoCatalogo(nomes) {
  const data = await gql(`
    query {
      boards(ids: [${BOARD_CATALOGO}]) {
        items_page(limit: 500) {
          items { id name }
        }
      }
    }
  `);
  const catalogItems = data.boards?.[0]?.items_page?.items ?? [];
  const mapa = {};
  for (const nome of nomes) {
    const found = catalogItems.find((item) => item.name === nome);
    if (found) {
      mapa[nome] = parseInt(found.id, 10);
    }
  }
  return mapa;
}

// ─── Helper — Extrai mime type e buffer de um data URL ───────────────────────

function dataUrlToBuffer(dataUrl) {
  const match = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) throw new Error("Formato de imagem inválido.");
  const mimeType = match[1];
  const ext = mimeType.split("/")[1];
  const buffer = Buffer.from(match[2], "base64");
  return { buffer, mimeType, ext };
}

// ─── Helper — Upload de arquivo para coluna do Monday ────────────────────────

export async function uploadArquivo(item_id, column_id, buffer, mimeType, filename) {
  const mutation = `mutation ($file: File!) {
    add_file_to_column(item_id: ${item_id}, column_id: "${column_id}", file: $file) { id }
  }`;

  const form = new globalThis.FormData();
  form.append("query", mutation);
  form.append("variables[file]", new Blob([buffer], { type: mimeType }), filename);

  const res = await fetch(MONDAY_FILE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.MONDAY_API_TOKEN}` },
    body: form,
  });

  const json = await res.json();
  console.log(`[Upload] ${filename} → ${column_id}:`, JSON.stringify(json).slice(0, 200));
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data;
}

// ─── Helper para resolver o status correto para o Monday ─────────────────────
function resolverStatusEpi(epis_problema) {
  if (!epis_problema || epis_problema.length === 0) return "A definir";
  const statuses = epis_problema.map(e => (e.status || "").toLowerCase());

  if (statuses.some(s => s.includes("nao devolvido") || s.includes("não devolvido")))
    return "Não Devolvido";
  if (statuses.some(s => s.includes("descarte") || s.includes("dano")))
    return "Descarte/Dano";
  if (statuses.some(s => s.includes("reuso") || s.includes("reaproveit")))
    return "Reaproveitável";

  return "A definir";
}

// ─── Fase 3 — Salvar Baixa + Upload de Assinatura e Fotos ────────────────────

export async function salvarBaixa({
  id_monday,
  nome,
  cpf,
  contrato,
  epis_problema,
  assinatura_base64,
  fotos_epis,
  tecnico_responsavel,
}) {
  // Helpers de status
  const ehNaoDevolvido   = (s) => /(n[ãa]o\s*devolvido)/i.test(s);
  const temProblema       = epis_problema.some(e => ehNaoDevolvido(e.status) && !e.prazo_marcado);
  const aguardandoRetorno = epis_problema.some(e => e.prazo_marcado === true);
  const dataDevolucao     = new Date().toISOString().slice(0, 10);

  console.log(`[Baixa] Iniciando | temProblema=${temProblema} | aguardandoRetorno=${aguardandoRetorno} | epis=${epis_problema.length}`);

  // ── Step 1a: Campos seguros — data + técnico (+ prazo se necessário) ─────────
  const safeValues = {
    text_mm1yfgtm: tecnico_responsavel ?? '',
    date_mm1zythe: { date: dataDevolucao },   // ← Regra 5: Data de Devolução = hoje
  };

  if (aguardandoRetorno) {
    // Regra 6: Prazo de Entrega = +3 dias úteis APENAS quando há promessa de retorno
    const prazoDate = new Date();
    let diasUteis = 0;
    while (diasUteis < 3) {
      prazoDate.setDate(prazoDate.getDate() + 1);
      const dow = prazoDate.getDay();
      if (dow !== 0 && dow !== 6) diasUteis++;
    }
    safeValues.date_mm27vzkv = { date: prazoDate.toISOString().slice(0, 10) };
    console.log(`[Baixa] Step 1a: Prazo de Entrega = ${safeValues.date_mm27vzkv.date}`);
  }

  await gql(`
    mutation {
      change_multiple_column_values(
        board_id: ${BOARD_DEVOLUCOES},
        item_id: ${id_monday},
        column_values: ${JSON.stringify(JSON.stringify(safeValues))}
      ) { id }
    }
  `);
  console.log('[Baixa] Step 1a: data devolução + técnico gravados.');

  // ── Step 1b: Status da Devolução + Gera Desconto (labels Monday exatos) ───
  try {
    let statusDevolucao;
    if (aguardandoRetorno) {
      statusDevolucao = 'Aguardando Retorno';  // colaborador prometeu trazer em máx 3 dias úteis
    } else if (temProblema) {
      statusDevolucao = 'Com Pendências';      // item definitivamente não devolvido → gera desconto
    } else {
      statusDevolucao = 'Concluída';           // tudo regularizado
    }
    const geraDesconto = (temProblema && !aguardandoRetorno) ? 'Sim' : 'Não';

    console.log(`[Baixa] Step 1b: Status="${statusDevolucao}" | Desconto="${geraDesconto}"`);
    await gql(`
      mutation {
        change_multiple_column_values(
          board_id: ${BOARD_DEVOLUCOES},
          item_id: ${id_monday},
          column_values: ${JSON.stringify(JSON.stringify({
            color_mm1y6q34: { label: statusDevolucao },
            color_mm1y93j5: { label: geraDesconto },
          }))}
        ) { id }
      }
    `);
    console.log('[Baixa] Step 1b: Status da Devolução e Gera Desconto atualizados.');
  } catch (err) {
    console.error('[Baixa] Step 1b FALHA — verifique os labels (color_mm1y6q34, color_mm1y93j5) no Monday:', err.message);
  }

  // ── Step 2: Subelementos — Status Individual + Justificativa + Foto ─────────
  // Regras 1, 2 e 3
  console.log(`[Baixa] Step 2: atualizando ${epis_problema.length} subelemento(s)...`);
  for (const epi of epis_problema) {
    if (!epi.id_monday_subitem) {
      console.warn(`  ⚠ "${epi.epi}" sem id_monday_subitem — pulando update de colunas.`);
      continue;
    }

    // Regra 1 — Status Individual (label EXATO configurado no Monday)
    const validLabels = ['Reaproveitável', 'Descarte/Dano', 'Não Devolvido', 'A definir'];
    const safeLabel   = validLabels.includes(epi.status) ? epi.status : 'A definir';

    const subColVals = {
      color_mm2csadv: { label: safeLabel },
    };

    // Regra 2 — Justificativa: salva SEMPRE para Não Devolvido, mesmo se vazia
    if (ehNaoDevolvido(epi.status)) {
      subColVals.long_text_mm2cdz99 = { text: epi.justificativa?.trim() || '(sem justificativa informada)' };
    }

    try {
      await gql(`
        mutation {
          change_multiple_column_values(
            board_id: ${BOARD_DEVOLUCOES},
            item_id: ${epi.id_monday_subitem},
            column_values: ${JSON.stringify(JSON.stringify(subColVals))}
          ) { id }
        }
      `);
      console.log(`  ✓ Subitem "${epi.epi}" → Status: ${safeLabel}${epi.justificativa ? ' | Justificativa salva' : ''}`);
    } catch (e) {
      console.error(`  ✗ Falha ao atualizar subitem "${epi.epi}":`, e.message);
    }

    // Regra 3 — Foto: match por index (evita bug de EPIs com mesmo nome)
    const fotoMatch = fotos_epis?.find(f =>
      f.index !== undefined ? f.index === epi.index : f.nome === epi.epi
    );
    if (fotoMatch?.base64) {
      try {
        const { buffer, mimeType, ext } = dataUrlToBuffer(fotoMatch.base64);
        const filename = `Foto_${epi.epi.replace(/[^a-zA-Z0-9]/g, '_')}.${ext}`;
        await uploadArquivo(epi.id_monday_subitem, 'file_mm2c893g', buffer, mimeType, filename);
        console.log(`  📷 Foto de "${epi.epi}" anexada ao subelemento.`);
      } catch (e) {
        console.error(`  ✗ Falha ao anexar foto de "${epi.epi}":`, e.message);
      }
    }
  }

  // ── Step 3: Upload da assinatura do colaborador ─────────────────────────────
  console.log('[Baixa] Step 3: upload de assinatura...');
  try {
    const { buffer: sigBuf, mimeType: sigMime } = dataUrlToBuffer(assinatura_base64);
    await uploadArquivo(id_monday, 'file_mm1yms92', sigBuf, sigMime, 'assinatura.png');
    console.log('[Baixa] Step 3: assinatura enviada.');
  } catch (err) {
    // Não interrompe o fluxo — assinatura vai para o PDF mesmo se o upload falhar
    console.error('[Baixa] Step 3: FALHA no upload de assinatura (não crítico):', err.message);
  }

  // ── Step 3.1: Geração do Documento de Cautela (Regra 7) ─────────────────────
  // A cautela é gerada para TODOS os fluxos: concluída, com pendências e aguardando retorno
  console.log('[Baixa] Step 3.1: gerando Cautela PDF...');
  let sign_url_zapsign = null;

  try {
    // Tenta ZapSign primeiro para cautelas com pendências (assinatura jurídica)
    if (temProblema && !aguardandoRetorno) {
      let valor_desconto = 'A calcular';
      let tipo_desconto  = 'Folha de Pagamento';
      try {
        const itemInfo = await gql(`{
          items(ids: [${id_monday}]) {
            column_values(ids: ["color_mm1y1rf2"]) {
              id text ... on StatusValue { label }
            }
          }
        }`);
        const motRaw = (itemInfo?.items?.[0]?.column_values?.[0]?.label || '').toLowerCase();
        if (motRaw.includes('desligamento') || motRaw.includes('demiss')) tipo_desconto = 'Rescisão';
      } catch (_) {}

      const zapsignResult = await criarDocZapSignCautela({
        id_monday, nome, cpf, contrato, tecnico_responsavel,
        epis_problema, valor_desconto, tipo_desconto,
        sandbox: process.env.ZAPSIGN_SANDBOX === 'true',
      });
      sign_url_zapsign = zapsignResult.sign_url_colaborador;
      console.log(`[Baixa] Step 3.1: ZapSign OK — doc_id: ${zapsignResult.doc_id}`);
    }
  } catch (zapsignErr) {
    console.warn('[Baixa] Step 3.1: ZapSign bloqueado. Gerando Cautela Nativa (fallback):', zapsignErr.message);
  }

  // Cautela Nativa: gerada SEMPRE (fallback do ZapSign OU backup para fluxos sem pendência)
  try {
    const pdfBuffer = await generateCautelaPdf({
      nome, cpf, tecnico_responsavel, epis_problema, assinatura_base64,
    });
    // Regra 7 — anexa na coluna "Cautela Assinada" (file_mm1z1gbf) do Item Pai
    await uploadArquivo(id_monday, 'file_mm1z1gbf', pdfBuffer, 'application/pdf', `Cautela_${cpf?.replace(/\D/g,'') || 'EPI'}.pdf`);
    console.log('[Baixa] Step 3.1: Cautela PDF anexada com sucesso (file_mm1z1gbf).');
  } catch (pdfErr) {
    console.error('[Baixa] Step 3.1: FALHA ao gerar/anexar Cautela:', pdfErr.message);
  }

  // ── Step 4: Mover item de grupo ──────────────────────────────────────────────
  const grupoDestino = aguardandoRetorno ? 'group_mm27y9f1' : 'group_mm1y9na5';
  const nomeGrupo    = aguardandoRetorno ? 'Aguardando Retorno' : 'Histórico';
  console.log(`[Baixa] Step 4: movendo item para grupo "${nomeGrupo}"...`);
  try {
    await gql(`
      mutation {
        move_item_to_group(item_id: ${id_monday}, group_id: "${grupoDestino}") { id }
      }
    `);
    console.log(`[Baixa] Step 4: movido para "${nomeGrupo}".`);
  } catch (e) {
    console.error(`[Baixa] Step 4: FALHA ao mover item:`, e.message);
  }

  console.log('[Baixa] ✅ Concluído.');
  return { ok: true, tecnico: tecnico_responsavel, sign_url: sign_url_zapsign };
}


// ─── Buscar Histórico (grupo "Devolvidos") ────────────────────────────────────

export async function buscarHistorico() {
  const data = await gql(`
    query {
      boards(ids: [${BOARD_DEVOLUCOES}]) {
        groups(ids: ["group_mm1y9na5"]) {
          items_page(limit: 200) {
            items {
              id
              name
              subitems {
                id
                name
                column_values(ids: ["color_mm2csadv"]) { id text }
              }
              column_values(ids: [
                "text_mm1yrhrs",
                "text_mm1yfgtm",
                "date_mm1zythe",
                "text_mm1ypaa0",
                "color_mm1y6q34",
                "color_mm1y1rf2",
                "long_text_mm2chet8"
              ]) {
                id
                text
                ... on StatusValue { label }
              }
            }
          }
        }
      }
    }
  `);

  const items = data.boards?.[0]?.groups?.[0]?.items_page?.items ?? [];

  return items.map((item) => {
    const col    = (id) => item.column_values.find((c) => c.id === id)?.text ?? "";
    const colObj = (id) => item.column_values.find((c) => c.id === id) || {};

    // Status da Devolução: usa label do campo status (color_mm1y6q34)
    const statusLabel = colObj("color_mm1y6q34").label || col("color_mm1y6q34") || "Concluída";
    const motivoLabel = colObj("color_mm1y1rf2").label || col("color_mm1y1rf2") || "";

    // EPIs: deriva do status dos subelementos (fonte de verdade mais confiável)
    const todosSubitens   = (item.subitems ?? []).map(s => ({
      nome:   s.name,
      status: s.column_values.find(c => c.id === "color_mm2csadv")?.text ?? "A definir",
    }));
    const epis_devolvidos = todosSubitens.filter(s => !/(n[ãa]o\s*devolvido)/i.test(s.status)).map(s => s.nome);
    const epis_pendentes  = todosSubitens.filter(s =>  /(n[ãa]o\s*devolvido)/i.test(s.status)).map(s => s.nome);

    return {
      id:           item.id,
      nome:         item.name,
      cpf:          col("text_mm1yrhrs"),
      tecnico:      col("text_mm1yfgtm"),
      data:         col("date_mm1zythe"),
      contrato:     col("text_mm1ypaa0"),
      status:       statusLabel,
      epis_devolvidos,
      epis_pendentes,
      motivo_acao:  motivoLabel,
    };
  });
}