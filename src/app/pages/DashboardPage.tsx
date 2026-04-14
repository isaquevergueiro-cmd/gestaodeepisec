import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, ResponsiveContainer,
} from 'recharts';
import {
  Clock, CheckCircle, AlertTriangle, ShieldCheck,
  RefreshCw, ChevronLeft, ChevronRight, DollarSign, TrendingDown,
  UserPlus, UserMinus, Repeat
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { getDashboard } from '../../api';
import { KpiCard } from '../components/KpiCard';
import { StatusBadge } from '../components/StatusBadge';
import { formatDate } from '../../utils';
import { CARGOS } from '../../catalog';
import type { DashboardData, ConferenciaData } from '../../types';

const DONUT_COLORS = ['#F59E0B', '#00E676', '#EF4444', '#00E5FF'];

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
      <div
        style={{
          width: 3,
          height: 20,
          borderRadius: 2,
          background: 'linear-gradient(180deg, #00E5FF, rgba(0,229,255,0.50))',
          flexShrink: 0,
        }}
      />
      <span style={{ fontSize: 14, fontWeight: 600, color: '#F3F4F6', letterSpacing: '-0.2px' }}>
        {children}
      </span>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: '#1E2328',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: 10,
        padding: '12px 16px',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <p style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 14, fontWeight: 600, color: '#F3F4F6' }}>{payload[0].value} ocorrências</p>
    </div>
  );
};

export function DashboardPage() {
  const navigate = useNavigate();
  const [data, setData]       = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [page, setPage]       = useState(1);
  const [activeTab, setActiveTab] = useState<'pendentes' | 'concluidas' | 'problema' | 'sem_problema'>('pendentes');

  // Inicializa com o mês atual automaticamente
  const mesAtual = new Date().toISOString().slice(0, 7); // "YYYY-MM"
  const [mesAno, setMesAno]     = useState(mesAtual);
  const [contrato, setContrato] = useState('');
  const [epiBusca, setEpiBusca] = useState('');
  const PER_PAGE = 5;

  async function fetchData() {
    setLoading(true);
    setError('');
    try {
      const d = await getDashboard({
        mesAno: mesAno || undefined,
        contrato: contrato || undefined,
        epi: epiBusca || undefined
      });
      setData(d);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, [mesAno, contrato, epiBusca]);

  // Atualiza a cada 60s
  useEffect(() => {
    const interval = setInterval(fetchData, 60_000);
    return () => clearInterval(interval);
  }, [mesAno, contrato, epiBusca]);


  const barData = data?.epis_problematicos
    ? [...data.epis_problematicos]
        .sort((a, b) => b.qtd - a.qtd)
        .slice(0, 8)
        .map(({ nome, qtd }) => ({
          name: nome.length > 22 ? nome.slice(0, 22) + '…' : nome,
          value: qtd,
        }))
    : [];

  const donutData = data
    ? [
        { name: 'Pendentes',    value: data.pendentes },
        { name: 'Concluídas',   value: data.concluidas },
        { name: 'Com Problema', value: data.comProblema },
        { name: 'Sem Problema', value: data.semProblema },
      ]
    : [];

  // Pagination & filtering
  let fullList: any[] = [];
  if (activeTab === 'pendentes') {
    fullList = data?.pendentes_list ?? [];
  } else if (activeTab === 'concluidas') {
    fullList = data?.historico_list ?? [];
  } else if (activeTab === 'problema') {
    fullList = (data?.historico_list ?? []).filter(h => h.status === 'Com Pendências');
  } else if (activeTab === 'sem_problema') {
    fullList = (data?.historico_list ?? []).filter(h => h.status === 'Sem Problema');
  }

  const totalPages = Math.max(1, Math.ceil(fullList.length / PER_PAGE));
  const paginado   = fullList.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  function handleTabChange(tab: typeof activeTab) {
    setActiveTab(tab);
    setPage(1);
  }

  return (
    <div>
      {/* Filtros */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: 1, minWidth: 150 }}>
          <label style={{ display: 'block', fontSize: 12, color: '#9CA3AF', marginBottom: 6 }}>Mês/Ano</label>
          <input
            type="month"
            value={mesAno}
            onChange={(e) => setMesAno(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#F3F4F6', fontSize: 13 }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 150 }}>
          <label style={{ display: 'block', fontSize: 12, color: '#9CA3AF', marginBottom: 6 }}>Contrato</label>
          <select
            value={contrato}
            onChange={(e) => setContrato(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#F3F4F6', fontSize: 13 }}
          >
            <option value="">Todos os contratos</option>
            {CARGOS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 150 }}>
          <label style={{ display: 'block', fontSize: 12, color: '#9CA3AF', marginBottom: 6 }}>Material/EPI</label>
          <input
            type="text"
            placeholder="Ex: Botina, Camisa..."
            value={epiBusca}
            onChange={(e) => setEpiBusca(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#F3F4F6', fontSize: 13 }}
          />
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          style={{
            padding: '8px 16px', borderRadius: 8,
            background: 'rgba(0,229,255,0.15)', border: '1px solid rgba(0,229,255,0.3)',
            color: '#00E5FF', fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 6, height: 38
          }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Filtrar
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        <KpiCard
          icon={Clock}
          iconColor="#F59E0B"
          iconBg="rgba(245,158,11,0.12)"
          label="Pendentes"
          value={loading ? '—' : (data?.pendentes ?? 0)}
          sub="Aguardando devolução"
          trend="neutral"
        />
        <KpiCard
          icon={CheckCircle}
          iconColor="#00E676"
          iconBg="rgba(0,230,118,0.12)"
          label="Concluídas (mês)"
          value={loading ? '—' : (data?.concluidas ?? 0)}
          sub="Conferências finalizadas"
          trend="up"
        />
        <KpiCard
          icon={AlertTriangle}
          iconColor="#EF4444"
          iconBg="rgba(239,68,68,0.12)"
          label="Com Pendências"
          value={loading ? '—' : (data?.comProblema ?? 0)}
          sub="EPIs com problema"
          trend="down"
        />
        <KpiCard
          icon={ShieldCheck}
          iconColor="#00E5FF"
          iconBg="rgba(0,229,255,0.10)"
          label="Sem Problema"
          value={loading ? '—' : (data?.semProblema ?? 0)}
          sub="Conferências ok"
          trend="up"
        />
      </div>

      <SectionTitle>Ações Requisitadas (Categorias)</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        <KpiCard
          icon={UserPlus}
          iconColor="#A855F7"
          iconBg="rgba(168,85,247,0.12)"
          label="Admissional"
          value={loading ? '—' : (data?.categoriasVisao?.admissional ?? 0)}
          sub="Entregas Iniciais"
          trend="neutral"
        />
        <KpiCard
          icon={UserMinus}
          iconColor="#EF4444"
          iconBg="rgba(239,68,68,0.12)"
          label="Demissional"
          value={loading ? '—' : (data?.categoriasVisao?.demissional ?? 0)}
          sub="Rescisões e Desligamentos"
          trend="neutral"
        />
        <KpiCard
          icon={RefreshCw}
          iconColor="#F59E0B"
          iconBg="rgba(245,158,11,0.12)"
          label="Troca c/ Devolução"
          value={loading ? '—' : (data?.categoriasVisao?.renovacao_com_devolucao ?? 0)}
          sub="Renovação Padrão"
          trend="neutral"
        />
        <KpiCard
          icon={Repeat}
          iconColor="#00E676"
          iconBg="rgba(0,230,118,0.12)"
          label="Troca s/ Devolução"
          value={loading ? '—' : (data?.categoriasVisao?.renovacao_sem_devolucao ?? 0)}
          sub="Renovação Extraordinária"
          trend="neutral"
        />
      </div>

      <SectionTitle>Visão Financeira (Retenção)</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
        <KpiCard
          icon={DollarSign}
          iconColor="#EF4444"
          iconBg="rgba(239,68,68,0.12)"
          label="Total Descontado"
          value={loading ? '—' : `R$ ${((data?.total_descontado ?? 0).toFixed(2)).replace('.', ',')}`}
          sub="Valores retidos do colaborador"
          trend="down"
        />
        <KpiCard
          icon={TrendingDown}
          iconColor="#F97316"
          iconBg="rgba(249,115,22,0.12)"
          label="Descontos na Folha"
          value={loading ? '—' : `R$ ${((data?.descontos_folha ?? 0).toFixed(2)).replace('.', ',')}`}
          sub="Folha de Pagamento"
          trend="down"
        />
        <KpiCard
          icon={TrendingDown}
          iconColor="#A855F7"
          iconBg="rgba(168,85,247,0.12)"
          label="Descontos na Rescisão"
          value={loading ? '—' : `R$ ${((data?.descontos_rescisao ?? 0).toFixed(2)).replace('.', ',')}`}
          sub="Cobrança em Desligamento"
          trend="down"
        />
      </div>

      {error && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 10,
            background: 'rgba(239,68,68,0.10)',
            border: '1px solid rgba(239,68,68,0.25)',
            color: '#EF4444',
            fontSize: 13,
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <AlertTriangle size={14} />
          {error}
          <button
            onClick={fetchData}
            style={{ marginLeft: 'auto', color: '#EF4444', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}
          >
            <RefreshCw size={12} /> Tentar novamente
          </button>
        </div>
      )}

      {/* Gráficos */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, marginBottom: 28 }}>
        {/* BarChart */}
        <div
          style={{
            background: 'rgba(36,40,45,0.85)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14,
            padding: 24,
          }}
        >
          <SectionTitle>EPIs com Mais Ocorrências</SectionTitle>
          {loading ? (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280', fontSize: 13 }}>
              Carregando...
            </div>
          ) : barData.length === 0 ? (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280', fontSize: 13 }}>
              Nenhum dado disponível
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#6B7280', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis
                  tick={{ fill: '#6B7280', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="value" fill="#00E5FF" radius={[5, 5, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Donut */}
        <div
          style={{
            background: 'rgba(36,40,45,0.85)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14,
            padding: 24,
          }}
        >
          <SectionTitle>Distribuição de Status</SectionTitle>
          {loading ? (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280', fontSize: 13 }}>
              Carregando...
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={72}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {donutData.map((_, i) => (
                      <Cell key={i} fill={DONUT_COLORS[i]} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: '#1E2328',
                      border: '1px solid rgba(255,255,255,0.10)',
                      borderRadius: 10,
                      fontFamily: 'Inter',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                {donutData.map((d, i) => (
                  <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        width: 8, height: 8, borderRadius: 2,
                        background: DONUT_COLORS[i], flexShrink: 0,
                      }}
                    />
                    <span style={{ fontSize: 11, color: '#9CA3AF', flex: 1 }}>{d.name}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#F3F4F6', fontVariantNumeric: 'tabular-nums' }}>
                      {d.value}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Tabela de pendentes */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            <SectionTitle>Gestão de Solicitações</SectionTitle>
            
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: 4, gap: 4 }}>
              <button 
                onClick={() => handleTabChange('pendentes')}
                style={{ padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500, background: activeTab === 'pendentes' ? 'rgba(0,229,255,0.15)' : 'transparent', color: activeTab === 'pendentes' ? '#00E5FF' : '#9CA3AF', cursor: 'pointer', transition: 'all 0.2s', border: 'none' }}>
                Pendentes
              </button>
              <button 
                onClick={() => handleTabChange('concluidas')}
                style={{ padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500, background: activeTab === 'concluidas' ? 'rgba(255,255,255,0.1)' : 'transparent', color: activeTab === 'concluidas' ? '#F3F4F6' : '#9CA3AF', cursor: 'pointer', transition: 'all 0.2s', border: 'none' }}>
                Todas (Histórico)
              </button>
              <button 
                onClick={() => handleTabChange('problema')}
                style={{ padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500, background: activeTab === 'problema' ? 'rgba(239,68,68,0.15)' : 'transparent', color: activeTab === 'problema' ? '#EF4444' : '#9CA3AF', cursor: 'pointer', transition: 'all 0.2s', border: 'none' }}>
                Com Problema
              </button>
              <button 
                onClick={() => handleTabChange('sem_problema')}
                style={{ padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500, background: activeTab === 'sem_problema' ? 'rgba(0,230,118,0.15)' : 'transparent', color: activeTab === 'sem_problema' ? '#00E676' : '#9CA3AF', cursor: 'pointer', transition: 'all 0.2s', border: 'none' }}>
                Sem Problema
              </button>
            </div>
          </div>
          <button
            onClick={fetchData}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 8,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#9CA3AF',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>

        <div
          style={{
            background: 'rgba(36,40,45,0.85)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14,
            overflow: 'hidden',
          }}
        >
          {/* Cabeçalho da tabela */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: activeTab === 'pendentes' ? '2fr 1.5fr 1.2fr 1fr' : '2fr 1.5fr 1.2fr 1fr 1fr',
              background: 'rgba(0,0,0,0.20)',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              padding: '12px 24px',
            }}
          >
            {(activeTab === 'pendentes' 
              ? ['Colaborador', 'Tels (Cobrança)', 'Data Solicitação', 'Status']
              : ['Colaborador', 'CPF', 'Data Solicitação', 'Técnico', 'Status']
            ).map(col => (
              <span
                key={col}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.8px',
                  textTransform: 'uppercase',
                  color: '#4B5563',
                }}
              >
                {col}
              </span>
            ))}
          </div>

          {/* Linhas */}
          {loading ? (
            <div style={{ padding: '40px 24px', textAlign: 'center', color: '#6B7280', fontSize: 13 }}>
              Carregando dados...
            </div>
          ) : paginado.length === 0 ? (
            <div style={{ padding: '40px 24px', textAlign: 'center', color: '#6B7280', fontSize: 13 }}>
              {activeTab === 'pendentes' ? 'Nenhuma solicitação pendente' : 'Nenhum histórico encontrado para este filtro'}
            </div>
          ) : (
            paginado.map((item, i) => (
              <div
                key={item.id}
                onClick={() => {
                  if (activeTab !== 'pendentes') return;
                  if (!item.cpf) return;
                  const epis = item.epis_esperados
                    ? item.epis_esperados.split(/\n|,\s*/).map((e: string) => e.trim()).filter(Boolean)
                    : [];
                  const navData: ConferenciaData = {
                    id_monday: item.id,
                    nome: item.nome ?? '',
                    cpf: item.cpf ?? '',
                    epis_esperados: epis,
                    is_retorno: item.tipo === 'Aguardando Retorno de Item',
                    epis_ja_devolvidos: item.epis_ja_devolvidos ?? [],
                  };
                  if (item.tipo === 'Aguardando Retorno de Item') {
                    navigate('/devolutiva', { state: navData });
                  } else {
                    navigate('/conferencia', { state: navData });
                  }
                }}
                style={{
                  display: 'grid',
                  gridTemplateColumns: activeTab === 'pendentes' ? '2fr 1.5fr 1.2fr 1fr' : '2fr 1.5fr 1.2fr 1fr 1fr',
                  padding: '14px 24px',
                  borderBottom: i < paginado.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  transition: 'background 0.15s ease',
                  alignItems: 'center',
                  cursor: activeTab === 'pendentes' ? 'pointer' : 'default',
                }}
                onMouseEnter={(e: any) => { if(activeTab === 'pendentes') (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; }}
                onMouseLeave={(e: any) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                {/* Avatar + nome */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: 'rgba(0,229,255,0.10)',
                      border: '1px solid rgba(0,229,255,0.20)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#00E5FF',
                      flexShrink: 0,
                    }}
                  >
                    {item.nome?.charAt(0) ?? '?'}
                  </div>
                  <span style={{ fontSize: 13, color: '#F3F4F6', fontWeight: 500 }}>
                    {item.nome ?? '—'}
                  </span>
                </div>
                {activeTab === 'pendentes' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {item.telefone1 ? <span style={{ fontSize: 12, color: '#00E5FF', fontVariantNumeric: 'tabular-nums' }}>📞 {item.telefone1}</span> : null}
                    {item.telefone2 ? <span style={{ fontSize: 11, color: '#9CA3AF', fontVariantNumeric: 'tabular-nums' }}>📞 {item.telefone2}</span> : null}
                    {!item.telefone1 && !item.telefone2 && <span style={{ fontSize: 12, color: '#6B7280' }}>Sem contato</span>}
                  </div>
                ) : (
                  <span style={{ fontSize: 12, color: '#9CA3AF', fontVariantNumeric: 'tabular-nums' }}>
                    {item.cpf || '—'}
                  </span>
                )}
                <span style={{ fontSize: 12, color: '#9CA3AF' }}>
                  {formatDate(item.data || '')}
                </span>
                {activeTab !== 'pendentes' && (
                  <span style={{ fontSize: 12, color: '#9CA3AF' }}>
                    {item.tecnico || '—'}
                  </span>
                )}
                {activeTab === 'pendentes' ? (
                  <StatusBadge 
                    variant={item.tipo === 'Aguardando Retorno de Item' ? 'warning' : 'neutral'} 
                    label={item.tipo === 'Aguardando Retorno de Item' ? '⏳ Aguardando Retorno' : '📋 Aguardando Devolução'} 
                  />
                ) : (
                  <StatusBadge 
                    variant={item.status === 'Com Pendências' ? 'danger' : 'success'} 
                    label={item.status || 'Concluída'} 
                  />
                )}
              </div>
            ))
          )}

          {/* Paginação */}
          {fullList.length > PER_PAGE && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 6,
                padding: '12px 24px',
                borderTop: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <span style={{ fontSize: 12, color: '#6B7280', marginRight: 8 }}>
                {page}/{totalPages}
              </span>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 7,
                    border: p === page
                      ? '1px solid rgba(0,229,255,0.30)'
                      : '1px solid rgba(255,255,255,0.06)',
                    background: p === page ? 'rgba(0,229,255,0.15)' : 'transparent',
                    color: p === page ? '#00E5FF' : '#6B7280',
                    fontSize: 12,
                    fontWeight: p === page ? 600 : 400,
                    cursor: 'pointer',
                  }}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                disabled={page === totalPages}
                style={{
                  width: 30, height: 30, borderRadius: 7,
                  border: '1px solid rgba(255,255,255,0.06)',
                  background: 'transparent', color: '#6B7280',
                  cursor: page === totalPages ? 'not-allowed' : 'pointer',
                  opacity: page === totalPages ? 0.4 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <ChevronRight size={14} />
              </button>
              <button
                onClick={() => setPage(p => Math.max(p - 1, 1))}
                disabled={page === 1}
                style={{
                  width: 30, height: 30, borderRadius: 7,
                  border: '1px solid rgba(255,255,255,0.06)',
                  background: 'transparent', color: '#6B7280',
                  cursor: page === 1 ? 'not-allowed' : 'pointer',
                  opacity: page === 1 ? 0.4 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <ChevronLeft size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
