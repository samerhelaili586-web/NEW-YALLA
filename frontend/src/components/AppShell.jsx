import { useAuth } from "../context/AuthContext";
import { ROLE_LABELS } from "../constants";
import Avatar from "./Avatar";
import NotificationBell from "./notifications/NotificationBell";
import "./AppShell.css";

function ApertureMark() {
  return (
    <svg className="mark" viewBox="0 0 40 40" role="presentation" aria-hidden="true">
      <circle cx="20" cy="20" r="17" className="mark-ring" />
      {Array.from({ length: 6 }).map((_, i) => (
        <polygon
          key={i}
          className="mark-blade"
          points="20,20 33,15 35,25"
          style={{ "--a": `${i * 60}deg` }}
        />
      ))}
    </svg>
  );
}

export default function AppShell({ children }) {
  const { user, logout } = useAuth();

  return (
    <div className="shell">
      <header className="shell-topbar">
        <div className="shell-brand">
          <ApertureMark />
          <span className="shell-brand-text">YALLA</span>
        </div>

        <div className="shell-actions">
          <NotificationBell />

          <div className="shell-user">
            <Avatar firstName={user?.first_name} lastName={user?.last_name} size={34} />
            <div className="shell-user-info">
              <span className="shell-user-name">
                {user?.first_name} {user?.last_name}
              </span>
              <span className="shell-user-role">
                {ROLE_LABELS[user?.effective_role] || user?.effective_role}
              </span>
            </div>
          </div>

          <button className="shell-logout" type="button" onClick={logout}>
            Déconnexion
          </button>
        </div>
      </header>

      <main className="shell-content">{children}</main>
    </div>
  );
}