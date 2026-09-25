import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { App } from './App';
import { renderWithProviders } from '@/test/test-utils';
import { sessionApi } from '@/entities/session/api';
import { linkApi } from '@/entities/link/api';
import { useAppStore } from '@/shared/store/app-store';

vi.mock('@/entities/session/api', () => ({
  sessionApi: {
    createSession: vi.fn(),
    getMe: vi.fn(),
    restoreSession: vi.fn(),
  },
}));

vi.mock('@/entities/link/api', () => ({
  linkApi: {
    list: vi.fn(),
    create: vi.fn(),
    toggleStatus: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('App Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      theme: 'dark',
      searchQuery: '',
      viewMode: 'grid',
      isCreateModalOpen: false,
      isSessionModalOpen: false,
      sessionKey: null,
      selectedQRLink: null,
    });
  });

  it('automatically initialises guest session if none exists on mount', async () => {
    vi.mocked(sessionApi.createSession).mockResolvedValueOnce({
      id: 'initial-session-id',
      access_key: 'ocean-whisper-forest-1234',
      links_count: 0,
      is_premium: false,
      last_active_at: '2026-09-25T12:00:00Z',
      created_at: '2026-09-25T12:00:00Z',
    });
    vi.mocked(linkApi.list).mockResolvedValue({
      data: [],
      total: 0,
      limit: 50,
      offset: 0,
    });

    renderWithProviders(<App />);

    await waitFor(() => {
      expect(sessionApi.createSession).toHaveBeenCalledTimes(1);
      expect(useAppStore.getState().sessionKey).toBe('ocean-whisper-forest-1234');
    });
  });

  it('renders navbar, hero banner, link creation form, and link list', async () => {
    useAppStore.setState({ sessionKey: 'existing-session-key' });
    vi.mocked(sessionApi.getMe).mockResolvedValue({
      id: 'existing-session-id',
      links_count: 1,
      is_premium: false,
      last_active_at: '2026-09-25T12:00:00Z',
      created_at: '2026-09-25T12:00:00Z',
    });
    vi.mocked(linkApi.list).mockResolvedValue({
      data: [
        {
          id: 'link-1',
          original_url: 'https://avari.dev',
          code: 'avari-main',
          short_url: 'http://localhost:4820/s/avari-main',
          title: 'Avari Main Portal',
          clicks: 100,
          is_active: true,
          is_nsfw: false,
          created_at: '2026-09-25T12:00:00Z',
          updated_at: '2026-09-25T12:00:00Z',
        },
      ],
      total: 1,
      limit: 50,
      offset: 0,
    });

    renderWithProviders(<App />);

    // Check presence of key parts
    expect(screen.getAllByText(/avari links/i)[0]).toBeInTheDocument();
    expect(screen.getByText(/короткие ссылки/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Avari Main Portal')).toBeInTheDocument();
      expect(screen.getByText('100 переходов')).toBeInTheDocument();
    });
  });

  it('opens and closes session modal when clicking profile/key button in navbar', async () => {
    useAppStore.setState({ sessionKey: 'my-session-key' });
    vi.mocked(sessionApi.getMe).mockResolvedValue({
      id: 'my-session-id',
      links_count: 0,
      is_premium: false,
      last_active_at: '2026-09-25T12:00:00Z',
      created_at: '2026-09-25T12:00:00Z',
    });
    vi.mocked(linkApi.list).mockResolvedValue({
      data: [],
      total: 0,
      limit: 50,
      offset: 0,
    });

    renderWithProviders(<App />);

    const sessionBtn = screen.getByRole('button', { name: /управление ключом доступа/i });
    fireEvent.click(sessionBtn);

    expect(useAppStore.getState().isSessionModalOpen).toBe(true);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('switches interface language between Russian and English via header button', async () => {
    useAppStore.setState({ sessionKey: 'my-session-key', language: 'ru' });
    vi.mocked(sessionApi.getMe).mockResolvedValue({
      id: 'my-session-id',
      links_count: 0,
      is_premium: false,
      last_active_at: '2026-09-25T12:00:00Z',
      created_at: '2026-09-25T12:00:00Z',
    });
    vi.mocked(linkApi.list).mockResolvedValue({
      data: [],
      total: 0,
      limit: 50,
      offset: 0,
    });

    renderWithProviders(<App />);

    expect(screen.getByText(/короткие ссылки/i)).toBeInTheDocument();
    expect(screen.getAllByText(/мои ссылки/i).length).toBeGreaterThan(0);

    const langBtn = screen.getByRole('button', { name: /переключить на английский язык/i });
    fireEvent.click(langBtn);

    expect(useAppStore.getState().language).toBe('en');
    expect(screen.getByText(/short links/i)).toBeInTheDocument();
    expect(screen.getAllByText(/my links/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /create short link/i })).toBeInTheDocument();
  });
});
