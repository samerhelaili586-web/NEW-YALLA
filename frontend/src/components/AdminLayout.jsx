import { NavLink, Outlet } from "react-router-dom";
import AppShell from "./AppShell";
import "./AdminLayout.css";

const NAV_ITEMS = [
  { to: "/admin/users", label: "Utilisateurs" },
  { to: "/salaires", label: "Salaires & Paie" },
  { to: "/workflows", label: "Workflows (Types de tâches)" },
  { to: "/admin/equipment", label: "Matériel" },
  { to: "/admin/holidays", label: "Jours Fériés" },
  { to: "/admin/login-history", label: "Historique de connexions" },
];

export default function AdminLayout() {
  return (
    <AppShell>
      <div className="admin-layout">
        <aside className="admin-sidebar">
          <div className="admin-sidebar-title">Direction Générale</div>
          <nav className="admin-nav">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `admin-nav-link${isActive ? " is-active" : ""}`}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <div className="admin-panel">
          <Outlet />
        </div>
      </div>
    </AppShell>
  );
}