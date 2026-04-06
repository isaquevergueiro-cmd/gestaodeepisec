import { useState, useEffect, useCallback } from "react";
import { getOfflineQueueCount, syncOfflineQueue } from "./api";
import Login from "./screens/Login";
import Cadastro from "./screens/Cadastro";
import Busca from "./screens/Busca";
import Conferencia from "./screens/Conferencia";
import Dashboard from "./screens/Dashboard";
import "./App.css";

export default function App() {
  const [tecnico, setTecnico] = useState(null);
  const [screen, setScreen] = useState("cadastro");
  const [conferenciaDados, setConferenciaDados] = useState(null);
  const [offlineCount, setOfflineCount] = useState(0);

  // --- Sincronização Offline ---
  const attemptSync = useCallback(async () => {
    if (navigator.onLine) {
      await syncOfflineQueue();
    }
    const count = await getOfflineQueueCount();
    setOfflineCount(count);
  }, []);

  useEffect(() => {
    attemptSync();
    const interval = setInterval(attemptSync, 30_000);
    window.addEventListener("online", attemptSync);
    return () => {
      clearInterval(interval);
      window.removeEventListener("online", attemptSync);
    };
  }, [attemptSync]);

  // --- Timeout de Sessão (10 minutos) ---
  const handleLogout = useCallback(() => {
    setTecnico(null);
    setScreen("cadastro");
    setConferenciaDados(null);
  }, []);

  useEffect(() => {
    if (!tecnico) return;

    let timeoutId;
    const resetTimeout = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        handleLogout();
        alert("Sessão encerrada por inatividade.");
      }, 10 * 60 * 1000);
    };

    resetTimeout();
    window.addEventListener("mousemove", resetTimeout);
    window.addEventListener("keypress", resetTimeout);
    window.addEventListener("touchstart", resetTimeout);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("mousemove", resetTimeout);
      window.removeEventListener("keypress", resetTimeout);
      window.removeEventListener("touchstart", resetTimeout);
    };
  }, [tecnico, handleLogout]);

  if (!tecnico) {
    return <Login onLogin={setTecnico} />;
  }

  function irParaConferencia(dados) {
    setConferenciaDados(dados);
    setScreen("conferencia");
  }

  function voltarParaBusca(isOfflineSave = false) {
    setConferenciaDados(null);
    setScreen("busca");
    if (isOfflineSave) {
      attemptSync(); // Atualiza a badge imediatamente após salvar local
    }
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
            <button
              className={`nav-tab ${screen === "dashboard" ? "active" : ""}`}
              onClick={() => setScreen("dashboard")}
            >
              Gerência
            </button>
          </div>
        )}

        {screen === "conferencia" && conferenciaDados && (
          <span className="nav-context">
            Conferência — {conferenciaDados.nome}
          </span>
        )}

        {offlineCount > 0 && (
          <span className="nav-offline-badge" title={`${offlineCount} itens aguardando envio`}>
            ☁️ {offlineCount} pendente(s)
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
        {screen === "dashboard" && <Dashboard />}
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
