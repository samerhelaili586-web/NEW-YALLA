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
import ProjectList from "./pages/projects/ProjectList";
import ProjectDetail from "./pages/projects/ProjectDetail";
import TachesAssociees from "./pages/tasks/TachesAssociees";
import TachesMontage from "./pages/tasks/TachesMontage";
import Planification from "./pages/planification/Planification";
import ShootingCalendar from "./pages/shooting/ShootingCalendar";
import AttendanceSheet from "./pages/attendance/AttendanceSheet";
import LeaveRequests from "./pages/leave/LeaveRequests";
import LeaveApproval from "./pages/leave/LeaveApproval";

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
          path="/projects"
          element={
            <ProtectedRoute>
              <ProjectList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects/:projectId"
          element={
            <ProtectedRoute>
              <ProjectDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tasks"
          element={
            <ProtectedRoute>
              <TachesAssociees />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tasks-montage"
          element={
            <ProtectedRoute>
              <TachesMontage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/planification"
          element={
            <ProtectedRoute>
              <Planification />
            </ProtectedRoute>
          }
        />
        <Route
          path="/shooting-calendar"
          element={
            <ProtectedRoute>
              <ShootingCalendar />
            </ProtectedRoute>
          }
        />
        <Route
          path="/attendance"
          element={
            <ProtectedRoute>
              <AttendanceSheet />
            </ProtectedRoute>
          }
        />
        <Route
          path="/leave"
          element={
            <ProtectedRoute>
              <LeaveRequests />
            </ProtectedRoute>
          }
        />
        <Route
          path="/leave/approval"
          element={
            <RoleRoute roles={["manager"]}>
              <LeaveApproval />
            </RoleRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <RoleRoute roles={["admin_sys"]}>
              <AdminLayout />
            </RoleRoute>
          }
        >
          <Route index element={<AdminUsers />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="task-types" element={<AdminTaskTypes />} />
          <Route path="equipment" element={<AdminEquipment />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}