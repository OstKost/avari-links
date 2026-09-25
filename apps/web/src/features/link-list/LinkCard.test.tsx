import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { LinkCard } from './LinkCard';
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

const mockLink: Link = {
  id: 'test-link-id',
  original_url: 'https://github.com/OstKost/avari-links',
  code: 'avari-repo',
  short_url: 'http://localhost:4820/s/avari-repo',
  title: 'Avari Repository',
  clicks: 42,
  is_active: true,
  is_nsfw: true,
  created_at: '2026-09-25T12:00:00Z',
  updated_at: '2026-09-25T12:00:00Z',
};

describe('LinkCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      language: 'ru',
    });
  });

  it('renders link details including title, short URL, destination, clicks and badges', () => {
    renderWithProviders(<LinkCard link={mockLink} />);

    expect(screen.getByText('Avari Repository')).toBeInTheDocument();
    expect(screen.getByText('http://localhost:4820/s/avari-repo')).toBeInTheDocument();
    expect(screen.getByText('https://github.com/OstKost/avari-links')).toBeInTheDocument();
    expect(screen.getByText('42 переходов')).toBeInTheDocument();
    expect(screen.getByText('Активна')).toBeInTheDocument();
    expect(screen.getByText('18+')).toBeInTheDocument();
  });

  it('copies short URL to clipboard on copy button click', () => {
    renderWithProviders(<LinkCard link={mockLink} />);

    const copyBtn = screen.getByRole('button', { name: /копировать ссылку/i });
    fireEvent.click(copyBtn);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('http://localhost:4820/s/avari-repo');
  });

  it('opens QR modal with link details when clicking QR button', () => {
    renderWithProviders(<LinkCard link={mockLink} />);

    const qrBtn = screen.getByTitle(/показать qr-код/i);
    fireEvent.click(qrBtn);

    expect(useAppStore.getState().selectedQRLink).toEqual({
      url: 'http://localhost:4820/s/avari-repo',
      title: 'Avari Repository',
      code: 'avari-repo',
    });
  });

  it('toggles link status when clicking power button', async () => {
    vi.mocked(linkApi.toggleStatus).mockResolvedValueOnce({
      ...mockLink,
      is_active: false,
    });

    renderWithProviders(<LinkCard link={mockLink} />);

    const toggleBtn = screen.getByTitle(/приостановить ссылку/i);
    fireEvent.click(toggleBtn);

    await waitFor(() => {
      expect(linkApi.toggleStatus).toHaveBeenCalledWith('test-link-id', false);
    });
  });

  it('deletes link when clicking delete button with confirmation', async () => {
    vi.mocked(linkApi.delete).mockResolvedValueOnce(undefined);

    renderWithProviders(<LinkCard link={mockLink} />);

    const deleteBtn = screen.getByTitle(/удалить ссылку/i);
    fireEvent.click(deleteBtn);

    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => {
      expect(linkApi.delete).toHaveBeenCalledWith('test-link-id');
    });
  });
});
