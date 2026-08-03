import { useState, useEffect, useCallback } from "react";
import { api } from "../../api/client";
import { GlowingEffect } from "../../components/GlowingEffect";
import Avatar from "../../components/Avatar";
import ConfirmModal from "../../components/ConfirmModal";
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
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [copied, setCopied] = useState(false);

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
    setClearing(true);
    try {
      await api.delete("/monitoring/logs");
      setConfirmClearOpen(false);
      fetchMonitoringData();
    } catch (err) {
      console.error("Erreur lors de la suppression des logs:", err);
    } finally {
      setClearing(false);
    }
  };

  const handleCopyStacktrace = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusBadgeClass = (statusCode) => {
    if (statusCode >= 500) return "mon-badge-danger";
    if (statusCode >= 400) return "mon-badge-warning";
    return "mon-badge-info";
  };

  const getMethodBadgeClass = (method) => {
    const m = (method || "GET").toUpperCase();
    if (m === "POST") return "mon-method--post";
    if (m === "DELETE") return "mon-method--delete";
    if (m === "PUT" || m === "PATCH") return "mon-method--put";
    return "mon-method--get";
  };

  return (
    <div className="mon-container">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="mon-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.3rem" }}>
            <h1 className="mon-title">📊 Monitoring Technique & Logs Système</h1>
            <span className="mon-live-pulse" title="Surveillance en temps réel active (auto-rafraîchissement 15s)">
              <span className="mon-pulse-dot" />
              <span>Temps réel</span>
            </span>
          </div>
          <p className="mon-subtitle">
            Surveillance en direct de toutes les erreurs serveur et client déclenchées par les utilisateurs.
          </p>
        </div>
        <div className="mon-header-actions">
          <button className="btn-secondary" onClick={fetchMonitoringData} disabled={loading}>
            {loading ? "Chargement..." : "🔄 Rafraîchir"}
          </button>
          <button className="btn-danger" onClick={() => setConfirmClearOpen(true)} disabled={logs.length === 0}>
            🗑️ Effacer les logs
          </button>
        </div>
      </div>

      {/* ── KPI Stat Cards ────────────────────────────────────────────────── */}
      <div className="mon-stats-grid">
        <div className="mon-card">
          <GlowingEffect spread={40} glow={true} disabled={false} proximity={64} inactiveZone={0.01} />
          <div className="mon-card-icon mon-card-icon--red">🚨</div>
          <div>
            <div className="mon-card-value">{stats.total_errors ?? 0}</div>
            <div className="mon-card-label">Total Erreurs Capturées</div>
          </div>
        </div>

        <div className="mon-card">
          <GlowingEffect spread={40} glow={true} disabled={false} proximity={64} inactiveZone={0.01} />
          <div className="mon-card-icon mon-card-icon--critical">💥</div>
          <div>
            <div className="mon-card-value">{stats.critical_500_errors ?? 0}</div>
            <div className="mon-card-label">
              Erreurs Critiques (500)
              {stats.critical_500_errors === 0 && <span className="mon-status-ok-tag">✓ Système stable</span>}
            </div>
          </div>
        </div>

        <div className="mon-card">
          <GlowingEffect spread={40} glow={true} disabled={false} proximity={64} inactiveZone={0.01} />
          <div className="mon-card-icon mon-card-icon--amber">📅</div>
          <div>
            <div className="mon-card-value">{stats.today_errors ?? 0}</div>
            <div className="mon-card-label">Erreurs Aujourd'hui</div>
          </div>
        </div>

        <div className="mon-card">
          <GlowingEffect spread={40} glow={true} disabled={false} proximity={64} inactiveZone={0.01} />
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

      {/* Subtle Hint Note */}
      <div className="mon-table-hint">
        💡 <em>Cliquez sur une ligne de tableau pour afficher le détail et la stacktrace de l'erreur.</em>
      </div>

      {/* ── Logs Table ────────────────────────────────────────────────────── */}
      <div className="mon-table-wrap">
        {loading && logs.length === 0 ? (
          <div className="mon-empty-state">Chargement du journal d'erreurs...</div>
        ) : logs.length === 0 ? (
          <div className="mon-empty-state">
            <span style={{ fontSize: "2rem", display: "block", marginBottom: "0.5rem" }}>🎉</span>
            Aucune erreur technique détectée ! Le système fonctionne parfaitement.
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
                <th style={{ textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const userParts = (log.user_email || "Anonyme").split("@")[0].split(".");
                const firstName = userParts[0] || "A";
                const lastName = userParts[1] || "";

                return (
                  <tr key={log.id} onClick={() => setSelectedLog(log)} style={{ cursor: "pointer" }}>
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
                        {log.source === "backend" ? "⚙️ Server" : "💻 Client"}
                      </span>
                    </td>
                    <td>
                      <div className="mon-user-chip-wrap">
                        <Avatar firstName={firstName} lastName={lastName} size={24} />
                        <div className="mon-user-info">
                          <div className="mon-user-email">{log.user_email || "Anonyme"}</div>
                          <div className="mon-user-role">{log.user_role || "Public"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="mon-cell-endpoint">
                      <span className={`mon-method-badge ${getMethodBadgeClass(log.method)}`}>
                        {log.method || "GET"}
                      </span>
                      <span className="mon-endpoint-path">{log.endpoint}</span>
                    </td>
                    <td className="mon-cell-message">
                      <span className="mon-message-text">{log.error_message}</span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        className="btn-ghost-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLog(log);
                        }}
                        title="Voir les détails et stacktrace"
                      >
                        🔍 Stacktrace
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Stacktrace Detail Modal ───────────────────────────────────────── */}
      {selectedLog && (
        <div className="mon-modal-backdrop" onClick={() => setSelectedLog(null)}>
          <div className="mon-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mon-modal-header">
              <div>
                <h3 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span>🚨 Erreur #{selectedLog.id}</span>
                  <span className={`mon-badge ${getStatusBadgeClass(selectedLog.status_code)}`}>
                    {selectedLog.status_code}
                  </span>
                </h3>
                <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
                  Rapport d'erreur technique capturé en temps réel
                </p>
              </div>
              <button
                className="btn-ghost-sm"
                onClick={() => setSelectedLog(null)}
                style={{ fontSize: "1.2rem", color: "var(--text-muted)", background: "transparent", border: "none", cursor: "pointer" }}
              >
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
                  <strong>Source:</strong>{" "}
                  <span className={`mon-source-tag mon-source-tag--${selectedLog.source}`}>
                    {selectedLog.source === "backend" ? "⚙️ Backend Server" : "💻 Frontend Client"}
                  </span>
                </div>
                <div>
                  <strong>Utilisateur:</strong> {selectedLog.user_email || "Anonyme"} ({selectedLog.user_role || "Public"})
                </div>
                <div>
                  <strong>Méthode HTTP:</strong>{" "}
                  <span className={`mon-method-badge ${getMethodBadgeClass(selectedLog.method)}`}>
                    {selectedLog.method || "GET"}
                  </span>
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <strong>Endpoint / Route:</strong>
                  <div className="mon-code-line">{selectedLog.endpoint}</div>
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <strong>Message d'Erreur:</strong>
                  <div className="mon-msg-box">{selectedLog.error_message}</div>
                </div>
              </div>

              <div style={{ marginTop: "1rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                  <strong>Stacktrace Technique:</strong>
                  <button
                    type="button"
                    className="btn-ghost-sm"
                    onClick={() => handleCopyStacktrace(selectedLog.stack_trace || selectedLog.error_message)}
                    style={{ fontSize: "0.78rem" }}
                  >
                    {copied ? "✓ Copié !" : "📋 Copier la trace"}
                  </button>
                </div>
                <pre className="mon-stacktrace-box">
                  {selectedLog.stack_trace || "Aucune trace de pile disponible pour cette erreur client."}
                </pre>
              </div>
            </div>
            <div className="mon-modal-footer" style={{ borderTop: "1px solid var(--line, rgba(0,0,0,0.08))", paddingTop: "0.75rem", marginTop: "1rem", display: "flex", justifyContent: "flex-end" }}>
              <button className="btn-secondary" onClick={() => setSelectedLog(null)}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Logs Confirm Modal */}
      <ConfirmModal
        open={confirmClearOpen}
        onClose={() => setConfirmClearOpen(false)}
        onConfirm={handleClearLogs}
        title="Effacer les logs système"
        message="Voulez-vous vraiment effacer tout l'historique des erreurs système ? Cette action est irrémédiable."
        confirmText="Effacer les logs"
        cancelText="Annuler"
        danger={true}
        loading={clearing}
      />
    </div>
  );
}
