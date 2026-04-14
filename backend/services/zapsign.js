const ZAPSIGN_API_URL = "https://api.zapsign.com.br/api/v1";
const MODEL_ID = "1ac5b14e-7e28-44cd-bf18-27ee45703179";

export async function criarDocZapSignCautela({
  nome,
  cpf,
  contrato,
  tecnico_responsavel,
  epis_problema,
  epis_esperados,
  is_admissao = false,
  id_monday,
  valor_desconto = "A calcular",
  tipo_desconto = "Folha de Pagamento",
  sandbox = false,
}) {
  const token = process.env.ZAPSIGN_API;
  if (!token) throw new Error("ZAPSIGN_API nao configurado no .env");

  let entreguesStr = "";
  let faltantesStrBody = "";
  let rodapeValores = "";

  if (is_admissao) {
    entreguesStr = epis_esperados && epis_esperados.length > 0
      ? epis_esperados.map(e => `\u2022 ${e.nome} (Tamanho: ${e.tamanho || '-'} | Qtd: ${e.qtd || 1})`).join("\n")
      : "Nenhum item.";
    faltantesStrBody = "Entrega Inicial. Ação de fornecimento. Não há devolução ou pendências.";
    rodapeValores = "Ação de Admissão - Sem Custo.";
  } else {
    const devolvidos = epis_problema.filter(e => !e.status.toLowerCase().includes("nao devolvido") && !e.status.toLowerCase().includes("n\u00e3o devolvido"));
    const faltantes = epis_problema.filter(e => e.status.toLowerCase().includes("nao devolvido") || e.status.toLowerCase().includes("n\u00e3o devolvido"));

    entreguesStr = devolvidos.length > 0
      ? devolvidos.map(e => `\u2022 ${e.epi} (${e.status})`).join("\n")
      : "Nenhum item devolvido integralmente.";

    const fStr = faltantes.map(e => {
      let text = `\u2022 ${e.epi}`;
      if (e.justificativa) text += `\n  Justificativa: ${e.justificativa}`;
      return text;
    }).join("\n\n");

    const isRescisao = tipo_desconto.toLowerCase().includes("rescis");
    const descontoLabel = isRescisao
      ? "a ser descontado da rescisao contratual"
      : "a ser descontado em folha de pagamento";

    if (faltantes.length > 0) {
      faltantesStrBody = `${fStr}\n\n\u26a0 O valor total ${descontoLabel}.`;
    } else {
      faltantesStrBody = "Nenhum item pendente.";
    }
    rodapeValores = `${valor_desconto} (${tipo_desconto})`;
  }

  const dataAtual = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

  // Payload da ROTA NOVA (create-doc). O Modelo, o Colaborador e o Técnico vão aqui.
  const payload = {
    sandbox: sandbox,
    template_id: MODEL_ID,
    signers: [
      { name: nome },
      { name: tecnico_responsavel }
    ],
    external_id: String(id_monday),
    data: [
      { de: "{{NOME_COLABORADOR}}", para: nome },
      { de: "{{CPF_COLABORADOR}}", para: cpf || "Nao informado" },
      { de: "{{CONTRATO}}", para: contrato || "SESMT" },
      { de: "{{TECNICO}}", para: tecnico_responsavel },
      { de: "{{LISTA_DEVOLVIDOS}}", para: entreguesStr },
      { de: "{{LISTA_FALTANTES}}", para: faltantesStrBody },
      { de: "{{VALOR_DESCONTO}}", para: rodapeValores },
      { de: "{{DATA_ATUAL}}", para: dataAtual },
      { de: "{{NOME_TECNICO}}", para: tecnico_responsavel },
    ]
  };

  // O ZapSign atualizou a política de testes: não aceitam mais requisições gratuitas 
  // na API de Produção usando a flag sandbox:true. Exigem o subdomínio sandbox.
  const baseUrl = sandbox ? "https://sandbox.api.zapsign.com.br/api/v1" : ZAPSIGN_API_URL;

  // Cria o documento com o colaborador usando URL limpa e autenticação no Header
  const response = await globalThis.fetch(
    `${baseUrl}/models/create-doc/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": `Bearer ${token.trim()}`
      },
      body: JSON.stringify(payload),
    }
  );

  const textResponse = await response.text();
  let json;
  try {
    json = JSON.parse(textResponse);
  } catch (e) {
    throw new Error(`O ZapSign bloqueou a requisição de criação. Resposta: ${textResponse.slice(0, 150)}...`);
  }

  if (!response.ok) {
    throw new Error(`Erro ZapSign (Criar): ${json.detail || JSON.stringify(json)}`);
  }

  const docToken = json.token;
  const signUrlColaborador = json.signers?.[0]?.sign_url;

  // RESTAURADO: O técnico como segundo signatário agora é obrigatório para validade jurídica.
  // O documento só será concluído quando o técnico também assinar por e-mail ou gerando o link separadamente.

  return {
    doc_id: docToken,
    sign_url_colaborador: signUrlColaborador,
    status: json.status,
  };
}