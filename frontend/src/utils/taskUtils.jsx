export function isUrgentTask(plannedDateStr) {
  if (!plannedDateStr) return false;
  
  // Define the deadline as the end of the planned day (23:59:59 local time)
  const targetDate = new Date(plannedDateStr);
  targetDate.setHours(23, 59, 59, 999);
  const target = targetDate.getTime();
  
  const now = Date.now();
  const diff = target - now;
  
  // Urgent if deadline is approaching in less than 6 hours, but not already past
  return diff >= 0 && diff < 6 * 60 * 60 * 1000;
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
