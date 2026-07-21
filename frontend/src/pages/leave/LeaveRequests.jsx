import { useEffect, useState } from "react";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import AppShell from "../../components/AppShell";
import Modal from "../../components/Modal";
import "../../styles/shared.css";
import "./LeaveRequests.css";

const LEAVE_STATUS_LABELS = {
  pending: { text: "En attente", tone: "inactive" },
  approved: { text: "Approuvé", tone: "active" },
  rejected: { text: "Refusé", tone: "archived" },
  auto_rejected: { text: "Auto-refusé", tone: "archived" },
};

const JUSTIF_LABELS = {
  pending: { text: "En attente", tone: "inactive" },
  justified: { text: "Justifiée", tone: "active" },
  unjustified: { text: "Non justifiée", tone: "archived" },
};

function fmtDate(d) {
  return new Date(d).toLocaleDateString("fr-FR");
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoISO(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export default function LeaveRequests() {
  const { user } = useAuth();

  const [requests, setRequests] = useState([]);
  const [absences, setAbsences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ start_date: "", end_date: "", reason: "" });
  const [leaveError, setLeaveError] = useState("");
  const [submittingLeave, setSubmittingLeave] = useState(false);

  const [sickModalOpen, setSickModalOpen] = useState(false);
  const [sickForm, setSickForm] = useState({ absence_date: todayISO() });
  const [sickError, setSickError] = useState("");
  const [submittingSick, setSubmittingSick] = useState(false);

  const [certUrls, setCertUrls] = useState({});
  const [uploadingCertId, setUploadingCertId] = useState(null);

  async function loadAll() {
    setLoading(true);
    setLoadError("");
    try {
      const [reqData, sickData] = await Promise.all([
        api.get("/leave/requests"),
        api.get("/leave/sick-absences"),
      ]);
      setRequests(reqData.filter((r) => r.user_id === user.id));
      setAbsences(sickData.filter((s) => s.user_id === user.id));
    } catch {
      setLoadError("Impossible de charger vos congés et absences.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cancelled) await loadAll();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadAll always closes over current user.id
  }, [user?.id]);

  async function submitLeave(e) {
    e.preventDefault();
    setLeaveError("");
    if (!leaveForm.start_date || !leaveForm.end_date) {
      setLeaveError("Merci de renseigner les deux dates.");
      return;
    }
    setSubmittingLeave(true);
    try {
      await api.post("/leave/requests", leaveForm);
      setLeaveModalOpen(false);
      setLeaveForm({ start_date: "", end_date: "", reason: "" });
      await loadAll();
    } catch (err) {
      if (err instanceof ApiError && err.data?.error === "end_before_start") {
        setLeaveError("La date de fin doit être après la date de début.");
      } else if (err instanceof ApiError && err.data?.error === "start_date_too_soon") {
        setLeaveError("La demande doit être soumise au moins 6h avant la date de début.");
      } else {
        setLeaveError("Une erreur est survenue. Réessayez.");
      }
    } finally {
      setSubmittingLeave(false);
    }
  }

  async function submitSick(e) {
    e.preventDefault();
    setSickError("");
    setSubmittingSick(true);
    try {
      await api.post("/leave/sick-absences", sickForm);
      setSickModalOpen(false);
      setSickForm({ absence_date: todayISO() });
      await loadAll();
    } catch (err) {
      if (err instanceof ApiError && err.data?.error === "absence_date_out_of_range") {
        setSickError("Une absence maladie ne peut être déclarée que pour aujourd'hui ou les 2 jours précédents.");
      } else {
        setSickError("Une erreur est survenue. Réessayez.");
      }
    } finally {
      setSubmittingSick(false);
    }
  }

  async function submitCertificate(absenceId) {
    const url = certUrls[absenceId];
    if (!url) return;
    setUploadingCertId(absenceId);
    try {
      await api.post(`/leave/sick-absences/${absenceId}/certificate`, { certificate_url: url });
      setCertUrls((prev) => ({ ...prev, [absenceId]: "" }));
      await loadAll();
    } catch {
      setLoadError("Impossible d'envoyer le certificat.");
    } finally {
      setUploadingCertId(null);
    }
  }

  async function cancelRequest(id) {
    try {
      await api.delete(`/leave/requests/${id}`);
      await loadAll();
    } catch {
      setLoadError("Impossible d'annuler cette demande.");
    }
  }

  return (
    <AppShell>
      <div className="lv-header">
        <div>
          <h1>Congés &amp; absences</h1>
          <p className="lv-subtitle">Vos demandes de congé et déclarations d&rsquo;absence maladie.</p>
        </div>
        <div className="lv-header-actions">
          <button type="button" className="btn-secondary" onClick={() => setSickModalOpen(true)}>
            Déclarer une absence
          </button>
          <button
            type="button"
            className="btn-primary btn-primary--compact"
            onClick={() => setLeaveModalOpen(true)}
          >
            + Demander un congé
          </button>
        </div>
      </div>

      {loading && <p className="lv-status">Chargement…</p>}
      {loadError && <p className="lv-status lv-status--error">{loadError}</p>}

      {!loading && !loadError && (
        <>
          <section className="lv-section">
            <h2>Mes demandes de congé</h2>
            {requests.length === 0 ? (
              <p className="lv-status">Aucune demande pour le moment.</p>
            ) : (
              <div className="lv-table-wrap">
                <table className="lv-table">
                  <thead>
                    <tr>
                      <th>Période</th>
                      <th>Motif</th>
                      <th>Soumise le</th>
                      <th>Statut</th>
                      <th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((r) => {
                      const s = LEAVE_STATUS_LABELS[r.status] || { text: r.status, tone: "inactive" };
                      return (
                        <tr key={r.id}>
                          <td>
                            {fmtDate(r.start_date)} → {fmtDate(r.end_date)}
                          </td>
                          <td className="lv-cell-muted">{r.reason || "—"}</td>
                          <td className="lv-cell-muted">{fmtDate(r.submitted_at)}</td>
                          <td>
                            <span className={`status-chip status-chip--${s.tone}`}>{s.text}</span>
                          </td>
                          <td>
                            {r.status === "pending" && (
                              <button
                                type="button"
                                className="link-action"
                                style={{ color: "var(--danger, #e53e3e)", fontSize: "0.8rem" }}
                                onClick={() => cancelRequest(r.id)}
                              >
                                Annuler
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="lv-section">
            <h2>Mes absences maladie</h2>
            {absences.length === 0 ? (
              <p className="lv-status">Aucune absence déclarée.</p>
            ) : (
              <div className="lv-table-wrap">
                <table className="lv-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Justificatif</th>
                      <th>Statut</th>
                      <th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {absences.map((a) => {
                      const s = JUSTIF_LABELS[a.justification_status] || {
                        text: a.justification_status,
                        tone: "inactive",
                      };
                      return (
                        <tr key={a.id}>
                          <td>{fmtDate(a.absence_date)}</td>
                          <td className="lv-cell-muted">
                            {a.certificate_url ? (
                              <a href={a.certificate_url} target="_blank" rel="noreferrer">
                                Voir le certificat
                              </a>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td>
                            <span className={`status-chip status-chip--${s.tone}`}>{s.text}</span>
                          </td>
                          <td>
                            {!a.certificate_url && (
                              <div className="lv-cert-form">
                                <input
                                  type="url"
                                  placeholder="URL du certificat…"
                                  value={certUrls[a.id] || ""}
                                  onChange={(e) =>
                                    setCertUrls((prev) => ({ ...prev, [a.id]: e.target.value }))
                                  }
                                />
                                <button
                                  type="button"
                                  className="link-action"
                                  disabled={!certUrls[a.id] || uploadingCertId === a.id}
                                  onClick={() => submitCertificate(a.id)}
                                >
                                  Envoyer
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {leaveModalOpen && (
        <Modal
          open={leaveModalOpen}
          title="Demander un congé"
          onClose={() => setLeaveModalOpen(false)}
          footer={
            <>
              <button type="button" className="btn-secondary" onClick={() => setLeaveModalOpen(false)}>
                Annuler
              </button>
              <button
                type="submit"
                form="leave-form"
                className="btn-primary btn-primary--compact"
                disabled={submittingLeave}
              >
                {submittingLeave ? "Envoi…" : "Envoyer la demande"}
              </button>
            </>
          }
        >
          <form id="leave-form" className="lv-form" onSubmit={submitLeave} noValidate>
            <div className="lv-form-row">
              <label className="field">
                <span className="field-label">Date de début</span>
                <input
                  type="date"
                  required
                  min={todayISO()}
                  value={leaveForm.start_date}
                  onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value })}
                />
              </label>
              <label className="field">
                <span className="field-label">Date de fin</span>
                <input
                  type="date"
                  required
                  min={leaveForm.start_date || todayISO()}
                  value={leaveForm.end_date}
                  onChange={(e) => setLeaveForm({ ...leaveForm, end_date: e.target.value })}
                />
              </label>
            </div>
            <label className="field">
              <span className="field-label">Motif (optionnel)</span>
              <input
                type="text"
                value={leaveForm.reason}
                onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
              />
            </label>
            {leaveError && (
              <p className="field-error" role="alert">
                {leaveError}
              </p>
            )}
          </form>
        </Modal>
      )}

      {sickModalOpen && (
        <Modal
          open={sickModalOpen}
          title="Déclarer une absence maladie"
          onClose={() => setSickModalOpen(false)}
          footer={
            <>
              <button type="button" className="btn-secondary" onClick={() => setSickModalOpen(false)}>
                Annuler
              </button>
              <button
                type="submit"
                form="sick-form"
                className="btn-primary btn-primary--compact"
                disabled={submittingSick}
              >
                {submittingSick ? "Envoi…" : "Déclarer"}
              </button>
            </>
          }
        >
          <form id="sick-form" className="lv-form" onSubmit={submitSick} noValidate>
            <label className="field">
              <span className="field-label">Date de l&rsquo;absence</span>
              <input
                type="date"
                required
                min={daysAgoISO(2)}
                max={todayISO()}
                value={sickForm.absence_date}
                onChange={(e) => setSickForm({ absence_date: e.target.value })}
              />
              <span className="field-hint">Uniquement aujourd&rsquo;hui ou les 2 jours précédents.</span>
            </label>
            {sickError && (
              <p className="field-error" role="alert">
                {sickError}
              </p>
            )}
          </form>
        </Modal>
      )}
    </AppShell>
  );
}