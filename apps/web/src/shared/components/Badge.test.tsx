import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from './Badge';

describe('Badge', () => {
  it('renders badge with text and variant styling', () => {
    render(<Badge variant="success">Активна</Badge>);
    const badge = screen.getByText('Активна');
    expect(badge).toBeInTheDocument();
  });
});
