import { useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { salvarBaixa } from "../api";

const STATUS_LABELS = {
  devolvido: "✓ Devolvido",
  faltante: "✗ Faltante",
  avariado: "⚠ Avariado",
};

export default function Conferencia({ dados, tecnico, onVoltar }) {
  const { id_monday, nome, cpf, epis_esperados } = dados;

  const [statusMap, setStatusMap] = useState(() =>
    Object.fromEntries(epis_esperados.map((_, i) => [i, null]))
  );
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const sigRef = useRef(null);

  function setStatus(index, status) {
    setStatusMap((prev) => ({
      ...prev,
      [index]: prev[index] === status ? null : status,
    }));
  }

  const todosAvaliados = Object.values(statusMap).every((s) => s !== null);

  async function handleFinalizar() {
    if (!todosAvaliados) {
      setMsg({ type: "error", text: "Avalie todos os EPIs antes de finalizar." });
      return;
    }
    if (!sigRef.current || sigRef.current.isEmpty()) {
      setMsg({ type: "error", text: "A assinatura do colaborador é obrigatória." });
      return;
    }

    const epis_problema = epis_esperados.filter((_, i) => statusMap[i] !== "devolvido");
    const assinatura_base64 = sigRef.current.toDataURL("image/png");

    setLoading(true);
    setMsg(null);
    try {
      await salvarBaixa({
        id_monday,
        cpf,
        epis_problema,
        assinatura_base64,
        tecnico_responsavel: tecnico,
      });
      setMsg({ type: "success", text: "Conferência finalizada com sucesso! PDF gerado." });
      setTimeout(onVoltar, 2500);
    } catch (err) {
      setMsg({ type: "error", text: `Erro ao finalizar: ${err.message}` });
      setLoading(false);
    }
  }

  const problemasCount = Object.values(statusMap).filter(
    (s) => s !== null && s !== "devolvido"
  ).length;

  return (
    <div>
      <div className="card">
        <div className="conferencia-header">
          <button className="btn btn-outline" onClick={onVoltar}>
            ← Voltar
          </button>
          <div>
            <h2 className="colaborador-nome">{nome}</h2>
            <p className="colaborador-cpf">CPF: {cpf}</p>
          </div>
          {problemasCount > 0 && (
            <span className="badge-problema">{problemasCount} problema(s)</span>
          )}
        </div>
      </div>

      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <div className="card">
        <h3 className="card-title">Conferência de EPIs</h3>
        {epis_esperados.map((epi, i) => {
          const status = statusMap[i];
          return (
            <div key={i} className={`epi-item ${status ? `epi-item--${status}` : ""}`}>
              <span className="epi-item-name">{epi}</span>
              <div className="epi-actions">
                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={`btn-status ${key} ${status === key ? "active" : ""}`}
                    onClick={() => setStatus(i, key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="card">
        <h3 className="card-title">Assinatura do Colaborador</h3>
        <p className="hint">Assine no espaço abaixo usando o dedo ou caneta stylus.</p>
        <SignatureCanvas
          ref={sigRef}
          canvasProps={{ className: "signature-pad", height: 220 }}
          backgroundColor="rgba(26,36,55,1)"
          penColor="#e2e8f0"
        />
        <div className="signature-controls">
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => sigRef.current?.clear()}
          >
            Limpar Assinatura
          </button>
        </div>
      </div>

      <div className="form-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleFinalizar}
          disabled={loading}
        >
          {loading && <span className="loading" />}
          {loading ? "Enviando..." : "Finalizar e Gerar PDF"}
        </button>
      </div>
    </div>
  );
}
