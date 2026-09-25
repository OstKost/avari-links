import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { CreateLinkForm } from './CreateLinkForm';
import { renderWithProviders } from '@/test/test-utils';
import { linkApi } from '@/entities/link/api';
import { useAppStore } from '@/shared/store/app-store';

vi.mock('@/entities/link/api', () => ({
  linkApi: {
    create: vi.fn(),
    preview: vi.fn(),
  },
}));

describe('CreateLinkForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      sessionKey: 'valid-session-key',
      language: 'ru',
    });
  });

  it('renders all form inputs and submit button', () => {
    renderWithProviders(<CreateLinkForm />);

    expect(screen.getByLabelText(/адрес назначения/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/название/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/свой код/i)).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /контент 18\+/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /создать короткую ссылку/i })).toBeInTheDocument();
  });

  it('shows validation error for invalid URL without checking or submitting', async () => {
    renderWithProviders(<CreateLinkForm />);

    const urlInput = screen.getByLabelText(/адрес назначения/i);
    fireEvent.change(urlInput, { target: { value: 'not-a-valid-url' } });

    const submitBtn = screen.getByRole('button', { name: /создать короткую ссылку/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/укажите корректный url/i)).toBeInTheDocument();
    });

    expect(linkApi.preview).not.toHaveBeenCalled();
    expect(linkApi.create).not.toHaveBeenCalled();
  });

  it('runs preview check and automatically creates link when site is reachable', async () => {
    const onSuccess = vi.fn();
    vi.mocked(linkApi.preview).mockResolvedValueOnce({
      url: 'https://example.com/target',
      is_reachable: true,
      status_code: 200,
      title: 'Target Title',
      description: 'Example page description',
    });

    vi.mocked(linkApi.create).mockResolvedValueOnce({
      id: 'link-123',
      original_url: 'https://example.com/target',
      code: 'custom-target',
      short_url: 'http://localhost:4820/s/custom-target',
      title: 'Target Title',
      clicks: 0,
      is_active: true,
      is_nsfw: true,
      created_at: '2026-09-25T12:00:00Z',
      updated_at: '2026-09-25T12:00:00Z',
    });

    renderWithProviders(<CreateLinkForm onSuccess={onSuccess} />);

    fireEvent.change(screen.getByLabelText(/адрес назначения/i), {
      target: { value: 'https://example.com/target' },
    });
    fireEvent.change(screen.getByLabelText(/название/i), {
      target: { value: 'Target Title' },
    });
    fireEvent.change(screen.getByLabelText(/свой код/i), {
      target: { value: 'custom-target' },
    });
    fireEvent.click(screen.getByRole('switch', { name: /контент 18\+/i }));

    const submitBtn = screen.getByRole('button', { name: /создать короткую ссылку/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(linkApi.preview).toHaveBeenCalledWith('https://example.com/target');
      expect(linkApi.create).toHaveBeenCalledWith({
        original_url: 'https://example.com/target',
        title: 'Target Title',
        custom_code: 'custom-target',
        is_nsfw: true,
      });
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('auto-fills title from preview if user left it blank', async () => {
    vi.mocked(linkApi.preview).mockResolvedValueOnce({
      url: 'https://example.com/article',
      is_reachable: true,
      status_code: 200,
      title: 'Auto Extracted Title',
    });

    vi.mocked(linkApi.create).mockResolvedValueOnce({
      id: 'link-456',
      original_url: 'https://example.com/article',
      code: 'auto-code',
      short_url: 'http://localhost:4820/s/auto-code',
      title: 'Auto Extracted Title',
      clicks: 0,
      is_active: true,
      is_nsfw: false,
      created_at: '2026-09-25T12:00:00Z',
      updated_at: '2026-09-25T12:00:00Z',
    });

    renderWithProviders(<CreateLinkForm />);

    fireEvent.change(screen.getByLabelText(/адрес назначения/i), {
      target: { value: 'https://example.com/article' },
    });

    const submitBtn = screen.getByRole('button', { name: /создать короткую ссылку/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(linkApi.create).toHaveBeenCalledWith({
        original_url: 'https://example.com/article',
        title: 'Auto Extracted Title',
        custom_code: undefined,
        is_nsfw: false,
      });
    });
  });

  it('shows retry button on failure and force-creates link on second submit click', async () => {
    const onSuccess = vi.fn();
    vi.mocked(linkApi.preview).mockResolvedValueOnce({
      url: 'https://unreachable-site.xyz',
      is_reachable: false,
      status_code: 0,
      error: 'DNS lookup failed',
    });

    vi.mocked(linkApi.create).mockResolvedValueOnce({
      id: 'link-789',
      original_url: 'https://unreachable-site.xyz',
      code: 'force-code',
      short_url: 'http://localhost:4820/s/force-code',
      title: 'Forced Link',
      clicks: 0,
      is_active: true,
      is_nsfw: false,
      created_at: '2026-09-25T12:00:00Z',
      updated_at: '2026-09-25T12:00:00Z',
    });

    renderWithProviders(<CreateLinkForm onSuccess={onSuccess} />);

    fireEvent.change(screen.getByLabelText(/адрес назначения/i), {
      target: { value: 'https://unreachable-site.xyz' },
    });
    fireEvent.change(screen.getByLabelText(/название/i), {
      target: { value: 'Forced Link' },
    });

    // 1st click -> preview fails
    const submitBtn = screen.getByRole('button', { name: /создать короткую ссылку/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(linkApi.preview).toHaveBeenCalledWith('https://unreachable-site.xyz');
      expect(screen.getByRole('button', { name: /повторить проверку/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /создать всё равно/i })).toBeInTheDocument();
    });

    expect(linkApi.create).not.toHaveBeenCalled();

    // 2nd click -> force create
    const forceBtn = screen.getByRole('button', { name: /создать всё равно/i });
    fireEvent.click(forceBtn);

    await waitFor(() => {
      expect(linkApi.create).toHaveBeenCalledWith({
        original_url: 'https://unreachable-site.xyz',
        title: 'Forced Link',
        custom_code: undefined,
        is_nsfw: false,
      });
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('re-triggers preview check when clicking retry button', async () => {
    vi.mocked(linkApi.preview)
      .mockResolvedValueOnce({
        url: 'https://flaky-site.org',
        is_reachable: false,
        status_code: 504,
        error: 'Gateway Timeout',
      })
      .mockResolvedValueOnce({
        url: 'https://flaky-site.org',
        is_reachable: true,
        status_code: 200,
        title: 'Flaky Site Recovered',
      });

    vi.mocked(linkApi.create).mockResolvedValueOnce({
      id: 'link-recovered',
      original_url: 'https://flaky-site.org',
      code: 'recovered',
      short_url: 'http://localhost:4820/s/recovered',
      title: 'Flaky Site Recovered',
      clicks: 0,
      is_active: true,
      is_nsfw: false,
      created_at: '2026-09-25T12:00:00Z',
      updated_at: '2026-09-25T12:00:00Z',
    });

    renderWithProviders(<CreateLinkForm />);

    fireEvent.change(screen.getByLabelText(/адрес назначения/i), {
      target: { value: 'https://flaky-site.org' },
    });

    fireEvent.click(screen.getByRole('button', { name: /создать короткую ссылку/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /повторить проверку/i })).toBeInTheDocument();
    });

    // Click retry
    fireEvent.click(screen.getByRole('button', { name: /повторить проверку/i }));

    await waitFor(() => {
      expect(linkApi.preview).toHaveBeenCalledTimes(2);
      expect(linkApi.create).toHaveBeenCalledWith({
        original_url: 'https://flaky-site.org',
        title: 'Flaky Site Recovered',
        custom_code: undefined,
        is_nsfw: false,
      });
    });
  });
});
