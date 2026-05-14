import { useAuth } from '../context/AuthContext';

/**
 * Check if the current user has a specific permission.
 *
 * @param {string|string[]} permission - A single permission string or array of strings.
 * @param {'any'|'all'} mode - 'any' = has at least one, 'all' = has every one. Default: 'all'.
 * @returns {boolean}
 *
 * @example
 * const canCreate = usePermission('crm.create');
 * const canManage = usePermission(['settings.manage', 'users.manage'], 'any');
 */
const usePermission = (permission, mode = 'all') => {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = useAuth();

  if (!permission) return true;

  if (Array.isArray(permission)) {
    return mode === 'any'
      ? hasAnyPermission(permission)
      : hasAllPermissions(permission);
  }

  return hasPermission(permission);
};

export default usePermission;
