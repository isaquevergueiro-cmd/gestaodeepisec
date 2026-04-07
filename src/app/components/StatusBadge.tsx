type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface StatusBadgeProps {
  variant: BadgeVariant;
  label: string;
  dot?: boolean;
}

const STYLES: Record<BadgeVariant, { bg: string; color: string }> = {
  success: { bg: 'rgba(0,230,118,0.10)',   color: '#00E676' },
  warning: { bg: 'rgba(245,158,11,0.10)',  color: '#F59E0B' },
  danger:  { bg: 'rgba(239,68,68,0.10)',   color: '#EF4444' },
  info:    { bg: 'rgba(0,229,255,0.08)',   color: '#00E5FF' },
  neutral: { bg: 'rgba(107,114,128,0.15)', color: '#6B7280' },
};

export function StatusBadge({ variant, label, dot = true }: StatusBadgeProps) {
  const { bg, color } = STYLES[variant];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        borderRadius: 20,
        padding: '3px 10px',
        fontSize: 11,
        fontWeight: 600,
        background: bg,
        color,
        whiteSpace: 'nowrap',
      }}
    >
      {dot && (
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: color,
            boxShadow: `0 0 5px ${color}`,
            flexShrink: 0,
          }}
        />
      )}
      {label}
    </span>
  );
}

export function statusFromLabel(label: string): BadgeVariant {
  const l = label.toLowerCase();
  if (l.includes('conclu') || l.includes('assina') || l.includes('devolvid')) return 'success';
  if (l.includes('pendent') || l.includes('aguardan')) return 'warning';
  if (l.includes('crítico') || l.includes('problema') || l.includes('vencid')) return 'danger';
  if (l.includes('informa')) return 'info';
  return 'neutral';
}
