import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { ROLE_LABELS } from "../constants";
import AppShell from "../components/AppShell";
import Avatar from "../components/Avatar";
import "./Home.css";

const ROLE_FILTERS = [
  { value: "all", label: "Tous" },
  { value: "admin_sys", label: "Admin Système" },
  { value: "manager", label: "Manager" },
  { value: "cm", label: "Community Manager" },
  { value: "prod", label: "Prod" },
];

const WEEKDAY_LABELS = [
  "dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi",
];
const MONTH_LABELS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

function todayLabel() {
  const now = new Date();
  return `${WEEKDAY_LABELS[now.getDay()]} ${now.getDate()} ${MONTH_LABELS[now.getMonth()]}`;
}

export default function Home() {
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
    return () => {
      cancelled = true;
    };
  }, []);

  const unavailableIds = useMemo(
    () => new Set(unavailable.map((u) => u.user_id)),
    [unavailable]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return directory.filter((person) => {
      if (roleFilter !== "all" && person.role !== roleFilter) return false;
      if (!q) return true;
      const full = `${person.first_name} ${person.last_name} ${person.email}`.toLowerCase();
      return full.includes(q);
    });
  }, [directory, search, roleFilter]);

  return (
    <AppShell>
      <div className="home-header">
        <div>
          <h1>Bonjour, {user?.first_name}</h1>
          <p className="home-date">Nous sommes {todayLabel()}.</p>
        </div>
      </div>

      <div className="home-grid">
        <section className="directory-panel">
          <div className="directory-toolbar">
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
          {loadError && (
            <p className="directory-status directory-status--error">{loadError}</p>
          )}

          {!loading && !loadError && (
            <>
              {filtered.length === 0 ? (
                <p className="directory-status">Aucun collègue ne correspond à cette recherche.</p>
              ) : (
                <ul className="directory-grid">
                  {filtered.map((person) => (
                    <li key={person.id} className="directory-card">
                      <div className="directory-card-top">
                        <Avatar firstName={person.first_name} lastName={person.last_name} size={44} />
                        {unavailableIds.has(person.id) && (
                          <span className="badge-unavailable">Absent aujourd&rsquo;hui</span>
                        )}
                      </div>
                      <p className="directory-card-name">
                        {person.first_name} {person.last_name}
                        {person.is_chef_prod && <span className="badge-chef">Chef Prod</span>}
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

        <aside className="unavailable-panel">
          <h2>Indisponibles aujourd&rsquo;hui</h2>
          {!loading && unavailable.length === 0 && (
            <p className="unavailable-empty">Tout le monde est disponible aujourd&rsquo;hui.</p>
          )}
          <ul className="unavailable-list">
            {unavailable.map((u) => (
              <li key={`${u.user_id}-${u.reason}`} className="unavailable-item">
                <span className="unavailable-name">{u.user_name}</span>
                <span className={`unavailable-reason unavailable-reason--${u.reason}`}>
                  {u.reason === "conge" ? "Congé" : "Maladie"}
                </span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </AppShell>
  );
}