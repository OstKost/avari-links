import { useState, useCallback } from 'react';
import { useAppStore } from '@/shared/store/app-store';
import { translations } from '@/shared/i18n/translations';
import { trackEvent } from '@/shared/analytics';
import { toast } from 'sonner';

export function useCopyToClipboard() {
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const copy = useCallback(async (text: string, label?: string) => {
    const lang = useAppStore.getState().language;
    const t = translations[lang];
    const itemLabel = label || (lang === 'en' ? 'Link' : 'Ссылка');

    if (!navigator?.clipboard) {
      toast.error(t.toasts.clipboardError);
      return false;
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(text);
      trackEvent('link_copy', { label: itemLabel });
      toast.success(`${itemLabel}: ${lang === 'en' ? 'copied' : 'скопировано'}`);
      setTimeout(() => setCopiedText(null), 2000);
      return true;
    } catch {
      toast.error(t.toasts.copyError);
      return false;
    }
  }, []);

  return { copiedText, copy };
}
