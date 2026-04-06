import { Router } from "express";
import { criarSolicitacao } from "../services/monday.js";

const router = Router();

router.post("/criar-solicitacao", async (req, res) => {
  const {
    nome_colaborador,
    cpf,
    contrato,
    motivo,
    data_solicitacao,
    epis_esperados,
    tecnico_responsavel,
  } = req.body;

  if (
    !nome_colaborador ||
    !cpf ||
    !contrato ||
    !motivo ||
    !data_solicitacao ||
    !epis_esperados?.length
  ) {
    return res.status(400).json({ error: "Campos obrigatórios faltando." });
  }

  try {
    const result = await criarSolicitacao({
      nome_colaborador,
      cpf,
      contrato,
      motivo,
      data_solicitacao,
      epis_esperados,
      tecnico_responsavel,
    });
    res.json(result);
  } catch (err) {
    console.error("[POST /criar-solicitacao]", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
