import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function RoleRoute({ roles, children }) {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="route-loading" aria-busy="true" />;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (!roles.includes(user?.effective_role)) {
    return <Navigate to="/" replace />;
  }
  return children;
}