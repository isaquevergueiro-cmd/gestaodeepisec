import "dotenv/config";
import express from "express";
import cors from "cors";
import solicitacaoRouter from "./routes/solicitacao.js";
import buscaRouter from "./routes/busca.js";
import baixaRouter from "./routes/baixa.js";
import dashboardRouter from "./routes/dashboard.js";
import historicoRouter from "./routes/historico.js";
import zapsignRouter from "./routes/zapsign.js";
import { initCronSla } from "./services/cronSla.js";

const app = express();
const PORT = process.env.PORT ?? 3001;

// Aumentar limite para suportar assinatura em base64 (~2-3MB)
app.use(express.json({ limit: "15mb" }));
app.use(cors());

app.use("/api", solicitacaoRouter);
app.use("/api", buscaRouter);
app.use("/api", baixaRouter);
app.use("/api", dashboardRouter);
app.use("/api", historicoRouter);
app.use("/api", zapsignRouter);

app.get("/api/health", (_, res) =>
  res.json({ ok: true, timestamp: new Date().toISOString() })
);

app.listen(PORT, () => {
  console.log(`\n🦺 Backend EPI Manager rodando em http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health\n`);
  initCronSla();
});
