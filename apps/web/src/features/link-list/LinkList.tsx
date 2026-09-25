import { useState } from 'react';
import { useLinks } from '@/entities/link/queries';
import { useDebounce } from '@/shared/hooks/use-debounce';
import { useAppStore } from '@/shared/store/app-store';
import { useTranslation } from '@/shared/i18n';
import { LinkCard } from './LinkCard';
import { LinkTable } from './LinkTable';
import { LinkStats } from './LinkStats';
import { Skeleton } from '@/shared/components/Skeleton';
import { Button } from '@/shared/components/Button';
import { Input } from '@/shared/components/Input';
import {
  Search,
  LayoutGrid,
  List as ListIcon,
  Plus,
  Link2Off,
  Sparkles,
} from 'lucide-react';

export function LinkList() {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);
  const { t } = useTranslation();

  const { data, isLoading, isError, error } = useLinks(debouncedSearch);
  const { viewMode, setViewMode, sessionKey } = useAppStore();

  const scrollToCreateForm = () => {
    const input = document.querySelector<HTMLInputElement>('.avari-hero-form input');
    if (input) {
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      input.focus();
    } else {
      document.getElementById('top')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const links = data?.data || [];

  return (
    <section id="links" aria-labelledby="links-title" className="space-y-6 scroll-mt-24">
      <div className="flex items-end justify-between gap-4 border-b avari-divider pb-4">
        <div>
          <p className="font-mono text-xs avari-cyan mb-1">{t.linkList.collectionTitle}</p>
          <h2 id="links-title" className="text-3xl sm:text-4xl">{t.linkList.title}</h2>
        </div>
        <span className="hidden sm:block text-sm avari-muted">{t.linkList.subtitle}</span>
      </div>

      {/* 1. Global Analytics Stats */}
      {links.length > 0 && <LinkStats links={links} />}

      {/* 2. Controls & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="w-full sm:w-80">
          <Input
            aria-label={t.linkList.searchLabel}
            placeholder={t.linkList.searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          {/* View mode toggle */}
          <div className={`avari-view-switch ${viewMode === 'table' ? 'avari-view-switch-table' : ''} flex items-center p-1 avari-surface rounded-xl`}>
            <button
              onClick={() => setViewMode('grid')}
              className={`w-11 h-11 flex items-center justify-center rounded-lg avari-interactive ${
                viewMode === 'grid'
                  ? 'bg-[var(--av-surface-raised)] text-[var(--av-cyan)]'
                  : 'avari-muted hover:text-[var(--av-text)]'
              }`}
              title={t.linkList.gridView}
              aria-label={t.linkList.showGrid}
              aria-pressed={viewMode === 'grid'}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`w-11 h-11 flex items-center justify-center rounded-lg avari-interactive ${
                viewMode === 'table'
                  ? 'bg-[var(--av-surface-raised)] text-[var(--av-cyan)]'
                  : 'avari-muted hover:text-[var(--av-text)]'
              }`}
              title={t.linkList.tableView}
              aria-label={t.linkList.showTable}
              aria-pressed={viewMode === 'table'}
            >
              <ListIcon className="w-4 h-4" />
            </button>
          </div>

          <Button
            onClick={scrollToCreateForm}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            {t.linkList.newLink}
          </Button>
        </div>
      </div>

      {/* 3. Content Area */}
      {isLoading || !sessionKey ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-44 w-full" />
          ))}
        </div>
      ) : isError ? (
        <div className="p-8 text-center avari-surface rounded-2xl">
          <p className="text-[var(--av-danger)] font-medium">
            {(error as Error)?.message || t.linkList.loadError}
          </p>
        </div>
      ) : links.length === 0 ? (
        <div className="avari-content-enter py-16 text-center avari-surface rounded-2xl p-8 space-y-4">
          <div className="w-12 h-12 avari-raised rounded-2xl flex items-center justify-center mx-auto avari-cyan">
            {searchTerm ? <Link2Off className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
          </div>
          <div className="space-y-1 max-w-sm mx-auto">
            <h3 className="text-2xl">
              {searchTerm ? t.linkList.emptySearchTitle : t.linkList.emptyListTitle}
            </h3>
            <p className="text-sm avari-muted">
              {searchTerm
                ? t.linkList.emptySearchText
                : t.linkList.emptyListText}
            </p>
          </div>
          {!searchTerm && (
            <Button
              onClick={scrollToCreateForm}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              {t.linkList.createFirstLink}
            </Button>
          )}
        </div>
      ) : viewMode === 'table' ? (
        <LinkTable links={links} />
      ) : (
        <div className="avari-content-enter grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {links.map((link) => (
            <LinkCard key={link.id} link={link} />
          ))}
        </div>
      )}
    </section>
  );
}
