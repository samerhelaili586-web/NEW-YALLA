import { useState, useEffect, useCallback } from "react";
import { api } from "../../api/client";
import "./Monitoring.css";

export default function AdminMonitoring() {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({
    total_errors: 0,
    critical_500_errors: 0,
    today_errors: 0,
    backend_errors: 0,
    frontend_errors: 0,
  });
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLog, setSelectedLog] = useState(null);

  const fetchMonitoringData = useCallback(async () => {
    setLoading(true);
    try {
      const [logsData, statsData] = await Promise.all([
        api.get("/monitoring/logs", {
          source: sourceFilter || undefined,
          status_code: statusFilter || undefined,
          q: searchQuery.trim() || undefined,
        }),
        api.get("/monitoring/stats"),
      ]);
      setLogs(logsData || []);
      setStats(statsData || {});
    } catch (err) {
      console.error("Failed to load monitoring data:", err);
    } finally {
      setLoading(false);
    }
  }, [sourceFilter, statusFilter, searchQuery]);

  useEffect(() => {
    fetchMonitoringData();
    const interval = setInterval(fetchMonitoringData, 15000); // Auto refresh every 15s
    return () => clearInterval(interval);
  }, [fetchMonitoringData]);

  const handleClearLogs = async () => {
    if (!window.confirm("Voulez-vous vraiment effacer tout l'historique des erreurs système ?")) return;
    try {
      await api.delete("/monitoring/logs");
      fetchMonitoringData();
    } catch (err) {
      alert("Erreur lors de la suppression des logs.");
    }
  };

  const getStatusBadgeClass = (statusCode) => {
    if (statusCode >= 500) return "mon-badge-danger";
    if (statusCode >= 400) return "mon-badge-warning";
    return "mon-badge-info";
  };

  return (
    <div className="mon-container">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="mon-header">
        <div>
          <h1 className="mon-title">📊 Monitoring Technique & Logs système</h1>
          <p className="mon-subtitle">
            Surveillance en temps réel de toutes les erreurs serveur et client déclenchées par les utilisateurs.
          </p>
        </div>
        <div className="mon-header-actions">
          <button className="btn-secondary" onClick={fetchMonitoringData} disabled={loading}>
            {loading ? "Chargement..." : "🔄 Rafraîchir"}
          </button>
          <button className="btn-danger" onClick={handleClearLogs} disabled={logs.length === 0}>
            🗑️ Effacer les logs
          </button>
        </div>
      </div>

      {/* ── KPI Stat Cards ────────────────────────────────────────────────── */}
      <div className="mon-stats-grid">
        <div className="mon-card">
          <div className="mon-card-icon mon-card-icon--red">🚨</div>
          <div>
            <div className="mon-card-value">{stats.total_errors ?? 0}</div>
            <div className="mon-card-label">Total Erreurs Capturées</div>
          </div>
        </div>

        <div className="mon-card">
          <div className="mon-card-icon mon-card-icon--critical">💥</div>
          <div>
            <div className="mon-card-value">{stats.critical_500_errors ?? 0}</div>
            <div className="mon-card-label">Erreurs Critiques (500)</div>
          </div>
        </div>

        <div className="mon-card">
          <div className="mon-card-icon mon-card-icon--amber">📅</div>
          <div>
            <div className="mon-card-value">{stats.today_errors ?? 0}</div>
            <div className="mon-card-label">Erreurs Aujourd'hui</div>
          </div>
        </div>

        <div className="mon-card">
          <div className="mon-card-icon mon-card-icon--blue">⚙️</div>
          <div>
            <div className="mon-card-value">
              {stats.backend_errors ?? 0} <span style={{ fontSize: "0.85rem", opacity: 0.7 }}>Server</span> / {stats.frontend_errors ?? 0} <span style={{ fontSize: "0.85rem", opacity: 0.7 }}>Client</span>
            </div>
            <div className="mon-card-label">Répartition Backend / Frontend</div>
          </div>
        </div>
      </div>

      {/* ── Filters & Search ──────────────────────────────────────────────── */}
      <div className="mon-filter-bar">
        <div className="mon-search-field">
          <span className="mon-search-icon">🔍</span>
          <input
            type="text"
            className="mon-input"
            placeholder="Rechercher par message, URL ou utilisateur..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <select
          className="mon-select"
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
        >
          <option value="">Tous les types (Source)</option>
          <option value="backend">⚙️ Backend (Flask Server)</option>
          <option value="frontend">💻 Frontend (Client JS)</option>
        </select>

        <select
          className="mon-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Tous les codes HTTP</option>
          <option value="500">500 (Erreur Serveur)</option>
          <option value="404">404 (Introuvable)</option>
          <option value="409">409 (Conflit)</option>
          <option value="400">400 (Bad Request)</option>
        </select>
      </div>

      {/* ── Logs Table ────────────────────────────────────────────────────── */}
      <div className="mon-table-wrap">
        {loading && logs.length === 0 ? (
          <div className="mon-empty-state">Chargement du journal d'erreurs...</div>
        ) : logs.length === 0 ? (
          <div className="mon-empty-state">
            🎉 Aucune erreur technique détectée ! Le système fonctionne parfaitement.
          </div>
        ) : (
          <table className="mon-table">
            <thead>
              <tr>
                <th>Horodatage</th>
                <th>Status</th>
                <th>Source</th>
                <th>Utilisateur</th>
                <th>URL / Route</th>
                <th>Message d'erreur</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="mon-cell-time">
                    {log.timestamp ? new Date(log.timestamp).toLocaleString("fr-FR") : "N/A"}
                  </td>
                  <td>
                    <span className={`mon-badge ${getStatusBadgeClass(log.status_code)}`}>
                      {log.status_code}
                    </span>
                  </td>
                  <td>
                    <span className={`mon-source-tag mon-source-tag--${log.source}`}>
                      {log.source === "backend" ? "⚙️ Backend" : "💻 Client"}
                    </span>
                  </td>
                  <td>
                    <div className="mon-user-info">
                      <div className="mon-user-email">{log.user_email || "Anonyme"}</div>
                      <div className="mon-user-role">{log.user_role || "Public"}</div>
                    </div>
                  </td>
                  <td className="mon-cell-endpoint">
                    <span className="mon-method-tag">{log.method}</span> {log.endpoint}
                  </td>
                  <td className="mon-cell-message">{log.error_message}</td>
                  <td>
                    <button
                      className="btn-ghost-sm"
                      onClick={() => setSelectedLog(log)}
                      title="Voir les détails et stacktrace"
                    >
                      🔍 Stacktrace
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Stacktrace Detail Modal ───────────────────────────────────────── */}
      {selectedLog && (
        <div className="mon-modal-backdrop" onClick={() => setSelectedLog(null)}>
          <div className="mon-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mon-modal-header">
              <h3>Détails techniques de l'erreur #{selectedLog.id}</h3>
              <button className="btn-ghost-sm" onClick={() => setSelectedLog(null)} style={{ fontSize: "1.2rem", color: "var(--text-muted)", background: "transparent", border: "none", cursor: "pointer" }}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="mon-detail-grid">
                <div>
                  <strong>Horodatage:</strong>{" "}
                  {selectedLog.timestamp
                    ? new Date(selectedLog.timestamp).toLocaleString("fr-FR")
                    : "N/A"}
                </div>
                <div>
                  <strong>Code HTTP:</strong> {selectedLog.status_code}
                </div>
                <div>
                  <strong>Source:</strong> {selectedLog.source}
                </div>
                <div>
                  <strong>Utilisateur:</strong> {selectedLog.user_email} ({selectedLog.user_role})
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <strong>Endpoint / Page:</strong> [{selectedLog.method}] {selectedLog.endpoint}
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <strong>Message:</strong>
                  <div className="mon-msg-box">{selectedLog.error_message}</div>
                </div>
              </div>

              <div style={{ marginTop: "1rem" }}>
                <strong>Stacktrace Technique:</strong>
                <pre className="mon-stacktrace-box">
                  {selectedLog.stack_trace || "Aucune trace de pile disponible."}
                </pre>
              </div>
            </div>
            <div className="mon-modal-footer" style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "0.75rem", marginTop: "1rem", display: "flex", justifyContent: "flex-end" }}>
              <button className="btn-secondary" onClick={() => setSelectedLog(null)}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
