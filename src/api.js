import localforage from "localforage";

const API_CRIAR = import.meta.env.VITE_API_CRIAR_SOLICITACAO;
const API_BUSCAR = import.meta.env.VITE_API_BUSCAR_CPF;
const API_BAIXA = import.meta.env.VITE_API_SALVAR_BAIXA;

const OFFLINE_QUEUE_KEY = "epi_offline_queue";

async function checkResponse(res) {
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Erro ${res.status}`);
  }
  return res.json();
}

export async function criarSolicitacao(payload) {
  const res = await fetch(API_CRIAR, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return checkResponse(res);
}

export async function buscarPorCpf(cpf) {
  const res = await fetch(`${API_BUSCAR}?cpf=${encodeURIComponent(cpf)}`);
  return checkResponse(res);
}

export async function salvarBaixa(payload) {
  try {
    const res = await fetch(API_BAIXA, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return await checkResponse(res);
  } catch (err) {
    if (!navigator.onLine || err.message.includes("Failed to fetch")) {
      // Salva na fila offline
      const queue = (await localforage.getItem(OFFLINE_QUEUE_KEY)) || [];
      queue.push({ payload, timestamp: new Date().toISOString() });
      await localforage.setItem(OFFLINE_QUEUE_KEY, queue);
      return { offline: true, message: "Salvo offline. Será sincronizado assim que houver conexão." };
    }
    throw err;
  }
}

export async function getOfflineQueueCount() {
  const queue = (await localforage.getItem(OFFLINE_QUEUE_KEY)) || [];
  return queue.length;
}

export async function syncOfflineQueue() {
  const queue = (await localforage.getItem(OFFLINE_QUEUE_KEY)) || [];
  if (queue.length === 0) return 0;

  let successCount = 0;
  const remainingQueue = [];

  for (const item of queue) {
    try {
      const res = await fetch(API_BAIXA, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.payload),
      });
      await checkResponse(res);
      successCount++;
    } catch (err) {
      remainingQueue.push(item);
    }
  }

  await localforage.setItem(OFFLINE_QUEUE_KEY, remainingQueue);
  return successCount;
}
