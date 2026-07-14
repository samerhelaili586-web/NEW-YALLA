import { useEffect, useMemo, useState } from "react";
import { api } from "../../api/client";
import Modal from "../../components/Modal";
import "../../styles/shared.css";
import "./Equipment.css";

const EMPTY_FORM = { name: "", description: "", image_url: "" };

export default function AdminEquipment() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const [rowActionId, setRowActionId] = useState(null);

  async function loadItems() {
    setLoading(true);
    setLoadError("");
    try {
      const data = await api.get("/equipment");
      setItems(data);
    } catch {
      setLoadError("Impossible de charger le matériel.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fetch on mount
    loadItems();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (!showInactive && !it.is_active) return false;
      if (!q) return true;
      return it.name.toLowerCase().includes(q);
    });
  }, [items, search, showInactive]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setModalOpen(true);
  }

  function openEdit(item) {
    setEditing(item);
    setForm({
      name: item.name,
      description: item.description || "",
      image_url: item.image_url || "",
    });
    setFormErrors({});
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setModalOpen(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      setFormErrors({ name: "Nom requis." });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        image_url: form.image_url.trim() || null,
      };
      if (editing) {
        const updated = await api.patch(`/equipment/${editing.id}`, payload);
        setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
      } else {
        const created = await api.post("/equipment", payload);
        setItems((prev) => [...prev, created]);
      }
      setModalOpen(false);
    } catch {
      setFormErrors({ form: "Une erreur est survenue. Réessayez." });
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(item) {
    setRowActionId(item.id);
    try {
      const updated = await api.patch(`/equipment/${item.id}`, { is_active: !item.is_active });
      setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
    } catch {
      setLoadError("Impossible de modifier le statut de cet équipement.");
    } finally {
      setRowActionId(null);
    }
  }

  return (
    <div className="eq-page">
      <div className="eq-header">
        <div>
          <h1>Matériel</h1>
          <p className="eq-subtitle">Gérez le matériel disponible pour les shootings.</p>
        </div>
        <button type="button" className="btn-primary" onClick={openCreate}>
          + Nouveau matériel
        </button>
      </div>

      <div className="eq-toolbar">
        <input
          type="search"
          className="users-search"
          placeholder="Rechercher un équipement…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label className="users-archived-toggle">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Afficher les inactifs
        </label>
      </div>

      {loadError && <p className="tt-status tt-status--error">{loadError}</p>}
      {loading && <p className="tt-status">Chargement…</p>}

      {!loading && (
        <div className="eq-grid">
          {filtered.length === 0 && (
            <p className="tt-status">Aucun matériel ne correspond à ces critères.</p>
          )}
          {filtered.map((item) => (
            <div key={item.id} className={`eq-card${!item.is_active ? " is-inactive-card" : ""}`}>
              <div className="eq-card-image">
                {item.image_url ? (
                  <img src={item.image_url} alt={item.name} />
                ) : (
                  <div className="eq-card-placeholder">Pas d&rsquo;image</div>
                )}
              </div>
              <div className="eq-card-body">
                <div className="eq-card-title-row">
                  <h3>{item.name}</h3>
                  <span className={`status-chip ${item.is_active ? "is-active" : "is-inactive"}`}>
                    {item.is_active ? "Actif" : "Inactif"}
                  </span>
                </div>
                {item.description && <p className="eq-card-desc">{item.description}</p>}
                <div className="users-row-actions">
                  <button type="button" className="link-action" onClick={() => openEdit(item)}>
                    Modifier
                  </button>
                  <button
                    type="button"
                    className="link-action is-muted"
                    disabled={rowActionId === item.id}
                    onClick={() => toggleActive(item)}
                  >
                    {item.is_active ? "Désactiver" : "Activer"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? "Modifier le matériel" : "Nouveau matériel"}
        width={480}
      >
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="eq-name">Nom</label>
            <input
              id="eq-name"
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            {formErrors.name && <span className="field-error">{formErrors.name}</span>}
          </div>

          <div className="field">
            <label htmlFor="eq-description">Description</label>
            <textarea
              id="eq-description"
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          <div className="field">
            <label htmlFor="eq-image">URL de l&rsquo;image</label>
            <input
              id="eq-image"
              type="text"
              value={form.image_url}
              onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
              placeholder="https://…"
            />
          </div>

          {formErrors.form && <p className="field-error">{formErrors.form}</p>}

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={closeModal} disabled={saving}>
              Annuler
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Enregistrement…" : editing ? "Enregistrer" : "Créer"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}