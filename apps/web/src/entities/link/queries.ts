import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { linkApi } from '@/entities/link/api';
import type { CreateLinkInput } from './types';
import { useAppStore } from '@/shared/store/app-store';
import { SESSION_KEYS } from '@/entities/session/queries';
import { sessionApi } from '@/entities/session/api';
import { SESSION_KEY_STORAGE } from '@/shared/api/client';
import { translations } from '@/shared/i18n/translations';
import { toast } from 'sonner';

export const LINK_KEYS = {
  all: ['links'] as const,
  lists: () => [...LINK_KEYS.all, 'list'] as const,
  list: (search?: string, sessionKey?: string | null) => [...LINK_KEYS.lists(), { search, sessionKey }] as const,
  details: () => [...LINK_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...LINK_KEYS.details(), id] as const,
};

export function useLinks(search?: string) {
  const sessionKey = useAppStore((s) => s.sessionKey);

  return useQuery({
    queryKey: LINK_KEYS.list(search, sessionKey),
    queryFn: () => linkApi.list(search),
    staleTime: 10000,
    enabled: !!sessionKey,
  });
}

export function useCreateLink() {
  const queryClient = useQueryClient();
  const sessionKey = useAppStore((s) => s.sessionKey);
  const setSessionKey = useAppStore((s) => s.setSessionKey);

  return useMutation({
    mutationFn: async (input: CreateLinkInput) => {
      let currentKey = sessionKey || (typeof window !== 'undefined' ? localStorage.getItem(SESSION_KEY_STORAGE) : null);
      if (!currentKey) {
        const session = await sessionApi.createSession();
        if (session.access_key) {
          currentKey = session.access_key;
          setSessionKey(session.access_key);
          if (typeof window !== 'undefined') {
            localStorage.setItem(SESSION_KEY_STORAGE, session.access_key);
          }
        }
      }
      return linkApi.create(input);
    },
    onSuccess: (newLink) => {
      const lang = useAppStore.getState().language;
      const t = translations[lang];
      queryClient.invalidateQueries({ queryKey: LINK_KEYS.lists() });
      queryClient.invalidateQueries({ queryKey: SESSION_KEYS.all });
      toast.success(t.toasts.linkCreated, {
        description: `${newLink.short_url}`,
      });
    },
    onError: (err: Error) => {
      const lang = useAppStore.getState().language;
      const t = translations[lang];
      const message = err.message === 'This destination requires an NSFW label'
        ? t.toasts.nsfwRequired
        : err.message === 'This destination is blocked'
          ? t.toasts.blockedUrl
          : err.message || t.toasts.createError;
      toast.error(message);
    },
  });
}

export function usePreviewLink() {
  return useMutation({
    mutationFn: (url: string) => linkApi.preview(url),
  });
}



export function useToggleLinkStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      linkApi.toggleStatus(id, isActive),
    onSuccess: (updatedLink) => {
      const lang = useAppStore.getState().language;
      const t = translations[lang];
      queryClient.invalidateQueries({ queryKey: LINK_KEYS.lists() });
      toast.success(
        updatedLink.is_active
          ? t.toasts.linkActivated
          : t.toasts.linkPaused
      );
    },
    onError: (err: Error) => {
      const lang = useAppStore.getState().language;
      const t = translations[lang];
      toast.error(err.message || t.toasts.statusError);
    },
  });
}

export function useDeleteLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => linkApi.delete(id),
    onSuccess: () => {
      const lang = useAppStore.getState().language;
      const t = translations[lang];
      queryClient.invalidateQueries({ queryKey: LINK_KEYS.lists() });
      queryClient.invalidateQueries({ queryKey: SESSION_KEYS.all });
      toast.success(t.toasts.linkDeleted);
    },
    onError: (err: Error) => {
      const lang = useAppStore.getState().language;
      const t = translations[lang];
      toast.error(err.message || t.toasts.deleteError);
    },
  });
}
