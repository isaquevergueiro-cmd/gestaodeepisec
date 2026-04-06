import { useState } from "react";
import { CARGO_EPI_MAP, CARGOS, MOTIVOS } from "../catalog";
import { criarSolicitacao } from "../api";
import { formatCpf, validarCpf } from "../utils";

const hoje = new Date().toISOString().slice(0, 10);

export default function Cadastro({ tecnico }) {
  const [form, setForm] = useState({
    nome_colaborador: "",
    cpf: "",
    cargo: "",
    motivo: "",
    data_solicitacao: hoje,
  });
  const [episSelecionados, setEpisSelecionados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  function handleCargoChange(cargo) {
    setForm((f) => ({ ...f, cargo }));
    setEpisSelecionados(cargo ? [...CARGO_EPI_MAP[cargo].epis] : []);
  }

  function toggleEpi(epi) {
    setEpisSelecionados((prev) =>
      prev.includes(epi) ? prev.filter((e) => e !== epi) : [...prev, epi]
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validarCpf(form.cpf)) {
      setMsg({ type: "error", text: "O CPF informado é inválido. Corrija para continuar." });
      return;
    }
    if (!form.cargo || episSelecionados.length === 0) {
      setMsg({ type: "error", text: "Selecione ao menos um EPI." });
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      await criarSolicitacao({
        nome_colaborador: form.nome_colaborador,
        cpf: form.cpf,
        contrato: CARGO_EPI_MAP[form.cargo].contrato,
        motivo: form.motivo,
        data_solicitacao: form.data_solicitacao,
        epis_esperados: episSelecionados,
        tecnico_responsavel: tecnico,
      });
      setMsg({ type: "success", text: "Solicitação registrada com sucesso!" });
      setForm({ nome_colaborador: "", cpf: "", cargo: "", motivo: "", data_solicitacao: hoje });
      setEpisSelecionados([]);
    } catch (err) {
      setMsg({ type: "error", text: `Erro ao registrar: ${err.message}` });
    } finally {
      setLoading(false);
    }
  }

  const episDisponiveis = form.cargo ? CARGO_EPI_MAP[form.cargo].epis : [];

  return (
    <form onSubmit={handleSubmit}>
      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <div className="card">
        <h2 className="card-title">Dados do Colaborador</h2>
        <div className="form-grid">
          <div className="form-group full">
            <label>Nome Completo</label>
            <input
              required
              value={form.nome_colaborador}
              onChange={(e) => setForm((f) => ({ ...f, nome_colaborador: e.target.value }))}
              placeholder="Nome do colaborador"
            />
          </div>
          <div className="form-group">
            <label>CPF</label>
            <input
              required
              value={form.cpf}
              maxLength={14}
              onChange={(e) => setForm((f) => ({ ...f, cpf: formatCpf(e.target.value) }))}
              placeholder="000.000.000-00"
              inputMode="numeric"
            />
          </div>
          <div className="form-group">
            <label>Data da Solicitação</label>
            <input
              type="date"
              required
              value={form.data_solicitacao}
              onChange={(e) => setForm((f) => ({ ...f, data_solicitacao: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label>Cargo / Contrato</label>
            <select
              required
              value={form.cargo}
              onChange={(e) => handleCargoChange(e.target.value)}
            >
              <option value="">Selecione...</option>
              {CARGOS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Motivo</label>
            <select
              required
              value={form.motivo}
              onChange={(e) => setForm((f) => ({ ...f, motivo: e.target.value }))}
            >
              <option value="">Selecione...</option>
              {MOTIVOS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {episDisponiveis.length > 0 && (
        <div className="card">
          <h2 className="card-title">EPIs a Devolver</h2>
          <p className="hint">Todos marcados por padrão. Desmarque os que não se aplicam.</p>
          <div className="epi-list">
            {episDisponiveis.map((epi, i) => {
              const checked = episSelecionados.includes(epi);
              return (
                <label key={i} className={`epi-checkbox ${checked ? "checked" : ""}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleEpi(epi)}
                  />
                  <span>{epi}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading && <span className="loading" />}
          {loading ? "Enviando..." : "Registrar Solicitação"}
        </button>
      </div>
    </form>
  );
}
