import type { AnalyticsEventName, AnalyticsEventParams } from './types';

let ymCounterId: number | null = null;
let gaMeasurementId: string | null = null;

/**
 * Initializes Yandex Metrika counter script dynamically.
 */
export function initYandexMetrika(counterId: string | number, webvisor = true): void {
  if (typeof window === 'undefined' || window.yandexMetrikaLoaded) return;
  const numId = Number(counterId);
  if (isNaN(numId) || numId <= 0) return;

  ymCounterId = numId;

  // Standard typed Yandex.Metrika loader
  type YmWithQueue = typeof window.ym & { a?: unknown[]; l?: number };
  const ymFn: YmWithQueue =
    (window.ym as YmWithQueue) ||
    function (...args: unknown[]) {
      ymFn.a = ymFn.a || [];
      ymFn.a.push(args);
    };
  ymFn.l = 1 * new Date().getTime();
  window.ym = ymFn;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://mc.yandex.ru/metrika/tag.js?id=${numId}`;
  document.head.appendChild(script);

  if (window.ym) {
    window.ym(numId, 'init', {
      ssr: true,
      webvisor: webvisor,
      clickmap: true,
      ecommerce: 'dataLayer',
      accurateTrackBounce: true,
      trackLinks: true,
    });
    window.yandexMetrikaLoaded = true;
  }
}

/**
 * Tracks a page view across enabled trackers (YM + GA4) for SPA navigation.
 */
export function trackPageView(url?: string): void {
  if (typeof window === 'undefined') return;
  const currentUrl = url || window.location.href;

  // 1. Yandex.Metrika page hit
  if (ymCounterId && typeof window.ym === 'function') {
    try {
      window.ym(ymCounterId, 'hit', currentUrl);
    } catch {
      // Ignore network / script errors
    }
  }

  // 2. Google Analytics 4 page hit
  if (gaMeasurementId && typeof window.gtag === 'function') {
    try {
      window.gtag('config', gaMeasurementId, {
        page_location: currentUrl,
      });
    } catch {
      // Ignore network / script errors
    }
  }
}

/**
 * Initializes Google Analytics 4 (GA4) script dynamically.
 */
export function initGoogleAnalytics(measurementId: string): void {
  if (typeof window === 'undefined' || window.googleAnalyticsLoaded) return;
  if (!measurementId || !measurementId.trim()) return;

  gaMeasurementId = measurementId.trim();

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaMeasurementId)}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer?.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', gaMeasurementId, {
    send_page_view: true,
  });

  window.googleAnalyticsLoaded = true;
}

/**
 * Auto-initializes analytics services from Vite environment variables.
 */
export function initAnalytics(): void {
  if (typeof window === 'undefined') return;

  const rawYmId = import.meta.env.VITE_YM_COUNTER_ID;
  const rawGaId = import.meta.env.VITE_GA_MEASUREMENT_ID;
  const webvisor = import.meta.env.VITE_YM_WEBVISOR !== 'false';

  if (rawYmId) {
    initYandexMetrika(rawYmId, webvisor);
  }

  if (rawGaId) {
    initGoogleAnalytics(rawGaId);
  }
}

/**
 * Tracks an analytics event across all enabled trackers (YM + GA4).
 */
export function trackEvent(name: AnalyticsEventName, params?: AnalyticsEventParams): void {
  if (typeof window === 'undefined') return;

  // Log in development if no analytics counters are connected
  if (import.meta.env.DEV && !ymCounterId && !gaMeasurementId) {
    // eslint-disable-next-line no-console
    console.debug(`[Analytics Event] ${name}:`, params);
  }

  // 1. Yandex.Metrika goal
  if (ymCounterId && typeof window.ym === 'function') {
    try {
      window.ym(ymCounterId, 'reachGoal', name, params);
    } catch {
      // Ignore network / script errors
    }
  }

  // 2. Google Analytics 4 event
  if (gaMeasurementId && typeof window.gtag === 'function') {
    try {
      window.gtag('event', name, params);
    } catch {
      // Ignore network / script errors
    }
  }
}
