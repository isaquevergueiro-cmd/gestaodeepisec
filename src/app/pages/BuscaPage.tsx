import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Search, QrCode, X, Clock, ArrowRight, User, AlertCircle } from 'lucide-react';
import { buscarPorCpf, buscarPorNome, getDashboard } from '../../api';
import { formatCpf, validarCpf } from '../../utils';
import type { ConferenciaData } from '../../types';

const HISTORY_KEY = 'epi_busca_history';

interface SearchResult {
  id_monday: string;
  nome: string;
  cpf: string;
  epis_esperados: string[];
  is_retorno?: boolean;
  epis_ja_devolvidos?: string[];
}

interface RecenteItem {
  id: string;
  nome: string;
  cpf: string;
  epis_esperados: string;
  data: string | null;
}

export function BuscaPage() {
  const navigate = useNavigate();
  const [searchMode, setSearchMode] = useState<'cpf' | 'nome'>('cpf');
  const [cpf,      setCpf]      = useState('');
  const [nome,     setNome]     = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [results,  setResults]  = useState<SearchResult[]>([]);
  const [result,   setResult]   = useState<SearchResult | null>(null);
  const [history,  setHistory]  = useState<string[]>([]);
  const [recentes, setRecentes] = useState<RecenteItem[]>([]);
  const [qrActive, setQrActive] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<InstanceType<typeof import('html5-qrcode').Html5Qrcode> | null>(null);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
      setHistory(Array.isArray(stored) ? stored : []);
    } catch { setHistory([]); }

    getDashboard().then(data => {
      const recentesFormatados = data.pendentes_list.slice(0, 5).map(item => ({
        id: item.id,
        nome: item.nome,
        cpf: item.cpf || '',
        epis_esperados: item.epis_esperados || '',
        data: item.data || null
      }));
      setRecentes(recentesFormatados); // Últimas 5 solicitacoes
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!qrActive) return;
    let scanner: typeof scannerRef.current;

    import('html5-qrcode').then(({ Html5Qrcode }) => {
      scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;
      scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 220 },
        (decoded) => {
          stopScanner();
          const cpfFound = decoded.replace(/\D/g, '').slice(0, 11);
          setCpf(formatCpf(cpfFound));
          handleSearch(cpfFound);
        },
        () => {},
      ).catch(() => setError('Não foi possível acessar a câmera.'));
    });

    return () => { stopScanner(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrActive]);

  function stopScanner() {
    scannerRef.current?.stop().catch(() => {}).finally(() => {
      scannerRef.current = null;
      setQrActive(false);
    });
  }

  async function handleSearch(rawCpf?: string) {
    let target = '';
    if (searchMode === 'cpf') {
      target = rawCpf ?? cpf.replace(/\D/g, '');
      if (!validarCpf(target)) { setError('CPF inválido.'); return; }
    } else {
      target = nome.trim();
      if (target.length < 3) { setError('Digite pelo menos 3 letras.'); return; }
    }

    setLoading(true);
    setError('');
    setResult(null);
    setResults([]);
    try {
      let dataList: any[] = [];
      if (searchMode === 'cpf') {
        dataList = await buscarPorCpf(formatCpf(target));
        // Salva histórico de CPF
        const cpfFmt = formatCpf(target);
        const newHistory = [cpfFmt, ...history.filter(h => h !== cpfFmt)].slice(0, 5);
        setHistory(newHistory);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
      } else {
        dataList = await buscarPorNome(target);
      }

      const resList: SearchResult[] = dataList.map((data: any) => {
        const epis = data.epis_esperados_string
          ? data.epis_esperados_string
              .split(/\n|,\s*/)
              .map((e: string) => e.trim())
              .filter(Boolean)
          : [];
        return {
          id_monday: data.id_monday,
          nome: data.nome,
          cpf: data.cpf || 'Não informado',
          epis_esperados: epis,
          is_retorno: data.is_retorno ?? false,
          epis_ja_devolvidos: data.epis_ja_devolvidos ?? [],
        };
      });

      if (resList.length === 1) {
        setResult(resList[0]);
      } else {
        setResults(resList);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function selecionarResultado(res: SearchResult) {
    setResult(res);
    setResults([]);
  }

  function iniciarConferencia(dadosBusca?: SearchResult, dadosRecente?: RecenteItem) {
    let dados: ConferenciaData;
    if (dadosBusca) {
      dados = {
        id_monday:          dadosBusca.id_monday,
        nome:               dadosBusca.nome,
        cpf:                dadosBusca.cpf,
        epis_esperados:     dadosBusca.epis_esperados,
        is_retorno:         dadosBusca.is_retorno,
        epis_ja_devolvidos: dadosBusca.epis_ja_devolvidos,
      };
    } else if (dadosRecente) {
      dados = {
        id_monday:      dadosRecente.id,
        nome:           dadosRecente.nome,
        cpf:            dadosRecente.cpf,
        epis_esperados: dadosRecente.epis_esperados.split(',').map(e => e.trim()).filter(Boolean),
      };
    } else {
      return;
    }
    
    if (dados.is_retorno) {
      navigate('/devolutiva', { state: dados });
    } else {
      navigate('/conferencia', { state: dados });
    }
  }

  return (
    <div style={{ maxWidth: 640 }}>
      {/* Card de busca */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ width: 3, height: 20, borderRadius: 2, background: 'linear-gradient(180deg, #00E5FF, rgba(0,229,255,0.50))' }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: '#F3F4F6' }}>Busca</span>
          <div style={{ display: 'flex', marginLeft: 'auto', background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: 4 }}>
            <button
              onClick={() => { setSearchMode('cpf'); setResult(null); setResults([]); setError(''); }}
              style={{
                padding: '4px 12px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: searchMode === 'cpf' ? 600 : 400,
                color: searchMode === 'cpf' ? '#00E5FF' : '#9CA3AF',
                background: searchMode === 'cpf' ? 'rgba(0,229,255,0.1)' : 'transparent',
                cursor: 'pointer',
                border: 'none',
              }}
            >
              CPF
            </button>
            <button
              onClick={() => { setSearchMode('nome'); setResult(null); setResults([]); setError(''); setQrActive(false); }}
              style={{
                padding: '4px 12px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: searchMode === 'nome' ? 600 : 400,
                color: searchMode === 'nome' ? '#00E5FF' : '#9CA3AF',
                background: searchMode === 'nome' ? 'rgba(0,229,255,0.1)' : 'transparent',
                cursor: 'pointer',
                border: 'none',
              }}
            >
              Nome
            </button>
          </div>
        </div>

        {/* Input */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8,
              padding: '10px 14px',
            }}
          >
            <Search size={15} color="#6B7280" />
            <input
              type="text"
              value={searchMode === 'cpf' ? cpf : nome}
              onChange={e => { 
                if (searchMode === 'cpf') setCpf(formatCpf(e.target.value)); 
                else setNome(e.target.value);
                setError(''); setResult(null); setResults([]);
              }}
              onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
              placeholder={searchMode === 'cpf' ? "000.000.000-00" : "Nome do colaborador"}
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                outline: 'none',
                color: '#F3F4F6',
                fontSize: 15,
                letterSpacing: searchMode === 'cpf' ? 1 : 0,
                fontFamily: 'Inter, sans-serif',
              }}
            />
            {((searchMode === 'cpf' && cpf) || (searchMode === 'nome' && nome)) && (
              <button onClick={() => { if(searchMode === 'cpf') setCpf(''); else setNome(''); setResult(null); setResults([]); setError(''); }}>
                <X size={14} color="#6B7280" />
              </button>
            )}
          </div>

          <button
            onClick={() => handleSearch()}
            disabled={loading}
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              background: 'linear-gradient(135deg, rgba(0,229,255,0.18), rgba(0,229,255,0.08))',
              border: '1px solid rgba(0,229,255,0.35)',
              color: '#00E5FF',
              fontSize: 13,
              fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {loading ? (
              <span className="animate-spin" style={{ width: 14, height: 14, border: '2px solid #00E5FF', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block' }} />
            ) : (
              <Search size={14} />
            )}
            Buscar
          </button>

          {searchMode === 'cpf' && (
            <button
              onClick={() => setQrActive(v => !v)}
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                background: qrActive ? 'rgba(0,229,255,0.15)' : 'rgba(255,255,255,0.05)',
                border: qrActive ? '1px solid rgba(0,229,255,0.30)' : '1px solid rgba(255,255,255,0.08)',
                color: qrActive ? '#00E5FF' : '#6B7280',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <QrCode size={16} />
            </button>
          )}
        </div>

        {/* QR reader */}
        {qrActive && (
          <div style={{ marginBottom: 12 }}>
            <div
              id="qr-reader"
              ref={qrRef}
              style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(0,229,255,0.20)' }}
            />
            <button
              onClick={stopScanner}
              style={{
                marginTop: 8,
                padding: '6px 14px',
                borderRadius: 8,
                background: 'rgba(239,68,68,0.10)',
                border: '1px solid rgba(239,68,68,0.25)',
                color: '#EF4444',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Fechar câmera
            </button>
          </div>
        )}

        {/* Erro */}
        {error && (
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 14px', borderRadius: 8,
              background: 'rgba(239,68,68,0.10)',
              border: '1px solid rgba(239,68,68,0.25)',
              color: '#EF4444', fontSize: 13,
            }}
          >
            <AlertCircle size={13} />
            {error}
          </div>
        )}
      </div>

      {/* Histórico */}
      {history.length > 0 && !result && results.length === 0 && searchMode === 'cpf' && (
        <div
          style={{
            background: 'rgba(36,40,45,0.85)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14,
            padding: 20,
            marginBottom: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <Clock size={13} color="#6B7280" />
            <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 500 }}>Buscas recentes</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {history.map(h => (
              <button
                key={h}
                onClick={() => { setCpf(h); handleSearch(h.replace(/\D/g, '')); }}
                style={{
                  padding: '5px 12px',
                  borderRadius: 20,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#9CA3AF',
                  fontSize: 12,
                  cursor: 'pointer',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {h}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Recentes */}
      {recentes.length > 0 && !result && results.length === 0 && (
        <div
          style={{
            background: 'rgba(36,40,45,0.85)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14,
            padding: 20,
            marginBottom: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <Clock size={13} color="#6B7280" />
            <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 500 }}>Adicionados recentemente</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recentes.map((r, i) => (
              <div
                key={i}
                onClick={() => iniciarConferencia(undefined, r)}
                style={{
                  padding: '12px 16px',
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#F3F4F6' }}>{r.nome}</div>
                  <div style={{ fontSize: 11, color: '#6B7280' }}>CPF: {r.cpf || 'Não informado'}</div>
                </div>
                <ArrowRight size={14} color="#6B7280" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resultados de Busca por Nome */}
      {results.length > 0 && !result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 4 }}>
            {results.length} encontrado(s). Selecione o colaborador:
          </div>
          {results.map((r, i) => (
            <div
              key={i}
              onClick={() => selecionarResultado(r)}
              style={{
                background: 'rgba(36,40,45,0.85)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 14,
                padding: 16,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                transition: 'background 0.2s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(36,40,45,0.85)'; }}
            >
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(0,229,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <User size={16} color="#00E5FF" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#F3F4F6', marginBottom: 2 }}>{r.nome}</div>
                <div style={{ fontSize: 12, color: '#6B7280' }}>CPF: {r.cpf || 'Não informado'}</div>
              </div>
              <ArrowRight size={16} color="#6B7280" />
            </div>
          ))}
        </div>
      )}

      {/* Resultado */}
      {result && (
        <div
          className="toast-slide-in"
          style={{
            background: 'rgba(36,40,45,0.85)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(0,230,118,0.25)',
            borderRadius: 14,
            padding: 24,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(0,229,255,0.15), rgba(0,230,118,0.15))',
                border: '1px solid rgba(0,229,255,0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <User size={20} color="#00E5FF" />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#F3F4F6', marginBottom: 2 }}>{result.nome}</div>
              <div style={{ fontSize: 12, color: '#6B7280', fontVariantNumeric: 'tabular-nums' }}>CPF: {result.cpf}</div>
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: '#4B5563', marginBottom: 10 }}>
              EPIs a devolver ({result.epis_esperados.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {result.epis_esperados.map((epi, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: 'rgba(0,229,255,0.04)',
                    border: '1px solid rgba(0,229,255,0.08)',
                  }}
                >
                  <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,229,255,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#00E5FF', flexShrink: 0 }}>
                    {i + 1}
                  </span>
                  <span style={{ fontSize: 12, color: '#F3F4F6' }}>{epi}</span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => iniciarConferencia(result)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '13px', borderRadius: 10,
              background: result.is_retorno
                ? 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.08))'
                : 'linear-gradient(135deg, rgba(0,230,118,0.15), rgba(0,230,118,0.08))',
              border: result.is_retorno ? '1px solid rgba(245,158,11,0.30)' : '1px solid rgba(0,230,118,0.30)',
              color: result.is_retorno ? '#F59E0B' : '#00E676',
              fontSize: 14, fontWeight: 600, cursor: 'pointer', justifyContent: 'center', transition: 'box-shadow 0.2s ease',
            }}
          >
            {result.is_retorno ? '⏳ Registrar Devolutiva de Pendências' : 'Iniciar Conferência de EPIs'}
            <ArrowRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
