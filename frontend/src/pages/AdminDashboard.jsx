import { useCallback, useEffect, useState } from "react";
import api, { getErrorMessage } from "../services/api.js";
import RequestDashboard from "../components/RequestDashboard.jsx";
import "./adminDashboard.scss";

const summaryCards = [
  ["total_requests", "Total requests", "total"],
  ["open_requests", "Open", "open"],
  ["in_progress_requests", "In progress", "progress"],
  ["resolved_requests", "Resolved", "resolved"],
  ["high_priority_requests", "High priority", "high"],
  ["overdue_requests", "Overdue", "overdue"],
];

function formatCheckTimestamp(value) {
  if (!value) return "No successful overdue check yet";
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime())
    ? "Last overdue check time unavailable"
    : `Last overdue check: ${new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(timestamp)}`;
}

export default function AdminDashboard() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/dashboard/summary/");
      setSummary(data);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  return (
    <div className="admin-dashboard">
      <section className="admin-dashboard__overview" aria-label="Request overview">
        <div className="admin-dashboard__overview-heading">
          <div>
            <h2>Request overview</h2>
            <p>Organization-wide service request metrics.</p>
            <p className="admin-dashboard__last-check" role="status">
              {loading
                ? "Checking overdue status…"
                : formatCheckTimestamp(summary?.last_overdue_check_at)}
            </p>
          </div>
          <button type="button" onClick={loadSummary} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
        {error ? (
          <div className="admin-dashboard__summary-error" role="alert">
            <span>Unable to load dashboard summary: {error}</span>
            <button type="button" onClick={loadSummary}>Try again</button>
          </div>
        ) : (
          <div className="admin-dashboard__summary-grid" aria-live="polite">
            {summaryCards.map(([key, label, tone]) => (
              <article className={`admin-dashboard__summary-card admin-dashboard__summary-card--${tone}`} key={key}>
                <span>{label}</span>
                <strong>{loading ? "—" : summary?.[key] ?? 0}</strong>
              </article>
            ))}
          </div>
        )}
      </section>
      <RequestDashboard isAdmin onDataChanged={loadSummary} />
    </div>
  );
}
