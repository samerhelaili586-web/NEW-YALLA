import { useEffect, useState } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import AppShell from "../../components/AppShell";
import Modal from "../../components/Modal";
import TaskDetailModal from "../../components/TaskDetailModal";
import { UrgentBadge } from "../../utils/taskUtils";
import "../../styles/shared.css";
import "./ProjectDetail.css";

const STATUS_LABELS = {
  actif: "Actif",
  on_hold: "En pause",
  termine: "Terminé",
};

export default function ProjectDetail() {
  const { projectId } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [kpis, setKpis] = useState(null);
  const [timeSummary, setTimeSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);

  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [taskTypes, setTaskTypes] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    task_type_id: "",
    title: "",
    description: "",
    planned_publish_date: "",
  });
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);
  
  const [taskSearch, setTaskSearch] = useState("");

  const canManage = ["admin_sys", "manager"].includes(user?.effective_role);
  const canCreateTask = ["admin_sys", "manager", "cm"].includes(user?.effective_role);
  const projectIsLocked = project?.status === "on_hold" || project?.status === "termine";

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

      // Deep linking logic moved to a separate useEffect to react to navigation
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

  // Handle deep linking for ?task=
  useEffect(() => {
    if (tasks.length === 0) return;
    const urlParams = new URLSearchParams(location.search);
    const taskIdParam = urlParams.get("task");
    if (taskIdParam) {
      const found = tasks.find((t) => String(t.id) === taskIdParam);
      if (found) {
        openTask(found);
        // Clear the query parameter so it doesn't re-open automatically
        window.history.replaceState({}, document.title, location.pathname);
      }
    }
  }, [location.search, location.pathname, tasks]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get("/task-types");
        if (!cancelled) setTaskTypes(data);
      } catch {
        // silently ignore — the create-task button will just show no options
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  function openTask(task) {
    setSelectedTaskId(task.id);
    setDetailOpen(true);
  }

  function closeTaskDetail() {
    setDetailOpen(false);
    setSelectedTaskId(null);
  }

  function handleTaskChanged(updatedTask) {
    setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? { ...t, ...updatedTask } : t)));
  }

  function openCreateTask() {
    setCreateError("");
    setCreateForm({
      task_type_id: taskTypes[0]?.id ? String(taskTypes[0].id) : "",
      title: "",
      description: "",
      planned_publish_date: "",
    });
    setCreateOpen(true);
  }

  async function handleCreateTask(e) {
    e.preventDefault();
    setCreateError("");

    if (!createForm.task_type_id || !createForm.title.trim() || !createForm.planned_publish_date) {
      setCreateError("Merci de renseigner le type de tâche, le titre et la date de publication prévue.");
      return;
    }

    const selectedType = taskTypes.find((tt) => String(tt.id) === String(createForm.task_type_id));
    const startStatus = selectedType?.statuses?.find((s) => s.functional_type === "debut");
    if (!startStatus) {
      setCreateError("Ce type de tâche n'a pas de statut de début configuré.");
      return;
    }

    setCreating(true);
    try {
      await api.post("/tasks", {
        project_id: Number(projectId),
        task_type_id: Number(createForm.task_type_id),
        status_id: startStatus.id,
        title: createForm.title.trim(),
        description: createForm.description.trim() || undefined,
        planned_publish_date: createForm.planned_publish_date,
      });
      setCreateOpen(false);
      await loadProject();
    } catch (err) {
      if (err instanceof ApiError && err.data?.error === "title_too_long") {
        setCreateError(`Le titre est trop long (max ${err.data.max} caractères).`);
      } else if (err instanceof ApiError && err.data?.error === "project_not_active") {
        setCreateError("Ce projet n'est pas actif — aucune tâche ne peut être ajoutée.");
      } else {
        setCreateError("Impossible de créer la tâche.");
      }
    } finally {
      setCreating(false);
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
              CM: {project.cm_name || "—"} · Début: {new Date(project.start_date).toLocaleDateString("fr-FR")}
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
            {canCreateTask && (
              <button
                type="button"
                className="btn-primary btn-primary--compact"
                onClick={openCreateTask}
                disabled={projectIsLocked}
                title={projectIsLocked ? "Ce projet n'accepte plus de nouvelles tâches." : undefined}
              >
                + Créer une tâche
              </button>
            )}
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <input
              type="search"
              className="users-search"
              placeholder="Rechercher une tâche par titre ou statut…"
              value={taskSearch}
              onChange={(e) => setTaskSearch(e.target.value)}
            />
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
                  {tasks.filter(t => {
                    const q = taskSearch.trim().toLowerCase();
                    if (!q) return true;
                    return t.title.toLowerCase().includes(q) || (t.status_title || "").toLowerCase().includes(q);
                  }).map((t) => (
                    <tr key={t.id} className="pd-task-row" onClick={() => openTask(t)}>
                      <td>{t.title}</td>
                      <td>{t.task_type_name}</td>
                      <td>
                        <span className="status-chip is-active">{t.status_title}</span>
                        <UrgentBadge date={t.planned_publish_date} isCompleted={t.status_functional_type === "validation"} />
                      </td>
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
                              <span style={{ fontWeight: 600 }}>{actual}</span>/{target.count}
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

      <TaskDetailModal
        taskId={selectedTaskId}
        open={detailOpen}
        onClose={closeTaskDetail}
        onChanged={handleTaskChanged}
      />

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Créer une tâche"
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setCreateOpen(false)}>
              Annuler
            </button>
            <button type="submit" form="create-task-form" className="btn-primary btn-primary--compact" disabled={creating}>
              {creating ? "Création…" : "Créer la tâche"}
            </button>
          </>
        }
      >
        <form id="create-task-form" className="lv-form" onSubmit={handleCreateTask} noValidate>
          <label className="field">
            <span className="field-label">Type de tâche</span>
            <select
              value={createForm.task_type_id}
              onChange={(e) => setCreateForm((f) => ({ ...f, task_type_id: e.target.value }))}
            >
              {taskTypes.length === 0 && <option value="">Aucun type disponible</option>}
              {taskTypes.map((tt) => (
                <option key={tt.id} value={tt.id}>{tt.name}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Titre</span>
            <input
              type="text"
              required
              value={createForm.title}
              onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
            />
          </label>
          <label className="field">
            <span className="field-label">Description (optionnel)</span>
            <textarea
              rows={3}
              value={createForm.description}
              onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
            />
          </label>
          <label className="field">
            <span className="field-label">Date de publication prévue</span>
            <input
              type="date"
              required
              value={createForm.planned_publish_date}
              onChange={(e) => setCreateForm((f) => ({ ...f, planned_publish_date: e.target.value }))}
            />
          </label>
          {createError && (
            <p className="field-error" role="alert">
              {createError}
            </p>
          )}
        </form>
      </Modal>
    </AppShell>
  );
}