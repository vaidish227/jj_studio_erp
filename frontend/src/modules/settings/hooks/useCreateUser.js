import { useState } from 'react';
import { authService } from '../../../shared/services/authService';

const initialState = {
  name: '',
  email: '',
  password: '',
  role: 'designer',
};

const validateForm = (data) => {
  const errors = {};
  if (!data.name.trim()) errors.name = 'Name is required';
  if (!data.email) {
    errors.email = 'Email is required';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.email = 'Invalid email address';
  }
  if (!data.password) {
    errors.password = 'Password is required';
  } else if (data.password.length < 6) {
    errors.password = 'Password must be at least 6 characters';
  }
  return errors;
};

export const useCreateUser = () => {
  const [formData, setFormData] = useState(initialState);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ type: '', message: '' });

    const validationErrors = validateForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsLoading(true);
    try {
      await authService.signup(formData);
      setStatus({ type: 'success', message: 'User created successfully!' });
      setFormData(initialState);
    } catch (err) {
      setStatus({ type: 'error', message: err || 'Failed to create user' });
    } finally {
      setIsLoading(false);
    }
  };

  return {
    formData,
    errors,
    isLoading,
    status,
    handleChange,
    handleSubmit
  };
};
