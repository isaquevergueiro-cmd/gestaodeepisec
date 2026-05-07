import { useState, useRef, KeyboardEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import {
  Search,
  User,
  Package,
  Check,
  RotateCcw,
  Repeat2,
  Loader2,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import { buscarColaborador } from '../../api';
import { extractErrorMessage } from '../../api';
import { useColaborador } from '../contexts/ColaboradorContext';
import { StatusBadge } from '../components/StatusBadge';
import { formatCpf, validarCpf } from '../../utils';
import type { EpiSubitem, EpiStatus } from '../../types';

// Quais status permitem ações no balcão
const PODE_ENTREGAR: EpiStatus[] = ['Pendente de Receber'];
const PODE_DEVOLVER: EpiStatus[] = ['Entregue', 'Aguardando Devolução'];

export function BuscaPage() {
  const [cpfDisplay, setCpfDisplay] = useState('');   // formatado ex: 123.456.789-00
  const [cpfSearch, setCpfSearch]   = useState('');   // dígitos puros enviados
  const [inputError, setInputError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const navigate      = useNavigate();
  const { setColaborador } = useColaborador();

  // ─── Query ─────────────────────────────────────────────────
  const { data, isLoading, isFetching, error, isSuccess } = useQuery({
    queryKey: ['colaborador', cpfSearch],
    queryFn: async () => {
      const result = await buscarColaborador(cpfSearch);
      setColaborador(result);
      return result;
    },
    enabled: cpfSearch.length === 11,
    retry: false,
    staleTime: 60_000,
  });

  // ─── Handlers ──────────────────────────────────────────────
  function handleCpfChange(e: React.ChangeEvent<HTMLInputElement>) {
    const formatted = formatCpf(e.target.value);
    setCpfDisplay(formatted);
    setInputError('');
    // Se CPF foi limpo, reseta a query
    if (formatted.replace(/\D/g, '').length < 11) setCpfSearch('');
  }

  function handleSearch() {
    const digits = cpfDisplay.replace(/\D/g, '');
    if (!validarCpf(digits)) {
      setInputError('CPF inválido. Verifique os dígitos.');
      return;
    }
    setCpfSearch(digits);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleSearch();
  }

  function handleClear() {
    setCpfDisplay('');
    setCpfSearch('');
    setInputError('');
    setColaborador(null);
    inputRef.current?.focus();
  }

  // ─── Ação por status ───────────────────────────────────────
  function renderActions(epi: EpiSubitem) {
    if (PODE_ENTREGAR.includes(epi.status)) {
      return (
        <ActionBtn
          label="Confirmar Entrega"
          icon={<Check size={13} />}
          color="#00E5FF"
          border="rgba(0,229,255,0.35)"
          bg="rgba(0,229,255,0.10)"
          onClick={() => navigate('/entrega', { state: { epi } })}
        />
      );
    }
    if (PODE_DEVOLVER.includes(epi.status)) {
      return (
        <div style={{ display: 'flex', gap: 6 }}>
          <ActionBtn
            label="Devolver"
            icon={<RotateCcw size={13} />}
            color="#00E676"
            border="rgba(0,230,118,0.35)"
            bg="rgba(0,230,118,0.10)"
            onClick={() => navigate('/devolucao', { state: { epi } })}
          />
          <ActionBtn
            label="Trocar"
            icon={<Repeat2 size={13} />}
            color="#F59E0B"
            border="rgba(245,158,11,0.35)"
            bg="rgba(245,158,11,0.10)"
            onClick={() => navigate('/troca', { state: { epi } })}
          />
        </div>
      );
    }
    return null;
  }

  const serverError = error ? extractErrorMessage(error) : null;

  return (
    <div className="page-slide-up" style={{ maxWidth: 820, margin: '0 auto' }}>

      {/* ── Search bar ── */}
      <div style={{ marginBottom: 28 }}>
        <label
          htmlFor="cpf-input"
          style={{
            display: 'block',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '1px',
            textTransform: 'uppercase',
            color: '#4B5563',
            marginBottom: 8,
          }}
        >
          CPF do Colaborador
        </label>

        <div style={{ display: 'flex', gap: 10 }}>
          {/* Input wrapper */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${inputError ? 'rgba(239,68,68,0.50)' : 'rgba(255,255,255,0.10)'}`,
              borderRadius: 10,
              padding: '0 14px',
              transition: 'border-color 0.15s',
            }}
            onFocusCapture={(e) => {
              if (!inputError)
                (e.currentTarget as HTMLElement).style.borderColor =
                  'rgba(0,229,255,0.45)';
            }}
            onBlurCapture={(e) => {
              if (!inputError)
                (e.currentTarget as HTMLElement).style.borderColor =
                  'rgba(255,255,255,0.10)';
            }}
          >
            <Search size={16} color="#4B5563" style={{ flexShrink: 0 }} />
            <input
              id="cpf-input"
              ref={inputRef}
              type="text"
              inputMode="numeric"
              placeholder="000.000.000-00"
              maxLength={14}
              value={cpfDisplay}
              onChange={handleCpfChange}
              onKeyDown={handleKeyDown}
              autoFocus
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                color: '#F3F4F6',
                fontSize: 16,
                fontWeight: 500,
                letterSpacing: '0.5px',
                padding: '14px 0',
                fontFamily: 'inherit',
              }}
            />
            {cpfDisplay && (
              <button
                onClick={handleClear}
                title="Limpar"
                style={{
                  color: '#4B5563',
                  fontSize: 18,
                  lineHeight: 1,
                  padding: 4,
                  borderRadius: 4,
                  transition: 'color 0.15s',
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#EF4444')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '#4B5563')}
              >
                ×
              </button>
            )}
          </div>

          {/* Buscar button */}
          <button
            onClick={handleSearch}
            disabled={isLoading || isFetching}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '0 22px',
              borderRadius: 10,
              background: 'linear-gradient(135deg, rgba(0,229,255,0.18), rgba(0,229,255,0.08))',
              border: '1px solid rgba(0,229,255,0.35)',
              color: '#00E5FF',
              fontSize: 14,
              fontWeight: 600,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.6 : 1,
              transition: 'box-shadow 0.2s',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              if (!isLoading)
                (e.currentTarget as HTMLElement).style.boxShadow =
                  '0 0 22px rgba(0,229,255,0.28)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = 'none';
            }}
          >
            {isLoading || isFetching ? (
              <Loader2 size={16} className="spin" />
            ) : (
              <Search size={16} />
            )}
            Buscar
          </button>
        </div>

        {/* Mensagem de erro de input */}
        {inputError && (
          <p
            style={{
              marginTop: 8,
              fontSize: 12,
              color: '#EF4444',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <AlertCircle size={12} /> {inputError}
          </p>
        )}
      </div>

      {/* ── Erro do servidor ── */}
      {serverError && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 16px',
            borderRadius: 10,
            background: 'rgba(239,68,68,0.10)',
            border: '1px solid rgba(239,68,68,0.30)',
            color: '#FCA5A5',
            fontSize: 13,
            marginBottom: 24,
          }}
        >
          <AlertCircle size={16} color="#EF4444" style={{ flexShrink: 0 }} />
          {serverError}
        </div>
      )}

      {/* ── Resultado ── */}
      {isSuccess && data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Card do colaborador */}
          <div
            style={{
              background: 'rgba(36,40,45,0.90)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16,
              padding: '18px 22px',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #00E5FF, #00E676)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 17,
                fontWeight: 700,
                color: '#0A0D0F',
                flexShrink: 0,
              }}
            >
              {data.nome.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2
                  style={{
                    fontSize: 17,
                    fontWeight: 700,
                    color: '#F3F4F6',
                    letterSpacing: '-0.2px',
                  }}
                >
                  {data.nome}
                </h2>
                <User size={14} color="#4B5563" />
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
                <InfoChip label="CPF" value={cpfDisplay} />
                {data.contrato && <InfoChip label="Contrato" value={data.contrato} />}
              </div>
            </div>
            <div
              style={{
                padding: '5px 12px',
                borderRadius: 20,
                background: 'rgba(0,229,255,0.08)',
                border: '1px solid rgba(0,229,255,0.20)',
                fontSize: 11,
                fontWeight: 600,
                color: '#00E5FF',
                letterSpacing: '0.4px',
              }}
            >
              {data.subitens.length} EPI{data.subitens.length !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Lista de EPIs */}
          {data.subitens.length === 0 ? (
            <div
              style={{
                padding: '32px 0',
                textAlign: 'center',
                color: '#4B5563',
                fontSize: 13,
                border: '1px dashed rgba(255,255,255,0.06)',
                borderRadius: 12,
              }}
            >
              <Package size={28} color="#374151" style={{ marginBottom: 8 }} />
              <p>Nenhum EPI vinculado a este colaborador.</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 6px' }}>
              <thead>
                <tr>
                  {['EPI', 'Tamanho', 'Status', 'Ação'].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: h === 'Ação' ? 'right' : 'left',
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: '1px',
                        textTransform: 'uppercase',
                        color: '#374151',
                        paddingBottom: 8,
                        paddingLeft: h === 'EPI' ? 16 : 0,
                        paddingRight: h === 'Ação' ? 16 : 0,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.subitens.map((epi) => (
                  <tr key={epi.id}>
                    <td
                      style={{
                        padding: '12px 0 12px 16px',
                        borderRadius: '10px 0 0 10px',
                        background: 'rgba(255,255,255,0.03)',
                        borderTop: '1px solid rgba(255,255,255,0.05)',
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        borderLeft: '1px solid rgba(255,255,255,0.05)',
                        maxWidth: 260,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: '#E5E7EB',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: 'block',
                        }}
                      >
                        {epi.nome}
                      </span>
                      {epi.ca && (
                        <span style={{ fontSize: 10, color: '#4B5563' }}>CA {epi.ca}</span>
                      )}
                    </td>
                    <td
                      style={{
                        padding: '12px 12px',
                        background: 'rgba(255,255,255,0.03)',
                        borderTop: '1px solid rgba(255,255,255,0.05)',
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontSize: 13,
                          fontWeight: 600,
                          color: '#9CA3AF',
                          background: 'rgba(255,255,255,0.05)',
                          padding: '2px 8px',
                          borderRadius: 6,
                        }}
                      >
                        {epi.tamanho || 'U'}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: '12px 12px',
                        background: 'rgba(255,255,255,0.03)',
                        borderTop: '1px solid rgba(255,255,255,0.05)',
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <StatusBadge status={epi.status} />
                    </td>
                    <td
                      style={{
                        padding: '12px 16px 12px 12px',
                        borderRadius: '0 10px 10px 0',
                        background: 'rgba(255,255,255,0.03)',
                        borderTop: '1px solid rgba(255,255,255,0.05)',
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        borderRight: '1px solid rgba(255,255,255,0.05)',
                        textAlign: 'right',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {renderActions(epi)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Estado inicial — sem busca ativa */}
      {!cpfSearch && !isLoading && (
        <div
          style={{
            textAlign: 'center',
            padding: '60px 0',
            color: '#374151',
          }}
        >
          <Search size={36} color="#1F2937" style={{ marginBottom: 12 }} />
          <p style={{ fontSize: 14, color: '#4B5563' }}>
            Digite o CPF para localizar o colaborador.
          </p>
          <p style={{ fontSize: 12, color: '#374151', marginTop: 4 }}>
            Você também pode bipar o crachá diretamente no campo acima.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Sub-componentes internos ───────────────────────────────

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <span style={{ fontSize: 12, color: '#6B7280' }}>
      {label}:{' '}
      <span style={{ color: '#9CA3AF', fontWeight: 500 }}>{value}</span>
    </span>
  );
}

function ActionBtn({
  label,
  icon,
  color,
  border,
  bg,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  color: string;
  border: string;
  bg: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        borderRadius: 8,
        background: bg,
        border: `1px solid ${border}`,
        color,
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.15s',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = `0 0 14px ${border}`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = 'none';
      }}
    >
      {icon}
      {label}
      <ChevronRight size={11} />
    </button>
  );
}
