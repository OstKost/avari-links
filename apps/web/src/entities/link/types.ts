export interface Link {
  id: string;
  original_url: string;
  code: string;
  short_url: string;
  title: string;
  clicks: number;
  is_active: boolean;
  is_nsfw: boolean;
  last_clicked_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateLinkInput {
  original_url: string;
  custom_code?: string;
  title?: string;
  is_nsfw?: boolean;
}

export interface LinkPreview {
  url: string;
  is_reachable: boolean;
  status_code: number;
  title?: string;
  description?: string;
  image_url?: string;
  favicon_url?: string;
  site_name?: string;
  error?: string;
}

export interface PaginatedListResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

