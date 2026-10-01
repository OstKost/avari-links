import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initYandexMetrika, initGoogleAnalytics, trackEvent, trackPageView } from './index';

describe('Analytics module', () => {
  beforeEach(() => {
    delete window.ym;
    delete window.gtag;
    delete window.dataLayer;
    delete window.yandexMetrikaLoaded;
    delete window.googleAnalyticsLoaded;
    document.head.innerHTML = '';
  });

  it('initializes Yandex Metrika and tracks goals', () => {
    initYandexMetrika(12345678, true);

    expect(window.yandexMetrikaLoaded).toBe(true);
    expect(typeof window.ym).toBe('function');

    const ymSpy = vi.fn();
    window.ym = ymSpy;

    trackEvent('link_create_success', { has_custom_slug: true });
    expect(ymSpy).toHaveBeenCalledWith(12345678, 'reachGoal', 'link_create_success', {
      has_custom_slug: true,
    });
  });

  it('initializes Google Analytics and tracks events', () => {
    initGoogleAnalytics('G-ABC12345');

    expect(window.googleAnalyticsLoaded).toBe(true);
    expect(typeof window.gtag).toBe('function');

    const gtagSpy = vi.fn();
    window.gtag = gtagSpy;

    trackEvent('qr_download', { format: 'png' });
    expect(gtagSpy).toHaveBeenCalledWith('event', 'qr_download', { format: 'png' });
  });

  it('tracks page views correctly across YM and GA4', () => {
    initYandexMetrika(12345678, true);
    initGoogleAnalytics('G-ABC12345');

    const ymSpy = vi.fn();
    const gtagSpy = vi.fn();
    window.ym = ymSpy;
    window.gtag = gtagSpy;

    trackPageView('https://links.avari.dev/');
    expect(ymSpy).toHaveBeenCalledWith(12345678, 'hit', 'https://links.avari.dev/');
    expect(gtagSpy).toHaveBeenCalledWith('config', 'G-ABC12345', {
      page_location: 'https://links.avari.dev/',
    });
  });

  it('handles trackEvent gracefully when trackers are not initialized', () => {
    expect(() => {
      trackEvent('theme_toggle', { theme: 'dark' });
    }).not.toThrow();
  });
});
