import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Input } from './Input';

describe('Input', () => {
  it('renders input with label and helper text', () => {
    const handleChange = vi.fn();
    render(
      <Input
        label="Адрес ссылки"
        placeholder="https://example.com"
        helperText="Поддерживается http и https"
        onChange={handleChange}
      />
    );

    expect(screen.getByLabelText(/адрес ссылки/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('https://example.com')).toBeInTheDocument();
    expect(screen.getByText(/поддерживается http и https/i)).toBeInTheDocument();

    const input = screen.getByPlaceholderText('https://example.com');
    fireEvent.change(input, { target: { value: 'https://avari.dev' } });
    expect(handleChange).toHaveBeenCalled();
  });

  it('renders error message and aria-invalid', () => {
    render(<Input label="Поле с ошибкой" error="Обязательное поле" />);

    const input = screen.getByLabelText(/поле с ошибкой/i);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Обязательное поле')).toBeInTheDocument();
  });
});
