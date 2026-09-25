import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import type { Link } from '@/entities/link/types';
import { useToggleLinkStatus, useDeleteLink } from '@/entities/link/queries';
import { useCopyToClipboard } from '@/shared/hooks/use-copy';
import { useAppStore } from '@/shared/store/app-store';
import { Copy, Check, QrCode, ExternalLink, Trash2, Power } from 'lucide-react';

interface LinkTableProps {
  links: Link[];
}

export function LinkTable({ links }: LinkTableProps) {
  const { copiedText, copy } = useCopyToClipboard();
  const toggleStatus = useToggleLinkStatus();
  const deleteLink = useDeleteLink();
  const { setSelectedQRLink } = useAppStore();

  const handleDelete = (link: Link) => {
    if (window.confirm(`Удалить ссылку "${link.title || link.code}"?`)) {
      deleteLink.mutate(link.id);
    }
  };

  return (
    <div className="avari-content-enter overflow-x-auto rounded-2xl avari-surface">
      <table className="w-full text-left text-sm">
        <thead className="bg-[var(--av-surface-raised)] text-xs font-medium text-[var(--av-text-muted)] border-b border-[var(--av-border-subtle)]">
          <tr>
            <th className="px-5 py-3.5">Ссылка и название</th>
            <th className="px-5 py-3.5">Адрес назначения</th>
            <th className="px-5 py-3.5 text-center">Переходы</th>
            <th className="px-5 py-3.5 text-center">Статус</th>
            <th className="px-5 py-3.5 text-right">Действия</th>
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
                      {link.title || 'Без названия'}
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
                        onClick={() => copy(link.short_url, 'Ссылка')}
                        className="inline-flex items-center justify-center w-11 h-11 rounded-lg text-[var(--av-text-muted)] hover:text-[var(--av-cyan)]"
                        title={isCopied ? "Скопировано" : "Копировать короткую ссылку"} aria-label={isCopied ? "Скопировано" : "Копировать короткую ссылку"}
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
                    {link.is_active ? 'Активна' : 'Пауза'}
                  </Badge>
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
                      title="QR-код"
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
                      title={link.is_active ? 'Приостановить ссылку' : 'Активировать ссылку'}
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
                      title="Удалить ссылку"
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
