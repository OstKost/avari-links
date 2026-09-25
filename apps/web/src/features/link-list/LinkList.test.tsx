import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { LinkList } from './LinkList';
import { renderWithProviders } from '@/test/test-utils';
import { linkApi } from '@/entities/link/api';
import { useAppStore } from '@/shared/store/app-store';
import type { Link } from '@/entities/link/types';

vi.mock('@/entities/link/api', () => ({
  linkApi: {
    list: vi.fn(),
  },
}));

const mockLinks: Link[] = [
  {
    id: 'link-1',
    original_url: 'https://react.dev',
    code: 'react-doc',
    short_url: 'http://localhost:4820/s/react-doc',
    title: 'React Documentation',
    clicks: 10,
    is_active: true,
    is_nsfw: false,
    created_at: '2026-09-25T12:00:00Z',
    updated_at: '2026-09-25T12:00:00Z',
  },
];

describe('LinkList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      sessionKey: 'valid-session-key',
      viewMode: 'grid',
    });
  });

  it('renders links in grid mode', async () => {
    vi.mocked(linkApi.list).mockResolvedValueOnce({
      data: mockLinks,
      total: 1,
      limit: 50,
      offset: 0,
    });

    renderWithProviders(<LinkList />);

    await waitFor(() => {
      expect(screen.getByText('React Documentation')).toBeInTheDocument();
      expect(screen.getByText('10 переходов')).toBeInTheDocument();
    });
  });

  it('renders empty state when no links exist', async () => {
    vi.mocked(linkApi.list).mockResolvedValueOnce({
      data: [],
      total: 0,
      limit: 50,
      offset: 0,
    });

    renderWithProviders(<LinkList />);

    await waitFor(() => {
      expect(screen.getByText('Пока нет коротких ссылок')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /создать первую ссылку/i })).toBeInTheDocument();
    });
  });

  it('switches between grid and table view', async () => {
    vi.mocked(linkApi.list).mockResolvedValue({
      data: mockLinks,
      total: 1,
      limit: 50,
      offset: 0,
    });

    renderWithProviders(<LinkList />);

    await waitFor(() => {
      expect(screen.getByText('React Documentation')).toBeInTheDocument();
    });

    const tableSwitchBtn = screen.getByRole('button', { name: /показать таблицу/i });
    fireEvent.click(tableSwitchBtn);

    expect(useAppStore.getState().viewMode).toBe('table');
    expect(screen.getByText('Ссылка и название')).toBeInTheDocument();
  });
});
