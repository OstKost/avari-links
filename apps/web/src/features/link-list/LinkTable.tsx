import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import type { Link } from '@/entities/link/types';
import { useToggleLinkStatus, useDeleteLink } from '@/entities/link/queries';
import { useCopyToClipboard } from '@/shared/hooks/use-copy';
import { useAppStore } from '@/shared/store/app-store';
import { useTranslation } from '@/shared/i18n';
import { Copy, Check, QrCode, ExternalLink, Trash2, Power } from 'lucide-react';

interface LinkTableProps {
  links: Link[];
}

export function LinkTable({ links }: LinkTableProps) {
  const { t, language } = useTranslation();
  const { copiedText, copy } = useCopyToClipboard();
  const toggleStatus = useToggleLinkStatus();
  const deleteLink = useDeleteLink();
  const { setSelectedQRLink } = useAppStore();

  const handleDelete = (link: Link) => {
    if (window.confirm(t.linkCard.deleteConfirm(link.title || link.code))) {
      deleteLink.mutate(link.id);
    }
  };

  return (
    <div className="avari-content-enter overflow-x-auto rounded-2xl avari-surface">
      <table className="w-full text-left text-sm">
        <thead className="bg-[var(--av-surface-raised)] text-xs font-medium text-[var(--av-text-muted)] border-b border-[var(--av-border-subtle)]">
          <tr>
            <th className="px-5 py-3.5">{t.linkTable.colLinkTitle}</th>
            <th className="px-5 py-3.5">{t.linkTable.colDestination}</th>
            <th className="px-5 py-3.5 text-center">{t.linkTable.colClicks}</th>
            <th className="px-5 py-3.5 text-center">{t.linkTable.colStatus}</th>
            <th className="px-5 py-3.5 text-right">{t.linkTable.colActions}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--av-border-subtle)]">
          {links.map((link) => {
            const isCopied = copiedText === link.short_url;

            return (
              <tr
                key={link.id}
                className="hover:bg-[var(--av-surface-hover)] transition-colors"
              >
                {/* Ссылка и название */}
                <td className="px-5 py-4 max-w-xs">
                  <div className="space-y-1">
                    <p className="font-semibold text-[var(--av-text)] truncate">
                      {link.title || t.linkCard.untitled}
                    </p>
                    <div className="flex items-center gap-2">
                      <a
                        href={link.short_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-mono font-medium text-[var(--av-cyan)] hover:underline truncate flex items-center gap-1"
                      >
                        {link.short_url}
                        <ExternalLink className="w-3 h-3 opacity-60 flex-shrink-0" />
                      </a>
                      <button
                        onClick={() => copy(link.short_url, language === 'en' ? 'Link' : 'Ссылка')}
                        className="inline-flex items-center justify-center w-11 h-11 rounded-lg text-[var(--av-text-muted)] hover:text-[var(--av-cyan)]"
                        title={isCopied ? t.linkCard.copied : t.linkTable.copyShortLink} aria-label={isCopied ? t.linkCard.copied : t.linkTable.copyShortLink}
                      >
                        {isCopied ? (
                          <Check className="w-3.5 h-3.5 text-[var(--av-success)]" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </td>

                {/* Target URL */}
                <td className="px-5 py-4 max-w-sm truncate text-xs text-[var(--av-text-muted)] font-mono">
                  {link.original_url}
                </td>

                {/* Переходы */}
                <td className="px-5 py-4 text-center font-bold text-[var(--av-text)]">
                  {link.clicks}
                </td>

                {/* Статус */}
                <td className="px-5 py-4 text-center">
                  <Badge variant={link.is_active ? 'success' : 'neutral'}>
                    {link.is_active ? t.linkCard.active : t.linkCard.paused}
                  </Badge>
                  {link.is_nsfw && <Badge variant="neutral">18+</Badge>}
                </td>

                {/* Действия */}
                <td className="px-5 py-4 text-right">
                  <div className="flex items-center justify-end gap-1">
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
                      title={t.linkTable.qrCode}
                      aria-label={t.linkTable.qrCode}
                    >
                      <QrCode className="w-4 h-4" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        toggleStatus.mutate({
                          id: link.id,
                          isActive: !link.is_active,
                        })
                      }
                      title={link.is_active ? t.linkCard.pauseLink : t.linkCard.activateLink}
                      aria-label={link.is_active ? t.linkCard.pauseLink : t.linkCard.activateLink}
                      className={
                        link.is_active
                          ? 'text-[var(--av-warning)]'
                          : 'text-[var(--av-success)]'
                      }
                    >
                      <Power className="w-4 h-4" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(link)}
                      title={t.linkCard.deleteLink}
                      aria-label={t.linkCard.deleteLink}
                      className="text-[var(--av-danger)]"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
