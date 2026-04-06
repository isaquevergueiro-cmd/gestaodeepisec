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

  // Retorna Promise<Buffer>
  return pdfmake.createPdf(docDefinition).getBuffer();
}
