import "./statusBadge.scss";

const labels = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
};

export default function StatusBadge({ status }) {
  const knownStatus = Object.hasOwn(labels, status);
  const label = labels[status] || (status ? String(status).replaceAll("_", " ") : "Unknown");
  return (
    <span className={`status-badge${knownStatus ? ` status-badge--${status.toLowerCase().replaceAll("_", "-")}` : " status-badge--unknown"}`}>
      <span className="status-badge__dot" aria-hidden="true" />
      {label}
    </span>
  );
}
