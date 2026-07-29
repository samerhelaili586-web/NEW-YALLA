import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";

// ── Global Liquid Metal Button Ripple Listener ────────────────────────────
document.addEventListener("click", (e) => {
  const btn = e.target.closest("button, .btn-primary, .btn-secondary, .btn-danger, .chip-toggle");
  if (!btn || btn.disabled) return;
  const rect = btn.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const ripple = document.createElement("span");
  ripple.className = "button-ripple";
  ripple.style.left = `${x}px`;
  ripple.style.top = `${y}px`;
  ripple.style.width = "24px";
  ripple.style.height = "24px";
  btn.appendChild(ripple);

  setTimeout(() => ripple.remove(), 600);
});

// ── Global Error Reporter for System Monitoring ──────────────────────────
window.onerror = (message, source, lineno, colno, error) => {
  try {
    fetch("/api/monitoring/client-error", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: window.location.href,
        method: "JS_ERROR",
        status_code: 500,
        message: String(message),
        stack: error?.stack || `${source}:${lineno}:${colno}`,
      }),
    }).catch(() => {});
  } catch {}
};

window.onunhandledrejection = (e) => {
  try {
    fetch("/api/monitoring/client-error", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: window.location.href,
        method: "PROMISE_REJECTION",
        status_code: 500,
        message: String(e.reason?.message || e.reason || "Unhandled Promise Rejection"),
        stack: e.reason?.stack || "",
      }),
    }).catch(() => {});
  } catch {}
};

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);