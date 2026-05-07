export const BOARDS = {
  GESTAO: 18406415397,
  SUB_GESTAO: 18406605109,
  CATALOGO: 18406575530,
  ESTOQUE3: 18408858041,
  AUDITORIA: 18409129795,
  // Board de admissão — itens pai = lotes de solicitações, subitens = colaboradores
  ESTEIRA_ADMISSIONAL: 9853768518,
  SUB_ADMISSIONAL: 10061375143,
};

// Grupo e item pai do grupo EXAMES ADMISSIONAIS (AS0)
export const AS0_GROUP_ID   = "group_mkvvydnn";
export const AS0_PARENT_ITEM_ID = "10065558588";

export const COLS_GESTAO = {
  NOME: "name",
  SUBElementos: "subtasks_mm1z1d5f",
  CPF: "text_mm1yrhrs",
  CONTRATO: "text_mm1ypaa0",
  MOTIVO_ACAO: "color_mm2ew91j",       // Troca / Desgaste, Admissão, Demissão, A definir
  STATUS_ACAO: "color_mm1y1rf2",       // Concluído, Aguardando Assinatura, Pendente, A definir
  CAUTELA_ASSINADA: "file_mm1z1gbf",
  ASSINATURA: "file_mm1yms92",
  TECNICO_RESPONSAVEL: "text_mm1yfgtm",
  TELEFONE1: "text_mm2c155b",
  TELEFONE2: "text_mm2cz5hh",
  CAUTELA: "file_mm2fg4j5",
};

export const COLS_SUB_GESTAO = {
  NOME: "name",
  // Status: Pendente de Receber | Entregue | Não Devolvido | Reaproveitavel |
  //         Descarte/Dano | A Definir | Enviado Estoque 3 | Aguardando Devolução
  STATUS_INDIVIDUAL: "color_mm2edz4b",
  QUANTIDADE: "text_mm2em1e",           // Quantidade do EPI (texto)
  TAMANHO: "dropdown_mm2etfsb",         // P, M, G, GG, XG, 36–44
  CATALOGO_REL: "board_relation_mm2e3p7c",
  PRECO_UNITARIO: "lookup_mm2eyaq0",    // Mirror do Catálogo de EPIs
  DATA_ENTREGA: "date_mm2fb8rs",        // Data de entrega do EPI
  DATA_DEVOLUCAO: "date_mm2feht2",      // Data de devolução do EPI
  DATA_LIMITE: "date_mm2f48g3",         // Data limite para devolução
  FOTO_EVIDENCIA: "file_mm2ernd8",      // Foto como evidência
  JUSTIFICATIVA: "long_text_mm2ew0cj",  // Justificativa / Observação
};

export const COLS_CATALOGO = {
  NOME: "name",
  PRECO_UNITARIO: "numeric_mm1zzgye",
  CA: "text_mm1z3rkk",
  DESCRICAO: "text_mm1zav70",
  COR: "color_mm1za5pf",
  CONTRATO: "long_text_mm2e3cnr",
};

export const COLS_ESTOQUE3 = {
  NOME: "name",
  TAMANHO: "dropdown_mm2ebr35",
  QUANTIDADE: "numeric_mm2e6rfk",
  STATUS_ESTOQUE: "color_mm2expv0",
  CATALOGO_REL: "board_relation_mm2err0c",
};

export const COLS_AUDITORIA = {
  NOME: "name",
  QUEM_DELETOU: "multiple_person_mm2gdpbj",
  DATA_HORA: "date_mm2gxrt9",
  COLABORADOR: "text_mm2gfd4f",
  ID_REGISTRO: "text_mm2grvgz",
};

// Subelementos da Esteira Admissional — cada subitem = 1 colaborador
export const COLS_SUB_ADMISSIONAL = {
  NOME: "name",                         // Nome completo do colaborador
  CPF: "text_mkvv9dmw",                 // CPF formatado (ex: 093.211.414-80)
  RG: "text_mkvvmwm5",                  // Número do RG
  DATA_NASCIMENTO: "text_mkxb731w",     // Data de nascimento (texto DD/MM/YYYY)
  CIDADE: "text_mkvvrtpv",              // Cidade que reside
  FUNCAO: "text_mkvxd29d",              // Função / cargo
  ORGAO: "text_mkvwtdkj",              // Órgão / contrato (ex: SEMSA, TRE PB)
  DATA_ADMISSAO: "text_mkvw1c4k",       // Data de admissão (texto)
  STATUS_ASO: "status",                 // Status do ASO (REALIZADO, ENCAMINHADO, etc.)
  CAUTELA: "file_mkvvbkwx",            // Arquivo Cautela
  FOTO_CRACHA: "file_mkvvmygq",         // Foto 3x4 / crachá
};
