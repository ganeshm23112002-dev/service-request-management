import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { getErrorMessage, unwrapApiData } from "../services/api.js";
import "./signup.scss";

const initialForm = {
  username: "",
  email: "",
  password: "",
  confirmPassword: "",
};

function validateForm(form) {
  const errors = {};
  const username = form.username.trim();
  const email = form.email.trim();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const usernamePattern = /^[\p{L}\p{N}_.@+-]+$/u;

  if (!username) errors.username = "Username is required.";
  else if (username.length > 150) errors.username = "Username must be 150 characters or fewer.";
  else if (!usernamePattern.test(username)) {
    errors.username = "Use only letters, numbers, and @ . + - _ in your username.";
  }
  if (!email) errors.email = "Email is required.";
  else if (!emailPattern.test(email)) errors.email = "Enter a valid email address.";
  else if (email.length > 254) errors.email = "Email must be 254 characters or fewer.";
  if (!form.password) errors.password = "Password is required.";
  else if (form.password.length < 8) errors.password = "Password must be at least 8 characters.";
  else if (/^\d+$/.test(form.password)) errors.password = "Password cannot be entirely numeric.";
  else if (
    (username.length >= 3 && form.password.toLowerCase().includes(username.toLowerCase())) ||
    (email && form.password.toLowerCase().includes(email.split("@")[0].toLowerCase()))
  ) {
    errors.password = "Password is too similar to your username or email.";
  }
  if (!form.confirmPassword) errors.confirmPassword = "Please confirm your password.";
  else if (form.password !== form.confirmPassword) {
    errors.confirmPassword = "Passwords do not match.";
  }
  return errors;
}

function apiErrorMessages(data) {
  if (!data || typeof data !== "object") return [];
  return Object.entries(data).flatMap(([field, value]) => {
    const messages = Array.isArray(value) ? value : [value];
    return messages
      .filter((message) => typeof message === "string" && message.trim())
      .map((message) => (
        field === "detail" || field === "non_field_errors"
          ? message
          : `${field.charAt(0).toUpperCase()}${field.slice(1)}: ${message}`
      ));
  });
}

export default function Signup() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [fieldErrors, setFieldErrors] = useState({});
  const [apiErrors, setApiErrors] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const updateField = (event) => {
    const { name, value } = event.target;
    let nextValue = value;
    if (name === "username") {
      nextValue = value
        .trimStart()
        .replace(/[^\p{L}\p{N}_.@+-]/gu, "")
        .slice(0, 150);
    } else if (name === "email") {
      nextValue = value.trimStart().slice(0, 254);
    }
    setForm((current) => ({ ...current, [name]: nextValue }));
    setFieldErrors((current) => ({ ...current, [name]: "" }));
    setApiErrors([]);
  };

  const submit = async (event) => {
    event.preventDefault();
    setApiErrors([]);
    const errors = validateForm(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    setSubmitting(true);
    try {
      await api.post("/auth/register/", {
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      setForm(initialForm);
      navigate("/login", {
        replace: true,
        state: { notice: "Account created successfully. Please sign in." },
      });
    } catch (error) {
      const messages = apiErrorMessages(unwrapApiData(error.response?.data));
      setApiErrors(messages.length ? messages : [getErrorMessage(error)]);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="signup-page">
      <section className="signup-card" aria-labelledby="signup-title">
        <Link className="signup-card__brand" to="/login" aria-label="Service Desk home">
          <span className="signup-card__brand-mark" aria-hidden="true">S</span>
          <span>Service Desk</span>
        </Link>
        <div className="signup-card__intro">
          <span className="signup-card__eyebrow">GET STARTED</span>
          <h1 id="signup-title">Create your employee account</h1>
          <p>Sign up to submit and track service requests.</p>
        </div>
        <form className="signup-form" onSubmit={submit} noValidate>
          {apiErrors.length > 0 && (
            <div className="signup-toast" role="alert" aria-live="assertive">
              <span className="signup-toast__icon" aria-hidden="true">!</span>
              <div className="signup-toast__content">
                <strong>Something went wrong</strong>
                <ul>
                  {apiErrors.map((message, index) => <li key={`${index}-${message}`}>{message}</li>)}
                </ul>
              </div>
              <button
                className="signup-toast__close"
                type="button"
                aria-label="Dismiss error messages"
                onClick={() => setApiErrors([])}
              >
                ×
              </button>
            </div>
          )}

          <div className="signup-form__field">
            <label htmlFor="signup-username">Username <span className="signup-form__required" aria-hidden="true">*</span></label>
            <input
              id="signup-username"
              name="username"
              type="text"
              autoComplete="username"
              value={form.username}
              onChange={updateField}
              minLength={1}
              maxLength={150}
              pattern="[\p{L}\p{N}_.@+-]+"
              aria-invalid={Boolean(fieldErrors.username)}
              aria-describedby={fieldErrors.username ? "signup-username-error" : undefined}
              required
              autoFocus
              disabled={submitting}
            />
            {fieldErrors.username && <span id="signup-username-error" className="signup-form__field-error">{fieldErrors.username}</span>}
          </div>

          <div className="signup-form__field">
            <label htmlFor="signup-email">Email <span className="signup-form__required" aria-hidden="true">*</span></label>
            <input
              id="signup-email"
              name="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={updateField}
              maxLength={254}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? "signup-email-error" : undefined}
              required
              disabled={submitting}
            />
            {fieldErrors.email && <span id="signup-email-error" className="signup-form__field-error">{fieldErrors.email}</span>}
          </div>

          <div className="signup-form__field">
            <label htmlFor="signup-password">Password <span className="signup-form__required" aria-hidden="true">*</span></label>
            <div className="signup-form__password">
              <input
                id="signup-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={form.password}
                onChange={updateField}
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby={fieldErrors.password ? "signup-password-error" : "signup-password-help"}
                required
                disabled={submitting}
              />
              <button
                type="button"
                className="signup-form__toggle"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((visible) => !visible)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            {fieldErrors.password
              ? <span id="signup-password-error" className="signup-form__field-error">{fieldErrors.password}</span>
              : <span id="signup-password-help" className="signup-form__helper">At least 8 characters; avoid common or numeric-only passwords.</span>}
          </div>

          <div className="signup-form__field">
            <label htmlFor="signup-confirm-password">Confirm password <span className="signup-form__required" aria-hidden="true">*</span></label>
            <div className="signup-form__password">
              <input
                id="signup-confirm-password"
                name="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={updateField}
                aria-invalid={Boolean(fieldErrors.confirmPassword)}
                aria-describedby={fieldErrors.confirmPassword ? "signup-confirm-error" : undefined}
                required
                disabled={submitting}
              />
              <button
                type="button"
                className="signup-form__toggle"
                aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                aria-pressed={showConfirmPassword}
                onClick={() => setShowConfirmPassword((visible) => !visible)}
              >
                {showConfirmPassword ? "Hide" : "Show"}
              </button>
            </div>
            {fieldErrors.confirmPassword && <span id="signup-confirm-error" className="signup-form__field-error">{fieldErrors.confirmPassword}</span>}
          </div>

          <button
            className="signup-form__submit"
            type="submit"
            disabled={submitting}
          >
            {submitting
              ? <><span className="button-spinner" aria-hidden="true" /> Creating account…</>
              : "Create employee account"}
          </button>
        </form>
        <p className="signup-card__footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </section>

      <div className="signup-page__aside" aria-hidden="true">
        <div className="signup-page__art">
          <span className="signup-page__art-orbit signup-page__art-orbit--one" />
          <span className="signup-page__art-orbit signup-page__art-orbit--two" />
          <div className="signup-page__art-card">
            <span className="signup-page__art-check">+</span>
            <div><strong>Your work, moving forward.</strong><small>One place for every service request.</small></div>
          </div>
          <span className="signup-page__art-dot signup-page__art-dot--one" />
          <span className="signup-page__art-dot signup-page__art-dot--two" />
        </div>
        <p>Get the support you need, when you need it.</p>
      </div>
    </main>
  );
}
