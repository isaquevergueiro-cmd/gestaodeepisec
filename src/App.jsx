import { useState } from "react";
import Login from "./screens/Login";
import Cadastro from "./screens/Cadastro";
import Busca from "./screens/Busca";
import Conferencia from "./screens/Conferencia";
import "./App.css";

export default function App() {
  const [tecnico, setTecnico] = useState(null);
  const [screen, setScreen] = useState("cadastro");
  const [conferenciaDados, setConferenciaDados] = useState(null);

  if (!tecnico) {
    return <Login onLogin={setTecnico} />;
  }

  function irParaConferencia(dados) {
    setConferenciaDados(dados);
    setScreen("conferencia");
  }

  function voltarParaBusca() {
    setConferenciaDados(null);
    setScreen("busca");
  }

  function handleLogout() {
    setTecnico(null);
    setScreen("cadastro");
    setConferenciaDados(null);
  }

  return (
    <div className="app">
      <nav className="nav">
        <div className="nav-brand">
          <span className="nav-icon">🦺</span>
          <span className="nav-title">Gestão de EPIs</span>
          <span className="nav-divider" />
          <span className="nav-sub">SESMT</span>
        </div>

        {screen !== "conferencia" && (
          <div className="nav-tabs">
            <button
              className={`nav-tab ${screen === "cadastro" ? "active" : ""}`}
              onClick={() => setScreen("cadastro")}
            >
              Cadastro
            </button>
            <button
              className={`nav-tab ${screen === "busca" ? "active" : ""}`}
              onClick={() => setScreen("busca")}
            >
              Check-in / Busca
            </button>
          </div>
        )}

        {screen === "conferencia" && conferenciaDados && (
          <span className="nav-context">
            Conferência — {conferenciaDados.nome}
          </span>
        )}

        <div className="nav-user">
          <span className="nav-tecnico">{tecnico}</span>
          <button className="btn-logout" onClick={handleLogout}>
            Sair
          </button>
        </div>
      </nav>

      <main className="screen">
        {screen === "cadastro" && <Cadastro tecnico={tecnico} />}
        {screen === "busca" && (
          <Busca onIniciarConferencia={irParaConferencia} />
        )}
        {screen === "conferencia" && conferenciaDados && (
          <Conferencia
            dados={conferenciaDados}
            tecnico={tecnico}
            onVoltar={voltarParaBusca}
          />
        )}
      </main>
    </div>
  );
}
