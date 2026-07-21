import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import AppShell from "../../components/AppShell";
import Modal from "../../components/Modal";
import "../../styles/shared.css";
import "./Workflows.css";

const STATUS_META = {
  active:   { label: "Actif",      cls: "wf-badge--active"   },
  draft:    { label: "Brouillon",  cls: "wf-badge--draft"    },
  disabled: { label: "Désactivé",  cls: "wf-badge--disabled" },
};

const TABS = ["Tous", "Actifs", "Brouillons", "Désactivés"];
const TAB_FILTER = { Tous: null, Actifs: "active", Brouillons: "draft", "Désactivés": "disabled" };

function fmt(isoStr) {
  if (!isoStr) return "—";
  try {
    return new Date(isoStr).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "—";
  }
}

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || { label: status, cls: "" };
  return <span className={`wf-badge ${meta.cls}`}>{meta.label}</span>;
}

export default function Workflows() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin_sys";

  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [activeTab, setActiveTab] = useState("Tous");
  const [search, setSearch] = useState("");

  // Create workflow modal
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", description: "" });
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);

  // Confirm delete
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Row action menu
  const [menuOpenId, setMenuOpenId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const data = await api.get("/task-types", { include_archived: 1 });
      setWorkflows(data);
    } catch {
      setLoadError("Impossible de charger les workflows.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpenId) return;
    function handle(e) {
      if (!e.target.closest(".wf-action-menu-wrap")) setMenuOpenId(null);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [menuOpenId]);

  const stats = useMemo(() => {
    const all = workflows.filter(w => !w.is_archived || w.workflow_status !== undefined);
    return {
      total:    all.length,
      active:   all.filter(w => w.workflow_status === "active").length,
      draft:    all.filter(w => w.workflow_status === "draft").length,
      disabled: all.filter(w => w.workflow_status === "disabled").length,
    };
  }, [workflows]);

  const filtered = useMemo(() => {
    let list = workflows;
    const statusFilter = TAB_FILTER[activeTab];
    if (statusFilter) list = list.filter(w => w.workflow_status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(w =>
        w.name.toLowerCase().includes(q) ||
        (w.description || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [workflows, activeTab, search]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!createForm.name.trim()) { setCreateError("Le nom est requis."); return; }
    setCreating(true);
    setCreateError("");
    try {
      const wf = await api.post("/task-types", {
        name: createForm.name.trim(),
        description: createForm.description.trim() || null,
        workflow_status: "draft",
      });
      setWorkflows(prev => [...prev, wf]);
      setCreateOpen(false);
      setCreateForm({ name: "", description: "" });
      navigate(`/workflows/${wf.id}`);
    } catch {
      setCreateError("Une erreur est survenue.");
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleStatus(wf) {
    setMenuOpenId(null);
    try {
      const updated = await api.post(`/task-types/${wf.id}/toggle-status`);
      setWorkflows(prev => prev.map(w => w.id === updated.id ? updated : w));
    } catch {
      alert("Impossible de changer le statut.");
    }
  }

  async function handleDuplicate(wf) {
    setMenuOpenId(null);
    try {
      const copy = await api.post(`/task-types/${wf.id}/duplicate`);
      setWorkflows(prev => [...prev, copy]);
    } catch {
      alert("Impossible de dupliquer le workflow.");
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await api.delete(`/task-types/${confirmDelete.id}`);
      setWorkflows(prev => prev.filter(w => w.id !== confirmDelete.id));
      setConfirmDelete(null);
    } catch (err) {
      setDeleteError(
        err?.data?.error === "task_type_in_use"
          ? "Ce workflow est utilisé par des tâches existantes. Archivez-le plutôt."
          : "Une erreur est survenue."
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AppShell>
      <div className="wf-page">
        {/* Header */}
        <div className="wf-header">
          <div>
            <div className="wf-header-title">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 6h4v4H4V6zM10 4h4v4h-4V4zM16 8h4v4h-4V8zM6 14c0-1.1.9-2 2-2h8a2 2 0 012 2v4H6v-4z" stroke="var(--primary)" strokeWidth="1.6" strokeLinejoin="round"/>
                <path d="M8 10v4M12 8v8M16 12v2" stroke="var(--primary)" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
              <h1>Gestion des workflows</h1>
            </div>
            <p className="wf-subtitle">Créez et configurez les cycles de vie des tâches de votre organisation.</p>
          </div>
          {isAdmin && (
            <button className="btn-primary" onClick={() => { setCreateForm({ name: "", description: "" }); setCreateError(""); setCreateOpen(true); }}>
              + Créer un workflow
            </button>
          )}
        </div>

        {/* Stat cards */}
        <div className="wf-stats">
          <div className="wf-stat-card">
            <div className="wf-stat-icon wf-stat-icon--total">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><rect x="13" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><rect x="3" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><rect x="13" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.8"/></svg>
            </div>
            <div><div className="wf-stat-value">{stats.total}</div><div className="wf-stat-label">Workflows totaux</div></div>
          </div>
          <div className="wf-stat-card">
            <div className="wf-stat-icon wf-stat-icon--active">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/><path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div><div className="wf-stat-value">{stats.active}</div><div className="wf-stat-label">Actifs</div></div>
          </div>
          <div className="wf-stat-card">
            <div className="wf-stat-icon wf-stat-icon--draft">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" strokeDasharray="3 2"/></svg>
            </div>
            <div><div className="wf-stat-value">{stats.draft}</div><div className="wf-stat-label">Brouillons</div></div>
          </div>
          <div className="wf-stat-card">
            <div className="wf-stat-icon wf-stat-icon--disabled">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/><path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
            </div>
            <div><div className="wf-stat-value">{stats.disabled}</div><div className="wf-stat-label">Désactivés</div></div>
          </div>
        </div>

        {/* Tabs + Search */}
        <div className="wf-toolbar">
          <div className="wf-tabs">
            {TABS.map(tab => (
              <button key={tab} className={`wf-tab${activeTab === tab ? " wf-tab--active" : ""}`} onClick={() => setActiveTab(tab)}>
                {tab}
              </button>
            ))}
          </div>
          <div className="wf-search-wrap">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="wf-search-icon">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8"/>
              <path d="M20 20l-3-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            <input
              className="wf-search"
              type="search"
              placeholder="Rechercher un workflow..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Table */}
        {loading && <p className="tt-status">Chargement…</p>}
        {loadError && <p className="tt-status tt-status--error">{loadError}</p>}
        {!loading && !loadError && (
          <div className="wf-table-wrap">
            <table className="wf-table">
              <thead>
                <tr>
                  <th>Workflow</th>
                  <th>Statut</th>
                  <th>Étapes</th>
                  <th>Transitions</th>
                  <th>Mise à jour</th>
                  {isAdmin && <th style={{ textAlign: "right" }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={isAdmin ? 6 : 5} style={{ textAlign: "center", color: "var(--text-muted)", padding: "2rem" }}>Aucun workflow trouvé.</td></tr>
                ) : filtered.map(wf => (
                  <tr key={wf.id} className="wf-row" onClick={() => navigate(`/workflows/${wf.id}`)}>
                    <td>
                      <div className="wf-row-name">{wf.name}</div>
                      {wf.description && <div className="wf-row-desc">{wf.description}</div>}
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <StatusBadge status={wf.workflow_status || "draft"} />
                    </td>
                    <td>
                      <span className="wf-count-cell">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/></svg>
                        {wf.step_count}
                      </span>
                    </td>
                    <td>
                      <span className="wf-count-cell">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M15 8l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        {wf.transition_count}
                      </span>
                    </td>
                    <td className="wf-date-cell">{fmt(wf.updated_at)}</td>
                    {isAdmin && (
                      <td onClick={e => e.stopPropagation()} style={{ textAlign: "right" }}>
                        <div className="wf-actions">
                          {/* Toggle status */}
                          <button className="wf-icon-btn" title="Changer le statut" onClick={() => handleToggleStatus(wf)}>
                            {wf.workflow_status === "active"
                              ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/></svg>
                              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 4l14 8-14 8V4z" fill="currentColor"/></svg>
                            }
                          </button>
                          {/* Duplicate */}
                          <button className="wf-icon-btn" title="Dupliquer" onClick={() => handleDuplicate(wf)}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="10" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><path d="M15 9V6a1.5 1.5 0 00-1.5-1.5H5A1.5 1.5 0 003.5 6v10A1.5 1.5 0 005 17.5h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                          </button>
                          {/* Edit */}
                          <button className="wf-icon-btn" title="Modifier" onClick={() => navigate(`/workflows/${wf.id}`)}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </button>
                          {/* More menu */}
                          <div className="wf-action-menu-wrap">
                            <button className="wf-icon-btn" title="Plus d'options" onClick={() => setMenuOpenId(menuOpenId === wf.id ? null : wf.id)}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="5" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="19" r="1.5" fill="currentColor"/></svg>
                            </button>
                            {menuOpenId === wf.id && (
                              <div className="wf-action-menu">
                                <button className="wf-action-menu-item wf-action-menu-item--danger" onClick={() => { setMenuOpenId(null); setDeleteError(""); setConfirmDelete(wf); }}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                  Supprimer
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal open={createOpen} onClose={() => !creating && setCreateOpen(false)} title="Nouveau workflow" width={460}>
        <form onSubmit={handleCreate}>
          <div className="field">
            <label htmlFor="wf-create-name">Nom du workflow *</label>
            <input
              id="wf-create-name"
              className="input"
              type="text"
              placeholder="ex. Publication de contenu"
              value={createForm.name}
              onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
              autoFocus
            />
          </div>
          <div className="field" style={{ marginTop: "0.75rem" }}>
            <label htmlFor="wf-create-desc">Description (optionnelle)</label>
            <textarea
              id="wf-create-desc"
              className="input"
              rows={2}
              placeholder="Décrivez ce workflow en quelques mots…"
              value={createForm.description}
              onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>
          {createError && <p className="tt-status tt-status--error" style={{ marginTop: "0.5rem" }}>{createError}</p>}
          <div className="modal-footer" style={{ marginTop: "1.25rem" }}>
            <button type="button" className="btn-ghost" onClick={() => setCreateOpen(false)} disabled={creating}>Annuler</button>
            <button type="submit" className="btn-primary" disabled={creating}>{creating ? "Création…" : "Créer"}</button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal open={!!confirmDelete} onClose={() => !deleting && setConfirmDelete(null)} title="Supprimer le workflow" width={440}>
        <p style={{ margin: 0, color: "var(--ink)" }}>
          Êtes-vous sûr de vouloir supprimer <strong>« {confirmDelete?.name} »</strong> ? Cette action est irréversible.
        </p>
        {deleteError && <p className="tt-status tt-status--error" style={{ marginTop: "0.75rem" }}>{deleteError}</p>}
        <div className="modal-footer" style={{ marginTop: "1.25rem" }}>
          <button className="btn-ghost" onClick={() => setConfirmDelete(null)} disabled={deleting}>Annuler</button>
          <button className="btn-danger" onClick={handleDelete} disabled={deleting}>{deleting ? "Suppression…" : "Supprimer"}</button>
        </div>
      </Modal>
    </AppShell>
  );
}
