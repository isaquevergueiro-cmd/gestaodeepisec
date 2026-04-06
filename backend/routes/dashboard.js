import { Router } from "express";

const router = Router();

const MONDAY_URL = "https://api.monday.com/v2";
const BOARD_DEVOLUCOES = 18406415397;

async function gql(query) {
  const res = await fetch(MONDAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.MONDAY_API_TOKEN}`,
      "Content-Type": "application/json",
      "API-Version": "2024-10",
    },
    body: JSON.stringify({ query }),
  });
  return (await res.json()).data;
}

router.get("/dashboard", async (_req, res) => {
  try {
    const data = await gql(`{
      boards(ids: [${BOARD_DEVOLUCOES}]) {
        groups {
          id
          title
        }
        items_page(limit: 500) {
          items {
            id
            name
            group { id }
            column_values(ids: [
              "color_mm1y6q34",
              "color_mm1y93j5",
              "date_mm1zythe",
              "text_mm1yfgtm",
              "board_relation_mm258fse"
            ]) {
              id
              text
              ... on StatusValue { label }
              ... on BoardRelationValue { display_value }
            }
          }
        }
      }
    }`);

    const board = data.boards[0];
    const items = board.items_page.items;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // --- Pendentes: items in group "topics" (Aguardando Devolução) ---
    const pendenteItems = items.filter((i) => i.group.id === "topics");
    const pendentes = pendenteItems.length;

    // --- Concluídas (mês): items in "group_mm1y9na5" (Histórico/Devolvidos) for current month ---
    const historicoItems = items.filter(
      (i) => i.group.id === "group_mm1y9na5"
    );
    const concluidas = historicoItems.filter((i) => {
      const dateCol = i.column_values.find((c) => c.id === "date_mm1zythe");
      if (!dateCol?.text) return false;
      const d = new Date(dateCol.text);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }).length;

    // --- Status counts across all items ---
    let comProblema = 0;
    let semProblema = 0;
    const porTecnico = {};
    const epiFrequency = {};

    for (const item of items) {
      const statusCol = item.column_values.find(
        (c) => c.id === "color_mm1y6q34"
      );
      const statusLabel = statusCol?.label || statusCol?.text || "";

      if (statusLabel === "Com Pendências") comProblema++;
      if (statusLabel === "Concluída") semProblema++;

      // --- Por técnico ---
      const tecnicoCol = item.column_values.find(
        (c) => c.id === "text_mm1yfgtm"
      );
      const tecnico = tecnicoCol?.text?.trim();
      if (tecnico) {
        porTecnico[tecnico] = (porTecnico[tecnico] || 0) + 1;
      }

      // --- EPIs problemáticos (from board_relation display_value) ---
      if (statusLabel === "Com Pendências") {
        const relCol = item.column_values.find(
          (c) => c.id === "board_relation_mm258fse"
        );
        const displayValue = relCol?.display_value || relCol?.text || "";
        if (displayValue) {
          const names = displayValue.split(",").map((n) => n.trim()).filter(Boolean);
          for (const name of names) {
            epiFrequency[name] = (epiFrequency[name] || 0) + 1;
          }
        }
      }
    }

    // --- Pendentes list ---
    const pendentes_list = pendenteItems.map((i) => {
      const dateCol = i.column_values.find((c) => c.id === "date_mm1zythe");
      return {
        id: i.id,
        nome: i.name,
        data: dateCol?.text || null,
      };
    });

    // --- EPIs problemáticos sorted by frequency ---
    const epis_problematicos = Object.entries(epiFrequency)
      .map(([nome, qtd]) => ({ nome, qtd }))
      .sort((a, b) => b.qtd - a.qtd);

    res.json({
      pendentes,
      concluidas,
      comProblema,
      semProblema,
      porTecnico,
      pendentes_list,
      epis_problematicos,
    });
  } catch (err) {
    console.error("[GET /dashboard]", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
