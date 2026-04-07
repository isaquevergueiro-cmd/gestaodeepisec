import { Router } from "express";
import { salvarBaixa } from "../services/monday.js";
import { generateReceiptPdf, generateCautelaPdf } from "../services/pdf.js";
import { sendReceiptEmail } from "../services/email.js";

const router = Router();

router.post("/salvar-baixa", async (req, res) => {
  const {
    id_monday,
    nome,
    cpf,
    epis_problema,
    assinatura_base64,
    fotos_epis,
    tecnico_responsavel,
  } = req.body;

  // cpf é opcional para a gravação no Monday (usado apenas para o e-mail)
  if (!id_monday || !assinatura_base64) {
    return res.status(400).json({ error: "Campos obrigatórios faltando: id_monday e assinatura_base64." });
  }

  console.log(`[POST /salvar-baixa] id=${id_monday} tecnico=${tecnico_responsavel} epis=${epis_problema?.length ?? 0} fotos=${fotos_epis?.length ?? 0}`);

  try {
    const result = await salvarBaixa({
      id_monday,
      nome,
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
router.post("/gerar-cautela", async (req, res) => {
  const { nome, cpf, tecnico_responsavel, epis_problema } = req.body;

  try {
    const pdfBuffer = await generateCautelaPdf({
      nome,
      cpf,
      tecnico_responsavel,
      epis_problema: epis_problema ?? [],
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="cautela_${cpf || 'epi'}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error("[POST /gerar-cautela]", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
