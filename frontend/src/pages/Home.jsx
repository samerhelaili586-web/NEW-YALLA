import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import AppShell from "../components/AppShell";
import Avatar from "../components/Avatar";
import TaskDetailModal from "../components/TaskDetailModal";
import { GlowingEffect } from "../components/GlowingEffect";
import { UrgentBadge } from "../utils/taskUtils";
import "../styles/shared.css";
import "./Home.css";

const WEEKDAY_LABELS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MONTH_LABELS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

function todayLabel() {
  const now = new Date();
  return `${WEEKDAY_LABELS[now.getDay()]} ${now.getDate()} ${MONTH_LABELS[now.getMonth()]}`;
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString("fr-FR");
}

function fmtTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function fmtMinutes(total) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}h${m.toString().padStart(2, "0")}`;
}

const QUICK_ACTIONS = {
  admin_sys: [
    { to: "/admin", emoji: "⚙️", label: "Administration" },
    { to: "/attendance", emoji: "🕐", label: "Présences" },
    { to: "/leave/approval", label: "Congés", emoji: "✅" },
  ],
  manager: [
    { to: "/projects", emoji: "📁", label: "Projets" },
    { to: "/attendance", emoji: "🕐", label: "Présences" },
    { to: "/leave/approval", emoji: "✅", label: "Approbation congés" },
  ],
  cm: [
    { to: "/projects", emoji: "📁", label: "Mes projets" },
    { to: "/tasks", emoji: "📋", label: "Mes tâches" },
    { to: "/attendance", emoji: "🕐", label: "Mes présences" },
  ],
  prod: [
    { to: "/tasks", emoji: "📋", label: "Mes tâches" },
    { to: "/tasks-montage", emoji: "🎬", label: "Tâches Montage" },
    { to: "/attendance", emoji: "🕐", label: "Mes présences" },
  ],
  chef_prod: [
    { to: "/tasks", emoji: "📋", label: "Mes tâches" },
    { to: "/tasks-montage", emoji: "🎬", label: "Tâches Montage" },
    { to: "/planification", emoji: "📆", label: "Planification" },
  ],
};

export default function Home() {
  const { user } = useAuth();
  const [unavailable, setUnavailable] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [shoots, setShoots] = useState([]);
  const [weeklyHours, setWeeklyHours] = useState(0);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [upcomingOpen, setUpcomingOpen] = useState(false);

  async function loadDashboard() {
    try {
      setLoadError("");
      const [unavailData, upcomingData, tasksData, projectsData, shootsData] = await Promise.all([
        api.get("/leave/unavailable-today").catch(() => []),
        api.get("/leave/unavailable-upcoming").catch(() => []),
        api.get("/tasks", { assigned_to_me: 1 }).catch(() => []),
        api.get("/projects").catch(() => []),
        api.get("/planification/calendar").catch(() => []),
      ]);

      setUnavailable(unavailData);
      setUpcoming(upcomingData);
      setProjects(projectsData);

      // Top pending/late tasks
      const pendingTasks = tasksData
        .filter((t) => !["final_confirmation", "final_rejet"].includes(t.status_functional_type))
        .sort((a, b) => new Date(a.planned_publish_date) - new Date(b.planned_publish_date));
      setTasks(pendingTasks);

      // Future shoots
      const todayStr = new Date().toISOString().slice(0, 10);
      const futureShoots = shootsData
        .filter((s) => s.start_at >= todayStr)
        .slice(0, 3);
      setShoots(futureShoots);

      // Weekly timesheet hours count (target 36h)
      let loggedMins = 0;
      if (user) {
        if (["cm", "prod", "chef_prod"].includes(user.effective_role)) {
          const meData = await api.get("/attendance/me").catch(() => null);
          loggedMins = (meData?.days || []).reduce((s, d) => s + (d.total_minutes || 0), 0);
        } else {
          const teamData = await api.get("/attendance/team").catch(() => []);
          loggedMins = teamData.reduce((s, u) => s + (u.days || []).reduce((s2, d) => s2 + (d.total_minutes || 0), 0), 0);
        }
      }
      setWeeklyHours(loggedMins);

    } catch (err) {
      setLoadError("Certaines données du tableau de bord n'ont pas pu être chargées.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    if (active) loadDashboard();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const quickActions = QUICK_ACTIONS[user?.effective_role] || [];
  
  // Weekly hours calculations
  const weeklyTargetHours = ["admin_sys", "manager"].includes(user?.effective_role) ? 100 : 36;
  const weeklyMinsTarget = weeklyTargetHours * 60;
  const progressPercent = Math.min(100, Math.round((weeklyHours / weeklyMinsTarget) * 100));

  // Projects quick metrics
  const activeProjCount = projects.filter(p => p.status === "actif").length;
  const onHoldProjCount = projects.filter(p => p.status === "on_hold").length;
  const termProjCount = projects.filter(p => p.status === "termine").length;

  return (
    <AppShell>
      {/* ── Welcome Banner ── */}
      <div className="dash-welcome-card">
        <GlowingEffect spread={40} glow={true} disabled={false} proximity={64} inactiveZone={0.01} />
        <div className="dash-welcome-content">
          <div className="dash-welcome-text">
            <h1>Bonjour, {user?.first_name} 👋</h1>
            <p className="page-subtitle" style={{ textTransform: "capitalize" }}>{todayLabel()}</p>
          </div>

          <div className="dash-weekly-stat" style={{ minWidth: "auto" }}>
            <div className="dash-stat-info" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.2rem" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 500 }}>
                {["admin_sys", "manager"].includes(user?.effective_role)
                  ? "Temps total équipe cette semaine"
                  : "Mon temps de travail cette semaine"
                }
              </span>
              <strong style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--ink)" }}>{fmtMinutes(weeklyHours)}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick Actions ── */}
      {quickActions.length > 0 && (
        <section className="home-quick-actions">
          {quickActions.map((a) => (
            <Link key={a.to} to={a.to} className="home-quick-btn">
              <GlowingEffect spread={40} glow={true} disabled={false} proximity={64} inactiveZone={0.01} />
              <span className="home-quick-emoji">{a.emoji}</span>
              <span className="home-quick-label">{a.label}</span>
            </Link>
          ))}
        </section>
      )}

      {/* ── Main Dashboard Layout ── */}
      <div className="home-grid">
        <div className="dash-main-col">
          {/* Urgent tasks */}
          <section className="dash-section">
            <div className="dash-section-header">
              <h2>Mes tâches prioritaires</h2>
              <Link to="/tasks" className="dash-section-link">Voir toutes mes tâches →</Link>
            </div>
            
            {loading && <p className="directory-status">Chargement des tâches…</p>}
            
            {!loading && tasks.length === 0 && (
              <div className="dash-empty-card">
                <span>🎉</span>
                <p>Aucune tâche urgente à faire. Bien joué !</p>
              </div>
            )}

            {!loading && tasks.length > 0 && (
              <div className="dash-list">
                {tasks.slice(0, 4).map((t) => (
                  <div key={t.id} className="dash-task-item" onClick={() => setSelectedTaskId(t.id)}>
                    <GlowingEffect spread={30} glow={true} disabled={false} proximity={48} inactiveZone={0.01} />
                    <div className="dash-task-left">
                      <span className="dash-task-type">{t.task_type_name}</span>
                      <p className="dash-task-title">{t.title}</p>
                    </div>
                    <div className="dash-task-right">
                      <span className="status-chip is-active" style={{ fontSize: "0.75rem" }}>
                        {t.status_title}
                      </span>
                      <UrgentBadge date={t.planned_publish_date} isCompleted={false} />
                      {t.is_late ? (
                        <span className="badge-unavailable" style={{ fontSize: "0.68rem", padding: "0.15rem 0.5rem" }}>En retard</span>
                      ) : (
                        <span className="dash-task-due">Échéance : {fmtDate(t.planned_publish_date)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Upcoming Shootings */}
          <section className="dash-section" style={{ marginTop: "1.75rem" }}>
            <div className="dash-section-header">
              <h2>Prochains Shootings</h2>
              <Link to="/shooting-calendar" className="dash-section-link">Calendrier complet →</Link>
            </div>

            {loading && <p className="directory-status">Chargement des shootings…</p>}

            {!loading && shoots.length === 0 && (
              <div className="dash-empty-card">
                <span>🎥</span>
                <p>Aucun shooting prévu prochainement.</p>
              </div>
            )}

            {!loading && shoots.length > 0 && (
              <div className="dash-shoot-grid">
                {shoots.map((s) => (
                  <div key={s.id} className="dash-shoot-card">
                    <GlowingEffect spread={40} glow={true} disabled={false} proximity={64} inactiveZone={0.01} />
                    <div className="dash-shoot-header">
                      <span className="dash-shoot-proj">{s.project_name || "Projet"}</span>
                      <span className="dash-shoot-time">{fmtTime(s.start_at)} - {fmtTime(s.end_at)}</span>
                    </div>
                    <p className="dash-shoot-title">{s.task_title || "Shooting"}</p>
                    
                    <div className="dash-shoot-details">
                      <div className="dash-shoot-detail-row">
                        <strong>📅 Date :</strong> <span>{fmtDate(s.start_at)}</span>
                      </div>
                      {s.equipment_name && (
                        <div className="dash-shoot-detail-row">
                          <strong>⚙️ Matériel :</strong> <span>{s.equipment_name}</span>
                        </div>
                      )}
                      {s.crew_names && s.crew_names.length > 0 && (
                        <div className="dash-shoot-crew">
                          <strong>👥 Équipe :</strong>
                          <div className="dash-shoot-crew-names">
                            {s.crew_names.map((name, idx) => (
                              <span key={idx} className="dash-shoot-crew-pill">{name}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Sidebar */}
        <div className="dash-sidebar-col">
          {/* Absents */}
          <aside className="unavailable-panel">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.8rem" }}>
              <h2 style={{ margin: 0, fontSize: "0.92rem" }}>Absents aujourd&rsquo;hui</h2>
              <button
                type="button"
                className="btn-secondary"
                style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem" }}
                onClick={() => setUpcomingOpen(true)}
              >
                Voir tout
              </button>
            </div>
            {!loading && unavailable.length === 0 && (
              <p className="unavailable-empty">✓ Tout le monde est disponible.</p>
            )}
            <ul className="unavailable-list">
              {unavailable.map((u) => (
                <li key={`${u.user_id}-${u.reason}`} className="unavailable-item">
                  <span className="unavailable-name">{u.user_name}</span>
                  <span className={`unavailable-reason unavailable-reason--${u.reason}`}>
                    {u.reason === "conge" ? "Congé" : "Maladie"}
                  </span>
                </li>
              ))}
            </ul>
          </aside>

          {/* Agency Projects Stats */}
          <section className="unavailable-panel" style={{ marginTop: "1.25rem" }}>
            <h2 style={{ fontSize: "0.92rem", marginBottom: "0.8rem" }}>Statistiques Projets</h2>
            <div className="dash-stats-grid">
              <div className="dash-stat-box">
                <span className="dash-stat-val">{activeProjCount}</span>
                <span className="dash-stat-lbl">Actifs</span>
              </div>
              <div className="dash-stat-box">
                <span className="dash-stat-val" style={{ color: "var(--amber-deep)" }}>{onHoldProjCount}</span>
                <span className="dash-stat-lbl">En pause</span>
              </div>
              <div className="dash-stat-box">
                <span className="dash-stat-val" style={{ color: "var(--primary)" }}>{termProjCount}</span>
                <span className="dash-stat-lbl">Terminés</span>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Task detail modal deep linking */}
      {selectedTaskId && (
        <TaskDetailModal
          taskId={selectedTaskId}
          open={true}
          onClose={() => setSelectedTaskId(null)}
          onChanged={loadDashboard}
        />
      )}

      {/* Upcoming absences modal */}
      {upcomingOpen && (
        <div className="modal-overlay" onClick={() => setUpcomingOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "16px", padding: "1.5rem", width: "min(560px, 92vw)", maxHeight: "80vh", overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
              <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "1.15rem" }}>Indisponibilités à venir</h2>
              <button type="button" onClick={() => setUpcomingOpen(false)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "1.2rem" }}>✕</button>
            </div>
            {upcoming.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>✓ Aucune indisponibilité à venir.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "0.5rem 0.6rem", borderBottom: "2px solid var(--line)", fontWeight: 600, color: "var(--text-muted)" }}>Collaborateur</th>
                    <th style={{ textAlign: "left", padding: "0.5rem 0.6rem", borderBottom: "2px solid var(--line)", fontWeight: 600, color: "var(--text-muted)" }}>Motif</th>
                    <th style={{ textAlign: "left", padding: "0.5rem 0.6rem", borderBottom: "2px solid var(--line)", fontWeight: 600, color: "var(--text-muted)" }}>Période</th>
                  </tr>
                </thead>
                <tbody>
                  {upcoming.map((u, i) => (
                    <tr key={i}>
                      <td style={{ padding: "0.5rem 0.6rem", borderBottom: "1px solid var(--line)" }}>{u.user_name}</td>
                      <td style={{ padding: "0.5rem 0.6rem", borderBottom: "1px solid var(--line)" }}>
                        <span className={`unavailable-reason unavailable-reason--${u.reason}`}>
                          {u.reason === "conge" ? "Congé" : "Maladie"}
                        </span>
                      </td>
                      <td style={{ padding: "0.5rem 0.6rem", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap" }}>
                        {new Date(u.start).toLocaleDateString("fr-FR")} → {new Date(u.end).toLocaleDateString("fr-FR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
