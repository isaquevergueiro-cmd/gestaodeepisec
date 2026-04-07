import { TrendingUp, TrendingDown } from 'lucide-react';

interface KpiCardProps {
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  label: string;
  value: number | string;
  sub?: string;
  trend?: 'up' | 'down' | 'neutral';
}

export function KpiCard({ icon: Icon, iconColor, iconBg, label, value, sub, trend }: KpiCardProps) {
  return (
    <div
      style={{
        background: 'rgba(36,40,45,0.85)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14,
        padding: 20,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: iconBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={16} color={iconColor} />
        </div>
      </div>

      <div style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 500, marginBottom: 6 }}>
        {label}
      </div>

      <div
        style={{
          fontSize: 28,
          fontWeight: 700,
          letterSpacing: '-0.5px',
          fontVariantNumeric: 'tabular-nums',
          color: '#F3F4F6',
          lineHeight: 1,
          marginBottom: sub ? 8 : 0,
        }}
      >
        {value}
      </div>

      {sub && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {trend === 'up'   && <TrendingUp  size={11} color="#00E676" />}
          {trend === 'down' && <TrendingDown size={11} color="#EF4444" />}
          <span style={{ fontSize: 11, color: '#6B7280' }}>{sub}</span>
        </div>
      )}
    </div>
  );
}
