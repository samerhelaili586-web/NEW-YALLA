import { useEffect, useMemo, useState } from "react";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import AppShell from "../../components/AppShell";
import TaskDetailModal from "../../components/TaskDetailModal";
import { UrgentBadge } from "../../utils/taskUtils";
import "../../styles/shared.css";
import "./TachesAssociees.css";

function fmtDate(d) {
  return new Date(d).toLocaleDateString("fr-FR");
}

// ── Task Card ─────────────────────────────────────────────────────────────────
function TaskCard({ task, onClick }) {
  return (
    <button type="button" className="ta-card" onClick={onClick} aria-label={`Ouvrir ${task.title}`}>
      <div className="ta-card-header">
        <span className="ta-card-type">{task.task_type_name}</span>
        <UrgentBadge date={task.planned_publish_date} isCompleted={task.status_functional_type === "validation"} />
      </div>
      <h4 className="ta-card-title">{task.title}</h4>
      <p className="ta-card-proj">📁 {task.project_title}</p>
      <div className="ta-card-footer">
        <span className="ta-card-status">{task.status_title}</span>
        <span className="ta-card-date">📅 {fmtDate(task.planned_publish_date)}</span>
      </div>
    </button>
  );
}

export default function TachesAssociees() {
  const { user } = useAuth();

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  async function loadTasks() {
    setLoading(true);
    setLoadError("");
    try {
      const data = await api.get("/tasks", { assigned_to_me: 1 });
      setTasks(data);
    } catch {
      setLoadError("Impossible de charger les tâches.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openTask(t) {
    setSelectedTaskId(t.id);
    setDetailOpen(true);
  }

  const lateCount = useMemo(() => tasks.filter((t) => t.is_late).length, [tasks]);

  const allTypes = useMemo(() => {
    const seen = new Set();
    const result = [];
    for (const t of tasks) {
      if (!seen.has(t.task_type_name)) {
        seen.add(t.task_type_name);
        result.push(t.task_type_name);
      }
    }
    return result;
  }, [tasks]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (typeFilter !== "all" && t.task_type_name !== typeFilter) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        (t.project_title || "").toLowerCase().includes(q) ||
        (t.task_type_name || "").toLowerCase().includes(q)
      );
    });
  }, [tasks, search, typeFilter]);

  const grouped = useMemo(() => {
    const acc = {};
    for (const t of filtered) {
      const key = t.status_title || "Autre";
      if (!acc[key]) acc[key] = [];
      acc[key].push(t);
    }
    return acc;
  }, [filtered]);


  return (
    <AppShell>
      <div className="ta-page">
        {/* ── Header ── */}
        <div className="page-header">
          <div>
            <h1>Mes tâches</h1>
            <p className="page-subtitle">
              {loading
                ? "Chargement…"
                : `${tasks.length} tâche${tasks.length !== 1 ? "s" : ""} assignée${tasks.length !== 1 ? "s" : ""}${lateCount > 0 ? ` · ${lateCount} en retard` : ""}`
              }
            </p>
          </div>
        </div>

        {/* ── Toolbar ── */}
        <div className="ta-toolbar">
          <input
            type="search"
            className="users-search"
            placeholder="Rechercher…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="users-filters">
            <button
              type="button"
              className={`chip-toggle${typeFilter === "all" ? " is-selected" : ""}`}
              onClick={() => setTypeFilter("all")}
            >
              Tous les types
            </button>
            {allTypes.map((type) => (
              <button
                key={type}
                type="button"
                className={`chip-toggle${typeFilter === type ? " is-selected" : ""}`}
                onClick={() => setTypeFilter(type)}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {loadError && <p className="tt-status tt-status--error">{loadError}</p>}
        {loading && (
          <div className="ta-skeleton-grid">
            {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="ta-skeleton-card" />)}
          </div>
        )}

        {!loading && !loadError && (
          <>
            {filtered.length === 0 ? (
              <div className="ta-empty-state">
                <span className="ta-empty-icon">✅</span>
                <p>{tasks.length === 0 ? "Aucune tâche ne vous est assignée pour le moment." : "Aucune tâche ne correspond à votre recherche."}</p>
              </div>
            ) : (
              <div className="ta-kanban">
                {Object.entries(grouped).map(([statusTitle, statusTasks]) => (
                  <div key={statusTitle} className="ta-kanban-col">
                    <div className="ta-kanban-col-header">
                      <span className="ta-kanban-col-title">{statusTitle}</span>
                      <span className="ta-kanban-col-count">{statusTasks.length}</span>
                    </div>
                    <div className="ta-kanban-col-cards">
                      {statusTasks.map((t) => (
                        <TaskCard key={t.id} task={t} onClick={() => openTask(t)} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <TaskDetailModal
        taskId={selectedTaskId}
        open={detailOpen}
        onClose={() => { setDetailOpen(false); setSelectedTaskId(null); }}
        onChanged={loadTasks}
      />
    </AppShell>
  );
}