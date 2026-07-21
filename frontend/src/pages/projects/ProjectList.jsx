import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import AppShell from "../../components/AppShell";
import Modal from "../../components/Modal";
import { GlowingEffect } from "../../components/GlowingEffect";
import "../../styles/shared.css";
import "./ProjectList.css";

const STATUS_LABELS = {
  actif: "Actif",
  on_hold: "En pause",
  termine: "Terminé",
};

const EMPTY_FORM = { title: "", start_date: "", remarks: "", cm_id: "", monthly_targets: {} };

export default function ProjectList() {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [cmUsers, setCmUsers] = useState([]);
  const [taskTypes, setTaskTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const canCreate = ["manager", "admin_sys"].includes(user?.effective_role);

  async function loadAll() {
    setLoading(true);
    setLoadError("");
    try {
      const [projectsData, usersData, taskTypesData] = await Promise.all([
        api.get("/projects"),
        api.get("/users/directory"),
        api.get("/task-types"),
      ]);
      setProjects(projectsData);
      setCmUsers(usersData.filter((u) => u.role === "cm"));
      setTaskTypes(taskTypesData);
    } catch {
      setLoadError("Impossible de charger les projets.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fetch on mount
    loadAll();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (q && !p.title.toLowerCase().includes(q) && !(p.cm_name || "").toLowerCase().includes(q)) return false;
      if (dateFilter && !p.created_at.startsWith(dateFilter)) return false;
      return true;
    });
  }, [projects, search, statusFilter, dateFilter]);

  function openCreate() {
    setForm({ ...EMPTY_FORM, start_date: new Date().toISOString().slice(0, 10) });
    setFormErrors({});
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setModalOpen(false);
  }

  function updateTarget(taskTypeId, count) {
    setForm((f) => ({
      ...f,
      monthly_targets: { ...f.monthly_targets, [taskTypeId]: count },
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errors = {};
    if (!form.title.trim()) errors.title = "Titre requis.";
    if (!form.start_date) errors.start_date = "Date de début requise.";
    if (!form.cm_id) errors.cm_id = "Community Manager requis.";

    const targetsEntries = Object.entries(form.monthly_targets).filter(
      ([, count]) => count !== "" && Number(count) > 0
    );
    if (targetsEntries.length === 0) {
      errors.monthly_targets = "Renseignez au moins une fréquence mensuelle.";
    }

    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    try {
      const cleanTargets = Object.fromEntries(targetsEntries.map(([k, v]) => [k, Number(v)]));
      const created = await api.post("/projects", {
        title: form.title.trim(),
        start_date: form.start_date,
        remarks: form.remarks.trim() || null,
        cm_id: Number(form.cm_id),
        monthly_targets: cleanTargets,
      });
      setProjects((prev) => [...prev, created]);
      setModalOpen(false);
    } catch {
      setFormErrors({ form: "Une erreur est survenue. Réessayez." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
    <div className="pl-page">
      <div className="pl-header">
        <div>
          <h1>Projets</h1>
          <p className="pl-subtitle">Suivez l&rsquo;ensemble des projets clients.</p>
        </div>
        {canCreate && (
          <button type="button" className="btn-primary" onClick={openCreate}>
            + Nouveau projet
          </button>
        )}
      </div>

      <div className="pl-toolbar">
        <input
          type="search"
          className="users-search"
          placeholder="Rechercher un projet…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <input
          type="date"
          className="users-search"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          title="Filtrer par date de création"
        />
        <div className="users-filters">
          {["all", "actif", "on_hold", "termine"].map((s) => (
            <button
              key={s}
              type="button"
              className={`chip-toggle${statusFilter === s ? " is-selected" : ""}`}
              onClick={() => setStatusFilter(s)}
            >
              {s === "all" ? "Tous" : STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {loadError && <p className="tt-status tt-status--error">{loadError}</p>}
      {loading && <p className="tt-status">Chargement…</p>}

      {!loading && (
        <div className="pl-grid">
          {filtered.length === 0 && (
            <p className="tt-status">Aucun projet ne correspond à ces critères.</p>
          )}
          {filtered.map((p) => (
            <Link key={p.id} to={`/projects/${p.id}`} className="pl-card">
              <GlowingEffect spread={40} glow={true} disabled={false} proximity={64} inactiveZone={0.01} />
              <div className="pl-card-top">
                <h3>{p.title}</h3>
                <span className={`status-chip ${p.status === "actif" ? "is-active" : p.status === "on_hold" ? "is-inactive" : "is-archived"}`}>
                  {STATUS_LABELS[p.status] || p.status}
                </span>
              </div>
              <p className="pl-card-cm">CM : {p.cm_name || "—"}</p>
              <p className="pl-card-date">Début : {new Date(p.start_date).toLocaleDateString("fr-FR")}</p>
            </Link>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={closeModal} title="Nouveau projet" width={480}>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="pj-title">Titre</label>
            <input
              id="pj-title"
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
            {formErrors.title && <span className="field-error">{formErrors.title}</span>}
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="pj-start">Date de début</label>
              <input
                id="pj-start"
                type="date"
                value={form.start_date}
                onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
              />
              {formErrors.start_date && <span className="field-error">{formErrors.start_date}</span>}
            </div>
            <div className="field">
              <label htmlFor="pj-cm">Community Manager</label>
              <select
                id="pj-cm"
                value={form.cm_id}
                onChange={(e) => setForm((f) => ({ ...f, cm_id: e.target.value }))}
              >
                <option value="">Sélectionner…</option>
                {cmUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.first_name} {u.last_name}
                  </option>
                ))}
              </select>
              {formErrors.cm_id && <span className="field-error">{formErrors.cm_id}</span>}
            </div>
          </div>

          <div className="field">
            <label>Fréquence mensuelle par type de tâche</label>
            <div className="pl-targets-grid">
              {taskTypes.filter((tt) => !tt.is_archived).map((tt) => (
                <div key={tt.id} className="pl-target-row">
                  <span>{tt.name}</span>
                  <input
                    type="number"
                    min="0"
                    className="ta-time-input"
                    value={form.monthly_targets[tt.id] || ""}
                    onChange={(e) => updateTarget(tt.id, e.target.value)}
                  />
                </div>
              ))}
              {taskTypes.filter((tt) => !tt.is_archived).length === 0 && (
                <p className="tt-status">Aucun type de tâche configuré.</p>
              )}
            </div>
            {formErrors.monthly_targets && <span className="field-error">{formErrors.monthly_targets}</span>}
          </div>

          <div className="field">
            <label htmlFor="pj-remarks">Remarques</label>
            <textarea
              id="pj-remarks"
              rows={3}
              value={form.remarks}
              onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
            />
          </div>

          {formErrors.form && <p className="field-error">{formErrors.form}</p>}

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={closeModal} disabled={saving}>
              Annuler
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Création…" : "Créer"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
    </AppShell>
  );
}