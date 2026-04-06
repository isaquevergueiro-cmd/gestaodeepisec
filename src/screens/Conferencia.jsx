import { useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { salvarBaixa } from "../api";

// 3 status possíveis, alinhados com o que o SESMT usa na prática
const STATUS = [
  { key: "reaproveitavel", label: "✓ Reaproveitável", css: "devolvido_reuso" },
  { key: "nao_devolvido",  label: "✗ Não Devolvido",  css: "faltante"        },
  { key: "descarte",      label: "🗑 Descarte",       css: "devolvido_descarte" },
];

export default function Conferencia({ dados, tecnico, onVoltar }) {
  const { id_monday, nome, cpf, epis_esperados } = dados;

  const [statusMap, setStatusMap] = useState(() =>
    Object.fromEntries(epis_esperados.map((_, i) => [i, null]))
  );
  const [fotosMap, setFotosMap] = useState(() =>
    Object.fromEntries(epis_esperados.map((_, i) => [i, null]))
  );
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const sigRef = useRef(null);
  const fileInputsRef = useRef([]);

  function setStatus(index, status) {
    setStatusMap((prev) => ({
      ...prev,
      [index]: prev[index] === status ? null : status,
    }));
  }

  function handleFotoChange(index, e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) =>
      setFotosMap((prev) => ({ ...prev, [index]: ev.target.result }));
    reader.readAsDataURL(file);
    // Limpa o input para permitir trocar a foto pelo mesmo arquivo
    e.target.value = "";
  }

  const todosAvaliados = Object.values(statusMap).every((s) => s !== null);
  const todasFotos    = Object.values(fotosMap).every((f) => f !== null);

  const problemasCount = Object.values(statusMap).filter(
    (s) => s !== null && s !== "reaproveitavel"
  ).length;

  async function handleFinalizar() {
    if (!todosAvaliados) {
      setMsg({ type: "error", text: "Avalie todos os EPIs antes de finalizar." });
      return;
    }
    if (!todasFotos) {
      const faltando = epis_esperados
        .filter((_, i) => !fotosMap[i])
        .join(", ");
      setMsg({ type: "error", text: `Foto obrigatória para: ${faltando}` });
      return;
    }
    if (!sigRef.current || sigRef.current.isEmpty()) {
      setMsg({ type: "error", text: "A assinatura do colaborador é obrigatória." });
      return;
    }

    const epis_problema = epis_esperados.map((nome, i) => {
      const statusKey = statusMap[i];
      let statusString = "Não Devolvido";
      if (statusKey === "reaproveitavel") statusString = "Devolvido - Reuso";
      else if (statusKey === "descarte")    statusString = "Devolvido - Descarte";
      return { epi: nome, status: statusString };
    });

    const fotos_epis = epis_esperados.map((nome, i) => ({ nome, base64: fotosMap[i] }));
    const assinatura_base64 = sigRef.current.toDataURL("image/png");

    setLoading(true);
    setMsg(null);
    try {
      await salvarBaixa({
        id_monday,
        cpf,
        epis_problema,
        fotos_epis,
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

  return (
    <div>
      {/* Cabeçalho */}
      <div className="card">
        <div className="conferencia-header">
          <button className="btn btn-outline" onClick={onVoltar}>← Voltar</button>
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

      {/* Progresso */}
      <div className="progress-row">
        <span className={`progress-chip ${todosAvaliados ? "done" : ""}`}>
          {Object.values(statusMap).filter(Boolean).length}/{epis_esperados.length} avaliados
        </span>
        <span className={`progress-chip ${todasFotos ? "done" : ""}`}>
          {Object.values(fotosMap).filter(Boolean).length}/{epis_esperados.length} fotos
        </span>
      </div>

      {/* Lista de EPIs */}
      <div className="card">
        <h3 className="card-title">Conferência de EPIs</h3>
        {epis_esperados.map((epi, i) => {
          const status = statusMap[i];
          const foto   = fotosMap[i];
          return (
            <div key={i} className={`epi-item ${status ? `epi-item--${status}` : ""}`}>
              {/* Linha 1: nome + botões */}
              <div className="epi-item-top">
                <span className="epi-item-name">{epi}</span>
                <div className="epi-actions">
                  {STATUS.map(({ key, label, css }) => (
                    <button
                      key={key}
                      type="button"
                      className={`btn-status ${css} ${status === key ? "active" : ""}`}
                      onClick={() => setStatus(i, key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Linha 2: câmera */}
              <div className="epi-foto-row">
                <input
                  ref={(el) => (fileInputsRef.current[i] = el)}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: "none" }}
                  onChange={(e) => handleFotoChange(i, e)}
                />

                {foto ? (
                  <div className="epi-foto-preview-wrap">
                    <img src={foto} alt={`Foto ${epi}`} className="epi-foto-preview" />
                    <button
                      type="button"
                      className="epi-foto-retake"
                      onClick={() => fileInputsRef.current[i]?.click()}
                    >
                      Refazer foto
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="epi-foto-btn"
                    onClick={() => fileInputsRef.current[i]?.click()}
                  >
                    <span className="epi-foto-icon">📷</span>
                    Tirar foto do EPI
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Assinatura */}
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
