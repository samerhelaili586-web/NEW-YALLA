import { useEffect, useMemo, useState } from "react";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import AppShell from "../../components/AppShell";
import TaskDetailModal from "../../components/TaskDetailModal";
import { UrgentBadge } from "../../utils/taskUtils";
import "../../styles/shared.css";
import "./TachesAssociees.css";

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR");
}

function fmtMinutes(total) {
  if (!total || total <= 0) return "—";
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}h${m.toString().padStart(2, "0")}`;
}

// ── New Personal Task Modal ───────────────────────────────────────────────────
function NewTaskModal({ open, onClose, onCreated }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function handleClose() {
    setTitle("");
    setDescription("");
    setError("");
    onClose();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Le titre est requis.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await api.post("/tasks", {
        title: title.trim(),
        description: description.trim() || undefined,
        planned_publish_date: dueDate,
      });
      handleClose();
      onCreated();
    } catch (err) {
      setError(err?.data?.detail || err?.data?.error || "Erreur lors de la création.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="ta-modal-overlay" role="dialog" aria-modal="true" aria-label="Nouvelle tâche personnelle">
      <div className="ta-modal">
        <div className="ta-modal-header">
          <h2 className="ta-modal-title">✨ Nouvelle tâche</h2>
          <button type="button" className="ta-modal-close" onClick={handleClose} aria-label="Fermer">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="ta-modal-form">
          <div className="field">
            <label>Titre <span style={{ color: "var(--accent)" }}>*</span></label>
            <input
              type="text"
              required
              autoFocus
              placeholder="Nom de la tâche…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
            />
          </div>

          <div className="field">
            <label>Description <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>(optionnel)</span></label>
            <textarea
              placeholder="Détails supplémentaires…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              style={{ resize: "vertical" }}
            />
          </div>

          <div className="field">
            <label>Date d'échéance</label>
            <input
              type="date"
              required
              value={dueDate}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", margin: "0.25rem 0 0.5rem" }}>
            💡 Cette tâche sera <strong>personnelle</strong> et n'apparaîtra pas dans un projet. Vous pourrez la rattacher à un projet ultérieurement.
          </p>

          {error && <p className="field-error" role="alert">{error}</p>}

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={handleClose}>
              Annuler
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? "Création…" : "Créer la tâche"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TachesAssociees() {
  const { user } = useAuth();
  const canCreateTask = ["prod", "chef_prod", "cm", "manager", "admin_sys"].includes(user?.effective_role);

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [viewMode, setViewMode] = useState("list"); // "list" or "weekly"

  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const start = new Date(d.setDate(diff));
    start.setHours(0, 0, 0, 0);
    return start;
  });

  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [newTaskOpen, setNewTaskOpen] = useState(false);

  async function loadTasks() {
    setLoading(true);
    setLoadError("");
    try {
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

  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(currentWeekStart);
      d.setDate(currentWeekStart.getDate() + i);
      days.push(d);
    }
    return days;
  }, [currentWeekStart]);

  function openTask(t) {
    setSelectedTaskId(t.id);
    setDetailOpen(true);
  }

  const lateCount = useMemo(() => tasks.filter((t) => t.is_late).length, [tasks]);

  const allTypes = useMemo(() => {
    const seen = new Set();
    const result = [];
    for (const t of tasks) {
      if (t.task_type_name && !seen.has(t.task_type_name)) {
        seen.add(t.task_type_name);
        result.push(t.task_type_name);
      }
    }
    return result;
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (typeFilter !== "all" && t.task_type_name !== typeFilter) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        (t.project_title || "").toLowerCase().includes(q) ||
        (t.task_type_name || "").toLowerCase().includes(q)
      );
    });
  }, [tasks, search, typeFilter]);

  const tasksByDay = useMemo(() => {
    const map = {};
    weekDays.forEach(day => {
      const key = day.toISOString().slice(0, 10);
      map[key] = [];
    });

    filteredTasks.forEach(t => {
      if (t.planned_publish_date) {
        const dateKey = new Date(t.planned_publish_date).toISOString().slice(0, 10);
        if (map[dateKey]) {
          map[dateKey].push(t);
        }
      }
    });
    return map;
  }, [filteredTasks, weekDays]);

  const handlePrevWeek = () => {
    setCurrentWeekStart(prev => {
      const d = new Date(prev);
      d.setDate(prev.getDate() - 7);
      return d;
    });
  };

  const handleNextWeek = () => {
    setCurrentWeekStart(prev => {
      const d = new Date(prev);
      d.setDate(prev.getDate() + 7);
      return d;
    });
  };

  const handleCurrentWeek = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const start = new Date(d.setDate(diff));
    start.setHours(0, 0, 0, 0);
    setCurrentWeekStart(start);
  };

  const weekRangeLabel = useMemo(() => {
    const startOpt = { day: "numeric", month: "short" };
    const endOpt = { day: "numeric", month: "short", year: "numeric" };
    const startStr = weekDays[0].toLocaleDateString("fr-FR", startOpt);
    const endStr = weekDays[6].toLocaleDateString("fr-FR", endOpt);
    return `${startStr} - ${endStr}`;
  }, [weekDays]);

  return (
    <AppShell>
      <div className="ta-page">
        {/* ── Header ── */}
        <div className="page-header">
          <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
            <div>
              <h1>Mes tâches</h1>
              <p className="page-subtitle">
                {loading
                  ? "Chargement…"
                  : `${tasks.length} tâche${tasks.length !== 1 ? "s" : ""} assignée${tasks.length !== 1 ? "s" : ""}${lateCount > 0 ? ` · ${lateCount} en retard` : ""}`
                }
              </p>
            </div>
            {/* View Mode Toggle */}
            <div className="ta-view-toggle">
              <button
                type="button"
                className={`ta-view-btn ${viewMode === "list" ? "active" : ""}`}
                onClick={() => setViewMode("list")}
              >
                📋 Liste
              </button>
              <button
                type="button"
                className={`ta-view-btn ${viewMode === "weekly" ? "active" : ""}`}
                onClick={() => setViewMode("weekly")}
              >
                📅 Vue Semaine
              </button>
            </div>
          </div>
          {canCreateTask && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => setNewTaskOpen(true)}
              style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Nouvelle tâche
            </button>
          )}
        </div>

        {/* ── Toolbar ── */}
        <div className="ta-toolbar">
          <input
            type="search"
            className="users-search"
            placeholder="Rechercher une tâche…"
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
          <div className="ta-skeleton-grid" style={{ flexDirection: "column" }}>
            {[1, 2, 3, 4].map((i) => <div key={i} className="ta-skeleton-card" style={{ width: "100%", height: "54px" }} />)}
          </div>
        )}

        {!loading && !loadError && (
          <>
            {viewMode === "weekly" && (
              <div className="ta-weekly-navigator">
                <button type="button" className="btn-secondary btn-sm" onClick={handlePrevWeek}>◀ Précédent</button>
                <button type="button" className="btn-secondary btn-sm" onClick={handleCurrentWeek}>Aujourd'hui</button>
                <span className="ta-weekly-range">{weekRangeLabel}</span>
                <button type="button" className="btn-secondary btn-sm" onClick={handleNextWeek}>Suivant ▶</button>
              </div>
            )}

            {filteredTasks.length === 0 ? (
              <div className="ta-empty-state">
                <span className="ta-empty-icon">📋</span>
                <p>{tasks.length === 0 ? "Aucune tâche ne vous est assignée pour le moment." : "Aucune tâche ne correspond à votre recherche."}</p>
                {canCreateTask && tasks.length === 0 && (
                  <button type="button" className="btn-primary" style={{ marginTop: "0.5rem" }} onClick={() => setNewTaskOpen(true)}>
                    + Créer ma première tâche
                  </button>
                )}
              </div>
            ) : viewMode === "list" ? (
              <div className="ta-table-wrap">
                <table className="ta-list-table">
                  <thead>
                    <tr>
                      <th style={{ width: "35%" }}>Intitulé de la tâche</th>
                      <th style={{ width: "22%" }}>Projet / Source</th>
                      <th style={{ width: "15%" }}>Statut</th>
                      <th style={{ width: "13%", textAlign: "center" }}>Temps Prod</th>
                      <th style={{ width: "15%", textAlign: "right" }}>Échéance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTasks.map((t) => {
                      const isPersonal = !t.project_id;
                      return (
                        <tr key={t.id} className="ta-list-row" onClick={() => openTask(t)}>
                          <td>
                            <div className="ta-list-title-cell">
                              <span className="ta-list-title">{t.title}</span>
                              <span className={`ta-list-badge ${isPersonal ? "ta-list-badge--personal" : ""}`}>
                                {isPersonal ? "🙋 Perso" : t.task_type_name}
                              </span>
                            </div>
                          </td>
                          <td>
                            {isPersonal ? (
                              <span className="ta-list-proj ta-list-proj--personal">📌 Tâche personnelle</span>
                            ) : (
                              <span className="ta-list-proj">📁 {t.project_title}</span>
                            )}
                          </td>
                          <td>
                            <span className="ta-card-status">{t.status_title}</span>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <span className="ta-list-time">
                              ⏱️ {fmtMinutes(t.my_time_minutes > 0 ? t.my_time_minutes : t.prod_time_minutes)}
                            </span>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", justifyContent: "flex-end" }}>
                              <span className="ta-card-date">{fmtDate(t.planned_publish_date)}</span>
                              {!isPersonal && (
                                <UrgentBadge date={t.planned_publish_date} isCompleted={t.status_functional_type === "validation"} />
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="ta-weekly-grid">
                {weekDays.map((day) => {
                  const dateStr = day.toISOString().slice(0, 10);
                  const dayTasks = tasksByDay[dateStr] || [];
                  const isToday = new Date().toISOString().slice(0, 10) === dateStr;
                  const formattedDayName = day.toLocaleDateString("fr-FR", { weekday: "short" });
                  const formattedDayNum = day.getDate();

                  return (
                    <div key={dateStr} className={`ta-weekly-col ${isToday ? "ta-weekly-col--today" : ""}`}>
                      <div className="ta-weekly-col-header">
                        <span className="ta-weekly-day-name">{formattedDayName}</span>
                        <span className="ta-weekly-day-num">{formattedDayNum}</span>
                      </div>
                      <div className="ta-weekly-cards">
                        {dayTasks.length === 0 ? (
                          <div className="ta-weekly-empty">Aucune tâche</div>
                        ) : (
                          dayTasks.map((t) => {
                            const isPersonal = !t.project_id;
                            return (
                              <div key={t.id} className="ta-weekly-card" onClick={() => openTask(t)}>
                                <div className="ta-weekly-card-meta">
                                  <span className={`ta-weekly-card-badge ${isPersonal ? "ta-weekly-card-badge--personal" : ""}`}>
                                    {isPersonal ? "🙋 Perso" : t.task_type_name}
                                  </span>
                                  <span className="ta-weekly-card-time">
                                    ⏱️ {fmtMinutes(t.my_time_minutes > 0 ? t.my_time_minutes : t.prod_time_minutes)}
                                  </span>
                                </div>
                                <div className="ta-weekly-card-title">{t.title}</div>
                                <div className="ta-weekly-card-proj">
                                  {isPersonal ? "📌 Personnel" : `📁 ${t.project_title}`}
                                </div>
                                <div className="ta-weekly-card-status">
                                  {t.status_title}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <TaskDetailModal
        taskId={selectedTaskId}
        open={detailOpen}
        onClose={() => { setDetailOpen(false); setSelectedTaskId(null); }}
        onChanged={loadTasks}
      />

      <NewTaskModal
        open={newTaskOpen}
        onClose={() => setNewTaskOpen(false)}
        onCreated={loadTasks}
      />
    </AppShell>
  );
}