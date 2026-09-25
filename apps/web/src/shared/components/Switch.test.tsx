import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Switch } from './Switch';

describe('Switch', () => {
  it('renders switch control and toggles state', () => {
    const handleChange = vi.fn();
    render(
      <Switch
        label="NSFW переключатель"
        description="Предупреждение о контенте"
        onChange={handleChange}
      />
    );

    const switchControl = screen.getByRole('switch', { name: /nsfw переключатель/i });
    expect(switchControl).toBeInTheDocument();
    expect(switchControl).not.toBeChecked();

    fireEvent.click(switchControl);
    expect(handleChange).toHaveBeenCalled();
  });

  it('renders disabled state', () => {
    render(<Switch label="Отключенный" disabled />);
    const switchControl = screen.getByRole('switch');
    expect(switchControl).toBeDisabled();
  });
});
