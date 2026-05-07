import { useState, KeyboardEvent, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Search,
  User,
  FilePlus,
  Paperclip,
  Loader2,
  AlertCircle,
  ChevronRight,
  Plus,
  FileText,
  CheckCircle2,
} from 'lucide-react';
import { checkCautela, criarSubitemCautela, extractErrorMessage } from '../../api';
import { useToast } from '../contexts/ToastContext';
import { formatCpf, validarCpf } from '../../utils';
import type { ColaboradorCautelaInfo, SubitemCautela } from '../../api';

/**
 * Pré-tela de Cautela:
 * 1. Input CPF
 * 2. Verifica se colaborador já existe no Monday
 * 3. Se existe → mostra subitens de CAUTELA → usuário escolhe qual usar ou cria novo
 * 4. Se não existe → encaminha para criação manual do zero
 */
export function CautelaCheckPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toastSuccess, toastError } = useToast();

  // Se veio da página de colaboradores com CPF pré-preenchido
  const cpfFromState = (location.state as { cpf?: string } | null)?.cpf ?? '';

  const [cpfDisplay, setCpfDisplay] = useState(() => cpfFromState);
  const [cpfSearch,  setCpfSearch]  = useState(() => cpfFromState.replace(/\D/g, ''));
  const [inputError, setInputError] = useState('');

  // Auto-busca se veio com CPF válido
  useEffect(() => {
    const digits = cpfFromState.replace(/\D/g, '');
    if (digits.length === 11 && validarCpf(digits)) {
      setCpfSearch(digits);
    }
  }, [cpfFromState]);

  // Estado de seleção
  const [selectedColaborador, setSelectedColaborador] = useState<ColaboradorCautelaInfo | null>(null);
  const [selectedSubitem,     setSelectedSubitem]     = useState<SubitemCautela | null>(null);
  const [criarNovoSubitem,    setCriarNovoSubitem]    = useState(false);

  // ─── Query de check ──────────────────────────────────────
  const { data, isLoading, isSuccess } = useQuery({
    queryKey: ['cautela-check', cpfSearch],
    queryFn: () => checkCautela(cpfSearch),
    enabled: cpfSearch.length === 11,
    retry: false,
    staleTime: 30_000,
  });

  // ─── Mutation: criar novo subitem de cautela ──────────────
  const criarSubitemMutation = useMutation({
    mutationFn: () =>
      criarSubitemCautela(
        selectedColaborador!.id,
        `📋 CAUTELA — ${new Date().toLocaleDateString('pt-BR')}`,
      ),
    onSuccess: (result) => {
      toastSuccess('Subitem de CAUTELA criado!');
      // Navega para a tela de upload passando o subitem_id já criado
      navigate('/cautela/upload', {
        state: {
          subitem_id: result.subitem_id,
          colaborador: selectedColaborador,
          modo: 'anexar',
        },
      });
    },
    onError: (err) => toastError(`Erro ao criar subitem: ${extractErrorMessage(err)}`),
  });

  // ─── Handlers ─────────────────────────────────────────────
  function handleSearch() {
    const digits = cpfDisplay.replace(/\D/g, '');
    if (!validarCpf(digits)) {
      setInputError('CPF inválido. Verifique os dígitos.');
      return;
    }
    setInputError('');
    setSelectedColaborador(null);
    setSelectedSubitem(null);
    setCriarNovoSubitem(false);
    setCpfSearch(digits);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleSearch();
  }

  function handleProsseguirComSubitem() {
    if (!selectedSubitem) return;
    navigate('/cautela/upload', {
      state: {
        subitem_id: selectedSubitem.id,
        colaborador: selectedColaborador,
        modo: 'anexar',
      },
    });
  }

  function handleNovoColaborador() {
    // Passa o CPF digitado para a tela de criação manual
    navigate('/cautela/criar', { state: { cpf: cpfDisplay } });
  }

  const colaboradores = data?.colaboradores ?? [];
  const encontrado    = data?.encontrado ?? false;

  return (
    <div className="page-slide-up" style={{ maxWidth: 700, margin: '0 auto' }}>

      {/* Título */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#F3F4F6', letterSpacing: '-0.3px', marginBottom: 6 }}>
          Nova Cautela de EPI
        </h2>
        <p style={{ fontSize: 13, color: '#4B5563' }}>
          Digite o CPF para verificar se o colaborador já está no sistema antes de criar ou anexar a cautela.
        </p>
      </div>

      {/* ── Campo CPF ── */}
      <div
        style={{
          background: 'rgba(36,40,45,0.90)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14,
          padding: '20px 22px',
          marginBottom: 16,
        }}
      >
        <label
          htmlFor="check-cpf"
          style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#4B5563', marginBottom: 8 }}
        >
          CPF do Colaborador
        </label>
        <div style={{ display: 'flex', gap: 10 }}>
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${inputError ? 'rgba(239,68,68,0.50)' : 'rgba(255,255,255,0.10)'}`,
              borderRadius: 9,
              padding: '0 14px',
              transition: 'border-color 0.15s',
            }}
            onFocusCapture={(e) => { if (!inputError) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(168,85,247,0.45)'; }}
            onBlurCapture={(e) => { if (!inputError) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.10)'; }}
          >
            <Search size={15} color="#4B5563" style={{ flexShrink: 0 }} />
            <input
              id="check-cpf"
              type="text"
              inputMode="numeric"
              placeholder="000.000.000-00"
              maxLength={14}
              autoFocus
              value={cpfDisplay}
              onChange={(e) => { setCpfDisplay(formatCpf(e.target.value)); setInputError(''); }}
              onKeyDown={handleKeyDown}
              style={{ flex: 1, background: 'none', border: 'none', color: '#F3F4F6', fontSize: 16, fontWeight: 500, padding: '13px 0', fontFamily: 'inherit', outline: 'none', letterSpacing: '1px' }}
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={isLoading}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '0 20px', borderRadius: 9,
              background: 'linear-gradient(135deg, rgba(168,85,247,0.18), rgba(168,85,247,0.08))',
              border: '1px solid rgba(168,85,247,0.35)',
              color: '#C084FC', fontSize: 14, fontWeight: 600,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.6 : 1,
              whiteSpace: 'nowrap',
              transition: 'box-shadow 0.2s',
            }}
            onMouseEnter={(e) => { if (!isLoading) (e.currentTarget as HTMLElement).style.boxShadow = '0 0 18px rgba(168,85,247,0.25)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
          >
            {isLoading ? <Loader2 size={15} className="spin" /> : <Search size={15} />}
            Verificar
          </button>
        </div>
        {inputError && (
          <p style={{ marginTop: 8, fontSize: 12, color: '#EF4444', display: 'flex', alignItems: 'center', gap: 5 }}>
            <AlertCircle size={12} /> {inputError}
          </p>
        )}
      </div>

      {/* ── RESULTADO: Não encontrado ── */}
      {isSuccess && !encontrado && (
        <div
          style={{
            background: 'rgba(36,40,45,0.90)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14,
            padding: '24px',
          }}
        >
          <div style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(107,114,128,0.10)', border: '1px solid rgba(107,114,128,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <User size={18} color="#6B7280" />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#9CA3AF', marginBottom: 4 }}>
                Colaborador não encontrado no sistema
              </p>
              <p style={{ fontSize: 13, color: '#4B5563', lineHeight: 1.6 }}>
                Nenhum registro com este CPF foi localizado no board de Gestão. Escolha como deseja prosseguir:
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <ChoiceCard
              icon={<FilePlus size={18} color="#A855F7" />}
              color="#A855F7"
              border="rgba(168,85,247,0.30)"
              bg="rgba(168,85,247,0.08)"
              title="Criar colaborador e cautela manualmente"
              desc="Monte o enxoval de EPIs pelo cargo/contrato e crie o colaborador no Monday."
              onClick={() => navigate('/cautela/criar', { state: { cpf: cpfDisplay } })}
            />
            <ChoiceCard
              icon={<Paperclip size={18} color="#00E5FF" />}
              color="#00E5FF"
              border="rgba(0,229,255,0.30)"
              bg="rgba(0,229,255,0.08)"
              title="Enviar cautela para o N8N processar"
              desc="Faça upload do documento PDF. O N8N irá ler, validar e criar o colaborador automaticamente."
              onClick={() => navigate('/cautela/upload', { state: { modo: 'n8n' } })}
            />
          </div>
        </div>
      )}

      {/* ── RESULTADO: Encontrado ── */}
      {isSuccess && encontrado && colaboradores.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {colaboradores.map((col) => (
            <div
              key={col.id}
              style={{
                background: 'rgba(36,40,45,0.90)',
                border: `1px solid ${selectedColaborador?.id === col.id ? 'rgba(168,85,247,0.35)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 14,
                overflow: 'hidden',
                transition: 'border-color 0.15s',
              }}
            >
              {/* Header do colaborador */}
              <div
                style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  background: selectedColaborador?.id === col.id ? 'rgba(168,85,247,0.05)' : 'transparent',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #A855F7, #C084FC)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#0A0D0F', flexShrink: 0 }}>
                    {col.nome.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 700, color: '#F3F4F6', margin: 0 }}>{col.nome}</p>
                    <div style={{ display: 'flex', gap: 12, marginTop: 3 }}>
                      {col.contrato && <span style={{ fontSize: 11, color: '#6B7280' }}>Contrato: <strong style={{ color: '#9CA3AF' }}>{col.contrato}</strong></span>}
                      <span style={{ fontSize: 11, color: '#6B7280' }}>{col.total_subitens} EPIs cadastrados</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedColaborador(col);
                    setSelectedSubitem(null);
                    setCriarNovoSubitem(false);
                  }}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 7,
                    fontSize: 12, fontWeight: 600,
                    cursor: 'pointer',
                    background: selectedColaborador?.id === col.id ? 'rgba(168,85,247,0.18)' : 'rgba(255,255,255,0.05)',
                    border: selectedColaborador?.id === col.id ? '1px solid rgba(168,85,247,0.35)' : '1px solid rgba(255,255,255,0.10)',
                    color: selectedColaborador?.id === col.id ? '#C084FC' : '#9CA3AF',
                    transition: 'all 0.15s',
                  }}
                >
                  {selectedColaborador?.id === col.id ? '✓ Selecionado' : 'Selecionar'}
                </button>
              </div>

              {/* Subitens de CAUTELA existentes */}
              {selectedColaborador?.id === col.id && (
                <div style={{ padding: '16px 20px' }}>
                  <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#4B5563', marginBottom: 12 }}>
                    Subitens de Cautela Existentes
                  </p>

                  {col.subitens_cautela.length === 0 ? (
                    <div style={{ padding: '12px 16px', borderRadius: 9, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', fontSize: 12, color: '#4B5563', marginBottom: 12 }}>
                      Nenhum subitem de CAUTELA encontrado para este colaborador.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                      {col.subitens_cautela.map((sub) => (
                        <label
                          key={sub.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: '10px 14px',
                            borderRadius: 9,
                            cursor: 'pointer',
                            border: `1px solid ${selectedSubitem?.id === sub.id ? 'rgba(0,229,255,0.35)' : 'rgba(255,255,255,0.07)'}`,
                            background: selectedSubitem?.id === sub.id ? 'rgba(0,229,255,0.07)' : 'rgba(255,255,255,0.02)',
                            transition: 'all 0.15s',
                          }}
                        >
                          <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${selectedSubitem?.id === sub.id ? '#00E5FF' : '#374151'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {selectedSubitem?.id === sub.id && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00E5FF', boxShadow: '0 0 4px #00E5FF' }} />}
                          </div>
                          <input type="radio" name="subitem" value={sub.id} className="hidden" checked={selectedSubitem?.id === sub.id} onChange={() => { setSelectedSubitem(sub); setCriarNovoSubitem(false); }} style={{ display: 'none' }} />
                          <FileText size={14} color="#6B7280" />
                          <div style={{ flex: 1 }}>
                            <p style={{ fontSize: 13, fontWeight: 500, color: '#E5E7EB', margin: 0 }}>{sub.nome}</p>
                            <p style={{ fontSize: 11, color: '#4B5563', marginTop: 2 }}>Status: {sub.status}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}

                  {/* Opção de criar novo subitem */}
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 14px',
                      borderRadius: 9,
                      cursor: 'pointer',
                      border: `1px solid ${criarNovoSubitem ? 'rgba(0,230,118,0.35)' : 'rgba(255,255,255,0.07)'}`,
                      background: criarNovoSubitem ? 'rgba(0,230,118,0.07)' : 'rgba(255,255,255,0.02)',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${criarNovoSubitem ? '#00E676' : '#374151'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {criarNovoSubitem && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00E676', boxShadow: '0 0 4px #00E676' }} />}
                    </div>
                    <input type="radio" name="subitem" className="hidden" checked={criarNovoSubitem} onChange={() => { setCriarNovoSubitem(true); setSelectedSubitem(null); }} style={{ display: 'none' }} />
                    <Plus size={14} color="#00E676" />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: criarNovoSubitem ? '#A7F3D0' : '#9CA3AF', margin: 0 }}>Criar novo subitem de CAUTELA</p>
                      <p style={{ fontSize: 11, color: '#4B5563', marginTop: 2 }}>Cria um subitem vazio para então anexar o documento</p>
                    </div>
                  </label>

                  {/* Ações */}
                  <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                    {selectedSubitem && (
                      <button
                        onClick={handleProsseguirComSubitem}
                        style={{
                          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                          padding: '11px', borderRadius: 9,
                          background: 'linear-gradient(135deg, rgba(0,229,255,0.18), rgba(0,229,255,0.08))',
                          border: '1px solid rgba(0,229,255,0.35)',
                          color: '#00E5FF', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                          transition: 'box-shadow 0.2s',
                        }}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.boxShadow = '0 0 18px rgba(0,229,255,0.25)')}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.boxShadow = 'none')}
                      >
                        <Paperclip size={14} /> Anexar neste subitem <ChevronRight size={13} />
                      </button>
                    )}

                    {criarNovoSubitem && (
                      <button
                        onClick={() => criarSubitemMutation.mutate()}
                        disabled={criarSubitemMutation.isPending}
                        style={{
                          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                          padding: '11px', borderRadius: 9,
                          background: 'linear-gradient(135deg, rgba(0,230,118,0.18), rgba(0,230,118,0.08))',
                          border: '1px solid rgba(0,230,118,0.35)',
                          color: '#00E676', fontSize: 13, fontWeight: 600,
                          cursor: criarSubitemMutation.isPending ? 'not-allowed' : 'pointer',
                          opacity: criarSubitemMutation.isPending ? 0.7 : 1,
                        }}
                      >
                        {criarSubitemMutation.isPending ? <Loader2 size={14} className="spin" /> : <><Plus size={14} /> Criar e anexar</>}
                      </button>
                    )}
                  </div>

                  {/* Link para criar nova cautela completa */}
                  <button
                    onClick={() => navigate('/cautela/criar', { state: { cpf: cpfDisplay, colaborador: col } })}
                    style={{ marginTop: 14, fontSize: 12, color: '#4B5563', cursor: 'pointer', textDecoration: 'underline', background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: 5 }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#9CA3AF')}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '#4B5563')}
                  >
                    <FilePlus size={12} /> Criar nova cautela completa (novos EPIs)
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Estado inicial */}
      {!cpfSearch && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#374151' }}>
          <Search size={32} color="#1F2937" style={{ marginBottom: 10 }} />
          <p style={{ fontSize: 14, color: '#4B5563' }}>Digite o CPF acima para verificar o colaborador.</p>
        </div>
      )}
    </div>
  );
}

// ─── Sub-componentes ─────────────────────────────────────────

function ChoiceCard({ icon, color, border, bg, title, desc, onClick }: {
  icon: React.ReactNode; color: string; border: string; bg: string;
  title: string; desc: string; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 14,
        padding: '14px 16px', borderRadius: 10, width: '100%', textAlign: 'left',
        background: bg, border: `1px solid ${border}`,
        cursor: 'pointer', transition: 'box-shadow 0.2s',
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.boxShadow = `0 0 18px ${border}`)}
      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.boxShadow = 'none')}
    >
      <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color, margin: 0, marginBottom: 4 }}>{title}</p>
        <p style={{ fontSize: 12, color: '#6B7280', margin: 0, lineHeight: 1.5 }}>{desc}</p>
      </div>
      <ChevronRight size={16} color={color} style={{ flexShrink: 0, marginTop: 10 }} />
    </button>
  );
}
