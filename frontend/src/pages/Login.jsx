import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AnoAI from "../components/AnoAI";
import "./Login.css";

// ── ApertureIris removed in favor of image logo ──────────────────────────

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const emailRef = useRef(null);

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      const dest = location.state?.from?.pathname || "/";
      navigate(dest, { replace: true });
    }
  }, [isAuthenticated, navigate, location.state]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (err) {
      setError(
        err.status === 401
          ? "Identifiants incorrects."
          : err.status === 403
          ? "Ce compte est désactivé."
          : "Connexion impossible. Réessayez."
      );
    } finally {
      setSubmitting(false);
    }
  }
  const handleMouseMove = (e) => {
    const { currentTarget, clientX, clientY } = e;
    const { left, top } = currentTarget.getBoundingClientRect();
    const x = clientX - left;
    const y = clientY - top;
    currentTarget.style.setProperty("--mouse-x", `${x}px`);
    currentTarget.style.setProperty("--mouse-y", `${y}px`);
  };

  return (
    <div className="login-screen" onMouseMove={handleMouseMove}>
      <AnoAI />
      {/* Interactive Spotlight Overlay */}
      <div className="login-spotlight" aria-hidden="true" />
      
      <div className="login-card">
        <aside className="login-brand">
          <div className="login-brand-inner">
            <img src="/logo.png" alt="Yalla Digital Communication" className="login-brand-logo" />
            <p className="login-tagline">
              Un point d&rsquo;accès unique pour cadrer chaque tournage,
              chaque montage, chaque publication.
            </p>
          </div>
        </aside>

        <main className="login-form-panel dark">
          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <div className="login-form-header">
              <h1>Se connecter</h1>
              <p>Accédez à votre espace de travail.</p>
            </div>

            <label className="field">
              <span className="field-label">Adresse e-mail</span>
              <input
                ref={emailRef}
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nom@yalla.local"
              />
            </label>

            <label className="field">
              <span className="field-label">Mot de passe</span>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </label>

            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}

            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? "Connexion…" : "Se connecter"}
            </button>

            {/* Quick Demo Account Selector */}
            <div className="login-demo-section">
              <span className="login-demo-title">Comptes Démo (Accès rapide) :</span>
              <div className="login-demo-chips">
                <button
                  type="button"
                  className="login-demo-chip"
                  onClick={() => { setEmail("admin@yalla.local"); setPassword("password123"); }}
                  title="Connecter en tant qu'Admin Système"
                >
                  👑 Admin
                </button>
                <button
                  type="button"
                  className="login-demo-chip"
                  onClick={() => { setEmail("manager@yalla.local"); setPassword("password123"); }}
                  title="Connecter en tant que Manager"
                >
                  💼 Manager
                </button>
                <button
                  type="button"
                  className="login-demo-chip"
                  onClick={() => { setEmail("chefprod@yalla.local"); setPassword("password123"); }}
                  title="Connecter en tant que Chef de Production"
                >
                  🎬 Chef Prod
                </button>
                <button
                  type="button"
                  className="login-demo-chip"
                  onClick={() => { setEmail("cm@yalla.local"); setPassword("password123"); }}
                  title="Connecter en tant que Community Manager"
                >
                  📱 CM
                </button>
                <button
                  type="button"
                  className="login-demo-chip"
                  onClick={() => { setEmail("prod@yalla.local"); setPassword("password123"); }}
                  title="Connecter en tant que Monteur / Production"
                >
                  ✂️ Monteur
                </button>
              </div>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}