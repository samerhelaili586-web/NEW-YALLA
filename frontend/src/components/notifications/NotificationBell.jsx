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
  const [deleteConfirm, setDeleteConfirm] = useState(false);
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
    refreshUnreadCount();
    const interval = setInterval(refreshUnreadCount, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      const clickedInsideWrap = containerRef.current && containerRef.current.contains(e.target);
      const clickedInsidePanel = panelRef.current && panelRef.current.contains(e.target);
      if (!clickedInsideWrap && !clickedInsidePanel) {
        setOpen(false);
        setDeleteConfirm(false);
      }
    }
    function handleKeyDown(e) {
      if (e.key === "Escape") { setOpen(false); setDeleteConfirm(false); }
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
    setDeleteConfirm(false);
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
      // best-effort
    }
  }

  async function handleMarkAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    try {
      await api.post("/notifications/mark-all-read");
    } catch {
      // best-effort
    }
  }

  async function handleToggleLock(e, notif) {
    e.stopPropagation(); // prevent item click / navigation
    const newLockState = !notif.is_locked;
    setNotifications((prev) =>
      prev.map((n) => (n.id === notif.id ? { ...n, is_locked: newLockState } : n))
    );
    try {
      await api.post(`/notifications/${notif.id}/toggle-lock`);
    } catch {
      // resync if error
      loadNotifications();
    }
  }

  async function handleClearAll() {
    if (!deleteConfirm) {
      // First click — arm the confirmation
      setDeleteConfirm(true);
      return;
    }
    // Second click — delete ONLY unlocked notifications
    setNotifications((prev) => prev.filter((n) => n.is_locked));
    setDeleteConfirm(false);
    
    // Recalculate unread count for remaining locked items
    refreshUnreadCount();

    try {
      await api.delete("/notifications/clear-all");
    } catch {
      loadNotifications(); // resync on failure
    }
  }

  async function handleNotificationClick(notif) {
    await handleMarkRead(notif);
    setOpen(false);
    if (notif.link_url) {
      navigate(notif.link_url);
    }
  }

  const unlockedCount = notifications.filter((n) => !n.is_locked).length;

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
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              {notifications.some((n) => !n.is_read) && (
                <button type="button" className="link-action" onClick={handleMarkAllRead}>
                  Tout marquer comme lu
                </button>
              )}
              {unlockedCount > 0 && (
                <button
                  type="button"
                  className={`notif-delete-btn${deleteConfirm ? " notif-delete-btn--confirm" : ""}`}
                  onClick={handleClearAll}
                  title={deleteConfirm ? "Cliquer pour confirmer la suppression" : "Supprimer les notifications non verrouillées"}
                >
                  {deleteConfirm ? (
                    <>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M12 9v4m0 4h.01"/>
                        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                      </svg>
                      Confirmer ?
                    </>
                  ) : (
                    <>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14H6L5 6"/>
                        <path d="M10 11v6M14 11v6"/>
                        <path d="M9 6V4h6v2"/>
                      </svg>
                      Supprimer tout
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          <div className="notif-panel-body">
            {loading && <p className="notif-panel-status">Chargement…</p>}
            {loadError && <p className="notif-panel-status notif-panel-status--error">{loadError}</p>}
            {!loading && !loadError && notifications.length === 0 && (
              <p className="notif-panel-status">Aucune notification.</p>
            )}
            {!loading &&
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`notif-item-row${n.is_read ? "" : " is-unread"}${n.is_locked ? " is-locked" : ""}`}
                >
                  <button
                    type="button"
                    className={`notif-item${n.link_url ? " is-clickable" : ""}`}
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

                  <button
                    type="button"
                    className={`notif-lock-btn${n.is_locked ? " is-active" : ""}`}
                    onClick={(e) => handleToggleLock(e, n)}
                    title={n.is_locked ? "Verrouillée (protégée contre la suppression)" : "Verrouiller pour protéger de la suppression"}
                  >
                    {n.is_locked ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                        <path d="M7 11V7a5 5 0 0110 0v4"/>
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                        <path d="M7 11V7a5 5 0 019.9-1"/>
                      </svg>
                    )}
                  </button>
                </div>
              ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}