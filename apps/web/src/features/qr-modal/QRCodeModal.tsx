import { useRef } from 'react';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/Button';
import { useAppStore } from '@/shared/store/app-store';
import { QRCodeCanvas } from 'qrcode.react';
import { Download, Copy, ExternalLink } from 'lucide-react';
import { useCopyToClipboard } from '@/shared/hooks/use-copy';
import { toast } from 'sonner';

export function QRCodeModal() {
  const { selectedQRLink, setSelectedQRLink } = useAppStore();
  const { copy } = useCopyToClipboard();
  const qrRef = useRef<HTMLDivElement>(null);

  if (!selectedQRLink) return null;

  const downloadQR = () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) {
      toast.error('Не удалось создать изображение QR-кода');
      return;
    }

    const image = canvas.toDataURL('image/png');
    const anchor = document.createElement('a');
    anchor.href = image;
    anchor.download = `qrcode-${selectedQRLink.code}.png`;
    anchor.click();
    toast.success('QR-код скачан');
  };

  return (
    <Modal
      isOpen={!!selectedQRLink}
      onClose={() => setSelectedQRLink(null)}
      title="QR-код ссылки"
      description={selectedQRLink.title || selectedQRLink.url}
    >
      <div className="flex flex-col items-center justify-center space-y-6 py-2">
        <div
          ref={qrRef}
          className="p-5 bg-white rounded-2xl border border-[var(--av-border-subtle)] shadow-md flex items-center justify-center"
        >
          <QRCodeCanvas
            value={selectedQRLink.url}
            size={220}
            level="H"
            includeMargin={true}
          />
        </div>

        <div className="text-center space-y-1 w-full max-w-sm">
          <p className="text-xs avari-muted">Короткая ссылка</p>
          <p className="text-sm font-mono font-medium text-[var(--av-cyan)] truncate">
            {selectedQRLink.url}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 w-full">
          <Button
            variant="outline"
            leftIcon={<Copy className="w-4 h-4" />}
            onClick={() => copy(selectedQRLink.url, 'Короткая ссылка')}
          >
            Копировать URL
          </Button>

          <Button
            variant="primary"
            leftIcon={<Download className="w-4 h-4" />}
            onClick={downloadQR}
          >
            Скачать PNG
          </Button>
        </div>

        <div className="w-full flex justify-center">
          <a
            href={selectedQRLink.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs avari-muted hover:text-[var(--av-cyan)] avari-interactive"
          >
            Открыть в новой вкладке <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </Modal>
  );
}
