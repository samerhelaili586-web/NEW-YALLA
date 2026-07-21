import { useEffect, useState } from "react";
import { api } from "../../api/client";
import AppShell from "../../components/AppShell";
import Modal from "../../components/Modal";
import { GlowingEffect } from "../../components/GlowingEffect";
import "../../styles/shared.css";
import "./LeaveApproval.css";

function fmtDate(d) {
  return new Date(d).toLocaleDateString("fr-FR");
}

const STATUS_LABELS = {
  pending: "En attente",
  approved: "Approuvé",
  rejected: "Refusé",
  auto_rejected: "Auto-refusé",
};

function exportCSV(requests, userNames) {
  const rows = [
    ["Collaborateur", "Debut", "Fin", "Motif", "Statut", "Soumise le"],
    ...requests.map((r) => [
      r.user_name || userNames[r.user_id] || "",
      r.start_date,
      r.end_date,
      r.reason || "",
      STATUS_LABELS[r.status] || r.status,
      r.submitted_at ? fmtDate(r.submitted_at) : "",
    ]),
  ];
  const csv = rows.map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `conges_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function LeaveApproval() {
  const [requests, setRequests] = useState([]);
  const [allRequests, setAllRequests] = useState([]);
  const [absences, setAbsences] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [userNames, setUserNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actingId, setActingId] = useState(null);
  const [activeTab, setActiveTab] = useState("pending");

  const [holidayOpen, setHolidayOpen] = useState(false);
  const [holidayForm, setHolidayForm] = useState({ date: "", label: "" });
  const [holidayError, setHolidayError] = useState("");
  const [savingHoliday, setSavingHoliday] = useState(false);

  async function loadAll() {
    setLoading(true);
    setLoadError("");
    try {
      const [reqData, sickData, directory, holidayData] = await Promise.all([
        api.get("/leave/requests"),
        api.get("/leave/sick-absences"),
        api.get("/users/directory"),
        api.get("/leave/holidays"),
      ]);
      setAllRequests(reqData);
      setRequests(reqData.filter((r) => r.status === "pending"));
      setAbsences(sickData.filter((s) => s.justification_status === "pending" && s.certificate_url));
      setHolidays(holidayData);
      const names = {};
      directory.forEach((u) => { names[u.id] = `${u.first_name} ${u.last_name}`; });
      setUserNames(names);
    } catch {
      setLoadError("Impossible de charger les donnees.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => { if (!cancelled) await loadAll(); })();
    return () => { cancelled = true; };
  }, []);

  async function decideLeave(id, decision) {
    setActingId(id);
    try {
      await api.post(`/leave/requests/${id}/${decision}`);
      await loadAll();
    } catch {
      setLoadError("Impossible de traiter cette demande.");
    } finally {
      setActingId(null);
    }
  }

  async function decideCertificate(id, decision) {
    setActingId(id);
    try {
      await api.post(`/leave/sick-absences/${id}/justify`, { justification_status: decision });
      await loadAll();
    } catch {
      setLoadError("Impossible de traiter ce justificatif.");
    } finally {
      setActingId(null);
    }
  }

  async function handleAddHoliday(e) {
    e.preventDefault();
    if (!holidayForm.date || !holidayForm.label.trim()) {
      setHolidayError("Veuillez remplir tous les champs.");
      return;
    }
    setSavingHoliday(true);
    setHolidayError("");
    try {
      await api.post("/leave/holidays", { date: holidayForm.date, label: holidayForm.label.trim() });
      setHolidayOpen(false);
      setHolidayForm({ date: "", label: "" });
      await loadAll();
    } catch (err) {
      if (err.data?.error === "holiday_already_exists") {
        setHolidayError("Un jour ferie existe deja a cette date.");
      } else {
        setHolidayError("Impossible d ajouter ce jour ferie.");
      }
    } finally {
      setSavingHoliday(false);
    }
  }

  const TABS = [
    { key: "pending", label: `En attente (${requests.length})` },
    { key: "history", label: "Historique" },
    { key: "certificates", label: `Justificatifs (${absences.length})` },
    { key: "holidays", label: "Jours feries" },
  ];

  return (
    <AppShell>
      <div className="apr-header">
        <div>
          <h1>Approbation des conges</h1>
          <p className="apr-subtitle">Demandes de conge, justificatifs medicaux et jours feries.</p>
        </div>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => exportCSV(allRequests, userNames)}
          title="Exporter toutes les demandes en CSV"
        >
          Exporter CSV
        </button>
      </div>

      <div className="task-tabs" style={{ marginBottom: "1.5rem" }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`task-tab${activeTab === t.key ? " task-tab--active" : ""}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && <p className="apr-status">Chargement...</p>}
      {loadError && <p className="apr-status apr-status--error">{loadError}</p>}

      {!loading && !loadError && (
        <>
          {activeTab === "pending" && (
            <section className="apr-section">
              <h2>Demandes de conge en attente</h2>
              {requests.length === 0 ? (
                <p className="apr-status">Aucune demande en attente.</p>
              ) : (
                <ul className="apr-list">
                  {requests.map((r) => (
                    <li key={r.id} className="apr-card">
                      <GlowingEffect spread={40} glow={true} disabled={false} proximity={64} inactiveZone={0.01} />
                      <div>
                        <p className="apr-card-name">{r.user_name || userNames[r.user_id]}</p>
                        <p className="apr-card-meta">
                          {fmtDate(r.start_date)} - {fmtDate(r.end_date)}
                          {r.reason && ` : ${r.reason}`}
                        </p>
                        <p className="apr-card-submitted">Soumise le {fmtDate(r.submitted_at)}</p>
                      </div>
                      <div className="apr-card-actions">
                        <button type="button" className="btn-secondary" disabled={actingId === r.id} onClick={() => decideLeave(r.id, "reject")}>
                          Refuser
                        </button>
                        <button type="button" className="btn-primary btn-primary--compact" disabled={actingId === r.id} onClick={() => decideLeave(r.id, "approve")}>
                          Approuver
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {activeTab === "history" && (
            <section className="apr-section">
              <h2>Historique de toutes les demandes</h2>
              <div style={{ overflowX: "auto" }}>
                <table className="apr-table">
                  <thead>
                    <tr>
                      <th>Collaborateur</th>
                      <th>Debut</th>
                      <th>Fin</th>
                      <th>Motif</th>
                      <th>Statut</th>
                      <th>Soumise le</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allRequests.length === 0 && (
                      <tr><td colSpan={6} className="apr-status">Aucune demande.</td></tr>
                    )}
                    {allRequests.map((r) => (
                      <tr key={r.id}>
                        <td>{r.user_name || userNames[r.user_id] || "-"}</td>
                        <td>{fmtDate(r.start_date)}</td>
                        <td>{fmtDate(r.end_date)}</td>
                        <td>{r.reason || "-"}</td>
                        <td>
                          <span className={`status-chip ${r.status === "approved" ? "is-active" : r.status === "pending" ? "is-inactive" : "is-archived"}`}>
                            {STATUS_LABELS[r.status] || r.status}
                          </span>
                        </td>
                        <td>{r.submitted_at ? fmtDate(r.submitted_at) : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {activeTab === "certificates" && (
            <section className="apr-section">
              <h2>Justificatifs medicaux a valider</h2>
              {absences.length === 0 ? (
                <p className="apr-status">Aucun justificatif en attente.</p>
              ) : (
                <ul className="apr-list">
                  {absences.map((a) => (
                    <li key={a.id} className="apr-card">
                      <GlowingEffect spread={40} glow={true} disabled={false} proximity={64} inactiveZone={0.01} />
                      <div>
                        <p className="apr-card-name">{userNames[a.user_id]}</p>
                        <p className="apr-card-meta">Absence du {fmtDate(a.absence_date)}</p>
                        <a className="apr-card-cert" href={a.certificate_url} target="_blank" rel="noreferrer">
                          Voir le certificat
                        </a>
                      </div>
                      <div className="apr-card-actions">
                        <button type="button" className="btn-secondary" disabled={actingId === a.id} onClick={() => decideCertificate(a.id, "unjustified")}>
                          Non justifiee
                        </button>
                        <button type="button" className="btn-primary btn-primary--compact" disabled={actingId === a.id} onClick={() => decideCertificate(a.id, "justified")}>
                          Justifiee
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {activeTab === "holidays" && (
            <section className="apr-section">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
                <h2 style={{ margin: 0 }}>Jours feries</h2>
                <button type="button" className="btn-primary" onClick={() => { setHolidayOpen(true); setHolidayError(""); setHolidayForm({ date: "", label: "" }); }}>
                  + Ajouter un jour ferie
                </button>
              </div>
              {holidays.length === 0 ? (
                <p className="apr-status">Aucun jour ferie defini.</p>
              ) : (
                <ul className="apr-list">
                  {holidays.map((h) => (
                    <li key={h.id} className="apr-card" style={{ justifyContent: "space-between" }}>
                      <GlowingEffect spread={40} glow={true} disabled={false} proximity={64} inactiveZone={0.01} />
                      <div>
                        <p className="apr-card-name">{h.label}</p>
                        <p className="apr-card-meta">{fmtDate(h.date)}</p>
                      </div>
                      <span className="status-chip is-active">Ferie</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}

      <Modal open={holidayOpen} onClose={() => setHolidayOpen(false)} title="Ajouter un jour ferie" width={400}>
        <form onSubmit={handleAddHoliday}>
          <div className="field">
            <label htmlFor="hol-label">Libelle</label>
            <input id="hol-label" type="text" placeholder="ex: Fete nationale" value={holidayForm.label} onChange={(e) => setHolidayForm((f) => ({ ...f, label: e.target.value }))} />
          </div>
          <div className="field">
            <label htmlFor="hol-date">Date</label>
            <input id="hol-date" type="date" value={holidayForm.date} onChange={(e) => setHolidayForm((f) => ({ ...f, date: e.target.value }))} />
          </div>
          {holidayError && <p className="field-error">{holidayError}</p>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1.25rem" }}>
            <button type="button" className="btn-secondary" onClick={() => setHolidayOpen(false)}>Annuler</button>
            <button type="submit" className="btn-primary" disabled={savingHoliday}>{savingHoliday ? "Enregistrement..." : "Ajouter"}</button>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}
