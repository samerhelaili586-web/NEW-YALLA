import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import AppShell from "../../components/AppShell";
import Modal from "../../components/Modal";
import { GlowingEffect } from "../../components/GlowingEffect";
import "../../styles/shared.css";
import "./ShootingCalendar.css";

const WEEKDAY_SHORT = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function startOfWeek(date) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonthGrid(date) {
  const d = new Date(date);
  d.setDate(1); // 1st of month
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day); // back to previous Monday
  d.setHours(0, 0, 0, 0);
  return d;
}

function getMonthDays(currentDate) {
  const d = new Date(currentDate);
  d.setDate(1);
  
  const start = startOfMonthGrid(currentDate);
  const days = [];
  let curr = new Date(start);
  
  // Render exactly 42 days (6 weeks) to maintain a consistent grid size
  for (let i = 0; i < 42; i++) {
    days.push(new Date(curr));
    curr.setDate(curr.getDate() + 1);
  }
  return days;
}

function getWeekDays(currentDate) {
  const start = startOfWeek(currentDate);
  const days = [];
  let curr = new Date(start);
  for (let i = 0; i < 7; i++) {
    days.push(new Date(curr));
    curr.setDate(curr.getDate() + 1);
  }
  return days;
}

function addMonths(date, n) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

function fmtMonth(d) {
  return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function toLocalInputValue(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function ShootingCalendar() {
  const { user } = useAuth();
  const isChefProd = user?.is_chef_prod;

  const [viewMode, setViewMode] = useState("month");
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [shoots, setShoots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [equipmentList, setEquipmentList] = useState([]);
  const [prodUsers, setProdUsers] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedShoot, setSelectedShoot] = useState(null);
  const [shootForm, setShootForm] = useState({
    equipment_id: "", prod_user_ids: [], start_at: "", end_at: "",
  });
  const [savingShoot, setSavingShoot] = useState(false);
  const [shootError, setShootError] = useState("");
  const [conflicts, setConflicts] = useState(null);

  const days = useMemo(() => {
    return viewMode === "month" ? getMonthDays(currentDate) : getWeekDays(currentDate);
  }, [currentDate, viewMode]);
  
  const rangeStart = days[0];
  const rangeEnd = days[days.length - 1];

  async function loadShoots() {
    setLoading(true);
    setLoadError("");
    try {
      const data = await api.get("/planification/calendar", {
        start: rangeStart.toISOString(),
        end: new Date(rangeEnd.getTime() + 86400000).toISOString(),
      });
      setShoots(data);
    } catch {
      setLoadError("Impossible de charger le calendrier des shootings.");
    } finally {
      setLoading(false);
    }
  }

  async function loadFormData() {
    if (!isChefProd) return;
    try {
      const [equipmentData, usersData] = await Promise.all([
        api.get("/equipment"),
        api.get("/users/directory"),
      ]);
      setEquipmentList(equipmentData.filter((e) => e.is_active));
      setProdUsers(usersData.filter((u) => u.role === "prod"));
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fetch on mount
    loadFormData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isChefProd]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fetch on mount/param change
    loadShoots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate, viewMode]);

  const shootsByDay = useMemo(() => {
    const map = {};
    for (const day of days) {
      map[day.toDateString()] = [];
    }
    for (const shoot of shoots) {
      const shootDay = new Date(shoot.start_at);
      shootDay.setHours(0, 0, 0, 0);
      const key = shootDay.toDateString();
      if (map[key]) map[key].push(shoot);
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => new Date(a.start_at) - new Date(b.start_at));
    }
    return map;
  }, [shoots, days]);

  function goToPrevious() {
    if (viewMode === "month") setCurrentDate((m) => addMonths(m, -1));
    else {
      setCurrentDate(d => {
        const next = new Date(d);
        next.setDate(next.getDate() - 7);
        return next;
      });
    }
  }
  function goToNext() {
    if (viewMode === "month") setCurrentDate((m) => addMonths(m, 1));
    else {
      setCurrentDate(d => {
        const next = new Date(d);
        next.setDate(next.getDate() + 7);
        return next;
      });
    }
  }
  function goToToday() {
    setCurrentDate(new Date());
  }

  function openEditModal(shoot) {
    if (!isChefProd) return;
    setSelectedShoot(shoot);
    setShootError("");
    setConflicts(null);
    setShootForm({
      equipment_id: String(shoot.equipment_id),
      prod_user_ids: shoot.crew || [],
      start_at: toLocalInputValue(new Date(shoot.start_at)),
      end_at: toLocalInputValue(new Date(shoot.end_at)),
    });
    setModalOpen(true);
  }

  function closeEditModal() {
    setModalOpen(false);
    setSelectedShoot(null);
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
        task_id: selectedShoot.task_id,
        equipment_id: Number(shootForm.equipment_id),
        prod_user_ids: shootForm.prod_user_ids,
        start_at: shootForm.start_at,
        end_at: shootForm.end_at,
      });
      closeEditModal();
      await loadShoots();
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

  function renderConflicts() {
    if (!conflicts || !conflicts.conflicts) return null;

    if (conflicts.error === "equipment_conflict") {
      return (
        <div className="sc-conflict-section">
          <h5>Conflits de réservation d'équipement:</h5>
          <ul className="sc-conflict-list">
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
        <div className="sc-conflict-section">
          <h5>Conflits de disponibilité de l'équipe:</h5>
          <ul className="sc-conflict-list">
            {Object.entries(conflicts.conflicts).map(([userId, userConflicts]) => {
              const u = prodUsers.find((user) => user.id === Number(userId));
              const name = u ? `${u.first_name} ${u.last_name}` : `Utilisateur #${userId}`;
              return (
                <li key={userId}>
                  <strong>{name}</strong>:
                  <ul style={{ margin: "0.2rem 0 0.5rem 1rem", padding: 0, listStyle: "circle" }}>
                    {userConflicts.map((uc, index) => {
                      if (uc.type === "shoot") return <li key={index}>Déjà affecté à un autre tournage (Shoot #{uc.shoot_id})</li>;
                      if (uc.type === "leave") return <li key={index}>En congé approuvé</li>;
                      if (uc.type === "sick_absence") return <li key={index}>En absence maladie déclarée</li>;
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

  const todayKey = new Date().toDateString();
  const targetMonthIndex = currentDate.getMonth();

  return (
    <AppShell>
      <div className={`sc-page${viewMode === "week" ? " is-week-view" : ""}`}>
        <div className="sc-header">
          <div>
            <h1>Calendrier de shooting</h1>
            <p className="sc-subtitle">
              {viewMode === "month" 
                ? fmtMonth(currentDate)
                : `Semaine du ${rangeStart.toLocaleDateString("fr-FR", {day:"numeric", month:"short"})} au ${rangeEnd.toLocaleDateString("fr-FR", {day:"numeric", month:"short"})}`}
            </p>
          </div>
          <div className="sc-nav">
            <button type="button" className="btn-secondary" onClick={() => setViewMode(v => v === "month" ? "week" : "month")}>
              {viewMode === "month" ? "Vue Semaine" : "Vue Mois"}
            </button>
            <div style={{ width: "1px", background: "var(--line)", margin: "0 0.25rem" }}></div>
            <button type="button" className="btn-secondary" onClick={goToPrevious}>
              ← Précédent
            </button>
            <button type="button" className="btn-secondary" onClick={goToToday}>
              Aujourd&rsquo;hui
            </button>
            <button type="button" className="btn-secondary" onClick={goToNext}>
              Suivant →
            </button>
          </div>
        </div>

        {loadError && <p className="tt-status tt-status--error">{loadError}</p>}
        {loading && <p className="tt-status">Chargement…</p>}

        {!loading && (
          <>
            <div className="sc-grid-header">
              {WEEKDAY_SHORT.map(wd => (
                <div key={wd} className="sc-grid-header-day">{wd}</div>
              ))}
            </div>
            <div className="sc-grid">
              {days.map((day) => {
                const key = day.toDateString();
                const dayShoots = shootsByDay[key] || [];
                const isOutsideMonth = day.getMonth() !== targetMonthIndex;
                const isToday = key === todayKey;

                return (
                  <div key={key} className={`sc-day${isToday ? " is-today" : ""}${isOutsideMonth ? " is-outside-month" : ""}`}>
                    <div className="sc-day-header">
                      <span className="sc-day-date">{day.getDate()}</span>
                    </div>
                    <div className="sc-day-body">
                      {dayShoots.map((shoot) => (
                        <div 
                          key={shoot.id} 
                          className={`sc-shoot-card ${isChefProd ? "sc-shoot-card--clickable" : ""}`} 
                          title={`${shoot.equipment_name} - ${shoot.crew.length} membre(s)`}
                          onClick={() => openEditModal(shoot)}
                        >
                          {viewMode === "week" && <GlowingEffect spread={40} glow={true} disabled={false} proximity={64} inactiveZone={0.01} borderWidth={1} />}
                          <span className="sc-shoot-time">
                            {fmtTime(shoot.start_at)} – {fmtTime(shoot.end_at)}
                          </span>
                          <span className="sc-shoot-equipment">{shoot.equipment_name}</span>
                          {viewMode === "week" && <span className="sc-shoot-crew">{shoot.crew.length} membre(s)</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* List View for Week Mode */}
            {viewMode === "week" && (
              <div className="sc-list-view">
                <div className="sc-list-header">
                  <h3>Détails de la semaine</h3>
                </div>
                {shoots.length === 0 ? (
                  <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
                    Aucun shooting prévu cette semaine.
                  </div>
                ) : (
                  <table className="sc-list-table">
                    <thead>
                      <tr>
                        <th>Date et Heure</th>
                        <th>Projet / Tâche</th>
                        <th>Matériel</th>
                        <th>Équipe Assignée</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shoots.map(shoot => {
                        const sDate = new Date(shoot.start_at);
                        const dateStr = sDate.toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "short" });
                        return (
                          <tr key={shoot.id}>
                            <td style={{ whiteSpace: "nowrap" }}>
                              <div style={{ fontWeight: 600 }}>{dateStr}</div>
                              <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                                {fmtTime(shoot.start_at)} – {fmtTime(shoot.end_at)}
                              </div>
                            </td>
                            <td>
                              <div style={{ fontWeight: 600 }}>{shoot.project_name || "Projet inconnu"}</div>
                              <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>{shoot.task_title || "Tâche inconnue"}</div>
                            </td>
                            <td style={{ color: "var(--amber)" }}>{shoot.equipment_name}</td>
                            <td>
                              <div className="sc-list-crew-tags">
                                {shoot.crew_names && shoot.crew_names.length > 0 ? (
                                  shoot.crew_names.map((name, i) => (
                                    <span key={i} className="sc-list-crew-tag">{name}</span>
                                  ))
                                ) : (
                                  <span className="sc-list-crew-tag" style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-muted)", borderColor: "var(--line)" }}>
                                    Non assigné
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={closeEditModal}
        title="Modifier la planification"
        width={560}
      >
        <form onSubmit={handleSubmitShoot}>
          <div className="field">
            <label htmlFor="sc-equipment">Équipement</label>
            <select
              id="sc-equipment"
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
              <label htmlFor="sc-start">Début</label>
              <input
                id="sc-start"
                type="datetime-local"
                value={shootForm.start_at}
                onChange={(e) => setShootForm((f) => ({ ...f, start_at: e.target.value }))}
              />
            </div>
            <div className="field">
              <label htmlFor="sc-end">Fin</label>
              <input
                id="sc-end"
                type="datetime-local"
                value={shootForm.end_at}
                onChange={(e) => setShootForm((f) => ({ ...f, end_at: e.target.value }))}
              />
            </div>
          </div>

          <div className="field">
            <label>Équipe Prod</label>
            <div className="sc-role-chips">
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

          {shootError && <p className="field-error">{shootError}</p>}
          {renderConflicts()}

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={closeEditModal} disabled={savingShoot}>
              Annuler
            </button>
            <button type="submit" className="btn-primary" disabled={savingShoot}>
              {savingShoot ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}