import { useEffect, useState, useRef } from "react";
import { api, ApiError } from "../api/client";
import Modal from "./Modal";
import { UrgentBadge } from "../utils/taskUtils";
import { useAuth } from "../context/AuthContext";
import "./TaskDetailModal.css";

function fmtDate(d) {
  return new Date(d).toLocaleDateString("fr-FR");
}

const ROLE_MAPPING = {
  debut: "CM, Admin Sys, Manager",
  intermediaire: "CM, Admin Sys, Manager",
  planification_shooting: "Chef de Prod, Admin Sys, Manager",
  planification_montage: "Chef de Prod, Admin Sys, Manager",
  montage: "CM, Admin Sys, Manager",
  final_confirmation: "Aucun (Statut final)",
  final_rejet: "Aucun (Statut final)"
};

function renderCommentBody(body) {
  if (!body) return null;
  const parts = body.split(/(@\w+)/g);
  return parts.map((part, i) => {
    if (part.startsWith("@")) {
      return <span key={i} className="tdm-mention">{part}</span>;
    }
    return part;
  });
}

export default function TaskDetailModal({ taskId, open, onClose, onChanged, initialTab = "detail" }) {
  const { user } = useAuth();
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
  const [editingTimeEntry, setEditingTimeEntry] = useState(null);
  const [editTimeForm, setEditTimeForm] = useState({ entry_date: '', hours: '0', minutes: '0' });
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [actionError, setActionError] = useState("");

  const [users, setUsers] = useState([]);
  const [assigneeSelect, setAssigneeSelect] = useState("");
  const [addingAssignee, setAddingAssignee] = useState(false);

  const [mentionQuery, setMentionQuery] = useState(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (!open || !taskId) return;

    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional reset when the modal opens for a new task
    setActiveTab(initialTab);
    setTask(null);
    setLoadError("");
    setActionError("");
    setCommentBody("");
    setTimeForm({ entry_date: new Date().toISOString().slice(0, 10), hours: "0", minutes: "0" });
    setDetailLoading(true);

    (async () => {
      try {
        const [full, statuses, allUsers] = await Promise.all([
          api.get(`/tasks/${taskId}`),
          api.get(`/tasks/${taskId}/next-statuses`),
          api.get("/users/directory"),
        ]);
        if (!cancelled) {
          setTask(full);
          setNextStatuses(statuses);
          setUsers(allUsers);
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
  }, [open, taskId, initialTab]);

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

  const [transitionPromptOpen, setTransitionPromptOpen] = useState(false);
  const [targetTransitionStatus, setTargetTransitionStatus] = useState(null);
  const [transitionFormFields, setTransitionFormFields] = useState([]);
  const [transitionFormValues, setTransitionFormValues] = useState({});

  function initiateStatusChange(s) {
    const fields = s.transition?.form_fields || [];
    if (fields.length > 0) {
      setTargetTransitionStatus(s);
      setTransitionFormFields(fields);
      const initial = {};
      fields.forEach((f) => { initial[f.name || f.label] = ""; });
      setTransitionFormValues(initial);
      setTransitionPromptOpen(true);
    } else {
      handleChangeStatus(s.id);
    }
  }

  async function submitTransitionPrompt(e) {
    e.preventDefault();
    if (!targetTransitionStatus) return;
    setTransitionPromptOpen(false);
    await handleChangeStatus(targetTransitionStatus.id, transitionFormValues);
  }

  async function handleChangeStatus(statusId, formValues = null) {
    if (!taskId) return;
    setChangingStatus(true);
    setActionError("");
    try {
      await api.post(`/tasks/${taskId}/change-status`, {
        status_id: statusId,
        form_values: formValues,
      });
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
      const mentioned_user_ids = users
        .filter(u => commentBody.includes(`@${u.first_name}${u.last_name}`))
        .map(u => u.id);
        
      await api.post(`/tasks/${taskId}/comments`, { 
        body: commentBody.trim(),
        mentioned_user_ids
      });
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

  function triggerEditTimeEntry(te) {
    setEditingTimeEntry(te.id);
    setEditTimeForm({ entry_date: te.entry_date, hours: String(te.hours), minutes: String(te.minutes) });
    setEditModalOpen(true);
  }

  async function handleSaveEditTimeEntry(e) {
    e.preventDefault();
    if (!editingTimeEntry) return;
    try {
      await api.patch(`/tasks/${task.id}/time-entries/${editingTimeEntry}`, {
        entry_date: editTimeForm.entry_date,
        hours: parseInt(editTimeForm.hours) || 0,
        minutes: parseInt(editTimeForm.minutes) || 0,
      });
      setEditingTimeEntry(null);
      setEditModalOpen(false);
      await refresh();
    } catch {
      // silently ignore for now
    }
  }

  function triggerDeleteTimeEntry(teId) {
    setEntryToDelete(teId);
    setDeleteConfirmOpen(true);
  }

  async function handleConfirmDeleteTimeEntry() {
    if (!entryToDelete) return;
    try {
      await api.delete(`/tasks/${task.id}/time-entries/${entryToDelete}`);
      setDeleteConfirmOpen(false);
      setEntryToDelete(null);
      await refresh();
    } catch {
      // silently ignore
    }
  }

  async function handleAddAssignee(e) {
    e.preventDefault();
    if (!assigneeSelect || !taskId) return;
    setAddingAssignee(true);
    setActionError("");
    try {
      await api.post(`/tasks/${taskId}/assignees`, { user_id: Number(assigneeSelect) });
      setAssigneeSelect("");
      await refresh();
    } catch (err) {
      if (err instanceof ApiError && err.data?.error === "already_assigned") {
        setActionError("Cet utilisateur est déjà assigné.");
      } else {
        setActionError("Impossible d'assigner l'utilisateur.");
      }
    } finally {
      setAddingAssignee(false);
    }
  }

  async function handleRemoveAssignee(userId) {
    if (!taskId) return;
    setActionError("");
    try {
      await api.delete(`/tasks/${taskId}/assignees/${userId}`);
      await refresh();
    } catch {
      setActionError("Impossible de retirer l'utilisateur.");
    }
  }

  const handleCommentChange = (e) => {
    const val = e.target.value;
    setCommentBody(val);
    
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPos);
    const match = textBeforeCursor.match(/@([a-zA-Z0-9_]*)$/);
    if (match) {
      setMentionQuery(match[1]);
    } else {
      setMentionQuery(null);
    }
  };
  
  const assignedUserIds = new Set((task?.assignees || []).map(a => a.id));
  
  const filteredUsers = mentionQuery !== null 
    ? users.filter(u => 
        assignedUserIds.has(u.id) &&
        (u.first_name.toLowerCase().includes(mentionQuery.toLowerCase()) || 
         u.last_name.toLowerCase().includes(mentionQuery.toLowerCase()))
      )
    : [];

  const insertMention = (user) => {
    const cursorPos = textareaRef.current?.selectionStart || commentBody.length;
    const textBeforeCursor = commentBody.slice(0, cursorPos);
    const textAfterCursor = commentBody.slice(cursorPos);
    
    const textBeforeMention = textBeforeCursor.replace(/@[a-zA-Z0-9_]*$/, "");
    const mention = `@${user.first_name}${user.last_name} `;
    
    setCommentBody(textBeforeMention + mention + textAfterCursor);
    setMentionQuery(null);
    textareaRef.current?.focus();
  };

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
    <>
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
                <UrgentBadge date={task.planned_publish_date} isCompleted={task.status_functional_type === "validation"} />
                <span className="tdm-detail-date">Publication : {fmtDate(task.planned_publish_date)}</span>
              </div>

              {/* Workflow timeline progress tracker */}
              {task.task_type_statuses && task.task_type_statuses.length > 0 && (
                <div style={{ margin: "1.25rem 0", padding: "0.75rem", background: "var(--sidebar-accent)", borderRadius: "10px", border: "1px solid var(--line)" }}>
                  <p style={{ margin: "0 0 0.5rem", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.03em" }}>Progression du Workflow</p>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                    {task.task_type_statuses.map((s, idx) => {
                      const isCurrent = s.id === task.status_id;
                      return (
                        <div key={s.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span
                            style={{
                              fontSize: "0.78rem",
                              padding: "0.3rem 0.65rem",
                              borderRadius: "6px",
                              fontWeight: isCurrent ? "700" : "500",
                              background: isCurrent ? "var(--primary)" : "var(--card)",
                              color: isCurrent ? "#fff" : "var(--text-muted)",
                              border: isCurrent ? "1px solid var(--primary)" : "1px solid var(--line)",
                              boxShadow: isCurrent ? "0 0 8px rgba(59, 130, 246, 0.4)" : "none",
                              transition: "all 0.2s"
                            }}
                          >
                            {s.title}
                          </span>
                          {idx < task.task_type_statuses.length - 1 && (
                            <span style={{ color: "var(--text-muted)", fontSize: "0.85rem", userSelect: "none" }}>➔</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="tdm-detail-section" style={{ marginTop: "1rem" }}>
                <h4>Assignés ({(task.assignees || []).length})</h4>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.75rem" }}>
                  {(task.assignees || []).map((a) => {
                    const canManageAssignees = ["cm", "chef_prod", "manager", "admin_sys"].includes(user?.effective_role) || user?.is_chef_prod;
                    return (
                      <span key={a.id} className="status-chip" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        {a.name}
                        {canManageAssignees && (
                          <button
                            type="button"
                            onClick={() => handleRemoveAssignee(a.id)}
                            style={{ background: "transparent", border: "none", cursor: "pointer", opacity: 0.6, padding: "0 4px" }}
                            title="Retirer"
                          >
                            ×
                          </button>
                        )}
                      </span>
                    );
                  })}
                  {(task.assignees || []).length === 0 && (
                    <span style={{ fontSize: "0.86rem", color: "var(--text-muted)" }}>Personne n'est assigné.</span>
                  )}
                </div>

                {(["cm", "chef_prod", "manager", "admin_sys"].includes(user?.effective_role) || user?.is_chef_prod) && (
                  <form onSubmit={handleAddAssignee} style={{ display: "flex", gap: "0.5rem" }}>
                    <select
                      value={assigneeSelect}
                      onChange={(e) => setAssigneeSelect(e.target.value)}
                      style={{ flex: 1, padding: "0.4rem 0.6rem", borderRadius: "6px", border: "1px solid var(--line)", fontFamily: "var(--font-body)", fontSize: "0.86rem" }}
                    >
                      <option value="">Sélectionner un collaborateur...</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.first_name} {u.last_name} ({u.role})
                        </option>
                      ))}
                    </select>
                    <button type="submit" className="btn-secondary" disabled={!assigneeSelect || addingAssignee}>
                      {addingAssignee ? "…" : "Assigner"}
                    </button>
                  </form>
                )}
              </div>


              {task.description && <p className="tdm-detail-desc">{task.description}</p>}

              {actionError && <p className="field-error">{actionError}</p>}

              <div className="tdm-detail-section">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.6rem" }}>
                  <h4 style={{ margin: 0 }}>Changer de statut</h4>
                  <span style={{ fontSize: "0.76rem", color: "var(--text-muted)", fontWeight: "500" }}>
                    Qui peut changer : <strong style={{ color: "var(--ink)" }}>{ROLE_MAPPING[task.status_functional_type] || "CM, Admin, Manager"}</strong>
                  </span>
                </div>
                {nextStatuses.length === 0 ? (
                  <div style={{ padding: "0.75rem 1rem", background: "rgba(107,104,116,0.06)", borderRadius: "8px", border: "1px solid var(--line)" }}>
                    <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
                      {task.status_functional_type === "planification_shooting" ? (
                        <span>🎥 <strong>Attente de planification :</strong> Cette tâche doit être planifiée pour le shooting par un Chef d'équipe Prod (ou Manager) depuis l'onglet <strong>Planification</strong>.</span>
                      ) : task.status_functional_type === "planification_montage" ? (
                        <span>🎬 <strong>Attente d'attribution :</strong> Cette tâche doit être attribuée à un monteur par un Chef d'équipe Prod (ou Manager) depuis l'onglet <strong>Planification</strong>.</span>
                      ) : ["final_confirmation", "final_rejet"].includes(task.status_functional_type) ? (
                        <span>✅ Cette tâche est terminée et archivée.</span>
                      ) : (
                        <span>🔒 Vous n'avez pas les droits nécessaires (CM, Manager) pour faire avancer cette tâche depuis ce statut.</span>
                      )}
                    </p>
                  </div>
                ) : (
                  <div className="tdm-status-buttons">
                    {nextStatuses.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className="chip-toggle"
                        disabled={changingStatus}
                        onClick={() => initiateStatusChange(s)}
                      >
                        {s.title}
                        {s.transition?.form_fields && s.transition.form_fields.length > 0 && (
                          <span style={{ marginLeft: "0.3rem", opacity: 0.8 }} title="Formulaire requis">📝</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Déclarer du temps */}
              <div className="tdm-detail-section">
                <h4>Déclarer du temps</h4>
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
                  <ul className="tdm-time-list" style={{ marginTop: "1rem", listStyle: "none", padding: 0 }}>
                    {task.time_entries.map((te) => (
                      <li key={te.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--sidebar-accent)", padding: "0.6rem 0.9rem", borderRadius: "8px", border: "1px solid var(--line)", marginBottom: "0.4rem" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                          <span style={{ fontWeight: 600, color: "var(--ink)", fontSize: "0.82rem" }}>{te.user_name}</span>
                          <span style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>{fmtDate(te.entry_date)}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                          <strong style={{ fontFamily: "var(--font-mono)", color: "var(--ink)", fontSize: "0.85rem" }}>{te.hours}h{String(te.minutes).padStart(2, "0")}</strong>
                          {(te.user_id === user?.id || ["admin_sys", "manager"].includes(user?.effective_role)) && (
                            <div style={{ display: "flex", gap: "0.25rem" }}>
                              <button
                                type="button"
                                style={{ fontSize: "0.72rem", padding: "0.25rem 0.5rem", background: "var(--card)", border: "1px solid var(--line)", borderRadius: "6px", cursor: "pointer", color: "var(--ink)", fontWeight: 600 }}
                                onClick={() => triggerEditTimeEntry(te)}
                              >
                                Modifier
                              </button>
                              <button
                                type="button"
                                style={{ fontSize: "0.72rem", padding: "0.25rem 0.5rem", background: "rgba(196,60,40,0.08)", border: "1px solid rgba(196,60,40,0.15)", borderRadius: "6px", cursor: "pointer", color: "#c43c28", fontWeight: 600 }}
                                onClick={() => triggerDeleteTimeEntry(te.id)}
                              >
                                Supprimer
                              </button>
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Commentaires */}
              <div className="tdm-detail-section">
                <h4>Commentaires</h4>
                <ul className="tdm-comment-list">
                  {(task.comments || []).map((c) => (
                    <li key={c.id} className="tdm-comment">
                      <span className="tdm-comment-author">{c.author_name}</span>
                      <span className="tdm-comment-body">{renderCommentBody(c.body)}</span>
                    </li>
                  ))}
                  {(task.comments || []).length === 0 && <p className="tt-status">Aucun commentaire.</p>}
                </ul>
                <form className="tdm-comment-form" onSubmit={handlePostComment}>
                  <div style={{ position: "relative", flex: 1 }}>
                    <textarea
                      ref={textareaRef}
                      rows={2}
                      style={{ width: "100%", boxSizing: "border-box" }}
                      placeholder="Ajouter un commentaire…"
                      value={commentBody}
                      onChange={handleCommentChange}
                    />
                    {mentionQuery !== null && filteredUsers.length > 0 && (
                      <div className="tdm-mention-dropdown">
                        {filteredUsers.map(u => (
                          <div key={u.id} className="tdm-mention-item" onClick={() => insertMention(u)}>
                            {u.first_name} {u.last_name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button type="submit" className="btn-primary" disabled={postingComment || !commentBody.trim()}>
                    {postingComment ? "…" : "Envoyer"}
                  </button>
                </form>
              </div>
            </>
          ) : (
            /* ── Historique Tab ─────────────────────────────────────────── */

            <div className="tdm-history" style={{ marginTop: "1rem" }}>
              <div style={{ marginBottom: "1.25rem", padding: "0.85rem 1rem", background: "var(--sidebar-accent)", borderRadius: "10px", border: "1px solid var(--line)" }}>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.04em" }}>Temps total cumulé</span>
                <h3 style={{ margin: "0.2rem 0 0", fontSize: "1.5rem", fontWeight: 800, color: "var(--ink)", fontFamily: "var(--font-display)" }}>
                  {(() => {
                    const totalMins = (task.time_entries || []).reduce((acc, te) => acc + te.hours * 60 + te.minutes, 0);
                    if (totalMins === 0) return "0h00";
                    return `${Math.floor(totalMins / 60)}h${String(totalMins % 60).padStart(2, "0")}`;
                  })()}
                </h3>
              </div>

              <div className="tdm-detail-section">
                <h4>Par collaborateur</h4>
                {Object.keys(timeByUser).length === 0 ? (
                  <p className="tt-status">Aucune saisie de temps.</p>
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
                            <td style={{ fontWeight: 600 }}>{name}</td>
                            <td>
                              <span className="status-chip is-active">
                                {Math.floor(mins / 60)}h{String(mins % 60).padStart(2, "0")}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="tdm-detail-section" style={{ marginTop: "1.25rem" }}>
                <h4>Par étape (statut)</h4>
                {Object.keys(timeByStatus).length === 0 ? (
                  <p className="tt-status">Aucune saisie de temps.</p>
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
                            <td style={{ fontWeight: 600 }}>{statusTitle}</td>
                            <td>
                              <span className="status-chip is-active">
                                {Math.floor(mins / 60)}h{String(mins % 60).padStart(2, "0")}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="tdm-detail-section" style={{ marginTop: "1.25rem" }}>
                <h4>Historique détaillé des saisies</h4>
                {(task.time_entries || []).length === 0 ? (
                  <p className="tt-status">Aucune saisie enregistrée.</p>
                ) : (
                  <div className="tt-table-wrap">
                    <table className="tt-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Collaborateur</th>
                          <th>Statut au moment de la saisie</th>
                          <th>Durée</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(task.time_entries || []).map((te) => (
                          <tr key={te.id}>
                            <td>{fmtDate(te.entry_date)}</td>
                            <td style={{ fontWeight: 600 }}>{te.user_name}</td>
                            <td><span className="status-chip is-active">{te.status_title_at_entry || task.status_title}</span></td>
                            <td style={{ fontWeight: 700, fontFamily: "var(--font-mono)" }}>{te.hours}h{String(te.minutes).padStart(2, "0")}</td>
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

      {/* Edit Time Entry Modal */}
      {editModalOpen && (
        <Modal open={editModalOpen} onClose={() => setEditModalOpen(false)} title="Modifier la saisie de temps" width={400}>
          <form onSubmit={handleSaveEditTimeEntry}>
            <div className="field">
              <label htmlFor="edt-date">Date</label>
              <input
                id="edt-date"
                type="date"
                value={editTimeForm.entry_date}
                onChange={(e) => setEditTimeForm((f) => ({ ...f, entry_date: e.target.value }))}
              />
            </div>
            <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="edt-hours">Heures</label>
                <input
                  id="edt-hours"
                  type="number"
                  min="0"
                  value={editTimeForm.hours}
                  onChange={(e) => setEditTimeForm((f) => ({ ...f, hours: e.target.value }))}
                />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="edt-mins">Minutes</label>
                <input
                  id="edt-mins"
                  type="number"
                  min="0"
                  max="59"
                  value={editTimeForm.minutes}
                  onChange={(e) => setEditTimeForm((f) => ({ ...f, minutes: e.target.value }))}
                />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1.5rem" }}>
              <button type="button" className="btn-secondary" onClick={() => setEditModalOpen(false)}>Annuler</button>
              <button type="submit" className="btn-primary">Sauvegarder</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {/* Delete Confirmation Modal */}
      {deleteConfirmOpen && (
        <Modal open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} title="Supprimer la saisie" width={380}>
          <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--ink)", lineHeight: 1.5 }}>
            Êtes-vous sûr de vouloir supprimer cette saisie de temps ? Cette action est irréversible.
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1.5rem" }}>
            <button type="button" className="btn-secondary" onClick={() => setDeleteConfirmOpen(false)}>Annuler</button>
            <button
              type="button"
              className="btn-primary"
              style={{ background: "#c43c28", borderColor: "#c43c28" }}
              onClick={handleConfirmDeleteTimeEntry}
            >
              Supprimer
            </button>
          </div>
        </Modal>
      )}

      {/* Dynamic Transition Form Modal */}
      {transitionPromptOpen && (
        <Modal
          open={transitionPromptOpen}
          onClose={() => setTransitionPromptOpen(false)}
          title={`Informations requises : ${targetTransitionStatus?.title}`}
          width={480}
        >
          <form onSubmit={submitTransitionPrompt}>
            <p style={{ fontSize: "0.86rem", color: "var(--text-muted)", marginBottom: "1rem" }}>
              Veuillez remplir les champs requis pour valider le passage au statut <strong>{targetTransitionStatus?.title}</strong> :
            </p>
            {transitionFormFields.map((field) => {
              const fieldKey = field.name || field.label;
              return (
                <div key={fieldKey} className="field" style={{ marginBottom: "1rem" }}>
                  <label style={{ fontWeight: 600, fontSize: "0.85rem", display: "block", marginBottom: "0.3rem" }}>
                    {field.label || field.name} {field.required && <span style={{ color: "#ef4444" }}>*</span>}
                  </label>
                  {field.type === "textarea" ? (
                    <textarea
                      required={field.required}
                      rows={3}
                      value={transitionFormValues[fieldKey] || ""}
                      onChange={(e) => setTransitionFormValues((prev) => ({ ...prev, [fieldKey]: e.target.value }))}
                    />
                  ) : (
                    <input
                      type={field.type || "text"}
                      required={field.required}
                      value={transitionFormValues[fieldKey] || ""}
                      onChange={(e) => setTransitionFormValues((prev) => ({ ...prev, [fieldKey]: e.target.value }))}
                    />
                  )}
                </div>
              );
            })}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1.5rem" }}>
              <button type="button" className="btn-secondary" onClick={() => setTransitionPromptOpen(false)}>
                Annuler
              </button>
              <button type="submit" className="btn-primary">
                Valider et changer le statut
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
