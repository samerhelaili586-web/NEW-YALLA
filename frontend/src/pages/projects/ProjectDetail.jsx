import { useEffect, useState } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import AppShell from "../../components/AppShell";
import Modal from "../../components/Modal";
import TaskDetailModal from "../../components/TaskDetailModal";
import KanbanBoard from "../../components/KanbanBoard";
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
  const [detailInitialTab, setDetailInitialTab] = useState("detail");
  const [focusComments, setFocusComments] = useState(false);

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
  const [activeTab, setActiveTab] = useState("tasks");
  const [taskViewMode, setTaskViewMode] = useState("table");

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ title: "", remarks: "", cm_id: "", status: "actif", monthly_targets: {} });
  const [cmUsers, setCmUsers] = useState([]);
  const [editError, setEditError] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);


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

  // Handle deep linking for ?task= and ?tab=
  useEffect(() => {
    if (tasks.length === 0) return;
    const urlParams = new URLSearchParams(location.search);
    const taskIdParam = urlParams.get("task");
    const tabParam = urlParams.get("tab");
    if (!taskIdParam) return;
    const found = tasks.find((t) => String(t.id) === taskIdParam);
    if (found) {
      setDetailInitialTab("detail");
      setFocusComments(tabParam === "comments");
      setSelectedTaskId(found.id);
      setDetailOpen(true);
      window.history.replaceState({}, document.title, location.pathname);
    }
  }, [location.search, location.pathname, tasks]);

  useEffect(() => {
    if (!canManage) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get("/users/directory");
        if (!cancelled) setCmUsers(data.filter((u) => u.role === "cm"));
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, [canManage]);

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
    setFocusComments(false);
  }

  function openEditProject() {
    if (!project) return;
    const targets = {};
    (project.monthly_targets || []).forEach((t) => {
      targets[t.task_type_id] = t.monthly_count;
    });
    taskTypes.forEach((tt) => {
      if (!(tt.id in targets)) targets[tt.id] = 0;
    });
    setEditForm({
      title: project.title,
      remarks: project.remarks || "",
      cm_id: String(project.cm_id),
      status: project.status,
      monthly_targets: targets,
    });
    setEditError("");
    setEditOpen(true);
  }

  async function handleSaveProject(e) {
    e.preventDefault();
    if (!project) return;
    setEditError("");
    setSavingEdit(true);
    try {
      const cleanTargets = Object.fromEntries(
        Object.entries(editForm.monthly_targets).map(([k, v]) => [k, Number(v) || 0])
      );
      const updated = await api.patch(`/projects/${project.id}`, {
        title: editForm.title.trim(),
        remarks: editForm.remarks.trim() || null,
        cm_id: Number(editForm.cm_id),
        status: editForm.status,
        monthly_targets: cleanTargets,
      });
      setProject(updated);
      setEditOpen(false);
      await loadProject();
    } catch {
      setEditError("Impossible de mettre à jour le projet.");
    } finally {
      setSavingEdit(false);
    }
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

    setCreating(true);
    try {
      await api.post("/tasks", {
        project_id: Number(projectId),
        task_type_id: Number(createForm.task_type_id),
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
      } else if (err instanceof ApiError && err.data?.error === "no_start_status") {
        setCreateError("Ce type de tâche n'a pas de statut configuré.");
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
            {canManage && (
              <>
                <button type="button" className="btn-secondary" onClick={openEditProject}>
                  Modifier
                </button>
                {project.status !== "termine" && (
                  <button type="button" className="btn-secondary" onClick={toggleOnHold} disabled={savingStatus}>
                    {project.status === "on_hold" ? "Reprendre" : "Mettre en pause"}
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {project.remarks && (
          <div className="pd-remarks">
            <h3>Remarques</h3>
            <p>{project.remarks}</p>
          </div>
        )}

        {/* Project Sub-navigation Tabs */}
        <div className="pd-tabs-bar">
          <button
            type="button"
            className={`pd-tab-btn ${activeTab === "tasks" ? "is-active" : ""}`}
            onClick={() => setActiveTab("tasks")}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M9 11l3 3L22 4 M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Tâches
            <span className="pd-tab-badge">{tasks.length}</span>
          </button>

          <button
            type="button"
            className={`pd-tab-btn ${activeTab === "kpis" ? "is-active" : ""}`}
            onClick={() => setActiveTab("kpis")}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><line x1="18" y1="20" x2="18" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="12" y1="20" x2="12" y2="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="6" y1="20" x2="6" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            KPIs & Objectifs
          </button>

          <button
            type="button"
            className={`pd-tab-btn ${activeTab === "time" ? "is-active" : ""}`}
            onClick={() => setActiveTab("time")}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/><path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            Temps passé
            {timeSummary.length > 0 && (
              <span className="pd-tab-badge pd-tab-badge--time">
                {timeSummary.reduce((acc, s) => acc + s.total_hours, 0)}h
              </span>
            )}
          </button>
        </div>

        {/* ── Tab 1: Tâches ───────────────────────────────────────────── */}
        {activeTab === "tasks" && (
          <section className="pd-section">
            <div className="tt-section-header">
              <h3>Liste des tâches ({tasks.length})</h3>
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

            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap" }}>
              <input
                type="search"
                className="users-search"
                style={{ flex: 1 }}
                placeholder="Rechercher une tâche par titre ou statut…"
                value={taskSearch}
                onChange={(e) => setTaskSearch(e.target.value)}
              />
              <div style={{ display: "flex", gap: "0.2rem", background: "var(--card)", padding: "0.2rem", borderRadius: "8px", border: "1px solid var(--line)" }}>
                <button
                  type="button"
                  className={`chip-toggle ${taskViewMode === "table" ? "is-selected" : ""}`}
                  style={{ fontSize: "0.8rem", padding: "0.3rem 0.75rem" }}
                  onClick={() => setTaskViewMode("table")}
                >
                  📋 Liste
                </button>
                <button
                  type="button"
                  className={`chip-toggle ${taskViewMode === "kanban" ? "is-selected" : ""}`}
                  style={{ fontSize: "0.8rem", padding: "0.3rem 0.75rem" }}
                  onClick={() => setTaskViewMode("kanban")}
                >
                  𝄜 Kanban
                </button>
              </div>
            </div>

            {tasks.length === 0 && <p className="tt-status">Aucune tâche pour ce projet.</p>}

            {tasks.length > 0 && taskViewMode === "kanban" && (
              <KanbanBoard
                tasks={tasks.filter((t) => {
                  const q = taskSearch.trim().toLowerCase();
                  if (!q) return true;
                  return t.title.toLowerCase().includes(q) || (t.status_title || "").toLowerCase().includes(q);
                })}
                onOpenTask={openTask}
              />
            )}

            {tasks.length > 0 && taskViewMode === "table" && (
              <div className="tt-table-wrap">
                <table className="tt-table">
                  <thead>
                    <tr>
                      <th>Titre</th>
                      <th>Type</th>
                      <th>Statut</th>
                      <th>Publication prévue</th>
                      <th>En retard</th>
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
                          {t.is_late ? (
                            <span className="status-chip is-archived" style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                              🔴 En retard
                            </span>
                          ) : (
                            <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

          </section>
        )}

        {/* ── Tab 2: KPIs & Objectifs ───────────────────────────────────── */}
        {activeTab === "kpis" && (
          <section className="pd-section">
            <div className="tt-section-header">
              <h3>KPIs — Objectifs vs Réalisations</h3>
            </div>

            {kpis && (
              <div className="pd-kpis-summary">
                <div className="pd-stat-card">
                  <div className="pd-stat-label">Total Objectifs Mensuels</div>
                  <div className="pd-stat-value">
                    {Object.values(kpis.targets).reduce((acc, t) => acc + t.count, 0)}
                  </div>
                </div>
                <div className="pd-stat-card">
                  <div className="pd-stat-label">Types de Tâches Configurés</div>
                  <div className="pd-stat-value">{Object.keys(kpis.targets).length}</div>
                </div>
              </div>
            )}

            {!kpis || Object.keys(kpis.targets).length === 0 ? (
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
                        <td>
                          <span className="status-chip is-active">{target.count} / mois</span>
                        </td>
                        {Object.keys(kpis.actual_by_month).map((month) => {
                          const actual = kpis.actual_by_month[month][typeId] || 0;
                          const percent = target.count > 0 ? Math.round((actual / target.count) * 100) : 0;
                          return (
                            <td key={month}>
                              <span style={{ fontWeight: 600 }}>{actual}</span> / {target.count}{" "}
                              <span style={{ fontSize: "0.8rem", fontWeight: 700, color: percent >= 100 ? "#10b981" : "#f59e0b", marginLeft: "0.3rem" }}>
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

        {/* ── Tab 3: Temps passé ────────────────────────────────────────── */}
        {activeTab === "time" && (
          <section className="pd-section">
            <div className="tt-section-header">
              <h3>Temps passé par collaborateur</h3>
            </div>

            {timeSummary && timeSummary.length > 0 && (
              <div className="pd-kpis-summary">
                <div className="pd-stat-card">
                  <div className="pd-stat-label">Total Cumulé Projet</div>
                  <div className="pd-stat-value">
                    {timeSummary.reduce((acc, s) => acc + s.total_hours, 0)}h
                    <span style={{ fontSize: "0.9rem", color: "var(--text-muted)", marginLeft: "0.3rem" }}>
                      {timeSummary.reduce((acc, s) => acc + s.total_minutes, 0) % 60}m
                    </span>
                  </div>
                </div>
                <div className="pd-stat-card">
                  <div className="pd-stat-label">Collaborateurs Ayant Saisi</div>
                  <div className="pd-stat-value">{timeSummary.length}</div>
                </div>
              </div>
            )}

            {!timeSummary || timeSummary.length === 0 ? (
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
                          <span className="status-chip is-active" style={{ fontSize: "0.85rem", fontWeight: 700 }}>
                            {sum.total_hours}h{String(sum.total_minutes).padStart(2, "0")}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: "0.8rem", flexWrap: "wrap" }}>
                            {sum.months.map((m) => (
                              <span key={m.month} style={{ fontSize: "0.82rem", background: "var(--paper)", border: "1px solid var(--line)", padding: "0.25rem 0.6rem", borderRadius: "6px" }}>
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