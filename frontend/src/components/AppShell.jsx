import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { ROLE_LABELS } from "../constants";
import Avatar from "./Avatar";
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
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .get("/notifications/unread-count")
      .then((data) => {
        if (!cancelled) setUnreadCount(data.count);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="shell">
      <header className="shell-topbar">
        <div className="shell-brand">
          <ApertureMark />
          <span className="shell-brand-text">YALLA</span>
        </div>

        <div className="shell-actions">
          <button className="shell-notif" type="button" aria-label="Notifications">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path
                d="M12 3a6 6 0 0 0-6 6v3.3c0 .6-.2 1.2-.6 1.7L4 16h16l-1.4-2c-.4-.5-.6-1.1-.6-1.7V9a6 6 0 0 0-6-6Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <path
                d="M9.5 19a2.5 2.5 0 0 0 5 0"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
            {unreadCount > 0 && <span className="shell-notif-badge">{unreadCount}</span>}
          </button>

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