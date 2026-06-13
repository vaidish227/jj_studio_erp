import apiClient from './apiClient';

export const authService = {
  login: (credentials) => {
    return apiClient.post('/auth/login', credentials);
  },

  signup: (userData) => {
    return apiClient.post('/auth/signup', userData);
  },

  // Returns { user, permissions } — used by AuthContext to refresh the cached
  // permissions when the app mounts and on tab focus, so a user picks up
  // role/permission changes without having to log out and log back in.
  me: () => {
    return apiClient.get('/auth/me');
  },

  logout: () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
  }
};
