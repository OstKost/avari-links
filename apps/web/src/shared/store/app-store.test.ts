import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from './app-store';

describe('useAppStore', () => {
  beforeEach(() => {
    useAppStore.setState({
      language: 'ru',
      theme: 'dark',
      searchQuery: '',
      viewMode: 'grid',
      isCreateModalOpen: false,
      isSessionModalOpen: false,
      sessionKey: null,
      selectedQRLink: null,
    });
  });

  it('toggles language between ru and en', () => {
    expect(useAppStore.getState().language).toBe('ru');
    useAppStore.getState().toggleLanguage();
    expect(useAppStore.getState().language).toBe('en');
    expect(localStorage.getItem('language')).toBe('en');
    expect(document.documentElement.lang).toBe('en');

    useAppStore.getState().toggleLanguage();
    expect(useAppStore.getState().language).toBe('ru');
    expect(localStorage.getItem('language')).toBe('ru');
    expect(document.documentElement.lang).toBe('ru');
  });

  it('sets specific language', () => {
    useAppStore.getState().setLanguage('en');
    expect(useAppStore.getState().language).toBe('en');
    expect(localStorage.getItem('language')).toBe('en');
    expect(document.documentElement.lang).toBe('en');
  });

  it('toggles theme between dark and light', () => {
    expect(useAppStore.getState().theme).toBe('dark');
    useAppStore.getState().toggleTheme();
    expect(useAppStore.getState().theme).toBe('light');
    expect(localStorage.getItem('theme')).toBe('light');
    expect(document.documentElement.classList.contains('light')).toBe(true);

    useAppStore.getState().toggleTheme();
    expect(useAppStore.getState().theme).toBe('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('updates search query', () => {
    useAppStore.getState().setSearchQuery('my-custom-query');
    expect(useAppStore.getState().searchQuery).toBe('my-custom-query');
  });

  it('toggles view mode between grid and table', () => {
    useAppStore.getState().setViewMode('table');
    expect(useAppStore.getState().viewMode).toBe('table');
    useAppStore.getState().setViewMode('grid');
    expect(useAppStore.getState().viewMode).toBe('grid');
  });

  it('manages modal states', () => {
    useAppStore.getState().setCreateModalOpen(true);
    expect(useAppStore.getState().isCreateModalOpen).toBe(true);

    useAppStore.getState().setSessionModalOpen(true);
    expect(useAppStore.getState().isSessionModalOpen).toBe(true);
  });

  it('stores and updates sessionKey and selectedQRLink', () => {
    useAppStore.getState().setSessionKey('alpha-beta-gamma-1234');
    expect(useAppStore.getState().sessionKey).toBe('alpha-beta-gamma-1234');

    const qrData = { url: 'http://localhost/s/xyz', title: 'Test Link', code: 'xyz' };
    useAppStore.getState().setSelectedQRLink(qrData);
    expect(useAppStore.getState().selectedQRLink).toEqual(qrData);
  });

  it('increments and caps session rerolls at 5', () => {
    useAppStore.getState().resetRerolls();
    expect(useAppStore.getState().rerollsCount).toBe(0);

    for (let i = 1; i <= 5; i++) {
      useAppStore.getState().incrementRerolls();
      expect(useAppStore.getState().rerollsCount).toBe(i);
    }

    // Try exceeding max of 5
    useAppStore.getState().incrementRerolls();
    expect(useAppStore.getState().rerollsCount).toBe(5);

    useAppStore.getState().resetRerolls();
    expect(useAppStore.getState().rerollsCount).toBe(0);
  });
});
