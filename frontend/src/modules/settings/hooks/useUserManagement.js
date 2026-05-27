import { useState, useEffect, useCallback } from 'react';
import { settingsService } from '../../../shared/services/settingsService';
import { authService } from '../../../shared/services/authService';
import { useToast } from '../../../shared/notifications/ToastProvider';

const INITIAL_FORM = { name: '', email: '', password: '', role: 'designer', phone: '' };

const validateCreateForm = (data) => {
  const errors = {};
  if (!data.name.trim())  errors.name = 'Name is required';
  if (!data.email) {
    errors.email = 'Email is required';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.email = 'Invalid email address';
  }
  if (!data.password) {
    errors.password = 'Password is required';
  } else if (data.password.length < 6) {
    errors.password = 'Must be at least 6 characters';
  }
  if (data.phone.trim() && data.phone.replace(/\D/g, '').length < 11) {
    errors.phone = 'Include country code — e.g. +91 9876543210';
  }
  return errors;
};

export const useUserManagement = () => {
  const { success, error } = useToast();

  const [users,        setUsers]        = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Create form
  const [formData,   setFormData]   = useState(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [isCreating, setIsCreating] = useState(false);

  // Edit modal
  const [editTarget,    setEditTarget]    = useState(null);
  const [isUpdating,    setIsUpdating]    = useState(false);

  // Reset password modal
  const [resetTarget,    setResetTarget]    = useState(null);
  const [isResetting,    setIsResetting]    = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const res = await settingsService.getUsers();
      setUsers(res.data || []);
    } catch (err) {
      error(err || 'Failed to load users');
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // ── Create ──────────────────────────────────────────────────────────────────
  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) setFormErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const validationErrors = validateCreateForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setFormErrors(validationErrors);
      return;
    }
    setIsCreating(true);
    try {
      await authService.signup(formData);
      success('User created successfully');
      setFormData(INITIAL_FORM);
      fetchUsers();
    } catch (err) {
      error(err || 'Failed to create user');
    } finally {
      setIsCreating(false);
    }
  };

  // ── Edit ────────────────────────────────────────────────────────────────────
  const openEdit = (user) => setEditTarget(user);
  const closeEdit = () => setEditTarget(null);

  const handleUpdateUser = async (userId, data) => {
    setIsUpdating(true);
    try {
      const res = await settingsService.updateUser(userId, data);
      setUsers((prev) => prev.map((u) => (u._id === userId ? res.data : u)));
      success('User updated successfully');
      setEditTarget(null);
    } catch (err) {
      error(err || 'Failed to update user');
    } finally {
      setIsUpdating(false);
    }
  };

  // ── Role quick-change (inline in list) ──────────────────────────────────────
  const updateUserRole = async (userId, newRole) => {
    try {
      const res = await settingsService.updateUserRole(userId, { role: newRole });
      setUsers((prev) => prev.map((u) => (u._id === userId ? res.data : u)));
      success('User role updated');
    } catch (err) {
      error(err || 'Failed to update role');
    }
  };

  // ── Reset password ───────────────────────────────────────────────────────────
  const openResetPassword = (user) => setResetTarget(user);
  const closeResetPassword = () => setResetTarget(null);

  const handleResetPassword = async (userId, newPassword) => {
    setIsResetting(true);
    try {
      await settingsService.adminResetPassword(userId, { newPassword });
      success('Password reset successfully');
      setResetTarget(null);
    } catch (err) {
      error(err || 'Failed to reset password');
    } finally {
      setIsResetting(false);
    }
  };

  return {
    users, loadingUsers, fetchUsers,
    // create
    formData, formErrors, isCreating,
    handleChange, handleCreate,
    // edit
    editTarget, isUpdating,
    openEdit, closeEdit, handleUpdateUser,
    // role inline
    updateUserRole,
    // reset password
    resetTarget, isResetting,
    openResetPassword, closeResetPassword, handleResetPassword,
  };
};
