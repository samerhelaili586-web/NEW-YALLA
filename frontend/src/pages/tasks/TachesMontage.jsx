import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import AppShell from "../../components/AppShell";
import Modal from "../../components/Modal";
import "../../styles/shared.css";
import "./TachesMontage.css";

function fmtDate(d) {
  return new Date(d).toLocaleDateString("fr-FR");
}

function fmtMinutes(total) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}h${String(m).padStart(2, "0")}`;
}

// ── Status chips ─────────────────────────────────────────────────────────────
function StatusChip({ label, isLate }) {
  return (
    <span className={`tm-chip ${isLate ? "tm-chip--late" : "tm-chip--active"}`}>
      {label}
    </span>
  );
}

// ── Task Card ─────────────────────────────────────────────────────────────────
function TaskCard({ task, onClick }) {
  const totalMins = (task.time_entries || []).reduce(
    (s, e) => s + e.hours * 60 + e.minutes, 0
  );
  return (
    <button type="button" className="tm-card" onClick={onClick} aria-label={`Ouvrir ${task.title}`}>
      <div className="tm-card-header">
        <span className="tm-card-type">{task.task_type_name}</span>
        {task.is_late && <span className="tm-chip tm-chip--late">En retard</span>}
      </div>
      <p className="tm-card-title">{task.title}</p>
      <div className="tm-card-footer">
        <span className="tm-card-date">
          📅 {fmtDate(task.planned_publish_date)}
        </span>
        <span className="tm-card-status">{task.status_title}</span>
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

export default function TachesMontage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

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
      const data = await api.get("/tasks");
      const montageTasks = data.filter((t) =>
        ["montage", "planification_montage"].includes(t.status_functional_type)
      );
      setTasks(montageTasks);
    } catch {
      setLoadError("Impossible de charger les tâches de montage.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Unique statuses for filter chips
  const allStatuses = useMemo(() => {
    const seen = new Set();
    const result = [];
    for (const t of tasks) {
      if (!seen.has(t.status_title)) {
        seen.add(t.status_title);
        result.push(t.status_title);
      }
    }
    return result;
  }, [tasks]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (statusFilter !== "all" && t.status_title !== statusFilter) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        (t.task_type_name || "").toLowerCase().includes(q)
      );
    });
  }, [tasks, search, statusFilter]);

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
    await loadTasks();
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
      <div className="tm-page">
        {/* ── Header ── */}
        <div className="page-header">
          <div>
            <h1>Tâches Montage</h1>
            <p className="page-subtitle">
              {loading ? "Chargement…" : `${tasks.length} tâche${tasks.length !== 1 ? "s" : ""} en attente ou en cours de montage`}
            </p>
          </div>
        </div>

        {/* ── Toolbar ── */}
        <div className="tm-toolbar">
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
              className={`chip-toggle${statusFilter === "all" ? " is-selected" : ""}`}
              onClick={() => setStatusFilter("all")}
            >
              Toutes
            </button>
            {allStatuses.map((s) => (
              <button
                key={s}
                type="button"
                className={`chip-toggle${statusFilter === s ? " is-selected" : ""}`}
                onClick={() => setStatusFilter(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {loadError && <p className="tt-status tt-status--error">{loadError}</p>}
        {loading && (
          <div className="tm-skeleton-grid">
            {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="tm-skeleton-card" />)}
          </div>
        )}

        {!loading && !loadError && (
          <>
            {filtered.length === 0 ? (
              <div className="tm-empty-state">
                <span className="tm-empty-icon">🎬</span>
                <p>Aucune tâche de montage{search ? " ne correspond à votre recherche" : ""}.</p>
              </div>
            ) : (
              <div className="tm-kanban">
                {Object.entries(grouped).map(([statusTitle, statusTasks]) => (
                  <div key={statusTitle} className="tm-kanban-col">
                    <div className="tm-kanban-col-header">
                      <span className="tm-kanban-col-title">{statusTitle}</span>
                      <span className="tm-kanban-col-count">{statusTasks.length}</span>
                    </div>
                    <div className="tm-kanban-col-cards">
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
          <div className="tm-modal-body">
            {/* Tabs */}
            <div className="task-tabs">
              <TabBtn active={activeTab === "detail"} onClick={() => setActiveTab("detail")}>Détail</TabBtn>
              <TabBtn active={activeTab === "history"} onClick={() => setActiveTab("history")}>
                Historique {totalTimeOnSelected > 0 && <span className="task-tab-badge">{fmtMinutes(totalTimeOnSelected)}</span>}
              </TabBtn>
            </div>

            {activeTab === "detail" ? (
              <div className="tm-detail">
                {/* Meta */}
                <div className="tm-meta-row">
                  <span className="tm-chip tm-chip--active">{selectedTask.status_title}</span>
                  {selectedTask.is_late && <span className="tm-chip tm-chip--late">En retard</span>}
                  <span className="tm-meta-date">📅 Publication : {fmtDate(selectedTask.planned_publish_date)}</span>
                  <span className="tm-meta-type">🎞 {selectedTask.task_type_name}</span>
                </div>

                {selectedTask.description && (
                  <p className="tm-desc">{selectedTask.description}</p>
                )}

                {actionError && <p className="field-error">{actionError}</p>}

                {/* Change status */}
                {nextStatuses.length > 0 && (
                  <div className="tm-section">
                    <h4 className="tm-section-title">Faire avancer la tâche</h4>
                    <div className="tm-status-buttons">
                      {nextStatuses.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          className="btn-primary tm-status-btn"
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
                  <p className="tm-no-transition">✓ Aucune transition disponible depuis ce statut.</p>
                )}

                {/* Time entry */}
                <div className="tm-section">
                  <h4 className="tm-section-title">Déclarer du temps</h4>
                  <form className="tm-time-form" onSubmit={handlePostTime}>
                    <div className="field">
                      <label htmlFor="tm-date">Date</label>
                      <input
                        id="tm-date"
                        type="date"
                        value={timeForm.entry_date}
                        onChange={(e) => setTimeForm((f) => ({ ...f, entry_date: e.target.value }))}
                      />
                    </div>
                    <div className="tm-time-inputs">
                      <div className="field">
                        <label htmlFor="tm-hours">Heures</label>
                        <input
                          id="tm-hours"
                          type="number"
                          min="0"
                          className="tm-time-input"
                          value={timeForm.hours}
                          onChange={(e) => setTimeForm((f) => ({ ...f, hours: e.target.value }))}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="tm-mins">Minutes</label>
                        <input
                          id="tm-mins"
                          type="number"
                          min="0"
                          max="59"
                          className="tm-time-input"
                          value={timeForm.minutes}
                          onChange={(e) => setTimeForm((f) => ({ ...f, minutes: e.target.value }))}
                        />
                      </div>
                      <button type="submit" className="btn-secondary tm-time-btn" disabled={postingTime}>
                        {postingTime ? "…" : "Ajouter"}
                      </button>
                    </div>
                  </form>
                  {(selectedTask.time_entries || []).length > 0 && (
                    <ul className="tm-time-list">
                      {selectedTask.time_entries.map((te) => (
                        <li key={te.id} className="tm-time-item">
                          <span className="tm-time-user">{te.user_name}</span>
                          <span className="tm-time-date">{fmtDate(te.entry_date)}</span>
                          <span className="tm-time-dur">{te.hours}h{String(te.minutes).padStart(2, "0")}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Comments */}
                <div className="tm-section">
                  <h4 className="tm-section-title">Commentaires</h4>
                  {(selectedTask.comments || []).length === 0 && (
                    <p className="tt-status" style={{ padding: "0.5rem 0" }}>Aucun commentaire.</p>
                  )}
                  <ul className="tm-comment-list">
                    {(selectedTask.comments || []).map((c) => (
                      <li key={c.id} className="tm-comment">
                        <span className="tm-comment-author">{c.author_name}</span>
                        <span className="tm-comment-body">{c.body}</span>
                      </li>
                    ))}
                  </ul>
                  <form className="tm-comment-form" onSubmit={handlePostComment}>
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
              <div className="tm-history">
                <div className="tm-section">
                  <h4 className="tm-section-title">
                    Temps total : <strong>{totalTimeOnSelected > 0 ? fmtMinutes(totalTimeOnSelected) : "—"}</strong>
                  </h4>
                </div>

                <div className="tm-section">
                  <h4 className="tm-section-title">Par collaborateur</h4>
                  {Object.keys(timeByUser).length === 0 ? (
                    <p className="tt-status" style={{ padding: "0.5rem 0" }}>Aucune saisie de temps.</p>
                  ) : (
                    <div className="tt-table-wrap">
                      <table className="tt-table">
                        <thead><tr><th>Collaborateur</th><th>Temps total</th></tr></thead>
                        <tbody>
                          {Object.entries(timeByUser).map(([name, mins]) => (
                            <tr key={name}>
                              <td>{name}</td>
                              <td><strong>{fmtMinutes(mins)}</strong></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="tm-section">
                  <h4 className="tm-section-title">Par étape (statut)</h4>
                  {Object.keys(timeByStatus).length === 0 ? (
                    <p className="tt-status" style={{ padding: "0.5rem 0" }}>Aucune saisie de temps.</p>
                  ) : (
                    <div className="tt-table-wrap">
                      <table className="tt-table">
                        <thead><tr><th>Statut</th><th>Temps total</th></tr></thead>
                        <tbody>
                          {Object.entries(timeByStatus).map(([statusTitle, mins]) => (
                            <tr key={statusTitle}>
                              <td>{statusTitle}</td>
                              <td><strong>{fmtMinutes(mins)}</strong></td>
                            </tr>
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