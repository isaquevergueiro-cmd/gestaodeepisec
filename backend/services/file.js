const MONDAY_FILE_URL = "https://api.monday.com/v2/file";

/**
 * Converte um data URL (base64) em buffer, suportando tanto imagens quanto PDFs.
 */
export function dataUrlToBuffer(dataUrl) {
  // Suporta imagens E PDFs: data:image/png;base64,... ou data:application/pdf;base64,...
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Formato de arquivo inválido. Esperado data URL em base64.");
  const mimeType = match[1];
  const ext = mimeType.includes("pdf")
    ? "pdf"
    : mimeType.split("/")[1] ?? "bin";
  const buffer = Buffer.from(match[2], "base64");
  return { buffer, mimeType, ext };
}

/**
 * Faz upload de um arquivo para a coluna de um item/subitem no Monday.com.
 * @param {string|number} item_id  - ID do item ou subitem
 * @param {string}        column_id
 * @param {Buffer}        buffer
 * @param {string}        mimeType
 * @param {string}        filename
 */
export async function uploadArquivo(item_id, column_id, buffer, mimeType, filename) {
  const mutation = `mutation ($file: File!) {
    add_file_to_column(item_id: ${item_id}, column_id: "${column_id}", file: $file) { id }
  }`;

  const form = new globalThis.FormData();
  form.append("query", mutation);
  form.append("variables[file]", new Blob([buffer], { type: mimeType }), filename);

  const res = await fetch(MONDAY_FILE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.MONDAY_API_TOKEN}`, "API-Version": "2024-10" },
    body: form,
  });

  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data;
}
