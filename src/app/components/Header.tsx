import React from 'react';
import { useLocation } from 'react-router';
import { useIsFetching } from '@tanstack/react-query';
import { Wifi, WifiOff } from 'lucide-react';

const ROUTE_TITLES: Record<string, { title: string; crumbs: string[] }> = {
  '/gestao':         { title: 'Gestão de EPIs',               crumbs: ['Operações', 'Gestão']           },
  '/admissao':       { title: 'Admissão de Colaboradores',    crumbs: ['Cadastro', 'Admissão']          },
  '/busca':          { title: 'Balcão de Atendimento',        crumbs: ['Operações', 'Busca']            },
  '/cautela/upload': { title: 'Anexar Cautela ao Monday',     crumbs: ['Cautela', 'Upload']             },
  '/entrega':        { title: 'Confirmar Entrega de EPI',     crumbs: ['Operações', 'Entrega']          },
  '/devolucao':      { title: 'Registrar Devolução de EPI',   crumbs: ['Operações', 'Devolução']        },
  '/troca':          { title: 'Substituição de EPI',          crumbs: ['Operações', 'Troca']            },
};

const FALLBACK = { title: 'EPI Manager', crumbs: ['Operações'] };

export function Header() {
  const location = useLocation();
  const route = ROUTE_TITLES[location.pathname] ?? FALLBACK;

  // Estado real da conexão com o Monday: contagem de queries em flight + se a última falhou
  const fetchingCount = useIsFetching();
  const erroredCount  = useIsFetching({ predicate: (q) => q.state.status === 'error' });

  let connColor = '#00E676';
  let connBg    = 'rgba(0,230,118,0.07)';
  let connBdr   = 'rgba(0,230,118,0.22)';
  let connLabel = 'Monday.com';
  let connIcon: React.ReactNode = <Wifi size={11} />;
  let pulsing = true;

  if (erroredCount > 0) {
    connColor = '#E2445C';
    connBg    = 'rgba(226,68,92,0.08)';
    connBdr   = 'rgba(226,68,92,0.25)';
    connLabel = 'Sem conexão';
    connIcon  = <WifiOff size={11} />;
    pulsing   = false;
  } else if (fetchingCount > 0) {
    connColor = '#FDAB3D';
    connBg    = 'rgba(253,171,61,0.08)';
    connBdr   = 'rgba(253,171,61,0.25)';
    connLabel = 'Sincronizando';
  }

  const connStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '5px 11px',
    borderRadius: 8,
    background: connBg,
    border: '1px solid ' + connBdr,
    fontSize: 11,
    fontWeight: 500,
    color: connColor,
    flexShrink: 0,
  };

  const dotStyle: React.CSSProperties = {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: connColor,
    boxShadow: '0 0 6px ' + connColor,
    flexShrink: 0,
  };

  return (
    <header
      style={{
        height: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 28px',
        background: 'rgba(10,13,15,0.95)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        position: 'sticky',
        top: 0,
        zIndex: 40,
        flexShrink: 0,
      }}
    >
      {/* Breadcrumb + título */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
          {route.crumbs.map(function(crumb, i) {
            const isLast = i === route.crumbs.length - 1;
            const crumbColor = isLast ? '#00E5FF' : '#4B5563';
            const crumbWeight = isLast ? 500 : 400;
            const crumbStyle: React.CSSProperties = {
              fontSize: 11, color: crumbColor, fontWeight: crumbWeight, letterSpacing: '0.2px',
            };
            return (
              <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                {i > 0 && (
                  <span style={{ color: '#1F2937', fontSize: 11 }}>/</span>
                )}
                <span style={crumbStyle}>{crumb}</span>
              </span>
            );
          })}
        </div>
        <h1
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: '#F3F4F6',
            letterSpacing: '-0.2px',
            lineHeight: 1,
            margin: 0,
          }}
        >
          {route.title}
        </h1>
      </div>

      {/* Status real de conexão Monday.com */}
      <div style={connStyle} aria-live="polite" title={connLabel}>
        <span
          className={pulsing ? 'pulse-dot' : ''}
          style={dotStyle}
        />
        {connIcon}
        {connLabel}
      </div>
    </header>
  );
}
