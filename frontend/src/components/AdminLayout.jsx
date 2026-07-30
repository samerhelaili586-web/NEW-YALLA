import { Outlet } from "react-router-dom";
import AppShell from "./AppShell";
import "./AdminLayout.css";

export default function AdminLayout() {
  return (
    <AppShell>
      <div className="admin-layout">
        <div className="admin-panel">
          <Outlet />
        </div>
      </div>
    </AppShell>
  );
}