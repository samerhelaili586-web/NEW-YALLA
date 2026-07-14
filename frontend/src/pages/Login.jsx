import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Login.css";

const BLADE_COUNT = 7;

function ApertureIris({ open }) {
  const blades = Array.from({ length: BLADE_COUNT });
  return (
    <svg
      className={`iris ${open ? "iris--open" : ""}`}
      viewBox="0 0 200 200"
      role="presentation"
      aria-hidden="true"
    >
      <circle className="iris-ring" cx="100" cy="100" r="92" />
      {blades.map((_, i) => {
        const angle = (360 / BLADE_COUNT) * i;
        return (
          <polygon
            key={i}
            className="iris-blade"
            points="100,100 168,72 178,132"
            style={{ "--a": `${angle}deg`, transitionDelay: `${i * 22}ms` }}
          />
        );
      })}
      <circle className="iris-center" cx="100" cy="100" r="7" />
    </svg>
  );
}

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [irisOpen, setIrisOpen] = useState(false);
  const emailRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setIrisOpen(true), 80);
    emailRef.current?.focus();
    return () => clearTimeout(t);
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

  return (
    <div className="login-screen">
      <aside className="login-brand">
        <div className="login-brand-inner">
          <ApertureIris open={irisOpen} />
          <div className="login-wordmark">
            <span className="login-wordmark-main">YALLA</span>
            <span className="login-wordmark-sub">NEOPOLIS OPS</span>
          </div>
          <p className="login-tagline">
            Un point d&rsquo;accès unique pour cadrer chaque tournage,
            chaque montage, chaque publication.
          </p>
        </div>
        <div className="login-grid" aria-hidden="true" />
      </aside>

      <main className="login-form-panel">
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
        </form>
      </main>
    </div>
  );
}