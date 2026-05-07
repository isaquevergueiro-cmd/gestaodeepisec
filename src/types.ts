// ============================================================
// ENUMS & LITERALS
// ============================================================

export type EpiStatus =
  | 'Pendente de Receber'
  | 'Entregue'
  | 'Aguardando Devolução'
  | 'Reaproveitável'
  | 'Descarte/Dano'
  | 'Não Devolvido'
  | 'A Definir';

export type DevolucaoDestino = 'Reaproveitável' | 'Descarte/Dano' | 'Não Devolvido';

export type TrocaMotivo = 'Troca Anual' | 'Desgaste Natural' | 'Avaria por Acidente';

// ============================================================
// ENTIDADES PRINCIPAIS
// ============================================================

/** Representa um subitem (EPI individual) no board do Monday */
export interface EpiSubitem {
  id: string;
  nome: string;
  tamanho: string;
  status: EpiStatus;
  data_entrega?: string;   // ISO 8601
  data_devolucao?: string; // ISO 8601
  ca?: string;             // Número do Certificado de Aprovação
}

/** Representa o Item Pai (colaborador) com seus subelementos */
export interface ColaboradorData {
  /** ID do item no Monday.com */
  id: string;
  nome: string;
  cpf: string;
  contrato: string;
  telefone?: string;
  subitens: EpiSubitem[];
}

/** Item de SKU disponível no Estoque 3 (Balcão de reaproveitamento) */
export interface EstoqueSku {
  id: string;
  nome: string;
  tamanho: string;
  quantidade: number;
}

export interface EstoqueData {
  skus: EstoqueSku[];
}

// ============================================================
// PAYLOADS DE REQUISIÇÃO (Request Bodies)
// ============================================================

export interface EntregarPayload {
  foto_base64: string;
  tecnico_nome: string;
}

export interface DevolverPayload {
  destino: DevolucaoDestino;
  colaborador_item_id: string;
  foto_base64?: string;
}

export interface TrocarPayload {
  motivo: TrocaMotivo;
  item_nome: string;
  colaborador_item_id: string;
  foto_base64?: string;
}

export interface AdmissaoEpiItem {
  nome: string;
  tamanho: string;
}

export interface AdmissaoPayload {
  nome: string;
  cpf: string;
  contrato: string;
  epis: AdmissaoEpiItem[];
}

// ============================================================
// SESSÃO DO TÉCNICO
// ============================================================

export interface Tecnico {
  nome: string;
  email: string;
  pin?: string;
}

// ============================================================
// RESPOSTAS DE SUCESSO DA API (generics)
// ============================================================

export interface ApiSuccessResponse<T = void> {
  ok: true;
  data: T;
}

export interface ApiErrorResponse {
  ok: false;
  error: string;
}

export type ApiResponse<T = void> = ApiSuccessResponse<T> | ApiErrorResponse;
