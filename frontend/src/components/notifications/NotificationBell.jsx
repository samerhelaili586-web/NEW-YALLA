import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import "./NotificationBell.css";

function timeAgo(isoString) {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days} j`;
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const containerRef = useRef(null);
  const panelRef = useRef(null);

  async function refreshUnreadCount() {
    try {
      const data = await api.get("/notifications/unread-count");
      setUnreadCount(data.count);
    } catch {
      // silent — badge just won't update this cycle
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fetch on mount
    refreshUnreadCount();
    const interval = setInterval(refreshUnreadCount, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      const clickedInsideWrap = containerRef.current && containerRef.current.contains(e.target);
      const clickedInsidePanel = panelRef.current && panelRef.current.contains(e.target);
      
      if (!clickedInsideWrap && !clickedInsidePanel) {
        setOpen(false);
      }
    }
    function handleKeyDown(e) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  async function loadNotifications() {
    setLoading(true);
    setLoadError("");
    try {
      const data = await api.get("/notifications");
      setNotifications(data);
    } catch {
      setLoadError("Impossible de charger les notifications.");
    } finally {
      setLoading(false);
    }
  }

  function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next) loadNotifications();
  }

  async function handleMarkRead(notif) {
    if (notif.is_read) return;
    setNotifications((prev) =>
      prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      await api.post(`/notifications/${notif.id}/read`);
    } catch {
      // best-effort — next refresh will resync
    }
  }

  async function handleMarkAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    try {
      await api.post("/notifications/mark-all-read");
    } catch {
      // best-effort — next refresh will resync
    }
  }

  async function handleNotificationClick(notif) {
    await handleMarkRead(notif);
    setOpen(false);
    if (notif.link_url) {
      navigate(notif.link_url);
    }
  }

  return (
    <div className="notif-bell-wrap" ref={containerRef}>
      <button
        className="shell-notif"
        type="button"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={toggleOpen}
      >
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

      {open && createPortal(
        <div className="notif-panel" role="dialog" aria-label="Notifications" ref={panelRef}>
          <div className="notif-panel-header">
            <span>Notifications</span>
            {notifications.some((n) => !n.is_read) && (
              <button type="button" className="link-action" onClick={handleMarkAllRead}>
                Tout marquer comme lu
              </button>
            )}
          </div>

          <div className="notif-panel-body">
            {loading && <p className="notif-panel-status">Chargement…</p>}
            {loadError && <p className="notif-panel-status notif-panel-status--error">{loadError}</p>}
            {!loading && !loadError && notifications.length === 0 && (
              <p className="notif-panel-status">Aucune notification.</p>
            )}
            {!loading &&
              notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className={`notif-item${n.is_read ? "" : " is-unread"}${n.link_url ? " is-clickable" : ""}`}
                  onClick={() => handleNotificationClick(n)}
                >
                  <span className="notif-item-dot" />
                  <span className="notif-item-body">
                    <span className="notif-item-message">{n.message}</span>
                    <span className="notif-item-time">
                      {timeAgo(n.created_at)}
                      {n.link_url && !n.is_read && " · Cliquer pour ouvrir"}
                    </span>
                  </span>
                </button>
              ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}