const MONDAY_URL = "https://api.monday.com/v2";

export async function gql(query, variables = {}) {
  const res = await fetch(MONDAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.MONDAY_API_TOKEN}`,
      "Content-Type": "application/json",
      "API-Version": "2024-10",
    },
    body: JSON.stringify({ query, variables }),
  });

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const text = await res.text();
    throw new Error(`[GraphQL] Monday retornou resposta não-JSON (status ${res.status}). Resp: ${text.slice(0, 120)}`);
  }

  const json = await res.json();

  if (json.errors?.length) {
    const msg = json.errors.map((e) => e.message).join("; ");
    throw new Error(`Monday GraphQL Error: ${msg}`);
  }

  return json.data;
}
