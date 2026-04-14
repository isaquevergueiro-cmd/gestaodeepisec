import { Router } from "express";

const router = Router();

const MONDAY_URL = "https://api.monday.com/v2";
const BOARD_DEVOLUCOES = 18406415397;

async function gql(query) {
  let res;
  try {
    res = await fetch(MONDAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.MONDAY_API_TOKEN}`,
        "Content-Type": "application/json",
        "API-Version": "2024-10",
      },
      body: JSON.stringify({ query }),
    });
  } catch (fetchErr) {
    throw new Error(`[Dashboard] Falha de rede ao contatar Monday: ${fetchErr.message}`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const text = await res.text();
    throw new Error(`[Dashboard] Monday retornou HTML em vez de JSON (status ${res.status}). Verifique o MONDAY_API_TOKEN. Resp: ${text.slice(0, 120)}`);
  }

  const json = await res.json();
  if (json.errors?.length) {
    const msgs = json.errors.map(e => e.message).join("; ");
    throw new Error(`[Dashboard] GraphQL error: ${msgs}`);
  }
  return json.data;
}

router.get("/dashboard", async (req, res) => {
  try {
    const data = await gql(`{
      boards(ids: [${BOARD_DEVOLUCOES}]) {
        groups { id title }
        items_page(limit: 500) {
          items {
            id
            name
            group { id }
            column_values(ids: [
              "color_mm1y6q34",
              "color_mm1y1rf2",
              "date_mm1zythe",
              "date_mm1ys9b",
              "text_mm1yfgtm",
              "text_mm1yrhrs",
              "long_text_mm2chet8",
              "text_mm1ypaa0",
              "text_mm2c155b",
              "text_mm2cz5hh"
            ]) {
              id
              text
              ... on StatusValue { label }
            }
          }
        }
      }
    }`);


    const board = data.boards[0];
    let items = board.items_page.items;

    const { mesAno, contrato, epi } = req.query;

    if (contrato) {
      const lowerContrato = contrato.toLowerCase();
      items = items.filter(i => {
        const cCol = i.column_values.find(c => c.id === "text_mm1ypaa0");
        return cCol?.text && cCol.text.toLowerCase().includes(lowerContrato);
      });
    }

    if (epi) {
      const lowerEpi = epi.toLowerCase();
      items = items.filter(i => {
        const epiBase = i.column_values.find((c) => c.id === "long_text_mm2chet8")?.text || "";
        return epiBase.toLowerCase().includes(lowerEpi);
      });
    }


    if (mesAno) {
      const [fYear, fMonth] = mesAno.split("-");
      const targetM = parseInt(fMonth, 10) - 1;
      const targetY = parseInt(fYear, 10);
      items = items.filter(i => {
        // Para pendentes usa date_mm1ys9b, para historico usa date_mm1zythe
        const dh = i.column_values.find((c) => c.id === "date_mm1zythe")?.text;
        const dp = i.column_values.find((c) => c.id === "date_mm1ys9b")?.text;
        const targetDate = dh || dp;
        if (!targetDate) return false;
        const d = new Date(targetDate);
        return d.getMonth() === targetM && d.getFullYear() === targetY;
      });
    }

    const now = new Date();
    const currentMonth = mesAno ? parseInt(mesAno.split("-")[1], 10) - 1 : now.getMonth();
    const currentYear = mesAno ? parseInt(mesAno.split("-")[0], 10) : now.getFullYear();

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
    const categoriasVisao = {
      admissional: 0,
      demissional: 0,
      renovacao_com_devolucao: 0,
      renovacao_sem_devolucao: 0,
    };

    for (const item of historicoItems) {
      const colMotivo = item.column_values.find(c => c.id === "color_mm1y1rf2");
      const colStatus = item.column_values.find(c => c.id === "color_mm1y6q34");

      // Técnico
      const tecnicoCol = item.column_values.find((c) => c.id === "text_mm1yfgtm");
      const tecnico    = tecnicoCol?.text?.trim();
      if (tecnico) {
        porTecnico[tecnico] = (porTecnico[tecnico] || 0) + 1;
      }

      // Categorias de Ação (Motivo)
      const motivoStrDashboard = (colMotivo?.label || colMotivo?.text || "").toLowerCase();
      if      (motivoStrDashboard.includes("admiss"))        categoriasVisao.admissional++;
      else if (motivoStrDashboard.includes("demiss") || motivoStrDashboard.includes("desligamento")) categoriasVisao.demissional++;
      else if (motivoStrDashboard.includes("com devolu"))    categoriasVisao.renovacao_com_devolucao++;
      else if (motivoStrDashboard.includes("sem devolu"))    categoriasVisao.renovacao_sem_devolucao++;

      // Status da Devolução: usar label do campo color_mm1y6q34
      const statusDev = (colStatus?.label || colStatus?.text || "").toLowerCase();
      const temPendencia = statusDev.includes("pend") || statusDev.includes("aguardando");
      if (temPendencia) {
        comProblema++;
        // EPI names para o gráfico: coluna long_text_mm2chet8 dos itens com pendência
        const episCol = item.column_values.find((c) => c.id === "long_text_mm2chet8");
        const names   = (episCol?.text || "").split(/,|\n/).map(n => n.trim()).filter(Boolean);
        for (const name of names) {
          epiFrequency[name] = (epiFrequency[name] || 0) + 1;
        }
      } else {
        semProblema++;
      }

      // Financeiro (placeholder — depende de configuração do board)
      total_descontado    = total_descontado;
      descontos_folha     = descontos_folha;
      descontos_rescisao  = descontos_rescisao;
    }


    // --- Pendentes list ---
    const pendentes_list = pendenteItems.map((i) => {
      const col = (id) => i.column_values.find((c) => c.id === id)?.text ?? "";

      const dateText = col("date_mm1ys9b");
      let formattedDate = null;
      if (dateText) {
        const [yyyy, mm, dd] = dateText.split('-');
        if (yyyy && mm && dd) formattedDate = `${dd}/${mm}/${yyyy}`;
      }

      // is_retorno definido pelo grupo
      const isRetorno = i.group.id === "group_mm27y9f1";

      return {
        id:         i.id,
        nome:       i.name,
        data:       formattedDate || dateText || null,
        cpf:        col("text_mm1yrhrs"),
        tecnico:    col("text_mm1yfgtm"),
        telefone1:  col("text_mm2c155b"),
        telefone2:  col("text_mm2cz5hh"),
        epis_esperados: col("long_text_mm2chet8"),
        tipo: isRetorno ? "Aguardando Retorno de Item" : "Aguardando Devolução",
      };
    });


    // --- EPIs problemáticos sorted by frequency ---
    const epis_problematicos = Object.entries(epiFrequency)
      .map(([nome, qtd]) => ({ nome, qtd }))
      .sort((a, b) => b.qtd - a.qtd);

    // --- Historico list ---
    const historico_list = historicoItems.map((i) => {
      const col    = (id) => i.column_values.find((c) => c.id === id)?.text ?? "";
      const colObj = (id) => i.column_values.find((c) => c.id === id) || {};

      const statusDev  = colObj("color_mm1y6q34").label || col("color_mm1y6q34") || "Concluída";
      const dateText   = col("date_mm1zythe");
      let formattedDate = null;
      if (dateText) {
        const [yyyy, mm, dd] = dateText.split('-');
        if (yyyy && mm && dd) formattedDate = `${dd}/${mm}/${yyyy}`;
      }

      return {
        id:      i.id,
        nome:    i.name,
        data:    formattedDate || dateText || null,
        cpf:     col("text_mm1yrhrs"),
        tecnico: col("text_mm1yfgtm"),
        status:  statusDev,
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
      categoriasVisao,
    });
  } catch (err) {
    console.error("[GET /dashboard]", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
