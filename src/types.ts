export interface Tecnico {
  nome: string;
  email: string;
}

export interface EpiStatusItem {
  epi: string;
  status: 'Devolvido - Reuso' | 'Não Devolvido' | 'Devolvido - Descarte';
}

export interface ConferenciaData {
  id_monday: string;
  nome: string;
  cpf: string;
  epis_esperados: string[];
}

export interface PendenteItem {
  id: string;
  nome: string; // changed from name to nome to match backend
  data: string | null;
  cpf?: string;
  tecnico?: string;
  epis_esperados?: string;
}

export interface DashboardData {
  pendentes: number;
  concluidas: number;
  comProblema: number;
  semProblema: number;
  porTecnico: Record<string, number>;
  epis_problematicos: { nome: string; qtd: number }[];
  pendentes_list: PendenteItem[];
  historico_list: HistoricoItem[];
}

export interface HistoricoItem {
  id: string;
  nome: string;
  cpf: string;
  status: string;
  tecnico: string;
  data: string;
  contrato?: string;
}

export interface CriarSolicitacaoPayload {
  nome_colaborador: string;
  cpf: string;
  contrato: string;
  motivo: string;
  data_solicitacao: string;
  epis_esperados: string[];
  tecnico_responsavel: string;
}

export interface SalvarBaixaPayload {
  id_monday: string;
  nome: string;
  cpf: string;
  epis_problema: EpiStatusItem[];
  fotos_epis: { nome: string; base64: string }[];
  assinatura_base64: string;
  tecnico_responsavel: string;
}
