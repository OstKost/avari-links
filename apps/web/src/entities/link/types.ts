export interface Link {
  id: string;
  original_url: string;
  code: string;
  short_url: string;
  title: string;
  clicks: number;
  is_active: boolean;
  last_clicked_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateLinkInput {
  original_url: string;
  custom_code?: string;
  title?: string;
}

export interface PaginatedListResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}
