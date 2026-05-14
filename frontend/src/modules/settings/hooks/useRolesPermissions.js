import { useState, useEffect, useCallback } from 'react';
import { settingsService } from '../../../shared/services/settingsService';
import { useToast } from '../../../shared/notifications/ToastProvider';

export const useRolesPermissions = () => {
  const { success, error } = useToast();

  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [draftPermissions, setDraftPermissions] = useState([]);
  const [isDirty, setIsDirty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await settingsService.getRoles();
      setRoles(res.data || []);
      // Auto-select the first role
      if (res.data?.length > 0 && !selectedRole) {
        const first = res.data[0];
        setSelectedRole(first);
        setDraftPermissions(first.permissions || []);
      }
    } catch (err) {
      error(err || 'Failed to load roles');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await settingsService.getUsers();
      setUsers(res.data || []);
    } catch (err) {
      error(err || 'Failed to load users');
    }
  }, []);

  useEffect(() => {
    fetchRoles();
    fetchUsers();
  }, [fetchRoles, fetchUsers]);

  const selectRole = (role) => {
    setSelectedRole(role);
    setDraftPermissions(role.permissions || []);
    setIsDirty(false);
  };

  const togglePermission = (permission) => {
    setDraftPermissions((prev) => {
      const next = prev.includes(permission)
        ? prev.filter((p) => p !== permission)
        : [...prev, permission];
      setIsDirty(true);
      return next;
    });
  };

  const toggleModule = (moduleKey, actions) => {
    const modulePerms = actions.map((a) => `${moduleKey}.${a}`);
    const allActive = modulePerms.every((p) => draftPermissions.includes(p));
    setDraftPermissions((prev) => {
      const next = allActive
        ? prev.filter((p) => !modulePerms.includes(p))
        : [...new Set([...prev, ...modulePerms])];
      setIsDirty(true);
      return next;
    });
  };

  const savePermissions = async () => {
    if (!selectedRole || !isDirty) return;
    setSaving(true);
    try {
      const res = await settingsService.updateRole(selectedRole._id, {
        permissions: draftPermissions,
      });
      setRoles((prev) => prev.map((r) => r._id === selectedRole._id ? res.data : r));
      setSelectedRole(res.data);
      setIsDirty(false);
      success('Role permissions saved successfully');
    } catch (err) {
      error(err || 'Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  const discardChanges = () => {
    if (selectedRole) {
      setDraftPermissions(selectedRole.permissions || []);
      setIsDirty(false);
    }
  };

  const updateUserRole = async (userId, newRole) => {
    try {
      const res = await settingsService.updateUserRole(userId, { role: newRole });
      setUsers((prev) => prev.map((u) => u._id === userId ? res.data : u));
      success('User role updated');
    } catch (err) {
      error(err || 'Failed to update user role');
    }
  };

  return {
    roles,
    users,
    selectedRole,
    draftPermissions,
    isDirty,
    loading,
    saving,
    selectRole,
    togglePermission,
    toggleModule,
    savePermissions,
    discardChanges,
    updateUserRole,
    refetch: fetchRoles,
  };
};
