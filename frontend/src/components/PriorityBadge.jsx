import "./priorityBadge.scss";

const labels = { LOW: "Low", MEDIUM: "Medium", HIGH: "High" };

export default function PriorityBadge({ priority }) {
  const knownPriority = Object.hasOwn(labels, priority);
  const label = labels[priority] || (priority ? String(priority) : "Unknown");
  return (
    <span className={`priority-badge${knownPriority ? ` priority-badge--${priority.toLowerCase()}` : " priority-badge--unknown"}`}>
      <span className="priority-badge__marker" aria-hidden="true" />
      {label}
    </span>
  );
}
