import axios from 'axios';
import { useAppStore } from '@/shared/store/app-store';

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
    // Avoid sending existing/stale session key when requesting a brand new session
    if (!config.url?.includes('/auth/session')) {
      const sessionKey = localStorage.getItem(SESSION_KEY_STORAGE);
      if (sessionKey) {
        config.headers['X-Session-Key'] = sessionKey;
      }
    }
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const message =
      error.response?.data?.error ||
      error.message ||
      'An unexpected network error occurred';

    // Clear stale/expired access key on 401 unless it is an explicit user restore attempt
    if (status === 401 && !error.config?.url?.includes('/auth/restore')) {
      useAppStore.getState().setSessionKey(null);
    }

    return Promise.reject(new Error(message));
  }
);
