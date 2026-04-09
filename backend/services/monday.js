const MONDAY_URL = "https://api.monday.com/v2";
const MONDAY_FILE_URL = "https://api.monday.com/v2/file";

const BOARD_DEVOLUCOES = 18406415397;
const BOARD_CATALOGO = 18406575530;

import { generateReceiptPdf } from "./pdf.js";
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
  contrato,
  motivo,
  data_solicitacao,
  epis_esperados,
  tecnico_responsavel,
}) {
  const episString = epis_esperados.join(", ");

  // Campos seguros — não incluem colunas de status para não bloquear a criação
  const safeColumnValues = JSON.stringify({
    text_mm1yrhrs:      cpf,
    text_mm1ypaa0:      contrato,
    date_mm1ys9b:       { date: data_solicitacao },
    long_text_mm25tz9r: { text: episString },
    text_mm1yfgtm:      tecnico_responsavel,
  });

  const data = await gql(
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

  const itemId = data.create_item.id;
  console.log(`[Criar] Item criado: ${itemId} (${tecnico_responsavel})`);

  // Coluna de status (motivo) separada — label deve bater exatamente com o Monday
  // Labels disponíveis: "Troca Anual", "Desgaste/Avaria", "Desligamento", "A definir"
  try {
    const colorVals = JSON.stringify(JSON.stringify({ color_mm1y1rf2: { label: motivo } }));
    await gql(`
      mutation {
        change_multiple_column_values(
          board_id: ${BOARD_DEVOLUCOES},
          item_id: ${itemId},
          column_values: ${colorVals}
        ) { id }
      }
    `);
    console.log(`[Criar] Motivo "${motivo}" gravado.`);
  } catch (err) {
    console.error(
      `[Criar] FALHA ao gravar motivo "${motivo}" — verifique os labels em catalog.js:\n`,
      err.message
    );
  }

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
          column_values(ids: ["long_text_mm25tz9r", "color_mm1y6q34", "long_text_mm27kb2p"]) {
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
  
  const colEpisBase  = item.column_values.find(c => c.id === "long_text_mm25tz9r")?.text ?? "";
  const colPendentes = item.column_values.find(c => c.id === "long_text_mm27kb2p")?.text ?? "";

  // Se a coluna "EPIs Pendentes de Retorno" tem conteúdo → segunda visita
  const isRetorno = colPendentes.trim() !== "";
  const episText  = isRetorno ? colPendentes.trim() : colEpisBase.trim();

  // EPIs já devolvidos = todos esperados MENOS os ainda pendentes
  let epis_ja_devolvidos = [];
  if (isRetorno && colEpisBase.trim() !== "") {
    const todosEpis    = colEpisBase.split(/,\s*|\n/).map(e => e.trim()).filter(Boolean);
    const pendentesSet = new Set(colPendentes.split(/,\s*|\n/).map(e => e.trim()).filter(Boolean));
    epis_ja_devolvidos = todosEpis.filter(e => !pendentesSet.has(e));
  }

  console.log(`[Busca] Encontrado: ${item.name} (ID ${item.id}) | Retorno: ${isRetorno} | Pendentes: "${episText.slice(0,60)}" | Já entregues: ${epis_ja_devolvidos.length}`);
  return { 
    id_monday:          item.id, 
    nome:               item.name, 
    epis_esperados_string: episText,
    is_retorno:         isRetorno,
    epis_ja_devolvidos,
  };
}

// ─── Fase 2 — Buscar por Nome ──────────────────────────────────────────────────

export async function buscarPorNome(nome) {
  // Para buscar por nome com suporte a múltiplas correspondências
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
          column_values(ids: ["text_mm1yrhrs", "long_text_mm25tz9r", "color_mm1y6q34", "long_text_mm27kb2p"]) {
            id
            text
          }
        }
      }
    }`,
    { boardId: String(BOARD_DEVOLUCOES), nome }
  );

  const items = data.items_page_by_column_values?.items ?? [];
  if (!items.length) {
    // Se "name" não for suportado p/ by_column_values, vamos buscar na page direto
    // Tentativa fallback buscando no board inteiro os primeiros 500
    console.log(`[Busca] Tentativa fallback para busca de nome: ${nome}`);
    const fallbackData = await gql(
      `query BuscarFallback($boardId: ID!) {
        boards(ids: [$boardId]) {
          items_page(limit: 500) {
            items {
              id
              name
              column_values(ids: ["text_mm1yrhrs", "long_text_mm25tz9r", "color_mm1y6q34", "long_text_mm27kb2p"]) {
                id
                text
              }
            }
          }
        }
      }`,
      { boardId: String(BOARD_DEVOLUCOES) }
    );
    
    const fallbackItems = fallbackData.boards?.[0]?.items_page?.items ?? [];
    const matched = fallbackItems.filter(i => i.name.toLowerCase().includes(nome.toLowerCase()));
    
    if (!matched.length) throw new Error("Nenhum colaborador encontrado com este nome.");
    
    
    return matched.map(item => {
      const colCpf = item.column_values.find(c => c.id === "text_mm1yrhrs")?.text ?? "";
      
      const colStatus = item.column_values.find(c => c.id === "color_mm1y6q34")?.text ?? "";
      const aguardando = colStatus === "Pendente (Aguardando Retorno)" || colStatus === "Aguardando Colaborador";
      const colEpisBase = item.column_values.find(c => c.id === "long_text_mm25tz9r")?.text ?? "";
      const colPendentes = item.column_values.find(c => c.id === "long_text_mm27kb2p")?.text ?? "";
      const episText = (aguardando && colPendentes.trim() !== "") ? colPendentes.trim() : colEpisBase.trim();

      return { id_monday: item.id, nome: item.name, cpf: colCpf, epis_esperados_string: episText };
    });
  }

  // Se a primeira tentativa funcionou:
  return items.map(item => {
    const colCpf = item.column_values.find(c => c.id === "text_mm1yrhrs")?.text ?? "";
    
    const colStatus = item.column_values.find(c => c.id === "color_mm1y6q34")?.text ?? "";
    const aguardando = colStatus === "Pendente (Aguardando Retorno)" || colStatus === "Aguardando Colaborador";
    const colEpisBase = item.column_values.find(c => c.id === "long_text_mm25tz9r")?.text ?? "";
    const colPendentes = item.column_values.find(c => c.id === "long_text_mm27kb2p")?.text ?? "";
    const episText = (aguardando && colPendentes.trim() !== "") ? colPendentes.trim() : colEpisBase.trim();

    return { id_monday: item.id, nome: item.name, cpf: colCpf, epis_esperados_string: episText };
  });
}

// ─── Fase 3 helper — Buscar IDs no Catálogo ──────────────────────────────────

async function buscarIdsCatalogo(nomes) {
  console.log("[Catálogo] Buscando IDs para:", nomes);

  // Hardcode o board ID diretamente para evitar problemas de tipo de variável
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

// ─── Helper — Extrai mime type e buffer de um data URL ───────────────────────

function dataUrlToBuffer(dataUrl) {
  const match = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) throw new Error("Formato de imagem inválido.");
  const mimeType = match[1];                          // ex: "image/jpeg" ou "image/png"
  const ext      = mimeType.split("/")[1];            // ex: "jpeg" ou "png"
  const buffer   = Buffer.from(match[2], "base64");
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

// ─── Fase 3 — Salvar Baixa + Upload de Assinatura e Fotos ────────────────────

export async function salvarBaixa({
  id_monday,
  nome,
  cpf,
  epis_problema,
  assinatura_base64,
  fotos_epis,
  tecnico_responsavel,
}) {
  // epis_problema agora é um array de objetos: { epi, status, justificativa, prazo_marcado }
  // Só consideramos "problema" (passível de ZapSign/Desconto) quem de fato NÃO devolver o EPI.
  // Itens descartados (Devolvido - Descarte) foram fisicamente devolvidos e não penalizam.
  const ehNaoDevolvido = (s) => s.toLowerCase().includes("n") && s.toLowerCase().includes("devolvido") && s.trim().split(" ").length <= 3;
  const temProblema = epis_problema.some(e => ehNaoDevolvido(e.status));
  const aguardandoRetorno = epis_problema.some(e => e.prazo_marcado);
  const dataDevolucao = new Date().toISOString().slice(0, 10);

  const justificativasFull = epis_problema
    .filter(e => e.justificativa)
    .map(e => `${e.epi}: ${e.justificativa}`)
    .join("\\n");

  // ── Step 1a: Campos seguros (texto, data, relação do catálogo) ───────────────
  console.log("[Baixa] Step 1a: atualizando campos seguros...");

  const safeValues = {
    text_mm1yfgtm: tecnico_responsavel ?? "",
    date_mm1zythe: { date: dataDevolucao },
  };

  if (justificativasFull) {
    safeValues.long_text_mm27305t = { text: justificativasFull };
  }

  const pendentesParaFuturo = epis_problema.filter(e => e.prazo_marcado).map(e => e.epi);

  if (aguardandoRetorno) {
    let date = new Date();
    let addedDays = 0;
    while (addedDays < 3) {
      date.setDate(date.getDate() + 1);
      if (date.getDay() !== 0 && date.getDay() !== 6) {
        addedDays++;
      }
    }
    safeValues.date_mm27vzkv = { date: date.toISOString().slice(0, 10) };
    safeValues.long_text_mm27kb2p = { text: pendentesParaFuturo.join(", ") };
  } else {
    // Certeza que limpou ou não tem
    safeValues.long_text_mm27kb2p = { text: "" };
  }

  if (temProblema) {
    const nomesEPIsComProblema = epis_problema
      .filter(e => ehNaoDevolvido(e.status))
      .map(e => e.epi);
    
    // Opcional: A gravação detalhada do status pode ser feita concatenando num Log ou automatizada
    // O ideal pra segunda fase seria o Monday suportar atualizar Status de Subitems... Aqui faremos o Link.
    
    const catalogIds = await buscarIdsCatalogo(nomesEPIsComProblema);
    if (catalogIds.length > 0) {
      safeValues.board_relation_mm258fse = { item_ids: catalogIds };
      console.log("[Baixa] Step 1a: IDs catálogo:", catalogIds);
    }
  }

  const safeColVals = JSON.stringify(JSON.stringify(safeValues));
  await gql(`
    mutation {
      change_multiple_column_values(
        board_id: ${BOARD_DEVOLUCOES},
        item_id: ${id_monday},
        column_values: ${safeColVals}
      ) { id }
    }
  `);
  console.log("[Baixa] Step 1a: campos seguros atualizados.");

  // ── Step 1b: Colunas de Status (labels dependem da config do Monday) ─────────
  // ⚠️  Se der erro aqui, confira os labels exatos nas colunas color_mm1y6q34
  //     e color_mm1y93j5 no Monday e atualize os valores abaixo.
  try {
    let statusLabel = "Concluída";
    if (aguardandoRetorno) statusLabel = "Pendente (Aguardando Retorno)";
    else if (temProblema) statusLabel = "Com Pendências";

    const colorValues = {
      color_mm1y6q34: { label: statusLabel },
      color_mm1y93j5: { label: temProblema ? "Sim" : "Não" },
    };
    const colorColVals = JSON.stringify(JSON.stringify(colorValues));
    await gql(`
      mutation {
        change_multiple_column_values(
          board_id: ${BOARD_DEVOLUCOES},
          item_id: ${id_monday},
          column_values: ${colorColVals}
        ) { id }
      }
    `);
    console.log("[Baixa] Step 1b: status atualizados.");
  } catch (err) {
    // Não bloqueia a operação — apenas loga para correção
    console.error(
      "[Baixa] Step 1b: FALHA nos labels de status — ajuste as strings abaixo em monday.js:\n",
      err.message
    );
  }

  // ── Step 2: Upload das fotos de cada EPI → coluna Evidências/Fotos ─────────
  if (fotos_epis?.length) {
    console.log(`[Baixa] Step 2: uploading ${fotos_epis.length} foto(s) de EPI...`);
    for (const { nome, base64 } of fotos_epis) {
      const { buffer, mimeType, ext } = dataUrlToBuffer(base64);
      const filename = `EPI_${nome.replace(/[^a-zA-Z0-9]/g, "_")}.${ext}`;
      await uploadArquivo(id_monday, "file_mm1y612z", buffer, mimeType, filename);
      console.log(`[Baixa] Step 2: foto enviada — ${filename} (${mimeType})`);
    }
  }

  // ── Step 3: Upload da assinatura → coluna Assinatura ─────────────────────
  console.log("[Baixa] Step 3: uploading assinatura...");
  const { buffer: sigBuf, mimeType: sigMime } = dataUrlToBuffer(assinatura_base64);
  await uploadArquivo(id_monday, "file_mm1yms92", sigBuf, sigMime, "assinatura.png");
  console.log("[Baixa] Step 3: assinatura enviada.");

  // ── Step 3.1: Geração Nativa de Cautela via ZapSign (Se houver problema e NÃO pendente) ───
  let sign_url_zapsign = null;

  if (temProblema && !aguardandoRetorno) {
    console.log("[Baixa] Step 3.1: Iniciando fluxo jurídico ZapSign...");
    try {
      // Busca valor do desconto e motivo da ação para enriquecer a Cautela
      let valor_desconto = "A calcular";
      let tipo_desconto  = "Folha de Pagamento";

      try {
        const itemInfo = await gql(`{
          items(ids: [${id_monday}]) {
            column_values(ids: ["lookup_mm259jnj", "color_mm1y1rf2"]) {
              id
              text
              ... on MirrorValue { display_value }
              ... on StatusValue { label }
            }
          }
        }`);
        const cols = itemInfo?.items?.[0]?.column_values ?? [];
        const colValor  = cols.find(c => c.id === "lookup_mm259jnj");
        const colMotivo = cols.find(c => c.id === "color_mm1y1rf2");

        const valorRaw = colValor?.display_value || colValor?.text || "";
        if (valorRaw && valorRaw.trim() !== "") valor_desconto = valorRaw.trim();

        const motivoRaw = (colMotivo?.label || colMotivo?.text || "").toLowerCase();
        if (motivoRaw.includes("desligamento")) tipo_desconto = "Rescisão";
        
        console.log(`[Baixa] Step 3.1: valor="${valor_desconto}" tipo="${tipo_desconto}"`);
      } catch (e) {
        console.warn("[Baixa] Step 3.1: Não foi possível buscar valor/motivo:", e.message);
      }

      const zapsignResult = await criarDocZapSignCautela({
        id_monday,
        nome,
        cpf,
        tecnico_responsavel,
        epis_problema,
        valor_desconto,
        tipo_desconto,
      });
      
      sign_url_zapsign = zapsignResult.sign_url_colaborador;
      console.log(`[Baixa] Step 3.1: ZapSign Documento Criado! ID: ${zapsignResult.doc_id}`);
    } catch (err) {
      console.error("[Baixa] Erro crítico na API ZapSign:", err.message);
    }
  } else if (!aguardandoRetorno) {
    console.log("[Baixa] Cautela pulada, devolução sem pendências definitivas não exige termo legal.");
  }

  // ── Step 4: Mover item para grupo Histórico (Devolvidos) ──────────────────
  if (!aguardandoRetorno) {
    console.log("[Baixa] Step 4: movendo item para grupo histórico...");
    await gql(`
      mutation {
        move_item_to_group(
          item_id: ${id_monday},
          group_id: "group_mm1y9na5"
        ) { id }
      }
    `);
    console.log("[Baixa] Step 4: item movido para Histórico.");
  } else {
    console.log("[Baixa] Step 4: movendo item para grupo Pendente...");
    await gql(`
      mutation {
        move_item_to_group(
          item_id: ${id_monday},
          group_id: "group_mm27y9f1"
        ) { id }
      }
    `);
    console.log("[Baixa] Step 4: Item movido para Pendentes.");
  }

  console.log("[Baixa] Concluído com sucesso.");
  return { 
    ok: true, 
    tecnico: tecnico_responsavel,
    sign_url: sign_url_zapsign 
  };
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
              column_values(ids: [
                "text_mm1yrhrs",
                "text_mm1yfgtm",
                "date_mm1zythe",
                "text_mm1ypaa0",
                "color_mm1y6q34",
                "board_relation_mm258fse",
                "long_text_mm25tz9r",
                "long_text_mm27kb2p",
                "lookup_mm259jnj",
                "color_mm1y1rf2"
              ]) {
                id
                text
                ... on BoardRelationValue { display_value }
                ... on MirrorValue { display_value }
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
    const col = (id) => item.column_values.find((c) => c.id === id)?.text ?? "";
    const colObj = (id) => item.column_values.find((c) => c.id === id) || {};

    const epis_esperados = col("long_text_mm25tz9r").split(/,\s*|\n/).map(e => e.trim()).filter(Boolean);
    const epis_pendentes = col("long_text_mm27kb2p").split(/,\s*|\n/).map(e => e.trim()).filter(Boolean);
    
    // Devolvidos = Esperados - Pendentes
    const pendentesSet = new Set(epis_pendentes);
    const epis_devolvidos = epis_esperados.filter(e => !pendentesSet.has(e));

    const valorRaw = colObj("lookup_mm259jnj").display_value || col("lookup_mm259jnj") || "";
    const motivoRaw = colObj("color_mm1y1rf2").label || col("color_mm1y1rf2") || "";

    return {
      id:       item.id,
      nome:     item.name,
      cpf:      col("text_mm1yrhrs"),
      tecnico:  col("text_mm1yfgtm"),
      data:     col("date_mm1zythe"),
      contrato: col("text_mm1ypaa0"),
      status:   item.column_values.find(c => c.id === "board_relation_mm258fse")?.text ? "Com Pendências" : "Concluída",
      epis_devolvidos,
      epis_pendentes,
      valor_desconto: valorRaw,
      motivo_acao: motivoRaw,
    };
  });
}
