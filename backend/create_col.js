import 'dotenv/config';
const token = process.env.MONDAY_API_TOKEN;
const boardId = 18406415397;

async function run() {
  const mutation = `mutation { create_column(board_id: 18406415397, title: "EPIs Pendentes de Retorno", column_type: long_text) { id title } }`;
  const res = await fetch('https://api.monday.com/v2', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json', 'API-Version': '2024-10' },
    body: JSON.stringify({ query: mutation })
  });
  const json = await res.json();
  console.log(JSON.stringify(json, null, 2));
}

run();
