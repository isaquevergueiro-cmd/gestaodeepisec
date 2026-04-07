import { useNavigate, useLocation } from 'react-router';
import {
  ShieldCheck,
  LayoutDashboard,
  Plus,
  Search,
  History,
  Bell,
  ChevronRight,
  LogOut,
} from 'lucide-react';
import { getTecnicoFromStorage } from '../../utils';

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  badge?: number;
  alert?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard',          path: '/'          },
  { icon: Plus,            label: 'Nova Solicitação',   path: '/cadastro'  },
  { icon: Search,          label: 'Busca Colaborador',  path: '/busca'     },
  { icon: History,         label: 'Histórico',          path: '/historico' },
  { icon: Bell,            label: 'Notificações',       path: '/notificacoes', badge: 3, alert: true },
];

export function Sidebar() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const tecnico   = getTecnicoFromStorage();

  function isActive(path: string) {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  }

  function handleLogout() {
    localStorage.removeItem('epi_tecnico');
    navigate('/login');
  }

  return (
    <aside
      style={{
        width: 260,
        minWidth: 260,
        background: '#0E1214',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        position: 'sticky',
        top: 0,
        overflowY: 'auto',
      }}
    >
      {/* Logo */}
      <div style={{ padding: '20px 20px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: 'linear-gradient(135deg, rgba(0,229,255,0.13), rgba(0,229,255,0.27))',
              border: '1px solid rgba(0,229,255,0.33)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ShieldCheck size={20} color="#00E5FF" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#F3F4F6', letterSpacing: '-0.2px' }}>
              EPI Manager
            </div>
            <div style={{ fontSize: 11, color: '#6B7280', marginTop: 1 }}>SESMT v2.0</div>
          </div>
        </div>
      </div>

      {/* Divisor */}
      <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '0 20px' }} />

      {/* Seção principal */}
      <nav style={{ padding: '16px 12px', flex: 1 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '1.2px',
            textTransform: 'uppercase',
            color: '#4B5563',
            padding: '0 8px',
            marginBottom: 8,
          }}
        >
          Menu Principal
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV_ITEMS.map(({ icon: Icon, label, path, badge, alert }) => {
            const active = isActive(path);
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: active ? '1px solid rgba(0,229,255,0.20)' : '1px solid transparent',
                  background: active
                    ? 'linear-gradient(90deg, rgba(0,229,255,0.12), rgba(0,229,255,0.04))'
                    : 'transparent',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  width: '100%',
                  textAlign: 'left',
                }}
                onMouseEnter={e => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
                }}
                onMouseLeave={e => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
              >
                <Icon
                  size={16}
                  color={active ? '#00E5FF' : alert ? '#EF4444' : '#6B7280'}
                />
                <span
                  style={{
                    flex: 1,
                    fontSize: 13,
                    fontWeight: active ? 500 : 400,
                    color: active ? '#F3F4F6' : '#9CA3AF',
                  }}
                >
                  {label}
                </span>
                {badge != null && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '1px 7px',
                      borderRadius: 20,
                      background: active
                        ? '#00E5FF'
                        : alert
                        ? 'rgba(239,68,68,0.20)'
                        : '#374151',
                      color: active ? '#0E1214' : alert ? '#EF4444' : '#9CA3AF',
                    }}
                  >
                    {badge}
                  </span>
                )}
                {active && !badge && <ChevronRight size={14} color="#00E5FF" />}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Divisor + user card */}
      <div style={{ padding: '0 12px 20px' }}>
        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', marginBottom: 16 }} />

        <div
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 12,
            padding: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #00E5FF, #00E676)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 700,
                color: '#0E1214',
                flexShrink: 0,
              }}
            >
              {tecnico?.nome?.charAt(0) ?? 'T'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: '#F3F4F6',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {tecnico?.nome ?? 'Técnico'}
              </div>
              <div style={{ fontSize: 11, color: '#6B7280' }}>SESMT</div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '7px 10px',
              borderRadius: 8,
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.20)',
              color: '#EF4444',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.15)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.08)';
            }}
          >
            <LogOut size={13} />
            Sair do sistema
          </button>
        </div>
      </div>
    </aside>
  );
}
