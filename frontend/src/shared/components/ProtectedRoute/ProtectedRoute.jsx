import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * Route-level access guard. Mirrors the sidebar's `filterItem` logic
 * (shared/layouts/Sidebar/Sidebar.jsx) so a page is reachable by URL only if
 * the same role/permission that reveals its nav entry is satisfied. Without
 * this, hidden pages (CRM, Settings, MD, Assign-Task…) were still openable by
 * typing the URL, and several served real data to roles that shouldn't see it.
 *
 * Precedence (identical to the sidebar):
 *   1. excludeRoles — hard block, even for roles that hold the permission
 *   2. roles        — strict membership (no admin override; lists include admin)
 *   3. '*' wildcard — admin sees everything
 *   4. permission   — must hold the granular permission
 *
 * Denied users are bounced to `/dashboard` (the universal, unguarded landing),
 * so there is never a redirect loop.
 */
const ProtectedRoute = ({ permission, roles, excludeRoles, redirectTo = '/dashboard', children }) => {
  const { user, hasPermission } = useAuth();
  const role = user?.role;

  let allowed = true;
  if (excludeRoles && excludeRoles.includes(role)) {
    allowed = false;
  } else if (roles && Array.isArray(roles)) {
    allowed = roles.includes(role);
  } else if (hasPermission('*')) {
    allowed = true;
  } else if (permission) {
    allowed = hasPermission(permission);
  }

  if (!allowed) return <Navigate to={redirectTo} replace />;
  return children;
};

export default ProtectedRoute;
