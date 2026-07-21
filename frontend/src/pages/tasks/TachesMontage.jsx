import { useEffect, useMemo, useState } from "react";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import AppShell from "../../components/AppShell";
import TaskDetailModal from "../../components/TaskDetailModal";
import { UrgentBadge } from "../../utils/taskUtils";
import "../../styles/shared.css";
import "./TachesMontage.css";

function fmtDate(d) {
  return new Date(d).toLocaleDateString("fr-FR");
}

// ── Status chips ─────────────────────────────────────────────────────────────
function StatusChip({ label, isLate }) {
  return (
    <span className={`tm-chip ${isLate ? "tm-chip--late" : "tm-chip--active"}`}>
      {label}
    </span>
  );
}

// ── Task Card ─────────────────────────────────────────────────────────────────
function TaskCard({ task, onClick }) {
  return (
    <button type="button" className="tm-card" onClick={onClick} aria-label={`Ouvrir ${task.title}`}>
      <div className="tm-card-header">
        <span className="tm-card-type">{task.task_type_name}</span>
        <UrgentBadge date={task.planned_publish_date} isCompleted={task.status_functional_type === "validation"} />
      </div>
      <h4 className="tm-card-title">{task.title}</h4>
      <p className="tm-card-proj">📁 {task.project_title}</p>
      <div className="tm-card-footer">
        <StatusChip label={task.status_title} isLate={task.is_late} />
        <span className="tm-card-date">📅 {fmtDate(task.planned_publish_date)}</span>
      </div>
    </button>
  );
}

export default function TachesMontage() {
  const { user } = useAuth();

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [seenTaskIds, setSeenTaskIds] = useState(new Set());
  const [editingTimeEntry, setEditingTimeEntry] = useState(null);
  const [editTimeForm, setEditTimeForm] = useState({ entry_date: "", hours: "0", minutes: "0" });
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);

  async function loadTasks() {
    setLoading(true);
    setLoadError("");
    try {
      const isChefOrAdmin = ["chef_prod", "manager", "admin_sys"].includes(user?.effective_role) || user?.is_chef_prod;
      const params = isChefOrAdmin ? { montage_only: 1 } : { assigned_to_me: 1 };
      const data = await api.get("/tasks", params);
      // spec §5.3: tasks appear when they reach a "montage" status, and DO NOT disappear
      // after a subsequent status change. We track IDs of tasks that ever appeared here.
      const montageTasks = data.filter((t) =>
        ["montage", "planification_montage"].includes(t.status_functional_type)
      );

      setSeenTaskIds((prev) => {
        const next = new Set(prev);
        montageTasks.forEach((t) => next.add(t.id));
        return next;
      });
      // Include all tasks that were ever in a montage status (persistent view)
      const allMontageRelated = data.filter(
        (t) => montageTasks.some((m) => m.id === t.id) ||
               seenTaskIds.has(t.id)
      );
      setTasks(allMontageRelated);
    } catch {
      setLoadError("Impossible de charger les tâches de montage.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {

    loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Unique statuses for filter chips
  const allStatuses = useMemo(() => {
    const seen = new Set();
    const result = [];
    for (const t of tasks) {
      if (!seen.has(t.status_title)) {
        seen.add(t.status_title);
        result.push(t.status_title);
      }
    }
    return result;
  }, [tasks]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (statusFilter !== "all" && t.status_title !== statusFilter) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        (t.task_type_name || "").toLowerCase().includes(q)
      );
    });
  }, [tasks, search, statusFilter]);

  // Group by status_title for kanban view
  const grouped = useMemo(() => {
    const map = {};
    for (const t of filtered) {
      const key = t.status_title;
      if (!map[key]) map[key] = [];
      map[key].push(t);
    }
    return map;
  }, [filtered]);

  return (
    <AppShell>
      <div className="tm-page">
        {/* ── Header ── */}
        <div className="page-header">
          <div>
            <h1>Tâches Montage</h1>
            <p className="page-subtitle">
              {loading
                ? "Chargement…"
                : `${tasks.length} tâche${tasks.length !== 1 ? "s" : ""} en attente ou en cours de montage`}
            </p>
          </div>
        </div>

        {/* ── Toolbar ── */}
        <div className="tm-toolbar">
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
              className={`chip-toggle${statusFilter === "all" ? " is-selected" : ""}`}
              onClick={() => setStatusFilter("all")}
            >
              Toutes
            </button>
            {allStatuses.map((s) => (
              <button
                key={s}
                type="button"
                className={`chip-toggle${statusFilter === s ? " is-selected" : ""}`}
                onClick={() => setStatusFilter(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {loadError && <p className="tt-status tt-status--error">{loadError}</p>}
        {loading && (
          <div className="tm-skeleton-grid">
            {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="tm-skeleton-card" />)}
          </div>
        )}

        {!loading && !loadError && (
          <>
            {filtered.length === 0 ? (
              <div className="tm-empty-state">
                <span className="tm-empty-icon">🎬</span>
                <p>Aucune tâche de montage{search ? " ne correspond à votre recherche" : ""}.</p>
              </div>
            ) : (
              <div className="tm-kanban">
                {Object.entries(grouped).map(([statusTitle, statusTasks]) => (
                  <div key={statusTitle} className="tm-kanban-col">
                    <div className="tm-kanban-col-header">
                      <span className="tm-kanban-col-title">{statusTitle}</span>
                      <span className="tm-kanban-col-count">{statusTasks.length}</span>
                    </div>
                    <div className="tm-kanban-col-cards">
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
        <TaskDetailModal
          taskId={selectedTaskId}
          open={detailOpen}
          onClose={() => { setDetailOpen(false); setSelectedTaskId(null); }}
          onChanged={loadTasks}
        />
      </div>

    </AppShell>
  );
}