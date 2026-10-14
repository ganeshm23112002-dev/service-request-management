import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "./context/AuthContext.jsx";
import Sidebar from "./components/Sidebar.jsx";
import Header from "./components/Header.jsx";
import Login from "./pages/Login.jsx";
import Signup from "./pages/Signup.jsx";
import EmployeeDashboard from "./pages/EmployeeDashboard.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import EmployeeManagement from "./pages/EmployeeManagement.jsx";
import RequestForm from "./pages/RequestForm.jsx";
import RequestDetails from "./pages/RequestDetails.jsx";

function LoadingScreen() {
  return (
    <main className="loading-screen" role="status" aria-live="polite">
      <span className="loading-screen__spinner" aria-hidden="true" />
      <p>Restoring your session…</p>
    </main>
  );
}

function ProtectedRoute({ allowedRole }) {
  const { user, initializing, dashboardFor } = useAuth();
  const location = useLocation();
  if (initializing) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (allowedRole && user.role !== allowedRole) {
    return <Navigate to={dashboardFor(user)} replace />;
  }
  return <Outlet />;
}

function LoginRoute() {
  const { user, initializing, dashboardFor } = useAuth();
  if (initializing) return <LoadingScreen />;
  if (user) return <Navigate to={dashboardFor(user)} replace />;
  return <Login />;
}

function SignupRoute() {
  const { user, initializing, dashboardFor } = useAuth();
  if (initializing) return <LoadingScreen />;
  if (user) return <Navigate to={dashboardFor(user)} replace />;
  return <Signup />;
}

function Workspace() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="app-shell">
      <Sidebar isOpen={menuOpen} onClose={() => setMenuOpen(false)} />
      {menuOpen && (
        <button
          className="app-shell__scrim"
          aria-label="Close navigation menu"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <div className="app-shell__main">
        <Header onMenuClick={() => setMenuOpen((open) => !open)} />
        <main className="app-shell__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function RequestFormRoute() {
  return <RequestForm />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/signup" element={<SignupRoute />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Workspace />}>
          <Route element={<ProtectedRoute allowedRole="EMPLOYEE" />}>
            <Route path="/employee" element={<EmployeeDashboard />} />
            <Route path="/employee/requests/new" element={<RequestFormRoute />} />
            <Route path="/employee/requests/:id" element={<RequestDetails />} />
            <Route path="/employee/requests/:id/edit" element={<RequestFormRoute />} />
          </Route>
          <Route element={<ProtectedRoute allowedRole="ADMIN" />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/employees" element={<EmployeeManagement />} />
            <Route path="/admin/requests/new" element={<RequestFormRoute />} />
            <Route path="/admin/requests/:id" element={<RequestDetails />} />
            <Route path="/admin/requests/:id/edit" element={<RequestFormRoute />} />
          </Route>
        </Route>
      </Route>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
