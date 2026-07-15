import { useEffect, useMemo, useState } from "react";
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

      {!loading && !loadError && !isTeamView && personalWeek && (
        <div className="att-table-wrap">
          <table className="att-table">
            <thead>
              <tr>
                {days.map((d) => (
                  <th key={d.date}>
                    {DAY_LABELS[new Date(d.date).getDay() === 0 ? 6 : new Date(d.date).getDay() - 1]}
                    <span className="att-th-date">{fmtDayHeader(d.date)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {days.map((d) => (
                  <DayCell key={d.date} day={d} />
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}

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
              </tr>
            </thead>
            <tbody>
              {teamWeeks.map((row) => (
                <tr key={row.user_id}>
                  <td className="att-th-name">{row.user_name}</td>
                  {row.days.map((d) => (
                    <DayCell key={d.date} day={d} />
                  ))}
                </tr>
              ))}
              {teamWeeks.length === 0 && (
                <tr>
                  <td colSpan={8} className="att-status">
                    Aucun utilisateur actif à afficher.
                  </td>
                </tr>
              )}
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