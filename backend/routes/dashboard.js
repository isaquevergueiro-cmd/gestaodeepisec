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
              "date_mm1zythe",
              "date_mm1ys9b",
              "text_mm1yfgtm",
              "board_relation_mm258fse",
              "text_mm1yrhrs",
              "long_text_mm25tz9r",
              "long_text_mm27kb2p",
              "lookup_mm259jnj",
              "color_mm1y1rf2"
            ]) {
              id
              text
              ... on StatusValue { label }
              ... on BoardRelationValue { display_value }
              ... on MirrorValue { display_value }
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

    // --- Pendentes: grupo "topics" (Aguardando Devolução) + grupo_mm27y9f1 (Aguardando Retorno de Item) ---
    const GRUPOS_PENDENTES = ["topics", "group_mm27y9f1"];
    const pendenteItems = items.filter((i) => GRUPOS_PENDENTES.includes(i.group.id));
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

    // --- Status counts across historical items ---
    let comProblema = 0;
    let semProblema = 0;
    let total_descontado = 0;
    let descontos_rescisao = 0;
    let descontos_folha = 0;
    const porTecnico = {};
    const epiFrequency = {};

    for (const item of historicoItems) {
      // --- Por técnico ---
      const tecnicoCol = item.column_values.find(
        (c) => c.id === "text_mm1yfgtm"
      );
      const tecnico = tecnicoCol?.text?.trim();
      if (tecnico) {
        porTecnico[tecnico] = (porTecnico[tecnico] || 0) + 1;
      }

      // --- Verifica se tem problema (EPIs não devolvidos relacionados) ---
      const relCol = item.column_values.find(
        (c) => c.id === "board_relation_mm258fse"
      );
      const displayValue = relCol?.display_value || relCol?.text || "";
      
      if (displayValue && displayValue.trim() !== "") {
        comProblema++;
        const names = displayValue.split(",").map((n) => n.trim()).filter(Boolean);
        for (const name of names) {
          epiFrequency[name] = (epiFrequency[name] || 0) + 1;
        }
      } else {
        semProblema++;
      }

      // --- Financeiro ---
      const colMotivo = item.column_values.find(c => c.id === "color_mm1y1rf2");
      const colValor = item.column_values.find(c => c.id === "lookup_mm259jnj");
      
      const valorRaw = colValor?.display_value || colValor?.text || "";
      if (valorRaw) {
        // Encontra todos os números na string (ex: "100.00, 50,00") e soma
        const numbers = valorRaw.match(/[\d.,]+/g);
        if (numbers) {
          const sum = numbers.reduce((acc, curr) => {
            // Se tem vírgula (formato PT-BR), troca por ponto
            let numStr = curr;
            if (numStr.includes(",") && !numStr.includes(".")) {
               numStr = numStr.replace(",", ".");
            } else if (numStr.includes(",") && numStr.includes(".")) {
               // Formato 1.000,50 -> 1000.50
               numStr = numStr.replace(/\./g, "").replace(",", ".");
            }
            return acc + (parseFloat(numStr) || 0);
          }, 0);
          
          if (sum > 0) {
            total_descontado += sum;
            const motivoStr = (colMotivo?.label || colMotivo?.text || "").toLowerCase();
            if (motivoStr.includes("desligamento")) {
              descontos_rescisao += sum;
            } else {
              descontos_folha += sum;
            }
          }
        }
      }
    }

    // --- Pendentes list ---
    const pendentes_list = pendenteItems.map((i) => {
      const dateCol = i.column_values.find((c) => c.id === "date_mm1ys9b");
      const tecnicoCol = i.column_values.find((c) => c.id === "text_mm1yfgtm");
      const cpfCol = i.column_values.find((c) => c.id === "text_mm1yrhrs");
      const episCol = i.column_values.find((c) => c.id === "long_text_mm25tz9r");
      
      let formattedDate = null;
      if (dateCol?.text) {
        const [yyyy, mm, dd] = dateCol.text.split('-');
        if (yyyy && mm && dd) formattedDate = `${dd}/${mm}/${yyyy}`;
      }

      const episColBase   = i.column_values.find((c) => c.id === "long_text_mm25tz9r");
      const episColPend   = i.column_values.find((c) => c.id === "long_text_mm27kb2p");
      const isRetorno     = i.group.id === "group_mm27y9f1" && (episColPend?.text ?? "").trim() !== "";

      // EPIs a mostrar: se retorno, usa col pendentes; senão usa col base
      const episText   = isRetorno ? (episColPend?.text ?? "") : (episColBase?.text ?? "");

      // EPIs já devolvidos anteriormente (para passar à tela de devolutiva)
      let epis_ja_devolvidos = [];
      if (isRetorno && (episColBase?.text ?? "").trim() !== "") {
        const todos   = (episColBase.text ?? "").split(/,\s*|\n/).map(e => e.trim()).filter(Boolean);
        const pendSet = new Set((episColPend.text ?? "").split(/,\s*|\n/).map(e => e.trim()).filter(Boolean));
        epis_ja_devolvidos = todos.filter(e => !pendSet.has(e));
      }

      return {
        id: i.id,
        nome: i.name,
        data: formattedDate || dateCol?.text || null,
        cpf: cpfCol?.text || "",
        tecnico: tecnicoCol?.text || "",
        epis_esperados: episText,
        epis_ja_devolvidos,
        tipo: i.group.id === "group_mm27y9f1" ? "Aguardando Retorno de Item" : "Aguardando Devolução",
      };
    });

    // --- EPIs problemáticos sorted by frequency ---
    const epis_problematicos = Object.entries(epiFrequency)
      .map(([nome, qtd]) => ({ nome, qtd }))
      .sort((a, b) => b.qtd - a.qtd);

    // --- Historico list ---
    const historico_list = historicoItems.map((i) => {
      const dateCol = i.column_values.find((c) => c.id === "date_mm1zythe");
      const tecnicoCol = i.column_values.find((c) => c.id === "text_mm1yfgtm");
      const cpfCol = i.column_values.find((c) => c.id === "text_mm1yrhrs");
      const relCol = i.column_values.find((c) => c.id === "board_relation_mm258fse");
      
      const hasProblem = (relCol?.display_value || relCol?.text || "").trim() !== "";
      
      let formattedDate = null;
      if (dateCol?.text) {
        const [yyyy, mm, dd] = dateCol.text.split('-');
        if (yyyy && mm && dd) formattedDate = `${dd}/${mm}/${yyyy}`;
      }

      return {
        id: i.id,
        nome: i.name,
        data: formattedDate || dateCol?.text || null,
        cpf: cpfCol?.text || "",
        tecnico: tecnicoCol?.text || "",
        status: hasProblem ? "Com Pendências" : "Sem Problema",
      };
    });

    res.json({
      pendentes,
      concluidas,
      comProblema,
      semProblema,
      porTecnico,
      pendentes_list,
      historico_list,
      epis_problematicos,
      total_descontado,
      descontos_rescisao,
      descontos_folha,
    });
  } catch (err) {
    console.error("[GET /dashboard]", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
