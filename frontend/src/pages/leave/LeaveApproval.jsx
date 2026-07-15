import { useEffect, useState } from "react";
import { api } from "../../api/client";
import AppShell from "../../components/AppShell";
import "../../styles/shared.css";
import "./LeaveApproval.css";

function fmtDate(d) {
  return new Date(d).toLocaleDateString("fr-FR");
}

export default function LeaveApproval() {
  const [requests, setRequests] = useState([]);
  const [absences, setAbsences] = useState([]);
  const [userNames, setUserNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actingId, setActingId] = useState(null);

  async function loadAll() {
    setLoading(true);
    setLoadError("");
    try {
      const [reqData, sickData, directory] = await Promise.all([
        api.get("/leave/requests"),
        api.get("/leave/sick-absences"),
        api.get("/users/directory"),
      ]);
      setRequests(reqData.filter((r) => r.status === "pending"));
      setAbsences(
        sickData.filter((s) => s.justification_status === "pending" && s.certificate_url)
      );
      const names = {};
      directory.forEach((u) => {
        names[u.id] = `${u.first_name} ${u.last_name}`;
      });
      setUserNames(names);
    } catch {
      setLoadError("Impossible de charger les demandes en attente.");
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

  return (
    <AppShell>
      <div className="apr-header">
        <h1>Approbation des congés</h1>
        <p className="apr-subtitle">Demandes de congé et justificatifs médicaux en attente.</p>
      </div>

      {loading && <p className="apr-status">Chargement…</p>}
      {loadError && <p className="apr-status apr-status--error">{loadError}</p>}

      {!loading && !loadError && (
        <>
          <section className="apr-section">
            <h2>Demandes de congé en attente</h2>
            {requests.length === 0 ? (
              <p className="apr-status">Aucune demande en attente.</p>
            ) : (
              <ul className="apr-list">
                {requests.map((r) => (
                  <li key={r.id} className="apr-card">
                    <div>
                      <p className="apr-card-name">{r.user_name || userNames[r.user_id]}</p>
                      <p className="apr-card-meta">
                        {fmtDate(r.start_date)} → {fmtDate(r.end_date)}
                        {r.reason && ` · ${r.reason}`}
                      </p>
                      <p className="apr-card-submitted">Soumise le {fmtDate(r.submitted_at)}</p>
                    </div>
                    <div className="apr-card-actions">
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={actingId === r.id}
                        onClick={() => decideLeave(r.id, "reject")}
                      >
                        Refuser
                      </button>
                      <button
                        type="button"
                        className="btn-primary btn-primary--compact"
                        disabled={actingId === r.id}
                        onClick={() => decideLeave(r.id, "approve")}
                      >
                        Approuver
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="apr-section">
            <h2>Justificatifs médicaux à valider</h2>
            {absences.length === 0 ? (
              <p className="apr-status">Aucun justificatif en attente.</p>
            ) : (
              <ul className="apr-list">
                {absences.map((a) => (
                  <li key={a.id} className="apr-card">
                    <div>
                      <p className="apr-card-name">{userNames[a.user_id]}</p>
                      <p className="apr-card-meta">Absence du {fmtDate(a.absence_date)}</p>
                      <a
                        className="apr-card-cert"
                        href={a.certificate_url}
                        target="_blank"
                        rel="noreferrer"
                        >
                        Voir le certificat
                      </a>
                    </div>
                    <div className="apr-card-actions">
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={actingId === a.id}
                        onClick={() => decideCertificate(a.id, "unjustified")}
                      >
                        Non justifiée
                      </button>
                      <button
                        type="button"
                        className="btn-primary btn-primary--compact"
                        disabled={actingId === a.id}
                        onClick={() => decideCertificate(a.id, "justified")}
                      >
                        Justifiée
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </AppShell>
  );
}