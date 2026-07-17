import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import AppShell from "../../components/AppShell";
import Modal from "../../components/Modal";
import { UrgentBadge } from "../../utils/taskUtils";
import "../../styles/shared.css";
import "./TachesAssociees.css";

function fmtDate(d) {
  return new Date(d).toLocaleDateString("fr-FR");
}

function fmtMinutes(total) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}h${String(m).padStart(2, "0")}`;
}

// ── Task Card ─────────────────────────────────────────────────────────────────
function TaskCard({ task, onClick }) {
  return (
    <button type="button" className="ta-card" onClick={onClick} aria-label={`Ouvrir ${task.title}`}>
      <div className="ta-card-header">
        <span className="ta-card-type">{task.task_type_name}</span>
        <div>
          {task.is_late && <span className="ta-chip ta-chip--late">En retard</span>}
          <UrgentBadge date={task.planned_publish_date} isCompleted={task.status_functional_type === "validation"} />
        </div>
      </div>
      <p className="ta-card-title">{task.title}</p>
      <div className="ta-card-footer">
        <span className="ta-card-date">📅 {fmtDate(task.planned_publish_date)}</span>
        <span className="ta-card-status">{task.status_title}</span>
      </div>
    </button>
  );
}

// ── Tab Button ────────────────────────────────────────────────────────────────
function TabBtn({ active, onClick, children }) {
  return (
    <button
      type="button"
      className={`task-tab${active ? " task-tab--active" : ""}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export default function TachesAssociees() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const [selectedTask, setSelectedTask] = useState(null);
  const [activeTab, setActiveTab] = useState("detail");
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [nextStatuses, setNextStatuses] = useState([]);
  const [changingStatus, setChangingStatus] = useState(false);
  const [actionError, setActionError] = useState("");

  const [commentBody, setCommentBody] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  const [timeForm, setTimeForm] = useState({ entry_date: "", hours: "0", minutes: "0" });
  const [postingTime, setPostingTime] = useState(false);

  async function loadTasks() {
    setLoading(true);
    setLoadError("");
    try {
      // spec §5.2: only tasks where the user is in task_assignees
      const data = await api.get("/tasks", { assigned_to_me: 1 });
      setTasks(data);
    } catch {
      setLoadError("Impossible de charger les tâches.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Unique task types for filter chips
  const allTypes = useMemo(() => {
    const seen = new Set();
    const result = [];
    for (const t of tasks) {
      if (!seen.has(t.task_type_name)) {
        seen.add(t.task_type_name);
        result.push(t.task_type_name);
      }
    }
    return result;
  }, [tasks]);

  const lateCount = useMemo(() => tasks.filter((t) => t.is_late).length, [tasks]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (typeFilter !== "all" && t.task_type_name !== typeFilter) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        (t.task_type_name || "").toLowerCase().includes(q)
      );
    });
  }, [tasks, search, typeFilter]);

  // Group by status_title for kanban view
  const grouped = useMemo(() => {
    const map = {};
    for (const t of filtered) {
      const key = t.status_title;
      if (!map[key]) map[key] = [];
      map[key].push(t);
    }
    return map;
  }, [filtered]);

  async function openTask(task) {
    setSelectedTask(task);
    setActiveTab("detail");
    setDetailOpen(true);
    setDetailLoading(true);
    setActionError("");
    setCommentBody("");
    setTimeForm({ entry_date: new Date().toISOString().slice(0, 10), hours: "0", minutes: "0" });
    try {
      const [full, statuses] = await Promise.all([
        api.get(`/tasks/${task.id}`),
        api.get(`/tasks/${task.id}/next-statuses`),
      ]);
      setSelectedTask(full);
      setNextStatuses(statuses);
    } catch {
      setActionError("Impossible de charger le détail de cette tâche.");
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetail() {
    setDetailOpen(false);
    setSelectedTask(null);
  }

  async function refreshSelected() {
    if (!selectedTask) return;
    const [full, statuses] = await Promise.all([
      api.get(`/tasks/${selectedTask.id}`),
      api.get(`/tasks/${selectedTask.id}/next-statuses`),
    ]);
    setSelectedTask(full);
    setNextStatuses(statuses);
    setTasks((prev) => prev.map((t) => (t.id === full.id ? full : t)));
  }

  async function handleChangeStatus(statusId) {
    if (!selectedTask) return;
    setChangingStatus(true);
    setActionError("");
    try {
      await api.post(`/tasks/${selectedTask.id}/change-status`, { status_id: statusId });
      await refreshSelected();
    } catch (err) {
      if (err instanceof ApiError && err.data?.error === "role_not_allowed_for_status") {
        setActionError("Votre rôle n'est pas autorisé à faire évoluer ce statut.");
      } else {
        setActionError("Impossible de changer le statut.");
      }
    } finally {
      setChangingStatus(false);
    }
  }

  async function handlePostComment(e) {
    e.preventDefault();
    if (!commentBody.trim() || !selectedTask) return;
    setPostingComment(true);
    setActionError("");
    try {
      await api.post(`/tasks/${selectedTask.id}/comments`, { body: commentBody.trim() });
      setCommentBody("");
      await refreshSelected();
    } catch {
      setActionError("Impossible d'ajouter le commentaire.");
    } finally {
      setPostingComment(false);
    }
  }

  async function handlePostTime(e) {
    e.preventDefault();
    if (!selectedTask) return;
    setPostingTime(true);
    setActionError("");
    try {
      await api.post(`/tasks/${selectedTask.id}/time-entries`, {
        entry_date: timeForm.entry_date,
        hours: Number(timeForm.hours) || 0,
        minutes: Number(timeForm.minutes) || 0,
      });
      setTimeForm((f) => ({ ...f, hours: "0", minutes: "0" }));
      await refreshSelected();
    } catch {
      setActionError("Impossible d'enregistrer le temps.");
    } finally {
      setPostingTime(false);
    }
  }

  const totalTimeOnSelected = useMemo(() => {
    if (!selectedTask?.time_entries) return 0;
    return selectedTask.time_entries.reduce((s, e) => s + e.hours * 60 + e.minutes, 0);
  }, [selectedTask]);

  const timeByUser = useMemo(() => {
    if (!selectedTask?.time_entries) return {};
    return selectedTask.time_entries.reduce((acc, te) => {
      acc[te.user_name || "Inconnu"] = (acc[te.user_name || "Inconnu"] || 0) + te.hours * 60 + te.minutes;
      return acc;
    }, {});
  }, [selectedTask]);

  const timeByStatus = useMemo(() => {
    if (!selectedTask?.time_entries) return {};
    return selectedTask.time_entries.reduce((acc, te) => {
      const key = te.status_title_at_entry || "Étape initiale";
      acc[key] = (acc[key] || 0) + te.hours * 60 + te.minutes;
      return acc;
    }, {});
  }, [selectedTask]);

  return (
    <AppShell>
      <div className="ta-page">
        {/* ── Header ── */}
        <div className="page-header">
          <div>
            <h1>Mes tâches</h1>
            <p className="page-subtitle">
              {loading
                ? "Chargement…"
                : `${tasks.length} tâche${tasks.length !== 1 ? "s" : ""} assignée${tasks.length !== 1 ? "s" : ""}${lateCount > 0 ? ` · ${lateCount} en retard` : ""}`
              }
            </p>
          </div>
        </div>

        {/* ── Toolbar ── */}
        <div className="ta-toolbar">
          <input
            type="search"
            className="users-search"
            placeholder="Rechercher…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="users-filters">
            <button
              type="button"
              className={`chip-toggle${typeFilter === "all" ? " is-selected" : ""}`}
              onClick={() => setTypeFilter("all")}
            >
              Tous les types
            </button>
            {allTypes.map((type) => (
              <button
                key={type}
                type="button"
                className={`chip-toggle${typeFilter === type ? " is-selected" : ""}`}
                onClick={() => setTypeFilter(type)}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {loadError && <p className="tt-status tt-status--error">{loadError}</p>}
        {loading && (
          <div className="ta-skeleton-grid">
            {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="ta-skeleton-card" />)}
          </div>
        )}

        {!loading && !loadError && (
          <>
            {filtered.length === 0 ? (
              <div className="ta-empty-state">
                <span className="ta-empty-icon">✅</span>
                <p>{tasks.length === 0 ? "Aucune tâche ne vous est assignée pour le moment." : "Aucune tâche ne correspond à votre recherche."}</p>
              </div>
            ) : (
              <div className="ta-kanban">
                {Object.entries(grouped).map(([statusTitle, statusTasks]) => (
                  <div key={statusTitle} className="ta-kanban-col">
                    <div className="ta-kanban-col-header">
                      <span className="ta-kanban-col-title">{statusTitle}</span>
                      <span className="ta-kanban-col-count">{statusTasks.length}</span>
                    </div>
                    <div className="ta-kanban-col-cards">
                      {statusTasks.map((t) => (
                        <TaskCard key={t.id} task={t} onClick={() => openTask(t)} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Detail Modal ── */}
      <Modal open={detailOpen} onClose={closeDetail} title={selectedTask?.title || "Tâche"} width={640}>
        {detailLoading && <p className="tt-status">Chargement…</p>}
        {!detailLoading && selectedTask && (
          <div className="ta-modal-body">
            {/* Tabs */}
            <div className="task-tabs">
              <TabBtn active={activeTab === "detail"} onClick={() => setActiveTab("detail")}>Détail</TabBtn>
              <TabBtn active={activeTab === "history"} onClick={() => setActiveTab("history")}>
                Historique {totalTimeOnSelected > 0 && <span className="task-tab-badge">{fmtMinutes(totalTimeOnSelected)}</span>}
              </TabBtn>
            </div>

            {activeTab === "detail" ? (
              <div className="ta-detail">
                {/* Meta */}
                <div className="ta-meta-row">
                  <span className="ta-chip ta-chip--active">{selectedTask.status_title}</span>
                  {selectedTask.is_late && <span className="ta-chip ta-chip--late">En retard</span>}
                  <UrgentBadge date={selectedTask.planned_publish_date} isCompleted={selectedTask.status_functional_type === "validation"} />
                  <span className="ta-meta-date">📅 Publication : {fmtDate(selectedTask.planned_publish_date)}</span>
                  <span className="ta-meta-type">📋 {selectedTask.task_type_name}</span>
                </div>

                {selectedTask.description && (
                  <p className="ta-desc">{selectedTask.description}</p>
                )}

                {actionError && <p className="field-error">{actionError}</p>}

                {/* Change status */}
                {nextStatuses.length > 0 && (
                  <div className="ta-section">
                    <h4 className="ta-section-title">Faire avancer la tâche</h4>
                    <div className="ta-status-buttons">
                      {nextStatuses.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          className="btn-primary ta-status-btn"
                          disabled={changingStatus}
                          onClick={() => handleChangeStatus(s.id)}
                        >
                          {changingStatus ? "…" : `→ ${s.title}`}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {nextStatuses.length === 0 && !detailLoading && (
                  <p className="ta-no-transition">✓ Aucune transition disponible depuis ce statut.</p>
                )}

                {/* Time entry */}
                <div className="ta-section">
                  <h4 className="ta-section-title">Déclarer du temps</h4>
                  <form className="ta-time-form" onSubmit={handlePostTime}>
                    <div className="field">
                      <label htmlFor="ta-date">Date</label>
                      <input
                        id="ta-date"
                        type="date"
                        value={timeForm.entry_date}
                        onChange={(e) => setTimeForm((f) => ({ ...f, entry_date: e.target.value }))}
                      />
                    </div>
                    <div className="ta-time-inputs">
                      <div className="field">
                        <label htmlFor="ta-hours">Heures</label>
                        <input
                          id="ta-hours"
                          type="number"
                          min="0"
                          className="ta-time-input"
                          value={timeForm.hours}
                          onChange={(e) => setTimeForm((f) => ({ ...f, hours: e.target.value }))}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="ta-mins">Minutes</label>
                        <input
                          id="ta-mins"
                          type="number"
                          min="0"
                          max="59"
                          className="ta-time-input"
                          value={timeForm.minutes}
                          onChange={(e) => setTimeForm((f) => ({ ...f, minutes: e.target.value }))}
                        />
                      </div>
                      <button type="submit" className="btn-secondary ta-time-btn" disabled={postingTime}>
                        {postingTime ? "…" : "Ajouter"}
                      </button>
                    </div>
                  </form>
                  {(selectedTask.time_entries || []).length > 0 && (
                    <ul className="ta-time-list">
                      {selectedTask.time_entries.map((te) => (
                        <li key={te.id} className="ta-time-item">
                          <span className="ta-time-user">{te.user_name}</span>
                          <span className="ta-time-date">{fmtDate(te.entry_date)}</span>
                          <span className="ta-time-dur">{te.hours}h{String(te.minutes).padStart(2, "0")}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Comments */}
                <div className="ta-section">
                  <h4 className="ta-section-title">Commentaires</h4>
                  {(selectedTask.comments || []).length === 0 && (
                    <p className="tt-status" style={{ padding: "0.5rem 0" }}>Aucun commentaire.</p>
                  )}
                  <ul className="ta-comment-list">
                    {(selectedTask.comments || []).map((c) => (
                      <li key={c.id} className="ta-comment">
                        <span className="ta-comment-author">{c.author_name}</span>
                        <span className="ta-comment-body">{c.body}</span>
                      </li>
                    ))}
                  </ul>
                  <form className="ta-comment-form" onSubmit={handlePostComment}>
                    <textarea
                      rows={2}
                      placeholder="Ajouter un commentaire…"
                      value={commentBody}
                      onChange={(e) => setCommentBody(e.target.value)}
                    />
                    <button type="submit" className="btn-primary" disabled={postingComment || !commentBody.trim()}>
                      {postingComment ? "…" : "Envoyer"}
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              /* History tab */
              <div className="ta-history">
                <div className="ta-section">
                  <h4 className="ta-section-title">
                    Temps total : <strong>{totalTimeOnSelected > 0 ? fmtMinutes(totalTimeOnSelected) : "—"}</strong>
                  </h4>
                </div>
                <div className="ta-section">
                  <h4 className="ta-section-title">Par collaborateur</h4>
                  {Object.keys(timeByUser).length === 0 ? (
                    <p className="tt-status" style={{ padding: "0.5rem 0" }}>Aucune saisie de temps.</p>
                  ) : (
                    <div className="tt-table-wrap">
                      <table className="tt-table">
                        <thead><tr><th>Collaborateur</th><th>Temps total</th></tr></thead>
                        <tbody>
                          {Object.entries(timeByUser).map(([name, mins]) => (
                            <tr key={name}><td>{name}</td><td><strong>{fmtMinutes(mins)}</strong></td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                <div className="ta-section">
                  <h4 className="ta-section-title">Par étape (statut)</h4>
                  {Object.keys(timeByStatus).length === 0 ? (
                    <p className="tt-status" style={{ padding: "0.5rem 0" }}>Aucune saisie de temps.</p>
                  ) : (
                    <div className="tt-table-wrap">
                      <table className="tt-table">
                        <thead><tr><th>Statut</th><th>Temps total</th></tr></thead>
                        <tbody>
                          {Object.entries(timeByStatus).map(([st, mins]) => (
                            <tr key={st}><td>{st}</td><td><strong>{fmtMinutes(mins)}</strong></td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </AppShell>
  );
}