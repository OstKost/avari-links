import { describe, it, expect, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { QRCodeModal } from './QRCodeModal';
import { renderWithProviders } from '@/test/test-utils';
import { useAppStore } from '@/shared/store/app-store';

describe('QRCodeModal', () => {
  beforeEach(() => {
    useAppStore.setState({
      selectedQRLink: {
        url: 'http://localhost:4820/s/test-slug',
        title: 'Тестовая ссылка',
        code: 'test-slug',
      },
    });
  });

  it('renders QR code modal with link info and action buttons', () => {
    renderWithProviders(<QRCodeModal />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('QR-код ссылки')).toBeInTheDocument();
    expect(screen.getByText('Тестовая ссылка')).toBeInTheDocument();
    expect(screen.getByText('http://localhost:4820/s/test-slug')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /копировать url/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /скачать png/i })).toBeInTheDocument();
  });

  it('copies URL on copy button click', () => {
    renderWithProviders(<QRCodeModal />);

    const copyBtn = screen.getByRole('button', { name: /копировать url/i });
    fireEvent.click(copyBtn);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('http://localhost:4820/s/test-slug');
  });

  it('triggers download PNG on button click', () => {
    renderWithProviders(<QRCodeModal />);

    const downloadBtn = screen.getByRole('button', { name: /скачать png/i });
    fireEvent.click(downloadBtn);
  });
});
