import React, { useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X, CheckCircle2, XCircle, PackageMinus, ArrowLeftRight, Pencil, Phone, User,
  Clock, AlertTriangle, RotateCcw, Loader2, CheckCheck, Save, Check,
} from 'lucide-react';
import {
  atualizarStatusColaborador, atualizarInfoColaborador, reverterDevolucao,
  extractErrorMessage,
  type ColaboradorGestao, type EpiSubitemGestao, type GestaoEpisKpis,
} from '../../api';
import { useToast } from '../contexts/ToastContext';

// All Monday-exact status strings (accented, must match Monday API exactly)
const ST_ENTREGUE          = 'Entregue';
const ST_PENDENTE_RECEBER  = 'Pendente de Receber';
const ST_DESCARTE          = 'Descarte/Dano';
const ST_ESTOQUE3          = 'Enviado Estoque 3';
const ST_TROCA             = 'Troca / Desgaste';

// Monday-exact labels for subitens EPI
const MON_AG_DEV       = 'Aguardando Devolução';
const MON_NAO_DEV      = 'Não Devolvido';
const MON_REAPROV      = 'Reaproveitável';

// Monday-exact labels for item pai (STATUS_ACAO / MOTIVO_ACAO)
const MON_CONCLUIDO        = 'Concluído';
const MON_AG_ASSINATURA    = 'Aguardando Assinatura';
const MON_PENDENTE         = 'Pendente';
const MON_A_DEFINIR        = 'A Definir';
const MON_ADMISSAO         = 'Admissão';
const MON_DEMISSAO         = 'Demissão';

// -- palette -------------------------------------------------------------------

const SS: Record<string, { c: string; b: string }> = {
  [ST_ENTREGUE]:          { c: '#00C875', b: 'rgba(0,200,117,0.12)' },
  [ST_PENDENTE_RECEBER]:  { c: '#FDAB3D', b: 'rgba(253,171,61,0.12)' },
  [MON_AG_DEV]:           { c: '#FF7575', b: 'rgba(255,117,117,0.12)' },
  [MON_NAO_DEV]:          { c: '#E2445C', b: 'rgba(226,68,92,0.12)' },
  [MON_REAPROV]:          { c: '#A25DDC', b: 'rgba(162,93,220,0.12)' },
  'Reaproveitavel':       { c: '#A25DDC', b: 'rgba(162,93,220,0.12)' },
  [ST_DESCARTE]:          { c: '#676879', b: 'rgba(103,104,121,0.12)' },
  [ST_ESTOQUE3]:          { c: '#579BFC', b: 'rgba(87,155,252,0.12)' },
  [MON_A_DEFINIR]:        { c: '#C4C4C4', b: 'rgba(196,196,196,0.10)' },
  [MON_CONCLUIDO]:        { c: '#00C875', b: 'rgba(0,200,117,0.12)' },
  [MON_PENDENTE]:         { c: '#FDAB3D', b: 'rgba(253,171,61,0.12)' },
  [MON_AG_ASSINATURA]:    { c: '#FDAB3D', b: 'rgba(253,171,61,0.12)' },
  [MON_ADMISSAO]:         { c: '#579BFC', b: 'rgba(87,155,252,0.12)' },
  [MON_DEMISSAO]:         { c: '#E2445C', b: 'rgba(226,68,92,0.12)' },
  [ST_TROCA]:             { c: '#FDAB3D', b: 'rgba(253,171,61,0.12)' },
};
const scfg = (s: string) => SS[s] ?? { c: '#9CA3AF', b: 'rgba(156,163,175,0.10)' };

// -- helpers -------------------------------------------------------------------

function fmt(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d.toLocaleDateString('pt-BR');
}
function fmtPhone(p: string) {
  const d = p.replace(/\D/g, '');
  if (d.length === 11) return '(' + d.slice(0,2) + ') ' + d.slice(2,7) + '-' + d.slice(7);
  if (d.length === 10) return '(' + d.slice(0,2) + ') ' + d.slice(2,6) + '-' + d.slice(6);
  return p;
}
const AVATAR_COLORS = [
  ['#A25DDC','#6E3DB5'],['#579BFC','#1F76C2'],['#00C875','#00854D'],
  ['#FDAB3D','#C47E00'],['#E2445C','#B21F3B'],['#FF7575','#D14A4A'],
];
function avatarColor(n: string) {
  let h = 0; for (let i = 0; i < n.length; i++) h = n.charCodeAt(i)+((h<<5)-h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}
function initials(n: string) {
  return n.split(' ').filter(Boolean).slice(0,2).map(x=>x[0].toUpperCase()).join('');
}
function diasUteisRestantes(dataLimite: string | null): number | null {
  if (!dataLimite) return null;
  const limite = new Date(dataLimite);
  if (isNaN(limite.getTime())) return null;
  let hoje = new Date(); hoje.setHours(0,0,0,0);
  limite.setHours(0,0,0,0);
  let count = 0; let cursor = new Date(hoje);
  if (cursor >= limite) {
    while (cursor > limite) { cursor.setDate(cursor.getDate()-1); const d=cursor.getDay(); if(d!==0&&d!==6) count--; }
    return count;
  }
  while (cursor < limite) { cursor.setDate(cursor.getDate()+1); const d=cursor.getDay(); if(d!==0&&d!==6) count++; }
  return count;
}

const SA = [MON_CONCLUIDO, MON_AG_ASSINATURA, MON_PENDENTE, MON_A_DEFINIR];
const MA = [MON_ADMISSAO, ST_TROCA, MON_DEMISSAO, MON_A_DEFINIR];

// -- Chip ----------------------------------------------------------------------

function Chip({ status }: { status: string }) {
  const c = scfg(status);
  const chipStyle: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11,
    fontWeight: 600, padding: '3px 10px', borderRadius: 4,
    background: c.b, color: c.c, whiteSpace: 'nowrap',
  };
  return (
    <span style={chipStyle}>
      <span style={{ width: 8, height: 8, borderRadius: 2, background: c.c, flexShrink: 0 }} />
      {status}
    </span>
  );
}

// -- InlineDropdown ------------------------------------------------------------
// Renderizado via portal + posicionamento viewport-aware → não quebra com containing-blocks
// (pais com transform/will-change/etc).

function InlineDropdown({ value, options, onSelect, disabled }: {
  value: string; options: string[]; onSelect: (v: string) => void; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const c = scfg(value);

  React.useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      const bt = btnRef.current;
      const mn = menuRef.current;
      if (bt && !bt.contains(e.target as Node) && mn && !mn.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onScroll() { setOpen(false); }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', onMouseDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function handleOpen() {
    if (disabled) return;
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const width = Math.max(r.width, 200);
      let left = r.left;
      if (left + width > window.innerWidth - 8) {
        left = Math.max(8, window.innerWidth - width - 8);
      }
      let top = r.bottom + 4;
      const estimatedHeight = Math.min(260, options.length * 38 + 12);
      if (top + estimatedHeight > window.innerHeight - 8) {
        top = Math.max(8, r.top - 4 - estimatedHeight);
      }
      setPos({ top, left, width });
    }
    setOpen(p => !p);
  }

  const btnStyle: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700,
    padding: '4px 12px', borderRadius: 20, background: c.b, color: c.c,
    border: '1px solid ' + c.c + '4D',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    letterSpacing: '0.4px', textTransform: 'uppercase', whiteSpace: 'nowrap',
    transition: 'background 0.12s ease, border-color 0.12s ease',
  };

  return (
    <>
      <button ref={btnRef} onClick={handleOpen} style={btnStyle}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.c, flexShrink: 0 }} />
        {value}
      </button>
      {open && pos && createPortal(
        <div ref={menuRef} style={{
          position: 'fixed', top: pos.top, left: pos.left,
          zIndex: 10000, minWidth: pos.width,
          background: '#1A2028', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 10, padding: 6, boxShadow: '0 12px 40px rgba(0,0,0,0.65)',
        }}>
          {options.map(o => {
            const oc = scfg(o);
            const isSelected = o === value;
            return (
              <button
                key={o}
                onClick={() => { onSelect(o); setOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  width: '100%', padding: '8px 10px', borderRadius: 7,
                  border: '1px solid ' + (isSelected ? oc.c + '40' : 'transparent'),
                  background: isSelected ? oc.b : 'transparent',
                  color: isSelected ? oc.c : '#D1D5DB',
                  cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  textAlign: 'left', letterSpacing: '0.3px',
                  transition: 'background 0.12s, color 0.12s, border-color 0.12s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = oc.b;
                  (e.currentTarget as HTMLElement).style.color = oc.c;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = isSelected ? oc.b : 'transparent';
                  (e.currentTarget as HTMLElement).style.color = isSelected ? oc.c : '#D1D5DB';
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: oc.c, flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{o}</span>
                {isSelected && <Check size={12} color={oc.c} />}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </>
  );
}

// -- EditField -----------------------------------------------------------------

function EditField({ value, onSave, placeholder, icon: Icon, format, saving }: {
  value: string; onSave: (v: string) => void; placeholder?: string;
  icon?: React.ElementType; format?: (v: string) => string; saving?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);

  React.useEffect(function() { if (!editing) setVal(value); }, [value, editing]);

  const commit = useCallback(function() {
    setEditing(false);
    if (val.trim() !== value) onSave(val.trim());
  }, [val, value, onSave]);

  if (editing) {
    const inputStyle: React.CSSProperties = {
      fontSize: 13, color: '#F3F4F6', background: 'rgba(87,155,252,0.08)',
      border: '1px solid rgba(87,155,252,0.40)', borderRadius: 4, padding: '6px 10px',
      width: '100%', outline: 'none', fontFamily: 'inherit',
    };
    return (
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input autoFocus value={val} onChange={function(e) { setVal(e.target.value); }}
          onBlur={commit}
          onKeyDown={function(e) { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setVal(value); setEditing(false); } }}
          style={inputStyle} />
        <button onClick={commit} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#579BFC', padding: 4 }}>
          <Save size={13} />
        </button>
      </div>
    );
  }

  const rowStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
    fontSize: 13, color: value ? '#D1D5DB' : '#4B5563',
    background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit',
  };
  const displayVal = value ? (format ? format(value) : value) : (placeholder || '-');
  return (
    <button onClick={function() { setVal(value); setEditing(true); }} style={rowStyle}>
      {Icon && <Icon size={14} color="#676879" style={{ flexShrink: 0 }} />}
      <span style={{ flex: 1 }}>{displayVal}</span>
      {saving
        ? <Loader2 size={12} color="#579BFC" style={{ animation: 'spin 0.8s linear infinite' }} />
        : <Pencil size={11} color="#676879" style={{ opacity: 0.5 }} />}
    </button>
  );
}

// -- Section wrapper -----------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const wrapStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10, overflow: 'visible',
  };
  const headStyle: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, color: '#8B949E', padding: '10px 16px',
    borderBottom: '1px solid rgba(255,255,255,0.06)', textTransform: 'uppercase',
    letterSpacing: '1px', background: 'rgba(255,255,255,0.018)',
    borderRadius: '10px 10px 0 0',
  };
  return (
    <div style={wrapStyle}>
      <div style={headStyle}>{title}</div>
      <div style={{ padding: '14px 16px' }}>{children}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', minHeight: 36, gap: 12 }}>
      <span style={{ fontSize: 12, color: '#676879', width: 120, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '2px 0' }} />;
}

// -- Tipo EPI mesclado ---------------------------------------------------------

export type MergedEpi = EpiSubitemGestao & {
  _evento_id?: string;
  _is_evento_pendente?: boolean;
  _status_evento?: string;
};

// -- PendingReturnBanner -------------------------------------------------------

function PendingReturnBanner({ sub, colab, onRevert }: {
  sub: MergedEpi; colab: ColaboradorGestao; onRevert: () => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const statusEvento = sub._status_evento ?? MON_AG_DEV;
  const isNaoDevolvido = statusEvento === MON_NAO_DEV;
  const dias = diasUteisRestantes(sub.data_limite);
  const vencido = dias !== null && dias < 0;

  const revertMutation = useMutation({
    mutationFn: function() { return reverterDevolucao(sub._evento_id!, colab.id); },
    onSuccess: function() { queryClient.invalidateQueries({ queryKey: ['gestao-epis'] }); onRevert(); },
  });

  const cor = isNaoDevolvido ? '#E2445C' : '#FF7575';
  const corBg = isNaoDevolvido ? 'rgba(226,68,92,0.08)' : 'rgba(255,117,117,0.08)';
  const corBorder = isNaoDevolvido ? 'rgba(226,68,92,0.25)' : 'rgba(255,117,117,0.25)';
  const labelStatus = isNaoDevolvido ? MON_NAO_DEV : MON_AG_DEV;
  const labelVencido = vencido ? ('Vencido ha ' + Math.abs(dias as number) + ' dia(s)') : ((dias as number) + ' dia(s) restante(s)');

  const bannerStyle: React.CSSProperties = {
    marginTop: 10, padding: '10px 12px', borderRadius: 6,
    background: corBg, border: '1px solid ' + corBorder,
  };
  const desBtnStyle: React.CSSProperties = {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
    padding: '6px 8px', borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: 'pointer',
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', color: '#9CA3AF',
    opacity: revertMutation.isPending ? 0.6 : 1,
  };
  const concBtnStyle: React.CSSProperties = {
    flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
    padding: '6px 8px', borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: 'pointer',
    background: corBg, border: '1px solid ' + corBorder, color: cor,
  };
  const prazoColor = vencido ? '#E2445C' : '#FDAB3D';

  return (
    <div style={bannerStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {isNaoDevolvido
            ? <AlertTriangle size={12} color={cor} />
            : <Clock size={12} color={cor} />}
          <span style={{ fontSize: 11, fontWeight: 700, color: cor }}>{labelStatus}</span>
        </div>
        {dias !== null && (
          <span style={{ fontSize: 10, color: prazoColor, fontWeight: 600 }}>{labelVencido}</span>
        )}
      </div>
      {sub.data_limite && (
        <p style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 8 }}>
          Prazo: <strong style={{ color: prazoColor }}>{fmt(sub.data_limite)}</strong>
        </p>
      )}
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={function() { if (!revertMutation.isPending) revertMutation.mutate(); }}
          disabled={revertMutation.isPending}
          style={desBtnStyle}>
          {revertMutation.isPending
            ? <Loader2 size={11} style={{ animation: 'spin 0.8s linear infinite' }} />
            : <RotateCcw size={11} />}
          Desmarcar
        </button>
        <button
          onClick={function() { navigate('/devolucao', { state: { epi: sub, colaborador: colab, isUpdate: true, eventId: sub._evento_id } }); }}
          style={concBtnStyle}>
          <CheckCheck size={11} />
          Concluir Devolucao
        </button>
      </div>
    </div>
  );
}

// -- EpiCard -------------------------------------------------------------------

function EpiCard({ sub, colab }: { sub: MergedEpi; colab: ColaboradorGestao }) {
  const navigate = useNavigate();
  const isCautela = sub.nome.toUpperCase().includes('CAUTELA');
  const isHistorico = [MON_REAPROV, 'Reaproveitavel', ST_DESCARTE, ST_ESTOQUE3].includes(sub.status);
  const isPendente = sub._is_evento_pendente;
  const mostrarBotoes = !isCautela && !isHistorico;

  const cardBg = isPendente ? 'rgba(255,117,117,0.04)' : 'rgba(255,255,255,0.028)';
  const cardBorder = isPendente ? '1px solid rgba(255,117,117,0.22)' : '1px solid rgba(255,255,255,0.08)';

  const cardStyle: React.CSSProperties = {
    background: cardBg, border: cardBorder, borderRadius: 10, padding: '13px 15px',
    transition: 'border-color 0.12s',
  };

  const dataEnt = fmt(sub.data_entrega);
  const dataDev = fmt(sub.data_devolucao);

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#E5E7EB', flex: 1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {sub.nome}
        </span>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
          {isCautela && (
            <span style={{ fontSize: 9, color: '#579BFC', background: 'rgba(87,155,252,0.10)',
              padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>CAUTELA</span>
          )}
          <Chip status={sub.status} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {sub.quantidade && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11,
            color: '#9CA3AF', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 5 }}>
            <span style={{ color: '#6B7280', fontSize: 10 }}>Qtd</span>
            <strong style={{ fontWeight: 600 }}>{sub.quantidade}</strong>
          </span>
        )}
        {sub.tamanho !== '-' && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11,
            color: '#9CA3AF', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 5 }}>
            <span style={{ color: '#6B7280', fontSize: 10 }}>Tam</span>
            <strong style={{ fontWeight: 600 }}>{sub.tamanho}</strong>
          </span>
        )}
        {sub.preco_unitario > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11,
            color: '#9CA3AF', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 5 }}>
            <span style={{ color: '#6B7280', fontSize: 10 }}>R$</span>
            <strong style={{ fontWeight: 600 }}>{sub.preco_unitario.toFixed(2)}</strong>
          </span>
        )}
        {dataEnt && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11,
            color: '#00C875', background: 'rgba(0,200,117,0.08)', padding: '2px 8px', borderRadius: 5 }}>
            <span style={{ color: '#6B7280', fontSize: 10 }}>Entregue</span>
            <strong style={{ fontWeight: 600 }}>{dataEnt}</strong>
          </span>
        )}
        {dataDev && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11,
            color: '#FF7575', background: 'rgba(255,117,117,0.08)', padding: '2px 8px', borderRadius: 5 }}>
            <span style={{ color: '#6B7280', fontSize: 10 }}>Dev.</span>
            <strong style={{ fontWeight: 600 }}>{dataDev}</strong>
          </span>
        )}
      </div>

      {sub.justificativa && (
        <div style={{ fontSize: 11, color: '#676879', padding: '6px 10px',
          background: 'rgba(255,255,255,0.03)', borderRadius: 5, lineHeight: 1.5, marginBottom: 8 }}>
          {sub.justificativa}
        </div>
      )}

      {isPendente && sub._evento_id && (
        <PendingReturnBanner sub={sub} colab={colab} onRevert={function() {}} />
      )}
      {!isPendente && mostrarBotoes && sub.status === ST_ENTREGUE && (
        <div style={{ display: 'flex', gap: 6, marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button
            onClick={function() { navigate('/devolucao', { state: { epi: sub, colaborador: colab } }); }}
            style={{ flex: 1, padding: '7px', borderRadius: 6, border: '1px solid rgba(255,117,117,0.28)',
              background: 'rgba(255,117,117,0.08)', color: '#FF7575', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              fontSize: 11, fontWeight: 600, transition: 'background 0.12s' }}>
            <PackageMinus size={12} />
            Devolução
          </button>
          <button
            onClick={function() { navigate('/troca', { state: { epi: sub, colaborador: colab } }); }}
            style={{ flex: 1, padding: '7px', borderRadius: 6, border: '1px solid rgba(162,93,220,0.28)',
              background: 'rgba(162,93,220,0.08)', color: '#A25DDC', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              fontSize: 11, fontWeight: 600, transition: 'background 0.12s' }}>
            <ArrowLeftRight size={12} />
            Troca
          </button>
        </div>
      )}
      {!isPendente && mostrarBotoes && sub.status === ST_PENDENTE_RECEBER && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(253,171,61,0.12)',
          fontSize: 11, color: '#FDAB3D', fontWeight: 500 }}>
          <Clock size={12} />
          Aguardando entrega física
        </div>
      )}
    </div>
  );
}

// -- Main Drawer ---------------------------------------------------------------

export function ColaboradorDrawer({ colab, onClose }: { colab: ColaboradorGestao; onClose: () => void }) {
  const [tab, setTab] = useState<'dados' | 'epis'>('dados');
  const queryClient = useQueryClient();
  const { toastSuccess, toastError } = useToast();
  const [savingField, setSavingField] = useState<string | null>(null);

  React.useEffect(function() {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return function() { document.body.style.overflow = prev; };
  }, []);

  React.useEffect(function() {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return function() { document.removeEventListener('keydown', onKey); };
  }, [onClose]);

  const mergedEpis = React.useMemo(function() {
    const normais  = colab.subitens.filter(function(s) { return !s.nome.toUpperCase().includes('CAUTELA') && !/^\[(DEV|TROCA)\]/i.test(s.nome); });
    const eventos  = colab.subitens.filter(function(s) { return /^\[(DEV|TROCA)\]/i.test(s.nome); });
    const cautelas = colab.subitens.filter(function(s) { return s.nome.toUpperCase().includes('CAUTELA'); });

    const merged = normais.map(function(epi) {
      const nomeLimpo = epi.nome.trim().toLowerCase();
      const event = eventos.find(function(e) {
        const base = e.nome.replace(/^\[(DEV|TROCA)\]\s*/i, '').trim().toLowerCase();
        return base === nomeLimpo;
      });
      if (event) {
        const isAtivo = event.status === MON_NAO_DEV || event.status === MON_AG_DEV;
        if (isAtivo) {
          return {
            ...epi, status: event.status,
            data_devolucao: event.data_devolucao || epi.data_devolucao,
            data_limite: event.data_limite || epi.data_limite,
            justificativa: event.justificativa || epi.justificativa,
            _evento_id: event.id, _is_evento_pendente: true, _status_evento: event.status,
          };
        }
      }
      return epi;
    });
    return [...merged, ...cautelas] as MergedEpi[];
  }, [colab.subitens]);

  // Optimistic update — escreve na cache imediatamente, faz rollback se a chamada falhar.
  function patchColabInCache(patch: Partial<ColaboradorGestao>) {
    const prev = queryClient.getQueryData<{ colaboradores: ColaboradorGestao[]; kpis: GestaoEpisKpis }>(['gestao-epis']);
    if (prev) {
      queryClient.setQueryData(['gestao-epis'], {
        ...prev,
        colaboradores: prev.colaboradores.map(c =>
          c.id === colab.id ? { ...c, ...patch } : c
        ),
      });
    }
    return prev;
  }

  const updateInfo = useMutation({
    mutationFn: function(opts: { field: string; tecnico_responsavel?: string; telefone1?: string; telefone2?: string }) {
      setSavingField(opts.field);
      const { field: _f, ...payload } = opts;
      return atualizarInfoColaborador(colab.id, payload);
    },
    onMutate: async function(opts) {
      await queryClient.cancelQueries({ queryKey: ['gestao-epis'] });
      const { field: _f, ...patch } = opts;
      const prev = patchColabInCache(patch);
      return { prev };
    },
    onError: function(err, _vars, ctx) {
      if (ctx?.prev) queryClient.setQueryData(['gestao-epis'], ctx.prev);
      toastError('Erro ao salvar: ' + extractErrorMessage(err));
    },
    onSuccess: function() {
      toastSuccess('Campo salvo no Monday!');
    },
    onSettled: function() {
      queryClient.invalidateQueries({ queryKey: ['gestao-epis'] });
      setSavingField(null);
    },
  });

  const updateStatus = useMutation({
    mutationFn: function(opts: { status_acao?: string; motivo_acao?: string }) {
      return atualizarStatusColaborador(colab.id, opts);
    },
    onMutate: async function(opts) {
      await queryClient.cancelQueries({ queryKey: ['gestao-epis'] });
      const prev = patchColabInCache(opts);
      return { prev };
    },
    onError: function(err, _vars, ctx) {
      if (ctx?.prev) queryClient.setQueryData(['gestao-epis'], ctx.prev);
      toastError('Erro ao atualizar status: ' + extractErrorMessage(err));
    },
    onSuccess: function() {
      toastSuccess('Status atualizado no Monday!');
    },
    onSettled: function() { queryClient.invalidateQueries({ queryKey: ['gestao-epis'] }); },
  });

  const colors = avatarColor(colab.nome);
  const epiCount = mergedEpis.filter(function(s) { return !s.nome.toUpperCase().includes('CAUTELA'); }).length;

  const backdropStyle: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)',
    zIndex: 9000, backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 24,
  };
  const panelStyle: React.CSSProperties = {
    position: 'relative', width: 520, maxWidth: '100%',
    height: 'auto', maxHeight: 'min(90vh, 760px)',
    zIndex: 9001, background: '#13181F',
    border: '1px solid rgba(255,255,255,0.09)',
    borderRadius: 14,
    display: 'flex', flexDirection: 'column',
    boxShadow: '0 24px 64px rgba(0,0,0,0.75)',
    animation: 'modalIn 0.18s ease-out both',
    overflow: 'hidden',
  };
  const headerStyle: React.CSSProperties = {
    padding: '0', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0,
  };
  const tabBtnBase: React.CSSProperties = {
    flex: 1, padding: '11px 12px', border: 'none', cursor: 'pointer',
    fontSize: 13, fontWeight: 500, background: 'transparent', transition: 'all 0.12s',
    letterSpacing: '0.1px',
  };

  const avatarBg = 'linear-gradient(135deg,' + colors[0] + ',' + colors[1] + ')';
  const avatarShadow = '0 0 16px ' + colors[0] + '50';
  const avatarStyle: React.CSSProperties = {
    width: 46, height: 46, borderRadius: '50%', flexShrink: 0,
    background: avatarBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 15, fontWeight: 700, color: '#fff', boxShadow: avatarShadow,
    border: '2px solid rgba(255,255,255,0.08)',
  };
  const tabDadosStyle: React.CSSProperties = {
    ...tabBtnBase,
    color: tab === 'dados' ? '#E5E7EB' : '#6B7280',
    borderBottom: tab === 'dados' ? '2px solid #579BFC' : '2px solid transparent',
    fontWeight: tab === 'dados' ? 600 : 500,
  };
  const tabEpisStyle: React.CSSProperties = {
    ...tabBtnBase,
    color: tab === 'epis' ? '#E5E7EB' : '#6B7280',
    borderBottom: tab === 'epis' ? '2px solid #579BFC' : '2px solid transparent',
    fontWeight: tab === 'epis' ? 600 : 500,
  };
  const cpfDisplay = colab.cpf ? colab.cpf : '-';
  const contratoDisplay = colab.contrato ? colab.contrato : '-';
  const epiLabel = 'EPIs (' + epiCount + ')';

  return createPortal(
    <div
      style={backdropStyle}
      onClick={function(e) { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={panelStyle}>

        <div style={headerStyle}>
          <div style={{ padding: '16px 20px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={avatarStyle}>{initials(colab.nome)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#E5E7EB',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {colab.nome}
              </div>
              <div style={{ fontSize: 11, color: '#676879', marginTop: 2 }}>{cpfDisplay}</div>
            </div>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6,
              cursor: 'pointer', color: '#676879', padding: '6px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <X size={15} />
            </button>
          </div>

          <div style={{ display: 'flex', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <button onClick={function() { setTab('dados'); }} style={tabDadosStyle}>Colaborador</button>
            <button onClick={function() { setTab('epis'); }} style={tabEpisStyle}>{epiLabel}</button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {tab === 'dados' && (
            <React.Fragment>
              <Section title="Informacoes">
                <Row label="Contrato">
                  <span style={{ fontSize: 13, color: '#D1D5DB' }}>{contratoDisplay}</span>
                </Row>
                <Divider />
                <Row label="Cautela">
                  {colab.cautela_assinada && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#00C875' }}>
                      <CheckCircle2 size={13} />
                      Assinada
                    </span>
                  )}
                  {!colab.cautela_assinada && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#FF7575' }}>
                      <XCircle size={13} />
                      Pendente
                    </span>
                  )}
                </Row>
              </Section>

              <Section title="Contato">
                <Row label="Telefone 1">
                  <EditField
                    value={colab.telefone1}
                    placeholder="Adicionar telefone"
                    icon={Phone}
                    format={fmtPhone}
                    saving={savingField === 'telefone1'}
                    onSave={function(v) { updateInfo.mutate({ field: 'telefone1', telefone1: v }); }}
                  />
                </Row>
                <Divider />
                <Row label="Telefone 2">
                  <EditField
                    value={colab.telefone2}
                    placeholder="Adicionar telefone"
                    icon={Phone}
                    format={fmtPhone}
                    saving={savingField === 'telefone2'}
                    onSave={function(v) { updateInfo.mutate({ field: 'telefone2', telefone2: v }); }}
                  />
                </Row>
              </Section>

              <Section title="Tecnico Responsavel">
                <Row label="Nome">
                  <EditField
                    value={colab.tecnico_responsavel}
                    placeholder="Nome do tecnico"
                    icon={User}
                    saving={savingField === 'tecnico'}
                    onSave={function(v) { updateInfo.mutate({ field: 'tecnico', tecnico_responsavel: v }); }}
                  />
                </Row>
              </Section>

              <Section title="Status da Acao">
                <Row label="Status">
                  <InlineDropdown
                    value={colab.status_acao || MON_A_DEFINIR}
                    options={SA}
                    disabled={updateStatus.isPending}
                    onSelect={function(v) { updateStatus.mutate({ status_acao: v }); }}
                  />
                </Row>
                <Divider />
                <Row label="Motivo">
                  <InlineDropdown
                    value={colab.motivo_acao || MON_A_DEFINIR}
                    options={MA}
                    disabled={updateStatus.isPending}
                    onSelect={function(v) { updateStatus.mutate({ motivo_acao: v }); }}
                  />
                </Row>
                {updateStatus.isPending && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10,
                    fontSize: 11, color: '#676879' }}>
                    <Loader2 size={11} style={{ animation: 'spin 0.8s linear infinite' }} />
                    Salvando...
                  </div>
                )}
              </Section>
            </React.Fragment>
          )}

          {tab === 'epis' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {mergedEpis.length === 0 && (
                <div style={{ textAlign: 'center', padding: '48px 0' }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                    <CheckCircle2 size={20} color="#374151" />
                  </div>
                  <p style={{ color: '#6B7280', fontSize: 13, fontWeight: 500 }}>Nenhum item cadastrado.</p>
                  <p style={{ color: '#4B5563', fontSize: 11, marginTop: 4 }}>Os EPIs aparecerao aqui apos a admissao.</p>
                </div>
              )}
              {mergedEpis.map(function(s) {
                return <EpiCard key={s.id} sub={s} colab={colab} />;
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
