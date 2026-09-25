import { apiClient } from '@/shared/api/client';
import type { Session, RestoreSessionInput } from './types';

export const sessionApi = {
  createSession: async (): Promise<Session> => {
    const response = await apiClient.post<Session>('/api/v1/auth/session');
    return response.data;
  },

  restoreSession: async (input: RestoreSessionInput): Promise<Session> => {
    const response = await apiClient.post<Session>('/api/v1/auth/restore', input);
    return response.data;
  },

  getMe: async (): Promise<Session> => {
    const response = await apiClient.get<Session>('/api/v1/auth/me');
    return response.data;
  },
};
