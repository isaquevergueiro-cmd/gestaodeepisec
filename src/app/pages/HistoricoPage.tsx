import { useEffect, useState } from 'react';
import { Search, RefreshCw, Filter, AlertCircle, X, CheckCircle2, Box, Info, DollarSign, Calendar } from 'lucide-react';
import { getHistorico } from '../../api';
import { StatusBadge, statusFromLabel } from '../components/StatusBadge';
import { formatDate } from '../../utils';
import type { HistoricoItem } from '../../types';

export function HistoricoPage() {
  const [items,   setItems]   = useState<HistoricoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [search,  setSearch]  = useState('');
  const [filter,  setFilter]  = useState('todos');
  const [page,    setPage]    = useState(1);
  const [selectedItem, setSelectedItem] = useState<HistoricoItem | null>(null);
  const PER_PAGE = 10;

  async function fetchData() {
    setLoading(true);
    setError('');
    try {
      const data = await getHistorico();
      setItems(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, []);

  const filtered = items.filter(item => {
    const matchSearch =
      !search ||
      item.nome.toLowerCase().includes(search.toLowerCase()) ||
      item.cpf.includes(search);
    const matchFilter =
      filter === 'todos' ||
      (filter === 'concluida' && item.status.toLowerCase().includes('conclu')) ||
      (filter === 'problema'  && item.status.toLowerCase().includes('pend'));
    return matchSearch && matchFilter;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paginado   = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const FILTER_OPTS = [
    { value: 'todos',    label: 'Todos' },
    { value: 'concluida', label: 'Concluídas' },
    { value: 'problema', label: 'Com Pendências' },
  ];

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {/* Busca */}
        <div
          style={{
            flex: 1,
            minWidth: 220,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8,
            padding: '8px 14px',
          }}
        >
          <Search size={14} color="#6B7280" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar por nome ou CPF..."
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              color: '#F3F4F6', fontSize: 13, fontFamily: 'Inter, sans-serif',
            }}
          />
        </div>

        {/* Filtro de status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Filter size={13} color="#6B7280" />
          <div style={{ display: 'flex', gap: 4 }}>
            {FILTER_OPTS.map(opt => (
              <button
                key={opt.value}
                onClick={() => { setFilter(opt.value); setPage(1); }}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: filter === opt.value ? '1px solid rgba(0,229,255,0.30)' : '1px solid rgba(255,255,255,0.08)',
                  background: filter === opt.value ? 'rgba(0,229,255,0.12)' : 'rgba(255,255,255,0.04)',
                  color: filter === opt.value ? '#00E5FF' : '#9CA3AF',
                  fontSize: 12,
                  fontWeight: filter === opt.value ? 600 : 400,
                  cursor: 'pointer',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={fetchData}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 8,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#9CA3AF', fontSize: 12, cursor: 'pointer',
          }}
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      {/* Erro */}
      {error && (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 16px', borderRadius: 10, marginBottom: 16,
            background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)',
            color: '#EF4444', fontSize: 13,
          }}
        >
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {/* Tabela */}
      <div
        style={{
          background: 'rgba(36,40,45,0.85)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1.4fr 1fr 1fr 1fr 1fr',
            background: 'rgba(0,0,0,0.20)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            padding: '12px 24px',
          }}
        >
          {['Colaborador', 'CPF', 'Data Baixa', 'Técnico', 'Contrato', 'Status'].map(col => (
            <span
              key={col}
              style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: '#4B5563' }}
            >
              {col}
            </span>
          ))}
        </div>

        {/* Linhas */}
        {loading ? (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: '#6B7280', fontSize: 13 }}>
            Carregando histórico...
          </div>
        ) : paginado.length === 0 ? (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: '#6B7280', fontSize: 13 }}>
            {items.length === 0 ? 'Nenhum registro encontrado no histórico.' : 'Nenhum resultado para os filtros aplicados.'}
          </div>
        ) : (
          paginado.map((item, i) => (
            <div
              key={item.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1.4fr 1fr 1fr 1fr 1fr',
                padding: '14px 24px',
                borderBottom: i < paginado.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                transition: 'background 0.15s ease',
                alignItems: 'center',
                cursor: 'pointer',
              }}
              onClick={() => setSelectedItem(item)}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'rgba(0,229,255,0.10)', border: '1px solid rgba(0,229,255,0.20)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, color: '#00E5FF', flexShrink: 0,
                  }}
                >
                  {item.nome?.charAt(0) ?? '?'}
                </div>
                <span style={{ fontSize: 13, color: '#F3F4F6', fontWeight: 500 }}>{item.nome}</span>
              </div>
              <span style={{ fontSize: 12, color: '#9CA3AF', fontVariantNumeric: 'tabular-nums' }}>{item.cpf}</span>
              <span style={{ fontSize: 12, color: '#9CA3AF' }}>{formatDate(item.data)}</span>
              <span style={{ fontSize: 12, color: '#9CA3AF' }}>{item.tecnico || '—'}</span>
              <span style={{ fontSize: 12, color: '#9CA3AF' }}>{item.contrato || '—'}</span>
              <StatusBadge variant={statusFromLabel(item.status)} label={item.status} />
            </div>
          ))
        )}

        {/* Paginação */}
        {filtered.length > PER_PAGE && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 24px',
              borderTop: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <span style={{ fontSize: 12, color: '#6B7280' }}>
              {filtered.length} registros · página {page}/{totalPages}
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={() => setPage(p => Math.max(p - 1, 1))}
                disabled={page === 1}
                style={{
                  padding: '5px 12px', borderRadius: 7,
                  border: '1px solid rgba(255,255,255,0.06)',
                  background: 'transparent', color: '#6B7280',
                  fontSize: 12, cursor: page === 1 ? 'not-allowed' : 'pointer',
                  opacity: page === 1 ? 0.4 : 1,
                }}
              >
                ← Anterior
              </button>
              <button
                onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                disabled={page === totalPages}
                style={{
                  padding: '5px 12px', borderRadius: 7,
                  border: '1px solid rgba(255,255,255,0.06)',
                  background: 'transparent', color: '#6B7280',
                  fontSize: 12, cursor: page === totalPages ? 'not-allowed' : 'pointer',
                  opacity: page === totalPages ? 0.4 : 1,
                }}
              >
                Próxima →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Detalhes */}
      {selectedItem && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
            padding: 20,
          }}
          onClick={() => setSelectedItem(null)}
        >
          <div
            style={{
              background: '#1F242B', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 16, width: '100%', maxWidth: 640,
              maxHeight: '90vh', overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Cabecalho Modal */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, color: '#F3F4F6', display: 'flex', alignItems: 'center', gap: 10 }}>
                  Detalhes da Baixa
                  <StatusBadge variant={statusFromLabel(selectedItem.status)} label={selectedItem.status} />
                </h2>
                <div style={{ marginTop: 6, fontSize: 13, color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Calendar size={14} /> Resolvido em: {formatDate(selectedItem.data)}
                </div>
              </div>
              <button 
                onClick={() => setSelectedItem(null)} 
                style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#9CA3AF', width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Conteudo Modal */}
            <div style={{ padding: '24px' }}>
              
              {/* Infos do Colaborador e Tecnico */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 }}>Colaborador</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#F3F4F6', marginBottom: 2 }}>{selectedItem.nome}</div>
                  <div style={{ fontSize: 12, color: '#9CA3AF' }}>CPF: {selectedItem.cpf}</div>
                  <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>Contrato: {selectedItem.contrato || 'N/A'}</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 }}>Técnico Responsável</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(0,229,255,0.1)', color: '#00E5FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600 }}>T</div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: '#F3F4F6' }}>{selectedItem.tecnico}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Financeiro */}
              {(selectedItem.valor_desconto && selectedItem.valor_desconto.trim() !== "0" && selectedItem.valor_desconto.trim() !== "") && (
                <div style={{ background: 'linear-gradient(to right, rgba(239,68,68,0.1), rgba(239,68,68,0.02))', padding: '16px 20px', borderRadius: 12, border: '1px solid rgba(239,68,68,0.2)', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444', width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <DollarSign size={20} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#FCA5A5' }}>Desconto Aplicado</div>
                      <div style={{ fontSize: 12, color: '#F87171' }}>Motivo: {selectedItem.motivo_acao || 'N/A'}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#EF4444' }}>
                    {selectedItem.valor_desconto}
                  </div>
                </div>
              )}

              {/* Listas de EPIs */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {selectedItem.epis_devolvidos && selectedItem.epis_devolvidos.length > 0 && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, color: '#00E676', fontSize: 13, fontWeight: 600 }}>
                      <CheckCircle2 size={16} /> Devolvidos / Reutilizados ({selectedItem.epis_devolvidos.length})
                    </div>
                    <div style={{ background: 'rgba(0,230,118,0.05)', border: '1px solid rgba(0,230,118,0.1)', borderRadius: 8, padding: 12 }}>
                      {selectedItem.epis_devolvidos.map((epi, idx) => (
                        <div key={idx} style={{ padding: '6px 0', fontSize: 13, color: '#E5E7EB', display: 'flex', alignItems: 'center', gap: 8, borderBottom: idx < (selectedItem.epis_devolvidos?.length || 0) - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                          <Box size={14} color="#00E676" opacity={0.6} /> {epi}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedItem.epis_pendentes && selectedItem.epis_pendentes.length > 0 && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, color: '#EF4444', fontSize: 13, fontWeight: 600 }}>
                      <AlertCircle size={16} /> Pendentes / Faltantes ({selectedItem.epis_pendentes.length})
                    </div>
                    <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.1)', borderRadius: 8, padding: 12 }}>
                      {selectedItem.epis_pendentes.map((epi, idx) => (
                        <div key={idx} style={{ padding: '6px 0', fontSize: 13, color: '#E5E7EB', display: 'flex', alignItems: 'center', gap: 8, borderBottom: idx < (selectedItem.epis_pendentes?.length || 0) - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                          <Box size={14} color="#EF4444" opacity={0.6} /> {epi}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {!(selectedItem.epis_devolvidos && selectedItem.epis_devolvidos.length > 0) && !(selectedItem.epis_pendentes && selectedItem.epis_pendentes.length > 0) && (
                   <div style={{ textAlign: 'center', padding: 20, color: '#6B7280', fontSize: 13, background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
                     <Info size={16} style={{ marginBottom: 8, opacity: 0.5 }} />
                     <div>Nenhuma informação detalhada de EPIs encontrada para este item.</div>
                   </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
