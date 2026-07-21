import { useMemo } from "react";
import Avatar from "./Avatar";
import { UrgentBadge } from "../utils/taskUtils";
import "./KanbanBoard.css";

export default function KanbanBoard({ tasks = [], onOpenTask }) {
  // Group tasks by status_title
  const columns = useMemo(() => {
    const colMap = new Map();

    // Collect all unique status titles from tasks, preserving order
    tasks.forEach((t) => {
      const statusTitle = t.status_title || "Sans statut";
      if (!colMap.has(statusTitle)) {
        colMap.set(statusTitle, {
          title: statusTitle,
          functional_type: t.status_functional_type || "intermediaire",
          tasks: [],
        });
      }
      colMap.get(statusTitle).tasks.push(t);
    });

    return Array.from(colMap.values());
  }, [tasks]);

  if (tasks.length === 0) {
    return <p className="tt-status" style={{ padding: "2rem", textAlign: "center" }}>Aucune tâche disponible dans cette vue.</p>;
  }

  return (
    <div className="kb-board">
      {columns.map((col) => (
        <div key={col.title} className="kb-column">
          <div className="kb-col-header">
            <div className="kb-col-title-wrap">
              <span className={`kb-col-dot kb-col-dot--${col.functional_type}`} />
              <h4 className="kb-col-title">{col.title}</h4>
            </div>
            <span className="kb-col-count">{col.tasks.length}</span>
          </div>

          <div className="kb-col-cards">
            {col.tasks.map((task) => (
              <div
                key={task.id}
                className={`kb-card${task.is_late ? " is-late" : ""}`}
                onClick={() => onOpenTask?.(task)}
              >
                <div className="kb-card-header">
                  <span className="kb-card-type">{task.task_type_name || "Tâche"}</span>
                  {task.is_late && (
                    <span className="kb-card-late-chip">En retard</span>
                  )}
                </div>

                <h5 className="kb-card-title">{task.title}</h5>

                <div className="kb-card-footer">
                  <div className="kb-card-date">
                    <span>📅 {new Date(task.planned_publish_date).toLocaleDateString("fr-FR")}</span>
                    <UrgentBadge date={task.planned_publish_date} isCompleted={task.status_functional_type === "validation"} />
                  </div>

                  {task.assignees && task.assignees.length > 0 && (
                    <div className="kb-card-avatars">
                      {task.assignees.map((a) => (
                        <div key={a.id} title={a.name} className="kb-card-avatar-item">
                          <Avatar firstName={a.name.split(" ")[0]} lastName={a.name.split(" ")[1] || ""} size={22} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {col.tasks.length === 0 && (
              <div className="kb-col-empty">Vide</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
