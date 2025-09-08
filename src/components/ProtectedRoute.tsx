// ProtectedRoute.tsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

type Permission = {
  resource: string;
  action: string;
};

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: Permission;
  requireAdmin?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredPermission,
  requireAdmin = false,
}) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  console.log(
    "[ProtectedRoute] loading:",
    loading,
    "user:",
    user,
    "path:",
    location.pathname
  );

  // ✅ Show spinner only while AuthProvider is checking Supabase session
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600 mx-auto mb-2"></div>
          <p className="text-gray-600 text-sm">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // 🚫 Not authenticated → redirect to login
  if (!user) {
    console.log("[ProtectedRoute] No user → redirecting to /login");
    return <Navigate to="/login" replace />;
  }

  // 🔐 If requireAdmin, check user's role
  if (requireAdmin && user.role !== "admin") {
    console.warn("[ProtectedRoute] User not admin → redirecting to /dashboard");
    return <Navigate to="/dashboard" replace />;
  }

  // 🔐 If specific permission is required, check user's permissions
  if (requiredPermission) {
    const hasPermission = user.permissions?.some(
      (p: Permission) =>
        p.resource === requiredPermission.resource &&
        p.action === requiredPermission.action
    );

    if (!hasPermission) {
      console.warn(
        `[ProtectedRoute] Missing permission ${requiredPermission.resource}:${requiredPermission.action} → redirecting to /dashboard`
      );
      return <Navigate to="/dashboard" replace />;
    }
  }

  // ✅ User authenticated and allowed → render children
  return <>{children}</>;
};
