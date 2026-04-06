import { Router } from "express";
import { buscarPorCpf } from "../services/monday.js";

const router = Router();

router.get("/buscar-cpf", async (req, res) => {
  const { cpf } = req.query;

  if (!cpf) {
    return res.status(400).json({ error: "Parâmetro CPF é obrigatório." });
  }

  try {
    const result = await buscarPorCpf(cpf);
    res.json(result);
  } catch (err) {
    console.error("[GET /buscar-cpf]", err.message);
    const status = err.message.includes("não encontrado") ? 404 : 500;
    res.status(status).json({ error: err.message });
  }
});

export default router;
