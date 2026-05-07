import { useNavigate, useLocation } from 'react-router';
import {
  ShieldCheck,
  LayoutDashboard,
  ClipboardList,
  LogOut,
  ChevronRight,
} from 'lucide-react';
import { getTecnicoFromStorage } from '../../utils';

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
}

const NAV_ITEMS: NavItem[] = [
  { icon: LayoutDashboard, label: 'Gestão de EPIs', path: '/gestao'   },
  { icon: ClipboardList,   label: 'Admissão',       path: '/admissao' },
];

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const tecnico  = getTecnicoFromStorage();

  function isActive(path: string) {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  }

  function handleLogout() {
    localStorage.removeItem('epi_tecnico');
    navigate('/login');
  }

  return (
    <aside
      style={{
        width: 236,
        minWidth: 236,
        height: '100vh',
        position: 'sticky',
        top: 0,
        display: 'flex',
        flexDirection: 'column',
        background: '#0A0D0F',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        overflowY: 'auto',
      }}
    >
      {/* Logo */}
      <div style={{ padding: '22px 20px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'linear-gradient(135deg, rgba(0,229,255,0.15), rgba(0,229,255,0.30))',
              border: '1px solid rgba(0,229,255,0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <ShieldCheck size={18} color="#00E5FF" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#F3F4F6', letterSpacing: '-0.2px' }}>
              EPI Manager
            </div>
            <div style={{ fontSize: 10, color: '#4B5563', marginTop: 1, letterSpacing: '0.4px' }}>
              SESMT · v2.0
            </div>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '0 16px' }} />

      {/* Nav */}
      <nav style={{ flex: 1, padding: '14px 10px' }}>
        <p
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '1.4px',
            textTransform: 'uppercase',
            color: '#374151',
            padding: '0 8px',
            marginBottom: 8,
          }}
        >
          Operações
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV_ITEMS.map(function({ icon: Icon, label, path }) {
            const active = isActive(path);
            const navBorder = active ? '1px solid rgba(0,229,255,0.20)' : '1px solid transparent';
            const navBorderLeft = active ? '2px solid #00E5FF' : '2px solid transparent';
            const navBg = active ? 'linear-gradient(90deg, rgba(0,229,255,0.12), rgba(0,229,255,0.02))' : 'transparent';
            const navPadLeft = active ? '9px' : '10px';
            const iconColor = active ? '#00E5FF' : '#4B5563';
            const labelWeight = active ? 600 : 400;
            const labelColor = active ? '#F0F2F5' : '#6B7280';
            const btnStyle: React.CSSProperties = {
              display: 'flex', alignItems: 'center', gap: 10,
              width: '100%', padding: '9px 10px', borderRadius: 9,
              border: navBorder, borderLeft: navBorderLeft, background: navBg,
              cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s ease',
              paddingLeft: navPadLeft,
            };
            const labelStyle: React.CSSProperties = {
              flex: 1, fontSize: 13, fontWeight: labelWeight, color: labelColor,
            };
            return (
              <button
                key={path}
                onClick={function() { navigate(path); }}
                style={btnStyle}
                onMouseEnter={function(e) {
                  if (!active)
                    (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
                }}
                onMouseLeave={function(e) {
                  if (!active)
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
              >
                <Icon size={15} color={iconColor} />
                <span style={labelStyle}>{label}</span>
                {active && <ChevronRight size={13} color="#00E5FF" />}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Divider + User card */}
      <div style={{ padding: '0 10px 18px' }}>
        <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', marginBottom: 14 }} />

        <div
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 10,
            padding: '12px 14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #00E5FF, #00E676)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 700,
                color: '#0A0D0F',
                flexShrink: 0,
              }}
            >
              {tecnico?.nome?.charAt(0).toUpperCase() ?? 'T'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: '#E5E7EB',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {tecnico?.nome ?? 'Técnico'}
              </div>
              <div style={{ fontSize: 10, color: '#4B5563' }}>SESMT</div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              width: '100%',
              padding: '6px 10px',
              borderRadius: 7,
              background: 'rgba(239,68,68,0.07)',
              border: '1px solid rgba(239,68,68,0.18)',
              color: '#EF4444',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={function(e) {
              (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.14)';
            }}
            onMouseLeave={function(e) {
              (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.07)';
            }}
          >
            <LogOut size={12} />
            Sair do sistema
          </button>
        </div>
      </div>
    </aside>
  );
}
