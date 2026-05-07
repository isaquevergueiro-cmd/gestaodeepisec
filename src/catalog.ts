// ============================================================
// CATÁLOGO REAL DE EPIs — alinhado 100% com o Monday.com
// board_id: 18406575530
// ============================================================

export interface EpiCatalogItem {
  id: string;               // ID do item no Monday (board catálogo)
  nome: string;             // Nome idêntico ao Monday
  preco: number;
  ca: string | null;
  cor: string;
}

export interface GrupoCatalog {
  group_id: string;
  label: string;            // Label legível para a UI
  itens: EpiCatalogItem[];
}

// --- Grupos do catálogo ---
export const CATALOG_GROUPS: Record<string, GrupoCatalog> = {
  ASG_SEMSA: {
    group_id: 'topics',
    label: 'Auxiliar de Serviços Gerais (SEMSA)',
    itens: [
      { id: '11639675053', nome: 'CAMISA - ASG (SEMSA)',  preco: 100, ca: null,         cor: 'Verde musgo' },
      { id: '11639641058', nome: 'CALÇA - ASG (SEMSA)',   preco: 100, ca: null,         cor: 'Verde musgo' },
      { id: '11639664229', nome: 'CALÇADO - ASG (SEMSA)', preco: 100, ca: 'CA 37390',  cor: 'Branco'      },
      { id: '11640869350', nome: 'LUVA - ASG (SEMSA)',    preco: 100, ca: 'CA 32245',  cor: 'Verde'       },
    ],
  },
  ASG_SEDUC_CETAM: {
    group_id: 'group_title',
    label: 'Auxiliar de Serviços Gerais (SEDUC e CETAM)',
    itens: [
      { id: '11639641784', nome: 'CAMISA - ASG (SEDUC e CETAM)',  preco: 100, ca: null,         cor: 'Preto' },
      { id: '11639649308', nome: 'CALÇA - ASG (SEDUC e CETAM)',   preco: 100, ca: null,         cor: 'Preto' },
      { id: '11640898992', nome: 'CALÇADO - ASG (SEDUC e CETAM)', preco: 100, ca: 'CA 37390',  cor: 'Preto' },
      { id: '11640931967', nome: 'LUVA - ASG (SEDUC e CETAM)',    preco: 100, ca: 'CA 32245',  cor: 'Verde' },
    ],
  },
  AGP_DETRAN: {
    group_id: 'group_mm1zmayr',
    label: 'Agente de Portaria (DETRAN)',
    itens: [
      { id: '11640932395', nome: 'CAMISA - AGP (DETRAN)',       preco: 100, ca: null,         cor: 'Azul Marinho' },
      { id: '11640963890', nome: 'CALÇA - AGP (DETRAN)',        preco: 100, ca: null,         cor: 'Azul Marinho' },
      { id: '11640976439', nome: 'GUARDA CHUVA - AGP (DETRAN)', preco: 100, ca: null,         cor: 'Azul Marinho' },
      { id: '11640980371', nome: 'CAPA DE CHUVA - AGP (DETRAN)',preco: 100, ca: null,         cor: 'Azul Marinho' },
      { id: '11640954792', nome: 'CALÇADO - AGP (DETRAN)',      preco: 100, ca: 'CA 48539',  cor: 'Preto'        },
    ],
  },
  ENCARREGADO_GERAIS: {
    group_id: 'group_mm1zw6sx',
    label: 'Encarregados (Gerais)',
    itens: [
      { id: '11640975459', nome: 'CAMISA - ENCARREGADO (Gerais)',          preco: 100, ca: null,         cor: 'Azul Marinho' },
      { id: '11641002369', nome: 'CALÇADO - ENCARREGADO (Gerais)',         preco: 100, ca: 'CA 37390',  cor: 'Preto'        },
      { id: '11641002247', nome: 'CAPA DE CHUVA - ENCARREGADO (Gerais)',   preco: 100, ca: null,         cor: 'Preto'        },
      { id: '11640998720', nome: 'CAPA DE CHUVA (CALÇA) - ENCARREGADO (Gerais)', preco: 100, ca: null,  cor: 'Preto'        },
    ],
  },
};

// ─── Mapa: Cargo → Contrato → Grupo ───────────────────────────────────────────
// '*' significa que o grupo se aplica a qualquer contrato daquele cargo
export const KIT_POR_CARGO: Record<string, Record<string, string>> = {
  'AUX. SERVIÇOS GERAIS': {
    SEMSA: 'ASG_SEMSA',
    SEDUC: 'ASG_SEDUC_CETAM',
    CETAM: 'ASG_SEDUC_CETAM',
  },
  'AGENTE DE PORTARIA': {
    DETRAN: 'AGP_DETRAN',
  },
  ENCARREGADO: {
    '*': 'ENCARREGADO_GERAIS',
  },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

export const CARGOS = Object.keys(KIT_POR_CARGO);

/** Retorna os contratos disponíveis para o cargo selecionado. */
export function getContratos(cargo: string): string[] {
  const map = KIT_POR_CARGO[cargo];
  if (!map) return [];
  if (map['*']) return ['(Qualquer)'];
  return Object.keys(map);
}

/** Retorna o grupo (e seus itens) dado cargo + contrato. */
export function getKitGroup(cargo: string, contrato: string): GrupoCatalog | null {
  const map = KIT_POR_CARGO[cargo];
  if (!map) return null;
  const groupKey = map[contrato] ?? map['*'];
  if (!groupKey) return null;
  return CATALOG_GROUPS[groupKey] ?? null;
}

// Motivos de baixa (para outros fluxos)
export const MOTIVOS = [
  'Troca Anual',
  'Desgaste/Avaria',
  'Desligamento',
  'A definir',
];
