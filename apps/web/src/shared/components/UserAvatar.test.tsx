import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { UserAvatar } from './UserAvatar';

describe('UserAvatar', () => {
  it('renders correctly with default props', () => {
    render(<UserAvatar />);
    const avatar = screen.getByRole('img');
    expect(avatar).toBeInTheDocument();
    expect(avatar).toHaveAttribute('aria-label', 'Аватар пользователя anonymous-user');
  });

  it('renders custom name deterministically with proper label and title', () => {
    render(<UserAvatar name="cosmic-totoro-4081" />);
    const avatar = screen.getByRole('img');
    expect(avatar).toHaveAttribute('aria-label', 'Аватар пользователя cosmic-totoro-4081');
    expect(avatar).toHaveAttribute('title', 'cosmic-totoro-4081');
  });

  it('renders custom size and custom class', () => {
    render(<UserAvatar name="clever-wolf-2024" size={48} className="custom-test-class" />);
    const avatar = screen.getByRole('img');
    expect(avatar).toHaveClass('custom-test-class');
    expect(avatar).toHaveStyle({ width: '48px', height: '48px' });
  });

  it('renders distinct SVGs for different archetypes', () => {
    const { container: wolfContainer } = render(<UserAvatar name="clever-wolf-4081" />);
    const { container: dragonContainer } = render(<UserAvatar name="blazing-dragon-1234" />);
    
    expect(wolfContainer.innerHTML).not.toEqual(dragonContainer.innerHTML);
  });
});
