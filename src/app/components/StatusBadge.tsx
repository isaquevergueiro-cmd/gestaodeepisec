import React from 'react';
import type { EpiStatus } from '../../types';

const STATUS_CONFIG: Record<
  EpiStatus,
  { label: string; bg: string; border: string; color: string; dot: string }
> = {
  'Pendente de Receber': {
    label: 'Pendente',
    bg: 'rgba(245,158,11,0.10)',
    border: 'rgba(245,158,11,0.30)',
    color: '#F59E0B',
    dot: '#F59E0B',
  },
  Entregue: {
    label: 'Entregue',
    bg: 'rgba(0,230,118,0.10)',
    border: 'rgba(0,230,118,0.30)',
    color: '#00E676',
    dot: '#00E676',
  },
  'Aguardando Devolução': {
    label: 'Aguard. Devolução',
    bg: 'rgba(245,158,11,0.10)',
    border: 'rgba(245,158,11,0.30)',
    color: '#F59E0B',
    dot: '#F59E0B',
  },
  Reaproveitável: {
    label: 'Reaproveitável',
    bg: 'rgba(0,229,255,0.10)',
    border: 'rgba(0,229,255,0.30)',
    color: '#00E5FF',
    dot: '#00E5FF',
  },
  'Descarte/Dano': {
    label: 'Descarte/Dano',
    bg: 'rgba(239,68,68,0.10)',
    border: 'rgba(239,68,68,0.30)',
    color: '#EF4444',
    dot: '#EF4444',
  },
  'Não Devolvido': {
    label: 'Não Devolvido',
    bg: 'rgba(239,68,68,0.10)',
    border: 'rgba(239,68,68,0.30)',
    color: '#EF4444',
    dot: '#EF4444',
  },
  'A Definir': {
    label: 'A Definir',
    bg: 'rgba(107,114,128,0.10)',
    border: 'rgba(107,114,128,0.25)',
    color: '#9CA3AF',
    dot: '#6B7280',
  },
};

interface StatusBadgeProps {
  status: EpiStatus;
  /** Exibe o status como texto puro sem cápsula (para uso em tabelas densas) */
  inline?: boolean;
}

export function StatusBadge({ status, inline = false }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG['A Definir'];

  if (inline) {
    return (
      <span style={{ color: cfg.color, fontSize: 12, fontWeight: 600 }}>{cfg.label}</span>
    );
  }

  const isActive = status === 'Aguardando Devolução' || status === 'Não Devolvido';
  const dotClassName = isActive ? 'pulse-dot' : '';
  const dotBoxShadow = '0 0 5px ' + cfg.dot;
  const spanBorder = '1px solid ' + cfg.border;
  const dotStyle: React.CSSProperties = {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: cfg.dot,
    flexShrink: 0,
    boxShadow: dotBoxShadow,
  };
  const spanStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '3px 10px',
    borderRadius: 20,
    background: cfg.bg,
    border: spanBorder,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.4px',
    textTransform: 'uppercase',
    color: cfg.color,
    whiteSpace: 'nowrap',
  };
  return (
    <span style={spanStyle}>
      <span className={dotClassName} style={dotStyle} />
      {cfg.label}
    </span>
  );
}
