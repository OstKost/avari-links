import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { LinkPreviewCard } from './LinkPreviewCard';
import { renderWithProviders } from '@/test/test-utils';

describe('LinkPreviewCard', () => {
  it('renders loading skeleton when isLoading is true', () => {
    renderWithProviders(<LinkPreviewCard isLoading={true} preview={null} />);

    expect(screen.getByText(/проверяем сайт/i)).toBeInTheDocument();
    expect(screen.getByText(/загрузка превью/i)).toBeInTheDocument();
  });

  it('renders unreachable alert state when is_reachable is false', () => {
    renderWithProviders(
      <LinkPreviewCard
        isLoading={false}
        preview={{
          url: 'https://broken-domain.test/page',
          is_reachable: false,
          status_code: 0,
          error: 'DNS lookup failed',
        }}
      />
    );

    expect(screen.getByText(/сайт не отвечает/i)).toBeInTheDocument();
    expect(screen.getByText(/DNS lookup failed/i)).toBeInTheDocument();
    expect(screen.getByText(/broken-domain.test/i)).toBeInTheDocument();
  });

  it('renders rich metadata and 200 OK badge when site is reachable', () => {
    renderWithProviders(
      <LinkPreviewCard
        isLoading={false}
        preview={{
          url: 'https://github.com/OstKost/avari-links',
          is_reachable: true,
          status_code: 200,
          title: 'GitHub - OstKost/avari-links',
          description: 'A modern, high-performance URL shortener with analytics',
          image_url: 'https://opengraph.githubassets.com/test.png',
          favicon_url: 'https://github.com/favicon.ico',
        }}
      />
    );

    expect(screen.getByText(/200 OK/i)).toBeInTheDocument();
    expect(screen.getByText(/GitHub - OstKost\/avari-links/i)).toBeInTheDocument();
    expect(screen.getByText(/A modern, high-performance URL shortener/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /открыть/i })).toHaveAttribute(
      'href',
      'https://github.com/OstKost/avari-links'
    );
  });
});
