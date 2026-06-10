/**
 * ProtectedRoute  (fix for issue #673)
 *
 * Wraps any route that requires authentication.
 * If no auth token is found, redirects to /login immediately.
 *
 * Usage in App.tsx:
 *   <Route path="/workout" element={<ProtectedRoute><WorkoutPage /></ProtectedRoute>} />
 */

import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";

interface ProtectedRouteProps {
  children: ReactNode;
}

/**
 * Returns true if the user has a valid session.
 * Extend this to verify JWT expiry or call an auth context as needed.
 */
function isAuthenticated(): boolean {
  return (
    Boolean(localStorage.getItem("authToken")) ||
    Boolean(sessionStorage.getItem("authToken"))
  );
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
