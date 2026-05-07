import { createBrowserRouter, redirect } from 'react-router';
import { lazy, Suspense } from 'react';
import { Root } from './Root';
import { LoginPage } from './pages/LoginPage';

// ─── Lazy imports ─────────────────────────────────────────────
const GestaoEpisPage    = lazy(() => import('./pages/GestaoEpisPage').then(m => ({ default: m.GestaoEpisPage })));
const AdmissaoPage      = lazy(() => import('./pages/AdmissaoPage').then(m => ({ default: m.AdmissaoPage })));
const EntregaPage       = lazy(() => import('./pages/EntregaPage').then(m => ({ default: m.EntregaPage })));
const DevolucaoPage     = lazy(() => import('./pages/DevolucaoPage').then(m => ({ default: m.DevolucaoPage })));
const TrocaPage         = lazy(() => import('./pages/TrocaPage').then(m => ({ default: m.TrocaPage })));
// Mantidos para uso interno / acesso direto
const CautelaUploadPage = lazy(() => import('./pages/CautelaUploadPage').then(m => ({ default: m.CautelaUploadPage })));
const BuscaPage         = lazy(() => import('./pages/BuscaPage').then(m => ({ default: m.BuscaPage })));

// ─── Spinner de carregamento ─────────────────────────────────
const PageLoader = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        border: '2px solid rgba(0,229,255,0.20)',
        borderTopColor: '#00E5FF',
        animation: 'spin 0.8s linear infinite',
      }}
    />
  </div>
);

function wrap(el: React.ReactNode) {
  return <Suspense fallback={<PageLoader />}>{el}</Suspense>;
}

// Guard de autenticação
function requireAuth() {
  const raw = localStorage.getItem('epi_tecnico');
  if (!raw) throw redirect('/login');
  return null;
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    loader: requireAuth,
    element: <Root />,
    children: [
      { index: true, loader: () => redirect('/gestao'), element: null },

      // ── Dashboard principal ───────────────────────────────────
      { path: 'gestao',    element: wrap(<GestaoEpisPage />) },

      // ── Admissão / Cautela (grupo AS0) ───────────────────────
      { path: 'admissao',  element: wrap(<AdmissaoPage />) },

      // ── Fluxo de EPIs ─────────────────────────────────────────
      { path: 'entrega',   element: wrap(<EntregaPage />) },
      { path: 'devolucao', element: wrap(<DevolucaoPage />) },
      { path: 'troca',     element: wrap(<TrocaPage />) },

      // ── Rotas internas (não expostas na sidebar) ───────────────
      { path: 'cautela/upload', element: wrap(<CautelaUploadPage />) },
      { path: 'busca',          element: wrap(<BuscaPage />) },
    ],
  },
]);
