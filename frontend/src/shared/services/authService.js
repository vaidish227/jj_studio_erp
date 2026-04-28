import apiClient from './apiClient';

export const authService = {
  login: (credentials) => {
    return apiClient('/auth/login', { body: credentials });
  },
  
  signup: (userData) => {
    return apiClient('/auth/signup', { body: userData });
  },

  logout: () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
  }
};
