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
    vi.mocked(sessionApi.getMe).mockResolvedValue({
      id: 'default-session-id',
      links_count: 0,
      is_premium: false,
      last_active_at: '2026-09-25T12:00:00Z',
      created_at: '2026-09-25T12:00:00Z',
    });
    useAppStore.setState({
      isSessionModalOpen: true,
      sessionKey: 'whispering-mountain-9921',
      rerollsCount: 0,
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

  it('allows rerolling name directly when user has 0 links', async () => {
    useAppStore.setState({ rerollsCount: 0 });
    vi.mocked(sessionApi.getMe).mockResolvedValueOnce({
      id: 'session-id',
      links_count: 0,
      is_premium: false,
      last_active_at: '2026-09-25T12:00:00Z',
      created_at: '2026-09-25T12:00:00Z',
    });
    vi.mocked(sessionApi.createSession).mockResolvedValueOnce({
      id: 'new-session-id',
      access_key: 'mystic-dragon-1111',
      links_count: 0,
      is_premium: false,
      last_active_at: '2026-09-25T12:00:00Z',
      created_at: '2026-09-25T12:00:00Z',
    });

    renderWithProviders(<SessionModal />);

    const rerollBtn = screen.getByRole('button', { name: /сменить имя \(реролл\)/i });
    expect(rerollBtn).toBeInTheDocument();
    expect(screen.getByText('5/5')).toBeInTheDocument();

    fireEvent.click(rerollBtn);

    await waitFor(() => {
      expect(sessionApi.createSession).toHaveBeenCalled();
      expect(useAppStore.getState().sessionKey).toBe('mystic-dragon-1111');
      expect(useAppStore.getState().rerollsCount).toBe(1);
    });
  });

  it('shows warning when rerolling with existing links, then allows confirming', async () => {
    useAppStore.setState({ rerollsCount: 1 });
    vi.mocked(sessionApi.getMe).mockResolvedValueOnce({
      id: 'session-id',
      links_count: 4,
      is_premium: false,
      last_active_at: '2026-09-25T12:00:00Z',
      created_at: '2026-09-25T12:00:00Z',
    });
    vi.mocked(sessionApi.createSession).mockResolvedValueOnce({
      id: 'new-session-id',
      access_key: 'silver-hawk-2222',
      links_count: 0,
      is_premium: false,
      last_active_at: '2026-09-25T12:00:00Z',
      created_at: '2026-09-25T12:00:00Z',
    });

    renderWithProviders(<SessionModal />);

    await waitFor(() => {
      expect(screen.getByText(/ссылок: 4/i)).toBeInTheDocument();
    });

    const rerollBtn = screen.getByRole('button', { name: /сменить имя \(реролл\)/i });
    fireEvent.click(rerollBtn);

    // Warning alert box appears
    await waitFor(() => {
      expect(screen.getByText(/внимание: сохраните текущий ключ/i)).toBeInTheDocument();
      expect(screen.getByText(/у вас сохранено ссылок: 4/i)).toBeInTheDocument();
    });

    // Confirm button inside warning
    const confirmBtn = screen.getByRole('button', { name: /^сменить имя$/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(sessionApi.createSession).toHaveBeenCalled();
      expect(useAppStore.getState().sessionKey).toBe('silver-hawk-2222');
      expect(useAppStore.getState().rerollsCount).toBe(2);
    });
  });

  it('disables reroll button when limit of 5 is reached', () => {
    useAppStore.setState({ rerollsCount: 5 });
    renderWithProviders(<SessionModal />);

    const rerollBtn = screen.getByRole('button', { name: /сменить имя \(реролл\)/i });
    expect(rerollBtn).toBeDisabled();
    expect(screen.getByText('0/5')).toBeInTheDocument();
  });
});
