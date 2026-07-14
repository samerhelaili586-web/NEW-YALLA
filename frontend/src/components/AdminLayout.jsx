import { NavLink, Outlet } from "react-router-dom";
import AppShell from "./AppShell";
import "./AdminLayout.css";

const NAV_ITEMS = [
  { to: "/admin/users", label: "Utilisateurs" },
  { to: "/admin/task-types", label: "Types de tâches" },
  { to: "/admin/equipment", label: "Matériel" },
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