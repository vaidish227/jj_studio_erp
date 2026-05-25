import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const data = error?.response?.data;
    // Preserve the full response data so callers can access extra fields (e.g. existingId)
    if (data && typeof data === 'object') {
      return Promise.reject(data);
    }
    const message = (typeof data === 'string' ? data : null) || error?.message || 'Something went wrong';
    return Promise.reject({ message });
  }
);

export default apiClient;
