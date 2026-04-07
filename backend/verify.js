import fs from "fs";

async function run() {
  const query = `{
    boards(ids: [18406415397]) {
      items_page(limit: 50) {
        items {
          name
          column_values(ids: ["color_mm1y6q34", "color_mm1y93j5"]) {
            id
            text
            ... on StatusValue { label }
          }
        }
      }
    }
  }`;

  const res = await fetch("https://api.monday.com/v2", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.MONDAY_API_TOKEN}`,
      "Content-Type": "application/json",
      "API-Version": "2024-10",
    },
    body: JSON.stringify({ query }),
  });
  const data = await res.json();
  fs.writeFileSync("out_native.json", JSON.stringify(data.data.boards[0].items_page.items, null, 2), "utf8");
}

run();
