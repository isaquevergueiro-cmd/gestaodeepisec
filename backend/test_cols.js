import dotenv from "dotenv";
dotenv.config();

const fetch = globalThis.fetch; // Node 18+ has built-in fetch

async function run() {
  const r = await fetch('https://api.monday.com/v2', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + process.env.MONDAY_API_TOKEN,
      'Content-Type': 'application/json',
      'API-Version': '2024-10'
    },
    body: JSON.stringify({
      query: `
        query {
          boards(ids: [18406415397]) {
            columns { id title settings_str }
          }
        }
      `
    })
  });
  const text = await r.json();
  const statusCols = text.data.boards[0].columns.filter(c => c.id.startsWith('color'));
  statusCols.forEach(c => {
    let s = {};
    if (c.settings_str) {
      try { s = JSON.parse(c.settings_str); } catch(e){}
    }
    console.log("----");
    console.log("ID:", c.id, "| Title:", c.title);
    if(s.labels) console.log(JSON.stringify(s.labels));
  });
}
run();
