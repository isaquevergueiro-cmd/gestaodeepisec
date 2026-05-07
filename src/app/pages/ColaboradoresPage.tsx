import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import {
  Search,
  Users,
  FileCheck,
  FileWarning,
  AlertCircle,
  Loader2,
  RefreshCw,
  FilePlus,
  Building2,
  MapPin,
  Briefcase,
  CalendarDays,
  ChevronRight,
} from 'lucide-react';
import {
  listarColaboradoresAdmissional,
  type ColaboradorAdmissional,
} from '../../api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ASO_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  REALIZADO:    { bg: 'rgba(0,230,118,0.12)', text: '#00E676',  dot: '#00E676'  },
  ENCAMINHADO:  { bg: 'rgba(0,229,255,0.12)', text: '#00E5FF',  dot: '#00E5FF'  },
  PENDENTE:     { bg: 'rgba(251,191,36,0.12)', text: '#FBBF24', dot: '#FBBF24'  },
  'A DEFINIR':  { bg: 'rgba(107,114,128,0.12)', text: '#6B7280', dot: '#6B7280' },
};

function asoColor(status: string) {
  const key = status.toUpperCase();
  return ASO_COLORS[key] ?? { bg: 'rgba(107,114,128,0.12)', text: '#9CA3AF', dot: '#6B7280' };
}

function initials(nome: string) {
  return nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(n => n[0].toUpperCase())
    .join('');
}

const AVATAR_COLORS = [
  ['#A855F7','#7C3AED'], ['#00E5FF','#0284C7'], ['#00E676','#059669'],
  ['#F59E0B','#D97706'], ['#EF4444','#DC2626'], ['#EC4899','#DB2777'],
];

function avatarColor(nome: string) {
  let h = 0;
  for (let i = 0; i < nome.length; i++) h = nome.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

// ─── Componentes ─────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: number; color: string;
}) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 12,
      padding: '16px 20px',
      display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
        background: `${color}18`, border: `1px solid ${color}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={18} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#F3F4F6', lineHeight: 1.1 }}>
          {value}
        </div>
        <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
}

function ColaboradorRow({ colab, onCautela }: {
  colab: ColaboradorAdmissional;
  onCautela: (cpf: string) => void;
}) {
  const [hov, setHov] = useState(false);
  const colors = avatarColor(colab.nome);
  const aso = asoColor(colab.status_aso);

  return (
    <tr
      style={{
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        background: hov ? 'rgba(255,255,255,0.03)' : 'transparent',
        transition: 'background 0.12s',
        cursor: 'default',
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      {/* Nome + avatar */}
      <td style={{ padding: '12px 16px', minWidth: 230 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
            background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: '#fff',
          }}>
            {initials(colab.nome)}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#E5E7EB' }}>
              {colab.nome}
            </div>
            <div style={{ fontSize: 11, color: '#4B5563', marginTop: 1, fontFamily: 'monospace', letterSpacing: '0.5px' }}>
              {colab.cpf || '—'}
            </div>
          </div>
        </div>
      </td>

      {/* Função */}
      <td style={{ padding: '12px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Briefcase size={12} color="#4B5563" />
          <span style={{ fontSize: 12, color: '#9CA3AF' }}>
            {colab.funcao || '—'}
          </span>
        </div>
      </td>

      {/* Órgão */}
      <td style={{ padding: '12px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Building2 size={12} color="#4B5563" />
          <span style={{ fontSize: 12, color: '#9CA3AF' }}>
            {colab.orgao || '—'}
          </span>
        </div>
      </td>

      {/* Cidade */}
      <td style={{ padding: '12px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <MapPin size={11} color="#4B5563" />
          <span style={{ fontSize: 11, color: '#6B7280' }}>
            {colab.cidade || '—'}
          </span>
        </div>
      </td>

      {/* Data Admissão */}
      <td style={{ padding: '12px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <CalendarDays size={11} color="#4B5563" />
          <span style={{ fontSize: 11, color: '#6B7280', fontVariantNumeric: 'tabular-nums' }}>
            {colab.data_admissao || '—'}
          </span>
        </div>
      </td>

      {/* Status ASO */}
      <td style={{ padding: '12px 12px' }}>
        {colab.status_aso ? (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 11, fontWeight: 600,
            padding: '3px 9px', borderRadius: 20,
            background: aso.bg, color: aso.text,
            letterSpacing: '0.3px',
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: aso.dot, flexShrink: 0 }} />
            {colab.status_aso}
          </span>
        ) : (
          <span style={{ fontSize: 11, color: '#374151' }}>—</span>
        )}
      </td>

      {/* Cautela */}
      <td style={{ padding: '12px 12px' }}>
        {colab.tem_cautela ? (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 11, fontWeight: 600,
            padding: '3px 9px', borderRadius: 20,
            background: 'rgba(0,230,118,0.10)', color: '#00E676',
          }}>
            <FileCheck size={11} />
            Anexada
          </span>
        ) : (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 11, fontWeight: 600,
            padding: '3px 9px', borderRadius: 20,
            background: 'rgba(251,191,36,0.10)', color: '#FBBF24',
          }}>
            <FileWarning size={11} />
            Pendente
          </span>
        )}
      </td>

      {/* Ação */}
      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
        <button
          onClick={() => onCautela(colab.cpf)}
          title="Gerar / Anexar Cautela"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '5px 12px', borderRadius: 7, cursor: 'pointer',
            fontSize: 12, fontWeight: 600,
            background: 'rgba(168,85,247,0.12)',
            border: '1px solid rgba(168,85,247,0.25)',
            color: '#C084FC',
            opacity: hov ? 1 : 0.6,
            transition: 'opacity 0.15s, box-shadow 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 0 14px rgba(168,85,247,0.25)')}
          onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
        >
          <FilePlus size={12} />
          Cautela
          <ChevronRight size={11} />
        </button>
      </td>
    </tr>
  );
}

// ─── Página Principal ─────────────────────────────────────────────────────────

export function ColaboradoresPage() {
  const navigate = useNavigate();
  const [busca, setBusca] = useState('');

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['admissional-colaboradores'],
    queryFn: listarColaboradoresAdmissional,
    staleTime: 2 * 60 * 1000,  // 2 min cache
    retry: 1,
  });

  const colaboradores = data?.colaboradores ?? [];
  const stats = data?.stats;

  const filtrados = useMemo(() => {
    if (!busca.trim()) return colaboradores;
    const q = busca.toLowerCase().trim();
    return colaboradores.filter(c =>
      c.nome.toLowerCase().includes(q) ||
      c.cpf.replace(/\D/g, '').includes(q.replace(/\D/g, '')) ||
      c.funcao.toLowerCase().includes(q) ||
      c.orgao.toLowerCase().includes(q) ||
      c.cidade.toLowerCase().includes(q)
    );
  }, [colaboradores, busca]);

  function handleCautela(cpf: string) {
    navigate('/cautela', { state: { cpf } });
  }

  return (
    <div className="page-slide-up">

      {/* ── Cabeçalho ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#F3F4F6', letterSpacing: '-0.3px', marginBottom: 4 }}>
            Colaboradores
          </h2>
          <p style={{ fontSize: 13, color: '#4B5563' }}>
            Visualização dos colaboradores cadastrados na Esteira Admissional do Monday.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 8, cursor: isFetching ? 'not-allowed' : 'pointer',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.10)',
            color: '#6B7280', fontSize: 12, fontWeight: 500,
            opacity: isFetching ? 0.6 : 1,
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { if (!isFetching) (e.currentTarget as HTMLElement).style.color = '#E5E7EB'; }}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#6B7280'}
        >
          <RefreshCw size={13} style={{ animation: isFetching ? 'spin 0.8s linear infinite' : 'none' }} />
          Atualizar
        </button>
      </div>

      {/* ── Stats ── */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
          <StatCard icon={Users}       label="Total cadastrados"   value={stats.total}        color="#A855F7" />
          <StatCard icon={FileCheck}   label="Com cautela anexada" value={stats.com_cautela}  color="#00E676" />
          <StatCard icon={FileWarning} label="Sem cautela"         value={stats.sem_cautela}  color="#FBBF24" />
        </div>
      )}

      {/* ── Busca ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.09)',
        borderRadius: 10, padding: '0 14px', marginBottom: 16,
        transition: 'border-color 0.15s',
      }}
        onFocus={() => {}} // handled by inner input
      >
        <Search size={15} color="#4B5563" style={{ flexShrink: 0 }} />
        <input
          type="text"
          placeholder="Buscar por nome, CPF, função, órgão ou cidade…"
          value={busca}
          onChange={e => setBusca(e.target.value)}
          style={{
            flex: 1, background: 'none', border: 'none', outline: 'none',
            color: '#F3F4F6', fontSize: 13, padding: '12px 0', fontFamily: 'inherit',
          }}
        />
        {busca && (
          <button
            onClick={() => setBusca('')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4B5563', fontSize: 18, lineHeight: 1, padding: '0 2px' }}
          >×</button>
        )}
      </div>

      {/* ── Loading ── */}
      {isLoading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, gap: 12, color: '#4B5563' }}>
          <Loader2 size={22} style={{ animation: 'spin 0.8s linear infinite' }} />
          <span style={{ fontSize: 14 }}>Carregando colaboradores do Monday…</span>
        </div>
      )}

      {/* ── Erro ── */}
      {isError && (
        <div style={{
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.20)',
          borderRadius: 12, padding: '20px 24px', display: 'flex', gap: 14, alignItems: 'flex-start',
        }}>
          <AlertCircle size={18} color="#EF4444" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#FCA5A5', marginBottom: 4 }}>
              Erro ao conectar com o Monday
            </p>
            <p style={{ fontSize: 13, color: '#6B7280' }}>
              {(error as Error)?.message ?? 'Tente novamente em instantes.'}
            </p>
            <button
              onClick={() => refetch()}
              style={{
                marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.30)', color: '#FCA5A5',
              }}
            >
              <RefreshCw size={12} /> Tentar novamente
            </button>
          </div>
        </div>
      )}

      {/* ── Tabela ── */}
      {!isLoading && !isError && (
        <>
          {filtrados.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#374151' }}>
              <Users size={36} color="#1F2937" style={{ marginBottom: 12 }} />
              <p style={{ fontSize: 14, color: '#4B5563' }}>
                {busca ? 'Nenhum colaborador encontrado para a busca.' : 'Nenhum colaborador cadastrado ainda.'}
              </p>
            </div>
          ) : (
            <div style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 14, overflow: 'hidden',
            }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
                      {['Colaborador', 'Função', 'Órgão', 'Cidade', 'Admissão', 'ASO', 'Cautela', ''].map(h => (
                        <th key={h} style={{
                          padding: h === '' ? '10px 16px' : '10px 12px',
                          textAlign: h === '' ? 'right' : 'left',
                          fontSize: 10, fontWeight: 700, letterSpacing: '0.8px',
                          textTransform: 'uppercase', color: '#374151',
                          whiteSpace: 'nowrap',
                          ...(h === 'Colaborador' ? { paddingLeft: 16 } : {}),
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtrados.map(c => (
                      <ColaboradorRow key={c.id} colab={c} onCautela={handleCautela} />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              <div style={{
                borderTop: '1px solid rgba(255,255,255,0.05)',
                padding: '10px 16px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: 12, color: '#374151' }}>
                  {busca
                    ? `${filtrados.length} de ${colaboradores.length} colaboradores`
                    : `${colaboradores.length} colaboradores`
                  }
                </span>
                <span style={{ fontSize: 11, color: '#1F2937' }}>
                  Fonte: Monday · Esteira Admissional V2
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
