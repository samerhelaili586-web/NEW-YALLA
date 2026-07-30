import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import AppShell from "../components/AppShell";
import { GlowingEffect } from "../components/GlowingEffect";
import "../styles/shared.css";
import "./Guide.css";

const DEFAULT_FLOW_STEPS = [
  { id: 0, title: "0. Préalable : Configuration des Workflows", role: "(Admin / Manager)", desc: "Configuration des statuts, rôles autorisés et champs obligatoires." },
  { id: 1, title: "1. Création du Projet Client", role: "(Admin / Manager)", desc: "Création du projet et définition des paramètres dans la section Projets." },
  { id: 2, title: "2. Création des Tâches à partir d'un Workflow", role: "(CM / Manager)", desc: "Ajout des tâches et association au Workflow correspondant." },
  { id: 3, title: "3. Planification Shooting & Matériel", role: "(Chef Prod / Manager)", desc: "Réservation du matériel (caméras, micros...) et heures d'équipe dans Planification." },
  { id: 4, title: "4. Réalisation & Saisie du Temps", role: "(Prod / CM / Chef Prod)", desc: "Production et déclaration obligatoire du temps de travail dans le délai paramétré par l'administration." },
  { id: 5, title: "5. Progression des Statuts & Validation", role: "(Parcours dynamique du Workflow)", desc: "Passage des étapes et validation des livrables (liens vidéo...)." },
  { id: 6, title: "6. Publication & Clôture de la Tâche", role: "(CM / Manager)", desc: "Vérification finale du projet et passage au statut FIN." },
];

const DEFAULT_SECTIONS = [
  {
    id: "step0",
    title: "📌 Étape 0 : Création & Configuration des Workflows (Types de Tâches)",
    body: "Avant de créer un projet ou d'assigner des tâches, l'**Admin Sys** ou le **Manager** configure les modèles de processus sous **Direction Générale ➔ Workflows (Types de tâches)**.\n\n- Définition des statuts et de la séquence logique (ex: *Début ➔ Shooting ➔ Montage ➔ Validation CM ➔ Final*).\n- Attribution des **rôles autorisés** pour chaque transition d'étape.\n- Configuration des **champs requis à la validation** (ex: Lien de la vidéo pour révision)."
  },
  {
    id: "step1_2",
    title: "📌 Étape 1 & 2 : Projets & Création des Tâches",
    body: "- **Projet Client** : Créé dans **Direction Générale ➔ Projets** par l'Admin ou le Manager.\n- **Création des Tâches** : Le CM ou le Manager crée les tâches et leur associe le Workflow adéquat. La tâche démarrée adopte automatiquement le schéma d'avancement du Workflow associé."
  },
  {
    id: "step3",
    title: "🎥 Étape 3 : Planification des Shootings & Matériel",
    body: "Pour chaque tournage, le **Chef Prod** ou le **Manager** programme la session dans **Planification** :\n\n- Sélection du **matériel réservé** (Caméra Sony FX3, RED Komodo, Trépied, Micro...).\n- Définition du **créneau horaire** et assignation des **membres de l'équipe Prod**.\n- Le système gère automatiquement les contrôles d'indisponibilité et les conflits de matériel."
  },
  {
    id: "step4",
    title: "⏱️ Étape 4 : Déclarations de Temps & Délais Réglementaires",
    body: "Chaque collaborateur (Prod, Chef Prod, CM) doit obligatoirement déclarer son temps de travail quotidien dans **Feuille de Présence** :\n\n- **Délai paramétré** : La saisie s'effectue dans la limite du délai de grâce configuré par l'administrateur du système (ex: J+1, J+2...). Passé ce délai de tolérance, la journée bascule au statut **Pénalisé**.\n- Seuil quotidien minimum : **6 heures (360 minutes)** par jour travaillé.\n- *L'Admin Sys et le Manager n'effectuent pas de déclaration d'heures.*"
  },
  {
    id: "roles",
    title: "👥 Matrice des Rôles YALLA",
    body: "Matrice des responsabilités principales de l'équipe :\n\n- **Admin Système** : Gestion globale, Workflows, Utilisateurs & Tarifs, Visibilité du Guide, Communiqués.\n- **Manager** : Gestion des Projets, Planification, Approbation des Congés, Suivi de la Présence.\n- **Chef Prod** : Planification des Shootings, Réservation Matériel, Exécution & Suivi Prod.\n- **Community Manager (CM)** : Création des Tâches, Suivi des Avancements, Validation des Livrables clients.\n- **Prod (Monteur / Cadrage)** : Exécution des tâches de production, Saisie du temps dans la limite du délai paramétré."
  },
  {
    id: "leave_ann",
    title: "🌴 Congés & Communiqués Internes",
    body: "- **Mes Congés & Demandes** : Soumission des demandes de congés ou maladie. Une fois approuvées par le Manager/Admin, le collaborateur apparaît avec le badge **Absent** dans l'Annuaire.\n- **Communiqués Internes** : Consultation des annonces officielles publiées par la direction. Possibilité de verrouiller (🔒) ses notifications importantes."
  }
];

function formatText(text) {
  if (!text) return "";
  let formatted = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  formatted = formatted.replace(/\*(.*?)\*/g, "<em>$1</em>");
  return <span dangerouslySetInnerHTML={{ __html: formatted }} />;
}

function renderSectionBody(bodyText) {
  if (!bodyText) return null;
  const lines = bodyText.split("\n");
  const elements = [];
  let currentList = [];

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) {
      if (currentList.length > 0) {
        elements.push(<ul key={`ul-${idx}`} className="guide-rendered-list">{currentList}</ul>);
        currentList = [];
      }
      return;
    }

    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const content = trimmed.substring(2);
      currentList.push(<li key={`li-${idx}`}>{formatText(content)}</li>);
    } else {
      if (currentList.length > 0) {
        elements.push(<ul key={`ul-${idx}`} className="guide-rendered-list">{currentList}</ul>);
        currentList = [];
      }
      elements.push(<p key={`p-${idx}`}>{formatText(trimmed)}</p>);
    }
  });

  if (currentList.length > 0) {
    elements.push(<ul key={`ul-end`} className="guide-rendered-list">{currentList}</ul>);
  }

  return elements;
}

export default function Guide() {
  const { user } = useAuth();
  const isAdmin = user?.effective_role === "admin_sys";

  const [guideData, setGuideData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  
  // Accordion collapsed states
  const [collapsedSections, setCollapsedSections] = useState({});
  const [diagramCollapsed, setDiagramCollapsed] = useState(false);

  // Admin Editing state
  const [editMode, setEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editVisible, setEditVisible] = useState(true);
  const [editSteps, setEditSteps] = useState(DEFAULT_FLOW_STEPS);
  const [editSections, setEditSections] = useState(DEFAULT_SECTIONS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadGuide() {
      setLoading(true);
      setLoadError("");
      try {
        const data = await api.get("/guide");
        setGuideData(data);
        setEditTitle(data.title || "");
        setEditVisible(data.is_visible ?? true);
        if (data.steps && Array.isArray(data.steps) && data.steps.length > 0) {
          setEditSteps(data.steps);
        } else {
          setEditSteps(DEFAULT_FLOW_STEPS);
        }
        
        if (data.content && data.content.trim().startsWith("[")) {
          setEditSections(JSON.parse(data.content));
        } else {
          setEditSections(DEFAULT_SECTIONS);
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 403) {
          setLoadError("Le guide d'équipe est actuellement masqué par l'administration.");
        } else {
          setLoadError("Impossible de charger le guide d'équipe.");
        }
      } finally {
        setLoading(false);
      }
    }
    loadGuide();
  }, []);

  function toggleSection(key) {
    setCollapsedSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }

  async function handleToggleVisibility() {
    if (!isAdmin || saving) return;
    const nextState = !editVisible;
    setSaving(true);
    try {
      const updated = await api.put("/guide", { is_visible: nextState });
      setGuideData(updated);
      setEditVisible(updated.is_visible);
    } catch {
      alert("Impossible de modifier la visibilité du guide.");
    } finally {
      setSaving(false);
    }
  }

  // Step editing functions
  function handleStepChange(index, field, value) {
    setEditSteps((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function handleSectionChange(id, field, value) {
    setEditSections((prev) =>
      prev.map((sec) => (sec.id === id ? { ...sec, [field]: value } : sec))
    );
  }

  function handleMoveStepUp(index) {
    if (index === 0) return;
    setEditSteps((prev) => {
      const next = [...prev];
      const temp = next[index - 1];
      next[index - 1] = next[index];
      next[index] = temp;
      return next;
    });
  }

  function handleMoveStepDown(index) {
    setEditSteps((prev) => {
      if (index === prev.length - 1) return prev;
      const next = [...prev];
      const temp = next[index + 1];
      next[index + 1] = next[index];
      next[index] = temp;
      return next;
    });
  }

  function handleDeleteStep(index) {
    if (editSteps.length <= 1) {
      alert("Vous devez conserver au moins une étape dans le circuit.");
      return;
    }
    setEditSteps((prev) => prev.filter((_, i) => i !== index));
  }

  function handleAddStep() {
    setEditSteps((prev) => [
      ...prev,
      {
        id: Date.now(),
        title: `${prev.length}. Nouvelle Étape`,
        role: "(Rôle)",
        desc: "Description de l'étape",
      },
    ]);
  }

  // Card sections ordering functions
  function handleAddSection() {
    setEditSections((prev) => [
      ...prev,
      {
        id: `sec-${Date.now()}`,
        title: "📌 Nouvelle Consigne / Section",
        body: "Description et détails de cette consigne."
      }
    ]);
  }

  function handleDeleteSection(id) {
    if (editSections.length <= 1) {
      alert("Vous devez conserver au moins une section.");
      return;
    }
    if (window.confirm("Supprimer cette section ?")) {
      setEditSections((prev) => prev.filter((sec) => sec.id !== id));
    }
  }

  function handleMoveSectionUp(index) {
    if (index === 0) return;
    setEditSections((prev) => {
      const next = [...prev];
      const temp = next[index - 1];
      next[index - 1] = next[index];
      next[index] = temp;
      return next;
    });
  }

  function handleMoveSectionDown(index) {
    setEditSections((prev) => {
      if (index === prev.length - 1) return prev;
      const next = [...prev];
      const temp = next[index + 1];
      next[index + 1] = next[index];
      next[index] = temp;
      return next;
    });
  }

  async function handleSaveEdit() {
    if (!isAdmin || saving) return;
    setSaving(true);
    try {
      const updated = await api.put("/guide", {
        title: guideData?.title || "Guide & Workflow d'équipe",
        content: JSON.stringify(editSections),
        is_visible: editVisible,
        steps: editSteps,
      });
      setGuideData(updated);
      setEditMode(false);
    } catch {
      alert("Erreur lors de l'enregistrement des modifications.");
    } finally {
      setSaving(false);
    }
  }

  const currentSteps = editMode ? editSteps : (guideData?.steps && guideData.steps.length > 0 ? guideData.steps : editSteps);
  const currentSections = editSections;

  return (
    <AppShell>
      <div className="guide-container">
        {/* Header */}
        <div className="guide-header">
          <div className="guide-title-box">
            <h1 className="guide-title">
              📘 {guideData?.title || "Guide & Workflow d'équipe"}
            </h1>
            <p className="guide-subtitle">
              Documentation officielle des processus de production, rôles et règles opérationnelles YALLA.
            </p>
          </div>

          {isAdmin && (
            <div className="guide-admin-actions">
              <button
                type="button"
                className={`guide-visibility-toggle ${editVisible ? "is-public" : "is-hidden"}`}
                onClick={handleToggleVisibility}
                disabled={saving}
                title="Cliquer pour changer la visibilité du guide pour l'équipe"
              >
                {editVisible ? "👁️ Visible pour l'équipe" : "🔒 Masqué (Admin uniquement)"}
              </button>

              <button
                type="button"
                className={editMode ? "btn-secondary" : "btn-primary"}
                onClick={() => {
                  if (editMode) {
                    setEditSteps(guideData?.steps || DEFAULT_FLOW_STEPS);
                    if (guideData?.content && guideData.content.trim().startsWith("[")) {
                      setEditSections(JSON.parse(guideData.content));
                    } else {
                      setEditSections(DEFAULT_SECTIONS);
                    }
                  }
                  setEditMode(!editMode);
                }}
              >
                {editMode ? "Quitter le mode édition" : "✏️ Modifier le guide & les étapes"}
              </button>
            </div>
          )}
        </div>

        {/* Notice when hidden */}
        {isAdmin && !editVisible && (
          <div className="guide-hidden-notice">
            <span>🔒</span>
            <span>
              <strong>Note Admin :</strong> Ce guide est actuellement <strong>Masqué</strong> pour les autres utilisateurs. Seuls les administrateurs peuvent le consulter et l'éditer. Cliquez sur le bouton ci-dessus pour le rendre visible à toute l'équipe.
            </span>
          </div>
        )}

        {/* Sticky Admin Edit Bar when Editing */}
        {editMode && (
          <div className="guide-edit-sticky-bar">
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "1.1rem" }}>✏️</span>
              <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--ink)" }}>
                Mode Édition Actif — Modifiez les schémas et le texte des consignes directement ci-dessous.
              </span>
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setEditSteps(guideData?.steps || DEFAULT_FLOW_STEPS);
                  if (guideData?.content && guideData.content.trim().startsWith("[")) {
                    setEditSections(JSON.parse(guideData.content));
                  } else {
                    setEditSections(DEFAULT_SECTIONS);
                  }
                  setEditMode(false);
                }}
                disabled={saving}
              >
                Annuler
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleSaveEdit}
                disabled={saving}
              >
                {saving ? "Enregistrement…" : "✓ Enregistrer les modifications"}
              </button>
            </div>
          </div>
        )}

        {loading && <p className="tt-status">Chargement du guide…</p>}
        {loadError && <p className="tt-status tt-status--error">{loadError}</p>}

        {!loading && !loadError && (
          <div className="guide-sections-grid">
            {/* Vertical Flowchart Diagram (Matching Uploaded Image + Glowing Blue Arrows) */}
            <div className="guide-diagram-box">
              <GlowingEffect spread={40} glow={true} disabled={false} proximity={64} inactiveZone={0.01} />
              <div 
                className="guide-diagram-header"
                onClick={() => setDiagramCollapsed(!diagramCollapsed)}
                style={{ cursor: "pointer", userSelect: "none" }}
              >
                <h2 className="guide-diagram-title">🔄 Schéma du Circuit de Production YALLA</h2>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                  {isAdmin && !editMode && (
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ fontSize: "0.78rem", padding: "0.3rem 0.65rem" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditMode(true);
                      }}
                    >
                      ✏️ Modifier les étapes
                    </button>
                  )}
                  <div className={`guide-section-toggle-btn${diagramCollapsed ? " is-collapsed" : ""}`}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </div>
                </div>
              </div>

              <div className={`guide-accordion-wrapper${diagramCollapsed ? " is-collapsed" : ""}`}>
                <div className="guide-accordion-inner">
                  <div className="guide-flow-vertical">
                    {currentSteps.map((step, idx) => (
                      <div key={step.id || idx} style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <div className="guide-flow-card">
                          {editMode ? (
                            /* Inline Visual Editor inside the card */
                            <>
                              <div className="guide-flow-card-edit-controls">
                                <span style={{ fontSize: "0.7rem", color: "#a1a1aa", marginRight: "auto", fontWeight: 700 }}>
                                  Étape #{idx}
                                </span>
                                <button
                                  type="button"
                                  className="guide-flow-card-edit-btn"
                                  onClick={() => handleMoveStepUp(idx)}
                                  disabled={idx === 0}
                                  title="Déplacer vers le haut"
                                >
                                  ▲
                                </button>
                                <button
                                  type="button"
                                  className="guide-flow-card-edit-btn"
                                  onClick={() => handleMoveStepDown(idx)}
                                  disabled={idx === currentSteps.length - 1}
                                  title="Déplacer vers le bas"
                                >
                                  ▼
                                </button>
                                <button
                                  type="button"
                                  className="guide-flow-card-edit-btn is-delete"
                                  onClick={() => handleDeleteStep(idx)}
                                  title="Supprimer cette étape"
                                >
                                  🗑️
                                </button>
                              </div>

                              <input
                                type="text"
                                className="guide-flow-input-title"
                                value={step.title || ""}
                                placeholder="Titre de l'étape"
                                onChange={(e) => handleStepChange(idx, "title", e.target.value)}
                              />
                              <input
                                type="text"
                                className="guide-flow-input-role"
                                value={step.role || ""}
                                placeholder="(Rôle concerné)"
                                onChange={(e) => handleStepChange(idx, "role", e.target.value)}
                              />
                              <input
                                type="text"
                                className="guide-flow-input-desc"
                                value={step.desc || ""}
                                placeholder="Description de l'action"
                                onChange={(e) => handleStepChange(idx, "desc", e.target.value)}
                              />
                            </>
                          ) : (
                            /* Read-only Step Card */
                            <>
                              <h3 className="guide-flow-card-title">{step.title}</h3>
                              <div className="guide-flow-card-role">{step.role}</div>
                              {step.desc && <div className="guide-flow-card-desc">{step.desc}</div>}
                            </>
                          )}
                        </div>

                        {/* Glowing Vertical Connector Arrow */}
                        {idx < currentSteps.length - 1 && (
                          <div className="guide-flow-arrow">
                            <div className="guide-flow-arrow-line"></div>
                            <div className="guide-flow-arrow-head"></div>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Add Step Button in Edit Mode */}
                    {editMode && (
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ marginTop: "1.25rem", background: "var(--paper)", borderColor: "var(--amber)", color: "var(--ink)", fontWeight: 700 }}
                        onClick={handleAddStep}
                      >
                        + Ajouter une étape au circuit
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Dynamic Collapsible Detailed Section Cards */}
            {currentSections.map((sec, secIdx) => (
              <div key={sec.id} className="guide-section-card">
                <GlowingEffect spread={40} glow={true} disabled={false} proximity={64} inactiveZone={0.01} />
                
                {editMode ? (
                  /* Edit Mode Header and Body inputs */
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px dashed rgba(255,255,255,0.1)", paddingBottom: "0.4rem" }}>
                      <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                        Section #{secIdx}
                      </span>
                      <div style={{ display: "flex", gap: "0.3rem" }}>
                        <button
                          type="button"
                          className="guide-flow-card-edit-btn"
                          onClick={() => handleMoveSectionUp(secIdx)}
                          disabled={secIdx === 0}
                          title="Déplacer vers le haut"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          className="guide-flow-card-edit-btn"
                          onClick={() => handleMoveSectionDown(secIdx)}
                          disabled={secIdx === currentSections.length - 1}
                          title="Déplacer vers le bas"
                        >
                          ▼
                        </button>
                        <button
                          type="button"
                          className="guide-flow-card-edit-btn is-delete"
                          onClick={() => handleDeleteSection(sec.id)}
                          title="Supprimer cette section"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                      <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Titre de la section</span>
                      <input
                        type="text"
                        className="guide-flow-input-title"
                        style={{ textAlign: "left", width: "100%", background: "var(--paper)", color: "var(--ink)" }}
                        value={sec.title || ""}
                        onChange={(e) => handleSectionChange(sec.id, "title", e.target.value)}
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                      <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Consignes & Liste (utiliser des tirets "-" pour faire des puces)</span>
                      <textarea
                        className="guide-edit-textarea"
                        style={{ minHeight: "140px", width: "100%", background: "var(--paper)", color: "var(--ink)", padding: "0.65rem" }}
                        value={sec.body || ""}
                        onChange={(e) => handleSectionChange(sec.id, "body", e.target.value)}
                      />
                    </div>
                  </div>
                ) : (
                  /* Read Only Mode with smooth collapsible accordion */
                  <>
                    <div className="guide-section-header" onClick={() => toggleSection(sec.id)}>
                      <h2>{sec.title}</h2>
                      <div className={`guide-section-toggle-btn${collapsedSections[sec.id] ? " is-collapsed" : ""}`}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                      </div>
                    </div>
                    <div className={`guide-accordion-wrapper${collapsedSections[sec.id] ? " is-collapsed" : ""}`}>
                      <div className="guide-accordion-inner">
                        <div className="guide-section-body">
                          {renderSectionBody(sec.body)}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}

            {/* Add Section Button in Edit Mode */}
            {editMode && (
              <button
                type="button"
                className="btn-primary"
                style={{ alignSelf: "center", margin: "1rem 0", padding: "0.6rem 1.5rem" }}
                onClick={handleAddSection}
              >
                + Ajouter une section / consigne
              </button>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
