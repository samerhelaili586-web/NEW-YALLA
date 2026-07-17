import { useEffect, useMemo, useState } from "react";
import { api } from "../../api/client";
import AppShell from "../../components/AppShell";
import { GlowingEffect } from "../../components/GlowingEffect";
import "../../styles/shared.css";
import "./ShootingCalendar.css";

const WEEKDAY_SHORT = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function startOfWeek(date) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonthGrid(date) {
  const d = new Date(date);
  d.setDate(1); // 1st of month
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day); // back to previous Monday
  d.setHours(0, 0, 0, 0);
  return d;
}

function getMonthDays(currentDate) {
  const d = new Date(currentDate);
  d.setDate(1);
  const month = d.getMonth();
  
  const start = startOfMonthGrid(currentDate);
  const days = [];
  let curr = new Date(start);
  
  // Render exactly 42 days (6 weeks) to maintain a consistent grid size
  for (let i = 0; i < 42; i++) {
    days.push(new Date(curr));
    curr.setDate(curr.getDate() + 1);
  }
  return days;
}

function getWeekDays(currentDate) {
  const start = startOfWeek(currentDate);
  const days = [];
  let curr = new Date(start);
  for (let i = 0; i < 7; i++) {
    days.push(new Date(curr));
    curr.setDate(curr.getDate() + 1);
  }
  return days;
}

function addMonths(date, n) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

function fmtMonth(d) {
  return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export default function ShootingCalendar() {
  const [viewMode, setViewMode] = useState("month");
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [shoots, setShoots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const days = useMemo(() => {
    return viewMode === "month" ? getMonthDays(currentDate) : getWeekDays(currentDate);
  }, [currentDate, viewMode]);
  
  const rangeStart = days[0];
  const rangeEnd = days[days.length - 1];

  async function loadShoots() {
    setLoading(true);
    setLoadError("");
    try {
      const data = await api.get("/planification/calendar", {
        start: rangeStart.toISOString(),
        end: new Date(rangeEnd.getTime() + 86400000).toISOString(),
      });
      setShoots(data);
    } catch {
      setLoadError("Impossible de charger le calendrier des shootings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadShoots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate, viewMode]);

  const shootsByDay = useMemo(() => {
    const map = {};
    for (const day of days) {
      map[day.toDateString()] = [];
    }
    for (const shoot of shoots) {
      const shootDay = new Date(shoot.start_at);
      shootDay.setHours(0, 0, 0, 0);
      const key = shootDay.toDateString();
      if (map[key]) map[key].push(shoot);
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => new Date(a.start_at) - new Date(b.start_at));
    }
    return map;
  }, [shoots, days]);

  function goToPrevious() {
    if (viewMode === "month") setCurrentDate((m) => addMonths(m, -1));
    else {
      setCurrentDate(d => {
        const next = new Date(d);
        next.setDate(next.getDate() - 7);
        return next;
      });
    }
  }
  function goToNext() {
    if (viewMode === "month") setCurrentDate((m) => addMonths(m, 1));
    else {
      setCurrentDate(d => {
        const next = new Date(d);
        next.setDate(next.getDate() + 7);
        return next;
      });
    }
  }
  function goToToday() {
    setCurrentDate(new Date());
  }

  const todayKey = new Date().toDateString();
  const targetMonthIndex = currentDate.getMonth();

  return (
    <AppShell>
      <div className={`sc-page${viewMode === "week" ? " is-week-view" : ""}`}>
        <div className="sc-header">
          <div>
            <h1>Calendrier de shooting</h1>
            <p className="sc-subtitle">
              {viewMode === "month" 
                ? fmtMonth(currentDate)
                : `Semaine du ${rangeStart.toLocaleDateString("fr-FR", {day:"numeric", month:"short"})} au ${rangeEnd.toLocaleDateString("fr-FR", {day:"numeric", month:"short"})}`}
            </p>
          </div>
          <div className="sc-nav">
            <button type="button" className="btn-secondary" onClick={() => setViewMode(v => v === "month" ? "week" : "month")}>
              {viewMode === "month" ? "Vue Semaine" : "Vue Mois"}
            </button>
            <div style={{ width: "1px", background: "var(--line)", margin: "0 0.25rem" }}></div>
            <button type="button" className="btn-secondary" onClick={goToPrevious}>
              ← Précédent
            </button>
            <button type="button" className="btn-secondary" onClick={goToToday}>
              Aujourd&rsquo;hui
            </button>
            <button type="button" className="btn-secondary" onClick={goToNext}>
              Suivant →
            </button>
          </div>
        </div>

        {loadError && <p className="tt-status tt-status--error">{loadError}</p>}
        {loading && <p className="tt-status">Chargement…</p>}

        {!loading && (
          <>
            <div className="sc-grid-header">
              {WEEKDAY_SHORT.map(wd => (
                <div key={wd} className="sc-grid-header-day">{wd}</div>
              ))}
            </div>
            <div className="sc-grid">
              {days.map((day) => {
                const key = day.toDateString();
                const dayShoots = shootsByDay[key] || [];
                const isOutsideMonth = day.getMonth() !== targetMonthIndex;
                const isToday = key === todayKey;

                return (
                  <div key={key} className={`sc-day${isToday ? " is-today" : ""}${isOutsideMonth ? " is-outside-month" : ""}`}>
                    <div className="sc-day-header">
                      <span className="sc-day-date">{day.getDate()}</span>
                    </div>
                    <div className="sc-day-body">
                      {dayShoots.map((shoot) => (
                        <div key={shoot.id} className="sc-shoot-card" title={`${shoot.equipment_name} - ${shoot.crew.length} membre(s)`}>
                          {viewMode === "week" && <GlowingEffect spread={40} glow={true} disabled={false} proximity={64} inactiveZone={0.01} borderWidth={1} />}
                          <span className="sc-shoot-time">
                            {fmtTime(shoot.start_at)} – {fmtTime(shoot.end_at)}
                          </span>
                          <span className="sc-shoot-equipment">{shoot.equipment_name}</span>
                          {viewMode === "week" && <span className="sc-shoot-crew">{shoot.crew.length} membre(s)</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* List View for Week Mode */}
            {viewMode === "week" && (
              <div className="sc-list-view">
                <div className="sc-list-header">
                  <h3>Détails de la semaine</h3>
                </div>
                {shoots.length === 0 ? (
                  <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
                    Aucun shooting prévu cette semaine.
                  </div>
                ) : (
                  <table className="sc-list-table">
                    <thead>
                      <tr>
                        <th>Date et Heure</th>
                        <th>Projet / Tâche</th>
                        <th>Matériel</th>
                        <th>Équipe Assignée</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shoots.map(shoot => {
                        const sDate = new Date(shoot.start_at);
                        const dateStr = sDate.toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "short" });
                        return (
                          <tr key={shoot.id}>
                            <td style={{ whiteSpace: "nowrap" }}>
                              <div style={{ fontWeight: 600 }}>{dateStr}</div>
                              <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                                {fmtTime(shoot.start_at)} – {fmtTime(shoot.end_at)}
                              </div>
                            </td>
                            <td>
                              <div style={{ fontWeight: 600 }}>{shoot.project_name || "Projet inconnu"}</div>
                              <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>{shoot.task_title || "Tâche inconnue"}</div>
                            </td>
                            <td style={{ color: "var(--amber)" }}>{shoot.equipment_name}</td>
                            <td>
                              <div className="sc-list-crew-tags">
                                {shoot.crew_names && shoot.crew_names.length > 0 ? (
                                  shoot.crew_names.map((name, i) => (
                                    <span key={i} className="sc-list-crew-tag">{name}</span>
                                  ))
                                ) : (
                                  <span className="sc-list-crew-tag" style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-muted)", borderColor: "var(--line)" }}>
                                    Non assigné
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}