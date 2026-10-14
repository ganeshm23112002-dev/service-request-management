import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import api, { getErrorMessage } from "../services/api.js";
import ConfirmDialog from "./ConfirmDialog.jsx";
import PriorityBadge from "./PriorityBadge.jsx";
import StatusBadge from "./StatusBadge.jsx";
import "./requestDashboard.scss";

const statusOptions = [
  ["OPEN", "Open"],
  ["IN_PROGRESS", "In Progress"],
  ["RESOLVED", "Resolved"],
];
const categoryOptions = [
  ["IT", "IT"],
  ["MAINTENANCE", "Maintenance"],
  ["GENERAL", "General"],
];
const priorityOptions = [
  ["LOW", "Low"],
  ["MEDIUM", "Medium"],
  ["HIGH", "High"],
];

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

export default function RequestDashboard({ isAdmin = false, onDataChanged = () => {} }) {
  const location = useLocation();
  const navigate = useNavigate();
  const dashboardPath = isAdmin ? "/admin" : "/employee";
  const [requests, setRequests] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [overdueFilter, setOverdueFilter] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [ordering, setOrdering] = useState("-created_at");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(location.state?.notice || "");
  const [noticeType, setNoticeType] = useState("success");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const displayedPage = Math.min(currentPage, pageCount);
  const firstItem = totalCount === 0 ? 0 : (displayedPage - 1) * pageSize + 1;
  const lastItem = Math.min((displayedPage - 1) * pageSize + requests.length, totalCount);
  const visibleRequests = requests;
  const pageNumbers = pageCount <= 7
    ? Array.from({ length: pageCount }, (_, index) => index + 1)
    : [...new Set([1, displayedPage - 1, displayedPage, displayedPage + 1, pageCount]
      .filter((page) => page >= 1 && page <= pageCount)
      .sort((left, right) => left - right))];

  const loadRequests = useCallback(async (signal) => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;
      if (categoryFilter) params.category = categoryFilter;
      if (overdueFilter) params.overdue = overdueFilter;
      if (debouncedSearch) params.search = debouncedSearch;
      if (ordering) params.ordering = ordering;
      params.page = currentPage;
      params.page_size = pageSize;
      const { data } = await api.get("/requests/", { params, signal });
      if (Array.isArray(data)) {
        setRequests(data);
        setTotalCount(data.length);
      } else {
        setRequests(data.results || []);
        setTotalCount(data.count || 0);
      }
    } catch (loadError) {
      if (!signal?.aborted) setError(getErrorMessage(loadError));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [statusFilter, priorityFilter, categoryFilter, overdueFilter, debouncedSearch, ordering, currentPage, pageSize]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();
    loadRequests(controller.signal);
    return () => controller.abort();
  }, [loadRequests]);

  useEffect(() => {
    if (location.state?.notice) {
      setNotice(location.state.notice);
      setNoticeType("success");
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(""), 5000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const requestPath = (id) => `${dashboardPath}/requests/${id}`;
  const resetToFirstPage = (setter) => (event) => {
    setter(event.target.value);
    setCurrentPage(1);
  };

  const deleteRequest = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/requests/${deleteTarget.id}/`);
      if (requests.length === 1 && currentPage > 1) {
        setCurrentPage((page) => page - 1);
      } else {
        loadRequests();
      }
      setNoticeType("success");
      setNotice("Request deleted successfully.");
      onDataChanged();
    } catch (deleteError) {
      setNoticeType("error");
      setNotice(getErrorMessage(deleteError));
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const updateStatus = async (request, nextStatus) => {
    setUpdatingStatus(request.id);
    setNotice("");
    try {
      const { data } = await api.patch(`/requests/${request.id}/`, { status: nextStatus });
      setRequests((current) => current.map((item) => item.id === data.id ? data : item));
      setNoticeType("success");
      setNotice("Request status updated.");
      onDataChanged();
    } catch (statusError) {
      setNoticeType("error");
      setNotice(getErrorMessage(statusError));
    } finally {
      setUpdatingStatus(null);
    }
  };

  return (
    <section className="request-dashboard" aria-labelledby="dashboard-title">
      <div className="request-dashboard__intro">
        <div>
          <h2 id="dashboard-title">{isAdmin ? "All requests" : "My requests"}</h2>
          <p className="request-dashboard__subtitle">
            {isAdmin
              ? "Review and manage service requests across your organization."
              : "Track your requests and keep up with their progress."}
          </p>
        </div>
        <Link className="request-dashboard__create" to={`${dashboardPath}/requests/new`}>
          <span aria-hidden="true">+</span> Create request
        </Link>
      </div>

      {notice && (
        <div
          className={`request-dashboard__toast request-dashboard__toast--${noticeType}`}
          role={noticeType === "error" ? "alert" : "status"}
          aria-live={noticeType === "error" ? "assertive" : "polite"}
        >
          <span>{notice}</span>
          <button type="button" aria-label="Dismiss message" onClick={() => setNotice("")}>×</button>
        </div>
      )}

      <section className="request-panel" aria-label="Service requests">
        <div className="request-panel__toolbar">
          <div>
            <h3>{isAdmin ? "All requests" : "My requests"}</h3>
            {!loading && !error && (
              <span className="request-panel__count">
                {totalCount} {totalCount === 1 ? "request" : "requests"}
              </span>
            )}
          </div>
          <div className="request-panel__filters">
            <label>
              <span className="sr-only">Filter by status</span>
              <select value={statusFilter} onChange={resetToFirstPage(setStatusFilter)}>
                <option value="">All statuses</option>
                {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label>
              <span className="sr-only">Filter by priority</span>
              <select value={priorityFilter} onChange={resetToFirstPage(setPriorityFilter)}>
                <option value="">All priorities</option>
                {priorityOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            {isAdmin && (
              <>
                <label>
                  <span className="sr-only">Filter by category</span>
                  <select value={categoryFilter} onChange={resetToFirstPage(setCategoryFilter)}>
                    <option value="">All categories</option>
                    {categoryOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label>
                  <span className="sr-only">Filter by overdue</span>
                  <select value={overdueFilter} onChange={resetToFirstPage(setOverdueFilter)}>
                    <option value="">Overdue: any</option>
                    <option value="true">Overdue only</option>
                    <option value="false">Not overdue</option>
                  </select>
                </label>
                <label>
                  <span className="sr-only">Search requests</span>
                  <input
                    type="search"
                    value={search}
                    placeholder="Search requests"
                    onChange={resetToFirstPage(setSearch)}
                    maxLength={100}
                  />
                </label>
                <label>
                  <span className="sr-only">Sort requests</span>
                  <select value={ordering} onChange={resetToFirstPage(setOrdering)}>
                    <option value="-created_at">Newest first</option>
                    <option value="created_at">Oldest first</option>
                    <option value="priority">Priority ascending</option>
                    <option value="-priority">Priority descending</option>
                    <option value="status">Status ascending</option>
                    <option value="-status">Status descending</option>
                  </select>
                </label>
              </>
            )}
            {(statusFilter || priorityFilter || categoryFilter || overdueFilter || search) && (
              <button
                className="request-panel__reset"
                type="button"
                onClick={() => {
                  setStatusFilter("");
                  setPriorityFilter("");
                  setCategoryFilter("");
                  setOverdueFilter("");
                  setSearch("");
                  setCurrentPage(1);
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="request-state" role="status"><span className="loading-screen__spinner" /> Loading requests…</div>
        ) : error ? (
          <div className="request-state request-state--error" role="alert">
            <strong>We couldn’t load your requests.</strong>
            <span>{error}</span>
            <button className="request-dashboard__secondary" type="button" onClick={loadRequests}>Try again</button>
          </div>
        ) : totalCount === 0 ? (
          <div className="request-state">
            <span className="request-state__icon" aria-hidden="true">▤</span>
            <strong>{statusFilter || priorityFilter || categoryFilter || overdueFilter || search ? "No matching requests" : "No requests yet"}</strong>
            <span>
              {statusFilter || priorityFilter || categoryFilter || overdueFilter || search
                ? "Try changing or clearing the filters."
                : "Create a request to get the help you need."}
            </span>
            {statusFilter || priorityFilter || categoryFilter || overdueFilter || search ? (
              <button
                type="button"
                className="request-dashboard__secondary"
                onClick={() => {
                  setStatusFilter("");
                  setPriorityFilter("");
                  setCategoryFilter("");
                  setOverdueFilter("");
                  setSearch("");
                  setCurrentPage(1);
                }}
              >
                Clear filters
              </button>
            ) : (
              <Link className="request-dashboard__create request-dashboard__create--small" to={`${dashboardPath}/requests/new`}>
                Create request
              </Link>
            )}
          </div>
        ) : (
          <div className="request-table-wrap">
            <table className="request-table">
              <thead>
                <tr>
                  <th scope="col">Request</th>
                  {isAdmin && <th scope="col">ID</th>}
                  {isAdmin && <th scope="col">Employee</th>}
                  <th scope="col">Category</th>
                  <th scope="col">Priority</th>
                  <th scope="col">Status</th>
                  <th scope="col">Created</th>
                  {isAdmin && <th scope="col">Overdue</th>}
                  {isAdmin && <th scope="col">Change status</th>}
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleRequests.map((request) => (
                  <tr key={request.id}>
                    <td data-label="Request">
                      <Link className="request-table__title" to={requestPath(request.id)}>{request.title}</Link>
                    </td>
                    {isAdmin && <td data-label="ID">#{request.id}</td>}
                    {isAdmin && <td data-label="Employee">{request.employee}</td>}
                    <td data-label="Category">{request.category}</td>
                    <td data-label="Priority"><PriorityBadge priority={request.priority} /></td>
                    <td data-label="Status"><StatusBadge status={request.status} /></td>
                    <td data-label="Created" className="request-table__date">{formatDate(request.created_at)}</td>
                    {isAdmin && <td data-label="Overdue">{request.is_overdue ? "Yes" : "No"}</td>}
                    {isAdmin && (
                      <td data-label="Change status">
                        <label className="sr-only" htmlFor={`status-${request.id}`}>Status for {request.title}</label>
                        <select
                          id={`status-${request.id}`}
                          className="request-table__status-select"
                          value={request.status}
                          disabled={updatingStatus === request.id}
                          onChange={(event) => updateStatus(request, event.target.value)}
                        >
                          {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                      </td>
                    )}
                    <td data-label="Actions">
                      <div className="request-table__actions">
                        <Link to={requestPath(request.id)}>Details</Link>
                        <Link to={`${requestPath(request.id)}/edit`}>Edit</Link>
                        <button type="button" onClick={() => setDeleteTarget(request)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && !error && totalCount > 0 && (
          <nav className="request-pagination" aria-label="Request list pagination">
            <p className="request-pagination__summary">
              Showing <strong>{firstItem}–{lastItem}</strong> of <strong>{totalCount}</strong>
            </p>
            <div className="request-pagination__controls">
              <label className="request-pagination__page-size">
                <span>Rows per page</span>
                <select
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value));
                    setCurrentPage(1);
                  }}
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                </select>
              </label>
              <button
                type="button"
                className="request-pagination__button"
                onClick={() => setCurrentPage(displayedPage - 1)}
                disabled={displayedPage === 1}
                aria-label="Previous page"
              >
                Previous
              </button>
              {pageNumbers.map((page, index) => (
                <span className="request-pagination__page-item" key={page}>
                  {index > 0 && page - pageNumbers[index - 1] > 1 && (
                    <span className="request-pagination__ellipsis" aria-hidden="true">…</span>
                  )}
                  <button
                    type="button"
                    className={`request-pagination__button${page === displayedPage ? " request-pagination__button--active" : ""}`}
                    onClick={() => setCurrentPage(page)}
                    aria-label={`Page ${page}`}
                    aria-current={page === displayedPage ? "page" : undefined}
                  >
                    {page}
                  </button>
                </span>
              ))}
              <button
                type="button"
                className="request-pagination__button"
                onClick={() => setCurrentPage(displayedPage + 1)}
                disabled={displayedPage === pageCount}
                aria-label="Next page"
              >
                Next
              </button>
            </div>
          </nav>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete this request?"
        message={deleteTarget ? `“${deleteTarget.title}” will be permanently removed. This action cannot be undone.` : ""}
        confirmLabel="Delete request"
        onCancel={() => !deleting && setDeleteTarget(null)}
        onConfirm={deleteRequest}
      />
    </section>
  );
}
