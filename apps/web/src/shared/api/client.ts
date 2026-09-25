import axios from 'axios';

export const SESSION_KEY_STORAGE = 'avari_session_key';

const baseURL = import.meta.env.VITE_API_BASE_URL || '';

export const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const sessionKey = localStorage.getItem(SESSION_KEY_STORAGE);
    if (sessionKey) {
      config.headers['X-Session-Key'] = sessionKey;
    }
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.error ||
      error.message ||
      'An unexpected network error occurred';
    return Promise.reject(new Error(message));
  }
);
