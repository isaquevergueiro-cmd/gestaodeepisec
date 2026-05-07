import { Outlet, useNavigate } from 'react-router';
import { useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';

const INACTIVITY_MS = 15 * 60 * 1000; // 15 minutos

export function Root() {
  const navigate = useNavigate();

  // Auto-logout por inatividade
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
    events.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, resetTimer));
    };
  }, [navigate]);

  return (
    <div style={{ display: 'flex', background: '#0E1214', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Header />
        <main
          style={{
            flex: 1,
            padding: '28px 32px',
            overflowY: 'auto',
            overflowX: 'hidden',
          }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
