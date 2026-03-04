import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Loader from "../components/common/Loader";
import NotAuthorized from "../components/common/NotAuthorized";
import type { ReactNode } from "react";
import type { AppUserRole } from "../firebase";

interface Props {
  children: ReactNode;
  allowedRoles: AppUserRole[];
}

export default function ProtectedRoute({ children, allowedRoles }: Props) {
  const { user, loading } = useAuth();

  if (loading) return <Loader />;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <NotAuthorized />;
  }

  return <>{children}</>;
}