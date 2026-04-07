import { Router } from "express";
import { buscarHistorico } from "../services/monday.js";

const router = Router();

// GET /api/historico
router.get("/historico", async (_req, res) => {
  try {
    const items = await buscarHistorico();
    res.json(items);
  } catch (err) {
    console.error("[Histórico] Erro:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
