import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
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
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);

  const canManage = ["admin_sys", "manager"].includes(user?.effective_role);

  async function loadProject() {
    setLoading(true);
    setLoadError("");
    try {
      const [projectData, tasksData] = await Promise.all([
        api.get(`/projects/${projectId}`),
        api.get("/tasks", { project_id: projectId }),
      ]);
      setProject(projectData);
      setTasks(tasksData);
    } catch {
      setLoadError("Impossible de charger ce projet.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fetch on mount
    loadProject();
  },  [projectId]);

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

  if (loading) return <p className="tt-status">Chargement…</p>;
  if (loadError) return <p className="tt-status tt-status--error">{loadError}</p>;
  if (!project) return null;

  return (
    <div className="pd-page">
      <Link to="/projects" className="link-action">← Retour aux projets</Link>

      <div className="pd-header">
        <div>
          <h1>{project.title}</h1>
          <p className="pd-meta">
            CM : {project.cm_name || "—"} · Début : {new Date(project.start_date).toLocaleDateString("fr-FR")}
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
    </div>
  );
}