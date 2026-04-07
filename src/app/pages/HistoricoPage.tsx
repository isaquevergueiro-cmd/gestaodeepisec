import { useEffect, useState } from 'react';
import { Search, RefreshCw, Filter, AlertCircle } from 'lucide-react';
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
              }}
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
    </div>
  );
}
