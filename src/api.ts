import axios, { type AxiosError } from 'axios';
import type {
  ColaboradorData,
  EstoqueData,
  EntregarPayload,
  DevolverPayload,
  TrocarPayload,
  AdmissaoPayload,
  DevolucaoDestino,
  TrocaMotivo,
} from './types';

// ============================================================
// CLIENTE AXIOS
// ============================================================

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api',
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

/** Extrai a mensagem de erro do backend ou do Axios de forma segura. */
export function extractErrorMessage(err: unknown): string {
  const axErr = err as AxiosError<{ error?: string; message?: string }>;
  return (
    axErr.response?.data?.error ??
    axErr.response?.data?.message ??
    axErr.message ??
    'Erro desconhecido. Tente novamente.'
  );
}

// ============================================================
// FUNCOES DE API
// ============================================================

/**
 * Busca um colaborador pelo CPF (apenas digitos).
 * GET /api/colaborador/:cpf
 */
export async function buscarColaborador(cpf: string): Promise<ColaboradorData> {
  const digits = cpf.replace(/\D/g, '');
  const { data } = await apiClient.get<ColaboradorData>(`/colaborador/${digits}`);
  return data;
}

/**
 * Confirma a entrega fisica de um EPI.
 * PATCH /api/epi/:subitem_id/entregar
 */
export async function entregarEpi(
  subitemId: string,
  foto_base64: string,
  tecnico_nome: string,
): Promise<void> {
  const payload: EntregarPayload = { foto_base64, tecnico_nome };
  await apiClient.patch(`/epi/${subitemId}/entregar`, payload);
}

/**
 * Processa a devolucao de um EPI.
 * PATCH /api/epi/:subitem_id/devolver
 */
export async function devolverEpi(
  subitemId: string,
  destino: DevolucaoDestino,
  colaborador_item_id: string,
  foto_base64?: string,
): Promise<void> {
  const payload: DevolverPayload = { destino, colaborador_item_id, foto_base64 };
  await apiClient.patch(`/epi/${subitemId}/devolver`, payload);
}

/**
 * Substitui um EPI por desgaste ou avaria.
 * PATCH /api/epi/:subitem_id/trocar
 */
export async function trocarEpi(
  subitemId: string,
  motivo: TrocaMotivo,
  item_nome: string,
  colaborador_item_id: string,
  foto_base64?: string,
): Promise<void> {
  const payload: TrocarPayload = { motivo, item_nome, colaborador_item_id, foto_base64 };
  await apiClient.patch(`/epi/${subitemId}/trocar`, payload);
}

/**
 * Retorna os SKUs disponiveis no Estoque 3 (balcao de reaproveitamento).
 * GET /api/estoque3
 */
export async function listarEstoque3(): Promise<EstoqueData> {
  const { data } = await apiClient.get<EstoqueData>('/estoque3');
  return data;
}

// --- Interfaces de resposta da pre-tela ---

export interface SubitemCautela {
  id: string;
  nome: string;
  status: string;
}

export interface ColaboradorCautelaInfo {
  id: string;
  nome: string;
  contrato: string;
  status_acao: string;
  total_subitens: number;
  subitens_cautela: SubitemCautela[];
}

export interface CheckCautelaResponse {
  encontrado: boolean;
  colaboradores: ColaboradorCautelaInfo[];
}

/**
 * Verifica se o CPF ja tem colaborador no board e retorna seus subitens de CAUTELA.
 * GET /api/cautela/check/:cpf
 */
export async function checkCautela(cpf: string): Promise<CheckCautelaResponse> {
  const digits = cpf.replace(/\D/g, '');
  const { data } = await apiClient.get<CheckCautelaResponse>(`/cautela/check/${digits}`);
  return data;
}

/**
 * Cria um subitem de CAUTELA avulso para um colaborador ja existente.
 * POST /api/cautela/criar-subitem
 */
export async function criarSubitemCautela(
  colaborador_item_id: string,
  label?: string,
): Promise<{ subitem_id: string; nome: string }> {
  const { data } = await apiClient.post('/cautela/criar-subitem', {
    colaborador_item_id,
    label,
  });
  return data;
}

/**
 * Faz upload da cautela PDF para o subitem CAUTELA especifico no Monday.
 * POST /api/cautela/upload
 */
export async function uploadCautela(
  arquivo_base64: string,
  nome_arquivo: string,
  subitem_id: string,
): Promise<void> {
  await apiClient.post('/cautela/upload', { arquivo_base64, nome_arquivo, subitem_id });
}

/**
 * Cria a cautela admissional enviando o enxoval de EPIs manualmente.
 * POST /api/webhook/admissao
 */
export async function cadastrarAdmissao(payload: AdmissaoPayload): Promise<{ itemId: string; cautelaSubitemId: string }> {
  const { data } = await apiClient.post('/webhook/admissao', payload);
  return data;
}

// --- Esteira Admissional ---

/** Colaborador como aparece nos subitens do board Esteira Admissional */
export interface ColaboradorAdmissional {
  id: string;
  nome: string;
  cpf: string;
  rg: string;
  cidade: string;
  funcao: string;
  orgao: string;
  data_admissao: string;
  data_nascimento: string;
  status_aso: string;
  tem_cautela: boolean;
  solicitation: string;
  parent_item_id: string | null;
}

export interface ListaColaboradoresResponse {
  colaboradores: ColaboradorAdmissional[];
  stats: {
    total: number;
    com_cautela: number;
    sem_cautela: number;
  };
}

/**
 * Lista todos os colaboradores da Esteira Admissional (via subitens).
 * GET /api/admissional/colaboradores
 */
export async function listarColaboradoresAdmissional(): Promise<ListaColaboradoresResponse> {
  const { data } = await apiClient.get<ListaColaboradoresResponse>('/admissional/colaboradores');
  return data;
}

/**
 * Busca colaborador por CPF nos subitens da Esteira Admissional.
 * GET /api/admissional/colaborador/cpf/:cpf
 */
export async function buscarColaboradorPorCpf(cpf: string): Promise<{ colaboradores: ColaboradorAdmissional[] }> {
  const digits = cpf.replace(/\D/g, '');
  const { data } = await apiClient.get<{ colaboradores: ColaboradorAdmissional[] }>(
    `/admissional/colaborador/cpf/${digits}`
  );
  return data;
}

// --- Grupo AS0 (Exames Admissionais) ---

/**
 * Lista colaboradores do grupo EXAMES ADMISSIONAIS (AS0).
 * GET /api/admissional/as0/colaboradores
 */
export async function listarAS0Colaboradores(): Promise<ListaColaboradoresResponse> {
  const { data } = await apiClient.get<ListaColaboradoresResponse>('/admissional/as0/colaboradores');
  return data;
}

// --- Gestao de EPIs ---

export interface EpiSubitemGestao {
  id: string;
  nome: string;
  status: string;
  quantidade: string;
  tamanho: string;
  data_entrega: string | null;
  data_devolucao: string | null;
  data_limite: string | null;
  preco_unitario: number;
  justificativa: string | null;
}

export interface ColaboradorGestao {
  id: string;
  nome: string;
  cpf: string;
  contrato: string;
  status_acao: string;
  motivo_acao: string;
  tecnico_responsavel: string;
  telefone1: string;
  telefone2: string;
  cautela_assinada: boolean;
  grupo: string;
  grupo_id: string;
  subitens: EpiSubitemGestao[];
}

export interface GestaoEpisKpis {
  totalEntregues: number;
  aguardandoDevolucao: number;
  naoDevolvidos: number;
  valorEmAberto: number;
}

export interface GestaoEpisResponse {
  colaboradores: ColaboradorGestao[];
  kpis: GestaoEpisKpis;
}

/**
 * Retorna todos os colaboradores + subitens de EPI do board de Gestao com KPIs agregados.
 * GET /api/gestao/epis
 */
export async function listarGestaoEpis(): Promise<GestaoEpisResponse> {
  const { data } = await apiClient.get<GestaoEpisResponse>('/gestao/epis');
  return data;
}

// --- Catalogo de EPIs ---

export interface CatalogoItem {
  id: string;
  nome: string;
  preco: number;
  ca: string;
  descricao: string;
  cor: string;
}

export interface CatalogoGrupo {
  nome: string;
  items: CatalogoItem[];
}

export interface CatalogoResponse {
  grupos: CatalogoGrupo[];
}

/**
 * Retorna o catalogo de EPIs do Monday agrupado por contrato/funcao.
 * GET /api/catalogo/epis
 */
export async function listarCatalogoEpis(): Promise<CatalogoResponse> {
  const { data } = await apiClient.get<CatalogoResponse>('/catalogo/epis');
  return data;
}

// --- Gestao de Status ---

/**
 * Reverte uma devolucao pendente: apaga o subitem [DEV] e restaura o EPI para "Entregue".
 * PATCH /api/epi/:evento_id/reverter-devolucao
 */
export async function reverterDevolucao(
  eventoId: string,
  colaborador_item_id?: string,
): Promise<{ revertido: boolean; nome_base: string }> {
  const { data } = await apiClient.patch(`/epi/${eventoId}/reverter-devolucao`, {
    colaborador_item_id,
  });
  return data;
}

/**
 * Agenda a devolucao de um EPI: muda status para "Aguardando Devolucao".
 * PATCH /api/epi/:id/agendar-devolucao
 */
export async function agendarDevolucao(
  subitemId: string,
  opts?: { data_limite?: string; justificativa?: string; colaborador_item_id?: string; motivo_acao?: string }
): Promise<void> {
  await apiClient.patch(`/epi/${subitemId}/agendar-devolucao`, opts ?? {});
}

/**
 * Atualiza STATUS_ACAO e/ou MOTIVO_ACAO do colaborador (item pai).
 * PATCH /api/colaborador/:item_id/status
 */
export async function atualizarStatusColaborador(
  itemId: string,
  opts: { status_acao?: string; motivo_acao?: string }
): Promise<void> {
  await apiClient.patch(`/colaborador/${itemId}/status`, opts);
}

/**
 * Atualiza campos editaveis de um subitem (tamanho, quantidade, status).
 * PATCH /api/epi/:subitem_id/atualizar
 */
export async function atualizarSubitem(
  subitemId: string,
  opts: { tamanho?: string; quantidade?: string; status?: string }
): Promise<void> {
  await apiClient.patch(`/epi/${subitemId}/atualizar`, opts);
}

/**
 * Atualiza campos de texto do colaborador (telefone, tecnico responsavel).
 * PATCH /api/colaborador/:item_id/info
 */
export async function atualizarInfoColaborador(
  itemId: string,
  opts: { tecnico_responsavel?: string; telefone1?: string; telefone2?: string }
): Promise<void> {
  await apiClient.patch(`/colaborador/${itemId}/info`, opts);
}

/**
 * Posta um comentario (update) no item pai do colaborador no Monday.
 * POST /api/colaborador/:item_id/update
 */
export async function postarUpdateColaborador(
  itemId: string,
  texto: string,
): Promise<void> {
  await apiClient.post(`/colaborador/${itemId}/update`, { texto });
}

/**
 * Cria um colaborador manualmente no board de Gestao de EPIs.
 * POST /api/colaborador/criar
 */
export async function criarColaborador(payload: {
  nome: string;
  cpf?: string;
  contrato?: string;
  funcao?: string;
  grupo_id?: string;
}): Promise<{ itemId: string }> {
  const { data } = await apiClient.post<{ itemId: string }>('/colaborador/criar', payload);
  return data;
}
