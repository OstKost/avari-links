import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sessionApi } from '@/entities/session/api';
import { SESSION_KEY_STORAGE } from '@/shared/api/client';
import { LINK_KEYS } from '@/entities/link/queries';
import { useAppStore } from '@/shared/store/app-store';
import { translations } from '@/shared/i18n/translations';
import { toast } from 'sonner';

export const SESSION_KEYS = {
  all: ['session'] as const,
  me: () => [...SESSION_KEYS.all, 'me'] as const,
};

export function useSessionMe() {
  const sessionKey = useAppStore((s) => s.sessionKey);

  return useQuery({
    queryKey: SESSION_KEYS.me(),
    queryFn: () => sessionApi.getMe(),
    enabled: !!sessionKey,
    staleTime: 30000,
    retry: false,
  });
}

export function useCreateSession() {
  const queryClient = useQueryClient();
  const setSessionKey = useAppStore((s) => s.setSessionKey);

  return useMutation({
    mutationFn: () => sessionApi.createSession(),
    onSuccess: (data) => {
      if (data.access_key) {
        setSessionKey(data.access_key);
        localStorage.setItem(SESSION_KEY_STORAGE, data.access_key);
      }
      queryClient.invalidateQueries({ queryKey: LINK_KEYS.lists() });
      queryClient.invalidateQueries({ queryKey: SESSION_KEYS.all });
    },
    onError: (err: Error) => {
      const lang = useAppStore.getState().language;
      const t = translations[lang];
      toast.error(err.message || t.toasts.createSessionError);
    },
  });
}

export function useRestoreSession() {
  const queryClient = useQueryClient();
  const setSessionKey = useAppStore((s) => s.setSessionKey);

  return useMutation({
    mutationFn: (accessKey: string) => sessionApi.restoreSession({ access_key: accessKey }),
    onSuccess: (data) => {
      const lang = useAppStore.getState().language;
      const t = translations[lang];
      if (data.access_key) {
        setSessionKey(data.access_key);
        localStorage.setItem(SESSION_KEY_STORAGE, data.access_key);
      }
      queryClient.invalidateQueries({ queryKey: LINK_KEYS.lists() });
      queryClient.invalidateQueries({ queryKey: SESSION_KEYS.all });
      toast.success(t.toasts.sessionRestored, {
        description: t.toasts.linksLoaded(data.links_count),
      });
    },
    onError: (err: Error) => {
      const lang = useAppStore.getState().language;
      const t = translations[lang];
      toast.error(err.message === 'Invalid or expired access key' || err.message === 'Invalid access key'
        ? t.toasts.invalidKey
        : err.message || t.toasts.sessionError);
    },
  });
}
