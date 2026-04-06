import { useState } from "react";
import { TECNICOS } from "../data/tecnicos";

export default function Login({ onLogin }) {
  const [tecnico, setTecnico] = useState("");
  const [pin, setPin] = useState("");
  const [erro, setErro] = useState(null);

  function handleSubmit(e) {
    e.preventDefault();
    const found = TECNICOS.find((t) => t.nome === tecnico && t.pin === pin);
    if (found) {
      onLogin(found.nome);
    } else {
      setErro("Técnico ou PIN inválido. Tente novamente.");
      setPin("");
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo">🦺</div>
        <h1 className="login-title">Gestão de EPIs</h1>
        <p className="login-subtitle">SESMT — Identifique-se para continuar</p>

        {erro && <div className="alert alert-error">{erro}</div>}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label>Técnico Responsável</label>
            <select
              required
              value={tecnico}
              onChange={(e) => { setTecnico(e.target.value); setErro(null); }}
            >
              <option value="">Selecione seu nome...</option>
              {TECNICOS.map((t) => (
                <option key={t.nome} value={t.nome}>{t.nome}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>PIN</label>
            <input
              type="password"
              required
              value={pin}
              onChange={(e) => { setPin(e.target.value.replace(/\D/g, "").slice(0, 4)); setErro(null); }}
              placeholder="••••"
              inputMode="numeric"
              maxLength={4}
              className="pin-input"
            />
          </div>

          <button type="submit" className="btn btn-primary login-btn">
            Entrar
          </button>
        </form>

        <p className="login-footer">Plataforma de Devolução de EPIs v1.0</p>
      </div>
    </div>
  );
}
