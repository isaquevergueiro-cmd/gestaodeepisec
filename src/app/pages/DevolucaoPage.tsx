import React, { useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Check, Loader2, AlertCircle, PackageMinus,
  Camera, X, FileText, Calendar, Clock, AlertTriangle, CheckCheck,
} from 'lucide-react';

const MIN_MOTIVO_LEN = 10;
import { extractErrorMessage } from '../../api';
import { useToast } from '../contexts/ToastContext';
import type { EpiSubitemGestao, ColaboradorGestao } from '../../api';

// ── Tipos ─────────────────────────────────────────────────────────────────────

type Destino = 'Reaproveitável' | 'Descarte/Dano' | 'Não Devolvido';
type MotivoAcao = 'Demissão' | 'Troca / Desgaste' | 'A Definir';

interface LocationState {
  epi: EpiSubitemGestao;
  colaborador: ColaboradorGestao;
  isUpdate?: boolean;
  eventId?: string;
}

const DESTINOS_NORMAL = [
  {
    value: 'Reaproveitável' as Destino,
    label: 'Reaproveitável',
    desc: 'Item em bom estado. Vai para o Estoque 3 para reutilização.',
    color: '#00E676', border: 'rgba(0,230,118,0.35)', bg: 'rgba(0,230,118,0.08)',
  },
  {
    value: 'Descarte/Dano' as Destino,
    label: 'Descarte / Dano',
    desc: 'Item danificado, vencido ou inutilizável.',
    color: '#F59E0B', border: 'rgba(245,158,11,0.35)', bg: 'rgba(245,158,11,0.08)',
  },
  {
    value: 'Não Devolvido' as Destino,
    label: 'Não Devolvido',
    desc: 'Colaborador não apresentou o item. Prazo de 3 dias úteis será iniciado.',
    color: '#EF4444', border: 'rgba(239,68,68,0.35)', bg: 'rgba(239,68,68,0.08)',
  },
] as const;

// Na tela de concluir (isUpdate), "Não Devolvido" não é opção — o item já está marcado como tal.
const DESTINOS_CONCLUSAO = DESTINOS_NORMAL.filter(d => d.value !== 'Não Devolvido');

const MOTIVOS: MotivoAcao[] = ['Demissão', 'Troca / Desgaste', 'A Definir'];
const MAX_BYTES = 4 * 1024 * 1024;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Calcula +N dias úteis a partir de hoje (pula sábado e domingo) */
function addBusinessDays(days: number): Date {
  let d = new Date();
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function toIso(d: Date): string {
  return d.toISOString().split('T')[0];
}

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

// ── Painel Regra 3 Dias Úteis ──────────────────────────────────────────────────

function Regra3DiasPanel({ confirmado, onChange }: { confirmado: boolean; onChange:(v:boolean)=>void }) {
  const prazo = addBusinessDays(3);
  return (
    <div style={{ background:'rgba(239,68,68,0.07)', border:'1px solid rgba(239,68,68,0.25)',
      borderRadius:12, padding:'16px 18px', marginBottom:16 }}>
      <div style={{ display:'flex', gap:10, marginBottom:12 }}>
        <AlertTriangle size={18} color="#EF4444" style={{ flexShrink:0, marginTop:1 }} />
        <div>
          <p style={{ fontSize:13, color:'#FCA5A5', fontWeight:700, marginBottom:4 }}>
            Regra dos 3 Dias Úteis
          </p>
          <p style={{ fontSize:12, color:'#F87171', lineHeight:1.6, marginBottom:8 }}>
            O colaborador terá até <strong>{fmtDate(prazo)}</strong> ({3} dias úteis) para apresentar o item.
            Enquanto isso, o EPI ficará como <strong>"Não Devolvido"</strong> e poderá ser desmarcado
            dentro do prazo caso o colaborador apareça. Após o prazo, o valor poderá ser{' '}
            <strong>descontado em folha</strong> conforme art. 462 da CLT.
          </p>
          <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11,
            color:'#9CA3AF', background:'rgba(0,0,0,0.2)', padding:'6px 10px', borderRadius:6 }}>
            <Calendar size={11} color="#EF4444" />
            Prazo final: <strong style={{ color:'#FCA5A5' }}>{fmtDate(prazo)}</strong>
            <span style={{ color:'#374151', marginLeft:4 }}>· Data limite gerada automaticamente</span>
          </div>
        </div>
      </div>
      <label style={{ display:'flex', alignItems:'flex-start', gap:8, cursor:'pointer' }}>
        <input type="checkbox" checked={confirmado} onChange={e => onChange(e.target.checked)}
          style={{ width:14, height:14, accentColor:'#EF4444', cursor:'pointer', marginTop:2, flexShrink:0 }} />
        <span style={{ fontSize:12, color:'#FCA5A5', fontWeight:500, lineHeight:1.5 }}>
          Entendo que o prazo de 3 dias úteis será iniciado. O colaborador pode aparecer dentro do prazo
          e o registro será desmarcado.
        </span>
      </label>
    </div>
  );
}

// ── Painel info de conclusão (isUpdate) ───────────────────────────────────────

function InfoConclusaoPanel({ epi }: { epi: EpiSubitemGestao }) {
  const fmtBR = (iso: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : d.toLocaleDateString('pt-BR');
  };

  const hoje = new Date();
  const limite = epi.data_limite ? new Date(epi.data_limite) : null;
  let diasInfo = '';
  if (limite) {
    limite.setHours(0,0,0,0);
    hoje.setHours(0,0,0,0);
    const diff = Math.round((limite.getTime() - hoje.getTime()) / (1000*60*60*24));
    diasInfo = diff >= 0 ? `${diff} dia(s) restante(s)` : `Vencido há ${Math.abs(diff)} dia(s)`;
  }

  return (
    <div style={{ background:'rgba(249,115,22,0.07)', border:'1px solid rgba(249,115,22,0.25)',
      borderRadius:12, padding:'14px 16px', marginBottom:16 }}>
      <div style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
        <Clock size={16} color="#F97316" style={{ flexShrink:0, marginTop:2 }} />
        <div>
          <p style={{ fontSize:13, color:'#FDB97D', fontWeight:700, marginBottom:4 }}>
            Concluindo devolução pendente
          </p>
          <p style={{ fontSize:12, color:'#F97316', lineHeight:1.5 }}>
            O colaborador compareceu para devolver o item marcado como <strong>Não Devolvido</strong>.
            Selecione o destino final do EPI.
          </p>
          {epi.data_limite && (
            <div style={{ marginTop:8, fontSize:11, color:'#9CA3AF' }}>
              Prazo era: <strong style={{ color: diasInfo.includes('Vencido') ? '#EF4444' : '#FBBF24' }}>
                {fmtBR(epi.data_limite)} ({diasInfo})
              </strong>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Upload de Foto ────────────────────────────────────────────────────────────

function FotoUpload({ foto, fileErr, onFile, onRemove }: {
  foto: { base64: string; name: string } | null;
  fileErr: string;
  onFile: (f: File) => void;
  onRemove: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const dropBorder = fileErr ? 'rgba(239,68,68,0.5)' : 'rgba(0,229,255,0.20)';
  const dropBg = fileErr ? 'rgba(239,68,68,0.04)' : 'rgba(0,229,255,0.03)';
  const dropStyle: React.CSSProperties = {
    border: `2px dashed ${dropBorder}`,
    borderRadius: 10, padding: '20px', display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: 8, cursor: 'pointer', background: dropBg,
  };
  return (
    <div>
      {foto ? (
        <div style={{ position:'relative', borderRadius:10, overflow:'hidden',
          border:'1px solid rgba(0,229,255,0.25)' }}>
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
        <div onClick={() => ref.current?.click()} style={dropStyle}>
          <Camera size={22} color="#00E5FF" />
          <p style={{ fontSize:13, color:'#6B7280', margin:0, textAlign:'center' }}>
            Fotografe o item devolvido<br/>
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

export function DevolucaoPage() {
  const { state } = useLocation() as { state?: LocationState };
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toastSuccess, toastError } = useToast();

  const [destino, setDestino] = useState<Destino | null>(null);
  const [motivo, setMotivo] = useState<MotivoAcao>('A Definir');
  const [dataDevolucao, setDataDevolucao] = useState('');
  const [justificativa, setJustificativa] = useState('');
  const [foto, setFoto] = useState<{ base64: string; name: string } | null>(null);
  const [fileErr, setFileErr] = useState('');
  const [confirmRisk, setConfirmRisk] = useState(false);

  const epi = state?.epi;
  const colab = state?.colaborador;
  const isUpdate = state?.isUpdate;
  const eventId = state?.eventId;

  if (!epi || !colab) {
    const linkStyle: React.CSSProperties = {
      fontSize: 13, color: '#00E5FF', cursor: 'pointer',
      background: 'none', border: 'none', textDecoration: 'underline',
    };
    return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center',
        justifyContent:'center', height:'50vh', gap:12 }}>
        <AlertCircle size={32} color="#374151" />
        <p style={{ fontSize:14, color:'#4B5563' }}>Nenhum EPI selecionado.</p>
        <button onClick={() => navigate('/gestao')} style={linkStyle}>
          Voltar à Gestão
        </button>
      </div>
    );
  }

  const validDestinos = isUpdate ? DESTINOS_CONCLUSAO : DESTINOS_NORMAL;
  const opt = validDestinos.find(d => d.value === destino);
  const isNaoDevolvido = destino === 'Não Devolvido';

  // Para "Não Devolvido": foto não é obrigatória (não há item para fotografar)
  // mas o checkbox de confirmação é obrigatório, assim como o motivo específico (CLT art. 462).
  const fotoObrigatoria = !isNaoDevolvido;
  const motivoTrim = justificativa.trim();
  const motivoValido = motivoTrim.length >= MIN_MOTIVO_LEN;
  const canSubmit = !!destino && !!dataDevolucao
    && (!fotoObrigatoria || !!foto)
    && (!isNaoDevolvido || (confirmRisk && motivoValido));

  // Cor do badge de status do EPI no card-resumo — alinhada à paleta global.
  const statusBadge = (function() {
    if (epi.status === 'Aguardando Devolução') return { c: '#FF7575', bg: 'rgba(255,117,117,0.12)' };
    if (epi.status === 'Não Devolvido')         return { c: '#E2445C', bg: 'rgba(226,68,92,0.12)' };
    if (epi.status === 'Pendente de Receber')   return { c: '#FDAB3D', bg: 'rgba(253,171,61,0.12)' };
    return { c: '#00E676', bg: 'rgba(0,230,118,0.12)' };
  })();

  // Data máxima do input date (hoje, ISO yyyy-mm-dd) — bloqueia datas futuras
  const hojeIso = new Date().toISOString().split('T')[0];

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

      if (isUpdate && eventId) {
        // Conclui o evento [DEV] existente
        await apiClient.patch(`/epi/${eventId}/concluir-devolucao`, {
          status: destino,
          foto: foto?.base64,
          data_devolucao: dataDevolucao || undefined,
          motivo_acao: motivo !== 'A Definir' ? motivo : undefined,
          colaborador_item_id: colab.id,
        });
      } else {
        // Cria novo evento [DEV] — calcula data_limite automaticamente se Não Devolvido
        const prazo = isNaoDevolvido ? addBusinessDays(3) : null;
        await apiClient.patch(`/epi/${epi.id}/devolver`, {
          status: destino,
          foto: foto?.base64,
          justificativa: isNaoDevolvido && justificativa ? justificativa : undefined,
          data_devolucao: dataDevolucao || undefined,
          data_limite: prazo ? toIso(prazo) : undefined,
          motivo_acao: motivo !== 'A Definir' ? motivo : undefined,
          colaborador_item_id: colab.id,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gestao-epis'] });
      if (isUpdate) {
        toastSuccess(`Devolução de "${epi.nome}" concluída com sucesso!`);
      } else if (isNaoDevolvido) {
        const prazo = addBusinessDays(3);
        toastSuccess(`"${epi.nome}" marcado como Não Devolvido. Prazo: ${fmtDate(prazo)}.`);
      } else {
        toastSuccess(`Devolução de "${epi.nome}" registrada com sucesso!`);
      }
      navigate('/gestao', { replace: true });
    },
    onError: (err) => toastError(`Falha: ${extractErrorMessage(err)}`),
  });

  const tituloPage = isUpdate ? 'Concluir Devolução' : 'Registrar Devolução';
  const subtituloPage = isUpdate
    ? 'Colaborador compareceu — selecione o destino final do EPI'
    : 'Registre a saída do EPI do colaborador';

  const btnLabelText = isNaoDevolvido
    ? 'Marcar como Não Devolvido'
    : isUpdate
    ? 'Concluir Devolução'
    : 'Confirmar Devolução';
  const BtnIcon = isNaoDevolvido ? AlertTriangle : Check;

  const voltarBtnStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#4B5563',
    marginBottom: 20, padding: '4px 0', cursor: 'pointer', background: 'none', border: 'none',
  };

  const cancelBtnStyle: React.CSSProperties = {
    flex: 1,
    padding: 13,
    borderRadius: 10,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.09)',
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
  };

  const activeBg     = canSubmit && opt ? opt.bg      : 'rgba(255,255,255,0.04)';
  const activeBorder = canSubmit && opt ? ('1px solid ' + opt.border) : '1px solid rgba(255,255,255,0.07)';
  const activeColor  = canSubmit && opt ? opt.color   : '#374151';
  const activeCursor = canSubmit ? 'pointer' : 'not-allowed';
  const btnStyle: React.CSSProperties = {
    flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: 8, padding: 13, borderRadius: 10, fontSize: 14, fontWeight: 600,
    cursor: activeCursor, background: activeBg, border: activeBorder, color: activeColor,
  };

  return (
    <div className="page-slide-up" style={{ maxWidth:640, margin:'0 auto' }}>

      {/* Voltar */}
      <button onClick={() => navigate(-1)} style={voltarBtnStyle}>
        <ArrowLeft size={14} /> Voltar
      </button>

      {/* Título */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
        <div style={{ width:42, height:42, borderRadius:10,
          background: 'rgba(249,115,22,0.12)',
          border: '1px solid rgba(249,115,22,0.25)',
          display:'flex', alignItems:'center', justifyContent:'center' }}>
          {isUpdate ? <CheckCheck size={20} color="#F97316" /> : <PackageMinus size={20} color="#F97316" />}
        </div>
        <div>
          <h2 style={{ fontSize:18, fontWeight:700, color:'#F3F4F6', margin:0 }}>{tituloPage}</h2>
          <p style={{ fontSize:12, color:'#4B5563', margin:0 }}>{colab.nome} · {subtituloPage}</p>
        </div>
      </div>

      {/* Info panel — apenas na conclusão */}
      {isUpdate && <InfoConclusaoPanel epi={epi} />}

      {/* Card EPI */}
      <Card>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
          <div>
            <p style={{ fontSize:10, fontWeight:700, letterSpacing:'1px', textTransform:'uppercase',
              color:'#4B5563', marginBottom:4 }}>EPI</p>
            <h3 style={{ fontSize:16, fontWeight:700, color:'#F3F4F6', margin:0 }}>{epi.nome}</h3>
            <div style={{ display:'flex', gap:8, marginTop:6, flexWrap:'wrap' }}>
              {epi.tamanho !== '-' && (
                <span style={{ fontSize:11, color:'#9CA3AF', background:'rgba(255,255,255,0.06)',
                  padding:'2px 8px', borderRadius:4 }}>Tam: {epi.tamanho}</span>
              )}
              <span style={{ fontSize:11, color:'#6B7280' }}>Qtd: {epi.quantidade || '1'}</span>
              {epi.data_entrega && (
                <span style={{ fontSize:11, color:'#4B5563' }}>
                  Entregue em: {new Date(epi.data_entrega).toLocaleDateString('pt-BR')}
                </span>
              )}
            </div>
          </div>
          <span style={{ fontSize:10, padding:'3px 10px', borderRadius:20, fontWeight:700,
            background: statusBadge.bg, color: statusBadge.c, whiteSpace:'nowrap' }}>
            {epi.status}
          </span>
        </div>
      </Card>

      {/* Destino */}
      <Card>
        <Field label="Destino do Item" required>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {validDestinos.map(d => {
              const sel = destino === d.value;
              const labelBorder = sel ? ('1px solid ' + d.border) : '1px solid rgba(255,255,255,0.07)';
              const labelBg     = sel ? d.bg  : 'rgba(255,255,255,0.02)';
              const labelShadow = sel ? ('0 0 14px ' + d.border) : 'none';
              const dotBorder   = sel ? ('2px solid ' + d.color) : '2px solid #374151';
              const labelStyle: React.CSSProperties = {
                display: 'flex', alignItems: 'flex-start', gap: 14,
                padding: '12px 16px', borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s',
                border: labelBorder, background: labelBg, boxShadow: labelShadow,
              };
              const dotStyle: React.CSSProperties = {
                width: 16, height: 16, borderRadius: '50%', marginTop: 2, flexShrink: 0,
                border: dotBorder, display: 'flex', alignItems: 'center', justifyContent: 'center',
              };
              const textColor = sel ? d.color : '#E5E7EB';
              return (
                <label key={d.value} style={labelStyle}>
                  <div style={dotStyle}>
                    {sel && <div style={{ width:7, height:7, borderRadius:'50%', background:d.color }} />}
                  </div>
                  <input type="radio" name="destino" value={d.value} checked={sel}
                    onChange={() => { setDestino(d.value); setFoto(null); setFileErr(''); setConfirmRisk(false); }}
                    style={{ display:'none' }} />
                  <div>
                    <p style={{ fontSize:13, fontWeight:600, color:textColor, margin:'0 0 3px' }}>
                      {d.label}
                    </p>
                    <p style={{ fontSize:12, color:'#6B7280', margin:0 }}>{d.desc}</p>
                  </div>
                </label>
              );
            })}
          </div>
        </Field>
      </Card>

      {/* Regra 3 dias úteis — apenas para Não Devolvido */}
      {isNaoDevolvido && (
        <Regra3DiasPanel confirmado={confirmRisk} onChange={setConfirmRisk} />
      )}

      {/* Foto — obrigatória exceto para Não Devolvido */}
      <Card>
        <Field label="Foto do Item" required={fotoObrigatoria}>
          {isNaoDevolvido ? (
            <p style={{ fontSize:12, color:'#4B5563', fontStyle:'italic', margin:0 }}>
              Foto não necessária — item não foi apresentado. Poderá ser adicionada ao concluir a devolução.
            </p>
          ) : (
            <FotoUpload foto={foto} fileErr={fileErr} onFile={handleFile} onRemove={() => setFoto(null)} />
          )}
        </Field>
      </Card>

      {/* Data + Motivo */}
      <Card>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <Field label="Data da Ocorrência" required>
            <div style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(255,255,255,0.04)',
              border:'1px solid rgba(255,255,255,0.10)', borderRadius:8, padding:'0 12px' }}>
              <Calendar size={13} color="#4B5563" />
              <input type="date" value={dataDevolucao} max={hojeIso}
                onChange={e => setDataDevolucao(e.target.value)}
                style={{ flex:1, background:'none', border:'none', outline:'none',
                  color:'#F3F4F6', fontSize:13, padding:'10px 0', fontFamily:'inherit', colorScheme:'dark' }} />
            </div>
          </Field>
          <Field label="Motivo da Ação">
            <select value={motivo} onChange={e => setMotivo(e.target.value as MotivoAcao)}
              style={{ width:'100%', background:'rgba(255,255,255,0.04)',
                border:'1px solid rgba(255,255,255,0.10)', borderRadius:8,
                color:'#F3F4F6', fontSize:13, padding:'10px 12px', fontFamily:'inherit',
                outline:'none', cursor:'pointer', colorScheme:'dark' }}>
              {MOTIVOS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
        </div>
      </Card>

      {/* Motivo específico — obrigatório quando Não Devolvido (CLT art. 462) */}
      {isNaoDevolvido && (() => {
        const tooShort = motivoTrim.length > 0 && !motivoValido;
        const empty    = motivoTrim.length === 0;
        const wrapBorder = tooShort
          ? '1px solid rgba(239,68,68,0.45)'
          : '1px solid rgba(255,255,255,0.10)';
        const wrapBg = tooShort ? 'rgba(239,68,68,0.04)' : 'rgba(255,255,255,0.04)';
        const counterColor = motivoValido ? '#00E676' : (tooShort ? '#EF4444' : '#4B5563');
        return (
          <Card>
            <Field label="Motivo Específico da Não Devolução" required>
              <div style={{ display:'flex', alignItems:'flex-start', gap:8,
                background: wrapBg, border: wrapBorder, borderRadius:8, padding:'10px 12px',
                transition: 'border-color 0.15s, background 0.15s' }}>
                <FileText size={13} color="#4B5563" style={{ marginTop:2, flexShrink:0 }} />
                <textarea
                  value={justificativa}
                  onChange={e => setJustificativa(e.target.value.slice(0, 500))}
                  placeholder="Ex: Colaborador alega ter perdido o item durante atividade de campo no dia 28/04. Foi notificado por telefone e pediu mais 24h para procurar."
                  rows={4}
                  style={{ flex:1, background:'none', border:'none', outline:'none', resize:'vertical',
                    color:'#F3F4F6', fontSize:13, fontFamily:'inherit', lineHeight:1.5 }} />
              </div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                marginTop: 6, gap: 8 }}>
                <p style={{ fontSize:11, color:'#6B7280', margin:0, lineHeight: 1.5 }}>
                  {empty
                    ? 'Descreva o motivo concreto. Esta justificativa fica registrada no Monday e fundamenta o desconto em folha.'
                    : tooShort
                      ? `Mínimo de ${MIN_MOTIVO_LEN} caracteres — descreva o ocorrido com mais detalhe.`
                      : 'OK — motivo registrado.'}
                </p>
                <span style={{ fontSize:10, color: counterColor, fontVariantNumeric:'tabular-nums', flexShrink:0, fontWeight:600 }}>
                  {motivoTrim.length}/500
                </span>
              </div>
            </Field>
          </Card>
        );
      })()}

      {/* Botões */}
      <div style={{ display:'flex', gap:10 }}>
        <button type="button" onClick={() => navigate(-1)} disabled={mutation.isPending}
          style={cancelBtnStyle}>
          Cancelar
        </button>
        <button type="button" onClick={() => mutation.mutate()} disabled={!canSubmit || mutation.isPending}
          style={btnStyle}>
          {mutation.isPending
            ? <Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} />
            : <React.Fragment><BtnIcon size={16} />{' '}{btnLabelText}</React.Fragment>}
        </button>
      </div>
    </div>
  );
}
