import { useEffect, useState } from "react";
import { api } from "../../api/client";
import "../../styles/shared.css";
import "./LoginHistory.css";

export default function AdminLoginHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const data = await api.get("/login-history");
        setHistory(data);
      } catch {
        setError("Impossible de charger l'historique de connexions.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h2>Historique de connexions</h2>
          <p className="admin-page-subtitle">Consultez les 200 dernières connexions/déconnexions</p>
        </div>
        <div className="lh-header-actions">
          <div className="lh-search-container">
            <input
              type="search"
              className="lh-search-input"
              placeholder="Rechercher un utilisateur..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <svg className="lh-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </div>
        </div>
      </div>

      {loading && <p className="tt-status">Chargement…</p>}
      {error && <p className="tt-status tt-status--error">{error}</p>}

      {!loading && !error && (
        <div className="tt-table-wrap">
          <table className="tt-table">
            <thead>
              <tr>
                <th>Date et Heure</th>
                <th>Utilisateur</th>
                <th>Événement</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ textAlign: "center", color: "var(--text-muted)", padding: "2rem" }}>
                    Aucun historique trouvé.
                  </td>
                </tr>
              ) : (
                history
                  .filter((h) => h.user_name.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((h) => (
                  <tr key={h.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{new Date(h.timestamp).toLocaleString("fr-FR")}</td>
                    <td style={{ fontWeight: 600 }}>{h.user_name}</td>
                    <td>
                      <span className={`status-chip ${h.event === "login" ? "is-active" : "is-inactive"}`}>
                        {h.event === "login" ? "Connexion" : "Déconnexion"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
