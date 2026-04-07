import { generateCautelaPdf } from './backend/services/pdf.js';
import fs from 'fs';

async function run() {
  try {
    const b = await generateCautelaPdf({
      nome: "Teste",
      cpf: "123",
      tecnico_responsavel: "Tec",
      epis_problema: [{ epi: "Bota", status: "Extravio" }],
      // assinatura_base64: "" // empty
      assinatura_base64: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
    });
    fs.writeFileSync('teste.pdf', b);
    console.log("Success! size: ", b.length);
  } catch (e) {
    console.error("Error", e);
  }
}
run();
