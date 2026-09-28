import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, act } from '@testing-library/react';
import { MascotAssistant } from './MascotAssistant';
import { renderWithProviders } from '@/test/test-utils';
import { useAppStore } from '@/shared/store/app-store';

describe('MascotAssistant', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useAppStore.setState({
      language: 'ru',
    });
  });

  it('renders mascot image, Ari signature, and navigation buttons', () => {
    renderWithProviders(<MascotAssistant />);

    expect(screen.getByAltText(/авари/i)).toBeInTheDocument();
    expect(screen.getByText('Ари')).toBeInTheDocument();
    expect(screen.getByLabelText(/предыдущий совет/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/следующий совет/i)).toBeInTheDocument();
  });

  it('types text character by character', () => {
    renderWithProviders(<MascotAssistant />);

    // Advance timers for typing
    for (let i = 0; i < 20; i++) {
      act(() => {
        vi.advanceTimersByTime(35);
      });
    }

    const region = screen.getByRole('region');
    expect(region.textContent?.length).toBeGreaterThan(5);
  });

  it('cycles tips when next or prev buttons are clicked and displays thinking state', () => {
    renderWithProviders(<MascotAssistant />);

    const nextBtn = screen.getByLabelText(/следующий совет/i);
    const prevBtn = screen.getByLabelText(/предыдущий совет/i);

    act(() => {
      fireEvent.click(nextBtn);
    });

    expect(screen.getByText(/вспоминаю совет/i)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5500);
    });

    act(() => {
      fireEvent.click(prevBtn);
    });

    expect(screen.getByText(/вспоминаю совет/i)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5500);
    });

    expect(screen.getByText('Ари')).toBeInTheDocument();
  });
});
