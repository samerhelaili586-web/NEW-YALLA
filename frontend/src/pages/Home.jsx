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
  const dayName = WEEKDAY_LABELS[now.getDay()];
  const capDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);
  return `${capDay} ${now.getDate()} ${MONTH_LABELS[now.getMonth()]}`;
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour >= 18 || hour < 5) return "Bonsoir";
  return "Bonjour";
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
    { to: "/admin/parametres", emoji: "⚙️", label: "Administration", bg: "linear-gradient(135deg, #6366f1, #8b5cf6)" },
    { to: "/attendance", emoji: "🕐", label: "Présences", bg: "linear-gradient(135deg, #f59e0b, #d97706)" },
    { to: "/task-types", emoji: "⚡", label: "Workflows", bg: "linear-gradient(135deg, #10b981, #059669)" },
  ],
  manager: [
    { to: "/projects", emoji: "🎯", label: "Projets", bg: "linear-gradient(135deg, #6366f1, #8b5cf6)" },
    { to: "/attendance", emoji: "🕐", label: "Présences", bg: "linear-gradient(135deg, #f59e0b, #d97706)" },
    { to: "/leave/approval", emoji: "🌴", label: "Approbation", bg: "linear-gradient(135deg, #10b981, #059669)" },
  ],
  cm: [
    { to: "/projects", emoji: "🎯", label: "Mes projets", bg: "linear-gradient(135deg, #6366f1, #8b5cf6)" },
    { to: "/tasks", emoji: "📋", label: "Mes tâches", bg: "linear-gradient(135deg, #06b6d4, #0891b2)" },
    { to: "/attendance", emoji: "🕐", label: "Présences", bg: "linear-gradient(135deg, #f59e0b, #d97706)" },
  ],
  prod: [
    { to: "/tasks", emoji: "📋", label: "Mes tâches", bg: "linear-gradient(135deg, #06b6d4, #0891b2)" },
    { to: "/tasks-montage", emoji: "🎬", label: "Montage", bg: "linear-gradient(135deg, #8b5cf6, #7c3aed)" },
    { to: "/attendance", emoji: "🕐", label: "Présences", bg: "linear-gradient(135deg, #f59e0b, #d97706)" },
  ],
  chef_prod: [
    { to: "/tasks", emoji: "📋", label: "Mes tâches", bg: "linear-gradient(135deg, #06b6d4, #0891b2)" },
    { to: "/tasks-montage", emoji: "🎬", label: "Montage", bg: "linear-gradient(135deg, #8b5cf6, #7c3aed)" },
    { to: "/planification", emoji: "⚡", label: "Planification", bg: "linear-gradient(135deg, #f59e0b, #d97706)" },
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

      // Weekly timesheet hours count
      let loggedMins = 0;
      if (user) {
        if (["cm", "prod", "chef_prod"].includes(user.effective_role)) {
          const meData = await api.get("/attendance/me").catch(() => null);
          loggedMins = (meData?.days || []).reduce((s, d) => s + (d.total_minutes || 0), 0);
        } else {
          const summaryData = await api.get("/attendance/summary").catch(() => null);
          loggedMins = summaryData?.weekly_minutes || 0;
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
      {/* ── Welcome Hero Banner ── */}
      <div className="dash-welcome-card">
        <GlowingEffect spread={40} glow={true} disabled={false} proximity={64} inactiveZone={0.01} />
        <div className="dash-welcome-content">
          <div className="dash-welcome-text">
            <div className="dash-status-pill">
              <span className="dash-pulse-dot" />
              <span>Agence Active · Production</span>
            </div>
            <h1>{getGreeting()}, {user?.first_name} 👋</h1>
            <p className="page-subtitle">{todayLabel()}</p>
          </div>

          <div className="dash-weekly-stat">
            <div className="dash-stat-info">
              <span className="dash-stat-title">
                {["admin_sys", "manager"].includes(user?.effective_role)
                  ? "Temps total équipe cette semaine"
                  : "Mon temps de travail cette semaine"
                }
              </span>
              <strong className="dash-stat-hours">{fmtMinutes(weeklyHours)}</strong>
            </div>
            <div className="dash-progress-track">
              <div className="dash-progress-fill" style={{ width: `${progressPercent}%` }} />
            </div>
            <span className="dash-progress-lbl">{progressPercent}% complété</span>
          </div>
        </div>
      </div>

      {/* ── Quick Actions ── */}
      {quickActions.length > 0 && (
        <section className="home-quick-actions">
          {quickActions.map((a) => (
            <Link key={a.to} to={a.to} className="home-quick-btn">
              <GlowingEffect spread={40} glow={true} disabled={false} proximity={64} inactiveZone={0.01} />
              <div className="home-quick-icon-badge" style={{ background: a.bg }}>
                {a.emoji}
              </div>
              <span className="home-quick-label">{a.label}</span>
            </Link>
          ))}
        </section>
      )}

      {/* ── Main Dashboard Grid ── */}
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
                <span className="dash-empty-emoji">🎉</span>
                <h3>Aucune tâche urgente en attente</h3>
                <p>Toutes vos tâches attribuées sont à jour. Excellent travail !</p>
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
                <span className="dash-empty-emoji">🎥</span>
                <h3>Aucun shooting prévu prochainement</h3>
                <p>Consultez le calendrier de production pour réserver de nouveaux créneaux.</p>
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
          {/* Absents aujourd'hui */}
          <aside className="unavailable-panel">
            <GlowingEffect spread={30} glow={true} disabled={false} proximity={50} inactiveZone={0.01} />
            <div className="dash-widget-header">
              <h3>🌴 Absents aujourd'hui</h3>
              <button
                type="button"
                className="dash-link-btn"
                onClick={() => setUpcomingOpen(true)}
              >
                À venir →
              </button>
            </div>
            {!loading && unavailable.length === 0 && (
              <div className="unavailable-empty-box">
                <span>✓</span>
                <p>Toute l'équipe est présente aujourd'hui.</p>
              </div>
            )}
            {unavailable.length > 0 && (
              <div className="unavailable-list-wrap">
                {unavailable.map((u) => (
                  <div key={`${u.user_id}-${u.reason}`} className="unavailable-card-item">
                    <div className="unavailable-user">
                      <span className="unavailable-dot" />
                      <div>
                        <div className="unavailable-name">{u.user_name}</div>
                        <div className="unavailable-dates">
                          {u.start ? `${new Date(u.start).toLocaleDateString("fr-FR")} → ${new Date(u.end).toLocaleDateString("fr-FR")}` : "Aujourd'hui"}
                        </div>
                      </div>
                    </div>
                    <span className={`unavailable-reason-pill unavailable-reason--${u.reason}`}>
                      Indisponible
                    </span>
                  </div>
                ))}
              </div>
            )}
          </aside>

          {/* Agency Projects Stats */}
          <section className="unavailable-panel" style={{ marginTop: "1.25rem" }}>
            <GlowingEffect spread={30} glow={true} disabled={false} proximity={50} inactiveZone={0.01} />
            <div className="dash-widget-header">
              <h3>📊 Projets par Statut</h3>
              <Link to="/projects" style={{ fontSize: "0.75rem", color: "var(--primary)", textDecoration: "none", fontWeight: 600 }}>Voir tout</Link>
            </div>
            <div className="dash-stats-grid">
              <div className="dash-stat-box dash-stat-box--actif">
                <span className="dash-stat-val">{activeProjCount}</span>
                <span className="dash-stat-lbl">Actifs</span>
              </div>
              <div className="dash-stat-box dash-stat-box--pause">
                <span className="dash-stat-val">{onHoldProjCount}</span>
                <span className="dash-stat-lbl">En pause</span>
              </div>
              <div className="dash-stat-box dash-stat-box--termine">
                <span className="dash-stat-val">{termProjCount}</span>
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
