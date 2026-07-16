import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import Modal from "./Modal";
import "./TaskDetailModal.css";

function fmtDate(d) {
  return new Date(d).toLocaleDateString("fr-FR");
}

export default function TaskDetailModal({ taskId, open, onClose, onChanged }) {
  const [task, setTask] = useState(null);
  const [activeTab, setActiveTab] = useState("detail");
  const [detailLoading, setDetailLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [nextStatuses, setNextStatuses] = useState([]);
  const [changingStatus, setChangingStatus] = useState(false);

  const [commentBody, setCommentBody] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  const [timeForm, setTimeForm] = useState({ entry_date: "", hours: "0", minutes: "0" });
  const [postingTime, setPostingTime] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (!open || !taskId) return;

    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional reset when the modal opens for a new task
    setActiveTab("detail");
    setTask(null);
    setLoadError("");
    setActionError("");
    setCommentBody("");
    setTimeForm({ entry_date: new Date().toISOString().slice(0, 10), hours: "0", minutes: "0" });
    setDetailLoading(true);

    (async () => {
      try {
        const [full, statuses] = await Promise.all([
          api.get(`/tasks/${taskId}`),
          api.get(`/tasks/${taskId}/next-statuses`),
        ]);
        if (!cancelled) {
          setTask(full);
          setNextStatuses(statuses);
        }
      } catch {
        if (!cancelled) setLoadError("Impossible de charger le détail de cette tâche.");
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, taskId]);

  async function refresh() {
    if (!taskId) return;
    const [full, statuses] = await Promise.all([
      api.get(`/tasks/${taskId}`),
      api.get(`/tasks/${taskId}/next-statuses`),
    ]);
    setTask(full);
    setNextStatuses(statuses);
    onChanged?.(full);
  }

  async function handleChangeStatus(statusId) {
    if (!taskId) return;
    setChangingStatus(true);
    setActionError("");
    try {
      await api.post(`/tasks/${taskId}/change-status`, { status_id: statusId });
      await refresh();
    } catch (err) {
      if (err instanceof ApiError && err.data?.error === "role_not_allowed_for_status") {
        setActionError("Votre rôle n'est pas autorisé à faire évoluer ce statut.");
      } else if (err instanceof ApiError && err.data?.error === "transition_not_allowed") {
        setActionError("Cette transition n'est pas autorisée par le workflow.");
      } else {
        setActionError("Impossible de changer le statut.");
      }
    } finally {
      setChangingStatus(false);
    }
  }

  async function handlePostComment(e) {
    e.preventDefault();
    if (!commentBody.trim() || !taskId) return;
    setPostingComment(true);
    setActionError("");
    try {
      await api.post(`/tasks/${taskId}/comments`, { body: commentBody.trim() });
      setCommentBody("");
      await refresh();
    } catch {
      setActionError("Impossible d'ajouter le commentaire.");
    } finally {
      setPostingComment(false);
    }
  }

  async function handlePostTime(e) {
    e.preventDefault();
    if (!taskId) return;
    setPostingTime(true);
    setActionError("");
    try {
      await api.post(`/tasks/${taskId}/time-entries`, {
        entry_date: timeForm.entry_date,
        hours: Number(timeForm.hours) || 0,
        minutes: Number(timeForm.minutes) || 0,
      });
      setTimeForm((f) => ({ ...f, hours: "0", minutes: "0" }));
      await refresh();
    } catch {
      setActionError("Impossible d'enregistrer le temps.");
    } finally {
      setPostingTime(false);
    }
  }

  const timeByUser = (task?.time_entries || []).reduce((acc, te) => {
    const key = te.user_name || "Inconnu";
    acc[key] = (acc[key] || 0) + te.hours * 60 + te.minutes;
    return acc;
  }, {});

  const timeByStatus = (task?.time_entries || []).reduce((acc, te) => {
    const key = te.status_title_at_entry || "Étape initiale";
    acc[key] = (acc[key] || 0) + te.hours * 60 + te.minutes;
    return acc;
  }, {});

  return (
    <Modal open={open} onClose={onClose} title={task?.title || "Tâche"} width={620}>
      {detailLoading && <p className="tt-status">Chargement…</p>}
      {loadError && <p className="tt-status tt-status--error">{loadError}</p>}

      {!detailLoading && !loadError && task && (
        <div className="tdm-detail">
          <div className="tdm-tabs">
            <button
              type="button"
              className={`tdm-tab-btn${activeTab === "detail" ? " is-selected" : ""}`}
              onClick={() => setActiveTab("detail")}
            >
              Détail
            </button>
            <button
              type="button"
              className={`tdm-tab-btn${activeTab === "history" ? " is-selected" : ""}`}
              onClick={() => setActiveTab("history")}
            >
              Historique
            </button>
          </div>

          {activeTab === "detail" ? (
            <>
              <div className="tdm-detail-meta">
                <span className="status-chip is-active">{task.status_title}</span>
                <span className="tdm-detail-date">Publication : {fmtDate(task.planned_publish_date)}</span>
              </div>

              {task.description && <p className="tdm-detail-desc">{task.description}</p>}

              {actionError && <p className="field-error">{actionError}</p>}

              <div className="tdm-detail-section">
                <h4>Changer de statut</h4>
                {nextStatuses.length === 0 ? (
                  <p className="tt-status">Aucune transition disponible.</p>
                ) : (
                  <div className="tdm-status-buttons">
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

              <div className="tdm-detail-section">
                <h4>Temps passé</h4>
                <form className="tdm-time-form" onSubmit={handlePostTime}>
                  <input
                    type="date"
                    value={timeForm.entry_date}
                    onChange={(e) => setTimeForm((f) => ({ ...f, entry_date: e.target.value }))}
                  />
                  <input
                    type="number"
                    min="0"
                    className="tdm-time-input"
                    value={timeForm.hours}
                    onChange={(e) => setTimeForm((f) => ({ ...f, hours: e.target.value }))}
                  />
                  <span>h</span>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    className="tdm-time-input"
                    value={timeForm.minutes}
                    onChange={(e) => setTimeForm((f) => ({ ...f, minutes: e.target.value }))}
                  />
                  <span>min</span>
                  <button type="submit" className="btn-secondary" disabled={postingTime}>
                    {postingTime ? "…" : "Ajouter"}
                  </button>
                </form>
                {(task.time_entries || []).length > 0 && (
                  <ul className="tdm-time-list">
                    {task.time_entries.map((te) => (
                      <li key={te.id}>
                        {te.user_name} — {fmtDate(te.entry_date)} — {te.hours}h{String(te.minutes).padStart(2, "0")}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="tdm-detail-section">
                <h4>Commentaires</h4>
                <ul className="tdm-comment-list">
                  {(task.comments || []).map((c) => (
                    <li key={c.id} className="tdm-comment">
                      <span className="tdm-comment-author">{c.author_name}</span>
                      <span className="tdm-comment-body">{c.body}</span>
                    </li>
                  ))}
                  {(task.comments || []).length === 0 && <p className="tt-status">Aucun commentaire.</p>}
                </ul>
                <form className="tdm-comment-form" onSubmit={handlePostComment}>
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
            <div className="tdm-history">
              <div className="tdm-detail-section">
                <h4>Répartition du temps par utilisateur</h4>
                {Object.keys(timeByUser).length === 0 ? (
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
                        {Object.entries(timeByUser).map(([name, mins]) => (
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

              <div className="tdm-detail-section" style={{ marginTop: "1.5rem" }}>
                <h4>Répartition du temps par étape (statut)</h4>
                {Object.keys(timeByStatus).length === 0 ? (
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
                        {Object.entries(timeByStatus).map(([statusTitle, mins]) => (
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
  );
}