export type AnalyticsEventName =
  | 'link_create_attempt'
  | 'link_create_success'
  | 'link_create_error'
  | 'link_copy'
  | 'link_status_toggle'
  | 'link_delete'
  | 'qr_modal_open'
  | 'qr_download'
  | 'session_restore_attempt'
  | 'session_restore_success'
  | 'session_restore_error'
  | 'session_key_copy'
  | 'session_reroll'
  | 'theme_toggle'
  | 'lang_switch';

export interface AnalyticsEventParams {
  [key: string]: string | number | boolean | undefined;
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    ym?: (counterId: number, action: string, target?: string | object, params?: object) => void;
    yandexMetrikaLoaded?: boolean;
    googleAnalyticsLoaded?: boolean;
  }
}
