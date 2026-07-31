import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import AppShell from "../../components/AppShell";
import Avatar from "../../components/Avatar";
import Modal from "../../components/Modal";
import "../../styles/shared.css";
import "./AttendanceSheet.css";

const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const DAY_OFF_LABELS = {
  weekend: "Week-end",
  holiday: "Férié",
  leave: "Congé",
  sick: "Maladie",
  penalized: "Pénalisé",
};

function fmtMinutes(total) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0 && m === 0) return "—";
  return `${h}h${m.toString().padStart(2, "0")}`;
}

function fmtDayHeader(iso) {
  const d = parseISODate(iso);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function parseISODate(dateStr) {
  if (!dateStr || typeof dateStr !== "string" || !dateStr.includes("-")) return new Date();
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function mondayOf(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  date.setDate(date.getDate() + diff);
  return date;
}

function toISODate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function DayCell({ day, userName, onSelect, targetDate }) {
  const isTarget = targetDate && day.date === targetDate;
  if (day.day_off_reason) {
    const isPenalized = day.day_off_reason === "penalized";
    return (
      <td className={`att-cell ${isPenalized ? "att-cell--penalized" : "att-cell--off"} ${isTarget ? "att-cell--target" : ""}`}>
        <span className={`att-off-label ${isPenalized ? "att-off-label--penalized" : ""}`}>
          {isPenalized && "⚠️ "}
          {DAY_OFF_LABELS[day.day_off_reason] || day.day_off_reason}
        </span>
      </td>
    );
  }

  const isClickable = day.total_minutes > 0 && day.entries && day.entries.length > 0;

  return (
    <td
      className={`att-cell ${day.missing_report ? "att-cell--missing" : ""} ${day.is_grace_period ? "att-cell--grace" : ""} ${isClickable ? "att-cell--clickable" : ""} ${isTarget ? "att-cell--target" : ""}`}
      onClick={() => isClickable && onSelect && onSelect(userName, day)}
      title={day.is_grace_period ? "Délai de grâce (J+1) : à déclarer avant 23h59" : isClickable ? "Cliquer pour voir le détail des tâches" : ""}
    >
      <span className="att-time-value">{fmtMinutes(day.total_minutes)}</span>
      {day.is_grace_period && <span className="att-grace-tag">⏳ J+1</span>}
      {isClickable && <span className="att-cell-hint" aria-hidden="true"> 🔍</span>}
    </td>
  );
}

export default function AttendanceSheet() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isTeamView = ["admin_sys", "manager"].includes(user?.effective_role);
  const [searchParams] = useSearchParams();

  const [refDate, setRefDate] = useState(() => {
    const dParam = searchParams.get("date");
    if (dParam) return toISODate(mondayOf(parseISODate(dParam)));
    return toISODate(mondayOf(new Date()));
  });
  const [personalWeek, setPersonalWeek] = useState(null);
  const [teamWeeks, setTeamWeeks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get("search") || "");
  const [roleFilter, setRoleFilter] = useState("all");

  const targetDateParam = searchParams.get("date");

  useEffect(() => {
    const dateParam = searchParams.get("date");
    const searchParam = searchParams.get("search");

    if (dateParam) {
      const targetMonday = mondayOf(parseISODate(dateParam));
      setRefDate(toISODate(targetMonday));
    }
    if (searchParam) {
      setSearchQuery(searchParam);
    }
  }, [searchParams]);

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
  const [selectedDayDetails, setSelectedDayDetails] = useState(null);

  // System Settings state
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [graceDays, setGraceDays] = useState("1");
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState("");

  async function loadSettings() {
    try {
      const data = await api.get("/settings");
      const graceSetting = data.find(s => s.key === "grace_period_days");
      if (graceSetting) {
        setGraceDays(graceSetting.value);
      }
    } catch (err) {
      console.error("Failed to load settings", err);
    }
  }

  async function saveSettings(e) {
    e.preventDefault();
    setSettingsSaving(true);
    setSettingsError("");
    try {
      await api.put(`/settings/grace_period_days`, { value: graceDays });
      setSettingsModalOpen(false);
    } catch (err) {
      setSettingsError(err?.data?.error || err?.data?.detail || "Erreur lors de la sauvegarde.");
    } finally {
      setSettingsSaving(false);
    }
  }

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
        client_tz_offset: new Date().getTimezoneOffset(),
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

  useEffect(() => {
    async function fetchTasks() {
      try {
        const data = await api.get("/tasks", { assigned_to_me: 1 });
        setUserTasks(data || []);
      } catch {
        setUserTasks([]);
      }
    }
    fetchTasks();
  }, []);

  useEffect(() => {
    if (user?.effective_role === "admin_sys") {
      loadSettings();
    }
  }, [user]);

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

    // Client-side date guard: only today (J) or yesterday (J-1)
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); })();
    if (entryDate !== today && entryDate !== yesterday) {
      setFormError("La saisie de temps n'est autorisée que pour aujourd'hui ou hier.");
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
        client_tz_offset: new Date().getTimezoneOffset(),
      });

      setIsModalOpen(false);
      setHours("7");
      setMinutes("0");
      refreshData();
    } catch (err) {
      setFormError(err?.data?.detail || err?.data?.error || "Erreur lors de la déclaration des heures.");
    } finally {
      setFormSubmitting(false);
    }
  }

  const weekRangeLabel = useMemo(() => {
    const start = new Date(refDate);
    const end = new Date(refDate);
    end.setDate(end.getDate() + 6);
    return `${start.getDate()} ${start.toLocaleDateString("fr-FR", { month: "short" })} – ${end.getDate()} ${end.toLocaleDateString("fr-FR", { month: "short" })} ${end.getFullYear()}`;
  }, [refDate]);

  function shiftWeek(deltaDays) {
    const d = new Date(refDate);
    d.setDate(d.getDate() + deltaDays);
    setRefDate(toISODate(d));
  }

  function resetToToday() {
    setRefDate(toISODate(mondayOf(new Date())));
  }

  // Filtered rows for team view
  const filteredTeamWeeks = useMemo(() => {
    return teamWeeks.filter((row) => {
      const nameMatch = row.user_name.toLowerCase().includes(searchQuery.toLowerCase());
      if (!nameMatch) return false;

      if (roleFilter === "cm") return row.role === "cm";
      if (roleFilter === "prod") return row.role === "prod";
      if (roleFilter === "penalized") {
        return row.days.some((d) => d.day_off_reason === "penalized");
      }
      return true;
    });
  }, [teamWeeks, searchQuery, roleFilter]);

  // Analytics Metrics
  const stats = useMemo(() => {
    if (!isTeamView) {
      const daysList = personalWeek?.days || [];
      const totalMins = daysList.reduce((acc, d) => acc + (d.day_off_reason ? 0 : d.total_minutes), 0);
      const penalizedCount = daysList.filter((d) => d.day_off_reason === "penalized").length;
      const graceCount = daysList.filter((d) => d.is_grace_period).length;
      return { totalMins, penalizedCount, graceCount, userCount: 1 };
    }

    let totalMins = 0;
    let penalizedCount = 0;
    let graceCount = 0;

    teamWeeks.forEach((row) => {
      row.days.forEach((d) => {
        if (d.day_off_reason === "penalized") penalizedCount++;
        if (d.is_grace_period) graceCount++;
        if (!d.day_off_reason) totalMins += d.total_minutes;
      });
    });

    return { totalMins, penalizedCount, graceCount, userCount: teamWeeks.length };
  }, [teamWeeks, personalWeek, isTeamView]);

  function exportCSV() {
    if (!teamWeeks || teamWeeks.length === 0) return;
    const headers = ["Utilisateur", "Rôle", ...teamWeeks[0].days.map((d) => fmtDayHeader(d.date)), "Total semaine"];
    const rows = teamWeeks.map((row) => {
      const weekTotal = row.days.reduce((s, d) => s + (d.day_off_reason ? 0 : d.total_minutes), 0);
      const dayCells = row.days.map((d) => {
        if (d.day_off_reason) return DAY_OFF_LABELS[d.day_off_reason] || d.day_off_reason;
        return fmtMinutes(d.total_minutes);
      });
      return [row.user_name, row.role, ...dayCells, fmtMinutes(weekTotal)];
    });

    const csvContent = [headers, ...rows].map((e) => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Feuille_Presence_${refDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const todayIso = toISODate(new Date());

  return (
    <AppShell>
      <div className="att-container">
        {/* ── Top Header ───────────────────────────────────────── */}
        <div className="att-header">
          <div>
            <h1 className="att-title">Feuille de présence</h1>
            <p className="att-subtitle">
              {isTeamView
                ? "Suivi analytique et temps de travail de l'équipe par journée."
                : "Consultez vos heures déclarées et votre relevé de présence."}
            </p>
          </div>

          <div className="att-week-nav">
            {user?.effective_role === "admin_sys" && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => navigate("/admin/parametres")}
                style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
              >
                ⚙️ Paramètres
              </button>
            )}
            {!isTeamView && (
              <button
                type="button"
                className="btn-primary"
                onClick={() => setIsModalOpen(true)}
                style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                Saisir mon temps
              </button>
            )}

            {isTeamView && (
              <button
                type="button"
                className="btn-secondary"
                onClick={exportCSV}
                style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                Exporter CSV
              </button>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <button type="button" className="btn-secondary" onClick={() => shiftWeek(-7)}>
                ← Préc.
              </button>
              <button type="button" className="btn-secondary" onClick={resetToToday}>
                Aujourd'hui
              </button>
              <button type="button" className="btn-secondary" onClick={() => shiftWeek(7)}>
                Suiv. →
              </button>
              <span className="att-week-badge">{weekRangeLabel}</span>
            </div>
          </div>
        </div>

        {/* ── KPI Analytics Header Cards ────────────────────────── */}
        <div className="att-kpi-grid">
          <div className="att-kpi-card">
            <span className="att-kpi-label">Volume total déclaré</span>
            <div className="att-kpi-val-row">
              <span className="att-kpi-value">{fmtMinutes(stats.totalMins)}</span>
              <span className="att-kpi-tag att-kpi-tag--blue">⚡ Semaine</span>
            </div>
          </div>

          <div className="att-kpi-card">
            <span className="att-kpi-label">Collaborateurs actifs</span>
            <div className="att-kpi-val-row">
              <span className="att-kpi-value">{stats.userCount}</span>
              <span className="att-kpi-tag att-kpi-tag--green">👥 Membres</span>
            </div>
          </div>

          <div className="att-kpi-card">
            <span className="att-kpi-label">Pénalités cette semaine</span>
            <div className="att-kpi-val-row">
              <span className="att-kpi-value" style={{ color: stats.penalizedCount > 0 ? "#ef4444" : "var(--ink)" }}>
                {stats.penalizedCount}
              </span>
              <span className={`att-kpi-tag ${stats.penalizedCount > 0 ? "att-kpi-tag--red" : "att-kpi-tag--gray"}`}>
                {stats.penalizedCount > 0 ? "⚠️ Alerte" : "0 Réclamations"}
              </span>
            </div>
          </div>

          <div className="att-kpi-card">
            <span className="att-kpi-label">Délais de grâce (J+1)</span>
            <div className="att-kpi-val-row">
              <span className="att-kpi-value" style={{ color: stats.graceCount > 0 ? "#f59e0b" : "var(--ink)" }}>
                {stats.graceCount}
              </span>
              <span className={`att-kpi-tag ${stats.graceCount > 0 ? "att-kpi-tag--amber" : "att-kpi-tag--gray"}`}>
                {stats.graceCount > 0 ? "⏳ En attente" : "À jour"}
              </span>
            </div>
          </div>
        </div>

        {/* ── Toolbar & Filters (Team View) ────────────────────── */}
        {isTeamView && (
          <div className="att-toolbar">
            <input
              type="text"
              className="users-search"
              placeholder="Rechercher un collaborateur…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: "260px" }}
            />

            <div className="users-filters">
              <button
                type="button"
                className={`chip-toggle ${roleFilter === "all" ? "is-selected" : ""}`}
                onClick={() => setRoleFilter("all")}
              >
                Tous les membres
              </button>
              <button
                type="button"
                className={`chip-toggle ${roleFilter === "cm" ? "is-selected" : ""}`}
                onClick={() => setRoleFilter("cm")}
              >
                Community Managers
              </button>
              <button
                type="button"
                className={`chip-toggle ${roleFilter === "prod" ? "is-selected" : ""}`}
                onClick={() => setRoleFilter("prod")}
              >
                Équipe Prod
              </button>
              <button
                type="button"
                className={`chip-toggle ${roleFilter === "penalized" ? "is-selected" : ""}`}
                onClick={() => setRoleFilter("penalized")}
              >
                ⚠️ Pénalités seulement
              </button>
            </div>
          </div>
        )}

        {loading && <p className="att-status">Chargement de la feuille de présence…</p>}
        {loadError && <p className="att-status att-status--error">{loadError}</p>}

        {/* ── Personal View Table ───────────────────────────────── */}
        {!loading && !loadError && !isTeamView && personalWeek && (
          <div className="att-table-wrap">
            <table className="att-table att-table--personal">
              <thead>
                <tr>
                  <th className="att-th-name">Collaborateur</th>
                  {(personalWeek.days || []).map((d) => {
                    const isToday = d.date === todayIso;
                    const isTarget = d.date === targetDateParam;
                    return (
                      <th key={d.date} className={`${isToday ? "att-th--today" : ""} ${isTarget ? "att-th--target" : ""}`}>
                        {DAY_LABELS[parseISODate(d.date).getDay() === 0 ? 6 : parseISODate(d.date).getDay() - 1]}
                        <span className="att-th-date">{fmtDayHeader(d.date)}</span>
                        {isToday && <span className="att-today-pill">Aujourd'hui</span>}
                        {isTarget && <span className="att-target-pill">Cible</span>}
                      </th>
                    );
                  })}
                  <th className="att-th-name">Total semaine</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="att-th-name" style={{ fontWeight: 700 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                      <Avatar firstName={user?.first_name} lastName={user?.last_name} photoUrl={user?.photo_url} size={32} />
                      <div>
                        <div>{user?.first_name} {user?.last_name}</div>
                        <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 400 }}>{user?.effective_role}</span>
                      </div>
                    </div>
                  </td>
                  {(personalWeek.days || []).map((d) => {
                    const isTarget = d.date === targetDateParam;
                    if (d.day_off_reason && d.total_minutes === 0) {
                      const isPenalized = d.day_off_reason === "penalized";
                      return (
                        <td key={d.date} className={`att-cell ${isPenalized ? "att-cell--penalized" : "att-cell--off"} ${isTarget ? "att-cell--target" : ""}`}>
                          <span className={`att-off-label ${isPenalized ? "att-off-label--penalized" : ""}`}>
                            {isPenalized && "⚠️ "}
                            {DAY_OFF_LABELS[d.day_off_reason] || d.day_off_reason}
                          </span>
                        </td>
                      );
                    }
                    const isClickable = d.total_minutes > 0 && d.entries && d.entries.length > 0;
                    return (
                      <td
                        key={d.date}
                        className={`att-cell ${d.missing_report ? "att-cell--missing" : ""} ${d.is_grace_period ? "att-cell--grace" : ""} ${isClickable ? "att-cell--clickable" : ""} ${isTarget ? "att-cell--target" : ""}`}
                        onClick={() => isClickable && handleOpenDayDetails(null, d)}
                        title={d.is_grace_period ? "Délai de grâce (J+1) : à déclarer avant 23h59" : isClickable ? "Cliquer pour voir le détail des tâches" : ""}
                      >
                        <span className="att-time-value">{fmtMinutes(d.total_minutes)}</span>
                        {d.is_grace_period && <span className="att-grace-tag">⏳ J+1</span>}
                        {isClickable && <span className="att-cell-hint" aria-hidden="true"> 🔍</span>}
                      </td>
                    );
                  })}
                  <td className="att-totals-cell" style={{ fontWeight: 700, textAlign: "center", fontFamily: "var(--font-mono)", fontSize: "0.95rem" }}>
                    {fmtMinutes((personalWeek.days || []).reduce((s, d) => s + (d.day_off_reason ? 0 : d.total_minutes), 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* ── Team View Table ──────────────────────────────────── */}
        {!loading && !loadError && isTeamView && (
          <div className="att-table-wrap">
            <table className="att-table att-table--team">
              <thead>
                <tr>
                  <th className="att-th-name">Collaborateur</th>
                  {teamWeeks[0]?.days.map((d) => {
                    const isToday = d.date === todayIso;
                    const isTarget = d.date === targetDateParam;
                    return (
                      <th key={d.date} className={`${isToday ? "att-th--today" : ""} ${isTarget ? "att-th--target" : ""}`}>
                        {DAY_LABELS[parseISODate(d.date).getDay() === 0 ? 6 : parseISODate(d.date).getDay() - 1]}
                        <span className="att-th-date">{fmtDayHeader(d.date)}</span>
                        {isToday && <span className="att-today-pill">Aujourd'hui</span>}
                        {isTarget && <span className="att-target-pill">Cible</span>}
                      </th>
                    );
                  })}
                  <th className="att-th-name">Total semaine</th>
                </tr>
              </thead>
              <tbody>
                {filteredTeamWeeks.map((row) => {
                  const weekTotal = row.days.reduce((s, d) => s + (d.day_off_reason ? 0 : d.total_minutes), 0);
                  const nameParts = row.user_name.split(" ");
                  const firstName = nameParts[0] || "";
                  const lastName = nameParts.slice(1).join(" ") || "";

                  return (
                    <tr key={row.user_id}>
                      <td className="att-th-name">
                        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                          <Avatar firstName={firstName} lastName={lastName} photoUrl={row.photo_url} size={30} />
                          <div>
                            <div style={{ fontWeight: 600 }}>{row.user_name}</div>
                            <span className="att-role-badge">{row.role}</span>
                          </div>
                        </div>
                      </td>
                      {row.days.map((d) => (
                        <DayCell key={d.date} day={d} userName={row.user_name} onSelect={handleOpenDayDetails} targetDate={targetDateParam} />
                      ))}
                      <td className="att-totals-cell" style={{ fontWeight: 700 }}>
                        {fmtMinutes(weekTotal)}
                      </td>
                    </tr>
                  );
                })}

                {filteredTeamWeeks.length === 0 && (
                  <tr>
                    <td colSpan={9} className="att-status">
                      Aucun collaborateur ne correspond à votre recherche.
                    </td>
                  </tr>
                )}

                {filteredTeamWeeks.length > 0 && (() => {
                  const dayTotals = (filteredTeamWeeks[0]?.days || []).map((_, di) =>
                    filteredTeamWeeks.reduce((s, row) => s + (row.days[di]?.day_off_reason ? 0 : row.days[di]?.total_minutes || 0), 0)
                  );
                  return (
                    <tr className="att-totals-row">
                      <td className="att-th-name" style={{ fontWeight: 700 }}>
                        Totaux Équipe
                      </td>
                      {dayTotals.map((total, i) => (
                        <td key={i} className="att-totals-cell" style={{ fontWeight: 700 }}>
                          {fmtMinutes(total)}
                        </td>
                      ))}
                      <td className="att-totals-cell" style={{ fontWeight: 800, fontSize: "0.95rem" }}>
                        {fmtMinutes(dayTotals.reduce((a, b) => a + b, 0))}
                      </td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Legend Bar ───────────────────────────────────────── */}
        <div className="att-legend-bar">
          <div className="att-legend-item">
            <span className="att-legend-swatch att-legend-swatch--ok" /> Présence normale (8h Mon-Fri / 5h Sat)
          </div>
          <div className="att-legend-item">
            <span className="att-legend-swatch att-legend-swatch--grace" /> ⏳ Délai de grâce (J+1 avant 23h59)
          </div>
          <div className="att-legend-item">
            <span className="att-legend-swatch att-legend-swatch--penalized" /> ⚠️ Pénalisé (non payé)
          </div>
          <div className="att-legend-item">
            <span className="att-legend-swatch att-legend-swatch--off" /> 🌴 Congé / Maladie / Férié
          </div>
        </div>

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
                min={(() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); })()}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setEntryDate(e.target.value)}
              />
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem", display: "block" }}>
                Saisie autorisée uniquement pour <strong>aujourd'hui</strong> et <strong>hier</strong>.
              </span>
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
                  placeholder="ex: Réunion d'équipe, Formation Meta Blueprint..."
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
                />
              </div>
            </div>

            {formError && <p className="field-error" role="alert">{formError}</p>}

            <div className="form-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setIsModalOpen(false)}
              >
                Annuler
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={formSubmitting}
              >
                {formSubmitting ? "Enregistrement…" : "Enregistrer la saisie"}
              </button>
            </div>
          </form>
        </Modal>

        {/* ── Modal Popup: Breakdown Details for Day Cell ── */}
        <Modal
          open={!!selectedDayDetails}
          onClose={() => {
            setSelectedDayDetails(null);
            setEditingEntryId(null);
          }}
          title={
            selectedDayDetails
              ? `Détail de présence — ${selectedDayDetails.userName} (${selectedDayDetails.date})`
              : "Détail de présence"
          }
          width={520}
        >
          {selectedDayDetails && (
            <div className="att-breakdown-modal">
              <p className="att-breakdown-total">
                Total déclaré pour cette journée : <strong>{fmtMinutes(selectedDayDetails.total_minutes)}</strong>
              </p>

              <div className="att-breakdown-list">
                {selectedDayDetails.entries.map((te) => (
                  <div key={te.id} className="att-breakdown-item">
                    {editingEntryId === te.id ? (
                      <div style={{ width: "100%" }}>
                        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                          <input
                            type="number"
                            min="0"
                            max="24"
                            style={{ width: "70px" }}
                            value={editHours}
                            onChange={(e) => setEditHours(e.target.value)}
                            placeholder="Heures"
                          />
                          <input
                            type="number"
                            min="0"
                            max="59"
                            style={{ width: "70px" }}
                            value={editMinutes}
                            onChange={(e) => setEditMinutes(e.target.value)}
                            placeholder="Minutes"
                          />
                        </div>
                        {editError && <p className="field-error">{editError}</p>}
                        <div style={{ display: "flex", gap: "0.4rem" }}>
                          <button
                            type="button"
                            className="btn-primary btn-primary--compact"
                            onClick={() => saveEditingEntry(te)}
                            disabled={editSaving}
                          >
                            {editSaving ? "…" : "Enregistrer"}
                          </button>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => setEditingEntryId(null)}
                          >
                            Annuler
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="att-breakdown-info">
                          <span className="att-breakdown-task">
                            [{te.project_title || "Projet"}] {te.task_title || "Activité"}
                          </span>
                          {te.status_title && (
                            <span className="att-breakdown-status">{te.status_title}</span>
                          )}
                        </div>
                        <div className="att-breakdown-right">
                          <span className="att-breakdown-duration">{fmtMinutes(te.hours * 60 + te.minutes)}</span>
                          {te.user_id === user?.id && (
                            <div className="att-breakdown-actions">
                              <button
                                type="button"
                                className="btn-secondary"
                                style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}
                                onClick={() => startEditingEntry(te)}
                              >
                                Modifier
                              </button>
                              <button
                                type="button"
                                className="btn-danger"
                                style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}
                                onClick={() => deleteEntry(te)}
                              >
                                Supprimer
                              </button>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Modal>

        <Modal
          open={settingsModalOpen}
          onClose={() => setSettingsModalOpen(false)}
          title="⚙️ Paramètres du Système"
          width={450}
        >
          <form onSubmit={saveSettings} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div className="field">
              <label>Délai de grâce pour la saisie de temps</label>
              <select
                value={graceDays}
                onChange={(e) => setGraceDays(e.target.value)}
                required
                style={{ width: "100%", padding: "0.6rem", border: "1px solid var(--border)", borderRadius: "8px", background: "var(--card)", color: "var(--ink)" }}
              >
                <option value="1">J+1 (23h59 de grâce le lendemain - Par défaut)</option>
                <option value="2">J+2 (23h59 après 2 jours)</option>
                <option value="3">J+3 (23h59 après 3 jours)</option>
                <option value="4">J+4 (23h59 après 4 jours)</option>
                <option value="5">J+5 (23h59 après 5 jours)</option>
                <option value="7">J+7 (1 semaine complète)</option>
                <option value="30">J+30 (1 mois de tolérance)</option>
              </select>
              <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                Définit la période autorisée pour qu'un collaborateur puisse déclarer ses heures. Au-delà, la journée est marquée comme pénalisée.
              </p>
            </div>

            {settingsError && <p className="field-error">{settingsError}</p>}

            <div className="form-actions" style={{ marginTop: "1rem", display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setSettingsModalOpen(false)}
              >
                Annuler
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={settingsSaving}
              >
                {settingsSaving ? "Sauvegarde..." : "Enregistrer"}
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </AppShell>
  );
}