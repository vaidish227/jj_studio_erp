import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../../../shared/services/authService';
import { useAuth } from '../../../shared/context/AuthContext';

const initialState = {
  email: '',
  password: '',
  rememberMe: false,
};

const validateForm = ({ email, password }) => {
  const errors = {};
  if (!email) {
    errors.email = 'Email is required.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Please enter a valid email.';
  }
  if (!password) {
    errors.password = 'Password is required.';
  } else if (password.length < 6) {
    errors.password = 'Password must be at least 6 characters.';
  }
  return errors;
};

const useLogin = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState(initialState);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError('');

    const validationErrors = validateForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsLoading(true);
    try {
      const response = await authService.login({
        email: formData.email,
        password: formData.password,
      });

      if (response.token) {
        // Store auth state in context (which also writes to localStorage)
        login(response.user, response.token, response.permissions || []);
        navigate('/dashboard');
      }
    } catch (err) {
      setApiError(err || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return { formData, errors, isLoading, apiError, handleChange, handleSubmit };
};

export default useLogin;
