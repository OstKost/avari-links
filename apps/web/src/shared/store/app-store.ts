import { create } from 'zustand';
import { SESSION_KEY_STORAGE } from '@/shared/api/client';

interface AppState {
  language: 'ru' | 'en';
  setLanguage: (language: 'ru' | 'en') => void;
  toggleLanguage: () => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  viewMode: 'grid' | 'table';
  setViewMode: (mode: 'grid' | 'table') => void;
  isCreateModalOpen: boolean;
  setCreateModalOpen: (open: boolean) => void;
  isSessionModalOpen: boolean;
  setSessionModalOpen: (open: boolean) => void;
  sessionKey: string | null;
  setSessionKey: (key: string | null) => void;
  selectedQRLink: { url: string; title: string; code: string } | null;
  setSelectedQRLink: (link: { url: string; title: string; code: string } | null) => void;
}

export const useAppStore = create<AppState>((set) => {
  // Initialize language from localStorage or default
  const savedLanguage = typeof window !== 'undefined' ? (localStorage.getItem('language') as 'ru' | 'en' | null) : null;
  const initialLanguage: 'ru' | 'en' = savedLanguage === 'en' ? 'en' : 'ru';

  // Initialize theme from system or localStorage
  const savedTheme = typeof window !== 'undefined' ? (localStorage.getItem('theme') as 'light' | 'dark' | null) : null;
  const initialTheme = savedTheme === 'light' ? 'light' : 'dark';

  const savedSessionKey = typeof window !== 'undefined' ? localStorage.getItem(SESSION_KEY_STORAGE) : null;

  if (typeof document !== 'undefined') {
    document.documentElement.lang = initialLanguage;
    if (initialTheme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
  }

  return {
    language: initialLanguage,
    setLanguage: (language) => {
      if (typeof document !== 'undefined') {
        document.documentElement.lang = language;
        localStorage.setItem('language', language);
      }
      set({ language });
    },
    toggleLanguage: () =>
      set((state) => {
        const nextLang = state.language === 'ru' ? 'en' : 'ru';
        if (typeof document !== 'undefined') {
          document.documentElement.lang = nextLang;
          localStorage.setItem('language', nextLang);
        }
        return { language: nextLang };
      }),
    theme: initialTheme,
    toggleTheme: () =>
      set((state) => {
        const nextTheme = state.theme === 'light' ? 'dark' : 'light';
        if (typeof document !== 'undefined') {
          if (nextTheme === 'dark') {
            document.documentElement.classList.add('dark');
            document.documentElement.classList.remove('light');
          } else {
            document.documentElement.classList.remove('dark');
            document.documentElement.classList.add('light');
          }
          localStorage.setItem('theme', nextTheme);
        }
        return { theme: nextTheme };
      }),
    searchQuery: '',
    setSearchQuery: (searchQuery) => set({ searchQuery }),
    viewMode: 'grid',
    setViewMode: (viewMode) => set({ viewMode }),
    isCreateModalOpen: false,
    setCreateModalOpen: (isCreateModalOpen) => set({ isCreateModalOpen }),
    isSessionModalOpen: false,
    setSessionModalOpen: (isSessionModalOpen) => set({ isSessionModalOpen }),
    sessionKey: savedSessionKey,
    setSessionKey: (sessionKey) => set({ sessionKey }),
    selectedQRLink: null,
    setSelectedQRLink: (selectedQRLink) => set({ selectedQRLink }),
  };
});
