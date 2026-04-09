import { useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import SignatureCanvas from 'react-signature-canvas';
import {
  ArrowLeft, CheckCircle2, XCircle, Lock,
  Camera, RotateCcw, Send, AlertCircle, Package,
} from 'lucide-react';
import { salvarBaixa } from '../../api';
import { getTecnicoFromStorage } from '../../utils';
import { StatusBadge } from '../components/StatusBadge';
import type { ConferenciaData } from '../../types';

type EpiKey = 'reaproveitavel' | 'nao_devolvido' | 'descarte';

const STATUS_OPTS: { key: EpiKey; label: string; color: string; bg: string }[] = [
  { key: 'reaproveitavel', label: '✓ Reaproveitável', color: '#00E676', bg: 'rgba(0,230,118,0.10)' },
  { key: 'nao_devolvido',  label: '✗ Não Devolvido',  color: '#EF4444', bg: 'rgba(239,68,68,0.10)'  },
  { key: 'descarte',       label: '🗑 Descarte',       color: '#F59E0B', bg: 'rgba(245,158,11,0.10)' },
];

export function DevolutivaPage() {
  const location = useLocation();
  const navigate  = useNavigate();
  const tecnico   = getTecnicoFromStorage();
  const dados     = location.state as ConferenciaData | undefined;

  const episPendentes  = dados?.epis_esperados ?? [];
  const episJaEntregues = dados?.epis_ja_devolvidos ?? [];

  const [statusMap, setStatusMap] = useState<Record<number, EpiKey | null>>(() =>
    Object.fromEntries(episPendentes.map((_, i) => [i, null])),
  );
  const [fotosMap, setFotosMap] = useState<Record<number, string | null>>(() =>
    Object.fromEntries(episPendentes.map((_, i) => [i, null])),
  );
  const [justificativasMap, setJustificativasMap] = useState<Record<number, string>>({});
  const [prazoMap, setPrazoMap] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [msg, setMsg]         = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const sigRef        = useRef<SignatureCanvas>(null);
  const fileInputsRef = useRef<(HTMLInputElement | null)[]>([]);

  if (!dados) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 16 }}>
        <AlertCircle size={40} color="#F59E0B" />
        <p style={{ color: '#9CA3AF', fontSize: 14 }}>Nenhum dado de devolutiva. Faça a busca primeiro.</p>
        <button onClick={() => navigate('/busca')} style={{ padding: '10px 20px', borderRadius: 8, background: 'rgba(0,229,255,0.10)', border: '1px solid rgba(0,229,255,0.25)', color: '#00E5FF', fontSize: 13, cursor: 'pointer' }}>
          Ir para Busca
        </button>
      </div>
    );
  }

  const { id_monday, nome, cpf } = dados;
  const todosAvaliados = Object.values(statusMap).every(s => s !== null);
  const todasFotos     = episPendentes.every((_, i) => statusMap[i] === 'nao_devolvido' || fotosMap[i] !== null);
  const avaliadosCount = Object.values(statusMap).filter(Boolean).length;

  function setStatus(i: number, key: EpiKey) {
    setStatusMap(prev => ({ ...prev, [i]: prev[i] === key ? null : key }));
  }

  function handleFotoChange(i: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setFotosMap(prev => ({ ...prev, [i]: ev.target?.result as string }));
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  async function handleFinalizar() {
    if (!todosAvaliados) { setMsg({ type: 'error', text: 'Avalie todos os EPIs pendentes antes de finalizar.' }); return; }
    if (!todasFotos) {
      const faltando = episPendentes.filter((_, i) => statusMap[i] !== 'nao_devolvido' && !fotosMap[i]).join(', ');
      setMsg({ type: 'error', text: `Foto obrigatória para: ${faltando}` }); return;
    }
    const semJustificativa = episPendentes.filter((_, i) => statusMap[i] === 'nao_devolvido' && !justificativasMap[i]?.trim()).join(', ');
    if (semJustificativa) { setMsg({ type: 'error', text: `Justificativa obrigatória para: ${semJustificativa}` }); return; }
    if (!sigRef.current || sigRef.current.isEmpty()) { setMsg({ type: 'error', text: 'A assinatura do colaborador é obrigatória.' }); return; }

    const epis_problema = episPendentes.map((epi, i) => {
      const key = statusMap[i];
      return {
        epi,
        status: (key === 'reaproveitavel' ? 'Devolvido - Reuso' : key === 'descarte' ? 'Devolvido - Descarte' : 'Não Devolvido') as 'Devolvido - Reuso' | 'Não Devolvido' | 'Devolvido - Descarte',
        justificativa: key === 'nao_devolvido' ? justificativasMap[i] : undefined,
        prazo_marcado: key === 'nao_devolvido' ? prazoMap[i] : undefined,
      };
    });

    const fotos_epis = episPendentes
      .map((epi, i) => ({ nome: epi, base64: fotosMap[i] }))
      .filter(f => f.base64 !== null) as { nome: string; base64: string }[];

    const rawCanvas = sigRef.current.getCanvas();
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = rawCanvas.width; exportCanvas.height = rawCanvas.height;
    const ctx = exportCanvas.getContext('2d')!;
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    ctx.drawImage(rawCanvas, 0, 0);
    const assinatura_base64 = exportCanvas.toDataURL('image/png');

    setLoading(true); setMsg(null);
    try {
      const response = await salvarBaixa({ id_monday, nome, cpf, epis_problema, fotos_epis, assinatura_base64, tecnico_responsavel: tecnico?.nome ?? 'Desconhecido' });
      setMsg({ type: 'success', text: response.sign_url ? 'Redirecionando para Assinatura Legal...' : 'Devolutiva finalizada com sucesso!' });
      setTimeout(() => {
        if (response.sign_url) { window.location.href = response.sign_url; }
        else { navigate('/'); }
      }, response.sign_url ? 1500 : 2500);
    } catch (err) {
      setMsg({ type: 'error', text: `Erro ao finalizar: ${(err as Error).message}` });
      setLoading(false);
    }
  }

  return (
    <div>
      {/* Cabeçalho */}
      <div style={{ background: 'rgba(36,40,45,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(245,158,11,0.20)', borderRadius: 14, padding: '16px 24px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
        <button onClick={() => navigate('/busca')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#9CA3AF', fontSize: 12, cursor: 'pointer' }}>
          <ArrowLeft size={13} /> Voltar
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#F3F4F6' }}>{nome}</div>
          <div style={{ fontSize: 12, color: '#6B7280' }}>CPF: {cpf} · Segunda visita — Devolutiva de pendências</div>
        </div>
        <StatusBadge variant="warning" label="Aguardando Retorno de Item" />
      </div>

      {/* EPIs já entregues (bloqueados) */}
      {episJaEntregues.length > 0 && (
        <div style={{ background: 'rgba(36,40,45,0.60)', border: '1px solid rgba(0,230,118,0.15)', borderRadius: 14, padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <CheckCircle2 size={14} color="#00E676" />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#00E676' }}>EPIs já entregues anteriormente</span>
            <span style={{ fontSize: 11, color: '#4B5563', marginLeft: 4 }}>(bloqueados)</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {episJaEntregues.map((epi, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(0,230,118,0.05)', border: '1px solid rgba(0,230,118,0.12)', borderRadius: 10, opacity: 0.7 }}>
                <Lock size={12} color="#00E676" />
                <Package size={13} color="#4B5563" />
                <span style={{ fontSize: 13, color: '#6B7280', flex: 1 }}>{epi}</span>
                <StatusBadge variant="success" label="Entregue" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* EPIs pendentes (interativos) */}
      <div style={{ background: 'rgba(36,40,45,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 24, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ width: 3, height: 20, borderRadius: 2, background: 'linear-gradient(180deg, #F59E0B, rgba(245,158,11,0.5))' }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: '#F3F4F6' }}>
            EPIs Pendentes para Devolver ({avaliadosCount}/{episPendentes.length} avaliados)
          </span>
        </div>

        {episPendentes.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#6B7280', fontSize: 13 }}>
            Nenhum EPI pendente para esta solicitação.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {episPendentes.map((epi, i) => {
              const status = statusMap[i];
              const foto   = fotosMap[i];
              const opt    = STATUS_OPTS.find(o => o.key === status);
              return (
                <div key={i} style={{ border: `1px solid ${opt ? `${opt.color}33` : 'rgba(255,255,255,0.06)'}`, borderRadius: 12, padding: 16, background: opt ? opt.bg : 'rgba(255,255,255,0.02)', transition: 'all 0.2s ease' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                    <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#F59E0B', flexShrink: 0 }}>{i + 1}</span>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: '#F3F4F6' }}>{epi}</span>
                    {status && <StatusBadge variant={status === 'reaproveitavel' ? 'success' : status === 'descarte' ? 'warning' : 'danger'} label={STATUS_OPTS.find(o => o.key === status)?.label ?? status} />}
                  </div>

                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                    {STATUS_OPTS.map(({ key, label, color, bg }) => (
                      <button key={key} onClick={() => setStatus(i, key)} style={{ padding: '6px 12px', borderRadius: 8, border: status === key ? `1px solid ${color}55` : '1px solid rgba(255,255,255,0.08)', background: status === key ? bg : 'rgba(255,255,255,0.03)', color: status === key ? color : '#9CA3AF', fontSize: 12, fontWeight: status === key ? 600 : 400, cursor: 'pointer', transition: 'all 0.15s ease' }}>
                        {label}
                      </button>
                    ))}
                  </div>

                  {status !== 'nao_devolvido' ? (
                    <>
                      <input ref={el => { fileInputsRef.current[i] = el; }} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => handleFotoChange(i, e)} />
                      {foto ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <img src={foto} alt={`Foto ${epi}`} style={{ width: 72, height: 54, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(0,230,118,0.25)' }} />
                          <button onClick={() => fileInputsRef.current[i]?.click()} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#9CA3AF', fontSize: 12, cursor: 'pointer' }}>
                            <RotateCcw size={12} /> Refazer
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => fileInputsRef.current[i]?.click()} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#6B7280', fontSize: 12, cursor: 'pointer' }}>
                          <Camera size={14} /> Tirar foto do EPI
                        </button>
                      )}
                    </>
                  ) : (
                    <div style={{ marginTop: 12, padding: 12, background: 'rgba(239,68,68,0.05)', borderRadius: 8 }}>
                      <label style={{ fontSize: 12, color: '#EF4444', marginBottom: 6, display: 'block' }}>Justificativa Obrigatória *</label>
                      <textarea value={justificativasMap[i] || ''} onChange={e => setJustificativasMap(prev => ({ ...prev, [i]: e.target.value }))} style={{ width: '100%', padding: '8px', borderRadius: 6, background: '#1F2937', color: 'white', border: '1px solid rgba(239,68,68,0.2)', boxSizing: 'border-box' }} placeholder="Escreva por que o item ainda não foi entregue..." rows={2} />
                      <div style={{ marginTop: 10, fontSize: 12, color: '#F87171', background: 'rgba(239,68,68,0.1)', padding: '8px', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.2)' }}>
                        ⚠️ Sem possibilidade de novo prazo. Este item será descontado.
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Assinatura */}
      <div style={{ background: 'rgba(36,40,45,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 24, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{ width: 3, height: 20, borderRadius: 2, background: 'linear-gradient(180deg, #A78BFA, rgba(167,139,250,0.50))' }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: '#F3F4F6' }}>Assinatura do Colaborador</span>
        </div>
        <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 14 }}>Assine para confirmar a devolutiva dos itens acima.</p>
        <div style={{ position: 'relative', background: 'rgba(15,18,22,0.6)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 8, overflow: 'hidden' }}>
          <SignatureCanvas ref={sigRef} canvasProps={{ className: 'sig-canvas', height: 160, style: { width: '100%', display: 'block' } }} backgroundColor="rgba(15,18,22,0)" penColor="#000000" />
          <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', fontSize: 11, color: 'rgba(167,139,250,0.35)', pointerEvents: 'none' }}>Assine aqui</div>
        </div>
        <button onClick={() => sigRef.current?.clear()} style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#9CA3AF', fontSize: 12, cursor: 'pointer' }}>
          <XCircle size={12} /> Limpar Assinatura
        </button>
      </div>

      {/* Mensagem */}
      {msg && (
        <div className="toast-slide-in" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 10, marginBottom: 16, background: msg.type === 'success' ? 'rgba(0,230,118,0.10)' : 'rgba(239,68,68,0.10)', border: `1px solid ${msg.type === 'success' ? 'rgba(0,230,118,0.25)' : 'rgba(239,68,68,0.25)'}`, color: msg.type === 'success' ? '#00E676' : '#EF4444', fontSize: 13 }}>
          {msg.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          {msg.text}
        </div>
      )}

      {/* Botão */}
      <button
        onClick={handleFinalizar}
        disabled={loading || msg?.type === 'success'}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '14px 32px', borderRadius: 10, justifyContent: 'center', background: 'linear-gradient(135deg, rgba(245,158,11,0.18), rgba(245,158,11,0.08))', border: '1px solid rgba(245,158,11,0.35)', color: '#F59E0B', fontSize: 14, fontWeight: 600, cursor: (loading || msg?.type === 'success') ? 'not-allowed' : 'pointer', opacity: (loading || msg?.type === 'success') ? 0.7 : 1, transition: 'box-shadow 0.2s ease' }}
      >
        {loading ? <span className="animate-spin" style={{ width: 16, height: 16, border: '2px solid #F59E0B', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block' }} /> : <Send size={16} />}
        {loading ? 'Enviando...' : msg?.type === 'success' ? 'Finalizado' : 'Confirmar Devolutiva de Pendências'}
      </button>
    </div>
  );
}
