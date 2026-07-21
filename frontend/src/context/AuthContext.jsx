import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, ApiError } from "../api/client";

const AuthContext = createContext(null);

// spec §9.1: auto-logout after 1h of inactivity
const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes
const WARNING_BEFORE_MS = 2 * 60 * 1000;       // show warning 2 min before
const ACTIVITY_EVENTS = ["mousemove", "keydown", "click", "scroll", "touchstart"];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("loading");
  const [inactivityWarning, setInactivityWarning] = useState(false);

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

  // ── Inactivity timer (spec §9.1) ────────────────────────────────────────
  useEffect(() => {
    if (status !== "authenticated") return;

    let logoutTimer;
    let warningTimer;

    function resetTimers() {
      setInactivityWarning(false);
      clearTimeout(logoutTimer);
      clearTimeout(warningTimer);

      warningTimer = setTimeout(() => {
        setInactivityWarning(true);
      }, INACTIVITY_TIMEOUT_MS - WARNING_BEFORE_MS);

      logoutTimer = setTimeout(async () => {
        setInactivityWarning(false);
        await logout();
        // Redirect to login
        window.location.href = "/login";
      }, INACTIVITY_TIMEOUT_MS);
    }

    resetTimers();
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, resetTimers, { passive: true }));

    return () => {
      clearTimeout(logoutTimer);
      clearTimeout(warningTimer);
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, resetTimers));
    };
  }, [status, logout]);

  const value = {
    user,
    status,
    isAuthenticated: status === "authenticated",
    isLoading: status === "loading",
    inactivityWarning,
    login,
    logout,
    refreshMe,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      {/* Inactivity warning banner */}
      {inactivityWarning && (
        <div style={{
          position: "fixed",
          bottom: "1.5rem",
          left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(181, 66, 58, 0.95)",
          color: "#fff",
          padding: "1rem 1.5rem",
          borderRadius: "12px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
          zIndex: 99999,
          display: "flex",
          alignItems: "center",
          gap: "1.2rem",
          fontSize: "0.9rem",
          fontFamily: "var(--font-body)",
          maxWidth: "480px",
          width: "calc(100% - 2rem)",
        }}>
          <span>⚠️ <strong>Déconnexion imminente</strong> — Vous serez déconnecté(e) dans 2 minutes en raison d&apos;inactivité.</span>
          <button
            type="button"
            onClick={() => {
              // Any click resets the timer via the event listener
            }}
            style={{
              background: "#fff",
              color: "rgb(181, 66, 58)",
              border: "none",
              borderRadius: "8px",
              padding: "0.4rem 0.8rem",
              cursor: "pointer",
              fontWeight: 600,
              whiteSpace: "nowrap",
              fontSize: "0.85rem",
            }}
          >
            Rester connecté
          </button>
        </div>
      )}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- provider + its hook are co-located intentionally
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}