import pdfmake from "pdfmake";

// pdfmake@0.3+ (servidor) usa addFonts + createPdf + getBuffer
// Helvetica é embutida no pdfkit (motor do pdfmake) — não precisa de arquivo externo
pdfmake.addFonts({
  Helvetica: {
    normal:      "Helvetica",
    bold:        "Helvetica-Bold",
    italics:     "Helvetica-Oblique",
    bolditalics: "Helvetica-BoldOblique",
  },
});

export function generateReceiptPdf(dadosBaixa) {
  const { cpf, tecnico_responsavel, epis_problema, assinatura_base64 } = dadosBaixa;

  const dataFormatada = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

  // Monta tabela de EPIs
  const tableBody = [
    [
      { text: "EPI",     style: "tableHeader" },
      { text: "Status",  style: "tableHeader" },
    ],
    ...( epis_problema && epis_problema.length > 0
      ? epis_problema.map((e) => [e.epi, e.status])
      : [["—", "Todos os EPIs devolvidos para reuso"]]
    ),
  ];

  const docDefinition = {
    defaultStyle: { font: "Helvetica", fontSize: 11, color: "#1a1a2e" },
    content: [
      { text: "🦺  Gestão de EPIs — SESMT", style: "header" },
      { text: "Comprovante de Devolução",   style: "subheader" },
      { canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: "#3b7ddd" }] },
      { text: " " },

      {
        columns: [
          { text: [{ text: "CPF do Colaborador:\n", style: "label" }, cpf] },
          { text: [{ text: "Técnico Responsável:\n", style: "label" }, tecnico_responsavel ?? "—"] },
          { text: [{ text: "Data / Hora:\n", style: "label" }, dataFormatada] },
        ],
        columnGap: 10,
        margin: [0, 10, 0, 16],
      },

      { text: "Equipamentos de Proteção Individual", style: "sectionTitle" },
      {
        style: "tableStyle",
        table: {
          widths: ["*", "*"],
          body: tableBody,
        },
        layout: {
          hLineColor: () => "#e2e8f0",
          vLineColor: () => "#e2e8f0",
        },
        margin: [0, 6, 0, 20],
      },

      ...(assinatura_base64
        ? [
            { text: "Assinatura Eletrônica do Colaborador", style: "sectionTitle" },
            { image: assinatura_base64, width: 200, margin: [0, 8, 0, 0] },
          ]
        : [{ text: "(Assinatura não coletada)", italics: true, color: "#94a3b8" }]),

      { text: " " },
      {
        text: "Este documento é gerado automaticamente pelo sistema de Gestão de EPIs — SESMT.",
        style: "footer",
      },
    ],
    styles: {
      header:      { fontSize: 16, bold: true, color: "#0b1120", margin: [0, 0, 0, 4] },
      subheader:   { fontSize: 12, color: "#3b7ddd", margin: [0, 0, 0, 8] },
      sectionTitle:{ fontSize: 10, bold: true, color: "#4b6180", margin: [0, 0, 0, 4], decoration: "underline" },
      label:       { fontSize: 9,  bold: true, color: "#4b6180" },
      tableHeader: { bold: true, fillColor: "#3b7ddd", color: "white", fontSize: 10 },
      tableStyle:  { fontSize: 10 },
      footer:      { fontSize: 9, color: "#94a3b8", italics: true },
    },
    pageMargins: [40, 40, 40, 40],
  };

  return new Promise(async (resolve, reject) => {
    try {
      const pdf = pdfmake.createPdf(docDefinition);
      const buffer = await pdf.getBuffer();
      resolve(buffer);
    } catch (err) {
      console.error("[PDF Error] Falha ao gerar Receipt:", err);
      reject(err);
    }
  });
}

export function generateCautelaPdf(dadosBaixa) {
  const { nome, cpf, tecnico_responsavel, epis_problema, assinatura_base64 } = dadosBaixa;
  const dataFormatada = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

  // Filtrar apenas com problema (Não Devolvido ou Descarte)
  const problematicos = epis_problema ? epis_problema.filter(e => e.status !== "Devolvido - Reuso") : [];

  const tableBody = [
    [
      { text: "Item do EPI",     style: "tableHeader" },
      { text: "Situação Reportada",  style: "tableHeader" },
    ],
    ...( problematicos.length > 0
      ? problematicos.map(e => [e.epi, e.status])
      : [["Nenhum", "Nenhum problema reportado"]]
    ),
  ];

  const docDefinition = {
    defaultStyle: { font: "Helvetica", fontSize: 11, color: "#1a1a2e" },
    content: [
      {
        columns: [
          { text: "SESMT - Serviço Especializado em Engenharia de Segurança e em Medicina do Trabalho", style: "header", width: '*' }
        ]
      },
      { text: "TERMO DE CAUTELA - PENDÊNCIAS DE EPI",   style: "title" },
      { canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 2, lineColor: "#EF4444" }] },
      { text: "\nDeclaro para os devidos fins que o colaborador abaixo qualificado possui pendências em relação à devolução ou conservação dos Equipamentos de Proteção Individual listados abaixo, de propriedade da empresa.\n", style: "paragraph" },

      {
        style: "infoBox",
        table: {
          widths: ["*"],
          body: [
            [
              {
                columns: [
                  { text: [{ text: "Nome do Colaborador:\n", style: "label" }, nome || "—"] },
                  { text: [{ text: "CPF:\n", style: "label" }, cpf || "—"] },
                  { text: [{ text: "Data da Conferência:\n", style: "label" }, dataFormatada] },
                ],
                margin: [6, 6, 6, 6],
              }
            ]
          ]
        },
        layout: "headerLineOnly"
      },

      { text: "Registro de Ocorrências", style: "sectionTitle", margin: [0, 15, 0, 8] },
      {
        table: {
          headerRows: 1,
          widths: ["*", "auto"],
          body: tableBody,
        },
        layout: {
          hLineColor: () => "#cbd5e1",
          vLineColor: () => "#cbd5e1",
          paddingLeft: () => 8,
          paddingRight: () => 8,
          paddingTop: () => 6,
          paddingBottom: () => 6,
        },
      },
      
      { text: "\nComprometo-me a justificar ou regularizar esta pendência, ciente das normativas internas quanto à conservação e guarda técnica de Equipamentos de Proteção Individual (EPI).\n", style: "paragraph" },

      ...(assinatura_base64
        ? [{
            columns: [
              { image: assinatura_base64, width: 220, alignment: "center", margin: [0, 10, 0, 0] },
              { text: "", width: "*" }
            ]
          }]
        : [{ text: "\n\n\n", margin: [0, 15, 0, 15] }]),
      {
        columns: [
          {
            stack: [
              { canvas: [{ type: "line", x1: 0, y1: 0, x2: 200, y2: 0, lineWidth: 1 }] },
              { text: nome || "Assinatura do Colaborador", alignment: "center", margin: [0, 4, 0, 0], fontSize: 9 }
            ],
            alignment: "center"
          },
          {
            stack: [
              { canvas: [{ type: "line", x1: 0, y1: 0, x2: 200, y2: 0, lineWidth: 1 }] },
              { text: tecnico_responsavel || "Técnico Responsável", alignment: "center", margin: [0, 4, 0, 0], fontSize: 9 }
            ],
            alignment: "center"
          }
        ]
      },
      { text: "\nDocumento gerado automaticamente pelo Sistema de Gestão de EPIs.", style: "footer", margin: [0, 40, 0, 0] }
    ],
    styles: {
      header:      { fontSize: 10, bold: true, color: "#64748b", margin: [0, 0, 0, 4], alignment: "center" },
      title:       { fontSize: 16, bold: true, color: "#1e293b", margin: [0, 10, 0, 8], alignment: "center" },
      paragraph:   { fontSize: 11, lineHeight: 1.4, color: "#334155", alignment: "justify" },
      sectionTitle:{ fontSize: 12, bold: true, color: "#1e293b" },
      label:       { fontSize: 9,  bold: true, color: "#64748b" },
      infoBox:     { margin: [0, 10, 0, 10], fillColor: "#f8fafc" },
      tableHeader: { bold: true, fillColor: "#EF4444", color: "white", fontSize: 11, alignment: "center" },
      footer:      { fontSize: 8, color: "#94a3b8", italics: true, alignment: "center" },
    },
    pageMargins: [40, 40, 40, 40],
  };

  return new Promise(async (resolve, reject) => {
    try {
      const pdf = pdfmake.createPdf(docDefinition);
      const buffer = await pdf.getBuffer();
      resolve(buffer);
    } catch (err) {
      console.error("[PDF Error] Falha ao gerar Cautela:", err);
      reject(err);
    }
  });
}
