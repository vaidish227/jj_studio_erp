import React from 'react';
import usePermission from '../../hooks/usePermission';

/**
 * Conditionally renders children based on the user's permissions.
 *
 * @prop {string|string[]} permission  - Required permission(s).
 * @prop {'any'|'all'}     mode        - 'any' or 'all' when permission is an array. Default: 'all'.
 * @prop {React.ReactNode} fallback    - What to render when access is denied. Default: null.
 * @prop {boolean}         disabled    - If true, renders children as disabled instead of hiding them.
 *
 * @example
 * // Hide entirely
 * <PermissionGate permission="crm.create">
 *   <Button>Add Lead</Button>
 * </PermissionGate>
 *
 * // Show fallback
 * <PermissionGate permission="crm.delete" fallback={<span className="text-gray-400">No access</span>}>
 *   <Button variant="danger">Delete</Button>
 * </PermissionGate>
 *
 * // Any of multiple permissions
 * <PermissionGate permission={['proposal.approve', 'proposal.manage']} mode="any">
 *   <ApproveButton />
 * </PermissionGate>
 */
const PermissionGate = ({
  permission,
  mode = 'all',
  fallback = null,
  disabled = false,
  children,
}) => {
  const allowed = usePermission(permission, mode);

  if (!allowed) {
    if (disabled && children) {
      // Render children wrapped in a disabled/muted state
      return (
        <div className="opacity-40 pointer-events-none select-none" aria-disabled="true">
          {children}
        </div>
      );
    }
    return fallback;
  }

  return children;
};

export default PermissionGate;
