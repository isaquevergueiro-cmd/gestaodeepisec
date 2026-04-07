import { Outlet, useNavigate } from 'react-router';
import { useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { syncOfflineQueue } from '../api';

const INACTIVITY_MS = 10 * 60 * 1000; // 10 min

export function Root() {
  const navigate = useNavigate();

  // Sincroniza fila offline a cada 30s
  useEffect(() => {
    const interval = setInterval(() => syncOfflineQueue(), 30_000);
    return () => clearInterval(interval);
  }, []);

  // Timeout de inatividade
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    function resetTimer() {
      clearTimeout(timer);
      timer = setTimeout(() => {
        localStorage.removeItem('epi_tecnico');
        navigate('/login');
      }, INACTIVITY_MS);
    }

    const events = ['mousemove', 'keydown', 'pointerdown', 'touchstart', 'scroll'];
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      clearTimeout(timer);
      events.forEach(e => window.removeEventListener(e, resetTimer));
    };
  }, [navigate]);

  return (
    <div style={{ display: 'flex', background: '#121619', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowX: 'hidden', minWidth: 0 }}>
        <Header />
        <main style={{ flex: 1, padding: '28px 32px', overflowY: 'auto' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
