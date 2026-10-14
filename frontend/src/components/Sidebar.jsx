import { NavLink } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import "./sidebar.scss";

export default function Sidebar({ isOpen, onClose }) {
  const { user, logout } = useAuth();
  const [logoutError, setLogoutError] = useState("");
  const dashboardPath = user?.role === "ADMIN" ? "/admin" : "/employee";
  const navigation = [
    { to: dashboardPath, label: user?.role === "ADMIN" ? "All requests" : "My requests", icon: "▤" },
    { to: `${dashboardPath}/requests/new`, label: "Create request", icon: "+" },
  ];

  const handleLogout = async () => {
    setLogoutError("");
    try {
      await logout();
    } catch {
      setLogoutError("Signed out locally, but the server could not invalidate the refresh token.");
    }
  };

  return (
    <aside className={`sidebar${isOpen ? " sidebar--open" : ""}`} aria-label="Main navigation">
      <NavLink className="sidebar__brand" to={dashboardPath} onClick={onClose}>
        <span className="sidebar__brand-mark" aria-hidden="true">S</span>
        <span><strong>Service Desk</strong><small>Request management</small></span>
      </NavLink>
      <div className="sidebar__section-label">WORKSPACE</div>
      <nav className="sidebar__nav">
        {navigation.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === dashboardPath}
            className={({ isActive }) => `sidebar__link${isActive ? " sidebar__link--active" : ""}`}
            onClick={onClose}
          >
            <span className="sidebar__link-icon" aria-hidden="true">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar__footer">
        {logoutError && <p className="sidebar__error" role="status">{logoutError}</p>}
        <div className="sidebar__identity">
          <span className="sidebar__avatar" aria-hidden="true">
            {user?.username?.charAt(0)?.toUpperCase() || "U"}
          </span>
          <span className="sidebar__identity-copy">
            <strong>{user?.username}</strong>
            <small>{user?.role === "ADMIN" ? "Administrator" : "Employee"}</small>
          </span>
        </div>
        <button className="sidebar__logout" type="button" onClick={handleLogout}>
          <span aria-hidden="true">↪</span> Sign out
        </button>
      </div>
    </aside>
  );
}
