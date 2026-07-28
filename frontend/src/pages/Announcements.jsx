import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import AppShell from "../components/AppShell";
import Avatar from "../components/Avatar";
import Modal from "../components/Modal";
import "../styles/shared.css";
import "./Announcements.css";

const PRIORITY_LABELS = {
  info: { label: "Information", icon: "📢", badgeClass: "ann-priority--info" },
  important: { label: "Important", icon: "⚠️", badgeClass: "ann-priority--important" },
  urgent: { label: "Urgent", icon: "🚨", badgeClass: "ann-priority--urgent" },
};

export default function Announcements() {
  const { user } = useAuth();
  const isManagerOrAdmin = ["admin_sys", "manager"].includes(user?.effective_role);

  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters & Search
  const [search, setSearch] = useState("");
  const [filterTab, setFilterTab] = useState("all"); // all | unread | urgent | my

  // Create / Edit Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState("info");
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Read Receipts Modal State
  const [receiptsModalOpen, setReceiptsModalOpen] = useState(false);
  const [selectedAnnouncementDetail, setSelectedAnnouncementDetail] = useState(null);
  const [receiptsLoading, setReceiptsLoading] = useState(false);
  const [receiptsTab, setReceiptsTab] = useState("read"); // read | unread

  const loadAnnouncements = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.get("/announcements");
      setAnnouncements(data || []);
    } catch {
      setError("Impossible de charger les communiqués.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnnouncements();
  }, []);

  function handleOpenCreateModal() {
    setEditingItem(null);
    setTitle("");
    setContent("");
    setPriority("info");
    setFormError("");
    setModalOpen(true);
  }

  function handleOpenEditModal(item) {
    setEditingItem(item);
    setTitle(item.title);
    setContent(item.content);
    setPriority(item.priority);
    setFormError("");
    setModalOpen(true);
  }

  async function handleSaveAnnouncement(e) {
    e.preventDefault();
    setFormError("");
    if (!title.trim() || !content.trim()) {
      setFormError("Veuillez remplir le titre et le contenu.");
      return;
    }

    setFormSubmitting(true);
    try {
      if (editingItem) {
        await api.put(`/announcements/${editingItem.id}`, { title, content, priority });
      } else {
        await api.post("/announcements", { title, content, priority });
      }
      setModalOpen(false);
      loadAnnouncements();
    } catch (err) {
      setFormError(err?.data?.detail || err?.data?.error || "Erreur lors de l'enregistrement.");
    } finally {
      setFormSubmitting(false);
    }
  }

  async function handleDeleteAnnouncement(item) {
    if (!window.confirm(`Supprimer le communiqué "${item.title}" ?`)) return;
    try {
      await api.delete(`/announcements/${item.id}`);
      loadAnnouncements();
    } catch (err) {
      alert(err?.data?.detail || "Erreur lors de la suppression.");
    }
  }

  async function handleMarkAsRead(item) {
    try {
      await api.post(`/announcements/${item.id}/read`);
      setAnnouncements((prev) =>
        prev.map((a) => (a.id === item.id ? { ...a, is_read_by_me: true, read_count: a.read_count + 1 } : a))
      );
    } catch {
      // silent
    }
  }

  async function handleOpenReadReceipts(item) {
    setReceiptsLoading(true);
    setReceiptsTab("read");
    setReceiptsModalOpen(true);
    try {
      const detail = await api.get(`/announcements/${item.id}`);
      setSelectedAnnouncementDetail(detail);
    } catch {
      setSelectedAnnouncementDetail(item);
    } finally {
      setReceiptsLoading(false);
    }
  }

  const filteredAnnouncements = useMemo(() => {
    return announcements.filter((item) => {
      const textMatch =
        item.title.toLowerCase().includes(search.toLowerCase()) ||
        item.content.toLowerCase().includes(search.toLowerCase());
      if (!textMatch) return false;

      if (filterTab === "unread") return !item.is_read_by_me;
      if (filterTab === "urgent") return item.priority === "urgent" || item.priority === "important";
      if (filterTab === "my") return item.author_id === user?.id;

      return true;
    });
  }, [announcements, search, filterTab, user?.id]);

  const unreadCount = useMemo(() => {
    return announcements.filter((a) => !a.is_read_by_me).length;
  }, [announcements]);

  return (
    <AppShell>
      <div className="ann-container">
        {/* ── Top Header ────────────────────────────────────────── */}
        <div className="ann-header">
          <div>
            <h1 className="ann-title">Communiqués & Notes Internes</h1>
            <p className="ann-subtitle">
              Espace d'information et annonces officielles diffusées à l'ensemble de l'équipe.
            </p>
          </div>

          {isManagerOrAdmin && (
            <button
              type="button"
              className="btn-primary"
              onClick={handleOpenCreateModal}
              style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
              Nouveau communiqué
            </button>
          )}
        </div>

        {/* ── KPI Stat Summary Cards ────────────────────────────── */}
        <div className="ann-kpi-grid">
          <div className="ann-kpi-card">
            <span className="ann-kpi-label">Total Communiqués</span>
            <div className="ann-kpi-val-row">
              <span className="ann-kpi-value">{announcements.length}</span>
              <span className="ann-kpi-tag ann-kpi-tag--blue">📢 Annonces</span>
            </div>
          </div>

          <div className="ann-kpi-card">
            <span className="ann-kpi-label">Non Lus Pour Vous</span>
            <div className="ann-kpi-val-row">
              <span className="ann-kpi-value" style={{ color: unreadCount > 0 ? "#f59e0b" : "var(--ink)" }}>
                {unreadCount}
              </span>
              <span className={`ann-kpi-tag ${unreadCount > 0 ? "ann-kpi-tag--amber" : "ann-kpi-tag--gray"}`}>
                {unreadCount > 0 ? "⏳ En attente" : "✓ À jour"}
              </span>
            </div>
          </div>

          <div className="ann-kpi-card">
            <span className="ann-kpi-label">Communiqués Urgents</span>
            <div className="ann-kpi-val-row">
              <span className="ann-kpi-value">
                {announcements.filter((a) => a.priority === "urgent" || a.priority === "important").length}
              </span>
              <span className="ann-kpi-tag ann-kpi-tag--red">🚨 Prioritaires</span>
            </div>
          </div>
        </div>

        {/* ── Toolbar & Filters ─────────────────────────────────── */}
        <div className="ann-toolbar">
          <input
            type="text"
            className="users-search"
            placeholder="Rechercher une note ou mot-clé…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: "280px" }}
          />

          <div className="users-filters">
            <button
              type="button"
              className={`chip-toggle ${filterTab === "all" ? "is-selected" : ""}`}
              onClick={() => setFilterTab("all")}
            >
              Tous ({announcements.length})
            </button>
            <button
              type="button"
              className={`chip-toggle ${filterTab === "unread" ? "is-selected" : ""}`}
              onClick={() => setFilterTab("unread")}
            >
              Non lus ({unreadCount})
            </button>
            <button
              type="button"
              className={`chip-toggle ${filterTab === "urgent" ? "is-selected" : ""}`}
              onClick={() => setFilterTab("urgent")}
            >
              Urgents & Importants
            </button>
            {isManagerOrAdmin && (
              <button
                type="button"
                className={`chip-toggle ${filterTab === "my" ? "is-selected" : ""}`}
                onClick={() => setFilterTab("my")}
              >
                Mes publications
              </button>
            )}
          </div>
        </div>

        {loading && <p className="ann-status">Chargement des communiqués…</p>}
        {error && <p className="ann-status ann-status--error">{error}</p>}

        {/* ── Announcement Cards Grid ────────────────────────────── */}
        {!loading && !error && (
          <div className="ann-grid">
            {filteredAnnouncements.map((item) => {
              const priorityInfo = PRIORITY_LABELS[item.priority] || PRIORITY_LABELS.info;
              const nameParts = item.author_name.split(" ");
              const firstName = nameParts[0] || "";
              const lastName = nameParts.slice(1).join(" ") || "";
              const formattedDate = new Date(item.created_at).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <div
                  key={item.id}
                  className={`ann-card ${!item.is_read_by_me ? "ann-card--unread" : ""} ann-card--${item.priority}`}
                  onClick={() => !item.is_read_by_me && handleMarkAsRead(item)}
                >
                  <div className="ann-card-header">
                    <div className="ann-card-badges">
                      <span className={`ann-priority-badge ${priorityInfo.badgeClass}`}>
                        {priorityInfo.icon} {priorityInfo.label}
                      </span>
                      {!item.is_read_by_me && <span className="ann-unread-badge">NOUVEAU</span>}
                    </div>

                    <div className="ann-author-info">
                      <Avatar firstName={firstName} lastName={lastName} size={34} />
                      <div>
                        <div className="ann-author-name">{item.author_name}</div>
                        <span className="ann-author-role">{item.author_role}</span>
                      </div>
                    </div>
                  </div>

                  <h3 className="ann-card-title">{item.title}</h3>
                  <p className="ann-card-content">{item.content}</p>

                  <div className="ann-card-footer">
                    <span className="ann-card-date">Publié le {formattedDate}</span>

                    <div className="ann-card-actions">
                      {isManagerOrAdmin && (
                        <button
                          type="button"
                          className="btn-secondary btn-secondary--compact"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenReadReceipts(item);
                          }}
                          title="Voir qui a lu cette note"
                        >
                          👁️ Lectures ({item.read_count}/{item.total_users_count || "?"})
                        </button>
                      )}

                      {isManagerOrAdmin && (
                        <>
                          <button
                            type="button"
                            className="btn-secondary btn-secondary--compact"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditModal(item);
                            }}
                          >
                            Modifier
                          </button>
                          <button
                            type="button"
                            className="btn-danger btn-secondary--compact"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteAnnouncement(item);
                            }}
                          >
                            Supprimer
                          </button>
                        </>
                      )}

                      {!isManagerOrAdmin && (
                        <div className="ann-read-status">
                          {item.is_read_by_me ? (
                            <span className="ann-read-tag">✓ Lu</span>
                          ) : (
                            <button
                              type="button"
                              className="btn-primary btn-primary--compact"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMarkAsRead(item);
                              }}
                            >
                              Marquer comme lu
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredAnnouncements.length === 0 && (
              <div className="ann-empty">
                <p>Aucun communiqué disponible pour le moment.</p>
              </div>
            )}
          </div>
        )}

        {/* ── Modal: Create / Edit Announcement ─────────────────── */}
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editingItem ? "Modifier le communiqué" : "Nouveau communiqué interne"}
          width={520}
        >
          <form onSubmit={handleSaveAnnouncement}>
            <div className="field">
              <label htmlFor="ann-title">Objet / Titre du communiqué</label>
              <input
                id="ann-title"
                type="text"
                required
                placeholder="ex: Réunion générale lundi à 10h, Nouvelle procédure..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="ann-priority">Niveau d'importance</label>
              <select
                id="ann-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                <option value="info">📢 Information (Standard)</option>
                <option value="important">⚠️ Important (Attire l'attention)</option>
                <option value="urgent">🚨 Urgent (Action requise immédiatement)</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="ann-content">Message / Contenu de la note</label>
              <textarea
                id="ann-content"
                required
                rows={6}
                placeholder="Rédigez votre communiqué ici. Une notification sera instantanément envoyée à tous les collaborateurs."
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </div>

            {formError && <p className="field-error">{formError}</p>}

            <div className="form-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setModalOpen(false)}
              >
                Annuler
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={formSubmitting}
              >
                {formSubmitting ? "Envoi en cours…" : editingItem ? "Mettre à jour" : "Publier & Notifier l'équipe"}
              </button>
            </div>
          </form>
        </Modal>

        {/* ── Modal: Read Receipts ("Chkoun Chefha w Wa9tech") ───── */}
        <Modal
          open={receiptsModalOpen}
          onClose={() => setReceiptsModalOpen(false)}
          title={
            selectedAnnouncementDetail
              ? `Suivi des lectures — "${selectedAnnouncementDetail.title}"`
              : "Suivi des lectures"
          }
          width={560}
        >
          {receiptsLoading && <p className="ann-status">Chargement de la liste des lectures…</p>}

          {!receiptsLoading && selectedAnnouncementDetail && (
            <div className="ann-receipts-body">
              <div className="ann-receipts-summary">
                <span className="ann-receipts-count">
                  {selectedAnnouncementDetail.reads?.length || 0} sur {selectedAnnouncementDetail.total_users_count || 0} collaborateurs ont lu ce communiqué.
                </span>
              </div>

              {/* Tabs */}
              <div className="ann-receipts-tabs">
                <button
                  type="button"
                  className={`ann-tab ${receiptsTab === "read" ? "is-active" : ""}`}
                  onClick={() => setReceiptsTab("read")}
                >
                  ✅ Ayant lu ({(selectedAnnouncementDetail.reads || []).length})
                </button>
                <button
                  type="button"
                  className={`ann-tab ${receiptsTab === "unread" ? "is-active" : ""}`}
                  onClick={() => setReceiptsTab("unread")}
                >
                  ⏳ En attente ({(selectedAnnouncementDetail.unread_users || []).length})
                </button>
              </div>

              {/* Tab 1: Reads List */}
              {receiptsTab === "read" && (
                <div className="ann-receipts-list">
                  {(selectedAnnouncementDetail.reads || []).map((r) => {
                    const nameParts = r.user_name.split(" ");
                    const fn = nameParts[0] || "";
                    const ln = nameParts.slice(1).join(" ") || "";
                    const readTime = r.read_at
                      ? new Date(r.read_at).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—";

                    return (
                      <div key={r.user_id} className="ann-receipt-item">
                        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                          <Avatar firstName={fn} lastName={ln} size={32} />
                          <div>
                            <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{r.user_name}</div>
                            <span className="ann-author-role">{r.role}</span>
                          </div>
                        </div>
                        <span className="ann-read-time">Lu le {readTime}</span>
                      </div>
                    );
                  })}

                  {(selectedAnnouncementDetail.reads || []).length === 0 && (
                    <p className="ann-status">Aucun collaborateur n'a encore consulté cette note.</p>
                  )}
                </div>
              )}

              {/* Tab 2: Unread List */}
              {receiptsTab === "unread" && (
                <div className="ann-receipts-list">
                  {(selectedAnnouncementDetail.unread_users || []).map((u) => {
                    const nameParts = u.user_name.split(" ");
                    const fn = nameParts[0] || "";
                    const ln = nameParts.slice(1).join(" ") || "";

                    return (
                      <div key={u.user_id} className="ann-receipt-item">
                        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                          <Avatar firstName={fn} lastName={ln} size={32} />
                          <div>
                            <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{u.user_name}</div>
                            <span className="ann-author-role">{u.role}</span>
                          </div>
                        </div>
                        <span className="ann-unread-time">⏳ Pas encore lu</span>
                      </div>
                    );
                  })}

                  {(selectedAnnouncementDetail.unread_users || []).length === 0 && (
                    <p className="ann-status">Tous les collaborateurs ont consulté ce communiqué ! 🎉</p>
                  )}
                </div>
              )}
            </div>
          )}
        </Modal>
      </div>
    </AppShell>
  );
}
