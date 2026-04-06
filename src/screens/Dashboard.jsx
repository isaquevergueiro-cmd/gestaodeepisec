import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const API_BASE =
  import.meta.env.VITE_API_BUSCAR_CPF?.replace("/buscar-cpf", "") ??
  "http://localhost:3001/api";

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchDashboard() {
      try {
        const res = await fetch(`${API_BASE}/dashboard`);
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (err) {
        console.error("Erro ao carregar dashboard:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchDashboard();
    const interval = setInterval(fetchDashboard, 60_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <div className="dashboard">
        <p>Carregando dados do dashboard...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="dashboard">
        <p>Erro ao carregar dados.</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <h2>Gerência</h2>

      {/* Stat Cards */}
      <div className="stats-grid">
        <div className="stat-card warning">
          <div className="stat-value">{data.pendentes}</div>
          <div className="stat-label">Pendentes</div>
        </div>
        <div className="stat-card success">
          <div className="stat-value">{data.concluidas}</div>
          <div className="stat-label">Concluídas (mês)</div>
        </div>
        <div className="stat-card danger">
          <div className="stat-value">{data.comProblema}</div>
          <div className="stat-label">Com Pendências</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{data.semProblema}</div>
          <div className="stat-label">Sem Problemas</div>
        </div>
      </div>

      {/* Pending Solicitations Table */}
      <div className="dashboard-section">
        <h3>Solicitações Pendentes</h3>
        {data.pendentes_list.length === 0 ? (
          <p>Nenhuma solicitação pendente.</p>
        ) : (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Data</th>
              </tr>
            </thead>
            <tbody>
              {data.pendentes_list.map((item) => (
                <tr key={item.id}>
                  <td>{item.nome}</td>
                  <td>
                    {item.data
                      ? new Date(item.data).toLocaleDateString("pt-BR")
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* EPIs with Most Problems Chart */}
      <div className="dashboard-section">
        <h3>EPIs com Mais Problemas</h3>
        {data.epis_problematicos.length === 0 ? (
          <p>Nenhum EPI com problema registrado.</p>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.epis_problematicos}>
              <XAxis dataKey="nome" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="qtd" fill="#3b7ddd" name="Ocorrências" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Breakdown by Technician */}
      <div className="dashboard-section">
        <h3>Por Técnico</h3>
        {Object.keys(data.porTecnico).length === 0 ? (
          <p>Nenhum dado de técnico disponível.</p>
        ) : (
          <div className="tecnico-grid">
            {Object.entries(data.porTecnico)
              .sort(([, a], [, b]) => b - a)
              .map(([nome, count]) => (
                <div className="tecnico-item" key={nome}>
                  <span className="tecnico-name">{nome}</span>
                  <span className="tecnico-count">{count}</span>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
