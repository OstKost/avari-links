import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSeoHead } from './use-seo-head';
import { useAppStore } from '@/shared/store/app-store';

describe('useSeoHead hook', () => {
  beforeEach(() => {
    document.title = '';
    document.documentElement.lang = '';
    document.head.innerHTML = `
      <meta name="description" content="" />
      <meta property="og:title" content="" />
      <meta property="og:description" content="" />
      <meta name="twitter:title" content="" />
      <meta name="twitter:description" content="" />
    `;
    useAppStore.setState({ language: 'ru' });
  });

  it('updates document title, lang and meta description for ru', () => {
    renderHook(() => useSeoHead());

    expect(document.documentElement.lang).toBe('ru');
    expect(document.title).toContain('Avari Links');
    const metaDesc = document.querySelector('meta[name="description"]');
    expect(metaDesc?.getAttribute('content')).toContain('короткие ссылки');
  });

  it('updates document title, lang and meta description when switching to en', () => {
    const { rerender } = renderHook(() => useSeoHead());

    useAppStore.setState({ language: 'en' });
    rerender();

    expect(document.documentElement.lang).toBe('en');
    expect(document.title).toContain('Short URLs');
    const metaDesc = document.querySelector('meta[name="description"]');
    expect(metaDesc?.getAttribute('content')).toContain('short links');
  });
});
