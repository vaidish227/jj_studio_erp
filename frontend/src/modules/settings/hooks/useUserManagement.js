import { useState, useEffect, useCallback } from 'react';
import { settingsService } from '../../../shared/services/settingsService';
import { authService } from '../../../shared/services/authService';
import { useToast } from '../../../shared/notifications/ToastProvider';

const INITIAL_FORM = { name: '', email: '', password: '', role: 'designer' };

const validateForm = (data) => {
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
  return errors;
};

export const useUserManagement = () => {
  const { success, error } = useToast();

  const [users,        setUsers]        = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [formData,   setFormData]   = useState(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [isCreating, setIsCreating] = useState(false);

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

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) setFormErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const validationErrors = validateForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setFormErrors(validationErrors);
      return;
    }
    setIsCreating(true);
    try {
      await authService.signup(formData);
      success('User created successfully!');
      setFormData(INITIAL_FORM);
      fetchUsers();
    } catch (err) {
      error(err || 'Failed to create user');
    } finally {
      setIsCreating(false);
    }
  };

  const updateUserRole = async (userId, newRole) => {
    try {
      const res = await settingsService.updateUserRole(userId, { role: newRole });
      setUsers((prev) => prev.map((u) => (u._id === userId ? res.data : u)));
      success('User role updated');
    } catch (err) {
      error(err || 'Failed to update role');
    }
  };

  return {
    users, loadingUsers, fetchUsers,
    formData, formErrors, isCreating,
    handleChange, handleCreate,
    updateUserRole,
  };
};
