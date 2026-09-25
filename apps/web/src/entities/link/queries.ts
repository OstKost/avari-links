import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { linkApi } from './api';
import type { CreateLinkInput } from './types';
import { toast } from 'sonner';

export const LINK_KEYS = {
  all: ['links'] as const,
  lists: () => [...LINK_KEYS.all, 'list'] as const,
  list: (search?: string) => [...LINK_KEYS.lists(), { search }] as const,
  details: () => [...LINK_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...LINK_KEYS.details(), id] as const,
};

export function useLinks(search?: string) {
  return useQuery({
    queryKey: LINK_KEYS.list(search),
    queryFn: () => linkApi.list(search),
    staleTime: 10000,
  });
}

export function useCreateLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateLinkInput) => linkApi.create(input),
    onSuccess: (newLink) => {
      queryClient.invalidateQueries({ queryKey: LINK_KEYS.lists() });
      toast.success('Короткая ссылка создана', {
        description: `${newLink.short_url}`,
      });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Не удалось создать ссылку');
    },
  });
}

export function useToggleLinkStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      linkApi.toggleStatus(id, isActive),
    onSuccess: (updatedLink) => {
      queryClient.invalidateQueries({ queryKey: LINK_KEYS.lists() });
      toast.success(
        updatedLink.is_active
          ? 'Ссылка активирована'
          : 'Ссылка приостановлена'
      );
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Не удалось изменить статус ссылки');
    },
  });
}

export function useDeleteLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => linkApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LINK_KEYS.lists() });
      toast.success('Ссылка удалена');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Не удалось удалить ссылку');
    },
  });
}
