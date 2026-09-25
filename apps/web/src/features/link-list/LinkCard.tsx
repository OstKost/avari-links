import { Card } from '@/shared/components/Card';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import type { Link } from '@/entities/link/types';
import { useToggleLinkStatus, useDeleteLink } from '@/entities/link/queries';
import { useCopyToClipboard } from '@/shared/hooks/use-copy';
import { useAppStore } from '@/shared/store/app-store';
import { useTranslation } from '@/shared/i18n';
import {
  Copy,
  Check,
  QrCode,
  ExternalLink,
  MousePointerClick,
  Trash2,
  Power,
  Calendar,
} from 'lucide-react';

interface LinkCardProps {
  link: Link;
}

export function LinkCard({ link }: LinkCardProps) {
  const { t, language } = useTranslation();
  const { copiedText, copy } = useCopyToClipboard();
  const toggleStatus = useToggleLinkStatus();
  const deleteLink = useDeleteLink();
  const { setSelectedQRLink } = useAppStore();

  const isCopied = copiedText === link.short_url;

  const handleDelete = () => {
    if (window.confirm(t.linkCard.deleteConfirm(link.title || link.code))) {
      deleteLink.mutate(link.id);
    }
  };

  const formattedDate = new Date(link.created_at).toLocaleDateString(language === 'en' ? 'en-US' : 'ru-RU', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <Card className="flex flex-col justify-between space-y-4 hover:border-[var(--av-border-control)]">
      <div className="space-y-3">
        {/* Top bar: Title & Status */}
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-0.5 min-w-0">
            <h4 className="font-bold text-[var(--av-text)] truncate text-base">
              {link.title || t.linkCard.untitled}
            </h4>
            <div className="flex items-center gap-1.5 text-xs text-[var(--av-text-muted)]">
              <Calendar className="w-3.5 h-3.5" />
              <span>{formattedDate}</span>
            </div>
          </div>

          <Badge variant={link.is_active ? 'success' : 'neutral'}>
            {link.is_active ? t.linkCard.active : t.linkCard.paused}
          </Badge>
          {link.is_nsfw && <Badge variant="neutral">18+</Badge>}
        </div>

        {/* Short URL with 1-click Copy */}
        <div className="flex items-center justify-between p-2.5 bg-[var(--av-bg)] rounded-xl border border-[var(--av-border-subtle)]">
          <a
            href={link.short_url}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-mono font-semibold text-[var(--av-cyan)] hover:underline truncate flex items-center gap-1"
          >
            {link.short_url}
            <ExternalLink className="w-3 h-3 opacity-60 flex-shrink-0" />
          </a>

          <button
            onClick={() => copy(link.short_url, language === 'en' ? 'Link' : 'Ссылка')}
            className="w-11 h-11 inline-flex items-center justify-center text-[var(--av-text-muted)] hover:text-[var(--av-cyan)] hover:bg-[var(--av-surface-hover)] rounded-lg transition-colors ml-2 flex-shrink-0"
            title={isCopied ? t.linkCard.copied : t.linkCard.copyLink} aria-label={isCopied ? t.linkCard.copied : t.linkCard.copyLink}
          >
            {isCopied ? <Check className="w-4 h-4 text-[var(--av-success)]" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        {/* Original Destination URL */}
        <div className="text-xs text-[var(--av-text-muted)] truncate">
          <span className="font-medium text-[var(--av-text-secondary)]">{t.linkCard.address}</span>
          <span className="font-mono">{link.original_url}</span>
        </div>
      </div>

      {/* Footer Stats and Actions */}
      <div className="pt-3 border-t border-[var(--av-border-subtle)] flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--av-text-secondary)]">
          <MousePointerClick className="w-4 h-4 text-[var(--av-cyan)]" />
          <span>{t.linkCard.clicks(link.clicks)}</span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setSelectedQRLink({
                url: link.short_url,
                title: link.title || link.code,
                code: link.code,
              })
            }
            title={t.linkCard.showQr}
            aria-label={t.linkCard.showQr}
          >
            <QrCode className="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              toggleStatus.mutate({ id: link.id, isActive: !link.is_active })
            }
            title={link.is_active ? t.linkCard.pauseLink : t.linkCard.activateLink}
            aria-label={link.is_active ? t.linkCard.pauseLink : t.linkCard.activateLink}
            className={link.is_active ? 'text-[var(--av-warning)]' : 'text-[var(--av-success)]'}
          >
            <Power className="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            title={t.linkCard.deleteLink}
            aria-label={t.linkCard.deleteLink}
            className="text-[var(--av-danger)] hover:bg-[var(--av-surface-hover)]"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
