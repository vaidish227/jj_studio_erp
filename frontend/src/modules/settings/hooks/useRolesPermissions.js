import { useState, useEffect, useCallback } from 'react';
import { settingsService } from '../../../shared/services/settingsService';
import { useToast } from '../../../shared/notifications/ToastProvider';

export const useRolesPermissions = () => {
  const { success, error } = useToast();

  // ── Role list & permission editing ──────────────────────────────────────────
  const [roles,            setRoles]            = useState([]);
  const [selectedRole,     setSelectedRole]     = useState(null);
  const [draftPermissions, setDraftPermissions] = useState([]);
  const [isDirty,          setIsDirty]          = useState(false);
  const [loading,          setLoading]          = useState(false);
  const [saving,           setSaving]           = useState(false);

  // ── Permission registry (Module → Section → Action catalogue) ────────────────
  const [registry,        setRegistry]        = useState([]);
  const [registryLoading, setRegistryLoading] = useState(true);

  // ── Permission presets (role templates) ──────────────────────────────────────
  const [presets, setPresets] = useState([]);

  // ── Role CRUD modals ─────────────────────────────────────────────────────────
  const [createModalOpen,  setCreateModalOpen]  = useState(false);
  const [cloneTarget,      setCloneTarget]      = useState(null);
  const [deleteTarget,     setDeleteTarget]     = useState(null);
  const [roleActionBusy,   setRoleActionBusy]   = useState(false);

  // ── User override mode ───────────────────────────────────────────────────────
  const [overrideUser,         setOverrideUser]         = useState(null);  // selected user object
  const [effectivePerms,       setEffectivePerms]        = useState(null);  // {rolePermissions, customPermissions, effective}
  const [overrideDraft,        setOverrideDraft]         = useState([]);    // draft customPermissions
  const [overrideDirty,        setOverrideDirty]         = useState(false);
  const [loadingOverride,      setLoadingOverride]       = useState(false);
  const [savingOverride,       setSavingOverride]        = useState(false);

  // ─────────────────────────────────────────────────────────────────────────────

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await settingsService.getRoles();
      setRoles(res.data || []);
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

  useEffect(() => { fetchRoles(); }, [fetchRoles]);

  // Load the permission registry once (drives the Module → Section → Action UI).
  useEffect(() => {
    let active = true;
    setRegistryLoading(true);
    settingsService.getRegistry()
      .then((res) => { if (active) setRegistry(res.data?.modules || []); })
      .catch((err) => { error(err || 'Failed to load permission catalogue'); })
      .finally(() => { if (active) setRegistryLoading(false); });
    return () => { active = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load presets (role templates) once.
  useEffect(() => {
    let active = true;
    settingsService.getPresets()
      .then((res) => { if (active) setPresets(res.data?.presets || []); })
      .catch(() => {}) // presets are optional UX sugar — fail silently
    return () => { active = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply a preset's permissions to the working draft (operates on draft only,
  // never saves). mode: 'add' (union) | 'replace' (overwrite draft).
  const applyPreset = (permissions, mode = 'add') => {
    setDraftPermissions((prev) => {
      const next = mode === 'replace'
        ? [...new Set(permissions)]
        : [...new Set([...prev, ...permissions])];
      setIsDirty(true);
      return next;
    });
  };

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

  // Toggle a set of full permission strings at once (actions + tab perms)
  const togglePermissionSet = (permSet) => {
    setDraftPermissions((prev) => {
      const allActive = permSet.every((p) => prev.includes(p));
      const next = allActive
        ? prev.filter((p) => !permSet.includes(p))
        : [...new Set([...prev, ...permSet])];
      setIsDirty(true);
      return next;
    });
  };

  const toggleModule = (moduleKey, actions) => {
    const modulePerms = actions.map((a) => `${moduleKey}.${a}`);
    setDraftPermissions((prev) => {
      const allActive = modulePerms.every((p) => prev.includes(p));
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
      const res = await settingsService.updateRole(selectedRole._id, { permissions: draftPermissions });
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

  // ── Create role ──────────────────────────────────────────────────────────────
  const handleCreateRole = async ({ name, displayName, description, color, cloneFrom, seedPermissions }) => {
    setRoleActionBusy(true);
    try {
      const permissions = cloneFrom
        ? (roles.find((r) => r._id === cloneFrom)?.permissions || [])
        : (seedPermissions?.length ? [...new Set(seedPermissions)] : []);
      const res = await settingsService.createRole({ name, displayName, description, color, permissions });
      setRoles((prev) => [...prev, res.data]);
      setCreateModalOpen(false);
      setCloneTarget(null);
      success('Role created');
      selectRole(res.data);
      return res.data;
    } catch (err) {
      error(err || 'Failed to create role');
      return null;
    } finally {
      setRoleActionBusy(false);
    }
  };

  // ── Delete role ──────────────────────────────────────────────────────────────
  const handleDeleteRole = async (roleId) => {
    setRoleActionBusy(true);
    try {
      await settingsService.deleteRole(roleId);
      const remaining = roles.filter((r) => r._id !== roleId);
      setRoles(remaining);
      setDeleteTarget(null);
      if (selectedRole?._id === roleId) {
        if (remaining.length > 0) {
          selectRole(remaining[0]);
        } else {
          setSelectedRole(null);
          setDraftPermissions([]);
        }
      }
      success('Role deleted');
    } catch (err) {
      error(err || 'Failed to delete role');
    } finally {
      setRoleActionBusy(false);
    }
  };

  // ── User override operations ─────────────────────────────────────────────────
  const loadOverrideUser = useCallback(async (user) => {
    setOverrideUser(user);
    setLoadingOverride(true);
    try {
      const res = await settingsService.getEffectivePermissions(user._id);
      setEffectivePerms(res.data);
      setOverrideDraft(res.data.customPermissions || []);
      setOverrideDirty(false);
    } catch (err) {
      error(err || 'Failed to load user permissions');
    } finally {
      setLoadingOverride(false);
    }
  }, []);

  const clearOverrideUser = () => {
    setOverrideUser(null);
    setEffectivePerms(null);
    setOverrideDraft([]);
    setOverrideDirty(false);
  };

  const toggleOverridePermission = (permission) => {
    setOverrideDraft((prev) => {
      const next = prev.includes(permission)
        ? prev.filter((p) => p !== permission)
        : [...prev, permission];
      setOverrideDirty(true);
      return next;
    });
  };

  const saveOverrides = async () => {
    if (!overrideUser || !overrideDirty) return;
    setSavingOverride(true);
    try {
      await settingsService.updateUser(overrideUser._id, { customPermissions: overrideDraft });
      setEffectivePerms((prev) => prev ? { ...prev, customPermissions: overrideDraft } : prev);
      setOverrideDirty(false);
      success(`Custom permissions saved for ${overrideUser.name}`);
    } catch (err) {
      error(err || 'Failed to save overrides');
    } finally {
      setSavingOverride(false);
    }
  };

  const discardOverrides = () => {
    setOverrideDraft(effectivePerms?.customPermissions || []);
    setOverrideDirty(false);
  };

  return {
    // Role list & editing
    roles,
    selectedRole,
    draftPermissions,
    isDirty,
    loading,
    saving,
    // Permission registry
    registry,
    registryLoading,
    // Presets (role templates)
    presets,
    applyPreset,
    selectRole,
    togglePermission,
    togglePermissionSet,
    toggleModule,
    savePermissions,
    discardChanges,
    refetch: fetchRoles,
    // Role CRUD
    createModalOpen,  setCreateModalOpen,
    cloneTarget,      setCloneTarget,
    deleteTarget,     setDeleteTarget,
    roleActionBusy,
    handleCreateRole,
    handleDeleteRole,
    // User overrides
    overrideUser,
    effectivePerms,
    overrideDraft,
    overrideDirty,
    loadingOverride,
    savingOverride,
    loadOverrideUser,
    clearOverrideUser,
    toggleOverridePermission,
    saveOverrides,
    discardOverrides,
  };
};
