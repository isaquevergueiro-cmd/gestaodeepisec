/// <reference types="vite/client" />

import localforage from 'localforage';
import type {
  CriarSolicitacaoPayload,
  SalvarBaixaPayload,
  DashboardData,
  HistoricoItem,
} from './types';

const API_CRIAR  = import.meta.env.VITE_API_CRIAR_SOLICITACAO as string;
const API_BUSCAR = import.meta.env.VITE_API_BUSCAR_CPF as string;
const API_BAIXA  = import.meta.env.VITE_API_SALVAR_BAIXA as string;
const API_DASH   = import.meta.env.VITE_API_DASHBOARD as string;
const API_HIST   = import.meta.env.VITE_API_HISTORICO as string;

export interface DashboardFilters {
  mesAno?: string;
  contrato?: string;
  epi?: string;
}

const OFFLINE_QUEUE_KEY = 'epi_offline_queue';

async function checkResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error ?? `Erro ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function criarSolicitacao(payload: CriarSolicitacaoPayload) {
  const res = await fetch(API_CRIAR, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return checkResponse<{ id: string }>(res);
}

export async function buscarPorCpf(cpf: string) {
  const res = await fetch(`${API_BUSCAR}?cpf=${encodeURIComponent(cpf)}`);
  return checkResponse<{ id_monday: string; nome: string; epis_esperados_string: string }[]>(res).then(data => Array.isArray(data) ? data : [data]);
}

export async function buscarPorNome(nome: string) {
  const url = import.meta.env.VITE_API_BUSCAR_NOME || 'http://localhost:3001/api/buscar-nome';
  const res = await fetch(`${url}?nome=${encodeURIComponent(nome)}`);
  return checkResponse<{ id_monday: string; nome: string; cpf: string; epis_esperados_string: string }[]>(res);
}

export async function salvarBaixa(payload: SalvarBaixaPayload) {
  try {
    const res = await fetch(API_BAIXA, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await checkResponse<{ offline?: boolean; message?: string; sign_url?: string }>(res);
  } catch (err) {
    const error = err as Error;
    if (!navigator.onLine || error.message.includes('Failed to fetch')) {
      const queue = ((await localforage.getItem(OFFLINE_QUEUE_KEY)) as typeof payload[] | null) || [];
      queue.push(payload);
      await localforage.setItem(OFFLINE_QUEUE_KEY, queue);
      return { offline: true, message: 'Salvo offline. Será sincronizado assim que houver conexão.' };
    }
    throw err;
  }
}

export async function gerarCautela(payload: SalvarBaixaPayload): Promise<Blob> {
  const url = import.meta.env.VITE_API_GERAR_CAUTELA || 'http://localhost:3001/api/gerar-cautela';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    throw new Error(errorBody?.error || `Erro ${res.status}`);
  }
  return res.blob();
}

export async function getDashboard(filters?: DashboardFilters): Promise<DashboardData> {
  const url = new URL(API_DASH || 'http://localhost:3001/api/dashboard');
  if (filters) {
    if (filters.mesAno) url.searchParams.append('mesAno', filters.mesAno);
    if (filters.contrato) url.searchParams.append('contrato', filters.contrato);
    if (filters.epi) url.searchParams.append('epi', filters.epi);
  }
  const res = await fetch(url.toString());
  return checkResponse<DashboardData>(res);
}

export async function getHistorico(): Promise<HistoricoItem[]> {
  const url = API_HIST || 'http://localhost:3001/api/historico';
  const res = await fetch(url);
  return checkResponse<HistoricoItem[]>(res);
}

export async function getOfflineQueueCount(): Promise<number> {
  const queue = ((await localforage.getItem(OFFLINE_QUEUE_KEY)) as unknown[] | null) || [];
  return queue.length;
}

export async function syncOfflineQueue(): Promise<number> {
  const queue = ((await localforage.getItem(OFFLINE_QUEUE_KEY)) as SalvarBaixaPayload[] | null) || [];
  if (queue.length === 0) return 0;

  let successCount = 0;
  const remainingQueue: SalvarBaixaPayload[] = [];

  for (const item of queue) {
    try {
      const res = await fetch(API_BAIXA, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      });
      await checkResponse(res);
      successCount++;
    } catch {
      remainingQueue.push(item);
    }
  }

  await localforage.setItem(OFFLINE_QUEUE_KEY, remainingQueue);
  return successCount;
}
