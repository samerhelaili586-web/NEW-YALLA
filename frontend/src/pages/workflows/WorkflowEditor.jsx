import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import Modal from "../../components/Modal";
import "../../styles/shared.css";
import "./WorkflowEditor.css";

function NodeIcon({ type, color }) {
  if (type === "debut") {
    return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>;
  }
  if (type === "planification_shooting") {
    return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>;
  }
  if (type === "planification_montage" || type === "montage") {
    return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/></svg>;
  }
  if (type === "final_confirmation") {
    return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;
  }
  if (type === "final_rejet") {
    return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>;
  }
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const FUNCTIONAL_META = {
  debut:                  { label: "STATUT DE DÉBUT",          color: "#16a34a", bg: "#dcfce7", border: "#16a34a", text: "#064e3b" },
  intermediaire:          { label: "STATUT INTERMÉDIAIRE",      color: "#2563eb", bg: "#dbeafe", border: "#2563eb", text: "#1e3a8a" },
  planification_shooting: { label: "PLANIFICATION SHOOTING",   color: "#d97706", bg: "#fef3c7", border: "#d97706", text: "#78350f" },
  planification_montage:  { label: "PLANIFICATION DE MONTAGE", color: "#ea580c", bg: "#ffedd5", border: "#ea580c", text: "#7c2d12" },
  montage:                { label: "MONTAGE",                   color: "#7c3aed", bg: "#ede9fe", border: "#7c3aed", text: "#4c1d95" },
  final_confirmation:     { label: "FINAL DE CONFIRMATION",    color: "#059669", bg: "#d1fae5", border: "#059669", text: "#064e3b" },
  final_rejet:            { label: "FINAL DE REJET",           color: "#dc2626", bg: "#fee2e2", border: "#dc2626", text: "#7f1d1d" },
};


const ROLE_OPTIONS = [
  { value: "admin_sys",  label: "Admin Sys" },
  { value: "manager",   label: "Manager" },
  { value: "cm",        label: "CM" },
  { value: "prod",      label: "Prod" },
  { value: "chef_prod", label: "Chef Prod" },
];

const WORKFLOW_STATUS_OPTIONS = [
  { value: "draft",    label: "Brouillon" },
  { value: "active",   label: "Actif" },
  { value: "disabled", label: "Désactivé" },
];

const FIELD_TYPES = [
  { value: "text",   label: "Texte" },
  { value: "number", label: "Nombre" },
  { value: "date",   label: "Date" },
  { value: "select", label: "Liste" },
];

const NODE_W = 250;
const NODE_H = 135;
const DEFAULT_START_X = 160;
const DEFAULT_START_Y = 160;

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// ─── Helpers: smart port routing ─────────────────────────────────────────────
function nodeCenter(node) {
  return { x: node.pos_x + NODE_W / 2, y: node.pos_y + NODE_H / 2 };
}

// ─── Design constants ──────────────────────────────────────────────────────────
const SLOT_SPACING  = 28;   // px between parallel slots along a side
const MIN_TENSION   = 65;   // min bezier control-point pull distance
const MAX_TENSION   = 230;  // max
const TENSION_RATIO = 0.44; // fraction of distance used as tension

// ─── Core geometry helpers ─────────────────────────────────────────────────────
/** Center of a given side of a node. */
function sideCenterOf(node, side) {
  if (side === 'right')  return { x: node.pos_x + NODE_W,    y: node.pos_y + NODE_H / 2 };
  if (side === 'left')   return { x: node.pos_x,              y: node.pos_y + NODE_H / 2 };
  if (side === 'bottom') return { x: node.pos_x + NODE_W / 2, y: node.pos_y + NODE_H    };
  if (side === 'top')    return { x: node.pos_x + NODE_W / 2, y: node.pos_y             };
  return nodeCenter(node);
}

/** Pick best side pair by testing all 16 combinations; return the min-distance pair. */
function bestSidePair(fromNode, toNode) {
  const SIDES = ['right', 'left', 'bottom', 'top'];
  let best = { fromSide: 'right', toSide: 'left' }, bestDist = Infinity;
  for (const fs of SIDES) {
    for (const ts of SIDES) {
      const d = Math.hypot(
        sideCenterOf(toNode, ts).x   - sideCenterOf(fromNode, fs).x,
        sideCenterOf(toNode, ts).y   - sideCenterOf(fromNode, fs).y
      );
      if (d < bestDist) { bestDist = d; best = { fromSide: fs, toSide: ts }; }
    }
  }
  return best;
}

/**
 * Pre-compute all anchor points for all transitions in one pass.
 * Transitions between the same node pair share a side and get evenly-spaced
 * slot offsets along that side — no mid-air branching, no overlap.
 *
 * Returns a Map<transitionId, { p1, fromSide, p2, toSide }>
 */
function computeAllAnchors(statuses, transitions) {
  // Step 1 — find closest side pair for every transition
  const items = transitions.map(t => {
    const from = statuses.find(s => s.id === t.from_status_id);
    const to   = statuses.find(s => s.id === t.to_status_id);
    if (!from || !to) return null;
    const { fromSide, toSide } = bestSidePair(from, to);
    return { t, from, to, fromSide, toSide };
  }).filter(Boolean);

  // Step 2 — group by UNORDERED pair so A→B and B→A share the same side slots
  const pairMap = new Map();
  items.forEach(item => {
    const key = [item.t.from_status_id, item.t.to_status_id].sort().join('_');
    if (!pairMap.has(key)) pairMap.set(key, []);
    pairMap.get(key).push(item);
  });

  // Step 3 — within each pair, sort by id for stable order, then assign slots
  const anchorMap = new Map();
  pairMap.forEach(group => {
    group.sort((a, b) => a.t.id - b.t.id);
    const count = group.length;
    group.forEach((item, idx) => {
      const offset = (idx - (count - 1) / 2) * SLOT_SPACING;

      let p1 = { ...sideCenterOf(item.from, item.fromSide) };
      let p2 = { ...sideCenterOf(item.to,   item.toSide)   };

      // Slide the port along the side edge (not into/out of the card)
      if (item.fromSide === 'right' || item.fromSide === 'left') p1.y += offset;
      else                                                         p1.x += offset;
      if (item.toSide   === 'right' || item.toSide   === 'left') p2.y += offset;
      else                                                         p2.x += offset;

      anchorMap.set(item.t.id, { p1, fromSide: item.fromSide, p2, toSide: item.toSide });
    });
  });

  return anchorMap;
}

/**
 * Build a cubic Bezier path string. Control points exit perpendicular to port sides.
 * Tension is adaptive: grows with distance so nearby nodes curve gently,
 * distant nodes curve strongly.
 * Returns { d, c1x, c1y, c2x, c2y } for reuse in midpoint calculation.
 */
function makeBezier(p1, p2, fromSide, toSide) {
  const dx   = p2.x - p1.x;
  const dy   = p2.y - p1.y;
  const dist = Math.hypot(dx, dy) || 1;
  const t    = Math.max(MIN_TENSION, Math.min(dist * TENSION_RATIO, MAX_TENSION));

  let c1x = p1.x, c1y = p1.y;
  let c2x = p2.x, c2y = p2.y;

  if (fromSide === 'right')  c1x += t;
  if (fromSide === 'left')   c1x -= t;
  if (fromSide === 'bottom') c1y += t;
  if (fromSide === 'top')    c1y -= t;

  if (toSide === 'left')   c2x -= t;
  if (toSide === 'right')  c2x += t;
  if (toSide === 'top')    c2y -= t;
  if (toSide === 'bottom') c2y += t;

  return {
    d: `M ${p1.x} ${p1.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`,
    c1x, c1y, c2x, c2y,
  };
}

/** Accurate cubic Bezier midpoint at t=0.5. */
function bezierMid(p1, p2, fromSide, toSide) {
  const { c1x, c1y, c2x, c2y } = makeBezier(p1, p2, fromSide, toSide);
  // B(0.5) = 0.125·P0 + 0.375·C1 + 0.375·C2 + 0.125·P3
  return {
    x: 0.125 * p1.x + 0.375 * c1x + 0.375 * c2x + 0.125 * p2.x,
    y: 0.125 * p1.y + 0.375 * c1y + 0.375 * c2y + 0.125 * p2.y,
  };
}

/**
 * Legacy thin wrapper used by the live-draw preview only.
 * For committed transitions, use computeAllAnchors() instead.
 */
function getBestPorts(fromNode, toNode) {
  const { fromSide, toSide } = bestSidePair(fromNode, toNode);
  return {
    from: sideCenterOf(fromNode, fromSide), fromSide,
    to:   sideCenterOf(toNode,   toSide),   toSide,
  };
}

/** Alias kept for the live-draw path builder. */
function arrowPath(p1, p2, fromSide = 'right', toSide = 'left') {
  return makeBezier(p1, p2, fromSide, toSide).d;
}

function validateConfig(statuses, transitions) {
  const issues = [];
  const FINAL_TYPES = ["final_confirmation", "final_rejet"];

  // 1. Exactement un statut de début
  const startCount = statuses.filter(s => s.functional_type === "debut").length;
  if (startCount === 0) {
    issues.push("Aucun statut de début.");
  } else if (startCount > 1) {
    issues.push("Plusieurs statuts de début détectés (un seul est autorisé).");
  }

  // 2 & 6. Aucun statut orphelin (tout nœud non-final doit obligatoirement avoir au moins un successeur)
  statuses.forEach(s => {
    if (!FINAL_TYPES.includes(s.functional_type)) {
      const hasOutgoing = transitions.some(t => t.from_status_id === s.id);
      if (!hasOutgoing) {
        issues.push(`Statut non-final sans successeur : "${s.title}"`);
      }
    }
  });

  // 3. Pas de statuts évolutifs consécutifs
  transitions.forEach(t => {
    const from = statuses.find(s => s.id === t.from_status_id);
    const to = statuses.find(s => s.id === t.to_status_id);
    if (from && to && from.temporal_type === "evolutif" && to.temporal_type === "evolutif") {
      issues.push(`Statuts évolutifs consécutifs interdits : "${from.title}" → "${to.title}"`);
    }
  });

  // 4. Au moins un statut final confirmation
  const hasConfirm = statuses.some(s => s.functional_type === "final_confirmation");
  if (!hasConfirm) {
    issues.push("Au moins un statut final de confirmation est requis.");
  }

  // 5. Au moins un statut final rejet
  const hasRejet = statuses.some(s => s.functional_type === "final_rejet");
  if (!hasRejet) {
    issues.push("Au moins un statut final de rejet est requis.");
  }

  // Final status cannot have outgoing transitions
  statuses.forEach(s => {
    if (FINAL_TYPES.includes(s.functional_type)) {
      const hasOutgoing = transitions.some(t => t.from_status_id === s.id);
      if (hasOutgoing) {
        issues.push(`Le statut final "${s.title}" ne doit pas avoir de transition sortante.`);
      }
    }
  });

  // 7. Chaque transition doit être associée à au moins un rôle
  transitions.forEach(t => {
    const roles = t.allowed_roles || [];
    if (roles.length === 0) {
      const from = statuses.find(s => s.id === t.from_status_id);
      const to = statuses.find(s => s.id === t.to_status_id);
      const label = from && to ? `"${from.title}" → "${to.title}"` : `#${t.id}`;
      issues.push(`Transition sans rôle associé : ${label}`);
    }
  });

  return issues;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function WorkflowEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin_sys";

  // Workflow data
  const [workflow, setWorkflow] = useState(null);
  const [statuses, setStatuses] = useState([]);
  const [transitions, setTransitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // UI state
  const [wfName, setWfName] = useState("");
  const [wfStatus, setWfStatus] = useState("draft");
  const [wfDesc, setWfDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  // Canvas
  const canvasRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    return document.documentElement.classList.contains("dark") || localStorage.getItem("theme") === "dark";
  });

  const toggleTheme = () => {
    setIsDark(prev => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("theme", "light");
      }
      return next;
    });
  };


  const toggleFullscreen = useCallback(() => {
    const rootEl = document.querySelector(".we-root") || document.documentElement;
    if (!document.fullscreenElement) {
      if (rootEl.requestFullscreen) {
        rootEl.requestFullscreen().catch(() => {});
      } else if (rootEl.webkitRequestFullscreen) {
        rootEl.webkitRequestFullscreen();
      }
      setFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
      setFullscreen(false);
    }
  }, []);

  useEffect(() => {
    function handleFsChange() {
      setFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener("fullscreenchange", handleFsChange);
    document.addEventListener("webkitfullscreenchange", handleFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFsChange);
      document.removeEventListener("webkitfullscreenchange", handleFsChange);
    };
  }, []);

  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });

  // Drag node
  const draggingNode = useRef(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Drawing transition arrow
  const [drawing, setDrawing] = useState(null); // { fromId, curX, curY }
  const [snapTarget, setSnapTarget] = useState(null); // { node, port } while drawing
  const [isDraggingId, setIsDraggingId] = useState(null); // node being dragged

  // Selection
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [selectedTransition, setSelectedTransition] = useState(null);

  // Right panel form (node properties)
  const [propForm, setPropForm] = useState(null);
  const [propSaving, setPropSaving] = useState(false);

  // Transition modal
  const [transModal, setTransModal] = useState(null); // transition object
  const [transRoles, setTransRoles] = useState([]);
  const [transFields, setTransFields] = useState([]);
  const [transSaving, setTransSaving] = useState(false);
  const [transDeleting, setTransDeleting] = useState(false);

  // Create status modal
  const [createStatusOpen, setCreateStatusOpen] = useState(false);
  const [createStatusForm, setCreateStatusForm] = useState({
    title: "",
    functional_type: "debut",
    temporal_type: "evolutif",
  });
  const [createStatusError, setCreateStatusError] = useState("");
  const [createStatusSubmitting, setCreateStatusSubmitting] = useState(false);

  // Preview modal
  const [previewOpen, setPreviewOpen] = useState(false);

  // Auto-layout toggle state & backup ref
  const prevLayoutRef = useRef(null);
  const [isAutoLayoutApplied, setIsAutoLayoutApplied] = useState(false);

  // Grid snap toggle & Fit to screen
  const [snapToGrid, setSnapToGrid] = useState(false);

  const handleFitToScreen = useCallback(() => {
    if (!statuses || statuses.length === 0 || !canvasRef.current) return;
    const minX = Math.min(...statuses.map(s => s.pos_x));
    const minY = Math.min(...statuses.map(s => s.pos_y));
    const parent = canvasRef.current.parentElement;
    if (parent) {
      parent.scrollTo({
        left: Math.max(0, minX - 60),
        top: Math.max(0, minY - 60),
        behavior: "smooth",
      });
    }
  }, [statuses]);

  // ── Load workflow ─────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const data = await api.get(`/task-types/${id}`);
      setWorkflow(data);
      setWfName(data.name || "");
      setWfStatus(data.workflow_status || "draft");
      setWfDesc(data.description || "");
      const sts = data.statuses || [];
      setStatuses(sts);
      prevLayoutRef.current = null;
      setIsAutoLayoutApplied(false);
      // Flatten all transitions from all statuses
      const allT = sts.flatMap(s => (s.outgoing_transitions || []).map(t => ({
        ...t,
        from_status_title: s.title,
      })));
      setTransitions(allT);
    } catch {
      setLoadError("Impossible de charger le workflow.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // ── Config validation ─────────────────────────────────────────────────────
  const configIssues = workflow ? validateConfig(statuses, transitions) : [];
  const configValid = configIssues.length === 0;

  // ── Auto-switch status to "brouillon" (draft) if config has warnings ──────
  useEffect(() => {
    if (!configValid && wfStatus === "active") {
      setWfStatus("draft");
    }
  }, [configValid, wfStatus]);

  // ── Canvas size (auto-fit with padding) ──────────────────────────────────
  const canvasWidth = Math.max(1600, ...statuses.map(s => s.pos_x + NODE_W + 200));
  const canvasHeight = Math.max(1000, ...statuses.map(s => s.pos_y + NODE_H + 200));

  const handleAutoLayout = useCallback(() => {
    if (!statuses || statuses.length === 0) return;

    // Toggle: if already applied, revert to original layout before Auto-Layout
    if (isAutoLayoutApplied && prevLayoutRef.current) {
      const originalPositions = prevLayoutRef.current;
      setStatuses(prev => prev.map(s => {
        const orig = originalPositions.find(p => p.id === s.id);
        return orig ? { ...s, pos_x: orig.pos_x, pos_y: orig.pos_y } : s;
      }));
      prevLayoutRef.current = null;
      setIsAutoLayoutApplied(false);
      return;
    }

    // Backup current layout before applying auto-layout
    prevLayoutRef.current = statuses.map(s => ({ id: s.id, pos_x: s.pos_x, pos_y: s.pos_y }));
    setIsAutoLayoutApplied(true);

    const layers = { debut: [], planification: [], intermediaire: [], montage: [], final: [] };
    statuses.forEach(s => {
      const type = s.functional_type;
      if (type === "debut") layers.debut.push(s);
      else if (type.startsWith("planification")) layers.planification.push(s);
      else if (type === "montage") layers.montage.push(s);
      else if (type.startsWith("final")) layers.final.push(s);
      else layers.intermediaire.push(s);
    });

    const activeLayers = [layers.debut, layers.planification, layers.intermediaire, layers.montage, layers.final].filter(l => l.length > 0);
    const colSpacing = 300;
    const rowSpacing = 160;

    // Calculate relative grid positions for each status
    const relPositions = statuses.map(s => {
      let colIndex = 0;
      let rowIndex = 0;
      activeLayers.forEach((layer, lIdx) => {
        const idx = layer.findIndex(item => item.id === s.id);
        if (idx !== -1) { colIndex = lIdx; rowIndex = idx; }
      });
      const layerSize = activeLayers[colIndex]?.length || 1;
      const relX = colIndex * colSpacing;
      const relY = rowIndex * rowSpacing - ((layerSize - 1) * rowSpacing) / 2;
      return { id: s.id, relX, relY };
    });

    // Compute bounding dimensions of the entire workflow grid
    const minX = Math.min(...relPositions.map(r => r.relX));
    const maxX = Math.max(...relPositions.map(r => r.relX + NODE_W));
    const minY = Math.min(...relPositions.map(r => r.relY));
    const maxY = Math.max(...relPositions.map(r => r.relY + NODE_H));

    const graphW = maxX - minX;
    const graphH = maxY - minY;

    // Center layout dead-center in the middle of the canvas
    const targetCenterX = Math.max(800, canvasWidth / 2);
    const targetCenterY = Math.max(500, canvasHeight / 2);

    const startX = Math.max(100, targetCenterX - graphW / 2);
    const startY = Math.max(100, targetCenterY - graphH / 2);

    const updated = statuses.map(s => {
      const pos = relPositions.find(r => r.id === s.id);
      return {
        ...s,
        pos_x: Math.round(startX + (pos ? pos.relX - minX : 0)),
        pos_y: Math.round(startY + (pos ? pos.relY - minY : 0)),
      };
    });
    setStatuses(updated);
  }, [statuses, isAutoLayoutApplied, canvasWidth, canvasHeight]);


  // ── Drag node handling ───────────────────────────────────────────────────
  function onNodeMouseDown(e, nodeId) {
    if (!isAdmin) return;
    if (e.button !== 0) return;
    e.stopPropagation();
    const node = statuses.find(s => s.id === nodeId);
    if (!node) return;
    const rect = canvasRef.current.getBoundingClientRect();
    draggingNode.current = nodeId;
    setIsDraggingId(nodeId);
    dragOffset.current = {
      x: (e.clientX - rect.left) / zoom - node.pos_x,
      y: (e.clientY - rect.top) / zoom - node.pos_y,
    };
    setSelectedNodeId(nodeId);
    setPropForm({
      title: node.title,
      temporal_type: node.temporal_type,
      functional_type: node.functional_type,
    });
    setSelectedTransition(null);
  }

  function getClosestPort(node, cx, cy) {
    if (!node) return "left";
    const ports = [
      { name: "top", x: node.pos_x + NODE_W / 2, y: node.pos_y },
      { name: "bottom", x: node.pos_x + NODE_W / 2, y: node.pos_y + NODE_H },
      { name: "left", x: node.pos_x, y: node.pos_y + NODE_H / 2 },
      { name: "right", x: node.pos_x + NODE_W, y: node.pos_y + NODE_H / 2 },
    ];
    let minD = Infinity;
    let best = "left";
    for (const p of ports) {
      const d = (cx - p.x) ** 2 + (cy - p.y) ** 2;
      if (d < minD) {
        minD = d;
        best = p.name;
      }
    }
    return best;
  }

  function onCanvasMouseMove(e) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = (e.clientX - rect.left) / zoom;
    const cy = (e.clientY - rect.top) / zoom;

    if (draggingNode.current !== null) {
      const nodeId = draggingNode.current;
      const rawX = Math.max(20, cx - dragOffset.current.x);
      const rawY = Math.max(20, cy - dragOffset.current.y);
      const finalX = snapToGrid ? Math.round(rawX / 20) * 20 : rawX;
      const finalY = snapToGrid ? Math.round(rawY / 20) * 20 : rawY;
      setStatuses(prev => prev.map(s =>
        s.id === nodeId ? { ...s, pos_x: finalX, pos_y: finalY } : s
      ));
    }

    if (drawing) {
      setDrawing(d => ({ ...d, curX: cx, curY: cy }));
      // Detect snap target: node the cursor is hovering over while drawing
      const hover = statuses.find(s =>
        s.id !== drawing.fromId &&
        cx >= s.pos_x - 20 && cx <= s.pos_x + NODE_W + 20 &&
        cy >= s.pos_y - 20 && cy <= s.pos_y + NODE_H + 20
      );
      if (hover) {
        const port = getClosestPort(hover, cx, cy);
        setSnapTarget({ node: hover, port });
      } else {
        setSnapTarget(null);
      }
    }
  }

  function onCanvasMouseUp(e) {
    isPanning.current = false;
    draggingNode.current = null;
    setIsDraggingId(null);

    if (drawing) {
      const target = snapTarget?.node || (() => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return null;
        const cx = (e.clientX - rect.left) / zoom;
        const cy = (e.clientY - rect.top) / zoom;
        return statuses.find(s =>
          s.id !== drawing.fromId &&
          cx >= s.pos_x && cx <= s.pos_x + NODE_W &&
          cy >= s.pos_y && cy <= s.pos_y + NODE_H
        ) || null;
      })();

      if (target && target.id !== drawing.fromId) {
        createTransition(drawing.fromId, target.id);
      }
      setDrawing(null);
      setSnapTarget(null);
    }
  }

  // Close properties popup when clicking anywhere outside node/popup/modal
  useEffect(() => {
    function handleGlobalPointerDown(e) {
      if (!propForm) return;
      const isNode = e.target.closest(".we-node");
      const isArrow = e.target.closest(".we-arrow-group");
      const isProps = e.target.closest(".we-props-popup");
      const isModal = e.target.closest(".modal-backdrop") || e.target.closest(".modal");
      const isTopbar = e.target.closest(".we-topbar") || e.target.closest(".we-add-status-btn");

      if (!isNode && !isArrow && !isProps && !isModal && !isTopbar) {
        setSelectedNodeId(null);
        setPropForm(null);
        setSelectedTransition(null);
      }
    }

    window.addEventListener("pointerdown", handleGlobalPointerDown);
    return () => window.removeEventListener("pointerdown", handleGlobalPointerDown);
  }, [propForm]);

  // Pan on canvas background drag
  function onCanvasBgMouseDown(e) {
    const isNode = e.target.closest(".we-node");
    const isArrow = e.target.closest(".we-arrow-group");
    const isProps = e.target.closest(".we-props-popup");
    const isTopbarBtn = e.target.closest(".we-topbar") || e.target.closest(".we-icon-action-btn") || e.target.closest(".we-add-status-btn");

    if (!isNode && !isArrow && !isProps && !isTopbarBtn) {
      setSelectedNodeId(null);
      setPropForm(null);
      setSelectedTransition(null);
    }

    if (e.button === 1 || (e.button === 0 && !isNode && !isProps)) {
      isPanning.current = true;
      panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  }

  // ── Anchor drag (start drawing arrow) ───────────────────────────────────
  function onAnchorMouseDown(e, fromId) {
    if (!isAdmin) return;
    e.stopPropagation();
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = (e.clientX - rect.left) / zoom;
    const cy = (e.clientY - rect.top) / zoom;
    setDrawing({ fromId, curX: cx, curY: cy });
  }

  // ── Save all (positions + name/status) ──────────────────────────────────
  const savingRef = useRef(false);

  const handleSave = useCallback(async (isAuto = false) => {
    if (!id || !workflow || savingRef.current) return;
    savingRef.current = true;
    if (!isAuto) setSaving(true);
    try {
      // Save workflow meta
      await api.patch(`/task-types/${id}`, {
        name: wfName.trim() || workflow.name,
        workflow_status: wfStatus,
        description: wfDesc,
      });
      // Save all node positions
      await Promise.all(statuses.map(s =>
        api.patch(`/task-types/statuses/${s.id}`, { pos_x: s.pos_x, pos_y: s.pos_y })
      ));
      setSaveMsg(isAuto ? "Auto-enregistré ✓" : "Enregistré ✓");
      setTimeout(() => setSaveMsg(""), 2200);
    } catch {
      if (!isAuto) setSaveMsg("Erreur lors de l'enregistrement.");
    } finally {
      savingRef.current = false;
      if (!isAuto) setSaving(false);
    }
  }, [id, workflow, wfName, wfStatus, wfDesc, statuses]);

  // Auto-save every 10 seconds in the background without reloading the page
  const handleSaveRef = useRef(handleSave);
  useEffect(() => { handleSaveRef.current = handleSave; }, [handleSave]);

  useEffect(() => {
    if (!isAdmin || !workflow) return;
    const timer = setInterval(() => {
      if (handleSaveRef.current) {
        handleSaveRef.current(true);
      }
    }, 10000); // 10 seconds

    return () => clearInterval(timer);
  }, [isAdmin, workflow]);

  // ── Create transition ────────────────────────────────────────────────────
  async function createTransition(fromId, toId) {
    const fromStatus = statuses.find(s => s.id === fromId);
    if (fromStatus && ["final_confirmation", "final_rejet"].includes(fromStatus.functional_type)) return;
    const exists = transitions.find(t => t.from_status_id === fromId && t.to_status_id === toId);
    if (exists) return;
    try {
      const t = await api.post("/task-types/transitions", { from_status_id: fromId, to_status_id: toId });
      const fromTitle = statuses.find(s => s.id === fromId)?.title || "";
      setTransitions(prev => [...prev, { ...t, from_status_title: fromTitle }]);
    } catch (err) {
      if (err?.data?.error !== "transition_already_exists") {
        console.error("Transition creation failed", err);
      }
    }
  }



  // ── Create status from modal ─────────────────────────────────────────────
  function openCreateStatus() {
    setCreateStatusForm({ title: "", functional_type: "debut", temporal_type: "evolutif" });
    setCreateStatusError("");
    setCreateStatusOpen(true);
  }

  async function handleCreateStatusSubmit(e) {
    e.preventDefault();
    if (!createStatusForm.title.trim()) {
      setCreateStatusError("Le titre est requis.");
      return;
    }
    setCreateStatusSubmitting(true);
    setCreateStatusError("");
    const offsetX = DEFAULT_START_X + (statuses.length % 3) * (NODE_W + 60);
    const offsetY = DEFAULT_START_Y + Math.floor(statuses.length / 3) * (NODE_H + 80);
    try {
      const s = await api.post(`/task-types/${id}/statuses`, {
        title: createStatusForm.title.trim(),
        temporal_type: createStatusForm.temporal_type,
        functional_type: createStatusForm.functional_type,
        allowed_roles: [],
        pos_x: offsetX,
        pos_y: offsetY,
      });
      setStatuses(prev => [...prev, { ...s, outgoing_transitions: [] }]);
      setCreateStatusOpen(false);
    } catch {
      setCreateStatusError("Une erreur est survenue.");
    } finally {
      setCreateStatusSubmitting(false);
    }
  }


  // ── Node properties panel save ───────────────────────────────────────────
  async function handlePropSave() {
    if (!selectedNodeId || !propForm) return;
    setPropSaving(true);
    try {
      const updated = await api.patch(`/task-types/statuses/${selectedNodeId}`, {
        title: propForm.title,
        temporal_type: propForm.temporal_type,
        functional_type: propForm.functional_type,
      });
      setStatuses(prev => prev.map(s => s.id === selectedNodeId ? { ...s, ...updated } : s));
    } catch {
      // silently log
    } finally {
      setPropSaving(false);
    }
  }

  // ── Delete node ──────────────────────────────────────────────────────────
  async function handleDeleteNode() {
    if (!selectedNodeId) return;
    try {
      await api.delete(`/task-types/statuses/${selectedNodeId}`);
      setStatuses(prev => prev.filter(s => s.id !== selectedNodeId));
      setTransitions(prev => prev.filter(t => t.from_status_id !== selectedNodeId && t.to_status_id !== selectedNodeId));
      setSelectedNodeId(null);
      setPropForm(null);
    } catch (err) {
      if (err?.data?.error === "status_in_use") {
        alert("Ce statut est utilisé par des tâches existantes.");
      }
    }
  }

  // ── Transition modal ─────────────────────────────────────────────────────
  function openTransModal(t) {
    setSelectedTransition(t);
    setTransRoles(t.allowed_roles || []);
    setTransFields(t.form_fields || []);
    setTransModal(t);
    setSelectedNodeId(null);
    setPropForm(null);
  }

  function toggleTransRole(role) {
    setTransRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]);
  }

  function addTransField() {
    setTransFields(prev => [...prev, { id: uid(), type: "text", label: "" }]);
  }

  function updateTransField(fieldId, key, val) {
    setTransFields(prev => prev.map(f => f.id === fieldId ? { ...f, [key]: val } : f));
  }

  function removeTransField(fieldId) {
    setTransFields(prev => prev.filter(f => f.id !== fieldId));
  }

  async function handleTransSave() {
    if (!transModal) return;
    setTransSaving(true);
    try {
      const updated = await api.patch(`/task-types/transitions/${transModal.id}`, {
        allowed_roles: transRoles,
        form_fields: transFields,
      });
      setTransitions(prev => prev.map(t => t.id === transModal.id ? { ...t, ...updated } : t));
      setTransModal(null);
    } catch {
      alert("Erreur lors de l'enregistrement.");
    } finally {
      setTransSaving(false);
    }
  }

  async function handleTransDelete() {
    if (!transModal) return;
    setTransDeleting(true);
    try {
      await api.delete(`/task-types/transitions/${transModal.id}`);
      setTransitions(prev => prev.filter(t => t.id !== transModal.id));
      setTransModal(null);
    } catch {
      alert("Erreur lors de la suppression.");
    } finally {
      setTransDeleting(false);
    }
  }

  // ── Arrow click detection (midpoint) ────────────────────────────────────
  function onArrowClick(t) {
    if (!isAdmin) return;
    openTransModal(t);
  }

  // ── Zoom ─────────────────────────────────────────────────────────────────
  function zoomIn()  { setZoom(z => Math.min(z + 0.1, 2)); }
  function zoomOut() { setZoom(z => Math.max(z - 0.1, 0.3)); }

  // ── Render ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="we-loading">
        <p>Chargement du workflow…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="we-loading">
        <p style={{ color: "#dc2626" }}>{loadError}</p>
        <button className="btn-ghost" onClick={() => navigate("/workflows")}>← Retour</button>
      </div>
    );
  }

  const selectedNode = selectedNodeId ? statuses.find(s => s.id === selectedNodeId) : null;

  return (
    <div className={`we-root${fullscreen ? " we-fullscreen" : ""}`}>
      {/* ── Top bar ───────────────────────────────────────────────────── */}
      <div className="we-topbar">
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <button className="we-back-btn" onClick={() => navigate("/workflows")} title="Retour">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Retour
          </button>

          <button
            type="button"
            className="we-theme-btn"
            onClick={toggleTheme}
            title={isDark ? "Passer en mode clair" : "Passer en mode sombre"}
            style={{
              display: "flex",
              alignItems: "center",
              justify: "center",
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              border: "1px solid var(--line)",
              background: "var(--card)",
              color: "var(--text)",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            {isDark ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/>
                <line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
              </svg>
            )}
          </button>
        </div>

        <div className="we-topbar-center">
          {isAdmin ? (
            <input
              className="we-name-input"
              value={wfName}
              onChange={e => setWfName(e.target.value)}
              placeholder="Nom du workflow"
            />
          ) : (
            <span className="we-name-label">{wfName}</span>
          )}
          {isAdmin && (
            <select
              className="we-status-select"
              value={wfStatus}
              onChange={e => {
                const nextVal = e.target.value;
                if (nextVal === "active" && !configValid) {
                  alert("Impossible d'activer ce workflow : la configuration comporte des avertissements.");
                  return;
                }
                setWfStatus(nextVal);
              }}
            >
              {WORKFLOW_STATUS_OPTIONS.map(o => {
                const isOptionDisabled = o.value === "active" && !configValid;
                return (
                  <option key={o.value} value={o.value} disabled={isOptionDisabled}>
                    {o.label}{isOptionDisabled ? " (Invalide)" : ""}
                  </option>
                );
              })}
            </select>
          )}
        </div>

        <div className="we-topbar-right">
          {/* Config indicator */}
          <div className={`we-config-badge${configValid ? " we-config-badge--ok" : " we-config-badge--warn"}`}>
            {configValid ? (
              <><svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> Config valide</>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                {configIssues.length} avertissement{configIssues.length > 1 ? "s" : ""}
                
                {/* Floating hover tooltip showing the exact validation issues */}
                <div className="we-config-tooltip">
                  <div className="we-config-tooltip-header">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round"/></svg>
                    Problèmes détectés ({configIssues.length})
                  </div>
                  <ul className="we-config-tooltip-list">
                    {configIssues.map((issue, idx) => (
                      <li key={idx} className="we-config-tooltip-item">
                        <span className="we-config-tooltip-dot" />
                        <span>{issue}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </div>

          {/* Zoom */}
          <div className="we-zoom-controls">
            <button className="we-zoom-btn" onClick={zoomOut} title="Zoom -">−</button>
            <span className="we-zoom-val">{Math.round(zoom * 100)}%</span>
            <button className="we-zoom-btn" onClick={zoomIn} title="Zoom +">+</button>
          </div>

          <button className="we-icon-action-btn" onClick={toggleFullscreen} title={fullscreen ? "Quitter plein écran" : "Plein écran"}>
            {fullscreen
              ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M8 3H5a2 2 0 00-2 2v3M21 8V5a2 2 0 00-2-2h-3M16 21h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
              : <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            }
          </button>


          <button className="we-icon-action-btn" onClick={() => setPreviewOpen(true)} title="Aperçu">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="1.8"/><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8"/></svg>
            Aperçu
          </button>

          <button
            className={`we-icon-action-btn${isAutoLayoutApplied ? " is-active" : ""}`}
            onClick={handleAutoLayout}
            title={isAutoLayoutApplied ? "Restaurer la disposition initiale" : "Organiser automatiquement les nœuds du workflow"}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 2l2.4 5.4 5.6.8-4 4.1 1 5.7-5-2.8-5 2.8 1-5.7-4-4.1 5.6-.8z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            {isAutoLayoutApplied ? "Auto-Layout (Actif)" : "Auto-Layout"}
          </button>


          {isAdmin && (
            <>
              <button className="we-add-status-btn" onClick={openCreateStatus}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg>
                Créer un statut
              </button>
              <button className="we-save-btn" onClick={handleSave} disabled={saving}>
                {saving ? "Enregistrement…" : saveMsg || "Enregistrer"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Description row ───────────────────────────────────────────── */}
      {(wfDesc || workflow?.description) && (
        <div className="we-desc-bar">{wfDesc || workflow?.description}</div>
      )}

      {/* ── Main body ─────────────────────────────────────────────────── */}
      <div className="we-body">

        {/* Center canvas */}
        <div className="we-canvas-wrap">
          {/* Footer Stats Bar */}
          <div className="we-footer-stats">
            <div className="we-stats-group">
              <div className="we-stat-pill">
                <div className="we-stat-dot we-stat-dot--emerald" />
                <span>{statuses.length} {statuses.length === 1 ? "Étape" : "Étapes"}</span>
              </div>
              <div className="we-stat-pill">
                <div className="we-stat-dot we-stat-dot--primary" />
                <span>{transitions.length} {transitions.length === 1 ? "Transition" : "Transitions"}</span>
              </div>
            </div>
            <div className="we-stats-hint">
              Glissez les nœuds pour les repositionner · Glissez l'ancre ⊕ pour connecter
            </div>
          </div>

          <div
            className="we-canvas-scroll"
            ref={canvasRef}
            onMouseDown={onCanvasBgMouseDown}
            onMouseMove={onCanvasMouseMove}
            onMouseUp={onCanvasMouseUp}
            onMouseLeave={onCanvasMouseUp}
          >
            <div
              className="we-canvas-inner"
              style={{
                width: canvasWidth,
                height: canvasHeight,
                transform: `scale(${zoom})`,
                transformOrigin: "0 0",
              }}
            >
              {/* Dot grid background */}
              <svg
                className="we-canvas-grid"
                width={canvasWidth}
                height={canvasHeight}
                style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
              >
                <defs>
                  <pattern id="dotgrid" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
                    <circle cx="1" cy="1" r="1" fill="var(--line)" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#dotgrid)" />
              </svg>

              {/* SVG arrows overlay */}
              <svg
                className="we-arrows-svg"
                width={canvasWidth}
                height={canvasHeight}
                style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
              >
                <defs>
                  {/* ── Refined filled arrowhead (sharp, clean, Figma-inspired) ── */}
                  <marker id="arrowhead"     markerWidth="8" markerHeight="8" refX="5" refY="4" orient="auto" markerUnits="strokeWidth">
                    <path d="M1,1 L7,4 L1,7 Z" fill="#6b7fa3" stroke="none" />
                  </marker>
                  <marker id="arrowhead-sel" markerWidth="8" markerHeight="8" refX="5" refY="4" orient="auto" markerUnits="strokeWidth">
                    <path d="M1,1 L7,4 L1,7 Z" fill="var(--primary)" stroke="none" />
                  </marker>
                  <marker id="arrowhead-hov" markerWidth="8" markerHeight="8" refX="5" refY="4" orient="auto" markerUnits="strokeWidth">
                    <path d="M1,1 L7,4 L1,7 Z" fill="#94a3b8" stroke="none" />
                  </marker>
                  <marker id="arrowhead-drawing" markerWidth="8" markerHeight="8" refX="5" refY="4" orient="auto" markerUnits="strokeWidth">
                    <path d="M1,1 L7,4 L1,7 Z" fill="var(--primary)" stroke="none" />
                  </marker>

                  {/* ── SVG filters ── */}
                  <filter id="arrowGlow" x="-40%" y="-40%" width="180%" height="180%">
                    <feGaussianBlur stdDeviation="2.5" result="blur"/>
                    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                  </filter>
                  <filter id="selGlow" x="-60%" y="-60%" width="220%" height="220%">
                    <feGaussianBlur stdDeviation="5" result="blur"/>
                    <feFlood floodColor="var(--primary)" floodOpacity="0.3" result="color"/>
                    <feComposite in="color" in2="blur" operator="in" result="shadow"/>
                    <feMerge><feMergeNode in="shadow"/><feMergeNode in="SourceGraphic"/></feMerge>
                  </filter>
                  <filter id="snapGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="4" result="blur"/>
                    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                  </filter>

                  {/* ── Per-edge linear gradient defs (uses pre-computed anchors) ── */}
                  {(() => {
                    const aMap = computeAllAnchors(statuses, transitions);
                    return transitions.map(t => {
                      const anchor = aMap.get(t.id);
                      if (!anchor) return null;
                      const { p1, p2 } = anchor;
                      const isSelected = selectedTransition?.id === t.id;
                      if (isSelected) return null; // handled separately
                      return (
                        <linearGradient key={`grad-${t.id}`} id={`edge-grad-${t.id}`}
                          gradientUnits="userSpaceOnUse"
                          x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                        >
                          <stop offset="0%"   stopColor="#3d5070" />
                          <stop offset="100%" stopColor="#6b7fa3" />
                        </linearGradient>
                      );
                    });
                  })()}
                  {selectedTransition && (() => {
                    const aMap = computeAllAnchors(statuses, transitions);
                    const anchor = aMap.get(selectedTransition.id);
                    if (!anchor) return null;
                    const { p1, p2 } = anchor;
                    return (
                      <linearGradient key="grad-sel" id="edge-grad-sel"
                        gradientUnits="userSpaceOnUse"
                        x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                      >
                        <stop offset="0%"   stopColor="var(--primary)" stopOpacity="0.75" />
                        <stop offset="100%" stopColor="var(--primary)" />
                      </linearGradient>
                    );
                  })()}
                </defs>

                {/* Pre-compute all anchors once for this render */}
                {(() => {
                  const anchorMap = computeAllAnchors(statuses, transitions);
                  return transitions.map(t => {
                    const anchor = anchorMap.get(t.id);
                    if (!anchor) return null;
                    const { p1, fromSide, p2, toSide } = anchor;
                    const { d: pathData } = makeBezier(p1, p2, fromSide, toSide);
                    const { x: midX, y: midY } = bezierMid(p1, p2, fromSide, toSide);
                    const isSelected = selectedTransition?.id === t.id;
                    const roleCount  = (t.allowed_roles || []).length;
                    const hasRoles   = roleCount > 0;

                  return (
                    <g
                      key={t.id}
                      className={`we-arrow-group${isSelected ? ' we-arrow-selected' : ''}`}
                      style={{ pointerEvents: "auto", cursor: isAdmin ? "pointer" : "default" }}
                      onClick={() => onArrowClick(t)}
                    >
                      {/* ── Wide invisible hit area ── */}
                      <path d={pathData} stroke="transparent" strokeWidth={24} fill="none" />

                      {/* ── Glow halo when selected ── */}
                      {isSelected && (
                        <path
                          d={pathData} fill="none"
                          stroke="var(--primary)" strokeWidth={6}
                          opacity={0.18} filter="url(#selGlow)"
                          strokeLinecap="round"
                        />
                      )}

                      {/* ── Main edge stroke (gradient) ── */}
                      <path
                        className="we-arrow-path"
                        d={pathData}
                        stroke={isSelected ? `url(#edge-grad-sel)` : `url(#edge-grad-${t.id})`}
                        strokeWidth={isSelected ? 2.2 : 1.6}
                        fill="none"
                        markerEnd={isSelected ? "url(#arrowhead-sel)" : "url(#arrowhead)"}
                        strokeLinecap="round"
                        style={{ transition: "stroke-width 0.18s ease" }}
                      />

                      {/* ── Midpoint label / badge ── */}
                      <g className="we-arrow-badge" transform={`translate(${midX}, ${midY})`}>
                        {hasRoles ? (
                          <>
                            {/* pill background */}
                            <rect
                              x={-14} y={-9.5}
                              width={28} height={19}
                              rx={9.5}
                              fill={isSelected ? "var(--primary)" : "#1a2235"}
                              stroke={isSelected ? "rgba(255,255,255,0.45)" : "#4a5a78"}
                              strokeWidth={1.2}
                              filter={isSelected ? "url(#arrowGlow)" : undefined}
                              style={{ transition: "fill 0.18s ease" }}
                            />
                            {/* role count number */}
                            <text
                              textAnchor="middle" dominantBaseline="middle" y={0.5}
                              fontSize="9.5" fontWeight="700" fill="white"
                              style={{ pointerEvents: "none", userSelect: "none", letterSpacing: "0.5px" }}
                            >
                              {roleCount}
                            </text>
                          </>
                        ) : (
                          /* simple dot for open transitions */
                          <circle
                            className="we-arrow-dot"
                            r={4}
                            fill={isSelected ? "var(--primary)" : "#2a3a55"}
                            stroke={isSelected ? "rgba(255,255,255,0.6)" : "#4a5a78"}
                            strokeWidth={1.2}
                            style={{ transition: "fill 0.18s ease" }}
                          />
                        )}
                      </g>
                    </g>
                    );
                  });
                })()}

                {/* Live drawing arrow with snap preview */}
                {drawing && (() => {
                  const fromNode = statuses.find(s => s.id === drawing.fromId);
                  if (!fromNode) return null;

                  let p1, fromSide, p2x, p2y;
                  if (snapTarget) {
                    // Snap: use smart ports between from node and snap target
                    const ports = getBestPorts(fromNode, snapTarget.node);
                    p1 = ports.from; fromSide = ports.fromSide;
                    p2x = snapTarget.port.x; p2y = snapTarget.port.y;
                  } else {
                    p1 = { x: fromNode.pos_x + NODE_W, y: fromNode.pos_y + NODE_H / 2 };
                    fromSide = 'right';
                    p2x = drawing.curX; p2y = drawing.curY;
                  }

                  const p2 = { x: p2x, y: p2y };
                  return (
                    <>
                      <path
                        d={arrowPath(p1, p2, fromSide, snapTarget?.port?.side || 'left')}
                        stroke="var(--primary)"
                        strokeWidth={2.2}
                        strokeDasharray="8 4"
                        fill="none"
                        markerEnd="url(#arrowhead-drawing)"
                        style={{ animation: "dashFlow 0.4s linear infinite" }}
                      />
                      {/* Snap port indicator */}
                      {snapTarget && (
                        <circle
                          cx={snapTarget.port.x}
                          cy={snapTarget.port.y}
                          r={7}
                          fill="var(--primary)"
                          opacity={0.9}
                          filter="url(#snapGlow)"
                          style={{ animation: "snapPulse 0.5s ease infinite alternate" }}
                        />
                      )}
                    </>
                  );
                })()}
              </svg>

              {/* Nodes */}
              {statuses.map(node => {
                const meta = FUNCTIONAL_META[node.functional_type] || FUNCTIONAL_META.intermediaire;
                const isSelected = selectedNodeId === node.id;
                const isDragging = isDraggingId === node.id;
                const isSnapTarget = snapTarget?.node?.id === node.id;
                const outgoingCount = transitions.filter(t => t.from_status_id === node.id).length;

                return (
                  <motion.div
                    key={node.id}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.2 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={[
                      'we-node',
                      'group/node',
                      isSelected   ? 'we-node--selected'    : '',
                      isDragging   ? 'we-node--dragging'    : '',
                      isSnapTarget ? 'we-node--snap-target' : '',
                    ].filter(Boolean).join(' ')}
                    style={{
                      left: node.pos_x,
                      top: node.pos_y,
                      borderColor: isSnapTarget ? 'var(--primary)' : isSelected ? meta.border : meta.border + '66',
                      background: meta.bg,
                    }}
                    onMouseDown={e => onNodeMouseDown(e, node.id)}
                  >
                    <div className="we-node-header">
                      <div className="we-node-icon-box" style={{ borderColor: meta.border + "44", background: meta.bg }}>
                        <NodeIcon type={node.functional_type} color={meta.color} />
                      </div>
                      <div className="we-node-header-text">
                        <span className="we-node-type-badge" style={{ color: meta.color, borderColor: meta.border + "33" }}>
                          {meta.label}
                        </span>
                        <h3 className="we-node-title" style={{ color: meta.text || "#0f172a" }}>{node.title}</h3>
                      </div>
                    </div>

                    <div className="we-node-meta-row">
                      <span className="we-node-badge">
                        {node.temporal_type === 'fige'
                          ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.8"/><path d="M8 11V7a4 4 0 018 0v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                          : <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/><path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                        }
                        {node.temporal_type === 'fige' ? 'Figé' : 'Évolutif'}
                      </span>
                    </div>

                    {/* Outgoing anchor */}
                    {isAdmin && (
                      <div
                        className="we-node-anchor"
                        onMouseDown={e => onAnchorMouseDown(e, node.id)}
                        title="Glisser pour créer une transition"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                          <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                        </svg>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Floating Side Popup Overlay for status properties */}
          <AnimatePresence>
            {propForm && (
              <motion.div
                key="props-side-popup"
                className="we-props-popup"
                initial={{ opacity: 0, x: 50, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 50, scale: 0.95 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem", paddingBottom: "0.4rem", borderBottom: "1px solid var(--line)" }}>
              <span style={{ fontSize: "0.72rem", fontWeight: "700", letterSpacing: "0.08em", color: "var(--text-muted)", textTransform: "uppercase" }}>PROPRIÉTÉS DE L'ÉTAPE</span>
              <button
                type="button"
                onClick={() => { setSelectedNodeId(null); setPropForm(null); }}
                style={{ background: "transparent", border: "none", fontSize: "1.2rem", color: "var(--text-muted)", cursor: "pointer", lineHeight: 1 }}
                title="Fermer"
              >
                ×
              </button>
            </div>

            <div className="we-props-form" style={{ padding: 0 }}>
              <div className="we-props-field">
                <label>Titre</label>
                <input
                  className="we-props-input"
                  value={propForm.title}
                  onChange={e => setPropForm(f => ({ ...f, title: e.target.value }))}
                  disabled={!isAdmin}
                />
              </div>

              <div className="we-props-field">
                <label>Type temporel</label>
                <select
                  className="we-props-select"
                  value={propForm.temporal_type}
                  onChange={e => setPropForm(f => ({ ...f, temporal_type: e.target.value }))}
                  disabled={!isAdmin}
                >
                  <option value="evolutif">Évolutif</option>
                  <option value="fige">Figé</option>
                </select>
              </div>

              <div className="we-props-field">
                <label>Type fonctionnel</label>
                <select
                  className="we-props-select"
                  value={propForm.functional_type}
                  onChange={e => setPropForm(f => ({ ...f, functional_type: e.target.value }))}
                  disabled={!isAdmin}
                >
                  {Object.entries(FUNCTIONAL_META).map(([v, m]) => (
                    <option key={v} value={v}>{m.label}</option>
                  ))}
                </select>
              </div>

              {isAdmin && (
                <div className="we-props-actions">
                  <button className="btn-danger-sm" onClick={handleDeleteNode}>Supprimer</button>
                  <button className="btn-primary-sm" onClick={handlePropSave} disabled={propSaving}>
                    {propSaving ? "…" : "Enregistrer"}
                  </button>
                </div>
              )}

              {/* Connected Transitions & Allowed Roles section */}
              {selectedNodeId && (() => {
                const outgoing = transitions.filter(t => t.from_status_id === selectedNodeId);
                const incoming = transitions.filter(t => t.to_status_id === selectedNodeId);
                const ROLE_LABEL_MAP = { admin_sys: "Admin", manager: "Manager", cm: "CM", prod: "Prod", chef_prod: "Chef Prod" };

                return (
                  <div className="we-props-transitions-section" style={{ marginTop: "1rem", paddingTop: "0.75rem", borderTop: "1px solid var(--line)" }}>
                    <div className="we-props-sub-title" style={{ fontSize: "0.72rem", fontWeight: "700", letterSpacing: "0.05em", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "0.5rem" }}>
                      Qui peut faire évoluer ce statut ?
                    </div>

                    {/* Outgoing arrows */}
                    <div style={{ marginBottom: "0.75rem" }}>
                      <span style={{ fontSize: "0.75rem", fontWeight: "600", color: "var(--ink)", display: "block", marginBottom: "0.3rem" }}>
                        ➔ Transitions sortantes ({outgoing.length})
                      </span>
                      {outgoing.length === 0 ? (
                        <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Aucune transition sortante.</span>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                          {outgoing.map(t => {
                            const targetStatus = statuses.find(s => s.id === t.to_status_id);
                            const roles = t.allowed_roles && t.allowed_roles.length > 0
                              ? t.allowed_roles.map(r => ROLE_LABEL_MAP[r] || r).join(", ")
                              : "Manager, Admin Sys (défaut)";
                            return (
                              <div
                                key={t.id}
                                onClick={() => openTransModal(t)}
                                style={{
                                  padding: "0.45rem 0.6rem",
                                  borderRadius: "8px",
                                  background: "var(--paper)",
                                  border: "1px solid var(--line)",
                                  cursor: "pointer",
                                  transition: "border-color 0.12s, background 0.12s",
                                }}
                                className="we-props-trans-item"
                                title="Cliquer pour configurer cette transition"
                              >
                                <div style={{ fontSize: "0.8rem", fontWeight: "600", color: "var(--primary)", marginBottom: "0.15rem" }}>
                                  ➔ {targetStatus?.title || "Statut cible"}
                                </div>
                                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                                  Rôles : <strong>{roles}</strong>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Incoming arrows */}
                    <div>
                      <span style={{ fontSize: "0.75rem", fontWeight: "600", color: "var(--ink)", display: "block", marginBottom: "0.3rem" }}>
                        ← Transitions entrantes ({incoming.length})
                      </span>
                      {incoming.length === 0 ? (
                        <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Aucune transition entrante.</span>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                          {incoming.map(t => {
                            const sourceStatus = statuses.find(s => s.id === t.from_status_id);
                            const roles = t.allowed_roles && t.allowed_roles.length > 0
                              ? t.allowed_roles.map(r => ROLE_LABEL_MAP[r] || r).join(", ")
                              : "Manager, Admin Sys (défaut)";
                            return (
                              <div
                                key={t.id}
                                onClick={() => openTransModal(t)}
                                style={{
                                  padding: "0.45rem 0.6rem",
                                  borderRadius: "8px",
                                  background: "var(--paper)",
                                  border: "1px solid var(--line)",
                                  cursor: "pointer",
                                  transition: "border-color 0.12s, background 0.12s",
                                }}
                                className="we-props-trans-item"
                                title="Cliquer pour configurer cette transition"
                              >
                                <div style={{ fontSize: "0.8rem", fontWeight: "600", color: "var(--ink)", marginBottom: "0.15rem" }}>
                                  ← {sourceStatus?.title || "Statut source"}
                                </div>
                                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                                  Rôles : <strong>{roles}</strong>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
        </div>
      </div>

      {/* ── Transition Modal ──────────────────────────────────────────── */}

      <Modal
        open={!!transModal}
        onClose={() => !transSaving && !transDeleting && setTransModal(null)}
        title={transModal ? `${transModal.from_status_title} → ${transModal.to_status_title}` : "Transition"}
        width={560}
      >
        {transModal && (
          <>
            {/* Role chips */}
            <div className="we-trans-section">
              <div className="we-trans-section-title">Rôles autorisés à déclencher la transition</div>
              <p className="we-trans-hint">
                Sélectionnez les rôles qui peuvent faire passer une tâche de « {transModal.from_status_title} » à « {transModal.to_status_title} ».
              </p>
              <div className="we-trans-chips">
                {ROLE_OPTIONS.map(r => {
                  const on = transRoles.includes(r.value);
                  return (
                    <button
                      key={r.value}
                      type="button"
                      className={`we-chip we-chip--lg${on ? " we-chip--on" : ""}`}
                      onClick={() => isAdmin && toggleTransRole(r.value)}
                      disabled={!isAdmin}
                    >
                      {r.label}
                    </button>
                  );
                })}
              </div>
              {transRoles.length === 0 && (
                <p className="we-trans-empty-hint">Aucun rôle sélectionné — seuls Manager et Admin Sys pourront déclencher cette transition.</p>
              )}
            </div>

            {/* Form fields */}
            <div className="we-trans-section">
              <div className="we-trans-form-header">
                <div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ marginRight: "0.35rem", verticalAlign: "middle" }}><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.8"/><path d="M7 9h10M7 13h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                  <span className="we-trans-section-title" style={{ display: "inline" }}>Formulaire de transition</span>
                </div>
                {isAdmin && (
                  <button className="we-add-field-btn" onClick={addTransField}>+ Ajouter un champ</button>
                )}
              </div>
              <p className="we-trans-hint">Champs à remplir par l'utilisateur lors du passage de transition. Optionnel.</p>

              {transFields.length === 0 ? (
                <div className="we-trans-empty-fields">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" stroke="var(--line)" strokeWidth="1.5"/><path d="M8 10h8M8 14h5" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  <p>Aucun champ. La transition se fera sans formulaire.</p>
                </div>
              ) : (
                <div className="we-trans-fields-list">
                  {transFields.map(f => (
                    <div key={f.id} className="we-trans-field-row">
                      <select
                        className="we-props-select"
                        value={f.type}
                        onChange={e => updateTransField(f.id, "type", e.target.value)}
                        disabled={!isAdmin}
                        style={{ width: "110px", flexShrink: 0 }}
                      >
                        {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                      <input
                        className="we-props-input"
                        style={{ flex: 1 }}
                        placeholder="Libellé du champ"
                        value={f.label}
                        onChange={e => updateTransField(f.id, "label", e.target.value)}
                        disabled={!isAdmin}
                      />
                      {isAdmin && (
                        <button className="we-field-del-btn" onClick={() => removeTransField(f.id)} title="Supprimer">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {isAdmin && (
              <div className="we-trans-footer">
                <button className="we-trans-delete-btn" onClick={handleTransDelete} disabled={transDeleting || transSaving}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Supprimer
                </button>
                <div style={{ display: "flex", gap: "0.6rem" }}>
                  <button className="btn-ghost" onClick={() => setTransModal(null)} disabled={transSaving}>Annuler</button>
                  <button className="btn-primary" onClick={handleTransSave} disabled={transSaving}>{transSaving ? "…" : "Enregistrer"}</button>
                </div>
              </div>
            )}
          </>
        )}
      </Modal>

      {/* ── Preview Modal ─────────────────────────────────────────────── */}
      <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} title={`Aperçu — ${wfName}`} width={900}>
        <div style={{ overflowX: "auto", padding: "0.5rem 0" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "flex-start", padding: "0.5rem" }}>
            {statuses.map(node => {
              const meta = FUNCTIONAL_META[node.functional_type] || FUNCTIONAL_META.intermediaire;
              return (
                <div key={node.id} style={{ border: `2px solid ${meta.border}`, borderRadius: "10px", background: meta.bg, padding: "0.7rem 1rem", minWidth: "150px" }}>
                  <div style={{ fontSize: "0.65rem", fontWeight: 700, color: meta.color, letterSpacing: "0.05em", marginBottom: "0.3rem" }}>{meta.label}</div>
                  <div style={{ fontWeight: 600, color: meta.border }}>{node.title}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
                    {node.temporal_type === "fige" ? "Figé" : "Évolutif"} · {(node.allowed_roles || []).length} rôle(s)
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: "1rem" }}>
            <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--ink)", marginBottom: "0.5rem" }}>Transitions ({transitions.length})</div>
            {transitions.map(t => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: "0.35rem" }}>
                <span style={{ fontWeight: 500, color: "var(--ink)" }}>{t.from_status_title || t.from_status_id}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M15 8l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <span style={{ fontWeight: 500, color: "var(--ink)" }}>{t.to_status_title || t.to_status_id}</span>
                {(t.allowed_roles || []).length > 0 && (
                  <span style={{ fontSize: "0.72rem", color: "var(--primary)", marginLeft: "0.3rem" }}>
                    {(t.allowed_roles).join(", ")}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* ── Create Status Modal ───────────────────────────────────────── */}
      <Modal
        open={createStatusOpen}
        onClose={() => !createStatusSubmitting && setCreateStatusOpen(false)}
        title="Créer un statut"
        width={520}
      >
        <form onSubmit={handleCreateStatusSubmit}>
          {/* Title */}
          <div className="we-modal-field">
            <label>Titre du statut *</label>
            <input
              className="we-props-input"
              type="text"
              placeholder="ex. En cours de production"
              value={createStatusForm.title}
              onChange={e => setCreateStatusForm(f => ({ ...f, title: e.target.value }))}
              autoFocus
            />
          </div>

          {/* Functional type */}
          <div className="we-modal-field">
            <label>Type fonctionnel</label>
            <div className="we-modal-func-grid">
              {Object.entries(FUNCTIONAL_META).map(([val, meta]) => {
                const on = createStatusForm.functional_type === val;
                return (
                  <button
                    key={val}
                    type="button"
                    className={`we-func-chip${on ? " we-func-chip--on" : ""}`}
                    style={on ? { borderColor: meta.border, background: meta.bg, color: meta.border } : {}}
                    onClick={() => {
                      const autoFige = ["planification_shooting","planification_montage","final_confirmation","final_rejet"].includes(val);
                      setCreateStatusForm(f => ({
                        ...f,
                        functional_type: val,
                        temporal_type: autoFige ? "fige" : f.temporal_type,
                      }));
                    }}
                  >
                    <span className="we-func-dot" style={{ background: meta.color }} />
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Temporal type */}
          <div className="we-modal-field">
            <label>Type temporel</label>
            <div className="we-modal-row">
              {[
                { value: "evolutif", label: "Évolutif", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/><path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg> },
                { value: "fige",    label: "Figé",      icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.8"/><path d="M8 11V7a4 4 0 018 0v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg> },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  className={`we-temporal-btn${createStatusForm.temporal_type === opt.value ? " we-temporal-btn--on" : ""}`}
                  onClick={() => setCreateStatusForm(f => ({ ...f, temporal_type: opt.value }))}
                >
                  {opt.icon}
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {createStatusError && (
            <p className="tt-status tt-status--error" style={{ marginTop: "0.5rem" }}>{createStatusError}</p>
          )}

          <div className="modal-footer" style={{ marginTop: "1.25rem" }}>
            <button type="button" className="btn-ghost" onClick={() => setCreateStatusOpen(false)} disabled={createStatusSubmitting}>
              Annuler
            </button>
            <button type="submit" className="btn-primary" disabled={createStatusSubmitting}>
              {createStatusSubmitting ? "Création…" : "Créer le statut"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
