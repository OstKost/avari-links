import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { LinkTable } from './LinkTable';
import { renderWithProviders } from '@/test/test-utils';
import { linkApi } from '@/entities/link/api';
import { useAppStore } from '@/shared/store/app-store';
import type { Link } from '@/entities/link/types';

vi.mock('@/entities/link/api', () => ({
  linkApi: {
    toggleStatus: vi.fn(),
    delete: vi.fn(),
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
  {
    id: 'link-2',
    original_url: 'https://go.dev',
    code: 'go-doc',
    short_url: 'http://localhost:4820/s/go-doc',
    title: 'Go Language',
    clicks: 25,
    is_active: false,
    is_nsfw: true,
    created_at: '2026-09-25T12:00:00Z',
    updated_at: '2026-09-25T12:00:00Z',
  },
];

describe('LinkTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      language: 'ru',
    });
  });

  it('renders table columns and link rows', () => {
    renderWithProviders(<LinkTable links={mockLinks} />);

    expect(screen.getByText('Ссылка и название')).toBeInTheDocument();
    expect(screen.getByText('Адрес назначения')).toBeInTheDocument();
    expect(screen.getByText('React Documentation')).toBeInTheDocument();
    expect(screen.getByText('Go Language')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();
    expect(screen.getByText('Активна')).toBeInTheDocument();
    expect(screen.getByText('Пауза')).toBeInTheDocument();
  });

  it('handles row actions: toggle and delete', async () => {
    vi.mocked(linkApi.toggleStatus).mockResolvedValueOnce({
      ...mockLinks[0],
      is_active: false,
    });
    vi.mocked(linkApi.delete).mockResolvedValueOnce(undefined);

    renderWithProviders(<LinkTable links={mockLinks} />);

    const toggleButtons = screen.getAllByTitle(/приостановить ссылку|активировать ссылку/i);
    fireEvent.click(toggleButtons[0]);
    await waitFor(() => {
      expect(linkApi.toggleStatus).toHaveBeenCalledWith('link-1', false);
    });

    const deleteButtons = screen.getAllByTitle(/удалить ссылку/i);
    fireEvent.click(deleteButtons[1]);
    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => {
      expect(linkApi.delete).toHaveBeenCalledWith('link-2');
    });
  });
});
