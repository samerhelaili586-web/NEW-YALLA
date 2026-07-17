import { useEffect, useState } from "react";
import { api } from "../../api/client";
import Modal from "../../components/Modal";
import "../../styles/shared.css";

export default function AdminHolidays() {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ date: "", label: "" });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    loadHolidays();
  }, []);

  async function loadHolidays() {
    try {
      const data = await api.get("/leave/holidays");
      setHolidays(data);
    } catch {
      setError("Impossible de charger les jours fériés.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.date || !form.label.trim()) {
      setFormError("Veuillez remplir tous les champs.");
      return;
    }
    setSubmitting(true);
    setFormError("");
    try {
      await api.post("/leave/holidays", { date: form.date, label: form.label.trim() });
      setCreateOpen(false);
      setForm({ date: "", label: "" });
      loadHolidays();
    } catch (err) {
      if (err.data?.error === "holiday_already_exists") {
        setFormError("Un jour férié existe déjà à cette date.");
      } else {
        setFormError("Impossible de créer le jour férié.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h2>Jours Fériés</h2>
          <p className="admin-page-subtitle">Gérez les jours fériés de l'entreprise</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => { setFormError(""); setCreateOpen(true); }}>
          + Ajouter
        </button>
      </div>

      {loading && <p className="tt-status">Chargement…</p>}
      {error && <p className="tt-status tt-status--error">{error}</p>}

      {!loading && !error && (
        <div className="tt-table-wrap">
          <table className="tt-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Libellé</th>
              </tr>
            </thead>
            <tbody>
              {holidays.length === 0 ? (
                <tr>
                  <td colSpan={2} style={{ textAlign: "center", color: "var(--text-muted)", padding: "2rem" }}>
                    Aucun jour férié configuré.
                  </td>
                </tr>
              ) : (
                holidays.map((h) => (
                  <tr key={h.id}>
                    <td style={{ fontWeight: 600 }}>{new Date(h.date).toLocaleDateString("fr-FR")}</td>
                    <td>{h.label}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Ajouter un jour férié"
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setCreateOpen(false)}>Annuler</button>
            <button type="submit" form="holiday-form" className="btn-primary" disabled={submitting}>
              {submitting ? "Ajout…" : "Ajouter"}
            </button>
          </>
        }
      >
        <form id="holiday-form" className="lv-form" onSubmit={handleCreate}>
          <label className="field">
            <span className="field-label">Date</span>
            <input type="date" required value={form.date} onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))} />
          </label>
          <label className="field">
            <span className="field-label">Libellé</span>
            <input type="text" required value={form.label} onChange={(e) => setForm(f => ({ ...f, label: e.target.value }))} placeholder="Ex: Fête de l'Indépendance" />
          </label>
          {formError && <p className="field-error">{formError}</p>}
        </form>
      </Modal>
    </div>
  );
}
