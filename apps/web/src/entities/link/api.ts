import { apiClient } from '@/shared/api/client';
import type { Link, CreateLinkInput, PaginatedListResponse } from './types';

export const linkApi = {
  async list(search?: string, limit: number = 50, offset: number = 0): Promise<PaginatedListResponse<Link>> {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    params.set('limit', String(limit));
    params.set('offset', String(offset));

    const response = await apiClient.get<PaginatedListResponse<Link>>(`/api/v1/links?${params.toString()}`);
    return response.data;
  },

  async getByID(id: string): Promise<Link> {
    const response = await apiClient.get<Link>(`/api/v1/links/${id}`);
    return response.data;
  },

  async create(input: CreateLinkInput): Promise<Link> {
    const response = await apiClient.post<Link>('/api/v1/links', input);
    return response.data;
  },

  async toggleStatus(id: string, isActive: boolean): Promise<Link> {
    const response = await apiClient.patch<Link>(`/api/v1/links/${id}/status`, {
      is_active: isActive,
    });
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/v1/links/${id}`);
  },
};
