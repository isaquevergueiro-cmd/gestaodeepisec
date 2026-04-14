import cron from "node-cron";

const MONDAY_URL = "https://api.monday.com/v2";
const BOARD_DEVOLUCOES = 18406415397;

async function gql(query) {
  const res = await globalThis.fetch(MONDAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.MONDAY_API_TOKEN}`,
      "Content-Type": "application/json",
      "API-Version": "2024-10",
    },
    body: JSON.stringify({ query }),
  });
  const json = await res.json();
  if (json.errors?.length) {
    const msg = json.errors.map((e) => e.message).join("; ");
    throw new Error(`Monday GraphQL: ${msg}`);
  }
  return json.data;
}

export function initCronSla() {
  // Rodar todo dia as 00:05 para verificar SLAs vencidos.
  cron.schedule("5 0 * * *", async () => {
    console.log("[CRON] Iniciando verificação de SLA 'Trarei Depois'...");
    try {
      await processarSlaVencidos();
    } catch (err) {
      console.error("[CRON] Erro executando SLA Vencidos:", err);
    }
  });
  console.log("⏰ Serviço de SLA Cron iniciado (execução agendada 00:05).");
}

async function processarSlaVencidos() {
  // Buscar itens no grupo de Retorno (group_mm27y9f1)
  const data = await gql(`{
    boards(ids: [${BOARD_DEVOLUCOES}]) {
      groups(ids: ["group_mm27y9f1"]) {
        items_page(limit: 100) {
          items {
            id
            name
            column_values(ids: [
              "date_mm27vzkv", 
              "text_mm1yrhrs", 
              "text_mm1yfgtm", 
              "long_text_mm27kb2p"
            ]) {
              id
              text
            }
          }
        }
      }
    }
  }`);

  const items = data.boards[0]?.groups[0]?.items_page?.items || [];
  const hoje = new Date().toISOString().slice(0, 10);
  let countVencidos = 0;

  for (const item of items) {
    const prazoCol = item.column_values.find(c => c.id === "date_mm27vzkv");
    const dataPrazo = prazoCol?.text;
    
    if (dataPrazo && dataPrazo < hoje) {
      console.log(`[CRON] SLA Vencido: Item ${item.id} (${item.name}). Prazo era ${dataPrazo}. Transferindo para pendência definitiva...`);
      countVencidos++;
      
      // Atualizar para com desconto "Sim" (color_mm1y93j5=1) e Destinação "Não Devolvido" (color_mm1y6q34=0)
      // Ajustando a estrutura correta pro Monday aceitar mutation multíplas:
      const colorVals = JSON.stringify(JSON.stringify({
        color_mm1y93j5: { index: 1 }, 
        color_mm1y6q34: { index: 0 }
      }));

      await gql(`mutation {
        change_multiple_column_values(
          board_id: ${BOARD_DEVOLUCOES},
          item_id: ${item.id},
          column_values: ${JSON.stringify(colorVals)}
        ) { id }
      }`);

      // Mover para grupo Histórico (Devolvidos)
      await gql(`mutation {
        move_item_to_group(
          item_id: ${item.id},
          group_id: "group_mm1y9na5"
        ) { id }
      }`);
    }
  }

  console.log(`[CRON] SLA processado. ${countVencidos} itens convertidos para Pendência Financeira.`);
}
