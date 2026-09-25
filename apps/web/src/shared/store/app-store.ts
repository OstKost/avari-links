import { create } from 'zustand';

interface AppState {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  viewMode: 'grid' | 'table';
  setViewMode: (mode: 'grid' | 'table') => void;
  isCreateModalOpen: boolean;
  setCreateModalOpen: (open: boolean) => void;
  selectedQRLink: { url: string; title: string; code: string } | null;
  setSelectedQRLink: (link: { url: string; title: string; code: string } | null) => void;
}

export const useAppStore = create<AppState>((set) => {
  // Initialize theme from system or localStorage
  const savedTheme = typeof window !== 'undefined' ? (localStorage.getItem('theme') as 'light' | 'dark' | null) : null;
  const initialTheme = savedTheme === 'light' ? 'light' : 'dark';

  if (typeof document !== 'undefined') {
    if (initialTheme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
  }

  return {
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
    selectedQRLink: null,
    setSelectedQRLink: (selectedQRLink) => set({ selectedQRLink }),
  };
});
