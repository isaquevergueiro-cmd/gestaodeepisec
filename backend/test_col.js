import 'dotenv/config';
const token = process.env.MONDAY_API_TOKEN;
const boardId = 18406415397;

async function run() {
  const mutation = `mutation { change_multiple_column_values(board_id: 18406415397, item_id: 11701100323, column_values: "{\\"long_text_mm27p0b4\\":{\\"text\\":\\"\\"}}") { id } }`;
  const res = await fetch('https://api.monday.com/v2', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json', 'API-Version': '2024-10' },
    body: JSON.stringify({ query: mutation })
  });
  const json = await res.json();
  console.log('UPDATE TEST:', JSON.stringify(json, null, 2));
}

run();
