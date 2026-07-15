import { useEffect, useMemo, useState } from "react";
import { api } from "../../api/client";
import AppShell from "../../components/AppShell";
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

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function fmtDay(d) {
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export default function ShootingCalendar() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [shoots, setShoots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  async function loadShoots() {
    setLoading(true);
    setLoadError("");
    try {
      const data = await api.get("/planification/calendar", {
        start: weekStart.toISOString(),
        end: addDays(weekEnd, 1).toISOString(),
      });
      setShoots(data);
    } catch {
      setLoadError("Impossible de charger le calendrier des shootings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
  // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fetch on week change
  loadShoots();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- loadShoots always closes over current weekStart
}, [weekStart]);

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

  function goToPreviousWeek() {
    setWeekStart((w) => addDays(w, -7));
  }
  function goToNextWeek() {
    setWeekStart((w) => addDays(w, 7));
  }
  function goToToday() {
    setWeekStart(startOfWeek(new Date()));
  }

  const todayKey = new Date().toDateString();

  return (
    <AppShell>
      <div className="sc-page">
        <div className="sc-header">
          <div>
            <h1>Calendrier de shooting</h1>
            <p className="sc-subtitle">
              Semaine du {fmtDay(weekStart)} au {fmtDay(weekEnd)}
            </p>
          </div>
          <div className="sc-nav">
            <button type="button" className="btn-secondary" onClick={goToPreviousWeek}>
              ← Précédente
            </button>
            <button type="button" className="btn-secondary" onClick={goToToday}>
              Aujourd&rsquo;hui
            </button>
            <button type="button" className="btn-secondary" onClick={goToNextWeek}>
              Suivante →
            </button>
          </div>
        </div>

        {loadError && <p className="tt-status tt-status--error">{loadError}</p>}
        {loading && <p className="tt-status">Chargement…</p>}

        {!loading && (
          <div className="sc-grid">
            {days.map((day) => {
              const key = day.toDateString();
              const dayShoots = shootsByDay[key] || [];
              return (
                <div key={key} className={`sc-day${key === todayKey ? " is-today" : ""}`}>
                  <div className="sc-day-header">
                    <span className="sc-day-weekday">{WEEKDAY_SHORT[(day.getDay() + 6) % 7]}</span>
                    <span className="sc-day-date">{day.getDate()}</span>
                  </div>
                  <div className="sc-day-body">
                    {dayShoots.length === 0 && <p className="sc-day-empty">—</p>}
                    {dayShoots.map((shoot) => (
                      <div key={shoot.id} className="sc-shoot-card">
                        <span className="sc-shoot-time">
                          {fmtTime(shoot.start_at)} – {fmtTime(shoot.end_at)}
                        </span>
                        <span className="sc-shoot-equipment">{shoot.equipment_name}</span>
                        <span className="sc-shoot-crew">{shoot.crew.length} membre(s)</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}