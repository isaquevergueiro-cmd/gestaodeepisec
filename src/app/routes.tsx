import { createBrowserRouter, redirect } from 'react-router';
import { Root } from './Root';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { CadastroPage } from './pages/CadastroPage';
import { BuscaPage } from './pages/BuscaPage';
import { ConferenciaPage } from './pages/ConferenciaPage';
import { HistoricoPage } from './pages/HistoricoPage';
import { DevolutivaPage } from './pages/DevolutivaPage';

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
      { index: true, element: <DashboardPage /> },
      { path: 'cadastro', element: <CadastroPage /> },
      { path: 'busca', element: <BuscaPage /> },
      { path: 'conferencia', element: <ConferenciaPage /> },
      { path: 'devolutiva',  element: <DevolutivaPage /> },
      { path: 'historico', element: <HistoricoPage /> },
    ],
  },
]);
