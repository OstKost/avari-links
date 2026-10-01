import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { Footer } from './Footer';
import { renderWithProviders } from '@/test/test-utils';
import { APP_VERSION } from '@/shared/config/version';

describe('Footer', () => {
  it('renders brand, tech stack, and application version badge', () => {
    renderWithProviders(<Footer />);

    expect(screen.getAllByText(/Avari Links/i).length).toBeGreaterThan(0);
    expect(screen.getByTestId('app-version')).toHaveTextContent(APP_VERSION);
  });
});
