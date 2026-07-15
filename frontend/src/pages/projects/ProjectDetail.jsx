import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import AppShell from "../../components/AppShell";
import "../../styles/shared.css";
import "./ProjectDetail.css";

const STATUS_LABELS = {
  actif: "Actif",
  on_hold: "En pause",
  termine: "Terminé",
};

export default function ProjectDetail() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [kpis, setKpis] = useState(null);
  const [timeSummary, setTimeSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);

  const canManage = ["admin_sys", "manager"].includes(user?.effective_role);

  async function loadProject() {
    setLoading(true);
    setLoadError("");
    try {
      const [projectData, tasksData, kpisData, timeSummaryData] = await Promise.all([
        api.get(`/projects/${projectId}`),
        api.get("/tasks", { project_id: projectId }),
        api.get(`/projects/${projectId}/kpis`),
        api.get(`/projects/${projectId}/time-summary`),
      ]);
      setProject(projectData);
      setTasks(tasksData);
      setKpis(kpisData);
      setTimeSummary(timeSummaryData);
    } catch {
      setLoadError("Impossible de charger ce projet.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fetch on mount/param change
    loadProject();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadProject always closes over current projectId
  }, [projectId]);

  async function toggleOnHold() {
    if (!project) return;
    setSavingStatus(true);
    try {
      const nextStatus = project.status === "on_hold" ? "actif" : "on_hold";
      const updated = await api.patch(`/projects/${project.id}`, { status: nextStatus });
      setProject(updated);
    } catch {
      setLoadError("Impossible de modifier le statut du projet.");
    } finally {
      setSavingStatus(false);
    }
  }

  if (loading) return <AppShell><p className="tt-status">Chargement…</p></AppShell>;
  if (loadError) return <AppShell><p className="tt-status tt-status--error">{loadError}</p></AppShell>;
  if (!project) return null;

  return (
    <AppShell>
      <div className="pd-page">
        <Link to="/projects" className="link-action">← Retour aux projets</Link>

        <div className="pd-header">
          <div>
            <h1>{project.title}</h1>
            <p className="pd-meta">
              CM : {project.cm_name || "—"} · Début : {new Date(project.start_date).toLocaleDateString("fr-FR")}
            </p>
          </div>
          <div className="pd-header-actions">
            <span className={`status-chip ${project.status === "actif" ? "is-active" : project.status === "on_hold" ? "is-inactive" : "is-archived"}`}>
              {STATUS_LABELS[project.status] || project.status}
            </span>
            {canManage && project.status !== "termine" && (
              <button type="button" className="btn-secondary" onClick={toggleOnHold} disabled={savingStatus}>
                {project.status === "on_hold" ? "Reprendre" : "Mettre en pause"}
              </button>
            )}
          </div>
        </div>

        {project.remarks && (
          <div className="pd-remarks">
            <h3>Remarques</h3>
            <p>{project.remarks}</p>
          </div>
        )}

        <section className="pd-section">
          <div className="tt-section-header">
            <h3>Tâches ({tasks.length})</h3>
          </div>

          {tasks.length === 0 && <p className="tt-status">Aucune tâche pour ce projet.</p>}

          {tasks.length > 0 && (
            <div className="tt-table-wrap">
              <table className="tt-table">
                <thead>
                  <tr>
                    <th>Titre</th>
                    <th>Type</th>
                    <th>Statut</th>
                    <th>Publication prévue</th>
                    <th aria-label="État" />
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((t) => (
                    <tr key={t.id}>
                      <td>{t.title}</td>
                      <td>{t.task_type_name}</td>
                      <td>{t.status_title}</td>
                      <td>{new Date(t.planned_publish_date).toLocaleDateString("fr-FR")}</td>
                      <td>
                        {t.is_late && <span className="status-chip is-archived">En retard</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {kpis && (
          <section className="pd-section" style={{ marginTop: "2rem" }}>
            <div className="tt-section-header">
              <h3>KPIs — Objectifs vs Réalisations</h3>
            </div>
            {Object.keys(kpis.targets).length === 0 ? (
              <p className="tt-status">Aucun objectif défini pour ce projet.</p>
            ) : (
              <div className="tt-table-wrap">
                <table className="tt-table">
                  <thead>
                    <tr>
                      <th>Type de tâche</th>
                      <th>Objectif mensuel</th>
                      {Object.keys(kpis.actual_by_month).map((month) => (
                        <th key={month}>{month}</th>
                      ))}
                      {Object.keys(kpis.actual_by_month).length === 0 && <th>Réalisations</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(kpis.targets).map(([typeId, target]) => (
                      <tr key={typeId}>
                        <td style={{ fontWeight: 600 }}>{target.name}</td>
                        <td>{target.count}</td>
                        {Object.keys(kpis.actual_by_month).map((month) => {
                          const actual = kpis.actual_by_month[month][typeId] || 0;
                          const percent = target.count > 0 ? Math.round((actual / target.count) * 100) : 0;
                          return (
                            <td key={month}>
                              <span style={{ fontWeight: 600 }}>{actual}</span> / {target.count} 
                              <span style={{ fontSize: "0.8rem", color: percent >= 100 ? "#10b981" : "#f59e0b" }}>
                                ({percent}%)
                              </span>
                            </td>
                          );
                        })}
                        {Object.keys(kpis.actual_by_month).length === 0 && <td>0 / {target.count} (0%)</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {timeSummary && (
          <section className="pd-section" style={{ marginTop: "2rem" }}>
            <div className="tt-section-header">
              <h3>Temps passé par collaborateur</h3>
            </div>
            {timeSummary.length === 0 ? (
              <p className="tt-status">Aucun temps enregistré pour ce projet.</p>
            ) : (
              <div className="tt-table-wrap">
                <table className="tt-table">
                  <thead>
                    <tr>
                      <th>Collaborateur</th>
                      <th>Total cumulé</th>
                      <th>Détail par mois</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timeSummary.map((sum) => (
                      <tr key={sum.user_id}>
                        <td style={{ fontWeight: 600 }}>{sum.user_name}</td>
                        <td>
                          <span className="status-chip is-active">
                            {sum.total_hours}h{String(sum.total_minutes).padStart(2, "0")}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: "0.8rem", flexWrap: "wrap" }}>
                            {sum.months.map((m) => (
                              <span key={m.month} style={{ fontSize: "0.82rem", background: "var(--paper)", padding: "0.2rem 0.5rem", borderRadius: "4px" }}>
                                <strong>{m.month}</strong> : {m.hours}h{String(m.minutes).padStart(2, "0")}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>
    </AppShell>
  );
}