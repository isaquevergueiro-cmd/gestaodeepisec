const ZAPSIGN_API_URL = "https://api.zapsign.com.br/api/v1";
const MODEL_ID = "ae3e53b0-e51f-4fec-8e4f-eae2d718e8fb";

export async function criarDocZapSignCautela({
  nome,
  cpf,
  contrato,
  tecnico_responsavel,
  epis_problema,
  id_monday,
  valor_desconto = "A calcular",
  tipo_desconto  = "Folha de Pagamento",
}) {
  const token = process.env.ZAPSIGN_API;
  if (!token) throw new Error("ZAPSIGN_API nao configurado no .env");

  // Devolvidos = entregues fisicamente (reuso ou descarte). So "Nao Devolvido" gera penalidade.
  // Usa includes/normalize para ser robusto contra variações de encoding
  const isNaoDevolvido = (s) => s.toLowerCase().includes("n") && s.toLowerCase().includes("devolvido") && !s.toLowerCase().includes("sim") && s.toLowerCase().includes("o") && s.trim().split(" ").length <= 3;
  const devolvidos = epis_problema.filter(e => !e.status.toLowerCase().includes("nao devolvido") && !e.status.toLowerCase().includes("n\u00e3o devolvido"));
  const faltantes  = epis_problema.filter(e => e.status.toLowerCase().includes("nao devolvido") || e.status.toLowerCase().includes("n\u00e3o devolvido"));

  // Formatadores de String para o Template Juridico
  const devolvidosStr = devolvidos.length > 0
    ? devolvidos.map(e => `\u2022 ${e.epi} (${e.status})`).join("\n")
    : "Nenhum item devolvido integralmente.";

  const faltantesStr = faltantes.map(e => {
    let text = `\u2022 ${e.epi}`;
    if (e.justificativa) text += `\n  Justificativa: ${e.justificativa}`;
    return text;
  }).join("\n\n");

  // Texto juridico de desconto para inclusao na cautela
  // Compara de forma robusta (com ou sem acento)
  const isRescisao = tipo_desconto.toLowerCase().includes("rescis");
  const descontoLabel = isRescisao
    ? "a ser descontado da rescisao contratual"
    : "a ser descontado em folha de pagamento";

  const dataAtual = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

  const payload = {
    sandbox: false,
    name: `Cautela de Devolucao - ${nome} - ${dataAtual}`,
    external_id: String(id_monday),
    data: [
      { de: "{{NOME_COLABORADOR}}", para: nome },
      { de: "{{CPF_COLABORADOR}}",  para: cpf || "Nao informado" },
      { de: "{{CONTRATO}}",         para: contrato || "SESMT" },
      { de: "{{TECNICO}}",          para: tecnico_responsavel },
      { de: "{{LISTA_DEVOLVIDOS}}", para: devolvidosStr },
      {
        de: "{{LISTA_FALTANTES}}",
        para: faltantes.length > 0
          ? `${faltantesStr}\n\n\u26a0 O valor total ${descontoLabel}.`
          : "Nenhum item pendente.",
      },
      { de: "{{VALOR_DESCONTO}}", para: `${valor_desconto} (${tipo_desconto})` },
      { de: "{{DATA_ATUAL}}",     para: dataAtual },
      { de: "{{NOME_TECNICO}}",   para: tecnico_responsavel },
    ],
    signers: [
      { name: nome },
      { name: tecnico_responsavel },
    ],
  };

  const response = await globalThis.fetch(
    `${ZAPSIGN_API_URL}/models/${MODEL_ID}/docs/?api_token=${token}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  const json = await response.json();

  if (!response.ok) {
    throw new Error(`Erro ZapSign: ${json.detail || JSON.stringify(json)}`);
  }

  // ZapSign retorna os signatarios em json.signers
  // O link de assinatura do colaborador sera o sign_url do primeiro signer
  const signUrlColaborador = json.signers?.[0]?.sign_url;

  return {
    doc_id: json.token,
    sign_url_colaborador: signUrlColaborador,
    status: json.status,
  };
}
