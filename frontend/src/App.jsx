import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleRoute from "./components/RoleRoute";
import AdminLayout from "./components/AdminLayout";
import Login from "./pages/Login";
import Home from "./pages/Home";
import AdminUsers from "./pages/admin/Users";
import AdminTaskTypes from "./pages/admin/TaskTypes";
import AdminEquipment from "./pages/admin/Equipment";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />
        <Route
        
          path="/admin"
          element={
            <RoleRoute roles={["admin_sys"]}>
              <Route path="task-types" element={<AdminTaskTypes />} />
              <Route path="equipment" element={<AdminEquipment />} />
              <AdminLayout />
            </RoleRoute>
            
          }
        >
          <Route index element={<AdminUsers />} />
          <Route path="users" element={<AdminUsers />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}