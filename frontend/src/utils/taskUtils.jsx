export function isUrgentTask(plannedDateStr) {
  if (!plannedDateStr) return false;
  const target = new Date(plannedDateStr).getTime();
  const now = Date.now();
  const diff = target - now;
  // 6 hours in milliseconds
  return diff < 6 * 60 * 60 * 1000;
}

export function UrgentBadge({ date, isCompleted }) {
  if (isCompleted || !isUrgentTask(date)) return null;
  return (
    <span className="status-chip" style={{ 
      marginLeft: "0.5rem", 
      background: "rgba(220, 38, 38, 0.15)", 
      color: "#ef4444", 
      border: "1px solid rgba(220, 38, 38, 0.3)",
      boxShadow: "0 0 8px rgba(220, 38, 38, 0.4)"
    }}>
      <span style={{ marginRight: "4px" }}>⚠️</span>&lt;6h
    </span>
  );
}
