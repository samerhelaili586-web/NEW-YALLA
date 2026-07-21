import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { ROLE_LABELS } from "../constants";
import AppShell from "../components/AppShell";
import Avatar from "../components/Avatar";
import { GlowingEffect } from "../components/GlowingEffect";
import "../styles/shared.css";
import "./Annuaire.css";

const ROLE_FILTERS = [
  { value: "all", label: "Tous" },
  { value: "admin_sys", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "cm", label: "CM" },
  { value: "prod", label: "Prod" },
];

export default function Annuaire() {
  const { user } = useAuth();
  const [directory, setDirectory] = useState([]);
  const [unavailable, setUnavailable] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [dirData, unavailData] = await Promise.all([
          api.get("/users/directory"),
          api.get("/leave/unavailable-today"),
        ]);
        if (cancelled) return;
        setDirectory(dirData);
        setUnavailable(unavailData);
      } catch {
        if (!cancelled) setLoadError("Impossible de charger l'annuaire pour le moment.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const unavailableIds = useMemo(() => new Set(unavailable.map((u) => u.user_id)), [unavailable]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return directory.filter((person) => {
      if (roleFilter !== "all" && person.role !== roleFilter) return false;
      if (!q) return true;
      return `${person.first_name} ${person.last_name} ${person.email}`.toLowerCase().includes(q);
    });
  }, [directory, search, roleFilter]);

  return (
    <AppShell>
      <div className="annuaire-header" style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 600, margin: "0 0 0.3rem" }}>Annuaire</h1>
        <p style={{ color: "var(--text-muted)", margin: 0, fontSize: "0.9rem" }}>Annuaire des collaborateurs actifs de l'agence.</p>
      </div>

      <section className="directory-panel" style={{ background: "transparent", border: "none", padding: 0 }}>
        <div className="directory-toolbar" style={{ marginBottom: "1.5rem" }}>
          <input
            type="search"
            className="directory-search"
            placeholder="Rechercher un collègue…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="directory-filters">
            {ROLE_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                className={`filter-chip ${roleFilter === f.value ? "filter-chip--active" : ""}`}
                onClick={() => setRoleFilter(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {loading && <p className="directory-status">Chargement de l'annuaire…</p>}
        {loadError && <p className="directory-status directory-status--error">{loadError}</p>}

        {!loading && !loadError && (
          <>
            {filtered.length === 0 ? (
              <p className="directory-status">Aucun collègue ne correspond à cette recherche.</p>
            ) : (
              <ul className="directory-grid">
                {filtered.map((person) => (
                  <li key={person.id} className={`directory-card${unavailableIds.has(person.id) ? " directory-card--absent" : ""}`}>
                    <GlowingEffect spread={40} glow={true} disabled={false} proximity={64} inactiveZone={0.01} />
                    <div className="directory-card-top">
                      <Avatar firstName={person.first_name} lastName={person.last_name} size={44} />
                      {unavailableIds.has(person.id) && (
                        <span className="badge-unavailable">Absent</span>
                      )}
                    </div>
                    <p className="directory-card-name">
                      {person.first_name} {person.last_name}
                      {person.is_chef_prod && <span className="badge-chef" style={{ marginLeft: "0.4rem" }}>Chef Prod</span>}
                    </p>
                    <p className="directory-card-role">
                      {ROLE_LABELS[person.effective_role] || person.role}
                    </p>
                    <a className="directory-card-email" href={`mailto:${person.email}`}>
                      {person.email}
                    </a>
                    {person.phone && <p className="directory-card-phone">{person.phone}</p>}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </AppShell>
  );
}
