import { Router } from "express";
import { salvarBaixa } from "../services/monday.js";
import { generateReceiptPdf } from "../services/pdf.js";
import { sendReceiptEmail } from "../services/email.js";

const router = Router();

router.post("/salvar-baixa", async (req, res) => {
  const {
    id_monday,
    cpf,
    epis_problema,
    assinatura_base64,
    fotos_epis,
    tecnico_responsavel,
  } = req.body;

  if (!id_monday || !cpf || !assinatura_base64) {
    return res.status(400).json({ error: "Campos obrigatórios faltando." });
  }

  try {
    const result = await salvarBaixa({
      id_monday,
      cpf,
      epis_problema: epis_problema ?? [],
      assinatura_base64,
      fotos_epis: fotos_epis ?? [],
      tecnico_responsavel,
    });

    // Gera PDF e envia email de forma assíncrona (não precisa bloquear a resposta)
    generateReceiptPdf({
      cpf,
      tecnico_responsavel,
      epis_problema: epis_problema ?? [],
      assinatura_base64,
    })
      .then((pdfBuffer) => sendReceiptEmail(pdfBuffer, cpf))
      .catch((err) => console.error("[PDF/Email Error]", err));

    res.json({ ...result, emailDisparado: true });
  } catch (err) {
    console.error("[POST /salvar-baixa]", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
