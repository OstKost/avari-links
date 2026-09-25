import { useState } from 'react';
import type { LinkPreview } from '@/entities/link/types';
import { Globe, AlertTriangle, CheckCircle2, ExternalLink, Loader2, Sparkles, Image as ImageIcon } from 'lucide-react';

interface LinkPreviewCardProps {
  isLoading: boolean;
  preview: LinkPreview | null;
  targetUrl?: string;
  className?: string;
}

export function LinkPreviewCard({ isLoading, preview, targetUrl, className = '' }: LinkPreviewCardProps) {
  const [imageError, setImageError] = useState(false);
  const [faviconError, setFaviconError] = useState(false);

  // Extract hostname for cleaner display
  const getHostname = (rawUrl?: string) => {
    if (!rawUrl) return '';
    try {
      return new URL(rawUrl).hostname;
    } catch {
      return rawUrl;
    }
  };

  const domain = getHostname(preview?.url || targetUrl);

  if (isLoading) {
    return (
      <div
        className={`relative overflow-hidden rounded-2xl border border-[var(--av-border-subtle)] bg-[var(--av-surface)] p-5 backdrop-blur-md shadow-2xl space-y-4 ${className}`}
        aria-live="polite"
        aria-busy="true"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[var(--av-cyan)]/5 to-transparent animate-[shimmer_2s_infinite] pointer-events-none" />
        
        {/* Loading header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-full bg-[var(--av-surface-raised)] animate-pulse flex items-center justify-center">
              <Loader2 className="w-3.5 h-3.5 text-[var(--av-cyan)] animate-spin" />
            </div>
            <div className="h-4 w-28 rounded bg-[var(--av-surface-raised)] animate-pulse" />
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium text-[var(--av-cyan)] bg-[var(--av-cyan)]/10 border border-[var(--av-cyan)]/20 animate-pulse">
            <Sparkles className="w-3 h-3 animate-spin" />
            Проверяем сайт...
          </span>
        </div>

        {/* Skeleton image */}
        <div className="h-36 sm:h-44 w-full rounded-xl bg-[var(--av-surface-raised)] animate-pulse flex flex-col items-center justify-center gap-2 text-[var(--av-text-muted)]">
          <Globe className="w-8 h-8 opacity-40 animate-pulse text-[var(--av-cyan)]" />
          <span className="text-xs font-mono text-[var(--av-text-muted)]">Загрузка превью...</span>
        </div>

        {/* Skeleton texts */}
        <div className="space-y-2 pt-1">
          <div className="h-5 w-3/4 rounded bg-[var(--av-surface-raised)] animate-pulse" />
          <div className="h-3.5 w-full rounded bg-[var(--av-surface-raised)] animate-pulse" />
          <div className="h-3.5 w-4/5 rounded bg-[var(--av-surface-raised)] animate-pulse" />
        </div>
      </div>
    );
  }

  if (!preview) {
    return null;
  }

  // Reachability: FAILED / UNREACHABLE
  if (!preview.is_reachable) {
    return (
      <div
        className={`rounded-2xl border border-[var(--av-warning)]/30 bg-[var(--av-surface)] p-5 backdrop-blur-md shadow-2xl space-y-4 ${className}`}
        role="alert"
      >
        <div className="flex items-center justify-between gap-2 border-b border-[var(--av-border-subtle)] pb-3">
          <div className="flex items-center gap-2 text-[var(--av-warning)] font-medium text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0 text-[var(--av-warning)]" />
            <span>Сайт не отвечает</span>
          </div>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono border border-[var(--av-warning)]/30 text-[var(--av-warning)] bg-[var(--av-warning)]/10">
            {preview.status_code > 0 ? `HTTP ${preview.status_code}` : 'Ошибка соединения'}
          </span>
        </div>

        <div className="space-y-2 py-1 text-sm">
          <p className="text-[var(--av-text)] font-sans">
            Не удалось получить ответ от <span className="font-mono text-xs text-[var(--av-gold)]">{domain}</span>.
          </p>
          {preview.error && (
            <p className="text-xs font-mono text-[var(--av-text-muted)] bg-[var(--av-bg)] p-2.5 rounded-lg border border-[var(--av-border-subtle)] break-words">
              {preview.error}
            </p>
          )}
          <p className="text-xs text-[var(--av-text-secondary)]">
            Вы можете повторить проверку или нажать <strong className="text-[var(--av-text)]">«Создать»</strong> ещё раз, чтобы всё равно сохранить ссылку.
          </p>
        </div>
      </div>
    );
  }

  // Reachability: SUCCESS / 200 OK
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-[var(--av-border-subtle)] hover:border-[var(--av-cyan)]/40 bg-[var(--av-surface)] p-5 backdrop-blur-md shadow-2xl space-y-3.5 transition-all duration-300 ${className}`}
    >
      {/* Top Header: Favicon, Domain, Status Badge */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {preview.favicon_url && !faviconError ? (
            <img
              src={preview.favicon_url}
              alt=""
              className="w-4 h-4 rounded-sm object-contain shrink-0"
              onError={() => setFaviconError(true)}
            />
          ) : (
            <Globe className="w-4 h-4 text-[var(--av-cyan)] shrink-0" />
          )}
          <span className="font-mono text-xs text-[var(--av-text-secondary)] truncate">
            {domain}
          </span>
        </div>

        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium text-[var(--av-success)] bg-[var(--av-success)]/10 border border-[var(--av-success)]/20 shrink-0">
          <CheckCircle2 className="w-3 h-3 text-[var(--av-success)]" />
          {preview.status_code ? `${preview.status_code} OK` : 'Доступен'}
        </span>
      </div>

      {/* Preview Image (if available) */}
      {preview.image_url && !imageError ? (
        <div className="relative h-36 sm:h-44 w-full overflow-hidden rounded-xl bg-[var(--av-bg)] border border-[var(--av-border-subtle)]">
          <img
            src={preview.image_url}
            alt={preview.title || domain}
            className="w-full h-full object-cover object-center group-hover:scale-[1.02] transition-transform duration-500 ease-out"
            loading="lazy"
            onError={() => setImageError(true)}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--av-surface)]/80 via-transparent to-transparent opacity-60" />
        </div>
      ) : (
        <div className="h-20 w-full rounded-xl bg-[var(--av-surface-raised)] border border-[var(--av-border-subtle)] flex items-center justify-center gap-2 text-[var(--av-text-muted)]">
          <ImageIcon className="w-5 h-5 opacity-40 text-[var(--av-cyan)]" />
          <span className="text-xs font-mono text-[var(--av-text-muted)]">Предпросмотр ссылки</span>
        </div>
      )}

      {/* Content: Title & Description */}
      <div className="space-y-1.5">
        <h4 className="font-serif text-base sm:text-lg text-[var(--av-text)] leading-snug line-clamp-2">
          {preview.title || domain}
        </h4>
        {preview.description && (
          <p className="text-xs sm:text-sm text-[var(--av-text-secondary)] line-clamp-2 leading-relaxed">
            {preview.description}
          </p>
        )}
      </div>

      {/* Footer URL link */}
      <div className="pt-1 flex items-center justify-between text-xs text-[var(--av-text-muted)] border-t border-[var(--av-border-subtle)]">
        <span className="truncate max-w-[220px] sm:max-w-[280px] font-mono text-[11px]">
          {preview.url}
        </span>
        <a
          href={preview.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[var(--av-gold)] hover:text-[var(--av-gold-hover)] hover:underline ml-2 shrink-0"
        >
          <span>Открыть</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}
