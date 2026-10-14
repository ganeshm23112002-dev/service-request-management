import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { getErrorMessage } from "../services/api.js";
import "./login.scss";

export default function Login() {
  const { login } = useAuth();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(location.state?.notice || "");

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login({ username: username.trim(), password });
    } catch (loginError) {
      setError(
        loginError.response?.status === 401
          ? "The username or password you entered is incorrect."
          : getErrorMessage(loginError),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-card__brand">
          <span className="login-card__brand-mark" aria-hidden="true">S</span>
          <span>Service Desk</span>
        </div>
        <div className="login-card__intro">
          <span className="login-card__eyebrow">WELCOME BACK</span>
          <h1 id="login-title">Sign in to your workspace</h1>
          <p>Manage service requests with your team.</p>
        </div>
        {error && (
          <div className="login-toast" role="alert" aria-live="assertive">
            <span className="login-toast__icon" aria-hidden="true">!</span>
            <p>{error}</p>
            <button
              type="button"
              aria-label="Dismiss error message"
              onClick={() => setError("")}
            >
              ×
            </button>
          </div>
        )}
        <form className="login-form" onSubmit={submit} noValidate>
          {notice && <div className="login-form__notice" role="status">{notice}</div>}
          <div className="login-form__field">
            <label htmlFor="username">Username <span className="login-form__required" aria-hidden="true">*</span></label>
            <input
              id="username"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
              aria-required="true"
              autoFocus
              disabled={submitting}
            />
          </div>
          <div className="login-form__field">
            <label htmlFor="password">Password <span className="login-form__required" aria-hidden="true">*</span></label>
            <div className="login-form__password">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                aria-required="true"
                disabled={submitting}
              />
              <button
                type="button"
                className="login-form__toggle"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((visible) => !visible)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          <button className="login-form__submit" type="submit" disabled={submitting || !username || !password}>
            {submitting ? <><span className="button-spinner" aria-hidden="true" /> Signing in…</> : "Sign in"}
          </button>
        </form>
        <p className="login-card__footer">
          Don&apos;t have an account? <Link to="/signup">Sign up</Link>
        </p>
      </section>
      <div className="login-page__aside" aria-hidden="true">
        <div className="login-page__art">
          <span className="login-page__art-orbit login-page__art-orbit--one" />
          <span className="login-page__art-orbit login-page__art-orbit--two" />
          <div className="login-page__art-card">
            <span className="login-page__art-check">✓</span>
            <div><strong>Requests, under control.</strong><small>From submission to resolution.</small></div>
          </div>
          <span className="login-page__art-dot login-page__art-dot--one" />
          <span className="login-page__art-dot login-page__art-dot--two" />
        </div>
        <p>A clearer way to keep work moving.</p>
      </div>
    </main>
  );
}
