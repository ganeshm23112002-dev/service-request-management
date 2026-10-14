import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import api, { getErrorMessage, getFieldErrors } from "../services/api.js";
import "./requestForm.scss";

const TITLE_MIN_LENGTH = 3;
const TITLE_MAX_LENGTH = 50;
const DESCRIPTION_MIN_LENGTH = 15;
const DESCRIPTION_MAX_LENGTH = 250;

const categories = [
  ["IT", "IT"],
  ["MAINTENANCE", "Maintenance"],
  ["GENERAL", "General"],
];
const priorities = [
  ["LOW", "Low"],
  ["MEDIUM", "Medium"],
  ["HIGH", "High"],
];
const statuses = [
  ["OPEN", "Open"],
  ["IN_PROGRESS", "In Progress"],
  ["RESOLVED", "Resolved"],
];

const emptyForm = {
  title: "",
  description: "",
  category: "",
  priority: "",
  status: "OPEN",
};

export default function RequestForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const { user } = useAuth();
  const dashboardPath = user?.role === "ADMIN" ? "/admin" : "/employee";
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    if (!editing) return undefined;
    let active = true;
    api.get(`/requests/${id}/`)
      .then(({ data }) => {
        if (active) {
          setForm({
            title: data.title || "",
            description: data.description || "",
            category: data.category || "",
            priority: data.priority || "",
            status: data.status || "OPEN",
          });
        }
      })
      .catch((error) => {
        if (active) setLoadError(
          error.response?.status === 404
            ? "This request does not exist or you do not have permission to edit it."
            : getErrorMessage(error),
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [editing, id]);

  const updateField = (event) => {
    const { name, value } = event.target;
    const maxLength = name === "title"
      ? TITLE_MAX_LENGTH
      : name === "description"
        ? DESCRIPTION_MAX_LENGTH
        : undefined;
    const nextValue = maxLength === undefined
      ? value
      : value.trimStart().slice(0, maxLength);
    setForm((current) => ({ ...current, [name]: nextValue }));
    setFieldErrors((current) => ({ ...current, [name]: "" }));
    setFormError("");
  };

  const submit = async (event) => {
    event.preventDefault();
    setFieldErrors({});
    setFormError("");
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category,
      priority: form.priority,
    };
    if (editing && user?.role === "ADMIN") payload.status = form.status;

    const validationErrors = {};
    if (!payload.title) {
      validationErrors.title = "This field is required.";
    } else if (payload.title.length < TITLE_MIN_LENGTH) {
      validationErrors.title = `Title must be at least ${TITLE_MIN_LENGTH} characters.`;
    } else if (payload.title.length > TITLE_MAX_LENGTH) {
      validationErrors.title = `Title must be no more than ${TITLE_MAX_LENGTH} characters.`;
    }
    if (!payload.description) {
      validationErrors.description = "This field is required.";
    } else if (payload.description.length < DESCRIPTION_MIN_LENGTH) {
      validationErrors.description = `Description must be at least ${DESCRIPTION_MIN_LENGTH} characters.`;
    } else if (payload.description.length > DESCRIPTION_MAX_LENGTH) {
      validationErrors.description = `Description must be no more than ${DESCRIPTION_MAX_LENGTH} characters.`;
    }
    for (const field of ["category", "priority"]) {
      if (!payload[field]) validationErrors[field] = "This field is required.";
    }
    if (Object.keys(validationErrors).length) {
      setFieldErrors(validationErrors);
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await api.put(`/requests/${id}/`, payload);
      } else {
        await api.post("/requests/", payload);
      }
      navigate(dashboardPath, {
        replace: true,
        state: { notice: editing ? "Request updated successfully." : "Request created successfully." },
      });
    } catch (error) {
      const errors = getFieldErrors(error);
      const recognizedFields = ["title", "description", "category", "priority", "status"];
      const fieldErrors = Object.fromEntries(
        Object.entries(errors).filter(([field]) => recognizedFields.includes(field)),
      );
      if (Object.keys(fieldErrors).length) setFieldErrors(fieldErrors);
      else setFormError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="request-form__state" role="status"><span className="loading-screen__spinner" /> Loading request…</div>;
  }

  if (loadError) {
    return (
      <section className="request-form__state request-form__state--error" role="alert">
        <h2>Unable to open request</h2>
        <p>{loadError}</p>
        <Link className="request-form__button request-form__button--secondary" to={dashboardPath}>Back to requests</Link>
      </section>
    );
  }

  return (
    <section className="request-form-page" aria-labelledby="request-form-title">
      <Link className="request-form-page__back" to={editing ? `${dashboardPath}/requests/${id}` : dashboardPath}>
        <span aria-hidden="true">←</span> {editing ? "Back to request" : "Back to requests"}
      </Link>
      <div className="request-form-card">
        <div className="request-form-card__heading">
          <span className="request-form-card__eyebrow">{editing ? "REQUEST DETAILS" : "NEW REQUEST"}</span>
          <h2 id="request-form-title">{editing ? "Edit request" : "Create a request"}</h2>
          <p>{editing ? "Update the information below." : "Tell us what you need help with."}</p>
        </div>
        <form className="request-form" onSubmit={submit} noValidate>
          {formError && <div className="request-form__alert" role="alert">{formError}</div>}
          <div className="request-form__field">
            <label htmlFor="request-title">Title <span aria-hidden="true">*</span></label>
            <input
              id="request-title"
              name="title"
              value={form.title}
              onChange={updateField}
              minLength={TITLE_MIN_LENGTH}
              maxLength={TITLE_MAX_LENGTH}
              required
              aria-invalid={Boolean(fieldErrors.title)}
              aria-describedby={fieldErrors.title ? "title-error" : undefined}
              disabled={saving}
            />
            {fieldErrors.title && <span id="title-error" className="request-form__field-error">{fieldErrors.title}</span>}
            <span className="request-form__field-hint">{TITLE_MIN_LENGTH}–{TITLE_MAX_LENGTH} characters</span>
          </div>
          <div className="request-form__field">
            <label htmlFor="request-description">Description <span aria-hidden="true">*</span></label>
            <textarea
              id="request-description"
              name="description"
              value={form.description}
              onChange={updateField}
              minLength={DESCRIPTION_MIN_LENGTH}
              maxLength={DESCRIPTION_MAX_LENGTH}
              rows={6}
              required
              aria-invalid={Boolean(fieldErrors.description)}
              aria-describedby={fieldErrors.description ? "description-error" : undefined}
              disabled={saving}
            />
            {fieldErrors.description && <span id="description-error" className="request-form__field-error">{fieldErrors.description}</span>}
            <span className="request-form__field-hint">{DESCRIPTION_MIN_LENGTH}–{DESCRIPTION_MAX_LENGTH} characters</span>
          </div>
          <div className="request-form__grid">
            <div className="request-form__field">
              <label htmlFor="request-category">Category <span aria-hidden="true">*</span></label>
              <select
                id="request-category"
                name="category"
                value={form.category}
                onChange={updateField}
                required
                aria-invalid={Boolean(fieldErrors.category)}
                aria-describedby={fieldErrors.category ? "category-error" : undefined}
                disabled={saving}
              >
                <option value="" disabled>Select category</option>
                {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              {fieldErrors.category && <span id="category-error" className="request-form__field-error">{fieldErrors.category}</span>}
            </div>
            <div className="request-form__field">
              <label htmlFor="request-priority">Priority <span aria-hidden="true">*</span></label>
              <select
                id="request-priority"
                name="priority"
                value={form.priority}
                onChange={updateField}
                required
                aria-invalid={Boolean(fieldErrors.priority)}
                aria-describedby={fieldErrors.priority ? "priority-error" : undefined}
                disabled={saving}
              >
                <option value="" disabled>Select priority</option>
                {priorities.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              {fieldErrors.priority && <span id="priority-error" className="request-form__field-error">{fieldErrors.priority}</span>}
            </div>
          </div>
          {editing && user?.role === "ADMIN" && (
            <div className="request-form__field request-form__status-field">
              <label htmlFor="request-status">Status</label>
              <select id="request-status" name="status" value={form.status} onChange={updateField} disabled={saving}>
                {statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              {fieldErrors.status && <span className="request-form__field-error">{fieldErrors.status}</span>}
            </div>
          )}
          <div className="request-form__actions">
            <Link
              className="request-form__button request-form__button--secondary"
              to={editing ? `${dashboardPath}/requests/${id}` : dashboardPath}
            >
              Cancel
            </Link>
            <button className="request-form__button request-form__button--primary" type="submit" disabled={saving}>
              {saving && <span className="button-spinner" aria-hidden="true" />}
              {saving ? "Saving…" : editing ? "Save changes" : "Submit request"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
