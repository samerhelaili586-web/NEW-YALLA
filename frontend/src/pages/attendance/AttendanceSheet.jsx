import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import AppShell from "../../components/AppShell";
import "../../styles/shared.css";
import "./AttendanceSheet.css";

const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const DAY_OFF_LABELS = {
  weekend: "Week-end",
  holiday: "Férié",
  leave: "Congé",
  sick: "Maladie",
};

function fmtMinutes(total) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0 && m === 0) return "—";
  return `${h}h${m.toString().padStart(2, "0")}`;
}

function fmtDayHeader(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function mondayOf(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  date.setDate(date.getDate() + diff);
  return date;
}

function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

function DayCell({ day, userName, onSelect }) {
  if (day.day_off_reason) {
    return (
      <td className="att-cell att-cell--off">
        <span className="att-off-label">{DAY_OFF_LABELS[day.day_off_reason] || day.day_off_reason}</span>
      </td>
    );
  }

  const isClickable = day.total_minutes > 0 && day.entries && day.entries.length > 0;

  return (
    <td
      className={`att-cell ${day.missing_report ? "att-cell--missing" : ""} ${isClickable ? "att-cell--clickable" : ""}`}
      onClick={() => isClickable && onSelect && onSelect(userName, day)}
      title={isClickable ? "Cliquer pour voir le détail des tâches de cette journée" : ""}
    >
      <span className="att-time-value">{fmtMinutes(day.total_minutes)}</span>
      {isClickable && <span className="att-cell-hint" aria-hidden="true"> 🔍</span>}
    </td>
  );
}

import Modal from "../../components/Modal";

export default function AttendanceSheet() {
  const { user } = useAuth();
  const isTeamView = ["admin_sys", "manager"].includes(user?.effective_role);

  const [refDate, setRefDate] = useState(() => toISODate(mondayOf(new Date())));
  const [personalWeek, setPersonalWeek] = useState(null);
  const [teamWeeks, setTeamWeeks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // Time Entry Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userTasks, setUserTasks] = useState([]);
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [otherActivityName, setOtherActivityName] = useState("");
  const [entryDate, setEntryDate] = useState(() => toISODate(new Date()));
  const [hours, setHours] = useState("7");
  const [minutes, setMinutes] = useState("0");
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Time Entry Edit & Delete state
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [editHours, setEditHours] = useState("");
  const [editMinutes, setEditMinutes] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  function startEditingEntry(entry) {
    setEditingEntryId(entry.id);
    setEditHours(String(entry.hours));
    setEditMinutes(String(entry.minutes));
    setEditError("");
  }

  async function saveEditingEntry(entry) {
    setEditError("");
    const h = parseInt(editHours) || 0;
    const m = parseInt(editMinutes) || 0;
    if (h === 0 && m === 0) {
      setEditError("La durée doit être supérieure à 0 minute.");
      return;
    }
    setEditSaving(true);
    try {
      const updated = await api.patch(`/tasks/${entry.task_id}/time-entries/${entry.id}`, {
        hours: h,
        minutes: m,
      });
      setSelectedDayDetails((prev) => {
        if (!prev) return null;
        const newEntries = prev.entries.map((e) => (e.id === updated.id ? updated : e));
        const newTotal = newEntries.reduce((acc, e) => acc + e.hours * 60 + e.minutes, 0);
        return { ...prev, entries: newEntries, total_minutes: newTotal };
      });
      setEditingEntryId(null);
      refreshData();
    } catch (err) {
      setEditError(err?.data?.error || err?.data?.detail || "Erreur lors de la modification.");
    } finally {
      setEditSaving(false);
    }
  }

  async function deleteEntry(entry) {
    if (!window.confirm("Voulez-vous vraiment supprimer cette saisie de temps ?")) return;
    try {
      await api.delete(`/tasks/${entry.task_id}/time-entries/${entry.id}`);
      setSelectedDayDetails((prev) => {
        if (!prev) return null;
        const newEntries = prev.entries.filter((e) => e.id !== entry.id);
        const newTotal = newEntries.reduce((acc, e) => acc + e.hours * 60 + e.minutes, 0);
        return { ...prev, entries: newEntries, total_minutes: newTotal };
      });
      refreshData();
    } catch (err) {
      alert(err?.data?.error || err?.data?.detail || "Erreur lors de la suppression.");
    }
  }

  // Selected Day Breakdown Modal State
  const [selectedDayDetails, setSelectedDayDetails] = useState(null);

  function handleOpenDayDetails(userName, dayObj) {
    if (!dayObj || !dayObj.entries || dayObj.entries.length === 0) return;
    setSelectedDayDetails({
      userName: userName || `${user?.first_name} ${user?.last_name}`,
      date: fmtDayHeader(dayObj.date),
      isoDate: dayObj.date,
      entries: dayObj.entries,
      total_minutes: dayObj.total_minutes,
    });
  }

  const refreshData = async () => {
    setLoading(true);
    setLoadError("");
    try {
      if (isTeamView) {
        const data = await api.get("/attendance/team", { ref_date: refDate });
        setTeamWeeks(data);
      } else {
        const data = await api.get("/attendance/me", { ref_date: refDate });
        setPersonalWeek(data);
      }
    } catch {
      setLoadError("Impossible de charger la feuille de présence.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, [refDate, isTeamView]);

  // Load available tasks for the modal dropdown
  useEffect(() => {
    async function fetchTasks() {
      try {
        const data = await api.get("/tasks");
        setUserTasks(data || []);
      } catch {
        setUserTasks([]);
      }
    }
    fetchTasks();
  }, []);

  async function handleTimeSubmit(e) {
    e.preventDefault();
    setFormError("");

    if (!selectedTaskId) {
      setFormError("Veuillez sélectionner une tâche ou une activité.");
      return;
    }

    const h = parseInt(hours) || 0;
    const m = parseInt(minutes) || 0;

    if (h === 0 && m === 0) {
      setFormError("Veuillez indiquer une durée supérieure à 0 minute.");
      return;
    }

    setFormSubmitting(true);
    try {
      let targetTaskId = selectedTaskId;

      if (targetTaskId === "other") {
        if (userTasks.length > 0) {
          targetTaskId = userTasks[0].id;
        } else {
          const allTasks = await api.get("/tasks");
          if (allTasks.length > 0) {
            targetTaskId = allTasks[0].id;
          } else {
            setFormError("Aucune tâche disponible dans le système.");
            setFormSubmitting(false);
            return;
          }
        }
      }

      await api.post(`/tasks/${targetTaskId}/time-entries`, {
        entry_date: entryDate,
        hours: h,
        minutes: m,
      });

      setIsModalOpen(false);
      setHours("7");
      setMinutes("0");
      setOtherActivityName("");
      refreshData();
    } catch (err) {
      setFormError(err?.data?.detail || err?.data?.error || "Erreur lors de la déclaration des heures.");
    } finally {
      setFormSubmitting(false);
    }
  }

  const weekRangeLabel = useMemo(() => {
    const start = new Date(refDate);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return `${start.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} — ${end.toLocaleDateString(
      "fr-FR",
      { day: "numeric", month: "long", year: "numeric" }
    )}`;
  }, [refDate]);

  function shiftWeek(deltaDays) {
    const d = new Date(refDate);
    d.setDate(d.getDate() + deltaDays);
    setRefDate(toISODate(d));
  }

  const days = personalWeek?.days || [];

  return (
    <AppShell>
      <div className="att-header">
        <div>
          <h1>Feuille de présence</h1>
          <p className="att-subtitle">
            {isTeamView ? "Vue équipe — heures déclarées par jour." : "Vos heures déclarées par jour."}
          </p>
        </div>
        <div className="att-week-nav" style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <button type="button" className="btn-primary" onClick={() => setIsModalOpen(true)} style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            Saisir mon temps de travail
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <button type="button" className="btn-secondary" onClick={() => shiftWeek(-7)}>
              ← Semaine préc.
            </button>
            <span className="att-week-label">{weekRangeLabel}</span>
            <button type="button" className="btn-secondary" onClick={() => shiftWeek(7)}>
              Semaine suiv. →
            </button>
          </div>
        </div>
      </div>

      {loading && <p className="att-status">Chargement…</p>}
      {loadError && <p className="att-status att-status--error">{loadError}</p>}

      {!loading && !loadError && !isTeamView && personalWeek && (() => {
        // Collect all unique tasks with time logged this week
        const taskMap = new Map();
        days.forEach(d => {
          (d.entries || []).forEach(e => {
            if (e.task_id && e.task_title) {
              taskMap.set(e.task_id, { title: e.task_title, project_id: e.project_id });
            }
          });
        });
        const taskList = Array.from(taskMap.entries()).map(([id, info]) => ({ id, ...info }));

        // Get minutes spent on a specific task on a specific day
        const getTaskMinutesForDay = (taskId, dayEntries) => {
          return (dayEntries || [])
            .filter(e => e.task_id === taskId)
            .reduce((s, e) => s + e.hours * 60 + e.minutes, 0);
        };

        return (
          <div className="att-table-wrap">
            <table className="att-table att-table--personal">
              <thead>
                <tr>
                  <th className="att-th-name">Tâche</th>
                  {days.map((d) => (
                    <th key={d.date}>
                      {DAY_LABELS[new Date(d.date).getDay() === 0 ? 6 : new Date(d.date).getDay() - 1]}
                      <span className="att-th-date">{fmtDayHeader(d.date)}</span>
                    </th>
                  ))}
                  <th className="att-th-name">Total tâche</th>
                </tr>
              </thead>
              <tbody>
                {taskList.map((task) => {
                  const taskWeekTotal = days.reduce((s, d) => s + getTaskMinutesForDay(task.id, d.entries), 0);
                  return (
                    <tr key={task.id}>
                      <td className="att-th-name">
                        {task.project_id ? (
                          <Link
                            to={`/projects/${task.project_id}?task=${task.id}`}
                            className="att-task-link"
                            style={{ color: "var(--primary)", textDecoration: "underline" }}
                          >
                            {task.title}
                          </Link>
                        ) : (
                          <span>{task.title}</span>
                        )}
                      </td>
                      {days.map((d) => {
                        const taskEntries = (d.entries || []).filter(e => e.task_id === task.id);
                        const mins = getTaskMinutesForDay(task.id, d.entries);
                        const isClickable = mins > 0 && taskEntries.length > 0;
                        return (
                          <td
                            key={d.date}
                            className={`att-cell ${isClickable ? "att-cell--clickable" : ""}`}
                            onClick={() => {
                              if (isClickable) {
                                setSelectedDayDetails({
                                  userName: `${user?.first_name} ${user?.last_name}`,
                                  date: fmtDayHeader(d.date),
                                  isoDate: d.date,
                                  entries: taskEntries,
                                  total_minutes: mins,
                                });
                              }
                            }}
                            title={isClickable ? "Cliquer pour voir le détail de cette saisie" : ""}
                          >
                            <span className="att-time-value">{mins > 0 ? fmtMinutes(mins) : "—"}</span>
                            {isClickable && <span className="att-cell-hint" aria-hidden="true"> 🔍</span>}
                          </td>
                        );
                      })}
                      <td className="att-totals-cell" style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: "0.85rem" }}>
                        {fmtMinutes(taskWeekTotal)}
                      </td>
                    </tr>
                  );
                })}

                {taskList.length === 0 && (
                  <tr>
                    <td colSpan={9} className="att-status" style={{ textAlign: "center", padding: "2rem" }}>
                      Aucun temps déclaré cette semaine.
                    </td>
                  </tr>
                )}

                {/* Daily totals row */}
                <tr className="att-totals-row" style={{ borderTop: "2px solid var(--line)" }}>
                  <td className="att-th-name" style={{ fontWeight: 700 }}>Totaux</td>
                  {days.map((d) => {
                    if (d.day_off_reason && d.total_minutes === 0) {
                      return (
                        <td key={d.date} className="att-cell att-cell--off">
                          <span className="att-off-label">{DAY_OFF_LABELS[d.day_off_reason] || d.day_off_reason}</span>
                        </td>
                      );
                    }
                    const isClickable = d.total_minutes > 0 && d.entries && d.entries.length > 0;
                    return (
                      <td
                        key={d.date}
                        className={`att-cell att-totals-cell ${d.missing_report ? "att-cell--missing" : ""} ${isClickable ? "att-cell--clickable" : ""}`}
                        style={{ fontWeight: 700 }}
                        onClick={() => isClickable && handleOpenDayDetails(null, d)}
                        title={isClickable ? "Cliquer pour voir le détail des tâches de cette journée" : ""}
                      >
                        <span className="att-time-value">{fmtMinutes(d.total_minutes)}</span>
                        {isClickable && <span className="att-cell-hint" aria-hidden="true"> 🔍</span>}
                      </td>
                    );
                  })}
                  <td className="att-totals-cell" style={{ fontWeight: 700, textAlign: "center", fontFamily: "var(--font-mono)", fontSize: "0.85rem" }}>
                    {fmtMinutes(days.reduce((s, d) => s + d.total_minutes, 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        );
      })()}

      {!loading && !loadError && isTeamView && (
        <div className="att-table-wrap">
          <table className="att-table att-table--team">
            <thead>
              <tr>
                <th className="att-th-name">Utilisateur</th>
                {teamWeeks[0]?.days.map((d) => (
                  <th key={d.date}>
                    {DAY_LABELS[new Date(d.date).getDay() === 0 ? 6 : new Date(d.date).getDay() - 1]}
                    <span className="att-th-date">{fmtDayHeader(d.date)}</span>
                  </th>
                ))}
                <th className="att-th-name">Total semaine</th>
              </tr>
            </thead>
            <tbody>
              {teamWeeks.map((row) => {
                const weekTotal = row.days.reduce((s, d) => s + (d.day_off_reason ? 0 : d.total_minutes), 0);
                return (
                  <tr key={row.user_id}>
                    <td className="att-th-name">{row.user_name}</td>
                    {row.days.map((d) => (
                      <DayCell key={d.date} day={d} userName={row.user_name} onSelect={handleOpenDayDetails} />
                    ))}
                    <td className="att-totals-cell">{fmtMinutes(weekTotal)}</td>
                  </tr>
                );
              })}
              {teamWeeks.length === 0 && (
                <tr>
                  <td colSpan={9} className="att-status">
                    Aucun utilisateur actif à afficher.
                  </td>
                </tr>
              )}
              {teamWeeks.length > 0 && (() => {
                const dayTotals = (teamWeeks[0]?.days || []).map((_, di) =>
                  teamWeeks.reduce((s, row) => s + (row.days[di]?.day_off_reason ? 0 : row.days[di]?.total_minutes || 0), 0)
                );
                return (
                  <tr className="att-totals-row">
                    <td className="att-th-name" style={{ fontWeight: 700 }}>Totaux</td>
                    {dayTotals.map((total, i) => (
                      <td key={i} className="att-totals-cell">{fmtMinutes(total)}</td>
                    ))}
                    <td className="att-totals-cell" style={{ fontWeight: 700 }}>
                      {fmtMinutes(dayTotals.reduce((a, b) => a + b, 0))}
                    </td>
                  </tr>
                );
              })()}
            </tbody>
          </table>
        </div>
      )}

      <p className="att-legend">
        <span className="att-legend-swatch att-legend-swatch--missing" /> Journée sans temps déclaré
      </p>

      {/* ── Modal Popup: Saisir mon temps de travail ── */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Saisir mon temps de travail"
        width={480}
      >
        <form onSubmit={handleTimeSubmit}>
          <div className="field">
            <label>Date du jour travaillé</label>
            <input
              type="date"
              required
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
            />
          </div>

          <div className="field">
            <label>Tâche ou Activité</label>
            <select
              value={selectedTaskId}
              onChange={(e) => setSelectedTaskId(e.target.value)}
              required
            >
              <option value="">-- Sélectionner une tâche ou activité --</option>
              {userTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  [{t.project_title || "Projet"}] {t.title}
                </option>
              ))}
              <option value="other">💡 Autre / Activité générale (Réunion, Formation...)</option>
            </select>
          </div>

          {selectedTaskId === "other" && (
            <div className="field">
              <label>Description / Intitulé de l'activité (optionnel)</label>
              <input
                type="text"
                placeholder="ex: Réunion d'équipe, Formation interne..."
                value={otherActivityName}
                onChange={(e) => setOtherActivityName(e.target.value)}
              />
            </div>
          )}

          <div className="field-row">
            <div className="field">
              <label>Heures</label>
              <input
                type="number"
                min="0"
                max="24"
                required
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="7"
              />
            </div>

            <div className="field">
              <label>Minutes</label>
              <input
                type="number"
                min="0"
                max="59"
                required
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                placeholder="30"
              />
            </div>
          </div>

          {formError && <p className="field-error">{formError}</p>}

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>
              Annuler
            </button>
            <button type="submit" className="btn-primary" disabled={formSubmitting}>
              {formSubmitting ? "Enregistrement…" : "Enregistrer la saisie"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Modal Popup: Détail du temps passé sur la journée ── */}
      <Modal
        open={!!selectedDayDetails}
        onClose={() => setSelectedDayDetails(null)}
        title={`Détail du temps passé (${selectedDayDetails?.date || ""})`}
        width={520}
      >
        {selectedDayDetails && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {selectedDayDetails.userName && (
              <div style={{ fontSize: "0.88rem", color: "var(--text-muted)", fontWeight: 600 }}>
                Collaborateur : <span style={{ color: "var(--ink)", fontWeight: 700 }}>{selectedDayDetails.userName}</span>
              </div>
            )}

            {(!selectedDayDetails.entries || selectedDayDetails.entries.length === 0) ? (
              <p style={{ textAlign: "center", color: "var(--text-muted)", padding: "1.5rem 0" }}>
                Aucune tâche détaillée enregistrée pour cette journée.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                {selectedDayDetails.entries.map((entry) => {
                  const canEditOrDelete = entry.user_id === user?.id;
                  const isEditing = editingEntryId === entry.id;

                  return (
                    <div
                      key={entry.id}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.5rem",
                        padding: "0.75rem 0.9rem",
                        borderRadius: "10px",
                        background: "var(--paper)",
                        border: "1px solid var(--line)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "0.5rem",
                        }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem", minWidth: 0, flex: 1, paddingRight: "0.5rem" }}>
                          <span style={{ fontWeight: 600, fontSize: "0.88rem", color: "var(--ink)" }}>
                            {entry.task_title || "Activité générale"}
                          </span>
                          {entry.project_id && (
                            <Link
                              to={`/projects/${entry.project_id}?task=${entry.task_id}`}
                              style={{ fontSize: "0.78rem", color: "var(--primary)", textDecoration: "underline" }}
                              onClick={() => setSelectedDayDetails(null)}
                            >
                              Accéder à la tâche →
                            </Link>
                          )}
                        </div>

                        {!isEditing && (
                          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            <span
                              style={{
                                fontFamily: "var(--font-mono)",
                                fontWeight: 700,
                                fontSize: "0.88rem",
                                padding: "0.25rem 0.55rem",
                                borderRadius: "6px",
                                background: "var(--sidebar-accent)",
                                color: "var(--ink)",
                              }}
                            >
                              {fmtMinutes(entry.hours * 60 + entry.minutes)}
                            </span>

                            {canEditOrDelete && (
                              <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                <button
                                  type="button"
                                  onClick={() => startEditingEntry(entry)}
                                  title="Modifier cette saisie"
                                  style={{
                                    background: "transparent",
                                    border: "1px solid var(--line)",
                                    borderRadius: "6px",
                                    padding: "0.22rem 0.5rem",
                                    fontSize: "0.75rem",
                                    cursor: "pointer",
                                    color: "var(--ink)",
                                  }}
                                >
                                  ✏️ Modifier
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteEntry(entry)}
                                  title="Supprimer cette saisie"
                                  style={{
                                    background: "rgba(185, 28, 28, 0.08)",
                                    border: "1px solid rgba(185, 28, 28, 0.2)",
                                    borderRadius: "6px",
                                    padding: "0.22rem 0.5rem",
                                    fontSize: "0.75rem",
                                    cursor: "pointer",
                                    color: "#b91c1c",
                                  }}
                                >
                                  🗑️
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Inline Edit Form */}
                      {isEditing && (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.4rem",
                            marginTop: "0.3rem",
                            paddingTop: "0.5rem",
                            borderTop: "1px dashed var(--line)",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                              <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Heures:</span>
                              <input
                                type="number"
                                min="0"
                                max="24"
                                value={editHours}
                                onChange={(e) => setEditHours(e.target.value)}
                                style={{ width: "60px", padding: "0.25rem 0.4rem", fontSize: "0.85rem", borderRadius: "6px", border: "1px solid var(--border)" }}
                              />
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                              <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Min:</span>
                              <input
                                type="number"
                                min="0"
                                max="59"
                                value={editMinutes}
                                onChange={(e) => setEditMinutes(e.target.value)}
                                style={{ width: "60px", padding: "0.25rem 0.4rem", fontSize: "0.85rem", borderRadius: "6px", border: "1px solid var(--border)" }}
                              />
                            </div>

                            <button
                              type="button"
                              className="btn-primary"
                              disabled={editSaving}
                              onClick={() => saveEditingEntry(entry)}
                              style={{ padding: "0.25rem 0.65rem", fontSize: "0.78rem" }}
                            >
                              {editSaving ? "..." : "Valider"}
                            </button>
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => setEditingEntryId(null)}
                              style={{ padding: "0.25rem 0.65rem", fontSize: "0.78rem" }}
                            >
                              Annuler
                            </button>
                          </div>
                          {editError && <p className="field-error" style={{ margin: 0 }}>{editError}</p>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                paddingTop: "0.8rem",
                marginTop: "0.4rem",
                borderTop: "2px solid var(--line)",
                fontWeight: 700,
                fontSize: "0.9rem",
              }}
            >
              <span>Durée totale sur cette sélection :</span>
              <span style={{ fontFamily: "var(--font-mono)", color: "var(--primary)", fontSize: "1.05rem" }}>
                {fmtMinutes(selectedDayDetails.total_minutes)}
              </span>
            </div>

            <div className="form-actions" style={{ marginTop: "0.5rem" }}>
              <button type="button" className="btn-secondary" onClick={() => setSelectedDayDetails(null)}>
                Fermer
              </button>
            </div>
          </div>
        )}
      </Modal>
    </AppShell>
  );
}