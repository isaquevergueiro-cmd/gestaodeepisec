import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { User, CreditCard, Briefcase, FileText, Calendar, Send, CheckCircle, AlertCircle, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { CARGO_EPI_MAP, CARGOS, MOTIVOS } from '../../catalog';
import { criarSolicitacao } from '../../api';
import { formatCpf, validarCpf, getTecnicoFromStorage } from '../../utils';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label
        style={{
          display: 'block',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.8px',
          textTransform: 'uppercase',
          color: '#4B5563',
          marginBottom: 8,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

function DatePicker({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => value ? new Date(value + 'T12:00:00') : new Date());
  const ref = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectedDate = value ? new Date(value + 'T12:00:00') : null;
  const today = new Date();

  function prevMonth() {
    setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }
  function nextMonth() {
    setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }
  function selectDay(day: number) {
    const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    onChange(iso);
    setOpen(false);
  }

  // Gera os dias do mês
  const firstDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();
  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Preenche até completar a grade
  while (cells.length % 7 !== 0) cells.push(null);

  const displayValue = selectedDate
    ? `${String(selectedDate.getDate()).padStart(2,'0')}/${String(selectedDate.getMonth()+1).padStart(2,'0')}/${selectedDate.getFullYear()}`
    : '';

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      {/* Input display */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          width: '100%', background: 'rgba(255,255,255,0.05)',
          border: `1px solid ${open ? 'rgba(0,229,255,0.40)' : 'rgba(255,255,255,0.08)'}`,
          borderRadius: 8, padding: '10px 12px',
          color: displayValue ? '#F3F4F6' : '#6B7280',
          fontSize: 13, fontFamily: 'Inter, sans-serif',
          cursor: 'pointer', transition: 'border-color 0.2s',
          boxSizing: 'border-box',
        }}
      >
        <Calendar size={14} color="#6B7280" style={{ flexShrink: 0 }} />
        <span style={{ flex: 1 }}>{displayValue || 'Selecione a data'}</span>
        <ChevronRight size={14} color="#6B7280" style={{ transform: open ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.2s' }} />
      </div>

      {/* Dropdown Calendar */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 999,
          background: '#1A1D22', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 12, padding: 16, width: 280,
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          animation: 'fadeIn 0.15s ease',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <button onClick={prevMonth} style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex' }}>
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#F3F4F6' }}>
              {MESES[viewDate.getMonth()]} {viewDate.getFullYear()}
            </span>
            <button onClick={nextMonth} style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex' }}>
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Dias da semana */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 6 }}>
            {DIAS_SEMANA.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, color: '#4B5563', padding: '4px 0' }}>{d}</div>
            ))}
          </div>

          {/* Células dos dias */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {cells.map((day, idx) => {
              if (!day) return <div key={idx} />;
              const isSelected = selectedDate &&
                selectedDate.getDate() === day &&
                selectedDate.getMonth() === viewDate.getMonth() &&
                selectedDate.getFullYear() === viewDate.getFullYear();
              const isToday = today.getDate() === day &&
                today.getMonth() === viewDate.getMonth() &&
                today.getFullYear() === viewDate.getFullYear();
              return (
                <button
                  key={idx}
                  onClick={() => selectDay(day)}
                  style={{
                    width: '100%', aspectRatio: '1', borderRadius: 6, border: 'none',
                    background: isSelected ? 'rgba(0,229,255,0.20)' : isToday ? 'rgba(255,255,255,0.06)' : 'transparent',
                    color: isSelected ? '#00E5FF' : isToday ? '#F3F4F6' : '#9CA3AF',
                    fontWeight: isSelected || isToday ? 600 : 400,
                    fontSize: 12, cursor: 'pointer',
                    outline: isSelected ? '1px solid rgba(0,229,255,0.40)' : 'none',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; }}
                  onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = isToday ? 'rgba(255,255,255,0.06)' : 'transparent'; }}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Botão Hoje */}
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
            <button
              onClick={() => { const t = new Date(); setViewDate(t); selectDay(t.getDate()); }}
              style={{ fontSize: 11, color: '#00E5FF', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
            >
              Hoje
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 8,
  padding: '10px 12px',
  color: '#F3F4F6',
  fontSize: 13,
  fontFamily: 'Inter, sans-serif',
  transition: 'border-color 0.2s',
};

export function CadastroPage() {
  const navigate = useNavigate();
  const tecnico  = getTecnicoFromStorage();

  const [nome,         setNome]         = useState('');
  const [cpf,          setCpf]          = useState('');
  const [cargo,        setCargo]        = useState('');
  const [motivo,       setMotivo]       = useState('');
  const [data,         setData]         = useState(new Date().toISOString().slice(0, 10));
  const [selectedEpis, setSelectedEpis] = useState<Set<string>>(new Set());
  const [loading,      setLoading]      = useState(false);
  const [msg,          setMsg]          = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const cargoInfo = cargo ? CARGO_EPI_MAP[cargo] : null;
  const cpfValido = validarCpf(cpf);

  // Quando o cargo muda, pré-seleciona todos os EPIs automaticamente
  useEffect(() => {
    if (cargoInfo) {
      setSelectedEpis(new Set(cargoInfo.epis));
    } else {
      setSelectedEpis(new Set());
    }
  }, [cargo]);

  function toggleEpi(epi: string) {
    setSelectedEpis(prev => {
      const next = new Set(prev);
      if (next.has(epi)) { next.delete(epi); } else { next.add(epi); }
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim())          { setMsg({ type: 'error', text: 'Informe o nome do colaborador.' }); return; }
    if (!cpfValido)            { setMsg({ type: 'error', text: 'CPF inválido.' }); return; }
    if (!cargo)                { setMsg({ type: 'error', text: 'Selecione o cargo.' }); return; }
    if (!motivo)               { setMsg({ type: 'error', text: 'Selecione o motivo.' }); return; }
    if (selectedEpis.size === 0) { setMsg({ type: 'error', text: 'Selecione ao menos um EPI.' }); return; }

    setLoading(true);
    setMsg(null);
    try {
      await criarSolicitacao({
        nome_colaborador:    nome.trim(),
        cpf,
        contrato:            cargoInfo!.contrato,
        motivo,
        data_solicitacao:    data,
        epis_esperados:      cargoInfo!.epis.filter(e => selectedEpis.has(e)),
        tecnico_responsavel: tecnico?.nome ?? 'Desconhecido',
      });
      setMsg({ type: 'success', text: 'Solicitação criada com sucesso!' });
      setTimeout(() => navigate('/'), 2000);
    } catch (err) {
      setMsg({ type: 'error', text: `Erro: ${(err as Error).message}` });
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <form onSubmit={handleSubmit}>
        {/* Card principal */}
        <div
          style={{
            background: 'rgba(36,40,45,0.85)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14,
            padding: 28,
            marginBottom: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
            <div
              style={{
                width: 3,
                height: 20,
                borderRadius: 2,
                background: 'linear-gradient(180deg, #00E5FF, rgba(0,229,255,0.50))',
              }}
            />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#F3F4F6' }}>
              Dados do Colaborador
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Nome */}
            <div style={{ gridColumn: '1 / -1' }}>
              <Field label="Nome completo">
                <div style={{ position: 'relative' }}>
                  <User size={14} color="#6B7280" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    value={nome}
                    onChange={e => setNome(e.target.value)}
                    placeholder="Ex: João Silva"
                    style={{ ...inputStyle, paddingLeft: 36 }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'rgba(0,229,255,0.40)'; }}
                    onBlur={e  => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                  />
                </div>
              </Field>
            </div>

            {/* CPF */}
            <Field label="CPF">
              <div style={{ position: 'relative' }}>
                <CreditCard size={14} color="#6B7280" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  value={cpf}
                  onChange={e => setCpf(formatCpf(e.target.value))}
                  placeholder="000.000.000-00"
                  style={{
                    ...inputStyle,
                    paddingLeft: 36,
                    borderColor: cpf.replace(/\D/g,'').length === 11
                      ? (cpfValido ? 'rgba(0,230,118,0.35)' : 'rgba(239,68,68,0.35)')
                      : 'rgba(255,255,255,0.08)',
                  }}
                />
              </div>
              {cpf.replace(/\D/g,'').length === 11 && !cpfValido && (
                <p style={{ fontSize: 11, color: '#EF4444', marginTop: 4 }}>CPF inválido</p>
              )}
            </Field>

            {/* Data */}
            <Field label="Data da Solicitação">
              <DatePicker value={data} onChange={setData} />
            </Field>

            {/* Cargo */}
            <div style={{ gridColumn: '1 / -1' }}>
              <Field label="Cargo / Contrato">
                <div style={{ position: 'relative' }}>
                  <Briefcase size={14} color="#6B7280" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                  <select
                    value={cargo}
                    onChange={e => setCargo(e.target.value)}
                    style={{
                      ...inputStyle,
                      paddingLeft: 36,
                      appearance: 'none',
                      cursor: 'pointer',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'rgba(0,229,255,0.40)'; }}
                    onBlur={e  => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                  >
                    <option value="" style={{ background: '#1E2328' }}>Selecione o cargo...</option>
                    {CARGOS.map(c => (
                      <option key={c} value={c} style={{ background: '#1E2328' }}>{c}</option>
                    ))}
                  </select>
                </div>
              </Field>
            </div>

            {/* Motivo */}
            <div style={{ gridColumn: '1 / -1' }}>
              <Field label="Motivo da devolução">
                <div style={{ position: 'relative' }}>
                  <FileText size={14} color="#6B7280" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                  <select
                    value={motivo}
                    onChange={e => setMotivo(e.target.value)}
                    style={{
                      ...inputStyle,
                      paddingLeft: 36,
                      appearance: 'none',
                      cursor: 'pointer',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'rgba(0,229,255,0.40)'; }}
                    onBlur={e  => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                  >
                    <option value="" style={{ background: '#1E2328' }}>Selecione o motivo...</option>
                    {MOTIVOS.map(m => (
                      <option key={m} value={m} style={{ background: '#1E2328' }}>{m}</option>
                    ))}
                  </select>
                </div>
              </Field>
            </div>
          </div>
        </div>

        {/* EPIs esperados */}
        {cargoInfo && (
          <div
            style={{
              background: 'rgba(36,40,45,0.85)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 14,
              padding: 28,
              marginBottom: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ width: 3, height: 20, borderRadius: 2, background: 'linear-gradient(180deg, #00E676, rgba(0,230,118,0.50))' }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: '#F3F4F6' }}>EPIs a Devolver</span>
              <span
                style={{
                  padding: '2px 8px', borderRadius: 20,
                  background: 'rgba(0,229,255,0.08)', color: '#00E5FF',
                  fontSize: 11, fontWeight: 600,
                }}
              >
                {selectedEpis.size}/{cargoInfo.epis.length} selecionados
              </span>
              {/* Selecionar / desmarcar todos */}
              <button
                type="button"
                onClick={() => {
                  if (selectedEpis.size === cargoInfo.epis.length) {
                    setSelectedEpis(new Set());
                  } else {
                    setSelectedEpis(new Set(cargoInfo.epis));
                  }
                }}
                style={{
                  marginLeft: 'auto', padding: '3px 10px', borderRadius: 8,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#9CA3AF', fontSize: 11, cursor: 'pointer',
                }}
              >
                {selectedEpis.size === cargoInfo.epis.length ? 'Desmarcar todos' : 'Selecionar todos'}
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {cargoInfo.epis.map((epi) => {
                const checked = selectedEpis.has(epi);
                return (
                  <button
                    key={epi}
                    type="button"
                    onClick={() => toggleEpi(epi)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '11px 14px',
                      borderRadius: 8,
                      background: checked ? 'rgba(0,230,118,0.08)' : 'rgba(255,255,255,0.03)',
                      border: checked ? '1px solid rgba(0,230,118,0.25)' : '1px solid rgba(255,255,255,0.07)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                      width: '100%',
                    }}
                  >
                    {/* Checkbox visual */}
                    <div
                      style={{
                        width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                        border: checked ? '1px solid rgba(0,230,118,0.60)' : '1px solid rgba(255,255,255,0.20)',
                        background: checked ? '#00E676' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {checked && <Check size={11} color="#0E1214" strokeWidth={3} />}
                    </div>
                    <span style={{ fontSize: 13, color: checked ? '#F3F4F6' : '#9CA3AF', fontWeight: checked ? 500 : 400 }}>
                      {epi}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Mensagem */}
        {msg && (
          <div
            className="toast-slide-in"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 16px',
              borderRadius: 10,
              marginBottom: 16,
              background: msg.type === 'success'
                ? 'rgba(0,230,118,0.10)' : 'rgba(239,68,68,0.10)',
              border: `1px solid ${msg.type === 'success'
                ? 'rgba(0,230,118,0.25)' : 'rgba(239,68,68,0.25)'}`,
              color: msg.type === 'success' ? '#00E676' : '#EF4444',
              fontSize: 13,
            }}
          >
            {msg.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
            {msg.text}
          </div>
        )}

        {/* Ações */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            type="button"
            onClick={() => navigate('/')}
            style={{
              padding: '11px 24px',
              borderRadius: 8,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#9CA3AF',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '11px 28px',
              borderRadius: 8,
              background: 'linear-gradient(135deg, rgba(0,229,255,0.18), rgba(0,229,255,0.08))',
              border: '1px solid rgba(0,229,255,0.35)',
              color: '#00E5FF',
              fontSize: 13,
              fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              transition: 'box-shadow 0.2s ease',
            }}
            onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLElement).style.boxShadow = '0 0 20px rgba(0,229,255,0.35)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
          >
            {loading ? (
              <span
                className="animate-spin"
                style={{ width: 14, height: 14, border: '2px solid #00E5FF', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block' }}
              />
            ) : (
              <Send size={14} />
            )}
            {loading ? 'Enviando...' : 'Criar Solicitação'}
          </button>
        </div>
      </form>
    </div>
  );
}
