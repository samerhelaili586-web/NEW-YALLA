import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, ApiError } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("loading");

  const refreshMe = useCallback(async () => {
    try {
      const data = await api.get("/auth/me");
      setUser(data.user);
      setStatus("authenticated");
      return data.user;
    } catch (err) {
      setUser(null);
      setStatus("anonymous");
      if (!(err instanceof ApiError) || err.status !== 401) {
        console.error("Failed to load session:", err);
      }
      return null;
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional one-time session fetch on mount
    refreshMe();
  }, [refreshMe]);

  const login = useCallback(async (email, password) => {
    const data = await api.post("/auth/login", { email, password });
    setUser(data.user);
    setStatus("authenticated");
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      setUser(null);
      setStatus("anonymous");
    }
  }, []);

  const value = {
    user,
    status,
    isAuthenticated: status === "authenticated",
    isLoading: status === "loading",
    login,
    logout,
    refreshMe,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- provider + its hook are co-located intentionally
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}