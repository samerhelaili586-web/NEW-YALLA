import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../api/client";
import { useNavigate } from "react-router-dom";
import "./Parametres.css";

// ─── Icons ─────────────────────────────────────────────────────────────────────
function Icon({ d, size = 18 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const ICONS = {
  roles:    "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8z M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75",
  project:  "M3 7h18M3 12h18M3 17h18",
  list:     "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
  workflow: "M5 3h4v4H5V3zM15 3h4v4h-4V3zM5 13h4v4H5v-4zM15 13h4v4h-4v-4zM9 5h6M19 5v8M5 15h6M15 7v6",
  plus:     "M12 5v14M5 12h14",
  edit:     "M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7 M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
  trash:    "M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6",
  archive:  "M21 8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z",
  restore:  "M1 4v6h6M23 20v-6h-6 M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15",
  check:    "M20 6L9 17l-5-5",
  x:        "M18 6L6 18M6 6l12 12",
  info:     "M12 16v-4M12 8h.01 M12 22a10 10 0 100-20 10 10 0 000 20z",
  external: "M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6 M15 3h6v6 M10 14L21 3",
  gear:     "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
};

const TABS = [
  { id: "roles",    label: "Rôles",            icon: "roles" },
  { id: "projects", label: "Droits par Projet", icon: "project" },
  { id: "lists",    label: "Listes Personnalisées", icon: "list" },
  { id: "workflow", label: "Workflows",         icon: "workflow" },
];

const MENU_KEY_LABELS = {
  gestion_utilisateurs: "Gestion Utilisateurs",
  gestion_workflows: "Gestion Workflows",
  consulter_workflows: "Consulter Workflows",
  gestion_materiel: "Gestion Matériel",
  projets_tous: "Tous les Projets",
  projets_affectes: "Projets Affectés",
  taches_associees: "Tâches Associées",
  taches_montage: "Tâches Montage",
  planification: "Planification",
  feuille_presence_perso: "Présence Personnelle",
  feuille_presence_equipe: "Présence Équipe",
  shooting_calendrier: "Calendrier Shooting",
  conges_absences: "Congés & Absences",
  approbation_conges: "Approbation Congés",
  annuaire: "Annuaire",
  salaires_paie: "Salaires & Paie",
};

const ACTION_KEY_LABELS = {
  creer_projet: "Créer un Projet",
  modifier_projet: "Modifier un Projet",
  on_hold_projet: "Mettre en Pause",
  creer_tache: "Créer une Tâche",
  changer_statut_standard: "Changer Statut (Standard)",
  forcer_statut: "Forcer un Statut",
  changer_statut_planification: "Changer Statut (Planification)",
  reporter_temps: "Reporter du Temps",
  ajouter_commentaire: "Ajouter un Commentaire",
  gerer_salaires: "Gérer les Salaires",
};

const FIELD_TYPES = [
  { value: "text", label: "Texte" },
  { value: "number", label: "Nombre" },
  { value: "date", label: "Date" },
  { value: "select", label: "Liste déroulante" },
  { value: "image", label: "Image / URL" },
];

const VISIBILITY_OPTIONS = [
  { value: "all", label: "Tout visible", desc: "L'utilisateur voit toutes les tâches et informations" },
  { value: "actionable", label: "Vue actionnable", desc: "Uniquement les éléments assignés ou actionnables" },
  { value: "upcoming", label: "Vue à venir", desc: "Seulement les tâches à venir planifiées" },
];

const ROLE_COLORS = [
  "#dc2626", "#ea580c", "#d97706", "#ca8a04", "#65a30d",
  "#16a34a", "#059669", "#0891b2", "#2563eb", "#7c3aed",
  "#9333ea", "#c026d3", "#e11d48", "#6366f1", "#0f766e",
];

// ──────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ──────────────────────────────────────────────────────────────────────────────
export default function Parametres() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("roles");

  if (user?.effective_role !== "admin_sys") {
    return (
      <div className="param-forbidden">
        <Icon d={ICONS.gear} size={48} />
        <h2>Accès réservé à l'Admin Système</h2>
        <p>Cette page est uniquement accessible aux administrateurs système.</p>
      </div>
    );
  }

  return (
    <div className="param-page">
      {/* Header */}
      <div className="param-header">
        <div className="param-header-left">
          <div className="param-header-icon">
            <Icon d={ICONS.gear} size={22} />
          </div>
          <div>
            <h1 className="param-title">Paramètres Système</h1>
            <p className="param-subtitle">Configuration avancée de la plateforme Yalla</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="param-tabs">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`param-tab${activeTab === tab.id ? " active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <Icon d={ICONS[tab.icon]} size={16} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="param-content">
        {activeTab === "roles" && <RolesTab />}
        {activeTab === "projects" && <ProjectRightsTab />}
        {activeTab === "lists" && <CustomListsTab />}
        {activeTab === "workflow" && <WorkflowInfoTab navigate={navigate} />}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// TAB 1: RÔLES PERSONNALISÉS
// ──────────────────────────────────────────────────────────────────────────────
function RolesTab() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [modal, setModal] = useState(null); // null | { mode: "create"|"edit", role: obj|null }
  const [meta, setMeta] = useState({ menu_keys: [], action_keys: [] });

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      const [rolesData, metaData] = await Promise.all([
        api.get(`/custom-roles?include_archived=${showArchived ? 1 : 0}`),
        api.get("/custom-roles/meta"),
      ]);
      setRoles(rolesData);
      setMeta(metaData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [showArchived]);

  useEffect(() => { fetchRoles(); }, [fetchRoles]);

  async function handleArchive(role) {
    if (!confirm(`Archiver le rôle "${role.label}" ?`)) return;
    await api.post(`/custom-roles/${role.id}/archive`);
    fetchRoles();
  }

  async function handleRestore(role) {
    await api.post(`/custom-roles/${role.id}/restore`);
    fetchRoles();
  }

  return (
    <div className="param-section">
      <div className="param-section-header">
        <div>
          <h2>Rôles & Permissions</h2>
          <p>Gérez les rôles de la plateforme et leurs droits d'accès aux fonctionnalités.</p>
        </div>
        <div className="param-section-actions">
          <label className="param-toggle-label">
            <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} />
            <span>Afficher archivés</span>
          </label>
          <button className="param-btn-primary" onClick={() => setModal({ mode: "create", role: null })}>
            <Icon d={ICONS.plus} size={16} />
            Nouveau Rôle
          </button>
        </div>
      </div>

      {loading ? (
        <div className="param-loader"><div className="param-spinner" /></div>
      ) : (
        <div className="roles-grid">
          {roles.map(role => (
            <div key={role.id} className={`role-card${role.is_archived ? " archived" : ""}`}>
              <div className="role-card-header">
                <div className="role-badge" style={{ background: role.color + "22", border: `1.5px solid ${role.color}40` }}>
                  <span className="role-dot" style={{ background: role.color }} />
                  <span className="role-key" style={{ color: role.color }}>{role.key}</span>
                </div>
                {role.is_builtin && <span className="role-builtin-tag">INTÉGRÉ</span>}
                {role.is_archived && <span className="role-archived-tag">ARCHIVÉ</span>}
              </div>
              <div className="role-label">{role.label}</div>
              <div className="role-meta-row">
                <span className="role-meta-chip">
                  {VISIBILITY_OPTIONS.find(o => o.value === role.visibility_mode)?.label || role.visibility_mode}
                </span>
                {role.participates_in_workflow && (
                  <span className="role-meta-chip workflow">Participe aux workflows</span>
                )}
              </div>
              <div className="role-permissions-summary">
                <span>{role.menu_permissions?.length || 0} menus</span>
                <span>•</span>
                <span>{role.action_permissions?.length || 0} actions</span>
              </div>
              <div className="role-card-actions">
                {!role.is_archived ? (
                  <>
                    <button className="param-btn-ghost" onClick={() => setModal({ mode: "edit", role })}>
                      <Icon d={ICONS.edit} size={14} /> Modifier
                    </button>
                    {!role.is_builtin && (
                      <button className="param-btn-ghost danger" onClick={() => handleArchive(role)}>
                        <Icon d={ICONS.archive} size={14} /> Archiver
                      </button>
                    )}
                  </>
                ) : (
                  <button className="param-btn-ghost" onClick={() => handleRestore(role)}>
                    <Icon d={ICONS.restore} size={14} /> Restaurer
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <RoleModal
          mode={modal.mode}
          role={modal.role}
          meta={meta}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); fetchRoles(); }}
        />
      )}
    </div>
  );
}

function RoleModal({ mode, role, meta, onClose, onSaved }) {
  const [form, setForm] = useState({
    key: role?.key || "",
    label: role?.label || "",
    color: role?.color || "#6366f1",
    visibility_mode: role?.visibility_mode || "all",
    participates_in_workflow: role?.participates_in_workflow ?? true,
    menu_permissions: role?.menu_permissions || [],
    action_permissions: role?.action_permissions || [],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function toggle(list, key) {
    return list.includes(key) ? list.filter(k => k !== key) : [...list, key];
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (mode === "create") {
        await api.post("/custom-roles", form);
      } else {
        await api.patch(`/custom-roles/${role.id}`, form);
      }
      onSaved();
    } catch (err) {
      setError(err.message || "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="param-modal-overlay" onClick={onClose}>
      <div className="param-modal large" onClick={e => e.stopPropagation()}>
        <div className="param-modal-header">
          <h3>{mode === "create" ? "Nouveau Rôle" : `Modifier : ${role.label}`}</h3>
          <button className="param-modal-close" onClick={onClose}><Icon d={ICONS.x} size={18} /></button>
        </div>
        <form className="param-modal-body" onSubmit={handleSubmit}>
          {error && <div className="param-error-banner">{error}</div>}

          <div className="param-form-grid-2">
            {/* Key */}
            {mode === "create" && (
              <div className="param-field">
                <label>Identifiant (clé)</label>
                <input
                  value={form.key}
                  onChange={e => setForm(f => ({ ...f, key: e.target.value.toLowerCase().replace(/\s+/g, "_") }))}
                  placeholder="ex: chef_projet"
                  required
                  disabled={role?.is_builtin}
                />
                <span className="param-field-hint">Utilisé en interne (snake_case, sans espaces)</span>
              </div>
            )}
            {/* Label */}
            <div className="param-field">
              <label>Libellé affiché</label>
              <input
                value={form.label}
                onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                placeholder="ex: Chef de Projet"
                required
              />
            </div>
          </div>

          {/* Color */}
          <div className="param-field">
            <label>Couleur du badge</label>
            <div className="role-color-picker">
              {ROLE_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  className={`color-swatch${form.color === c ? " selected" : ""}`}
                  style={{ background: c }}
                  onClick={() => setForm(f => ({ ...f, color: c }))}
                />
              ))}
              <input
                type="color"
                value={form.color}
                onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                style={{ width: 36, height: 36, borderRadius: 8, border: "1px solid var(--border)", cursor: "pointer", padding: 2 }}
              />
            </div>
          </div>

          {/* Visibility mode */}
          <div className="param-field">
            <label>Mode de visibilité</label>
            <div className="visibility-options">
              {VISIBILITY_OPTIONS.map(opt => (
                <label key={opt.value} className={`visibility-option${form.visibility_mode === opt.value ? " selected" : ""}`}>
                  <input
                    type="radio"
                    name="visibility_mode"
                    value={opt.value}
                    checked={form.visibility_mode === opt.value}
                    onChange={() => setForm(f => ({ ...f, visibility_mode: opt.value }))}
                  />
                  <div>
                    <strong>{opt.label}</strong>
                    <span>{opt.desc}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Workflow participation */}
          <div className="param-field">
            <label className="param-checkbox-label">
              <input
                type="checkbox"
                checked={form.participates_in_workflow}
                onChange={e => setForm(f => ({ ...f, participates_in_workflow: e.target.checked }))}
              />
              Ce rôle peut être assigné à des étapes de workflow
            </label>
          </div>

          {/* Menu Permissions */}
          <div className="param-field">
            <label>Accès aux menus</label>
            <div className="param-permissions-grid">
              {meta.menu_keys.map(key => (
                <label key={key} className={`perm-chip${form.menu_permissions.includes(key) ? " active" : ""}`}>
                  <input
                    type="checkbox"
                    checked={form.menu_permissions.includes(key)}
                    onChange={() => setForm(f => ({ ...f, menu_permissions: toggle(f.menu_permissions, key) }))}
                  />
                  <Icon d={ICONS.check} size={12} />
                  {MENU_KEY_LABELS[key] || key}
                </label>
              ))}
            </div>
          </div>

          {/* Action Permissions */}
          <div className="param-field">
            <label>Permissions d'actions</label>
            <div className="param-permissions-grid">
              {meta.action_keys.map(key => (
                <label key={key} className={`perm-chip${form.action_permissions.includes(key) ? " active" : ""}`}>
                  <input
                    type="checkbox"
                    checked={form.action_permissions.includes(key)}
                    onChange={() => setForm(f => ({ ...f, action_permissions: toggle(f.action_permissions, key) }))}
                  />
                  <Icon d={ICONS.check} size={12} />
                  {ACTION_KEY_LABELS[key] || key}
                </label>
              ))}
            </div>
          </div>

          <div className="param-modal-footer">
            <button type="button" className="param-btn-ghost" onClick={onClose}>Annuler</button>
            <button type="submit" className="param-btn-primary" disabled={saving}>
              {saving ? "Sauvegarde..." : mode === "create" ? "Créer le Rôle" : "Enregistrer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// TAB 2: DROITS PAR PROJET
// ──────────────────────────────────────────────────────────────────────────────
function ProjectRightsTab() {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState([]);

  useEffect(() => {
    Promise.all([
      api.get("/projects"),
      api.get("/custom-roles?include_archived=0"),
      api.get("/users"),
    ]).then(([p, r, u]) => {
      setProjects(p);
      setRoles(r);
      setUsers(u.filter(u => !u.is_archived));
    }).catch(console.error);
  }, []);

  async function loadPermissions(projectId) {
    setLoading(true);
    try {
      const data = await api.get(`/projects/${projectId}/task-permissions`);
      setPermissions(data);
      setDraft(data.map(p => ({ ...p })));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function handleProjectSelect(e) {
    const id = Number(e.target.value);
    const proj = projects.find(p => p.id === id);
    setSelectedProject(proj || null);
    if (id) loadPermissions(id);
    else { setPermissions([]); setDraft([]); }
  }

  function addRule(type) {
    const newRule = { id: `_new_${Date.now()}`, project_id: selectedProject.id, role_key: type === "role" ? "" : null, user_id: type === "user" ? "" : null, can_create: true };
    setDraft(d => [...d, newRule]);
  }

  function removeRule(idx) {
    setDraft(d => d.filter((_, i) => i !== idx));
  }

  function updateRule(idx, field, value) {
    setDraft(d => d.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const rules = draft
        .filter(r => r.role_key || r.user_id)
        .map(r => ({
          role_key: r.role_key || null,
          user_id: r.user_id ? Number(r.user_id) : null,
          can_create: r.can_create,
        }));
      await api.put(`/projects/${selectedProject.id}/task-permissions`, { rules });
      await loadPermissions(selectedProject.id);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="param-section">
      <div className="param-section-header">
        <div>
          <h2>Droits de Création par Projet</h2>
          <p>Définissez qui peut créer des tâches dans chaque projet — par rôle ou par utilisateur spécifique.</p>
        </div>
      </div>

      <div className="project-selector">
        <label>Sélectionner un projet</label>
        <select onChange={handleProjectSelect} value={selectedProject?.id || ""}>
          <option value="">— Choisir un projet —</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>
      </div>

      {!selectedProject && (
        <div className="param-empty-state">
          <Icon d={ICONS.project} size={40} />
          <p>Sélectionnez un projet pour configurer ses droits de création</p>
          <span>Par défaut, les droits globaux s'appliquent (tous les rôles autorisés dans "creer_tache")</span>
        </div>
      )}

      {selectedProject && loading && <div className="param-loader"><div className="param-spinner" /></div>}

      {selectedProject && !loading && (
        <div className="project-rights-editor">
          <div className="project-rights-info">
            <Icon d={ICONS.info} size={16} />
            <span>Projet : <strong>{selectedProject.title}</strong>. Si aucune règle n'est définie, les droits globaux s'appliquent.</span>
          </div>

          <div className="rules-list">
            {draft.length === 0 && (
              <div className="rules-empty">Aucune règle personnalisée — droits globaux actifs</div>
            )}
            {draft.map((rule, idx) => (
              <div key={rule.id || idx} className="rule-row">
                <div className="rule-type">
                  {rule.role_key !== null ? (
                    <>
                      <span className="rule-type-badge role">Rôle</span>
                      <select
                        value={rule.role_key}
                        onChange={e => updateRule(idx, "role_key", e.target.value)}
                      >
                        <option value="">— Choisir un rôle —</option>
                        {roles.map(r => (
                          <option key={r.key} value={r.key}>{r.label}</option>
                        ))}
                      </select>
                    </>
                  ) : (
                    <>
                      <span className="rule-type-badge user">Utilisateur</span>
                      <select
                        value={rule.user_id || ""}
                        onChange={e => updateRule(idx, "user_id", e.target.value)}
                      >
                        <option value="">— Choisir un utilisateur —</option>
                        {users.map(u => (
                          <option key={u.id} value={u.id}>{u.first_name} {u.last_name} ({u.effective_role})</option>
                        ))}
                      </select>
                    </>
                  )}
                </div>
                <div className="rule-permission">
                  <label className={`perm-toggle${rule.can_create ? " allowed" : " denied"}`}>
                    <input
                      type="checkbox"
                      checked={rule.can_create}
                      onChange={e => updateRule(idx, "can_create", e.target.checked)}
                    />
                    {rule.can_create ? (
                      <><Icon d={ICONS.check} size={14} /> Autorisé</>
                    ) : (
                      <><Icon d={ICONS.x} size={14} /> Refusé</>
                    )}
                  </label>
                </div>
                <button className="rule-remove" onClick={() => removeRule(idx)}>
                  <Icon d={ICONS.x} size={16} />
                </button>
              </div>
            ))}
          </div>

          <div className="rules-add-buttons">
            <button className="param-btn-ghost" onClick={() => addRule("role")}>
              <Icon d={ICONS.plus} size={14} /> Ajouter par Rôle
            </button>
            <button className="param-btn-ghost" onClick={() => addRule("user")}>
              <Icon d={ICONS.plus} size={14} /> Ajouter par Utilisateur
            </button>
          </div>

          <div className="project-rights-footer">
            <button className="param-btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? "Sauvegarde..." : "Enregistrer les règles"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// TAB 3: LISTES PERSONNALISÉES
// ──────────────────────────────────────────────────────────────────────────────
function CustomListsTab() {
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [modal, setModal] = useState(null); // null | { mode, list }
  const [itemsView, setItemsView] = useState(null); // list object when viewing items

  const fetchLists = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get(`/custom-lists?include_archived=${showArchived ? 1 : 0}`);
      setLists(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [showArchived]);

  useEffect(() => { fetchLists(); }, [fetchLists]);

  async function handleArchive(lst) {
    if (!confirm(`Archiver la liste "${lst.name}" ?`)) return;
    await api.post(`/custom-lists/${lst.id}/archive`);
    fetchLists();
  }

  async function handleRestore(lst) {
    await api.post(`/custom-lists/${lst.id}/restore`);
    fetchLists();
  }

  if (itemsView) {
    return (
      <ListItemsView
        list={itemsView}
        onBack={() => { setItemsView(null); fetchLists(); }}
      />
    );
  }

  return (
    <div className="param-section">
      <div className="param-section-header">
        <div>
          <h2>Listes Personnalisées</h2>
          <p>Créez des listes de données configurables (matériel, équipements, types de contenu, etc.)</p>
        </div>
        <div className="param-section-actions">
          <label className="param-toggle-label">
            <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} />
            <span>Afficher archivées</span>
          </label>
          <button className="param-btn-primary" onClick={() => setModal({ mode: "create", list: null })}>
            <Icon d={ICONS.plus} size={16} />
            Nouvelle Liste
          </button>
        </div>
      </div>

      {loading ? (
        <div className="param-loader"><div className="param-spinner" /></div>
      ) : (
        <div className="lists-grid">
          {lists.length === 0 && (
            <div className="param-empty-state">
              <Icon d={ICONS.list} size={40} />
              <p>Aucune liste personnalisée</p>
              <span>Créez votre première liste pour organiser vos données</span>
            </div>
          )}
          {lists.map(lst => (
            <div key={lst.id} className={`list-card${lst.is_archived ? " archived" : ""}`}>
              <div className="list-card-icon">{lst.icon || "📦"}</div>
              <div className="list-card-body">
                <div className="list-card-name">{lst.name}</div>
                {lst.description && <div className="list-card-desc">{lst.description}</div>}
                <div className="list-card-meta">
                  <span>{lst.fields?.length || 0} champs</span>
                  <span>•</span>
                  <span>{lst.item_count || 0} entrées</span>
                </div>
              </div>
              {lst.is_archived && <span className="role-archived-tag">ARCHIVÉE</span>}
              <div className="list-card-actions">
                {!lst.is_archived ? (
                  <>
                    <button className="param-btn-ghost small" onClick={() => setItemsView(lst)}>
                      Voir les données
                    </button>
                    <button className="param-btn-ghost small" onClick={() => setModal({ mode: "edit", list: lst })}>
                      <Icon d={ICONS.edit} size={13} />
                    </button>
                    <button className="param-btn-ghost small danger" onClick={() => handleArchive(lst)}>
                      <Icon d={ICONS.archive} size={13} />
                    </button>
                  </>
                ) : (
                  <button className="param-btn-ghost small" onClick={() => handleRestore(lst)}>
                    <Icon d={ICONS.restore} size={13} /> Restaurer
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <ListModal
          mode={modal.mode}
          list={modal.list}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); fetchLists(); }}
        />
      )}
    </div>
  );
}

function ListModal({ mode, list, onClose, onSaved }) {
  const [name, setName] = useState(list?.name || "");
  const [icon, setIcon] = useState(list?.icon || "📦");
  const [description, setDescription] = useState(list?.description || "");
  const [fields, setFields] = useState(list?.fields || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const ICONS_LIST = ["📦","📋","🎬","📷","🚗","🎤","🏷️","📊","🔧","💼","🗂️","📌","🎯","📝","🔑","🏗️","📱","💡"];

  function addField() {
    setFields(f => [...f, { key: "", label: "", field_type: "text", options: [], is_required: false, position: f.length }]);
  }

  function removeField(idx) {
    setFields(f => f.filter((_, i) => i !== idx));
  }

  function updateField(idx, updates) {
    setFields(f => f.map((field, i) => i === idx ? { ...field, ...updates } : field));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) { setError("Le nom est requis"); return; }
    setSaving(true);
    setError("");
    try {
      const payload = { name: name.trim(), icon, description, fields };
      if (mode === "create") {
        await api.post("/custom-lists", payload);
      } else {
        await api.patch(`/custom-lists/${list.id}`, payload);
      }
      onSaved();
    } catch (err) {
      setError(err.message || "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="param-modal-overlay" onClick={onClose}>
      <div className="param-modal large" onClick={e => e.stopPropagation()}>
        <div className="param-modal-header">
          <h3>{mode === "create" ? "Nouvelle Liste" : `Modifier : ${list.name}`}</h3>
          <button className="param-modal-close" onClick={onClose}><Icon d={ICONS.x} size={18} /></button>
        </div>
        <form className="param-modal-body" onSubmit={handleSubmit}>
          {error && <div className="param-error-banner">{error}</div>}

          <div className="param-form-grid-2">
            <div className="param-field">
              <label>Nom de la liste</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="ex: Matériel Audio" required />
            </div>
            <div className="param-field">
              <label>Description</label>
              <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Description optionnelle" />
            </div>
          </div>

          <div className="param-field">
            <label>Icône</label>
            <div className="icon-picker">
              {ICONS_LIST.map(ic => (
                <button key={ic} type="button"
                  className={`icon-swatch${icon === ic ? " selected" : ""}`}
                  onClick={() => setIcon(ic)}
                >{ic}</button>
              ))}
            </div>
          </div>

          <div className="param-field">
            <label>Champs</label>
            <div className="fields-builder">
              {fields.map((field, idx) => (
                <div key={idx} className="field-row">
                  <input
                    placeholder="Libellé"
                    value={field.label}
                    onChange={e => updateField(idx, { label: e.target.value })}
                    className="field-label-input"
                  />
                  <select
                    value={field.field_type}
                    onChange={e => updateField(idx, { field_type: e.target.value })}
                  >
                    {FIELD_TYPES.map(ft => (
                      <option key={ft.value} value={ft.value}>{ft.label}</option>
                    ))}
                  </select>
                  {field.field_type === "select" && (
                    <input
                      placeholder="Options (séparées par ';')"
                      value={(field.options || []).join(";")}
                      onChange={e => updateField(idx, { options: e.target.value.split(";").map(s => s.trim()).filter(Boolean) })}
                      className="field-options-input"
                    />
                  )}
                  <label className="field-required-label">
                    <input
                      type="checkbox"
                      checked={field.is_required}
                      onChange={e => updateField(idx, { is_required: e.target.checked })}
                    />
                    Requis
                  </label>
                  <button type="button" className="field-remove" onClick={() => removeField(idx)}>
                    <Icon d={ICONS.x} size={14} />
                  </button>
                </div>
              ))}
              <button type="button" className="add-field-btn" onClick={addField}>
                <Icon d={ICONS.plus} size={14} /> Ajouter un champ
              </button>
            </div>
          </div>

          <div className="param-modal-footer">
            <button type="button" className="param-btn-ghost" onClick={onClose}>Annuler</button>
            <button type="submit" className="param-btn-primary" disabled={saving}>
              {saving ? "Sauvegarde..." : mode === "create" ? "Créer la Liste" : "Enregistrer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── List Items View ────────────────────────────────────────────────────────────
function ListItemsView({ list, onBack }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);

  async function fetchItems() {
    setLoading(true);
    try {
      const data = await api.get(`/custom-lists/${list.id}/items`);
      setItems(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchItems(); }, []);

  function startCreate() {
    setDraft({});
    setEditItem(null);
    setShowForm(true);
  }

  function startEdit(item) {
    setDraft({ ...item.data });
    setEditItem(item);
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editItem) {
        await api.patch(`/custom-lists/${list.id}/items/${editItem.id}`, { data: draft });
      } else {
        await api.post(`/custom-lists/${list.id}/items`, { data: draft });
      }
      setShowForm(false);
      setEditItem(null);
      setDraft({});
      fetchItems();
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(item) {
    if (!confirm("Archiver cet élément ?")) return;
    await api.post(`/custom-lists/${list.id}/items/${item.id}/archive`);
    fetchItems();
  }

  const fields = list.fields || [];

  return (
    <div className="param-section">
      <div className="param-section-header">
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <button className="param-btn-ghost" onClick={onBack}>← Retour</button>
          <div>
            <h2>{list.icon} {list.name}</h2>
            <p>{list.description || "Gestion des entrées de cette liste"}</p>
          </div>
        </div>
        <button className="param-btn-primary" onClick={startCreate}>
          <Icon d={ICONS.plus} size={16} /> Ajouter une entrée
        </button>
      </div>

      {showForm && (
        <div className="param-modal-overlay" onClick={() => setShowForm(false)}>
          <div className="param-modal" onClick={e => e.stopPropagation()}>
            <div className="param-modal-header">
              <h3>{editItem ? "Modifier l'entrée" : "Nouvelle entrée"}</h3>
              <button className="param-modal-close" onClick={() => setShowForm(false)}><Icon d={ICONS.x} size={18} /></button>
            </div>
            <form className="param-modal-body" onSubmit={handleSubmit}>
              {fields.map(field => (
                <div key={field.key} className="param-field">
                  <label>{field.label} {field.is_required && <span className="required">*</span>}</label>
                  {field.field_type === "select" ? (
                    <select
                      value={draft[field.key] || ""}
                      onChange={e => setDraft(d => ({ ...d, [field.key]: e.target.value }))}
                      required={field.is_required}
                    >
                      <option value="">— Choisir —</option>
                      {(field.options || []).map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.field_type === "number" ? "number" : field.field_type === "date" ? "date" : "text"}
                      value={draft[field.key] || ""}
                      onChange={e => setDraft(d => ({ ...d, [field.key]: e.target.value }))}
                      required={field.is_required}
                    />
                  )}
                </div>
              ))}
              <div className="param-modal-footer">
                <button type="button" className="param-btn-ghost" onClick={() => setShowForm(false)}>Annuler</button>
                <button type="submit" className="param-btn-primary" disabled={saving}>
                  {saving ? "..." : editItem ? "Modifier" : "Ajouter"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="param-loader"><div className="param-spinner" /></div>
      ) : (
        <div className="items-table-wrapper">
          {items.length === 0 ? (
            <div className="param-empty-state">
              <p>Aucune entrée dans cette liste</p>
            </div>
          ) : (
            <table className="items-table">
              <thead>
                <tr>
                  {fields.map(f => <th key={f.key}>{f.label}</th>)}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id}>
                    {fields.map(f => <td key={f.key}>{item.data?.[f.key] ?? "—"}</td>)}
                    <td className="item-actions">
                      <button className="param-btn-ghost small" onClick={() => startEdit(item)}>
                        <Icon d={ICONS.edit} size={13} />
                      </button>
                      <button className="param-btn-ghost small danger" onClick={() => handleArchive(item)}>
                        <Icon d={ICONS.archive} size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// TAB 4: WORKFLOW INFO
// ──────────────────────────────────────────────────────────────────────────────
function WorkflowInfoTab({ navigate }) {
  return (
    <div className="param-section">
      <div className="param-section-header">
        <div>
          <h2>Workflows & Form Builder</h2>
          <p>Gérez les workflows et configurez les formulaires de transition enrichis.</p>
        </div>
      </div>

      <div className="workflow-info-grid">
        <div className="workflow-info-card">
          <div className="workflow-info-icon">🔄</div>
          <h3>Éditeur de Workflow</h3>
          <p>Créez et modifiez visuellement vos workflows : statuts, transitions et règles de passage.</p>
          <ul>
            <li>✅ Rôles dynamiques chargés depuis l'API</li>
            <li>✅ Restrictions par rôle OU personne spécifique</li>
            <li>✅ Formulaires enrichis par transition</li>
            <li>✅ Champs de type sélection depuis une liste personnalisée</li>
          </ul>
          <button className="param-btn-primary" onClick={() => navigate("/workflows")}>
            <Icon d={ICONS.external} size={16} /> Ouvrir les Workflows
          </button>
        </div>

        <div className="workflow-info-card">
          <div className="workflow-info-icon">📋</div>
          <h3>Formulaires de Transition</h3>
          <p>Chaque transition peut exiger une saisie de données avant d'être validée.</p>
          <div className="field-type-list">
            <div className="field-type-item"><span>Texte libre</span><span className="field-type-tag">text</span></div>
            <div className="field-type-item"><span>Nombre</span><span className="field-type-tag">number</span></div>
            <div className="field-type-item"><span>Date</span><span className="field-type-tag">date</span></div>
            <div className="field-type-item"><span>Liste déroulante</span><span className="field-type-tag">select</span></div>
            <div className="field-type-item highlight"><span>Sélection depuis une liste personnalisée</span><span className="field-type-tag new">list_select ✨</span></div>
          </div>
        </div>

        <div className="workflow-info-card">
          <div className="workflow-info-icon">🔒</div>
          <h3>Contrôle d'accès aux transitions</h3>
          <p>Pour chaque transition du workflow, définissez précisément qui peut la déclencher.</p>
          <div className="access-control-list">
            <div className="access-item">
              <span className="access-badge role">Par Rôle</span>
              <span>Sélectionnez un ou plusieurs rôles autorisés</span>
            </div>
            <div className="access-item">
              <span className="access-badge user">Par Personne</span>
              <span>Désignez un utilisateur spécifique (OR avec le rôle)</span>
            </div>
            <div className="access-item">
              <span className="access-badge admin">Admin / Manager</span>
              <span>Passent toujours en mode dérogatoire</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
