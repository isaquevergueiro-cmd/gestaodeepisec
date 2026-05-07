import { useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Check, Loader2, AlertCircle, ArrowLeftRight,
  Camera, X, FileText, Package, ChevronDown,
} from 'lucide-react';
import { extractErrorMessage } from '../../api';
import { useToast } from '../contexts/ToastContext';
import type { EpiSubitemGestao, ColaboradorGestao } from '../../api';

// ── Tipos ─────────────────────────────────────────────────────────────────────

type Motivo = 'Troca Anual' | 'Desgaste Natural' | 'Avaria por Acidente';

interface LocationState { epi: EpiSubitemGestao; colaborador: ColaboradorGestao; }

const MOTIVOS = [
  {
    value: 'Troca Anual' as Motivo,
    label: 'Troca Anual',
    desc: 'Substituição por prazo de uso encerrado conforme política da empresa.',
    color: '#00E5FF', border: 'rgba(0,229,255,0.30)', bg: 'rgba(0,229,255,0.08)',
  },
  {
    value: 'Desgaste Natural' as Motivo,
    label: 'Desgaste Natural',
    desc: 'Item desgastado por uso normal em campo.',
    color: '#F59E0B', border: 'rgba(245,158,11,0.30)', bg: 'rgba(245,158,11,0.08)',
  },
  {
    value: 'Avaria por Acidente' as Motivo,
    label: 'Avaria por Acidente',
    desc: 'Item danificado em acidente ou incidente de trabalho.',
    color: '#EF4444', border: 'rgba(239,68,68,0.30)', bg: 'rgba(239,68,68,0.08)',
  },
] as const;

const TAMANHOS = ['P','M','G','GG','XG','36','37','38','39','40','41','42','43','44'];
const MAX_BYTES = 4 * 1024 * 1024;

// ── Helpers ───────────────────────────────────────────────────────────────────

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ fontSize:10, fontWeight:700, letterSpacing:'1px', textTransform:'uppercase',
        color:'#4B5563', marginBottom:10 }}>
        {label}{required && <span style={{ color:'#EF4444', marginLeft:3 }}>*</span>}
      </p>
      {children}
    </div>
  );
}
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background:'rgba(36,40,45,0.90)', border:'1px solid rgba(255,255,255,0.08)',
      borderRadius:16, padding:22, marginBottom:16 }}>
      {children}
    </div>
  );
}

// ── Componente de Foto ────────────────────────────────────────────────────────

function FotoUpload({ foto, fileErr, onFile, onRemove, accentColor = '#A855F7' }: {
  foto: { base64: string; name: string } | null;
  fileErr: string;
  onFile: (f: File) => void;
  onRemove: () => void;
  accentColor?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      {foto ? (
        <div style={{ position:'relative', borderRadius:10, overflow:'hidden',
          border:`1px solid ${accentColor}30` }}>
          <img src={foto.base64} alt="Evidência"
            style={{ width:'100%', maxHeight:200, objectFit:'cover', display:'block' }} />
          <button onClick={onRemove}
            style={{ position:'absolute', top:8, right:8, display:'flex', alignItems:'center', gap:4,
              padding:'4px 10px', borderRadius:7, background:'rgba(239,68,68,0.85)',
              border:'none', color:'#fff', fontSize:12, cursor:'pointer' }}>
            <X size={12} /> Remover
          </button>
        </div>
      ) : (
        <div onClick={() => ref.current?.click()}
          style={{ border:`2px dashed ${fileErr ? 'rgba(239,68,68,0.5)' : `${accentColor}30`}`,
            borderRadius:10, padding:'20px', display:'flex', flexDirection:'column',
            alignItems:'center', gap:8, cursor:'pointer',
            background: fileErr ? 'rgba(239,68,68,0.04)' : `${accentColor}06` }}>
          <Camera size={22} color={accentColor} />
          <p style={{ fontSize:13, color:'#6B7280', margin:0, textAlign:'center' }}>
            Fotografe o item a ser trocado<br/>
            <span style={{ fontSize:11, color:'#374151' }}>Obrigatório · máx. 4 MB</span>
          </p>
        </div>
      )}
      {fileErr && (
        <p style={{ marginTop:6, fontSize:12, color:'#EF4444', display:'flex', alignItems:'center', gap:4 }}>
          <AlertCircle size={11} /> {fileErr}
        </p>
      )}
      <input ref={ref} type="file" accept="image/*" capture="environment"
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value=''; }}
        style={{ display:'none' }} />
    </div>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────

export function TrocaPage() {
  const { state } = useLocation() as { state?: LocationState };
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toastSuccess, toastError } = useToast();

  const [motivo, setMotivo] = useState<Motivo | null>(null);
  const [justificativa, setJustificativa] = useState('');
  const [novoTamanho, setNovoTamanho] = useState<string>('');
  const [tamanhoOpen, setTamanhoOpen] = useState(false);
  const [foto, setFoto] = useState<{ base64: string; name: string } | null>(null);
  const [fileErr, setFileErr] = useState('');

  const epi = state?.epi;
  const colab = state?.colaborador;

  if (!epi || !colab) {
    return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center',
        justifyContent:'center', height:'50vh', gap:12 }}>
        <AlertCircle size={32} color="#374151" />
        <p style={{ fontSize:14, color:'#4B5563' }}>Nenhum EPI selecionado.</p>
        <button onClick={() => navigate('/gestao')}
          style={{ fontSize:13, color:'#00E5FF', cursor:'pointer', background:'none',
            border:'none', textDecoration:'underline' }}>
          Voltar à Gestão
        </button>
      </div>
    );
  }

  const opt = MOTIVOS.find(m => m.value === motivo);
  const accentColor = opt?.color ?? '#A855F7';
  // Tamanho efetivo: se não selecionou nada, usa o mesmo do EPI
  const tamanhoEfetivo = novoTamanho || epi.tamanho;
  const canSubmit = !!motivo && !!foto;

  // Cor do badge de status do EPI no card-resumo — alinhada à paleta global.
  const statusBadge = (function() {
    if (epi.status === 'Aguardando Devolução') return { c: '#FF7575', bg: 'rgba(255,117,117,0.12)' };
    if (epi.status === 'Não Devolvido')         return { c: '#E2445C', bg: 'rgba(226,68,92,0.12)' };
    if (epi.status === 'Pendente de Receber')   return { c: '#FDAB3D', bg: 'rgba(253,171,61,0.12)' };
    return { c: '#00E676', bg: 'rgba(0,230,118,0.12)' };
  })();

  function handleFile(file: File) {
    setFileErr('');
    if (!file.type.startsWith('image/')) { setFileErr('Apenas imagens (JPEG, PNG, WebP).'); return; }
    if (file.size > MAX_BYTES) { setFileErr('Máximo 4 MB.'); return; }
    const r = new FileReader();
    r.onloadend = () => setFoto({ base64: r.result as string, name: file.name });
    r.readAsDataURL(file);
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const { apiClient } = await import('../../api');
      await apiClient.patch(`/epi/${epi.id}/trocar`, {
        motivo: justificativa || motivo,
        foto: foto?.base64,
        novoTamanho: tamanhoEfetivo !== '-' ? tamanhoEfetivo : undefined,
        colaborador_item_id: colab.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gestao-epis'] });
      toastSuccess(`Troca de "${epi.nome}" registrada! Um novo item "Pendente de Receber" foi criado.`);
      navigate('/gestao', { replace: true });
    },
    onError: (err) => toastError(`Falha: ${extractErrorMessage(err)}`),
  });

  return (
    <div className="page-slide-up" style={{ maxWidth:640, margin:'0 auto' }}>

      {/* Voltar */}
      <button onClick={() => navigate(-1)}
        style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'#4B5563',
          marginBottom:20, padding:'4px 0', cursor:'pointer', background:'none', border:'none' }}>
        <ArrowLeft size={14} /> Voltar
      </button>

      {/* Título */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
        <div style={{ width:42, height:42, borderRadius:10, background:'rgba(168,85,247,0.12)',
          border:'1px solid rgba(168,85,247,0.25)', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <ArrowLeftRight size={20} color="#A855F7" />
        </div>
        <div>
          <h2 style={{ fontSize:18, fontWeight:700, color:'#F3F4F6', margin:0 }}>Registrar Troca</h2>
          <p style={{ fontSize:12, color:'#4B5563', margin:0 }}>
            {colab.nome} · <span style={{ color:'#374151' }}>Registra a saída e cria novo item para entrega</span>
          </p>
        </div>
      </div>

      {/* EPI atual */}
      <Card>
        <p style={{ fontSize:10, fontWeight:700, letterSpacing:'1px', textTransform:'uppercase',
          color:'#4B5563', marginBottom:8 }}>EPI Original (Imutável)</p>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <h3 style={{ fontSize:16, fontWeight:700, color:'#F3F4F6', margin:0 }}>{epi.nome}</h3>
            <div style={{ display:'flex', gap:8, marginTop:6 }}>
              {epi.tamanho !== '-' && (
                <span style={{ fontSize:11, color:'#9CA3AF', background:'rgba(255,255,255,0.06)',
                  padding:'2px 8px', borderRadius:4 }}>{epi.tamanho}</span>
              )}
              <span style={{ fontSize:11, color:'#6B7280' }}>Qtd: {epi.quantidade || '1'}</span>
            </div>
          </div>
          <span style={{ fontSize:11, padding:'3px 10px', borderRadius:20, fontWeight:700,
            background: statusBadge.bg, color: statusBadge.c }}>{epi.status}</span>
        </div>
        {/* Nota de fluxo */}
        <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:14, padding:'10px 12px',
          borderRadius:8, background:'rgba(168,85,247,0.05)', border:'1px solid rgba(168,85,247,0.12)' }}>
          <Package size={13} color="#A855F7" style={{ flexShrink:0 }} />
          <span style={{ fontSize:11, color:'#A855F7', lineHeight:1.5 }}>
            O item atual será registrado como descarte/avaria e um novo item
            <strong> "{epi.nome}"</strong> será criado como <strong>Pendente de Receber</strong>.
          </span>
        </div>
      </Card>

      {/* Motivo */}
      <Card>
        <Field label="Motivo da Troca" required>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {MOTIVOS.map(m => {
              const sel = motivo === m.value;
              return (
                <label key={m.value} style={{ display:'flex', alignItems:'flex-start', gap:14,
                  padding:'12px 16px', borderRadius:10, cursor:'pointer', transition:'all 0.15s',
                  border:`1px solid ${sel ? m.border : 'rgba(255,255,255,0.07)'}`,
                  background: sel ? m.bg : 'rgba(255,255,255,0.02)',
                  boxShadow: sel ? `0 0 12px ${m.border}` : 'none' }}>
                  <div style={{ width:16, height:16, borderRadius:'50%', marginTop:2, flexShrink:0,
                    border:`2px solid ${sel ? m.color : '#374151'}`,
                    display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {sel && <div style={{ width:7, height:7, borderRadius:'50%', background:m.color }} />}
                  </div>
                  <input type="radio" name="motivo" value={m.value} checked={sel}
                    onChange={() => { setMotivo(m.value); setFoto(null); setFileErr(''); }}
                    style={{ display:'none' }} />
                  <div>
                    <p style={{ fontSize:13, fontWeight:600, color:sel ? m.color : '#E5E7EB', margin:'0 0 3px' }}>
                      {m.label}
                    </p>
                    <p style={{ fontSize:12, color:'#6B7280', margin:0 }}>{m.desc}</p>
                  </div>
                </label>
              );
            })}
          </div>
        </Field>
      </Card>

      {/* Foto — obrigatória para TODOS */}
      <Card>
        <Field label="Foto do Item" required>
          <FotoUpload foto={foto} fileErr={fileErr} onFile={handleFile}
            onRemove={() => setFoto(null)} accentColor={accentColor} />
        </Field>
      </Card>

      {/* Tamanho — accordion colapsável com "Mesmo tamanho" pré-selecionado */}
      <Card>
        <button
          type="button"
          onClick={() => setTamanhoOpen(p => !p)}
          style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
            background:'none', border:'none', cursor:'pointer', padding:0 }}>
          <div>
            <p style={{ fontSize:10, fontWeight:700, letterSpacing:'1px', textTransform:'uppercase',
              color:'#4B5563', margin:0 }}>Tamanho do Item Novo</p>
            <p style={{ fontSize:12, color: novoTamanho ? '#A855F7' : '#6B7280', margin:'4px 0 0' }}>
              {novoTamanho ? `Selecionado: ${novoTamanho}` : `Mesmo tamanho (${epi.tamanho !== '-' ? epi.tamanho : 'Único'})`}
            </p>
          </div>
          <ChevronDown size={16} color="#4B5563"
            style={{ transform: tamanhoOpen ? 'rotate(180deg)' : 'rotate(0)', transition:'transform 0.2s' }} />
        </button>

        {tamanhoOpen && (
          <div style={{ marginTop:14, paddingTop:14, borderTop:'1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 }}>
              {/* Opção "Mesmo tamanho" */}
              <button type="button"
                onClick={() => setNovoTamanho('')}
                style={{ padding:'5px 12px', borderRadius:8, fontSize:12, cursor:'pointer',
                  fontWeight: !novoTamanho ? 700 : 500,
                  background: !novoTamanho ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.04)',
                  border: !novoTamanho ? '1px solid rgba(168,85,247,0.40)' : '1px solid rgba(255,255,255,0.08)',
                  color: !novoTamanho ? '#A855F7' : '#6B7280' }}>
                Mesmo tamanho
              </button>
              {TAMANHOS.map(t => (
                <button key={t} type="button"
                  onClick={() => setNovoTamanho(t)}
                  style={{ padding:'5px 12px', borderRadius:8, fontSize:12, cursor:'pointer',
                    fontWeight: novoTamanho === t ? 700 : 500,
                    background: novoTamanho === t ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.04)',
                    border: novoTamanho === t ? '1px solid rgba(168,85,247,0.40)' : '1px solid rgba(255,255,255,0.08)',
                    color: novoTamanho === t ? '#A855F7' : '#6B7280' }}>
                  {t}
                </button>
              ))}
            </div>
            <p style={{ fontSize:11, color:'#374151', margin:0 }}>
              Tamanho que será atribuído ao novo item Pendente de Receber.
            </p>
          </div>
        )}
      </Card>

      {/* Justificativa */}
      <Card>
        <Field label="Justificativa / Observação">
          <div style={{ display:'flex', alignItems:'flex-start', gap:8, background:'rgba(255,255,255,0.04)',
            border:'1px solid rgba(255,255,255,0.10)', borderRadius:8, padding:'10px 12px' }}>
            <FileText size={13} color="#4B5563" style={{ marginTop:2, flexShrink:0 }} />
            <textarea value={justificativa} onChange={e => setJustificativa(e.target.value)}
              placeholder="Descreva o motivo com mais detalhes…" rows={3}
              style={{ flex:1, background:'none', border:'none', outline:'none', resize:'vertical',
                color:'#F3F4F6', fontSize:13, fontFamily:'inherit', lineHeight:1.5 }} />
          </div>
        </Field>
      </Card>

      {/* Botões */}
      <div style={{ display:'flex', gap:10 }}>
        <button type="button" onClick={() => navigate(-1)} disabled={mutation.isPending}
          style={{ flex:1, padding:13, borderRadius:10, background:'rgba(255,255,255,0.04)',
            border:'1px solid rgba(255,255,255,0.09)', color:'#9CA3AF', fontSize:14,
            fontWeight:500, cursor:'pointer' }}>
          Cancelar
        </button>
        <button type="button" onClick={() => mutation.mutate()} disabled={!canSubmit || mutation.isPending}
          style={{ flex:2, display:'flex', alignItems:'center', justifyContent:'center', gap:8,
            padding:13, borderRadius:10, fontSize:14, fontWeight:600,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            background: canSubmit ? `${accentColor}18` : 'rgba(255,255,255,0.04)',
            border: canSubmit ? `1px solid ${accentColor}40` : '1px solid rgba(255,255,255,0.07)',
            color: canSubmit ? accentColor : '#374151' }}>
          {mutation.isPending
            ? <Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} />
            : <><Check size={16} /> Confirmar Troca</>}
        </button>
      </div>
    </div>
  );
}
