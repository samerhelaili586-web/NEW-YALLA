import { Link } from "react-router-dom";
import AppShell from "../components/AppShell";
import "../styles/shared.css";
import "./NotFound.css";

export default function NotFound() {
  return (
    <AppShell>
      <div className="nf-page">
        <div className="nf-glow-orb nf-glow-orb--1" />
        <div className="nf-glow-orb nf-glow-orb--2" />
        <div className="nf-content">
          <div className="nf-code">404</div>
          <div className="nf-icon">🚀</div>
          <h1 className="nf-title">Page introuvable</h1>
          <p className="nf-description">
            Cette page n&rsquo;existe pas ou a été déplacée.
            <br />
            Vérifie l&rsquo;URL ou retourne à l&rsquo;accueil.
          </p>
          <div className="nf-actions">
            <Link to="/" className="btn-primary">
              ← Retour à l&rsquo;accueil
            </Link>
            <Link to="/projects" className="btn-secondary">
              Voir les projets
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
