import { type ReactNode } from "react";
import { Redirect } from "wouter";
import { useAuth } from "@/lib/auth-context";
import type { Role } from "@workspace/api-client-react";

export function ProtectedRoute({
  roles,
  children,
}: {
  roles?: Role[];
  children: ReactNode;
}) {
  const { role, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!role) {
    return <Redirect to="/login" />;
  }

  if (roles && !roles.includes(role)) {
    return <Redirect to={role === "admin" ? "/admin" : "/vendedor"} />;
  }

  return <>{children}</>;
}
