import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  LayoutDashboard, PackageCheck, Clock, AlertTriangle, DollarSign,
  Search, RefreshCw, Loader2, AlertCircle, UserPlus, X, Check,
} from 'lucide-react';
import {
  listarGestaoEpis, atualizarStatusColaborador, criarColaborador,
  extractErrorMessage,
  type ColaboradorGestao, type GestaoEpisKpis,
} from '../../api';
import { ColaboradorDrawer } from './ColaboradorDrawer';
import { useToast } from '../contexts/ToastContext';
import { formatCpf } from '../../utils';

// Monday exact status strings
const MON_CONCLUIDO     = 'Concluído';
const MON_AG_ASSINATURA = 'Aguardando Assinatura';
const MON_PENDENTE      = 'Pendente';
const MON_A_DEFINIR     = 'A Definir';
const MON_ADMISSAO      = 'Admissão';
const MON_TROCA         = 'Troca / Desgaste';
const MON_DEMISSAO      = 'Demissão';
const MON_NAO_DEV       = 'Não Devolvido';
const MON_AG_DEV        = 'Aguardando Devolução';

const STATUS_OPTS = [MON_CONCLUIDO, MON_AG_ASSINATURA, MON_PENDENTE, MON_A_DEFINIR];
const MOTIVO_OPTS = [MON_ADMISSAO, MON_TROCA, MON_DEMISSAO, MON_A_DEFINIR];

// Paleta alinhada ao StatusBadge — pílulas com bg/border sutis e cor do texto = cor do status
type SC = { color: string; bg: string; border: string };
const STATUS_COLORS: Record<string, SC> = {
  'Entregue':            { color: '#00C875', bg: 'rgba(0,200,117,0.10)',   border: 'rgba(0,200,117,0.30)'  },
  'Pendente de Receber': { color: '#FDAB3D', bg: 'rgba(253,171,61,0.10)',  border: 'rgba(253,171,61,0.30)' },
  [MON_AG_DEV]:          { color: '#FF7575', bg: 'rgba(255,117,117,0.10)', border: 'rgba(255,117,117,0.30)'},
  [MON_NAO_DEV]:         { color: '#E2445C', bg: 'rgba(226,68,92,0.10)',   border: 'rgba(226,68,92,0.30)'  },
  'Reaproveitavel':      { color: '#A25DDC', bg: 'rgba(162,93,220,0.10)',  border: 'rgba(162,93,220,0.30)' },
  'Reaproveitável':      { color: '#A25DDC', bg: 'rgba(162,93,220,0.10)',  border: 'rgba(162,93,220,0.30)' },
  'Descarte/Dano':       { color: '#9CA3AF', bg: 'rgba(156,163,175,0.08)', border: 'rgba(156,163,175,0.25)'},
  [MON_CONCLUIDO]:       { color: '#00C875', bg: 'rgba(0,200,117,0.10)',   border: 'rgba(0,200,117,0.30)'  },
  [MON_PENDENTE]:        { color: '#FDAB3D', bg: 'rgba(253,171,61,0.10)',  border: 'rgba(253,171,61,0.30)' },
  [MON_AG_ASSINATURA]:   { color: '#FDAB3D', bg: 'rgba(253,171,61,0.10)',  border: 'rgba(253,171,61,0.30)' },
  [MON_ADMISSAO]:        { color: '#579BFC', bg: 'rgba(87,155,252,0.10)',  border: 'rgba(87,155,252,0.30)' },
  [MON_TROCA]:           { color: '#FDAB3D', bg: 'rgba(253,171,61,0.10)',  border: 'rgba(253,171,61,0.30)' },
  [MON_DEMISSAO]:        { color: '#E2445C', bg: 'rgba(226,68,92,0.10)',   border: 'rgba(226,68,92,0.30)'  },
  [MON_A_DEFINIR]:       { color: '#9CA3AF', bg: 'rgba(156,163,175,0.08)', border: 'rgba(156,163,175,0.25)'},
};
function sCfg(s: string): SC {
  return STATUS_COLORS[s] ?? { color: '#9CA3AF', bg: 'rgba(156,163,175,0.08)', border: 'rgba(156,163,175,0.25)' };
}

function initials(n: string) {
  return n.split(' ').filter(Boolean).slice(0, 2).map(x => x[0].toUpperCase()).join('');
}

const AVC = [
  ['#A25DDC','#6E3DB5'], ['#579BFC','#1F76C2'], ['#00C875','#00854D'],
  ['#FDAB3D','#C47E00'], ['#E2445C','#B21F3B'], ['#FF7575','#D14A4A'],
];
function avc(n: string) {
  let h = 0; for (let i = 0; i < n.length; i++) h = n.charCodeAt(i) + ((h << 5) - h);
  return AVC[Math.abs(h) % AVC.length];
}

function gcfg(g: string) {
  const gl = g.toLowerCase();
  if (gl.includes('pendente')) return { color: '#FDAB3D', bg: 'rgba(253,171,61,0.12)', label: 'Pend. Dev.' };
  if (gl.includes('hist') || gl.includes('devolvido')) return { color: '#676879', bg: 'rgba(103,104,121,0.12)', label: 'Historico' };
  return { color: '#579BFC', bg: 'rgba(87,155,252,0.12)', label: 'Colaboradores' };
}

// Pílula com dropdown — segue o padrão de StatusBadge (bg sutil + borda + dot)
// Renderizado via portal para não ser afetado por containing blocks de pais com transform.
function InlineSelect({ value, options, onSelect, disabled }: {
  value: string; options: string[]; onSelect: (v: string) => void; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const c = sCfg(value);

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        menuRef.current && !menuRef.current.contains(e.target as Node)
      ) setOpen(false);
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
      // Mantém o menu dentro da viewport (8px de margem)
      if (left + width > window.innerWidth - 8) {
        left = Math.max(8, window.innerWidth - width - 8);
      }
      let top = r.bottom + 4;
      // Se não houver espaço abaixo, abre para cima
      if (top + 240 > window.innerHeight - 8) {
        top = Math.max(8, r.top - 4 - Math.min(240, options.length * 38 + 12));
      }
      setMenuPos({ top, left, width });
    }
    setOpen(p => !p);
  }

  const pillStyle: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 20,
    background: c.bg, color: c.color,
    border: '1px solid ' + c.border,
    cursor: disabled ? 'default' : 'pointer', whiteSpace: 'nowrap',
    minWidth: 110, opacity: disabled ? 0.7 : 1,
    letterSpacing: '0.4px', textTransform: 'uppercase',
    transition: 'background 0.12s ease, border-color 0.12s ease',
  };
  const dotStyle: React.CSSProperties = {
    width: 6, height: 6, borderRadius: '50%', background: c.color, flexShrink: 0,
  };

  return (
    <>
      <button ref={btnRef} onClick={handleOpen} style={pillStyle}>
        <span style={dotStyle} />
        {value}
      </button>
      {open && menuPos && createPortal(
        <div ref={menuRef} style={{
          position: 'fixed', top: menuPos.top, left: menuPos.left,
          minWidth: menuPos.width,
          zIndex: 10000,
          background: '#1A2028',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 10, padding: 6,
          boxShadow: '0 12px 40px rgba(0,0,0,0.65)',
        }}>
          {options.map(o => {
            const oc = sCfg(o);
            const isSelected = o === value;
            return (
              <button
                key={o}
                onClick={() => { onSelect(o); setOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  width: '100%', padding: '8px 10px',
                  borderRadius: 7,
                  border: '1px solid ' + (isSelected ? oc.border : 'transparent'),
                  background: isSelected ? oc.bg : 'transparent',
                  color: isSelected ? oc.color : '#D1D5DB',
                  cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  textAlign: 'left', letterSpacing: '0.3px',
                  transition: 'background 0.12s, color 0.12s, border-color 0.12s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = oc.bg;
                  (e.currentTarget as HTMLElement).style.color = oc.color;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = isSelected ? oc.bg : 'transparent';
                  (e.currentTarget as HTMLElement).style.color = isSelected ? oc.color : '#D1D5DB';
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: oc.color, flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{o}</span>
                {isSelected && <Check size={12} color={oc.color} />}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </>
  );
}

function KpiCard({ icon: Icon, label, value, color, sub }: {
  icon: React.ElementType; label: string; value: string | number; color: string; sub?: string;
}) {
  const brd = color + '30';
  const bar = 'linear-gradient(90deg,' + color + '60,transparent)';
  const ibg = color + '18';
  const ibdr = color + '30';
  const wrap: React.CSSProperties = {
    background: 'rgba(255,255,255,0.025)', border: '1px solid ' + brd,
    borderRadius: 12, padding: '18px 20px', display: 'flex', alignItems: 'flex-start', gap: 14,
    position: 'relative', overflow: 'hidden',
  };
  const barS: React.CSSProperties = { position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: bar };
  const ico: React.CSSProperties = {
    width: 40, height: 40, borderRadius: 10, flexShrink: 0,
    background: ibg, border: '1px solid ' + ibdr,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
  return (
    <div style={wrap}>
      <div style={barS} />
      <div style={ico}><Icon size={18} color={color} /></div>
      <div>
        <div style={{ fontSize: 24, fontWeight: 700, color: '#F3F4F6', lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: 11, color: '#6B7280', marginTop: 3, fontWeight: 500 }}>{label}</div>
        {sub && <div style={{ fontSize: 10, color, marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

function ColaboradorRow({ colab, onClick }: { colab: ColaboradorGestao; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  const queryClient = useQueryClient();
  const { toastSuccess, toastError } = useToast();
  const colors = avc(colab.nome);
  const gc = gcfg(colab.grupo);

  const hasAlert = colab.subitens.some(function(s) { return s.status === MON_NAO_DEV || s.status === MON_AG_DEV; });
  const epis = colab.subitens.filter(function(s) { return !s.nome.toUpperCase().includes('CAUTELA'); });
  const ent = epis.filter(function(s) { return s.status === 'Entregue'; }).length;
  const pct = epis.length > 0 ? Math.round((ent / epis.length) * 100) : 0;

  // Optimistic update — pinta o status novo na UI imediatamente; se falhar, faz rollback.
  const upd = useMutation({
    mutationFn: function(opts: { status_acao?: string; motivo_acao?: string }) {
      return atualizarStatusColaborador(colab.id, opts);
    },
    onMutate: async function(opts) {
      await queryClient.cancelQueries({ queryKey: ['gestao-epis'] });
      const prev = queryClient.getQueryData<{ colaboradores: ColaboradorGestao[]; kpis: GestaoEpisKpis }>(['gestao-epis']);
      if (prev) {
        queryClient.setQueryData(['gestao-epis'], {
          ...prev,
          colaboradores: prev.colaboradores.map(c =>
            c.id === colab.id ? { ...c, ...opts } : c
          ),
        });
      }
      return { prev };
    },
    onError: function(err, _vars, ctx) {
      if (ctx?.prev) queryClient.setQueryData(['gestao-epis'], ctx.prev);
      toastError('Erro ao atualizar: ' + extractErrorMessage(err));
    },
    onSuccess: function() {
      toastSuccess('Status atualizado no Monday!');
    },
    onSettled: function() { queryClient.invalidateQueries({ queryKey: ['gestao-epis'] }); },
  });

  const avBg = 'linear-gradient(135deg,' + colors[0] + ',' + colors[1] + ')';
  const barW = pct + '%';
  const rowBg = hov ? 'rgba(87,155,252,0.05)' : 'transparent';

  return (
    <tr
      style={{ borderBottom: '1px solid rgba(255,255,255,0.055)', background: rowBg, transition: 'background 0.15s', cursor: 'pointer' }}
      onClick={onClick}
      onMouseEnter={function() { setHov(true); }}
      onMouseLeave={function() { setHov(false); }}>
      <td style={{ padding: '12px 16px', minWidth: 220 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: avBg,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff' }}>
            {initials(colab.nome)}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#F0F2F5' }}>{colab.nome}</span>
              {hasAlert && <AlertTriangle size={11} color="#E2445C" />}
            </div>
            <div style={{ fontSize: 10, color: '#6B7280', fontFamily: 'monospace', marginTop: 2, letterSpacing: '0.2px' }}>
              {hov && colab.telefone1 ? colab.telefone1 : (colab.cpf || '-')}
            </div>
          </div>
        </div>
      </td>
      <td style={{ padding: '12px 12px' }}>
        <span style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 500 }}>{colab.contrato || <span style={{ color: '#4B5563' }}>—</span>}</span>
      </td>
      <td style={{ padding: '12px 12px' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 600,
          padding: '3px 10px', borderRadius: 20, background: gc.bg, color: gc.color,
          letterSpacing: '0.3px' }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: gc.color, flexShrink: 0 }} />
          {gc.label}
        </span>
      </td>
      <td style={{ padding: '12px 12px' }} onClick={function(e) { e.stopPropagation(); }}>
        <InlineSelect
          value={colab.status_acao || MON_A_DEFINIR}
          options={STATUS_OPTS}
          onSelect={function(v) { upd.mutate({ status_acao: v }); }}
          disabled={upd.isPending}
        />
      </td>
      <td style={{ padding: '12px 12px' }} onClick={function(e) { e.stopPropagation(); }}>
        <InlineSelect
          value={colab.motivo_acao || MON_A_DEFINIR}
          options={MOTIVO_OPTS}
          onSelect={function(v) { upd.mutate({ motivo_acao: v }); }}
          disabled={upd.isPending}
        />
      </td>
      <td style={{ padding: '12px 16px', minWidth: 110 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF', fontVariantNumeric: 'tabular-nums' }}>
            {ent}<span style={{ color: '#4B5563', fontWeight: 400 }}>/{epis.length}</span>
          </span>
          {epis.length > 0 && (
            <span style={{ fontSize: 10, color: pct === 100 ? '#00C875' : '#6B7280' }}>{pct}%</span>
          )}
        </div>
        <div style={{ height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', background: pct === 100 ? '#00C875' : '#579BFC', width: barW, transition: 'width 0.4s ease', borderRadius: 4 }} />
        </div>
      </td>
    </tr>
  );
}

type FG = 'Todos' | 'Colaboradores' | 'Pendente' | 'Historico';
const FGS: { key: FG; label: string; color: string }[] = [
  { key: 'Todos',         label: 'Todos os Grupos',  color: '#9CA3AF' },
  { key: 'Colaboradores', label: 'Colaboradores',    color: '#579BFC' },
  { key: 'Pendente',      label: 'Pend. Devolucao',  color: '#FDAB3D' },
  { key: 'Historico',     label: 'Historico',         color: '#676879' },
];

type FS = 'Todos' | 'Entregue' | 'AgDev' | 'NaoDev';
const FSS: { key: FS; label: string; color: string; match: string }[] = [
  { key: 'Todos',    label: 'Todos os Status', color: '#9CA3AF', match: '' },
  { key: 'Entregue', label: 'Entregues',       color: '#00C875', match: 'Entregue' },
  { key: 'AgDev',    label: 'Ag. Devolucao',   color: '#FF7575', match: MON_AG_DEV },
  { key: 'NaoDev',   label: 'Nao Devolvidos',  color: '#E2445C', match: MON_NAO_DEV },
];

function NovoColaboradorModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const { toastSuccess, toastError } = useToast();
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [contrato, setContrato] = useState('');
  const [funcao, setFuncao] = useState('');

  useEffect(function() {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return function() { document.body.style.overflow = prev; };
  }, []);

  useEffect(function() {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return function() { document.removeEventListener('keydown', onKey); };
  }, [onClose]);

  const criar = useMutation({
    mutationFn: function() { return criarColaborador({ nome: nome.trim(), cpf, contrato, funcao }); },
    onSuccess: function() {
      queryClient.invalidateQueries({ queryKey: ['gestao-epis'] });
      toastSuccess('Colaborador "' + nome.trim() + '" criado!');
      onClose();
    },
    onError: function(err: unknown) {
      const e = err as { message?: string };
      toastError('Erro: ' + (e?.message ?? 'Falha ao criar'));
    },
  });

  const canSubmit = nome.trim().length > 0 && !criar.isPending;

  const backdropS: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 300,
    backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
  const modalS: React.CSSProperties = {
    background: '#161B22', border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 12, padding: '24px 28px', width: 440, maxWidth: '90vw',
    boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
  };
  const lbl: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: '#676879', textTransform: 'uppercase',
    letterSpacing: '0.8px', marginBottom: 6, display: 'block',
  };
  const inp: React.CSSProperties = {
    width: '100%', background: '#1C1F23', border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 6, color: '#E5E7EB', fontSize: 13, padding: '9px 12px',
    outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
  };
  const sbg  = canSubmit ? 'rgba(87,155,252,0.15)' : 'rgba(255,255,255,0.04)';
  const sbdr = canSubmit ? '1px solid rgba(87,155,252,0.35)' : '1px solid rgba(255,255,255,0.07)';
  const sclr = canSubmit ? '#579BFC' : '#374151';
  const sbtnS: React.CSSProperties = {
    flex: 2, padding: '10px', borderRadius: 7, background: sbg, border: sbdr,
    color: sclr, fontSize: 13, fontWeight: 600, cursor: canSubmit ? 'pointer' : 'not-allowed',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  };

  return (
    <div style={backdropS} onClick={function(e) { if (e.target === e.currentTarget) onClose(); }}>
      <form
        style={modalS}
        onSubmit={function(e) { e.preventDefault(); if (canSubmit) criar.mutate(); }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <UserPlus size={18} color="#579BFC" />
            <span style={{ fontSize: 16, fontWeight: 700, color: '#E5E7EB' }}>Novo Colaborador</span>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#676879' }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={lbl}>Nome completo *</label>
            <input style={inp} value={nome} onChange={function(e) { setNome(e.target.value); }}
              placeholder="Ex: Joao Silva" autoFocus />
          </div>
          <div>
            <label style={lbl}>CPF</label>
            <input style={inp} value={cpf}
              onChange={function(e) { setCpf(formatCpf(e.target.value)); }}
              placeholder="000.000.000-00" inputMode="numeric" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>Contrato</label>
              <input style={inp} value={contrato} onChange={function(e) { setContrato(e.target.value); }}
                placeholder="Ex: SEMSA" />
            </div>
            <div>
              <label style={lbl}>Funcao</label>
              <input style={inp} value={funcao} onChange={function(e) { setFuncao(e.target.value); }}
                placeholder="Ex: Tecnico" />
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <button type="button" onClick={onClose}
            style={{ flex: 1, padding: '10px', borderRadius: 7, background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.09)', color: '#9CA3AF', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
            Cancelar
          </button>
          <button type="submit" disabled={!canSubmit} style={sbtnS}>
            {criar.isPending
              ? <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} />
              : <UserPlus size={14} />}
            Criar no Monday
          </button>
        </div>
      </form>
    </div>
  );
}

export function GestaoEpisPage() {
  const [busca, setBusca] = useState('');
  const [fg, setFg] = useState<FG>('Todos');
  const [fs, setFs] = useState<FS>('Todos');
  const [sel, setSel] = useState<ColaboradorGestao | null>(null);
  const [showNovo, setShowNovo] = useState(false);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['gestao-epis'],
    queryFn: listarGestaoEpis,
    // Mantém os dados frescos: refetch ao focar a aba e a cada 30s em background.
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
    retry: 1,
  });

  const kpis = data?.kpis;
  const colaboradores = data?.colaboradores ?? [];

  const filtrados = useMemo(function() {
    let list = colaboradores;
    if (fg !== 'Todos') {
      list = list.filter(function(c) {
        const gl = c.grupo.toLowerCase();
        if (fg === 'Historico') return gl.includes('hist') || gl.includes('devolvido');
        if (fg === 'Pendente') return gl.includes('pendente');
        return !gl.includes('pendente') && !gl.includes('hist') && !gl.includes('devolvido');
      });
    }
    if (fs !== 'Todos') {
      const match = FSS.find(function(f) { return f.key === fs; })?.match ?? '';
      list = list.filter(function(c) { return c.subitens.some(function(s) { return s.status === match; }); });
    }
    if (busca.trim()) {
      const q = busca.toLowerCase();
      list = list.filter(function(c) {
        return (
          c.nome.toLowerCase().includes(q) ||
          c.cpf.replace(/\D/g, '').includes(q.replace(/\D/g, '')) ||
          c.contrato.toLowerCase().includes(q)
        );
      });
    }
    return list;
  }, [colaboradores, fg, fs, busca]);

  useEffect(function() {
    if (sel && data?.colaboradores) {
      const u = data.colaboradores.find(function(c) { return c.id === sel.id; });
      if (u) setSel(u);
    }
  }, [data, sel]);

  const kpiValor = kpis
    ? 'R$ ' + kpis.valorEmAberto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
    : 'R$ 0,00';
  const kpiSub = kpis && kpis.naoDevolvidos > 0 ? kpis.naoDevolvidos + ' item(s)' : undefined;
  const spinA  = isFetching ? 'spin 0.8s linear infinite' : 'none';
  const refOp  = isFetching ? 0.6 : 1;

  return (
    <div className="page-slide-up">

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <LayoutDashboard size={18} color="#579BFC" />
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#F3F4F6', margin: 0 }}>Gestao de EPIs</h2>
          </div>
          <p style={{ fontSize: 13, color: '#6B7280' }}>Hub central de gerenciamento do ciclo de vida dos EPIs.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={function() { refetch(); }} disabled={isFetching}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8,
              cursor: isFetching ? 'not-allowed' : 'pointer', background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.10)', color: '#6B7280', fontSize: 12, fontWeight: 500, opacity: refOp }}>
            <RefreshCw size={13} style={{ animation: spinA }} />
            Atualizar
          </button>
          <button onClick={function() { setShowNovo(true); }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8,
              cursor: 'pointer', background: 'rgba(87,155,252,0.12)',
              border: '1px solid rgba(87,155,252,0.30)', color: '#579BFC', fontSize: 12, fontWeight: 600 }}>
            <UserPlus size={13} />
            Novo Colaborador
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 28 }}>
        {kpis ? (
          <React.Fragment>
            <KpiCard icon={PackageCheck}  label="EPIs Entregues"  value={kpis.totalEntregues}      color="#00C875" />
            <KpiCard icon={Clock}         label="Ag. Devolução"   value={kpis.aguardandoDevolucao}  color="#FF7575" />
            <KpiCard icon={AlertTriangle} label="Não Devolvidos"  value={kpis.naoDevolvidos}        color="#E2445C" />
            <KpiCard icon={DollarSign}    label="Valor em Aberto" value={kpiValor} sub={kpiSub}     color="#A25DDC" />
          </React.Fragment>
        ) : (
          <React.Fragment>
            {[0,1,2,3].map(function(i) {
              return (
                <div key={i} style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 12, padding: '18px 20px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div className="skeleton" style={{ height: 28, width: '50%', marginBottom: 8 }} />
                    <div className="skeleton" style={{ height: 11, width: '70%' }} />
                  </div>
                </div>
              );
            })}
          </React.Fragment>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10,
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 10, padding: '0 14px', transition: 'border-color 0.15s' }}>
          <Search size={14} color="#6B7280" />
          <input type="text" placeholder="Buscar colaborador, CPF ou contrato..."
            value={busca} onChange={function(e) { setBusca(e.target.value); }}
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none',
              color: '#F3F4F6', fontSize: 13, padding: '11px 0', fontFamily: 'inherit' }} />
          {busca && (
            <button onClick={function() { setBusca(''); }}
              style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 4,
                cursor: 'pointer', color: '#9CA3AF', display: 'flex', alignItems: 'center',
                justifyContent: 'center', width: 20, height: 20, flexShrink: 0, transition: 'background 0.12s' }}>
              <X size={11} />
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: '#6B7280', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', marginRight: 2 }}>Grupo:</span>
            {FGS.map(function(f) {
              const act = fg === f.key;
              const ps: React.CSSProperties = {
                padding: '5px 14px', borderRadius: 20, cursor: 'pointer', fontSize: 11, fontWeight: 600,
                background: act ? f.color + '18' : 'transparent',
                border: act ? '1px solid ' + f.color + '40' : '1px solid rgba(255,255,255,0.09)',
                color: act ? f.color : '#6B7280',
                transition: 'all 0.12s ease',
              };
              return <button key={f.key} onClick={function() { setFg(f.key); }} style={ps}>{f.label}</button>;
            })}
          </div>
          <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)' }} />
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: '#6B7280', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', marginRight: 2 }}>Status:</span>
            {FSS.map(function(f) {
              const act = fs === f.key;
              const ps: React.CSSProperties = {
                padding: '5px 14px', borderRadius: 20, cursor: 'pointer', fontSize: 11, fontWeight: 600,
                background: act ? f.color + '18' : 'transparent',
                border: act ? '1px solid ' + f.color + '40' : '1px solid rgba(255,255,255,0.09)',
                color: act ? f.color : '#6B7280',
                transition: 'all 0.12s ease',
              };
              return <button key={f.key} onClick={function() { setFs(f.key); }} style={ps}>{f.label}</button>;
            })}
          </div>
        </div>
      </div>

      {isLoading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, gap: 12, color: '#4B5563' }}>
          <Loader2 size={22} style={{ animation: 'spin 0.8s linear infinite' }} />
          <span style={{ fontSize: 14 }}>Carregando EPIs do Monday...</span>
        </div>
      )}

      {isError && (
        <div style={{ background: 'rgba(226,68,92,0.08)', border: '1px solid rgba(226,68,92,0.20)',
          borderRadius: 12, padding: '20px 24px', display: 'flex', gap: 14 }}>
          <AlertCircle size={18} color="#E2445C" style={{ flexShrink: 0 }} />
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#FCA5A5', marginBottom: 4 }}>Erro ao conectar com o Monday</p>
            <p style={{ fontSize: 13, color: '#6B7280' }}>{(error as Error)?.message}</p>
            <button onClick={function() { refetch(); }}
              style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                background: 'rgba(226,68,92,0.15)', border: '1px solid rgba(226,68,92,0.30)', color: '#FCA5A5' }}>
              <RefreshCw size={12} /> Tentar novamente
            </button>
          </div>
        </div>
      )}

      {!isLoading && !isError && (
        <div style={{ background: 'rgba(255,255,255,0.018)', border: '1px solid rgba(255,255,255,0.09)',
          borderRadius: 12, overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.025)' }}>
                  {['Colaborador', 'Contrato', 'Grupo', 'Status', 'Motivo', 'Progresso'].map(function(h) {
                    return (
                      <th key={h} style={{
                        padding: '10px 16px', textAlign: 'left', fontSize: 10,
                        fontWeight: 700, color: '#8B949E', letterSpacing: '0.8px',
                        textTransform: 'uppercase', whiteSpace: 'nowrap',
                      }}>
                        {h}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {filtrados.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '64px 24px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 44, height: 44, borderRadius: '50%',
                          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Search size={18} color="#374151" />
                        </div>
                        <p style={{ fontSize: 13, color: '#6B7280', fontWeight: 500, margin: 0 }}>
                          Nenhum colaborador encontrado
                        </p>
                        <p style={{ fontSize: 11, color: '#4B5563', margin: 0 }}>
                          Tente ajustar os filtros ou a busca.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtrados.map(function(c) {
                    return (
                      <ColaboradorRow
                        key={c.id}
                        colab={c}
                        onClick={function() { setSel(c); }}
                      />
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.05)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: '#4B5563' }}>
              {filtrados.length} colaborador(es) exibido(s)
            </span>
            {colaboradores.length > 0 && (
              <span style={{ fontSize: 11, color: '#374151' }}>
                Total: {colaboradores.length}
              </span>
            )}
          </div>
        </div>
      )}

      {sel && (
        <ColaboradorDrawer colab={sel} onClose={function() { setSel(null); }} />
      )}

      {showNovo && (
        <NovoColaboradorModal onClose={function() { setShowNovo(false); }} />
      )}
    </div>
  );
}
