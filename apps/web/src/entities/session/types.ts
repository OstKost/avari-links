export interface Session {
  id: string;
  access_key?: string;
  links_count: number;
  is_premium: boolean;
  last_active_at: string;
  created_at: string;
}

export interface RestoreSessionInput {
  access_key: string;
}
