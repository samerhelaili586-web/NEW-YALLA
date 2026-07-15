import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../../api/client";
import AppShell from "../../components/AppShell";
import Modal from "../../components/Modal";
import "../../styles/shared.css";
import "./TachesAssociees.css";

function fmtDate(d) {
  return new Date(d).toLocaleDateString("fr-FR");
}

export default function TachesAssociees() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");

  const [selectedTask, setSelectedTask] = useState(null);
  const [activeTab, setActiveTab] = useState("detail");
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [nextStatuses, setNextStatuses] = useState([]);
  const [changingStatus, setChangingStatus] = useState(false);

  const [commentBody, setCommentBody] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  const [timeForm, setTimeForm] = useState({ entry_date: "", hours: "0", minutes: "0" });
  const [postingTime, setPostingTime] = useState(false);
  const [actionError, setActionError] = useState("");

  async function loadTasks() {
    setLoading(true);
    setLoadError("");
    try {
      // spec §5.2: only tasks where the user is in task_assignees (not all tasks)
      // CM also excludes their own projects' tasks (enforced server-side)
      const data = await api.get("/tasks", { assigned_to_me: 1 });
      setTasks(data);
    } catch {
      setLoadError("Impossible de charger les tâches.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fetch on mount
    loadTasks();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter((t) => t.title.toLowerCase().includes(q));
  }, [tasks, search]);

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

  return (
    <AppShell>
      <div className="ta-page">
        <div className="ta-header">
          <div>
            <h1>Mes tâches associées</h1>
            <p className="ta-subtitle">Tâches sur lesquelles vous intervenez.</p>
          </div>
        </div>

        <input
          type="search"
          className="users-search"
          placeholder="Rechercher une tâche…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {loadError && <p className="tt-status tt-status--error">{loadError}</p>}
        {loading && <p className="tt-status">Chargement…</p>}

        {!loading && (
          <div className="ta-table-wrap">
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
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="users-empty">Aucune tâche.</td>
                  </tr>
                )}
                {filtered.map((t) => (
                  <tr key={t.id} className="ta-row" onClick={() => openTask(t)}>
                    <td>{t.title}</td>
                    <td>{t.task_type_name}</td>
                    <td><span className="status-chip is-active">{t.status_title}</span></td>
                    <td>{fmtDate(t.planned_publish_date)}</td>
                    <td>{t.is_late && <span className="status-chip is-archived">En retard</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={detailOpen}
        onClose={closeDetail}
        title={selectedTask?.title || "Tâche"}
        width={620}
      >
        {detailLoading && <p className="tt-status">Chargement…</p>}
        {!detailLoading && selectedTask && (
          <div className="ta-detail">
            <div className="task-detail-tabs" style={{ display: "flex", gap: "1rem", borderBottom: "1px solid var(--line)", paddingBottom: "0.5rem", marginBottom: "0.5rem" }}>
              <button
                type="button"
                className={`tab-btn ${activeTab === "detail" ? "is-selected" : ""}`}
                style={{
                  background: "none",
                  border: "none",
                  padding: "0.5rem 1rem",
                  fontFamily: "var(--font-display)",
                  fontWeight: "600",
                  fontSize: "0.9rem",
                  cursor: "pointer",
                  color: activeTab === "detail" ? "var(--amber-deep)" : "var(--text-muted)",
                  borderBottom: activeTab === "detail" ? "2px solid var(--amber-deep)" : "none"
                }}
                onClick={() => setActiveTab("detail")}
              >
                Détail
              </button>
              <button
                type="button"
                className={`tab-btn ${activeTab === "history" ? "is-selected" : ""}`}
                style={{
                  background: "none",
                  border: "none",
                  padding: "0.5rem 1rem",
                  fontFamily: "var(--font-display)",
                  fontWeight: "600",
                  fontSize: "0.9rem",
                  cursor: "pointer",
                  color: activeTab === "history" ? "var(--amber-deep)" : "var(--text-muted)",
                  borderBottom: activeTab === "history" ? "2px solid var(--amber-deep)" : "none"
                }}
                onClick={() => setActiveTab("history")}
              >
                Historique
              </button>
            </div>

            {activeTab === "detail" ? (
              <>
                <div className="ta-detail-meta">
                  <span className="status-chip is-active">{selectedTask.status_title}</span>
                  <span className="ta-detail-date">Publication : {fmtDate(selectedTask.planned_publish_date)}</span>
                </div>

                {selectedTask.description && <p className="ta-detail-desc">{selectedTask.description}</p>}

                {actionError && <p className="field-error">{actionError}</p>}

                <div className="ta-detail-section">
                  <h4>Changer de statut</h4>
                  {nextStatuses.length === 0 ? (
                    <p className="tt-status">Aucune transition disponible.</p>
                  ) : (
                    <div className="ta-status-buttons">
                      {nextStatuses.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          className="chip-toggle"
                          disabled={changingStatus}
                          onClick={() => handleChangeStatus(s.id)}
                        >
                          {s.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="ta-detail-section">
                  <h4>Temps passé</h4>
                  <form className="ta-time-form" onSubmit={handlePostTime}>
                    <input
                      type="date"
                      value={timeForm.entry_date}
                      onChange={(e) => setTimeForm((f) => ({ ...f, entry_date: e.target.value }))}
                    />
                    <input
                      type="number"
                      min="0"
                      className="ta-time-input"
                      value={timeForm.hours}
                      onChange={(e) => setTimeForm((f) => ({ ...f, hours: e.target.value }))}
                    />
                    <span>h</span>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      className="ta-time-input"
                      value={timeForm.minutes}
                      onChange={(e) => setTimeForm((f) => ({ ...f, minutes: e.target.value }))}
                    />
                    <span>min</span>
                    <button type="submit" className="btn-secondary" disabled={postingTime}>
                      {postingTime ? "…" : "Ajouter"}
                    </button>
                  </form>
                  {(selectedTask.time_entries || []).length > 0 && (
                    <ul className="ta-time-list">
                      {selectedTask.time_entries.map((te) => (
                        <li key={te.id}>
                          {te.user_name} — {fmtDate(te.entry_date)} — {te.hours}h{String(te.minutes).padStart(2, "0")}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="ta-detail-section">
                  <h4>Commentaires</h4>
                  <ul className="ta-comment-list">
                    {(selectedTask.comments || []).map((c) => (
                      <li key={c.id} className="ta-comment">
                        <span className="ta-comment-author">{c.author_name}</span>
                        <span className="ta-comment-body">{c.body}</span>
                      </li>
                    ))}
                    {(selectedTask.comments || []).length === 0 && (
                      <p className="tt-status">Aucun commentaire.</p>
                    )}
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
              </>
            ) : (
              <div className="ta-history">
                <div className="ta-detail-section">
                  <h4>Répartition du temps par utilisateur</h4>
                  {Object.keys(
                    (selectedTask.time_entries || []).reduce((acc, te) => {
                      acc[te.user_name || "Inconnu"] = (acc[te.user_name || "Inconnu"] || 0) + te.hours * 60 + te.minutes;
                      return acc;
                    }, {})
                  ).length === 0 ? (
                    <p className="tt-status">Aucune saisie de temps pour le moment.</p>
                  ) : (
                    <div className="tt-table-wrap">
                      <table className="tt-table">
                        <thead>
                          <tr>
                            <th>Collaborateur</th>
                            <th>Temps total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(
                            (selectedTask.time_entries || []).reduce((acc, te) => {
                              acc[te.user_name || "Inconnu"] = (acc[te.user_name || "Inconnu"] || 0) + te.hours * 60 + te.minutes;
                              return acc;
                            }, {})
                          ).map(([name, mins]) => (
                            <tr key={name}>
                              <td>{name}</td>
                              <td>{Math.floor(mins / 60)}h{String(mins % 60).padStart(2, "0")}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="ta-detail-section" style={{ marginTop: "1.5rem" }}>
                  <h4>Répartition du temps par étape (statut)</h4>
                  {Object.keys(
                    (selectedTask.time_entries || []).reduce((acc, te) => {
                      const key = te.status_title_at_entry || "Étape initiale";
                      acc[key] = (acc[key] || 0) + te.hours * 60 + te.minutes;
                      return acc;
                    }, {})
                  ).length === 0 ? (
                    <p className="tt-status">Aucune saisie de temps pour le moment.</p>
                  ) : (
                    <div className="tt-table-wrap">
                      <table className="tt-table">
                        <thead>
                          <tr>
                            <th>Statut</th>
                            <th>Temps total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(
                            (selectedTask.time_entries || []).reduce((acc, te) => {
                              const key = te.status_title_at_entry || "Étape initiale";
                              acc[key] = (acc[key] || 0) + te.hours * 60 + te.minutes;
                              return acc;
                            }, {})
                          ).map(([statusTitle, mins]) => (
                            <tr key={statusTitle}>
                              <td>{statusTitle}</td>
                              <td>{Math.floor(mins / 60)}h{String(mins % 60).padStart(2, "0")}</td>
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