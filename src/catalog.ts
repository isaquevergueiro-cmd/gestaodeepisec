// ⚠️ REGRA DE OURO: As strings abaixo devem ser 100% idênticas ao catálogo do Monday.
// Qualquer divergência (espaço duplo, capitalização) causará erro na busca de ID de preço.

interface CargoEntry {
  contrato: string;
  epis: string[];
}

export const CARGO_EPI_MAP: Record<string, CargoEntry> = {
  'Auxiliar de Serviços Gerais (SEMSA)': {
    contrato: 'SEMSA',
    epis: [
      'CAMISA - ASG (SEMSA)',
      'CALÇA - ASG (SEMSA)',
      'CALÇADO - ASG (SEMSA)',
      'LUVA - ASG (SEMSA)',
    ],
  },
  'Auxiliar de Serviços Gerais (SEDUC e CETAM)': {
    contrato: 'SEDUC e CETAM',
    epis: [
      'CAMISA - ASG (SEDUC e CETAM)',
      'CALÇA - ASG (SEDUC e CETAM)',
      'CALÇADO - ASG (SEDUC e CETAM)',
      'LUVA - ASG (SEDUC e CETAM)',
    ],
  },
  'Agente de Portaria (DETRAN)': {
    contrato: 'DETRAN',
    epis: [
      'CAMISA - AGP (DETRAN)',
      'CALÇA - AGP (DETRAN)',
      'GUARDA CHUVA - AGP (DETRAN)',
      'CAPA DE CHUVA - AGP (DETRAN)',
      'CALÇADO - AGP (DETRAN)',
    ],
  },
  'Encarregados (Gerais)': {
    contrato: 'Gerais',
    epis: [
      'CAMISA - ENCARREGADO (Gerais)',
      'CALÇADO - ENCARREGADO (Gerais)',
      // ⚠️ No Monday há dois itens com o nome "CAPA DE CHUVA - ENCARREGADO (Gerais)"
      'CAPA DE CHUVA - ENCARREGADO (Gerais)',
    ],
  },
};

export const CARGOS = Object.keys(CARGO_EPI_MAP);

// ⚠️ Strings devem ser idênticas aos labels da coluna color_mm1y1rf2 no Monday.
export const MOTIVOS = [
  'Troca Anual',
  'Desgaste/Avaria',
  'Desligamento',
  'A definir',
];
