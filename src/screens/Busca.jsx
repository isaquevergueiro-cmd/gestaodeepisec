import { useState, useEffect } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { buscarPorCpf } from "../api";
import { formatCpf, validarCpf } from "../utils";

export default function Busca({ onIniciarConferencia }) {
  const [cpf, setCpf] = useState("");
  const [resultado, setResultado] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [ultimasSolicitacoes, setUltimasSolicitacoes] = useState([]);

  useEffect(() => {
    // Carrega últimas solicitações feitas no tablet
    const historico = JSON.parse(localStorage.getItem("epi_history_busca") || "[]");
    setUltimasSolicitacoes(historico);
  }, []);

  useEffect(() => {
    let scanner = null;
    if (isScanning) {
      scanner = new Html5QrcodeScanner("reader", {
        fps: 10,
        qrbox: { width: 250, height: 250 },
      });

      scanner.render(
        (decodedText) => {
          scanner.clear();
          setIsScanning(false);
          const formatted = formatCpf(decodedText);
          setCpf(formatted);
          handleBuscar(null, formatted);
        },
        (error) => {
          // Ignora erros de leitura de frame contínuo
        }
      );
    }

    return () => {
      if (scanner) scanner.clear().catch(console.error);
    };
  }, [isScanning]);

  async function handleBuscar(e, directCpf = null) {
    if (e) e.preventDefault();
    const searchCpf = directCpf || cpf;
    if (!searchCpf) return;

    if (!validarCpf(searchCpf)) {
      setErro("CPF inválido. Corrija a digitação.");
      return;
    }

    setLoading(true);
    setErro(null);
    setResultado(null);
    try {
      const data = await buscarPorCpf(searchCpf);
      setResultado(data);
    } catch (err) {
      setErro(`Colaborador não encontrado ou erro de rede.`);
    } finally {
      setLoading(false);
    }
  }

  function handleConferencia(itemResult = null) {
    const res = itemResult || resultado;
    
    // Salva ou atualiza histórico
    const newItem = { cpf: res.cpf || cpf, nome: res.nome, data: new Date().toISOString() };
    const maxItems = 5;
    const historicoLocal = JSON.parse(localStorage.getItem("epi_history_busca") || "[]");
    const updated = [newItem, ...historicoLocal.filter(x => x.cpf !== newItem.cpf)].slice(0, maxItems);
    localStorage.setItem("epi_history_busca", JSON.stringify(updated));
    setUltimasSolicitacoes(updated);

    onIniciarConferencia({
      id_monday: res.id_monday,
      nome: res.nome,
      cpf: res.cpf || cpf,
      epis_esperados: res.epis_esperados_string ? res.epis_esperados_string.split(", ").filter(Boolean) : [],
    });
  }

  return (
    <div>
      <div className="card">
        <h2 className="card-title">Buscar Colaborador por CPF</h2>
        <form onSubmit={handleBuscar} className="search-box">
          <input
            required
            value={cpf}
            maxLength={14}
            onChange={(e) => {
              setCpf(formatCpf(e.target.value));
              setResultado(null);
              setErro(null);
            }}
            placeholder="000.000.000-00"
            inputMode="numeric"
          />
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Buscando..." : "Buscar"}
          </button>
          {!isScanning && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setResultado(null);
                setErro(null);
                setIsScanning(true);
              }}
            >
              Ler Crachá
            </button>
          )}
        </form>

        {isScanning && (
          <div className="scanner-container" style={{ marginTop: "1rem" }}>
            <div id="reader" style={{ width: "100%", maxWidth: "400px", margin: "0 auto" }}></div>
            <button
              className="btn btn-secondary"
              style={{ marginTop: "1rem" }}
              onClick={() => setIsScanning(false)}
            >
              Cancelar Leitura
            </button>
          </div>
        )}

        {erro && <div className="alert alert-error">{erro}</div>}

        {resultado && (
          <div className="search-result">
            <h3>{resultado.nome}</h3>
            <p className="search-result-cpf">CPF: {cpf}</p>
            <p className="search-result-epis">
              <strong>EPIs esperados:</strong> {resultado.epis_esperados_string}
            </p>
            <button className="btn btn-primary" onClick={() => handleConferencia(null)}>
              Iniciar Conferência →
            </button>
          </div>
        )}
      </div>

      {ultimasSolicitacoes.length > 0 && (
        <div className="card" style={{ marginTop: "1rem" }}>
          <h3 className="card-title">Últimas Buscas Neste Dispositivo</h3>
          <ul className="history-list">
            {ultimasSolicitacoes.map(item => (
              <li key={item.cpf} className="history-item">
                <div className="history-item-info">
                  <strong>{item.nome}</strong>
                  <span>CPF: {item.cpf} &nbsp;·&nbsp; {new Date(item.data).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <button
                  className="btn-secondary"
                  style={{ padding: "0.4em 1em", minHeight: "unset", fontSize: "0.85rem" }}
                  onClick={() => {
                    setCpf(item.cpf);
                    handleBuscar(null, item.cpf);
                  }}
                >
                  Carregar
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
