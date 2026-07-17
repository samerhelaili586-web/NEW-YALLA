import { useState, useEffect } from "react";
import { api } from "../api/client";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ROLE_LABELS } from "../constants";
import Avatar from "./Avatar";
import NotificationBell from "./notifications/NotificationBell";
import "./AppShell.css";

// ── Icons ──────────────────────────────────────────────────────────────────
function Icon({ d, size = 18 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const ICONS = {
  home:         "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10",
  projects:     "M3 7h18M3 12h18M3 17h18",
  tasks:        "M9 11l3 3L22 4 M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11",
  montage:      "M15 10l4.553-2.069A1 1 0 0121 8.868V15.13a1 1 0 01-1.447.894L15 14M3 8h12v8H3z",
  planif:       "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  calendar:     "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  attendance:   "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  leave:        "M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z",
  approval:     "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  admin:        "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
  logout:       "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1",
  moon:         "M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z",
  sun:          "M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
};

// ── Nav items (CM now sees Projets per spec §4.2) ──────────────────────────
const NAV_ITEMS = [
  { to: "/",                label: "Accueil",             icon: "home",       roles: null },
  { to: "/projects",        label: "Projets",              icon: "projects",   roles: ["admin_sys", "manager", "chef_prod", "cm"] },
  { to: "/tasks",           label: "Mes tâches",           icon: "tasks",      roles: ["cm", "prod", "chef_prod"] },
  { to: "/tasks-montage",   label: "Tâches Montage",       icon: "montage",    roles: ["prod", "chef_prod"] },
  { to: "/planification",   label: "Planification",        icon: "planif",     roles: ["chef_prod", "admin_sys", "manager"] },
  { to: "/shooting-calendar", label: "Calendrier Shooting", icon: "calendar",  roles: null },
  { to: "/attendance",      label: "Présences",            icon: "attendance", roles: null },
  { to: "/leave",           label: "Congés",               icon: "leave",      roles: null },
  { to: "/leave/approval",  label: "Approbation Congés",   icon: "approval",   roles: ["manager"] },
  { to: "/admin",           label: "Administration",       icon: "admin",      roles: ["admin_sys"] },
];

// ── Brand mark (aperture) removed in favor of image logo ──────────────────────

function MissingTimeAlert() {
  const [alertData, setAlertData] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (new Date().getHours() < 15) return;
    
    const dismissedDate = sessionStorage.getItem("dismissedTimeAlert");
    if (dismissedDate === new Date().toDateString()) {
      setDismissed(true);
      return;
    }

    let active = true;
    api.get("/attendance/alerts/me-yesterday").then((data) => {
      if (active && data?.missing) setAlertData(data);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  function handleDismiss() {
    sessionStorage.setItem("dismissedTimeAlert", new Date().toDateString());
    setDismissed(true);
  }

  if (!alertData || dismissed) return null;

  return (
    <div style={{
      margin: "-2.25rem -2rem 2rem",
      padding: "0.8rem 2rem",
      background: "rgba(181, 66, 58, 0.08)",
      color: "#b5423a",
      borderBottom: "1px solid rgba(181, 66, 58, 0.15)",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      fontFamily: "var(--font-body)",
      fontSize: "0.9rem"
    }}>
      <div>
        <strong style={{ fontWeight: 600 }}>⚠️ Rappel de saisie :</strong> Vous n'avez pas déclaré vos 6 heures minimum lors de votre précédente journée de travail ({new Date(alertData.date).toLocaleDateString("fr-FR")}). Vous n'avez déclaré que {alertData.total_minutes} minutes.
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <NavLink to="/attendance" style={{ fontWeight: 600, color: "#b5423a", textDecoration: "underline" }}>
          Régulariser maintenant
        </NavLink>
        <button type="button" onClick={handleDismiss} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#b5423a", opacity: 0.6, padding: "4px", display: "flex" }}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </div>
  );
}

export default function AppShell({ children }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [isHovered, setIsHovered] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    return document.documentElement.classList.contains("dark") || 
           localStorage.getItem("theme") === "dark";
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark(d => !d);

  const visibleNav = NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(user?.effective_role)
  );

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="shell">
      {/* ── Sidebar ── */}
      <aside 
        className={`shell-sidebar ${isHovered ? "is-expanded" : "is-collapsed"}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="shell-brand">
          <span className="shell-brand-fancy">
            YALLA<span className="shell-brand-dot">.</span>
          </span>
        </div>

        <nav className="shell-nav" aria-label="Navigation principale">
          {visibleNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) => `shell-nav-link${isActive ? " is-active" : ""}`}
            >
              <Icon d={ICONS[item.icon]} size={17} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="shell-sidebar-footer">
          <div className="shell-user">
            <Avatar firstName={user?.first_name} lastName={user?.last_name} size={34} />
            <div className="shell-user-info">
              <span className="shell-user-name">{user?.first_name} {user?.last_name}</span>
              <span className="shell-user-role">{ROLE_LABELS[user?.effective_role] || user?.effective_role}</span>
            </div>
          </div>
          <div className="shell-sidebar-actions">
            <button className="shell-theme-toggle" type="button" onClick={toggleTheme} title="Basculer le thème">
              <Icon d={isDark ? ICONS.sun : ICONS.moon} size={17} />
            </button>
            <NotificationBell />
            <button className="shell-logout" type="button" onClick={handleLogout} title="Déconnexion">
              <Icon d={ICONS.logout} size={17} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="shell-content">
        <MissingTimeAlert />
        {children}
      </main>
    </div>
  );
}