const API_CRIAR = import.meta.env.VITE_API_CRIAR_SOLICITACAO;
const API_BUSCAR = import.meta.env.VITE_API_BUSCAR_CPF;
const API_BAIXA = import.meta.env.VITE_API_SALVAR_BAIXA;

export async function criarSolicitacao(payload) {
  const res = await fetch(API_CRIAR, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Erro ${res.status}`);
  return res.json();
}

export async function buscarPorCpf(cpf) {
  const res = await fetch(`${API_BUSCAR}?cpf=${encodeURIComponent(cpf)}`);
  if (!res.ok) throw new Error(`Erro ${res.status}`);
  return res.json();
}

export async function salvarBaixa(payload) {
  const res = await fetch(API_BAIXA, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Erro ${res.status}`);
  return res.json();
}
