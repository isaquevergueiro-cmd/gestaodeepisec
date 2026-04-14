import 'dotenv/config';
import fs from 'fs';
const token = process.env.MONDAY_API_TOKEN;
const boardId = 18406415397;

async function run() {
  const mutation = `{ boards(ids: [18406415397]) { columns { id title type } } }`;
  const res = await fetch('https://api.monday.com/v2', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json', 'API-Version': '2024-10' },
    body: JSON.stringify({ query: mutation })
  });
  const json = await res.json();
  const cols = json.data.boards[0].columns;
  fs.writeFileSync('cols.json', JSON.stringify(cols, null, 2));
}

run();
