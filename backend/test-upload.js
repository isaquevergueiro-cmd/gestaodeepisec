import { generateCautelaPdf } from "./services/pdf.js";

async function uploadArquivo(item_id, column_id, buffer, mimeType, filename) {
  const mutation = `mutation ($file: File!) {
    add_file_to_column(item_id: ${item_id}, column_id: "${column_id}", file: $file) { id }
  }`;

  const form = new globalThis.FormData();
  form.append("query", mutation);
  form.append("variables[file]", new Blob([buffer], { type: mimeType }), filename);

  const res = await fetch("https://api.monday.com/v2/file", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.MONDAY_API_TOKEN}` },
    body: form,
  });

  const json = await res.json();
  console.log(`[Upload] ${filename} → ${column_id}:`, JSON.stringify(json, null, 2));
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data;
}

async function run() {
  try {
    const q = await fetch("https://api.monday.com/v2", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.MONDAY_API_TOKEN}`,
        "Content-Type": "application/json",
        "API-Version": "2024-10",
      },
      body: JSON.stringify({ query: "{ boards(ids: [18406415397]) { items_page(limit: 1) { items { id } } } }" }),
    }).then(r => r.json());
    
    const itemId = q.data.boards[0].items_page.items[0].id;
    
    const buf = await generateCautelaPdf({
      nome: "Test",
      cpf: "123",
      tecnico_responsavel: "Tec",
      epis_problema: [{ epi: "Botina", status: "Descarte" }],
    });
    
    await uploadArquivo(itemId, "file_mm1yms92", buf, "application/pdf", "Termo_de_Cautela.pdf");
  } catch (err) {
    console.error("Error generating/uploading PDF:", err);
  }
}
run();
