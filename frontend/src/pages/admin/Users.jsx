import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../../api/client";
import { ROLE_LABELS } from "../../constants";
import Avatar from "../../components/Avatar";
import Modal from "../../components/Modal";
import "../../styles/shared.css";
import "./Users.css";

const ROLE_OPTIONS = [
  { value: "admin_sys", label: "Admin Système" },
  { value: "manager", label: "Manager" },
  { value: "cm", label: "Community Manager" },
  { value: "prod", label: "Prod" },
];

const ROLE_FILTERS = [{ value: "all", label: "Tous" }, ...ROLE_OPTIONS];

const EMPTY_FORM = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  role: "cm",
  hourly_rate: "25.00",
  password: "",
};

function emptyErrors() {
  return {};
}

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState(emptyErrors());
  const [saving, setSaving] = useState(false);

  const [confirmArchive, setConfirmArchive] = useState(null);
  const [confirmRestore, setConfirmRestore] = useState(null);
  const [rowActionId, setRowActionId] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);

  useEffect(() => {
    function handleClickOutside() {
      setOpenMenuId(null);
    }
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  async function loadUsers() {
    setLoading(true);
    setLoadError("");
    try {
      const data = await api.get("/users");
      setUsers(data);
    } catch {
      setLoadError("Impossible de charger la liste des utilisateurs.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fetch on mount
    loadUsers();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (!showArchived && u.is_archived) return false;
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (!q) return true;
      const haystack = `${u.first_name} ${u.last_name} ${u.email}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [users, search, roleFilter, showArchived]);

  function openCreateModal() {
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setFormErrors(emptyErrors());
    setModalOpen(true);
  }

  function openEditModal(user) {
    setEditingUser(user);
    setForm({
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      phone: user.phone || "",
      role: user.role,
      hourly_rate: String(user.hourly_rate ?? 25.0),
      password: "",
    });
    setFormErrors(emptyErrors());
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setModalOpen(false);
  }

  function updateField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function validate() {
    const errors = {};
    if (!form.first_name.trim()) errors.first_name = "Prénom requis.";
    if (!form.last_name.trim()) errors.last_name = "Nom requis.";
    if (!form.email.trim()) errors.email = "Email requis.";
    if (!editingUser && !form.password.trim()) errors.password = "Mot de passe requis.";
    if (form.password && form.password.length < 6) {
      errors.password = "6 caractères minimum.";
    }
    return errors;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errors = validate();
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    try {
      const payload = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        role: form.role,
        hourly_rate: parseFloat(form.hourly_rate) || 25.0,
      };
      if (form.password) payload.password = form.password;

      if (editingUser) {
        const { user } = await api.patch(`/users/${editingUser.id}`, payload);
        setUsers((prev) => prev.map((u) => (u.id === user.id ? user : u)));
      } else {
        const { user } = await api.post("/users", payload);
        setUsers((prev) => [...prev, user]);
      }
      setModalOpen(false);
    } catch (err) {
      if (err instanceof ApiError && err.data?.error === "email_taken") {
        setFormErrors((prev) => ({ ...prev, email: "Cet email est déjà utilisé." }));
      } else {
        setFormErrors((prev) => ({ ...prev, form: "Une erreur est survenue. Réessayez." }));
      }
    } finally {
      setSaving(false);
    }
  }

  async function toggleChefProd(user) {
    setRowActionId(user.id);
    try {
      const { user: updated } = await api.patch(`/users/${user.id}`, {
        is_chef_prod: !user.is_chef_prod,
      });
      await loadUsers();
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    } catch {
      setLoadError("Impossible de modifier le statut Chef Prod.");
    } finally {
      setRowActionId(null);
    }
  }

  async function toggleActive(user) {
    setRowActionId(user.id);
    try {
      const endpoint = user.is_active ? "deactivate" : "activate";
      const { user: updated } = await api.post(`/users/${user.id}/${endpoint}`);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    } catch {
      setLoadError("Impossible de modifier le statut du compte.");
    } finally {
      setRowActionId(null);
    }
  }

  async function confirmArchiveUser() {
    if (!confirmArchive) return;
    setRowActionId(confirmArchive.id);
    try {
      const { user: updated } = await api.post(`/users/${confirmArchive.id}/archive`);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setConfirmArchive(null);
    } catch {
      setLoadError("Impossible d'archiver cet utilisateur.");
    } finally {
      setRowActionId(null);
    }
  }

  async function confirmRestoreUser() {
    if (!confirmRestore) return;
    setRowActionId(confirmRestore.id);
    try {
      const { user: updated } = await api.post(`/users/${confirmRestore.id}/restore`);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setConfirmRestore(null);
    } catch {
      setLoadError("Impossible de restaurer cet utilisateur.");
    } finally {
      setRowActionId(null);
    }
  }

  return (
    <div className="users-page">
      <div className="users-header">
        <div>
          <h1>Utilisateurs</h1>
          <p className="users-subtitle">Gérez les comptes, les tarifs et les rôles de l&rsquo;équipe.</p>
        </div>
        <button type="button" className="btn-primary" onClick={openCreateModal}>
          + Nouvel utilisateur
        </button>
      </div>

      <div className="users-toolbar">
        <input
          type="search"
          className="users-search"
          placeholder="Rechercher un utilisateur…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="users-filters">
          {ROLE_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              className={`chip-toggle${roleFilter === f.value ? " is-selected" : ""}`}
              onClick={() => setRoleFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <label className="users-archived-toggle">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Afficher les archivés
        </label>
      </div>

      {loadError && <p className="users-status users-status--error">{loadError}</p>}
      {loading && <p className="users-status">Chargement…</p>}

      {!loading && (
        <div className="users-table-wrap">
          <table className="users-table">
            <thead>
              <tr>
                <th>Utilisateur</th>
                <th>Email</th>
                <th>Rôle</th>
                <th>Taux Horaire</th>
                <th>Chef Prod</th>
                <th>Statut</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="users-empty">
                    Aucun utilisateur ne correspond à ces critères.
                  </td>
                </tr>
              )}
              {filtered.map((u) => (
                <tr key={u.id} className={u.is_archived ? "is-archived-row" : ""}>
                  <td>
                    <div className="users-name-cell">
                      <Avatar firstName={u.first_name} lastName={u.last_name} size={32} />
                      <span>
                        {u.first_name} {u.last_name}
                      </span>
                    </div>
                  </td>
                  <td className="users-email-cell">{u.email}</td>
                  <td>{ROLE_LABELS[u.role] || u.role}</td>
                  <td>
                    <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--ink)" }}>
                      {(u.hourly_rate ?? 25.0).toFixed(2)}
                    </span>{" "}
                    <span style={{ fontSize: "0.76rem", color: "var(--text-muted)", fontWeight: 600 }}>TND/h</span>
                  </td>
                  <td>
                    {u.role === "prod" ? (
                      <button
                        type="button"
                        className={`status-chip ${u.is_chef_prod ? "is-accent" : "is-inactive"}`}
                        style={{ border: "none", cursor: "pointer" }}
                        disabled={rowActionId === u.id || u.is_archived}
                        onClick={() => toggleChefProd(u)}
                      >
                        {u.is_chef_prod ? "Chef Prod ✓" : "Définir"}
                      </button>
                    ) : (
                      <span className="users-na">—</span>
                    )}
                  </td>
                  <td>
                    {u.is_archived ? (
                      <span className="status-chip is-archived">Archivé</span>
                    ) : u.is_active ? (
                      <span className="status-chip is-active">Actif</span>
                    ) : (
                      <span className="status-chip is-inactive">Désactivé</span>
                    )}
                  </td>
                  <td style={{ textAlign: "right", position: "relative" }}>
                    <button
                      type="button"
                      className="users-dots-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(openMenuId === u.id ? null : u.id);
                      }}
                      title="Actions"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="5" r="2" fill="currentColor" />
                        <circle cx="12" cy="12" r="2" fill="currentColor" />
                        <circle cx="12" cy="19" r="2" fill="currentColor" />
                      </svg>
                    </button>

                    {openMenuId === u.id && (
                      <div className="users-dropdown-menu" onClick={(e) => e.stopPropagation()}>
                        {!u.is_archived ? (
                          <>
                            <button
                              type="button"
                              className="users-menu-item"
                              onClick={() => {
                                setOpenMenuId(null);
                                openEditModal(u);
                              }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                              Modifier
                            </button>
                            <button
                              type="button"
                              className="users-menu-item"
                              disabled={rowActionId === u.id}
                              onClick={() => {
                                setOpenMenuId(null);
                                toggleActive(u);
                              }}
                            >
                              {u.is_active ? (
                                <>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor"/></svg>
                                  Désactiver
                                </>
                              ) : (
                                <>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polygon points="5 3 19 12 5 21 5 3" fill="currentColor"/></svg>
                                  Activer
                                </>
                              )}
                            </button>
                            <div className="users-menu-divider" />
                            <button
                              type="button"
                              className="users-menu-item is-danger"
                              onClick={() => {
                                setOpenMenuId(null);
                                setConfirmArchive(u);
                              }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polyline points="21 8 21 21 3 21 3 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><rect x="1" y="3" width="22" height="5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><line x1="10" y1="12" x2="14" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                              Archiver
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="users-menu-item"
                            onClick={() => {
                              setOpenMenuId(null);
                              setConfirmRestore(u);
                            }}
                          >
                            Restaurer / Désarchiver
                          </button>
                        )}
                      </div>
                    )}
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingUser ? "Modifier l'utilisateur" : "Nouvel utilisateur"}
        width={520}
      >
        <form onSubmit={handleSubmit}>
          <div className="field-row">
            <div className="field">
              <label htmlFor="first_name">Prénom</label>
              <input
                id="first_name"
                type="text"
                value={form.first_name}
                onChange={(e) => updateField("first_name", e.target.value)}
              />
              {formErrors.first_name && <span className="field-error">{formErrors.first_name}</span>}
            </div>
            <div className="field">
              <label htmlFor="last_name">Nom</label>
              <input
                id="last_name"
                type="text"
                value={form.last_name}
                onChange={(e) => updateField("last_name", e.target.value)}
              />
              {formErrors.last_name && <span className="field-error">{formErrors.last_name}</span>}
            </div>
          </div>

          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => updateField("email", e.target.value)}
            />
            {formErrors.email && <span className="field-error">{formErrors.email}</span>}
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="phone">Téléphone</label>
              <input
                id="phone"
                type="tel"
                value={form.phone}
                onChange={(e) => updateField("phone", e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="role">Rôle</label>
              <select
                id="role"
                value={form.role}
                onChange={(e) => updateField("role", e.target.value)}
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <label htmlFor="hourly_rate">Taux Horaire (TND / heure)</label>
            <input
              id="hourly_rate"
              type="number"
              step="0.5"
              min="0"
              value={form.hourly_rate}
              onChange={(e) => updateField("hourly_rate", e.target.value)}
              placeholder="25.00"
            />
          </div>

          <div className="field">
            <label htmlFor="password">
              {editingUser ? "Nouveau mot de passe (optionnel)" : "Mot de passe"}
            </label>
            <input
              id="password"
              type="password"
              value={form.password}
              onChange={(e) => updateField("password", e.target.value)}
              placeholder={editingUser ? "Laisser vide pour ne pas changer" : ""}
            />
            {formErrors.password && <span className="field-error">{formErrors.password}</span>}
          </div>

          {formErrors.form && <p className="field-error">{formErrors.form}</p>}

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={closeModal} disabled={saving}>
              Annuler
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Enregistrement…" : editingUser ? "Enregistrer" : "Créer"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(confirmArchive)}
        onClose={() => setConfirmArchive(null)}
        title="Archiver cet utilisateur ?"
        width={420}
      >
        <p className="users-confirm-text">
          {confirmArchive
            ? `${confirmArchive.first_name} ${confirmArchive.last_name} sera archivé(e) et ne pourra plus se connecter. Cette action ne supprime aucune donnée et peut être annulée manuellement par un administrateur.`
            : ""}
        </p>
        <div className="form-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setConfirmArchive(null)}
            disabled={rowActionId === confirmArchive?.id}
          >
            Annuler
          </button>
          <button
            type="button"
            className="btn-danger"
            onClick={confirmArchiveUser}
            disabled={rowActionId === confirmArchive?.id}
          >
            {rowActionId === confirmArchive?.id ? "Archivage…" : "Archiver"}
          </button>
        </div>
      </Modal>

      <Modal
        open={Boolean(confirmRestore)}
        onClose={() => setConfirmRestore(null)}
        title="Restaurer cet utilisateur ?"
        width={420}
      >
        <p className="users-confirm-text">
          {confirmRestore
            ? `${confirmRestore.first_name} ${confirmRestore.last_name} sera restauré(e) et pourra à nouveau se connecter.`
            : ""}
        </p>
        <div className="form-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setConfirmRestore(null)}
            disabled={rowActionId === confirmRestore?.id}
          >
            Annuler
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={confirmRestoreUser}
            disabled={rowActionId === confirmRestore?.id}
          >
            {rowActionId === confirmRestore?.id ? "Restauration…" : "Restaurer"}
          </button>
        </div>
      </Modal>
    </div>
  );
}