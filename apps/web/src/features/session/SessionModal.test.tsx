import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { SessionModal } from './SessionModal';
import { renderWithProviders } from '@/test/test-utils';
import { sessionApi } from '@/entities/session/api';
import { useAppStore } from '@/shared/store/app-store';

vi.mock('@/entities/session/api', () => ({
  sessionApi: {
    getMe: vi.fn(),
    createSession: vi.fn(),
    restoreSession: vi.fn(),
  },
}));

describe('SessionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      isSessionModalOpen: true,
      sessionKey: 'whispering-mountain-9921',
    });
  });

  it('renders current session key and storage policy note', () => {
    renderWithProviders(<SessionModal />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/ваш персональный ключ/i)).toBeInTheDocument();
    expect(screen.getByText(/whispering/i)).toBeInTheDocument();
    expect(screen.getByText(/политика хранения и активности/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /копировать/i })).toBeInTheDocument();
  });

  it('copies current key to clipboard', () => {
    renderWithProviders(<SessionModal />);

    const copyBtn = screen.getByRole('button', { name: /копировать/i });
    fireEvent.click(copyBtn);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('whispering-mountain-9921');
  });

  it('restores session using entered access key', async () => {
    vi.mocked(sessionApi.restoreSession).mockResolvedValueOnce({
      id: 'restored-session-id',
      access_key: 'restored-key-1234',
      links_count: 5,
      is_premium: false,
      last_active_at: '2026-09-25T12:00:00Z',
      created_at: '2026-09-25T12:00:00Z',
    });

    renderWithProviders(<SessionModal />);

    const input = screen.getByPlaceholderText(/например: cosmic-totoro/i);
    fireEvent.change(input, { target: { value: 'restored-key-1234' } });

    const submitBtn = screen.getByRole('button', { name: /войти/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(sessionApi.restoreSession).toHaveBeenCalledWith({
        access_key: 'restored-key-1234',
      });
      expect(useAppStore.getState().sessionKey).toBe('restored-key-1234');
      expect(useAppStore.getState().isSessionModalOpen).toBe(false);
    });
  });

  it('generates a new session when clicking reset button', async () => {
    vi.mocked(sessionApi.createSession).mockResolvedValueOnce({
      id: 'new-session-id',
      access_key: 'brand-new-5555',
      links_count: 0,
      is_premium: false,
      last_active_at: '2026-09-25T12:00:00Z',
      created_at: '2026-09-25T12:00:00Z',
    });

    renderWithProviders(<SessionModal />);

    const resetBtn = screen.getByRole('button', { name: /сгенерировать новый профиль/i });
    fireEvent.click(resetBtn);

    await waitFor(() => {
      expect(sessionApi.createSession).toHaveBeenCalled();
      expect(useAppStore.getState().sessionKey).toBe('brand-new-5555');
    });
  });

  it('renders premium banner when user has is_premium active', async () => {
    vi.mocked(sessionApi.getMe).mockResolvedValueOnce({
      id: 'premium-session-id',
      links_count: 12,
      is_premium: true,
      last_active_at: '2026-09-25T12:00:00Z',
      created_at: '2026-09-25T12:00:00Z',
    });

    renderWithProviders(<SessionModal />);

    await waitFor(() => {
      expect(screen.getByText(/premium статус активен/i)).toBeInTheDocument();
      expect(screen.getByText(/короткие ссылки от 4 символов/i)).toBeInTheDocument();
    });
  });
});
