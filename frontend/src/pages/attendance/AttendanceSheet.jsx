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

function DayCell({ day }) {
  if (day.day_off_reason) {
    return (
      <td className="att-cell att-cell--off">
        <span className="att-off-label">{DAY_OFF_LABELS[day.day_off_reason] || day.day_off_reason}</span>
      </td>
    );
  }
  return (
    <td className={`att-cell ${day.missing_report ? "att-cell--missing" : ""}`}>
      {fmtMinutes(day.total_minutes)}
    </td>
  );
}

export default function AttendanceSheet() {
  const { user } = useAuth();
  const isTeamView = ["admin_sys", "manager"].includes(user?.effective_role);

  const [refDate, setRefDate] = useState(() => toISODate(mondayOf(new Date())));
  const [personalWeek, setPersonalWeek] = useState(null);
  const [teamWeeks, setTeamWeeks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError("");
      try {
        if (isTeamView) {
          const data = await api.get("/attendance/team", { ref_date: refDate });
          if (!cancelled) setTeamWeeks(data);
        } else {
          const data = await api.get("/attendance/me", { ref_date: refDate });
          if (!cancelled) setPersonalWeek(data);
        }
      } catch {
        if (!cancelled) setLoadError("Impossible de charger la feuille de présence.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [refDate, isTeamView]);

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
        <div className="att-week-nav">
          <button type="button" className="btn-secondary" onClick={() => shiftWeek(-7)}>
            ← Semaine préc.
          </button>
          <span className="att-week-label">{weekRangeLabel}</span>
          <button type="button" className="btn-secondary" onClick={() => shiftWeek(7)}>
            Semaine suiv. →
          </button>
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
                        const mins = getTaskMinutesForDay(task.id, d.entries);
                        return (
                          <td key={d.date} className="att-cell">
                            {mins > 0 ? fmtMinutes(mins) : "—"}
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
                    return (
                      <td key={d.date} className={`att-cell att-totals-cell ${d.missing_report ? "att-cell--missing" : ""}`} style={{ fontWeight: 700 }}>
                        {fmtMinutes(d.total_minutes)}
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
                      <DayCell key={d.date} day={d} />
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
    </AppShell>
  );
}