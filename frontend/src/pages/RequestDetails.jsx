import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import api, { getErrorMessage } from "../services/api.js";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import PriorityBadge from "../components/PriorityBadge.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import "./requestDetails.scss";

const statuses = [
  ["OPEN", "Open"],
  ["IN_PROGRESS", "In Progress"],
  ["RESOLVED", "Resolved"],
];

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function RequestDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const dashboardPath = user?.role === "ADMIN" ? "/admin" : "/employee";
  const isAdmin = user?.role === "ADMIN";
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadRequest = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get(`/requests/${id}/`);
      setRequest(data);
    } catch (loadError) {
      setError(
        loadError.response?.status === 404
          ? "This request does not exist or you do not have permission to view it."
          : getErrorMessage(loadError),
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadRequest();
  }, [loadRequest]);

  const changeStatus = async (event) => {
    const status = event.target.value;
    setSavingStatus(true);
    setStatusError("");
    try {
      const { data } = await api.patch(`/requests/${id}/`, { status });
      setRequest(data);
    } catch (updateError) {
      setStatusError(getErrorMessage(updateError));
    } finally {
      setSavingStatus(false);
    }
  };

  const deleteRequest = async () => {
    setDeleting(true);
    try {
      await api.delete(`/requests/${id}/`);
      navigate(dashboardPath, { replace: true, state: { notice: "Request deleted successfully." } });
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
      setDeleteOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <div className="request-details__state" role="status"><span className="loading-screen__spinner" /> Loading request…</div>;
  }

  if (error && !request) {
    return (
      <section className="request-details__state request-details__state--error" role="alert">
        <span className="request-details__error-mark" aria-hidden="true">!</span>
        <h2>Unable to open request</h2>
        <p>{error}</p>
        <div className="request-details__state-actions">
          <button type="button" className="request-details__button request-details__button--secondary" onClick={loadRequest}>Try again</button>
          <Link className="request-details__button request-details__button--primary" to={dashboardPath}>Back to requests</Link>
        </div>
      </section>
    );
  }

  if (!request) return null;

  return (
    <section className="request-details" aria-labelledby="request-details-title">
      <Link className="request-details__back" to={dashboardPath}><span aria-hidden="true">←</span> Back to requests</Link>
      {error && <div className="request-details__alert" role="alert">{error}</div>}
      <article className="request-details__card">
        <div className="request-details__heading">
          <div>
            <span className="request-details__eyebrow">REQUEST #{request.id}</span>
            <h2 id="request-details-title">{request.title}</h2>
            <p className="request-details__created">Submitted {formatDate(request.created_at)}</p>
          </div>
          <div className="request-details__actions">
            <Link className="request-details__button request-details__button--secondary" to={`${dashboardPath}/requests/${id}/edit`}>
              Edit request
            </Link>
            <button
              className="request-details__button request-details__button--danger-outline"
              type="button"
              onClick={() => setDeleteOpen(true)}
            >
              Delete
            </button>
          </div>
        </div>

        <div className="request-details__badges">
          <StatusBadge status={request.status} />
          <PriorityBadge priority={request.priority} />
          <span className="request-details__category">{request.category}</span>
        </div>

        {isAdmin && (
          <div className="request-details__status-control">
            <label htmlFor="details-status">Update status</label>
            <select
              id="details-status"
              value={request.status}
              onChange={changeStatus}
              disabled={savingStatus}
            >
              {statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            {savingStatus && <span role="status">Saving…</span>}
            {statusError && <span className="request-details__field-error" role="alert">{statusError}</span>}
          </div>
        )}

        <div className="request-details__divider" />
        <section className="request-details__description">
          <h3>Description</h3>
          <p>{request.description || "No description was provided."}</p>
        </section>
        <dl className="request-details__metadata">
          <div>
            <dt>Created</dt>
            <dd>{formatDate(request.created_at)}</dd>
          </div>
          <div>
            <dt>Last updated</dt>
            <dd>{formatDate(request.updated_at)}</dd>
          </div>
        </dl>
      </article>
      <ConfirmDialog
        open={deleteOpen}
        title="Delete this request?"
        message={`“${request.title}” will be permanently removed. This action cannot be undone.`}
        confirmLabel="Delete request"
        onCancel={() => !deleting && setDeleteOpen(false)}
        onConfirm={deleteRequest}
      />
    </section>
  );
}
