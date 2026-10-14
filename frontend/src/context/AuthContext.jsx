import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api, { tokenStorage } from "../services/api.js";

const AuthContext = createContext(null);

function dashboardFor(user) {
  return user?.role === "ADMIN" ? "/admin" : "/employee";
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  const fetchCurrentUser = useCallback(async () => {
    const { data } = await api.get("/auth/me/");
    setUser(data);
    return data;
  }, []);

  const login = useCallback(async (credentials) => {
    const { data } = await api.post("/auth/login/", credentials);
    tokenStorage.setTokens(data);
    try {
      const { data: currentUser } = await api.get("/auth/me/");
      setUser(currentUser);
      navigate(dashboardFor(currentUser), { replace: true });
      return currentUser;
    } catch (error) {
      tokenStorage.clear();
      setUser(null);
      throw error;
    }
  }, [navigate]);

  const logout = useCallback(async () => {
    const refresh = tokenStorage.getRefresh();
    try {
      if (refresh && tokenStorage.getAccess()) {
        await api.post("/auth/logout/", { refresh });
      }
    } finally {
      tokenStorage.clear();
      setUser(null);
      navigate("/login", { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    let active = true;
    const initialize = async () => {
      if (!tokenStorage.getAccess() && !tokenStorage.getRefresh()) {
        if (active) setInitializing(false);
        return;
      }
      try {
        const { data } = await api.get("/auth/me/");
        if (active) setUser(data);
      } catch {
        tokenStorage.clear();
        if (active) setUser(null);
      } finally {
        if (active) setInitializing(false);
      }
    };
    initialize();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const onExpired = () => {
      setUser(null);
      setInitializing(false);
      if (location.pathname !== "/login") {
        navigate("/login", { replace: true, state: { notice: "Your session expired. Please sign in again." } });
      }
    };
    window.addEventListener("auth:session-expired", onExpired);
    return () => window.removeEventListener("auth:session-expired", onExpired);
  }, [location.pathname, navigate]);

  const value = useMemo(
    () => ({ user, initializing, login, logout, fetchCurrentUser, dashboardFor }),
    [user, initializing, login, logout, fetchCurrentUser],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}
