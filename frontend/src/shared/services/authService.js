import apiClient from './apiClient';

export const authService = {
  login: (credentials) => {
    return apiClient.post('/auth/login', credentials);
  },
  
  signup: (userData) => {
    return apiClient.post('/auth/signup', userData);
  },

  logout: () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
  }
};
