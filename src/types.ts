export interface Tecnico {
  nome: string;
  email: string;
}

export interface EpiStatusItem {
  index?:            number;   // posicional para match preciso de foto
  id_monday_subitem?: string | null;
  epi:               string;
  tamanho?:          string;
  qtd?:              number;
  status:            'Reaproveitável' | 'Não Devolvido' | 'Descarte/Dano' | string;
  justificativa?:    string;   // obrigatória quando status = 'Não Devolvido'
  prazo_marcado?:    boolean;  // true = colaborador prometeu trazer em 3 dias úteis
}

export interface ConferenciaData {
  id_monday: string;
  nome: string;
  cpf: string;
  telefone1?: string;
  telefone2?: string;
  contrato?: string;
  epis_esperados: string[];
  is_retorno?: boolean;
  epis_ja_devolvidos?: string[];
  subitens?: {
    id: string;
    nome: string;
    tamanho: string;
    qtd: number;
    status: string;
  }[];
}

export interface PendenteItem {
  id: string;
  nome: string;
  data: string | null;
  cpf?: string;
  tecnico?: string;
  telefone1?: string;
  telefone2?: string;
  epis_esperados?: string;
  epis_ja_devolvidos?: string[];
  tipo?: 'Aguardando Devolução' | 'Aguardando Retorno de Item';
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
  total_descontado?: number;
  descontos_rescisao?: number;
  descontos_folha?: number;
  categoriasVisao?: {
    admissional: number;
    demissional: number;
    renovacao_com_devolucao: number;
    renovacao_sem_devolucao: number;
  };
}

export interface HistoricoItem {
  id: string;
  nome: string;
  cpf: string;
  status: string;
  tecnico: string;
  data: string;
  contrato?: string;
  epis_devolvidos?: string[];
  epis_pendentes?: string[];
  valor_desconto?: string;
  motivo_acao?: string;
}

export interface CriarSolicitacaoPayload {
  nome_colaborador: string;
  cpf: string;
  telefone1?: string;
  telefone2?: string;
  contrato: string;
  motivo: string;
  data_solicitacao: string;
  epis_esperados: { nome: string; tamanho: string; qtd: number }[];
  tecnico_responsavel: string;
  assinatura_base64?: string;
}

export interface SalvarBaixaPayload {
  id_monday:           string;
  nome:                string;
  cpf:                 string;
  contrato?:           string;   // ← necessário para PDF e ZapSign
  epis_problema:       EpiStatusItem[];
  fotos_epis:          { index: number; nome: string; base64: string }[];
  assinatura_base64:   string;
  tecnico_responsavel: string;
}
