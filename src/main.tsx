import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from './app/contexts/SessionContext';
import { ColaboradorProvider } from './app/contexts/ColaboradorContext';
import { ToastProvider } from './app/contexts/ToastContext';
import './index.css';
import App from './App';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <ColaboradorProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </ColaboradorProvider>
      </SessionProvider>
    </QueryClientProvider>
  </StrictMode>,
);
