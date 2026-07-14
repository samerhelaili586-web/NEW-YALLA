import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../../api/client";
import Modal from "../../components/Modal";
import "../../styles/shared.css";
import "./TaskTypes.css";

const TEMPORAL_OPTIONS = [
  { value: "evolutif", label: "Évolutif" },
  { value: "fige", label: "Figé" },
];

const FUNCTIONAL_OPTIONS = [
  { value: "debut", label: "Début" },
  { value: "intermediaire", label: "Intermédiaire" },
  { value: "planification_shooting", label: "Planification — Shooting" },
  { value: "planification_montage", label: "Planification — Montage" },
  { value: "montage", label: "Montage" },
  { value: "final_confirmation", label: "Final — Confirmation" },
  { value: "final_rejet", label: "Final — Rejet" },
];

const FUNCTIONAL_LABELS = Object.fromEntries(FUNCTIONAL_OPTIONS.map((o) => [o.value, o.label]));

const ROLE_OPTIONS = [
  { value: "admin_sys", label: "Admin Système" },
  { value: "manager", label: "Manager" },
  { value: "cm", label: "Community Manager" },
  { value: "prod", label: "Prod" },
  { value: "chef_prod", label: "Chef Prod" },
];

const EMPTY_TT_FORM = { name: "" };

const EMPTY_STATUS_FORM = {
  title: "",
  temporal_type: "evolutif",
  functional_type: "debut",
  allowed_roles: [],
};

function emptyErrors() {
  return {};
}

export default function AdminTaskTypes() {
  const [taskTypes, setTaskTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const [selectedId, setSelectedId] = useState(null);

  // task type modal
  const [ttModalOpen, setTtModalOpen] = useState(false);
  const [editingTt, setEditingTt] = useState(null);
  const [ttForm, setTtForm] = useState(EMPTY_TT_FORM);
  const [ttErrors, setTtErrors] = useState(emptyErrors());
  const [ttSaving, setTtSaving] = useState(false);
  const [confirmArchiveTt, setConfirmArchiveTt] = useState(null);

  // status modal
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [editingStatus, setEditingStatus] = useState(null);
  const [statusForm, setStatusForm] = useState(EMPTY_STATUS_FORM);
  const [statusErrors, setStatusErrors] = useState(emptyErrors());
  const [statusSaving, setStatusSaving] = useState(false);
  const [confirmDeleteStatus, setConfirmDeleteStatus] = useState(null);

  // transition builder
  const [transitionFrom, setTransitionFrom] = useState("");
  const [transitionTo, setTransitionTo] = useState("");
  const [transitionSaving, setTransitionSaving] = useState(false);
  const [transitionError, setTransitionError] = useState("");

  const [rowActionId, setRowActionId] = useState(null);

  async function loadTaskTypes(preserveSelection = true) {
    setLoading(true);
    setLoadError("");
    try {
      const data = await api.get("/task-types", { include_archived: 1 });
      setTaskTypes(data);
      if (!preserveSelection && data.length > 0) {
        setSelectedId(data[0].id);
      }
    } catch {
      setLoadError("Impossible de charger les types de tâches.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fetch on mount
    loadTaskTypes(false);
  }, []);

  const visibleTaskTypes = useMemo(
    () => taskTypes.filter((tt) => showArchived || !tt.is_archived),
    [taskTypes, showArchived]
  );

  const selected = useMemo(
    () => taskTypes.find((tt) => tt.id === selectedId) || null,
    [taskTypes, selectedId]
  );

  useEffect(() => {
    if (!selected && visibleTaskTypes.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- keep selection valid when list changes
      setSelectedId(visibleTaskTypes[0].id);
    }
  }, [selected, visibleTaskTypes]);

  // ---------- Task type CRUD ----------
  function openCreateTt() {
    setEditingTt(null);
    setTtForm(EMPTY_TT_FORM);
    setTtErrors(emptyErrors());
    setTtModalOpen(true);
  }

  function openEditTt(tt) {
    setEditingTt(tt);
    setTtForm({ name: tt.name });
    setTtErrors(emptyErrors());
    setTtModalOpen(true);
  }

  function closeTtModal() {
    if (ttSaving) return;
    setTtModalOpen(false);
  }

  async function handleTtSubmit(e) {
    e.preventDefault();
    if (!ttForm.name.trim()) {
      setTtErrors({ name: "Nom requis." });
      return;
    }
    setTtSaving(true);
    try {
      if (editingTt) {
        const updated = await api.patch(`/task-types/${editingTt.id}`, { name: ttForm.name.trim() });
        setTaskTypes((prev) => prev.map((tt) => (tt.id === updated.id ? updated : tt)));
      } else {
        const created = await api.post("/task-types", { name: ttForm.name.trim() });
        setTaskTypes((prev) => [...prev, created]);
        setSelectedId(created.id);
      }
      setTtModalOpen(false);
    } catch {
      setTtErrors({ form: "Une erreur est survenue. Réessayez." });
    } finally {
      setTtSaving(false);
    }
  }

  async function confirmArchiveTaskType() {
    if (!confirmArchiveTt) return;
    setRowActionId(confirmArchiveTt.id);
    try {
      const updated = await api.post(`/task-types/${confirmArchiveTt.id}/archive`);
      setTaskTypes((prev) => prev.map((tt) => (tt.id === updated.id ? updated : tt)));
      setConfirmArchiveTt(null);
    } catch {
      setLoadError("Impossible d'archiver ce type de tâche.");
    } finally {
      setRowActionId(null);
    }
  }

  // ---------- Status CRUD ----------
  function openCreateStatus() {
    setEditingStatus(null);
    setStatusForm(EMPTY_STATUS_FORM);
    setStatusErrors(emptyErrors());
    setStatusModalOpen(true);
  }

  function openEditStatus(status) {
    setEditingStatus(status);
    setStatusForm({
      title: status.title,
      temporal_type: status.temporal_type,
      functional_type: status.functional_type,
      allowed_roles: status.allowed_roles || [],
    });
    setStatusErrors(emptyErrors());
    setStatusModalOpen(true);
  }

  function closeStatusModal() {
    if (statusSaving) return;
    setStatusModalOpen(false);
  }

  function toggleAllowedRole(role) {
    setStatusForm((f) => ({
      ...f,
      allowed_roles: f.allowed_roles.includes(role)
        ? f.allowed_roles.filter((r) => r !== role)
        : [...f.allowed_roles, role],
    }));
  }

  async function handleStatusSubmit(e) {
    e.preventDefault();
    if (!statusForm.title.trim()) {
      setStatusErrors({ title: "Titre requis." });
      return;
    }
    setStatusSaving(true);
    try {
      const payload = {
        title: statusForm.title.trim(),
        temporal_type: statusForm.temporal_type,
        functional_type: statusForm.functional_type,
        allowed_roles: statusForm.allowed_roles,
      };
      if (editingStatus) {
        await api.patch(`/task-types/statuses/${editingStatus.id}`, payload);
      } else {
        await api.post(`/task-types/${selected.id}/statuses`, payload);
      }
      await loadTaskTypes();
      setStatusModalOpen(false);
    } catch {
      setStatusErrors({ form: "Une erreur est survenue. Réessayez." });
    } finally {
      setStatusSaving(false);
    }
  }

  async function confirmDeleteStatusAction() {
    if (!confirmDeleteStatus) return;
    setRowActionId(confirmDeleteStatus.id);
    try {
      await api.delete(`/task-types/statuses/${confirmDeleteStatus.id}`);
      await loadTaskTypes();
      setConfirmDeleteStatus(null);
    } catch (err) {
      if (err instanceof ApiError && err.data?.error === "status_in_use") {
        setLoadError("Ce statut est utilisé par des tâches existantes et ne peut pas être supprimé.");
      } else {
        setLoadError("Impossible de supprimer ce statut.");
      }
    } finally {
      setRowActionId(null);
    }
  }

  // ---------- Transitions ----------
  async function handleAddTransition(e) {
    e.preventDefault();
    setTransitionError("");
    if (!transitionFrom || !transitionTo) return;
    if (transitionFrom === transitionTo) {
      setTransitionError("Le statut de départ et d'arrivée doivent être différents.");
      return;
    }
    setTransitionSaving(true);
    try {
      await api.post("/task-types/transitions", {
        from_status_id: Number(transitionFrom),
        to_status_id: Number(transitionTo),
      });
      await loadTaskTypes();
      setTransitionFrom("");
      setTransitionTo("");
    } catch (err) {
      if (err instanceof ApiError && err.data?.error === "final_status_no_outgoing_transition") {
        setTransitionError("Un statut final ne peut pas avoir de transition sortante.");
      } else if (err instanceof ApiError && err.data?.error === "transition_already_exists") {
        setTransitionError("Cette transition existe déjà.");
      } else {
        setTransitionError("Impossible de créer cette transition.");
      }
    } finally {
      setTransitionSaving(false);
    }
  }

  async function handleDeleteTransition(transitionId) {
    setRowActionId(transitionId);
    try {
      await api.delete(`/task-types/transitions/${transitionId}`);
      await loadTaskTypes();
    } catch {
      setLoadError("Impossible de supprimer cette transition.");
    } finally {
      setRowActionId(null);
    }
  }

  const statuses = useMemo(() => selected?.statuses || [], [selected]);
  const statusById = useMemo(
    () => Object.fromEntries(statuses.map((s) => [s.id, s])),
    [statuses]
  );
  const allTransitions = useMemo(() => {
    const list = [];
    for (const s of statuses) {
      for (const t of s.outgoing_transitions || []) {
        list.push(t);
      }
    }
    return list;
  }, [statuses]);

  const fromStatus = statusById[Number(transitionFrom)];
  const isFromFinal = fromStatus && ["final_confirmation", "final_rejet"].includes(fromStatus.functional_type);

  return (
    <div className="tt-page">
      <div className="tt-header">
        <div>
          <h1>Types de tâches</h1>
          <p className="tt-subtitle">Configurez les workflows et les transitions de statuts.</p>
        </div>
        <button type="button" className="btn-primary" onClick={openCreateTt}>
          + Nouveau type de tâche
        </button>
      </div>

      {loadError && <p className="tt-status tt-status--error">{loadError}</p>}
      {loading && <p className="tt-status">Chargement…</p>}

      {!loading && (
        <div className="tt-layout">
          <div className="tt-sidebar">
            <label className="tt-archived-toggle">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
              />
              Afficher les archivés
            </label>
            <ul className="tt-list">
              {visibleTaskTypes.length === 0 && (
                <li className="tt-list-empty">Aucun type de tâche.</li>
              )}
              {visibleTaskTypes.map((tt) => (
                <li key={tt.id}>
                  <button
                    type="button"
                    className={`tt-list-item${tt.id === selectedId ? " is-selected" : ""}${tt.is_archived ? " is-archived-row" : ""}`}
                    onClick={() => setSelectedId(tt.id)}
                  >
                    <span>{tt.name}</span>
                    {tt.is_archived && <span className="status-chip is-archived">Archivé</span>}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="tt-detail">
            {!selected && <p className="tt-status">Sélectionnez un type de tâche.</p>}

            {selected && (
              <>
                <div className="tt-detail-header">
                  <h2>{selected.name}</h2>
                  <div className="tt-detail-actions">
                    <button type="button" className="link-action" onClick={() => openEditTt(selected)}>
                      Renommer
                    </button>
                    {!selected.is_archived && (
                      <button
                        type="button"
                        className="link-action is-danger"
                        onClick={() => setConfirmArchiveTt(selected)}
                      >
                        Archiver
                      </button>
                    )}
                  </div>
                </div>

                <section className="tt-section">
                  <div className="tt-section-header">
                    <h3>Statuts</h3>
                    <button type="button" className="btn-secondary" onClick={openCreateStatus}>
                      + Ajouter un statut
                    </button>
                  </div>

                  {statuses.length === 0 && (
                    <p className="tt-status">Aucun statut pour ce type de tâche.</p>
                  )}

                  {statuses.length > 0 && (
                    <div className="tt-table-wrap">
                      <table className="tt-table">
                        <thead>
                          <tr>
                            <th>Titre</th>
                            <th>Type temporel</th>
                            <th>Type fonctionnel</th>
                            <th>Rôles autorisés</th>
                            <th aria-label="Actions" />
                          </tr>
                        </thead>
                        <tbody>
                          {statuses.map((s) => (
                            <tr key={s.id}>
                              <td>{s.title}</td>
                              <td>
                                <span className={`status-chip ${s.temporal_type === "fige" ? "is-inactive" : "is-active"}`}>
                                  {TEMPORAL_OPTIONS.find((o) => o.value === s.temporal_type)?.label}
                                </span>
                              </td>
                              <td>{FUNCTIONAL_LABELS[s.functional_type] || s.functional_type}</td>
                              <td className="tt-roles-cell">
                                {(s.allowed_roles || []).length === 0
                                  ? <span className="users-na">—</span>
                                  : s.allowed_roles
                                      .map((r) => ROLE_OPTIONS.find((o) => o.value === r)?.label || r)
                                      .join(", ")}
                              </td>
                              <td>
                                <div className="users-row-actions">
                                  <button type="button" className="link-action" onClick={() => openEditStatus(s)}>
                                    Modifier
                                  </button>
                                  <button
                                    type="button"
                                    className="link-action is-danger"
                                    disabled={rowActionId === s.id}
                                    onClick={() => setConfirmDeleteStatus(s)}
                                  >
                                    Supprimer
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                <section className="tt-section">
                  <h3>Transitions</h3>
                  <p className="tt-section-hint">
                    Définissez les statuts vers lesquels une tâche peut évoluer. Un statut final ne peut avoir aucune transition sortante.
                  </p>

                  {statuses.length < 2 ? (
                    <p className="tt-status">Ajoutez au moins deux statuts pour créer une transition.</p>
                  ) : (
                    <form className="tt-transition-form" onSubmit={handleAddTransition}>
                      <select value={transitionFrom} onChange={(e) => setTransitionFrom(e.target.value)}>
                        <option value="">Statut de départ…</option>
                        {statuses.map((s) => (
                          <option key={s.id} value={s.id}>{s.title}</option>
                        ))}
                      </select>
                      <span className="tt-transition-arrow">→</span>
                      <select value={transitionTo} onChange={(e) => setTransitionTo(e.target.value)}>
                        <option value="">Statut d&rsquo;arrivée…</option>
                        {statuses.map((s) => (
                          <option key={s.id} value={s.id}>{s.title}</option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="btn-secondary"
                        disabled={transitionSaving || !transitionFrom || !transitionTo || isFromFinal}
                      >
                        + Ajouter
                      </button>
                    </form>
                  )}
                  {isFromFinal && (
                    <p className="field-error">Ce statut est final : aucune transition sortante possible.</p>
                  )}
                  {transitionError && <p className="field-error">{transitionError}</p>}

                  {allTransitions.length > 0 && (
                    <ul className="tt-transition-list">
                      {allTransitions.map((t) => (
                        <li key={t.id} className="tt-transition-row">
                          <span>{statusById[t.from_status_id]?.title || "?"}</span>
                          <span className="tt-transition-arrow">→</span>
                          <span>{statusById[t.to_status_id]?.title || "?"}</span>
                          <button
                            type="button"
                            className="link-action is-danger"
                            disabled={rowActionId === t.id}
                            onClick={() => handleDeleteTransition(t.id)}
                          >
                            Retirer
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </>
            )}
          </div>
        </div>
      )}

      {/* Task type create/rename modal */}
      <Modal
        open={ttModalOpen}
        onClose={closeTtModal}
        title={editingTt ? "Renommer le type de tâche" : "Nouveau type de tâche"}
        width={420}
      >
        <form onSubmit={handleTtSubmit}>
          <div className="field">
            <label htmlFor="tt-name">Nom</label>
            <input
              id="tt-name"
              type="text"
              value={ttForm.name}
              onChange={(e) => setTtForm({ name: e.target.value })}
            />
            {ttErrors.name && <span className="field-error">{ttErrors.name}</span>}
          </div>
          {ttErrors.form && <p className="field-error">{ttErrors.form}</p>}
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={closeTtModal} disabled={ttSaving}>
              Annuler
            </button>
            <button type="submit" className="btn-primary" disabled={ttSaving}>
              {ttSaving ? "Enregistrement…" : editingTt ? "Enregistrer" : "Créer"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Archive task type confirm */}
      <Modal
        open={Boolean(confirmArchiveTt)}
        onClose={() => setConfirmArchiveTt(null)}
        title="Archiver ce type de tâche ?"
        width={420}
      >
        <p className="users-confirm-text">
          {confirmArchiveTt
            ? `"${confirmArchiveTt.name}" sera archivé et n'apparaîtra plus dans les nouvelles tâches.`
            : ""}
        </p>
        <div className="form-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setConfirmArchiveTt(null)}
            disabled={rowActionId === confirmArchiveTt?.id}
          >
            Annuler
          </button>
          <button
            type="button"
            className="btn-danger"
            onClick={confirmArchiveTaskType}
            disabled={rowActionId === confirmArchiveTt?.id}
          >
            {rowActionId === confirmArchiveTt?.id ? "Archivage…" : "Archiver"}
          </button>
        </div>
      </Modal>

      {/* Status create/edit modal */}
      <Modal
        open={statusModalOpen}
        onClose={closeStatusModal}
        title={editingStatus ? "Modifier le statut" : "Nouveau statut"}
        width={480}
      >
        <form onSubmit={handleStatusSubmit}>
          <div className="field">
            <label htmlFor="status-title">Titre</label>
            <input
              id="status-title"
              type="text"
              value={statusForm.title}
              onChange={(e) => setStatusForm((f) => ({ ...f, title: e.target.value }))}
            />
            {statusErrors.title && <span className="field-error">{statusErrors.title}</span>}
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="status-temporal">Type temporel</label>
              <select
                id="status-temporal"
                value={statusForm.temporal_type}
                onChange={(e) => setStatusForm((f) => ({ ...f, temporal_type: e.target.value }))}
              >
                {TEMPORAL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="status-functional">Type fonctionnel</label>
              <select
                id="status-functional"
                value={statusForm.functional_type}
                onChange={(e) => setStatusForm((f) => ({ ...f, functional_type: e.target.value }))}
              >
                {FUNCTIONAL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <label>Rôles autorisés à faire évoluer ce statut</label>
            <div className="tt-role-chips">
              {ROLE_OPTIONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  className={`chip-toggle${statusForm.allowed_roles.includes(r.value) ? " is-selected" : ""}`}
                  onClick={() => toggleAllowedRole(r.value)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {statusErrors.form && <p className="field-error">{statusErrors.form}</p>}

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={closeStatusModal} disabled={statusSaving}>
              Annuler
            </button>
            <button type="submit" className="btn-primary" disabled={statusSaving}>
              {statusSaving ? "Enregistrement…" : editingStatus ? "Enregistrer" : "Créer"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete status confirm */}
      <Modal
        open={Boolean(confirmDeleteStatus)}
        onClose={() => setConfirmDeleteStatus(null)}
        title="Supprimer ce statut ?"
        width={420}
      >
        <p className="users-confirm-text">
          {confirmDeleteStatus
            ? `"${confirmDeleteStatus.title}" sera définitivement supprimé. Cette action est impossible si des tâches utilisent ce statut.`
            : ""}
        </p>
        <div className="form-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setConfirmDeleteStatus(null)}
            disabled={rowActionId === confirmDeleteStatus?.id}
          >
            Annuler
          </button>
          <button
            type="button"
            className="btn-danger"
            onClick={confirmDeleteStatusAction}
            disabled={rowActionId === confirmDeleteStatus?.id}
          >
            {rowActionId === confirmDeleteStatus?.id ? "Suppression…" : "Supprimer"}
          </button>
        </div>
      </Modal>
    </div>
  );
}