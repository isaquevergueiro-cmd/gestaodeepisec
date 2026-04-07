import { useLocation, useNavigate } from 'react-router';
import { Search, Plus, Wifi } from 'lucide-react';

interface RouteInfo {
  breadcrumb: string[];
  title: string;
}

const ROUTE_MAP: Record<string, RouteInfo> = {
  '/':            { breadcrumb: ['Home', 'Dashboard'],               title: 'Dashboard'          },
  '/cadastro':    { breadcrumb: ['Home', 'Solicitações', 'Nova'],    title: 'Nova Solicitação'   },
  '/busca':       { breadcrumb: ['Home', 'Colaboradores', 'Busca'],  title: 'Busca de Colaborador' },
  '/conferencia': { breadcrumb: ['Home', 'Colaboradores', 'Conferência'], title: 'Conferência EPI' },
  '/historico':   { breadcrumb: ['Home', 'Histórico'],               title: 'Histórico de Baixas' },
};

export function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const route    = ROUTE_MAP[location.pathname] ?? { breadcrumb: ['Home'], title: '' };

  return (
    <header
      style={{
        height: 68,
        background: 'rgba(14,18,20,0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        padding: '0 32px',
        gap: 24,
        flexShrink: 0,
      }}
    >
      {/* Breadcrumb + título */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          {route.breadcrumb.map((crumb, i) => {
            const isLast = i === route.breadcrumb.length - 1;
            return (
              <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {i > 0 && <span style={{ color: '#374151', fontSize: 12 }}>/</span>}
                <span
                  style={{
                    fontSize: 12,
                    color: isLast ? '#00E5FF' : '#6B7280',
                    fontWeight: isLast ? 500 : 400,
                  }}
                >
                  {crumb}
                </span>
              </span>
            );
          })}
        </div>
        <div
          style={{
            fontSize: 20,
            fontWeight: 600,
            letterSpacing: '-0.3px',
            color: '#F3F4F6',
            lineHeight: 1,
          }}
        >
          {route.title}
        </div>
      </div>

      {/* Barra de busca */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 8,
          padding: '7px 12px',
          width: 220,
        }}
      >
        <Search size={14} color="#6B7280" />
        <input
          type="text"
          placeholder="Buscar colaborador..."
          style={{
            background: 'none',
            border: 'none',
            outline: 'none',
            color: '#F3F4F6',
            fontSize: 13,
            width: '100%',
          }}
          onFocus={e => {
            (e.currentTarget.parentElement as HTMLElement).style.border = '1px solid rgba(0,229,255,0.40)';
          }}
          onBlur={e => {
            (e.currentTarget.parentElement as HTMLElement).style.border = '1px solid rgba(255,255,255,0.08)';
          }}
        />
      </div>

      {/* Status Monday.com */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          padding: '6px 12px',
          borderRadius: 8,
          background: 'rgba(0,230,118,0.08)',
          border: '1px solid rgba(0,230,118,0.25)',
          fontSize: 12,
          fontWeight: 500,
          color: '#00E676',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: '#00E676',
            boxShadow: '0 0 6px #00E676',
            flexShrink: 0,
          }}
        />
        <Wifi size={12} />
        Monday.com
      </div>

      {/* Botão Nova Ação */}
      <button
        onClick={() => navigate('/cadastro')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '7px 16px',
          borderRadius: 8,
          background: 'linear-gradient(135deg, rgba(0,229,255,0.22), rgba(0,229,255,0.15))',
          border: '1px solid rgba(0,229,255,0.35)',
          color: '#00E5FF',
          fontSize: 13,
          fontWeight: 500,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          flexShrink: 0,
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.boxShadow = '0 0 20px rgba(0,229,255,0.35)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.boxShadow = 'none';
        }}
      >
        <Plus size={14} />
        Nova Ação
      </button>
    </header>
  );
}
