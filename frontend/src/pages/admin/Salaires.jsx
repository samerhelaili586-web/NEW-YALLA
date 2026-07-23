import { useEffect, useMemo, useState } from "react";
import { api } from "../../api/client";
import AppShell from "../../components/AppShell";
import Avatar from "../../components/Avatar";
import Modal from "../../components/Modal";
import { ROLE_LABELS } from "../../constants";
import "../../styles/shared.css";
import "./Salaires.css";

export default function Salaires() {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${yyyy}-${mm}`;
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summaryData, setSummaryData] = useState(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  // Edit salary modal state
  const [selectedUser, setSelectedUser] = useState(null);
  const [editRate, setEditRate] = useState("25");
  const [editGoal, setEditGoal] = useState("160");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const loadData = async (m) => {
    setLoading(true);
    setError("");
    try {
      const data = await api.get("/users/payroll", { month: m });
      setSummaryData(data);
    } catch (err) {
      setError(err?.data?.error || "Impossible de charger les données de paie.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(month);
  }, [month]);

  const filteredUsers = useMemo(() => {
    if (!summaryData?.users) return [];
    return summaryData.users.filter((u) => {
      const matchRole = roleFilter === "all" || u.role === roleFilter;
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        u.user_name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q);
      return matchRole && matchSearch;
    });
  }, [summaryData, roleFilter, search]);

  const openEditModal = (u) => {
    setSelectedUser(u);
    setEditRate(String(u.hourly_rate));
    setEditGoal(String(u.monthly_hours_goal));
    setEditError("");
  };

  const handleSaveSalary = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;
    setSaving(true);
    setEditError("");
    try {
      await api.patch(`/users/${selectedUser.user_id}/salary`, {
        hourly_rate: parseFloat(editRate),
        monthly_hours_goal: parseInt(editGoal, 10),
      });
      setSelectedUser(null);
      await loadData(month);
    } catch (err) {
      setEditError(err?.data?.error || "Erreur lors de la modification.");
    } finally {
      setSaving(false);
    }
  };

  const summary = summaryData?.summary || {
    total_payroll: 0,
    total_hours_worked: 0,
    total_hours_goal: 0,
    avg_completion_pct: 0,
    active_users_count: 0,
  };

  return (
    <AppShell menuKey="salaires_paie">
      <div className="sal-page">
        {/* Header */}
        <div className="sal-header">
          <div>
            <h1 className="sal-title">Salaires & Paie</h1>
            <p className="sal-subtitle">
              Gestion de la masse salariale, des taux horaires et des objectifs mensuels d'heures.
            </p>
          </div>

          <div className="sal-month-picker">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sal-calendar-icon">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <label htmlFor="sal-month-input">Mois de référence :</label>
            <input
              id="sal-month-input"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="sal-month-select"
            />
          </div>
        </div>

        {error && <div className="sal-error-banner">{error}</div>}

        {/* Executive KPI Cards */}
        <div className="sal-kpi-grid">
          <div className="sal-kpi-card sal-kpi-card--primary">
            <div className="sal-kpi-icon sal-kpi-icon--emerald">💰</div>
            <div className="sal-kpi-content">
              <span className="sal-kpi-label">Masse Salariale Estimée</span>
              <span className="sal-kpi-val sal-val-emerald">
                {summary.total_payroll.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} <small className="sal-kpi-currency">TND</small>
              </span>
              <span className="sal-kpi-sub">Pour {summary.active_users_count} collaborateurs</span>
            </div>
          </div>

          <div className="sal-kpi-card">
            <div className="sal-kpi-icon sal-kpi-icon--indigo">⏱️</div>
            <div className="sal-kpi-content">
              <span className="sal-kpi-label">Heures Effectuées</span>
              <span className="sal-kpi-val">
                {summary.total_hours_worked} <small className="sal-kpi-unit">h</small>
              </span>
              <span className="sal-kpi-sub">sur {summary.total_hours_goal} h prévues</span>
            </div>
          </div>

          <div className="sal-kpi-card">
            <div className="sal-kpi-icon sal-kpi-icon--blue">📈</div>
            <div className="sal-kpi-content">
              <span className="sal-kpi-label">Réalisation Globale</span>
              <span className="sal-kpi-val">{summary.avg_completion_pct} %</span>
              <span className="sal-kpi-sub">Moyenne de l'équipe</span>
            </div>
          </div>

          <div className="sal-kpi-card">
            <div className="sal-kpi-icon sal-kpi-icon--purple">👥</div>
            <div className="sal-kpi-content">
              <span className="sal-kpi-label">Effectif Actif</span>
              <span className="sal-kpi-val">{summary.active_users_count}</span>
              <span className="sal-kpi-sub">Salariés enregistrés</span>
            </div>
          </div>
        </div>

        {/* Toolbar & Filters */}
        <div className="sal-toolbar">
          <div className="sal-search-wrap">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sal-search-icon">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              placeholder="Rechercher un collaborateur..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="sal-search-input"
            />
          </div>

          <div className="sal-filter-chips">
            {[
              { id: "all", label: "Tous" },
              { id: "admin_sys", label: "Admin" },
              { id: "manager", label: "Manager" },
              { id: "cm", label: "CM" },
              { id: "prod", label: "Prod" },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                className={`sal-chip ${roleFilter === f.id ? "sal-chip--active" : ""}`}
                onClick={() => setRoleFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="sal-table-wrap">
          {loading ? (
            <div className="sal-loading">Chargement des salaires...</div>
          ) : (
            <table className="sal-table">
              <thead>
                <tr>
                  <th>Collaborateur</th>
                  <th>Rôle</th>
                  <th style={{ textAlign: "right" }}>Taux</th>
                  <th style={{ textAlign: "right" }}>Objectif</th>
                  <th style={{ textAlign: "right" }}>Base</th>
                  <th style={{ textAlign: "right" }}>Effectué</th>
                  <th style={{ textAlign: "right" }}>Réalisé</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.user_id} className="sal-row">
                    <td>
                      <div className="sal-user-cell">
                        <Avatar name={u.user_name} url={u.photo_url} size={32} />
                        <div className="sal-user-info">
                          <div className="sal-user-name">{u.user_name}</div>
                          <div className="sal-user-email">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`sal-role-badge sal-role-badge--${u.effective_role}`}>
                        {ROLE_LABELS[u.effective_role] || u.effective_role}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <span className="sal-num-val">{u.hourly_rate.toFixed(2)}</span>{" "}
                      <span className="sal-unit">TND/h</span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <span className="sal-num-val">{u.monthly_hours_goal}</span>{" "}
                      <span className="sal-unit">h/mois</span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <span className="sal-num-val sal-base-val">
                        {u.monthly_base_salary.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}
                      </span>{" "}
                      <span className="sal-unit sal-unit--bold">TND</span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <span className={`sal-num-val ${u.hours_worked > 0 ? "sal-num-val--active" : "sal-num-val--zero"}`}>
                        {u.hours_worked}
                      </span>{" "}
                      <span className="sal-unit">h</span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <span className={`sal-salary-val ${u.calculated_pay > 0 ? "sal-salary-val--active" : "sal-salary-val--zero"}`}>
                        {u.calculated_pay.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}
                      </span>{" "}
                      <span className="sal-unit sal-unit--bold">TND</span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        type="button"
                        className="sal-edit-btn"
                        onClick={() => openEditModal(u)}
                        title="Modifier le tarif & l'objectif"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="3"/>
                          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
                        </svg>
                        <span>Modifier</span>
                      </button>
                    </td>
                  </tr>
                ))}

                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={8} className="sal-empty">
                      Aucun collaborateur trouvé.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Modal: Modifier Tarif & Objectif */}
        <Modal
          open={!!selectedUser}
          onClose={() => setSelectedUser(null)}
          title={`Paramètres salariaux — ${selectedUser?.user_name || ""}`}
          width={460}
        >
          {selectedUser && (
            <form onSubmit={handleSaveSalary} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div className="field">
                <label>Tarif horaire (TND / heure)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  required
                  value={editRate}
                  onChange={(e) => setEditRate(e.target.value)}
                  placeholder="25.00"
                />
              </div>

              <div className="field">
                <label>Objectif d'heures mensuel (h / mois)</label>
                <input
                  type="number"
                  min="0"
                  max="400"
                  required
                  value={editGoal}
                  onChange={(e) => setEditGoal(e.target.value)}
                  placeholder="160"
                />
              </div>

              <div className="sal-calc-preview">
                <span>Base mensuelle recalculée :</span>
                <strong>
                  {((parseFloat(editRate) || 0) * (parseInt(editGoal, 10) || 0)).toLocaleString("fr-FR", {
                    minimumFractionDigits: 2,
                  })}{" "}
                  TND
                </strong>
              </div>

              {editError && <p className="field-error">{editError}</p>}

              <div className="form-actions" style={{ marginTop: "0.5rem" }}>
                <button type="button" className="btn-secondary" onClick={() => setSelectedUser(null)}>
                  Annuler
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? "Enregistrement..." : "Enregistrer"}
                </button>
              </div>
            </form>
          )}
        </Modal>
      </div>
    </AppShell>
  );
}
