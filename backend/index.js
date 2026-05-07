import "dotenv/config";
import express from "express";
import cors from "cors";

import apiRouter from "./routes/api.js";

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(express.json({ limit: "25mb" }));
app.use(cors());

// Rota principal da nova API (Fase 1 e 2 do doc)
app.use("/api", apiRouter);

app.get("/api/health", (_, res) =>
  res.json({ ok: true, timestamp: new Date().toISOString() })
);

app.listen(PORT, () => {
  console.log(`\n🦺 Backend EPI Manager rodando em http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health\n`);
});
