const MONDAY_URL = "https://api.monday.com/v2";
const MONDAY_FILE_URL = "https://api.monday.com/v2/file";

const BOARD_DEVOLUCOES = 18406415397;
const BOARD_CATALOGO = 18406575530;

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
          column_values(ids: ["long_text_mm25tz9r"]) {
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
  const episText = (item.column_values[0]?.text ?? "").trim();

  console.log(`[Busca] Encontrado: ${item.name} (ID ${item.id})`);
  return { id_monday: item.id, nome: item.name, epis_esperados_string: episText };
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

async function uploadArquivo(item_id, column_id, buffer, mimeType, filename) {
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
  epis_problema,
  assinatura_base64,
  fotos_epis,
  tecnico_responsavel,
}) {
  // epis_problema agora é um array de objetos: { epi, status }
  const temProblema = epis_problema.some(e => e.status !== "Devolvido - Reuso");
  const dataDevolucao = new Date().toISOString().slice(0, 10);

  // ── Step 1a: Campos seguros (texto, data, relação do catálogo) ───────────────
  console.log("[Baixa] Step 1a: atualizando campos seguros...");

  const safeValues = {
    text_mm1yfgtm: tecnico_responsavel ?? "",
    date_mm1zythe: { date: dataDevolucao },
  };

  if (temProblema) {
    const nomesEPIsComProblema = epis_problema
      .filter(e => e.status !== "Devolvido - Reuso")
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
    const colorValues = {
      color_mm1y6q34: { label: temProblema ? "Com Pendências" : "Concluída" },
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

  // ── Step 4: Mover item para grupo Histórico (Devolvidos) ──────────────────
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

  console.log("[Baixa] Concluído com sucesso.");
  return { ok: true, tecnico: tecnico_responsavel };
}
