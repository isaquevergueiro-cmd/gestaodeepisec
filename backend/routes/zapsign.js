import { Router } from "express";
import { uploadArquivo } from "../services/monday.js";

const router = Router();

// ─── Função interna: baixa o PDF do S3 e envia ao Monday ──────────────────────
async function processarPdfZapSign({ item_id, pdfUrl }) {
  console.log(`[ZapSign] Baixando PDF assinado: ${pdfUrl}`);
  const fileRes = await globalThis.fetch(pdfUrl);
  if (!fileRes.ok) throw new Error(`Falha ao baixar PDF. HTTP: ${fileRes.status}`);

  const arrayBuffer = await fileRes.arrayBuffer();
  const fileBuffer = Buffer.from(arrayBuffer);

  console.log(`[ZapSign] PDF baixado (${fileBuffer.length} bytes). Enviando ao Monday item: ${item_id}`);
  await uploadArquivo(
    Number(item_id),
    "file_mm1z1gbf",      // coluna "Cautela Assinada"
    fileBuffer,
    "application/pdf",
    `Cautela_Assinada_${item_id}.pdf`
  );
  console.log(`[ZapSign] Cautela enviada ao Monday com sucesso!`);
}

// ─── Webhook ZapSign (POST /api/webhook/zapsign) ───────────────────────────────
//
// Formato do payload doc_signed (documentacao oficial):
// {
//   event_type: "doc_signed",
//   status: "signed" | "pending",   // "signed" = todos assinaram
//   external_id: "<id_monday>",
//   signed_file: "<url_pdf_s3>",    // URL temporaria, 60min
//   token: "<doc_token>",
//   ...
// }
router.post("/webhook/zapsign", async (req, res) => {
  try {
    // Responde imediatamente para evitar timeout do ZapSign
    res.status(200).send("OK");

    const body = req.body;
    console.log("[ZapSign Webhook] event_type:", body.event_type, "| status:", body.status, "| external_id:", body.external_id);

    // Só processa quando o documento esta 100% assinado por todos
    if (body.event_type !== "doc_signed") {
      console.log(`[ZapSign Webhook] Evento ignorado: "${body.event_type}"`);
      return;
    }

    if (body.status !== "signed") {
      console.log(`[ZapSign Webhook] Status ainda pendente ("${body.status}"). Aguardando demais signatarios.`);
      return;
    }

    const item_id = body.external_id;
    if (!item_id) {
      console.error("[ZapSign Webhook] external_id ausente — nao e possivel identificar o item do Monday.");
      return;
    }

    // Tenta obter o PDF pelas possiveis chaves do payload
    const pdfUrl = body.signed_file || body.signed_file_link || body.pdf_url;
    if (!pdfUrl) {
      console.error("[ZapSign Webhook] Nenhum link de PDF encontrado. Campos recebidos:", Object.keys(body));
      return;
    }

    // Processa de forma assincrona (resposta ja foi enviada)
    await processarPdfZapSign({ item_id, pdfUrl });

  } catch (error) {
    console.error("[ZapSign Webhook] Erro ao processar:", error.message);
  }
});

// ─── Rota de simulacao manual para testes sem ngrok ───────────────────────────
// Uso: POST /api/zapsign/simular
// Body: { "item_id": "123456", "pdf_url": "https://..." }
router.post("/zapsign/simular", async (req, res) => {
  const { item_id, pdf_url } = req.body;
  if (!item_id || !pdf_url) {
    return res.status(400).json({ error: "Parametros necessarios: item_id e pdf_url" });
  }
  try {
    await processarPdfZapSign({ item_id, pdfUrl: pdf_url });
    res.json({ ok: true, message: `PDF enviado ao Monday item ${item_id}` });
  } catch (err) {
    console.error("[ZapSign Simular]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET de teste para verificar se a rota esta ativa ─────────────────────────
router.get("/webhook/zapsign", (_req, res) => {
  res.json({ ok: true, message: "Endpoint ZapSign ativo. Use POST para receber webhooks." });
});

export default router;
