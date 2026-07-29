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
  sun:          "M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z",
  directory:    "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  workflows:    "M5 3h4v4H5V3zM15 3h4v4h-4V3zM5 13h4v4H5v-4zM15 13h4v4h-4v-4zM9 5h6M19 5v8M5 15h6M15 7v6",
  users:        "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8z M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75",
  equipment:    "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
  holidays:     "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  history:      "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  salaires:     "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  announcement: "M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.684A1.76 1.76 0 014.28 12c0-.624.331-1.182.836-1.503l4.743-3.016A1.76 1.76 0 0111 6h7a2 2 0 012 2v4a2 2 0 01-2 2h-7a1.76 1.76 0 01-1.144-.413z",
  book:         "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
  lockClosed:   "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
  lockOpen:     "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-7.9 0",
};

// ── Nav items grouped by section ───────────────────────────────────────────
const NAV_SECTIONS = [
  {
    title: "GÉNÉRAL",
    items: [
      { to: "/",                label: "Accueil",             icon: "home",       roles: null },
      { to: "/guide",           label: "Guide & Workflow",     icon: "book",       roles: null },
      { to: "/annuaire",        label: "Annuaire",            icon: "directory",  roles: null },
      { to: "/announcements",    label: "Communiqués",         icon: "announcement", roles: null },
    ],
  },
  {
    title: "TÂCHES & PROJETS",
    items: [
      { to: "/projects",        label: "Projets",              icon: "projects",   roles: ["admin_sys", "manager", "chef_prod", "cm"] },
      { to: "/tasks",           label: "Mes tâches",           icon: "tasks",      roles: ["cm", "prod", "chef_prod"] },
      { to: "/tasks-montage",   label: "Tâches Montage",       icon: "montage",    roles: ["chef_prod"] },
      { to: "/workflows",      label: "Workflows",           icon: "workflows",  roles: null },
      { to: "/planification",   label: "Planification",        icon: "planif",     roles: ["chef_prod"] },
      { to: "/shooting-calendar", label: "Calendrier Shooting", icon: "calendar",  roles: null },
    ],
  },
  {
    title: "GESTION DU TEMPS",
    items: [
      { to: "/attendance",      label: "Présences",            icon: "attendance", roles: null },
      { to: "/leave",           label: "Congés",               icon: "leave",      roles: null },
      { to: "/leave/approval",  label: "Approbation Congés",   icon: "approval",   roles: ["manager"] },
    ],
  },
  {
    title: "ADMINISTRATION",
    items: [
      { to: "/admin/users",         label: "Utilisateurs",       icon: "users",      roles: ["admin_sys"] },
      { to: "/salaires",            label: "Salaires & Paie",    icon: "salaires",   roles: ["admin_sys"] },
      { to: "/admin/equipment",     label: "Matériel",           icon: "equipment",  roles: ["admin_sys"] },
      { to: "/admin/holidays",      label: "Jours Fériés",       icon: "holidays",   roles: ["admin_sys"] },
      { to: "/admin/login-history", label: "Historique Connexions", icon: "history", roles: ["admin_sys"] },
    ],
  },
];

// ── Planification badge count ─────────────────────────────────────────────
function usePlanifBadge(role) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!["chef_prod", "manager", "admin_sys"].includes(role)) return;
    let active = true;
    api.get("/planification/pending-count").then((data) => {
      if (active) setCount(data?.count ?? 0);
    }).catch(() => {});
    const interval = setInterval(() => {
      api.get("/planification/pending-count").then((data) => {
        if (active) setCount(data?.count ?? 0);
      }).catch(() => {});
    }, 120000);
    return () => { active = false; clearInterval(interval); };
  }, [role]);
  return count;
}

// ── Brand mark (aperture) removed in favor of image logo ──────────────────────

function MissingTimeAlert() {
  const { user } = useAuth();
  const [alertData, setAlertData] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  const showForRole = ["cm", "prod", "chef_prod"].includes(user?.effective_role);

  useEffect(() => {
    if (!showForRole) return;
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
  }, [showForRole]);

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
        <strong style={{ fontWeight: 600 }}>⚠️ Rappel de saisie :</strong> Vous n'avez pas déclaré vos 6 heures minimum lors de votre précédente journée de travail ({new Date(alertData.date).toLocaleDateString("fr-FR")}). Total déclaré : {Math.floor(alertData.total_minutes / 60)}h{String(alertData.total_minutes % 60).padStart(2, "0")}.
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
  const planifBadge = usePlanifBadge(user?.effective_role);
  const [isHovered, setIsHovered] = useState(false);
  const [isSidebarLocked, setIsSidebarLocked] = useState(() => {
    return localStorage.getItem("yalla_sidebar_locked") === "true";
  });
  const [isDark, setIsDark] = useState(() => {
    return document.documentElement.classList.contains("dark") || 
           localStorage.getItem("theme") === "dark";
  });

  useEffect(() => {
    localStorage.setItem("yalla_sidebar_locked", isSidebarLocked ? "true" : "false");
  }, [isSidebarLocked]);

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
  const toggleSidebarLock = () => setIsSidebarLocked(l => !l);

  const visibleSections = NAV_SECTIONS.map((sec) => ({
    ...sec,
    items: sec.items.filter(
      (item) => !item.roles || item.roles.includes(user?.effective_role)
    ),
  })).filter((sec) => sec.items.length > 0);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const isExpanded = isSidebarLocked || isHovered;

  return (
    <div className={`shell${isSidebarLocked ? " is-sidebar-pinned" : ""}`}>
      {/* ── Sidebar ── */}
      <aside 
        className={`shell-sidebar ${isExpanded ? "is-expanded" : "is-collapsed"}${isSidebarLocked ? " is-pinned" : ""}`}
        onMouseEnter={() => !isSidebarLocked && setIsHovered(true)}
        onMouseLeave={() => !isSidebarLocked && setIsHovered(false)}
      >
        <div className="shell-brand">
          <span className="shell-brand-fancy">
            YALLA<span className="shell-brand-dot">.</span>
          </span>
          <button
            className={`shell-lock-btn${isSidebarLocked ? " is-active" : ""}`}
            type="button"
            onClick={toggleSidebarLock}
            title={isSidebarLocked ? "Déverrouiller le menu latéral (mode survol)" : "Verrouiller le menu latéral (garder toujours ouvert)"}
          >
            <Icon d={isSidebarLocked ? ICONS.lockClosed : ICONS.lockOpen} size={15} />
          </button>
        </div>

        <nav className="shell-nav" aria-label="Navigation principale">
          {visibleSections.map((section, idx) => (
            <div key={section.title} className="shell-nav-section">
              {idx > 0 && <div className="shell-nav-divider" />}
              <div className="shell-nav-section-title">{section.title}</div>
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) => `shell-nav-link${isActive ? " is-active" : ""}`}
                >
                  <Icon d={ICONS[item.icon]} size={17} />
                  <span>{item.label}</span>
                  {item.to === "/planification" && planifBadge > 0 && (
                    <span className="shell-nav-badge">{planifBadge}</span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="shell-sidebar-footer">
          <div className="shell-user">
            <Avatar firstName={user?.first_name} lastName={user?.last_name} photoUrl={user?.photo_url} size={34} />
            <div className="shell-user-info">
              <span className="shell-user-name">{user?.first_name} {user?.last_name}</span>
              <span className="shell-user-role">{ROLE_LABELS[user?.effective_role] || user?.effective_role}</span>
            </div>
          </div>
          <div className="shell-sidebar-actions">
            <NotificationBell />
            <button className="shell-theme-toggle" type="button" onClick={toggleTheme} title={isDark ? "Passer au thème clair" : "Passer au thème sombre"}>
              <Icon d={isDark ? ICONS.sun : ICONS.moon} size={17} />
            </button>
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