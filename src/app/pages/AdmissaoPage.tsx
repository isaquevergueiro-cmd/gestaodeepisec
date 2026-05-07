import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, FileCheck, FileWarning, Loader2, RefreshCw, AlertCircle, Upload, X, CheckCircle2 } from 'lucide-react';
import { listarAS0Colaboradores, uploadCautela, extractErrorMessage, type ColaboradorAdmissional } from '../../api';
import { useToast } from '../contexts/ToastContext';
import { CriarCautelaModal } from './CriarCautelaModal';

// ─── Modal Anexar Cautela ─────────────────────────────────────
function ModalAnexar({ colab, onClose }: { colab: ColaboradorAdmissional; onClose: () => void }) {
  const { toastSuccess, toastError } = useToast();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ base64: string; nome: string } | null>(null);
  const [err, setErr] = useState('');

  function handleFile(f: File) {
    setErr('');
    if (f.size > 10 * 1024 * 1024) { setErr('Máx. 10 MB.'); return; }
    const r = new FileReader();
    r.onloadend = () => setFile({ base64: r.result as string, nome: f.name });
    r.readAsDataURL(f);
  }

  const mut = useMutation({
    mutationFn: () => uploadCautela(file!.base64, file!.nome, colab.id),
    onSuccess: () => {
      toastSuccess('Cautela anexada com sucesso!');
      qc.invalidateQueries({ queryKey: ['as0-colaboradores'] });
      onClose();
    },
    onError: (e) => toastError(extractErrorMessage(e)),
  });

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#111418', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, width: '100%', maxWidth: 480, padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#F3F4F6' }}>Anexar Cautela</p>
            <p style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{colab.nome}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4B5563' }}><X size={18} /></button>
        </div>

        {file ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: 10, background: 'rgba(0,230,118,0.07)', border: '1px solid rgba(0,230,118,0.25)', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <CheckCircle2 size={18} color="#00E676" />
              <span style={{ fontSize: 13, color: '#A7F3D0' }}>{file.nome}</span>
            </div>
            <button onClick={() => setFile(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4B5563' }}><X size={14} /></button>
          </div>
        ) : (
          <div onClick={() => inputRef.current?.click()} style={{ border: '2px dashed rgba(168,85,247,0.3)', borderRadius: 12, padding: '36px 24px', textAlign: 'center', cursor: 'pointer', marginBottom: 16, background: 'rgba(168,85,247,0.03)' }}>
            <Upload size={28} color="#A855F7" style={{ marginBottom: 8 }} />
            <p style={{ fontSize: 13, color: '#C084FC', fontWeight: 500 }}>Clique para selecionar o PDF</p>
            <p style={{ fontSize: 11, color: '#4B5563', marginTop: 4 }}>PDF · JPEG · PNG · máx. 10 MB</p>
          </div>
        )}
        {err && <p style={{ fontSize: 12, color: '#EF4444', marginBottom: 12 }}>{err}</p>}
        <input ref={inputRef} type="file" accept="application/pdf,image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px', borderRadius: 9, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', color: '#9CA3AF', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
          <button disabled={!file || mut.isPending} onClick={() => mut.mutate()} style={{ flex: 2, padding: '11px', borderRadius: 9, background: file ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.04)', border: file ? '1px solid rgba(168,85,247,0.4)' : '1px solid rgba(255,255,255,0.07)', color: file ? '#C084FC' : '#374151', fontSize: 13, fontWeight: 600, cursor: file ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {mut.isPending ? <Loader2 size={15} style={{ animation: 'spin 0.8s linear infinite' }} /> : <><Upload size={14} /> Enviar Cautela</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Row de Colaborador ───────────────────────────────────────
function ColabRow({ colab, onAnexar, onCriar }: { colab: ColaboradorAdmissional; onAnexar: () => void; onCriar: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: hov ? 'rgba(255,255,255,0.025)' : 'transparent', transition: 'background 0.12s' }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      <td style={{ padding: '12px 16px' }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#E5E7EB', margin: 0 }}>{colab.nome}</p>
        <p style={{ fontSize: 11, color: '#4B5563', fontFamily: 'monospace', margin: 0 }}>{colab.cpf || '—'}</p>
      </td>
      <td style={{ padding: '12px 12px', fontSize: 12, color: '#9CA3AF' }}>{colab.funcao || '—'}</td>
      <td style={{ padding: '12px 12px', fontSize: 12, color: '#9CA3AF' }}>{colab.orgao || '—'}</td>
      <td style={{ padding: '12px 12px', fontSize: 12, color: '#9CA3AF' }}>{colab.data_admissao || '—'}</td>
      <td style={{ padding: '12px 12px' }}>
        {colab.tem_cautela
          ? <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: 'rgba(0,230,118,0.10)', color: '#00E676', display: 'inline-flex', alignItems: 'center', gap: 5 }}><FileCheck size={11} /> Anexada</span>
          : <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: 'rgba(251,191,36,0.10)', color: '#FBBF24', display: 'inline-flex', alignItems: 'center', gap: 5 }}><FileWarning size={11} /> Pendente</span>
        }
      </td>
      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onAnexar} style={{ padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600, background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.25)', color: '#00E5FF', cursor: 'pointer' }}>
            Anexar PDF
          </button>
          <button onClick={onCriar} style={{ padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600, background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.25)', color: '#C084FC', cursor: 'pointer' }}>
            Criar Cautela
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Página ───────────────────────────────────────────────────
export function AdmissaoPage() {
  const [modalAnexar, setModalAnexar] = useState<ColaboradorAdmissional | null>(null);
  const [modalCriar, setModalCriar]   = useState<ColaboradorAdmissional | null>(null);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['as0-colaboradores'],
    queryFn: listarAS0Colaboradores,
    staleTime: 2 * 60 * 1000,
  });

  const colaboradores = data?.colaboradores ?? [];
  const stats = data?.stats;

  return (
    <div className="page-slide-up">
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <ClipboardList size={18} color="#A855F7" />
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#F3F4F6', letterSpacing: '-0.3px', margin: 0 }}>Admissão</h2>
          </div>
          <p style={{ fontSize: 13, color: '#4B5563' }}>Colaboradores do grupo Exames Admissionais (AS0) — Monday Esteira Admissional</p>
        </div>
        <button onClick={() => refetch()} disabled={isFetching} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, cursor: isFetching ? 'not-allowed' : 'pointer', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', color: '#6B7280', fontSize: 12, opacity: isFetching ? 0.6 : 1 }}>
          <RefreshCw size={13} style={{ animation: isFetching ? 'spin 0.8s linear infinite' : 'none' }} /> Atualizar
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Total', value: stats.total, color: '#A855F7' },
            { label: 'Com Cautela', value: stats.com_cautela, color: '#00E676' },
            { label: 'Sem Cautela', value: stats.sem_cautela, color: '#FBBF24' },
          ].map(s => (
            <div key={s.label} style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${s.color}22`, borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#F3F4F6' }}>{s.value}</div>
              <div style={{ fontSize: 11, color: '#6B7280' }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {isLoading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, gap: 12, color: '#4B5563' }}>
          <Loader2 size={22} style={{ animation: 'spin 0.8s linear infinite' }} />
          <span style={{ fontSize: 14 }}>Carregando colaboradores…</span>
        </div>
      )}

      {isError && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.20)', borderRadius: 12, padding: '20px 24px', display: 'flex', gap: 14 }}>
          <AlertCircle size={18} color="#EF4444" />
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#FCA5A5' }}>Erro ao carregar</p>
            <p style={{ fontSize: 13, color: '#6B7280' }}>{(error as Error)?.message}</p>
          </div>
        </div>
      )}

      {!isLoading && !isError && (
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
                  {['Colaborador', 'Função', 'Órgão', 'Admissão', 'Cautela', ''].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: h === '' ? 'right' : 'left', fontSize: 10, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: '#374151', ...(h === 'Colaborador' ? { paddingLeft: 16 } : {}) }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {colaboradores.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '60px 0', color: '#4B5563', fontSize: 14 }}>Nenhum colaborador no grupo AS0.</td></tr>
                ) : (
                  colaboradores.map(c => (
                    <ColabRow key={c.id} colab={c} onAnexar={() => setModalAnexar(c)} onCriar={() => setModalCriar(c)} />
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '10px 16px', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: '#374151' }}>{colaboradores.length} colaboradores</span>
            <span style={{ fontSize: 11, color: '#1F2937' }}>Grupo AS0 · group_mkvvydnn</span>
          </div>
        </div>
      )}

      {modalAnexar && <ModalAnexar colab={modalAnexar} onClose={() => setModalAnexar(null)} />}
      {modalCriar && <CriarCautelaModal colab={modalCriar} onClose={() => setModalCriar(null)} />}
    </div>
  );
}
