import { useState } from "react";
import { buscarPorCpf } from "../api";
import { formatCpf } from "../utils";

export default function Busca({ onIniciarConferencia }) {
  const [cpf, setCpf] = useState("");
  const [resultado, setResultado] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);

  async function handleBuscar(e) {
    e.preventDefault();
    setLoading(true);
    setErro(null);
    setResultado(null);
    try {
      const data = await buscarPorCpf(cpf);
      setResultado(data);
    } catch (err) {
      setErro(`Colaborador não encontrado. Verifique o CPF e tente novamente.`);
    } finally {
      setLoading(false);
    }
  }

  function handleConferencia() {
    onIniciarConferencia({
      id_monday: resultado.id_monday,
      nome: resultado.nome,
      cpf,
      epis_esperados: resultado.epis_esperados_string.split(", "),
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
        </form>

        {erro && <div className="alert alert-error">{erro}</div>}

        {resultado && (
          <div className="search-result">
            <h3>{resultado.nome}</h3>
            <p className="search-result-cpf">CPF: {cpf}</p>
            <p className="search-result-epis">
              <strong>EPIs esperados:</strong> {resultado.epis_esperados_string}
            </p>
            <button className="btn btn-primary" onClick={handleConferencia}>
              Iniciar Conferência →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
