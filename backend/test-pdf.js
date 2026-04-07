import { generateCautelaPdf } from "./services/pdf.js";

async function run() {
  try {
    const buf = await generateCautelaPdf({
      nome: "Test",
      cpf: "123",
      tecnico_responsavel: "Tec",
      epis_problema: [{ epi: "Botina", status: "Descarte" }],
    });
    console.log("PDF generated, buffer size:", buf?.length);
  } catch (err) {
    console.error("Error generating PDF:", err);
  }
}
run();
