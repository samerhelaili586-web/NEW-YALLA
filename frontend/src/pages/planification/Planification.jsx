import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../../api/client";
import AppShell from "../../components/AppShell";
import Modal from "../../components/Modal";
import { GlowingEffect } from "../../components/GlowingEffect";
import "../../styles/shared.css";
import "./Planification.css";

function fmtDate(d) {
  return new Date(d).toLocaleDateString("fr-FR");
}

function toLocalInputValue(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function Planification() {
  const [pending, setPending] = useState([]);
  const [equipmentList, setEquipmentList] = useState([]);
  const [prodUsers, setProdUsers] = useState([]);
  const [inviteUsers, setInviteUsers] = useState([]);
  const [scheduledShoots, setScheduledShoots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [selectedTask, setSelectedTask] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  // shooting form
  const [shootForm, setShootForm] = useState({
    equipment_id: "", prod_user_ids: [], invited_user_ids: [], start_at: "", end_at: "",
  });
  const [savingShoot, setSavingShoot] = useState(false);
  const [shootError, setShootError] = useState("");
  const [conflicts, setConflicts] = useState(null);

  // montage form
  const [montageProdId, setMontageProdId] = useState("");
  const [savingMontage, setSavingMontage] = useState(false);
  const [montageError, setMontageError] = useState("");

  async function loadAll() {
    setLoading(true);
    setLoadError("");
    try {
      const [pendingData, equipmentData, usersData, calendarData] = await Promise.all([
        api.get("/planification/pending"),
        api.get("/equipment"),
        api.get("/users/directory"),
        api.get("/planification/calendar"),
      ]);
      setPending(pendingData);
      setEquipmentList(equipmentData.filter((e) => e.is_active));
      setProdUsers(usersData.filter((u) => u.role === "prod"));
      setInviteUsers(usersData.filter((u) => ['cm', 'manager', 'admin_sys'].includes(u.role) || u.is_chef_prod));
      setScheduledShoots(calendarData);
    } catch {
      setLoadError("Impossible de charger la file de planification.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fetch on mount
    loadAll();
  }, []);

  const shootingQueue = useMemo(
    () => pending.filter((t) => t.planning_type === "planification_shooting"),
    [pending]
  );
  const montageQueue = useMemo(
    () => pending.filter((t) => t.planning_type === "planification_montage"),
    [pending]
  );

  function openTask(task) {
    setSelectedTask(task);
    setShootError("");
    setMontageError("");
    setConflicts(null);
    const now = new Date();
    const inTwoHours = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    setShootForm({
      equipment_id: "",
      prod_user_ids: [],
      invited_user_ids: [],
      start_at: toLocalInputValue(now),
      end_at: toLocalInputValue(inTwoHours),
    });
    setMontageProdId("");
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setSelectedTask(null);
  }

  function toggleProdUser(userId) {
    setShootForm((f) => ({
      ...f,
      prod_user_ids: f.prod_user_ids.includes(userId)
        ? f.prod_user_ids.filter((id) => id !== userId)
        : [...f.prod_user_ids, userId],
    }));
  }

  async function handleSubmitShoot(e) {
    e.preventDefault();
    setShootError("");
    setConflicts(null);

    if (!shootForm.equipment_id || shootForm.prod_user_ids.length === 0) {
      setShootError("Sélectionnez un équipement et au moins un membre de l'équipe Prod.");
      return;
    }

    setSavingShoot(true);
    try {
      await api.post("/planification/shoots", {
        task_id: selectedTask.id,
        equipment_id: Number(shootForm.equipment_id),
        prod_user_ids: shootForm.prod_user_ids,
        invited_user_ids: shootForm.invited_user_ids,
        start_at: shootForm.start_at,
        end_at: shootForm.end_at,
      });
      closeModal();
      await loadAll();
    } catch (err) {
      if (err instanceof ApiError && (err.data?.error === "equipment_conflict" || err.data?.error === "user_conflict")) {
        setConflicts(err.data);
        setShootError(
          err.data.error === "equipment_conflict"
            ? "Cet équipement est déjà réservé sur ce créneau."
            : "Un ou plusieurs membres de l'équipe ne sont pas disponibles sur ce créneau."
        );
      } else {
        setShootError("Impossible d'enregistrer cette planification.");
      }
    } finally {
      setSavingShoot(false);
    }
  }

  async function handleSubmitMontage(e) {
    e.preventDefault();
    setMontageError("");
    if (!montageProdId) {
      setMontageError("Sélectionnez un monteur.");
      return;
    }
    setSavingMontage(true);
    try {
      await api.post(`/planification/montage/${selectedTask.id}/assign`, {
        prod_user_id: Number(montageProdId),
      });
      closeModal();
      await loadAll();
    } catch {
      setMontageError("Impossible d'assigner ce monteur.");
    } finally {
      setSavingMontage(false);
    }
  }

  function renderConflicts() {
    if (!conflicts || !conflicts.conflicts) return null;

    if (conflicts.error === "equipment_conflict") {
      return (
        <div className="pf-conflict-section">
          <h5>Conflits de réservation d'équipement:</h5>
          <ul className="pf-conflict-list">
            {conflicts.conflicts.map((c) => (
              <li key={c.id}>
                Réservé sur la tâche <strong>«{c.task_title}»</strong> de{" "}
                {new Date(c.start_at).toLocaleString("fr-FR")} à{" "}
                {new Date(c.end_at).toLocaleString("fr-FR")}
              </li>
            ))}
          </ul>
        </div>
      );
    }

    if (conflicts.error === "user_conflict") {
      return (
        <div className="pf-conflict-section">
          <h5>Conflits de disponibilité de l'équipe:</h5>
          <ul className="pf-conflict-list">
            {Object.entries(conflicts.conflicts).map(([userId, userConflicts]) => {
              const u = prodUsers.find((user) => user.id === Number(userId));
              const name = u ? `${u.first_name} ${u.last_name}` : `Utilisateur #${userId}`;
              return (
                <li key={userId}>
                  <strong>{name}</strong>:
                  <ul style={{ margin: "0.2rem 0 0.5rem 1rem", padding: 0, listStyle: "circle" }}>
                    {userConflicts.map((uc, index) => {
                      if (uc.type === "shoot") {
                        return <li key={index}>Déjà affecté à un autre tournage (Shoot #{uc.shoot_id})</li>;
                      }
                      if (uc.type === "leave") {
                        return <li key={index}>En congé approuvé</li>;
                      }
                      if (uc.type === "sick_absence") {
                        return <li key={index}>En absence maladie déclarée</li>;
                      }
                      return <li key={index}>Indisponible (autre motif)</li>;
                    })}
                  </ul>
                </li>
              );
            })}
          </ul>
        </div>
      );
    }

    return null;
  }

  return (
    <AppShell>
      <div className="pf-page">
        <div className="pf-header">
          <div>
            <h1>Planification</h1>
            <p className="pf-subtitle">Organisez les shootings et le montage en attente.</p>
          </div>
        </div>

        {loadError && <p className="tt-status tt-status--error">{loadError}</p>}
        {loading && <p className="tt-status">Chargement…</p>}

        {!loading && (
          <>
            <div className="pf-columns">
            <section className="pf-column">
              <GlowingEffect spread={60} glow={true} disabled={false} proximity={64} inactiveZone={0.01} borderWidth={2} />
              <h3>Shooting à planifier ({shootingQueue.length})</h3>
              {shootingQueue.length === 0 && <p className="tt-status">Rien en attente.</p>}
              <ul className="pf-queue-list">
                {shootingQueue.map((t) => (
                  <li key={t.id} className="pf-queue-item" onClick={() => openTask(t)}>
                    <span className="pf-queue-title">{t.title}</span>
                    <span className="pf-queue-date">Publication : {fmtDate(t.planned_publish_date)}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="pf-column">
              <GlowingEffect spread={60} glow={true} disabled={false} proximity={64} inactiveZone={0.01} borderWidth={2} />
              <h3>Montage à planifier ({montageQueue.length})</h3>
              {montageQueue.length === 0 && <p className="tt-status">Rien en attente.</p>}
              <ul className="pf-queue-list">
                {montageQueue.map((t) => (
                  <li key={t.id} className="pf-queue-item" onClick={() => openTask(t)}>
                    <span className="pf-queue-title">{t.title}</span>
                    <span className="pf-queue-date">Publication : {fmtDate(t.planned_publish_date)}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {/* Planned shootings schedule */}
          <div style={{ marginTop: "2.5rem", background: "var(--card)", padding: "1.5rem", borderRadius: "12px", border: "1px solid var(--line)" }}>
            <h3 style={{ margin: "0 0 1rem", fontSize: "1.1rem", fontWeight: 600, color: "var(--ink)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              📅 Tournages Planifiés ({scheduledShoots.length})
            </h3>
            {scheduledShoots.length === 0 ? (
              <p className="tt-status" style={{ padding: "0.5rem 0" }}>Aucun tournage planifié pour le moment.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                {scheduledShoots.map((s) => (
                  <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--sidebar-accent)", padding: "0.75rem 1rem", borderRadius: "8px", border: "1px solid var(--line)" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                      <span style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--ink)" }}>{s.task_title}</span>
                      <span style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>
                        Projet : <strong>{s.project_name}</strong> | Équipement : <strong>{s.equipment_name}</strong>
                      </span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.2rem" }}>
                      <span style={{ fontSize: "0.82rem", color: "var(--primary)", fontWeight: 600 }}>
                        ⏱️ {new Date(s.start_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })} - {new Date(s.end_at).toLocaleTimeString("fr-FR", { timeStyle: "short" })}
                      </span>
                      <span style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>
                        Équipe : {s.crew_names.join(", ") || "Aucune"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={selectedTask?.title || "Planification"}
        width={560}
      >
        {selectedTask?.planning_type === "planification_shooting" && (
          <form onSubmit={handleSubmitShoot}>
            <div className="field">
              <label htmlFor="pf-equipment">Équipement</label>
              <select
                id="pf-equipment"
                value={shootForm.equipment_id}
                onChange={(e) => setShootForm((f) => ({ ...f, equipment_id: e.target.value }))}
              >
                <option value="">Sélectionner…</option>
                {equipmentList.map((eq) => (
                  <option key={eq.id} value={eq.id}>{eq.name}</option>
                ))}
              </select>
            </div>

            <div className="field-row">
              <div className="field">
                <label htmlFor="pf-start">Début</label>
                <input
                  id="pf-start"
                  type="datetime-local"
                  value={shootForm.start_at}
                  onChange={(e) => setShootForm((f) => ({ ...f, start_at: e.target.value }))}
                />
              </div>
              <div className="field">
                <label htmlFor="pf-end">Fin</label>
                <input
                  id="pf-end"
                  type="datetime-local"
                  value={shootForm.end_at}
                  onChange={(e) => setShootForm((f) => ({ ...f, end_at: e.target.value }))}
                />
              </div>
            </div>

            <div className="field">
              <label>Équipe Prod</label>
              <div className="pf-role-chips">
                {prodUsers.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    className={`chip-toggle${shootForm.prod_user_ids.includes(u.id) ? " is-selected" : ""}`}
                    onClick={() => toggleProdUser(u.id)}
                  >
                    {u.first_name} {u.last_name}
                  </button>
                ))}
              </div>
            </div>

            {/* Invited users */}
            <div className="field">
              <label>Inviter des participants (optionnel)</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '140px', overflowY: 'auto', border: '1px solid var(--line)', borderRadius: '8px', padding: '0.5rem' }}>
                {inviteUsers.map((u) => (
                  <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.88rem' }}>
                    <input
                      type="checkbox"
                      checked={shootForm.invited_user_ids.includes(u.id)}
                      onChange={(e) => {
                        setShootForm((f) => ({
                          ...f,
                          invited_user_ids: e.target.checked
                            ? [...f.invited_user_ids, u.id]
                            : f.invited_user_ids.filter((id) => id !== u.id),
                        }));
                      }}
                    />
                    {u.first_name} {u.last_name} ({u.role})
                  </label>
                ))}
              </div>
            </div>

            {shootError && <p className="field-error">{shootError}</p>}
            {renderConflicts()}

            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={closeModal} disabled={savingShoot}>
                Annuler
              </button>
              <button type="submit" className="btn-primary" disabled={savingShoot}>
                {savingShoot ? "Enregistrement…" : "Planifier"}
              </button>
            </div>
          </form>
        )}

        {selectedTask?.planning_type === "planification_montage" && (
          <form onSubmit={handleSubmitMontage}>
            <div className="field">
              <label htmlFor="pf-monteur">Monteur (Prod)</label>
              <select
                id="pf-monteur"
                value={montageProdId}
                onChange={(e) => setMontageProdId(e.target.value)}
              >
                <option value="">Sélectionner…</option>
                {prodUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>
                ))}
              </select>
            </div>

            {montageError && <p className="field-error">{montageError}</p>}

            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={closeModal} disabled={savingMontage}>
                Annuler
              </button>
              <button type="submit" className="btn-primary" disabled={savingMontage}>
                {savingMontage ? "Enregistrement…" : "Assigner"}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </AppShell>
  );
}