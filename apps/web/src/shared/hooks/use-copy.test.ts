import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCopyToClipboard } from './use-copy';

describe('useCopyToClipboard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('copies text to clipboard and resets after 2 seconds', async () => {
    const { result } = renderHook(() => useCopyToClipboard());

    let success: boolean = false;
    await act(async () => {
      success = await result.current.copy('https://avari.dev/s/xyz', 'Тест');
    });

    expect(success).toBe(true);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://avari.dev/s/xyz');
    expect(result.current.copiedText).toBe('https://avari.dev/s/xyz');

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.copiedText).toBeNull();
  });
});
