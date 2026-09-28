import { describe, it, expect, beforeEach } from 'vitest';
import { apiClient, SESSION_KEY_STORAGE } from './client';
import { useAppStore } from '@/shared/store/app-store';

describe('apiClient interceptors', () => {
  beforeEach(() => {
    localStorage.clear();
    useAppStore.setState({ sessionKey: null });
  });

  it('attaches X-Session-Key header from localStorage except for session creation', async () => {
    localStorage.setItem(SESSION_KEY_STORAGE, 'test-stored-key');

    // Simulate request interceptor
    const reqHandler = (apiClient.interceptors.request as any).handlers[0]?.fulfilled;
    expect(reqHandler).toBeDefined();

    const normalConfig = await reqHandler({ url: '/api/v1/links', headers: {} });
    expect(normalConfig.headers['X-Session-Key']).toBe('test-stored-key');

    const authSessionConfig = await reqHandler({ url: '/api/v1/auth/session', headers: {} });
    expect(authSessionConfig.headers['X-Session-Key']).toBeUndefined();
  });

  it('purges session key on 401 response error', async () => {
    localStorage.setItem(SESSION_KEY_STORAGE, 'expired-key');
    useAppStore.setState({ sessionKey: 'expired-key' });

    const errorHandler = (apiClient.interceptors.response as any).handlers[0]?.rejected;
    expect(errorHandler).toBeDefined();

    const error401 = {
      response: {
        status: 401,
        data: { error: 'Invalid or expired access key' },
      },
      config: { url: '/api/v1/links' },
    };

    await expect(errorHandler(error401)).rejects.toThrow('Invalid or expired access key');

    expect(useAppStore.getState().sessionKey).toBeNull();
    expect(localStorage.getItem(SESSION_KEY_STORAGE)).toBeNull();
  });

  it('does not purge session key if 401 is from restore attempt', async () => {
    localStorage.setItem(SESSION_KEY_STORAGE, 'current-valid-key');
    useAppStore.setState({ sessionKey: 'current-valid-key' });

    const errorHandler = (apiClient.interceptors.response as any).handlers[0]?.rejected;

    const error401Restore = {
      response: {
        status: 401,
        data: { error: 'Invalid or expired access key' },
      },
      config: { url: '/api/v1/auth/restore' },
    };

    await expect(errorHandler(error401Restore)).rejects.toThrow('Invalid or expired access key');

    expect(useAppStore.getState().sessionKey).toBe('current-valid-key');
    expect(localStorage.getItem(SESSION_KEY_STORAGE)).toBe('current-valid-key');
  });
});
