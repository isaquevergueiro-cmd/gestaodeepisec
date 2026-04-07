import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ShieldCheck, Mail, AlertCircle, ArrowRight } from 'lucide-react';
import { TECNICOS } from '../../data/tecnicos';
import type { Tecnico } from '../../types';

export function LoginPage() {
  const navigate = useNavigate();
  const [email,   setEmail]   = useState('');
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const match = TECNICOS.find(
      t => t.email.toLowerCase() === email.trim().toLowerCase(),
    );

    if (!match) {
      setError('E-mail não encontrado. Verifique o endereço digitado.');
      return;
    }

    setLoading(true);
    // Simula latência mínima para feedback visual
    setTimeout(() => {
      localStorage.setItem('epi_tecnico', JSON.stringify(match));
      navigate('/');
    }, 350);
  }

  function handleQuickSelect(tec: Tecnico) {
    setEmail(tec.email);
    setError('');
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#121619',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      {/* Glow decorativo */}
      <div
        style={{
          position: 'fixed', top: '15%', left: '35%',
          width: 500, height: 500, borderRadius: '50%',
          background: 'rgba(0,229,255,0.03)',
          filter: 'blur(100px)', pointerEvents: 'none',
        }}
      />

      <div
        style={{
          background: 'rgba(36,40,45,0.90)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20,
          padding: '48px 40px',
          width: '100%',
          maxWidth: 440,
          position: 'relative',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div
            style={{
              width: 64, height: 64, borderRadius: 18, margin: '0 auto 16px',
              background: 'linear-gradient(135deg, rgba(0,229,255,0.13), rgba(0,229,255,0.27))',
              border: '1px solid rgba(0,229,255,0.33)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <ShieldCheck size={28} color="#00E5FF" />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.3px', color: '#F3F4F6', marginBottom: 6 }}>
            EPI Manager
          </h1>
          <p style={{ fontSize: 13, color: '#6B7280' }}>
            Digite seu e-mail para acessar o sistema
          </p>
        </div>

        <form onSubmit={handleLogin}>
          {/* E-mail */}
          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                display: 'block', fontSize: 11, fontWeight: 600,
                letterSpacing: '0.8px', textTransform: 'uppercase',
                color: '#4B5563', marginBottom: 8,
              }}
            >
              E-mail de acesso
            </label>
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: 'rgba(255,255,255,0.05)',
                border: `1px solid ${error ? 'rgba(239,68,68,0.40)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 8, padding: '0 14px',
                transition: 'border-color 0.2s',
              }}
              onFocusCapture={e => {
                if (!error) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,229,255,0.40)';
              }}
              onBlurCapture={e => {
                if (!error) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)';
              }}
            >
              <Mail size={14} color="#6B7280" style={{ flexShrink: 0 }} />
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(''); }}
                placeholder="seu@email.com.br"
                autoComplete="email"
                style={{
                  flex: 1, background: 'none', border: 'none', outline: 'none',
                  color: '#F3F4F6', fontSize: 14, padding: '13px 0',
                  fontFamily: 'Inter, sans-serif',
                }}
              />
            </div>
          </div>

          {/* Erro */}
          {error && (
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 14px', borderRadius: 8, marginBottom: 16,
                background: 'rgba(239,68,68,0.10)',
                border: '1px solid rgba(239,68,68,0.25)',
                color: '#EF4444', fontSize: 13,
              }}
            >
              <AlertCircle size={13} />
              {error}
            </div>
          )}

          {/* Botão */}
          <button
            type="submit"
            disabled={loading || !email.trim()}
            style={{
              width: '100%', padding: '13px',
              borderRadius: 10, marginBottom: 24,
              background: 'linear-gradient(135deg, rgba(0,229,255,0.18), rgba(0,229,255,0.08))',
              border: '1px solid rgba(0,229,255,0.35)',
              color: '#00E5FF', fontSize: 14, fontWeight: 600,
              cursor: loading || !email.trim() ? 'not-allowed' : 'pointer',
              opacity: loading || !email.trim() ? 0.5 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'box-shadow 0.2s ease',
            }}
            onMouseEnter={e => {
              if (!loading && email.trim()) (e.currentTarget as HTMLElement).style.boxShadow = '0 0 24px rgba(0,229,255,0.30)';
            }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
          >
            {loading ? (
              <span
                className="animate-spin"
                style={{ width: 16, height: 16, border: '2px solid #00E5FF', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block' }}
              />
            ) : (
              <>Entrar no sistema <ArrowRight size={14} /></>
            )}
          </button>
        </form>

        {/* Divisor */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
          <span style={{ fontSize: 11, color: '#4B5563', fontWeight: 500 }}>ACESSO RÁPIDO</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
        </div>

        {/* Seleção rápida de técnico */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {TECNICOS.map(tec => (
            <button
              key={tec.email}
              type="button"
              onClick={() => handleQuickSelect(tec)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                border: email === tec.email
                  ? '1px solid rgba(0,229,255,0.25)'
                  : '1px solid rgba(255,255,255,0.06)',
                background: email === tec.email
                  ? 'rgba(0,229,255,0.06)'
                  : 'rgba(255,255,255,0.02)',
                transition: 'all 0.15s ease',
                textAlign: 'left',
              }}
              onMouseEnter={e => {
                if (email !== tec.email) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
              }}
              onMouseLeave={e => {
                if (email !== tec.email) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)';
              }}
            >
              <div
                style={{
                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                  background: email === tec.email
                    ? 'linear-gradient(135deg, #00E5FF, #00E676)'
                    : 'rgba(255,255,255,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700,
                  color: email === tec.email ? '#0E1214' : '#6B7280',
                }}
              >
                {tec.nome.charAt(0)}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: email === tec.email ? '#F3F4F6' : '#9CA3AF' }}>
                  {tec.nome}
                </div>
                <div style={{ fontSize: 11, color: '#4B5563' }}>{tec.email}</div>
              </div>
            </button>
          ))}
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: '#374151', marginTop: 24 }}>
          SESMT — Sistema de Gestão de EPIs v2.0
        </p>
      </div>
    </div>
  );
}
