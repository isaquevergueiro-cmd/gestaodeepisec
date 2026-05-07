import { createContext, useContext, useCallback, useState, ReactNode } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

// ============================================================
// TIPOS
// ============================================================

type ToastType = 'success' | 'error';

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  toastSuccess: (message: string) => void;
  toastError: (message: string) => void;
}

// ============================================================
// CONTEXT
// ============================================================

const ToastContext = createContext<ToastContextType | undefined>(undefined);

let toastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((type: ToastType, message: string) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => dismiss(id), 4500);
  }, [dismiss]);

  const toastSuccess = useCallback((msg: string) => push('success', msg), [push]);
  const toastError = useCallback((msg: string) => push('error', msg), [push]);

  return (
    <ToastContext.Provider value={{ toastSuccess, toastError }}>
      {children}

      {/* Portal de Toasts */}
      <div
        aria-live="assertive"
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          maxWidth: 380,
          width: '90vw',
          pointerEvents: 'none',
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="toast-slide-in"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: '13px 16px',
              borderRadius: 12,
              background:
                t.type === 'success'
                  ? 'rgba(0, 230, 118, 0.12)'
                  : 'rgba(239, 68, 68, 0.12)',
              border: `1px solid ${t.type === 'success' ? 'rgba(0,230,118,0.35)' : 'rgba(239,68,68,0.35)'}`,
              backdropFilter: 'blur(12px)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.40)',
              pointerEvents: 'all',
            }}
          >
            {t.type === 'success' ? (
              <CheckCircle2 size={18} color="#00E676" style={{ flexShrink: 0, marginTop: 1 }} />
            ) : (
              <AlertCircle size={18} color="#EF4444" style={{ flexShrink: 0, marginTop: 1 }} />
            )}
            <p
              style={{
                flex: 1,
                fontSize: 13,
                lineHeight: 1.5,
                color: t.type === 'success' ? '#A7F3D0' : '#FCA5A5',
                margin: 0,
              }}
            >
              {t.message}
            </p>
            <button
              onClick={() => dismiss(t.id)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                color: '#6B7280',
                flexShrink: 0,
                lineHeight: 0,
              }}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
