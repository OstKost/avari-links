import { useAppStore } from '@/shared/store/app-store';
import { useSessionMe } from '@/entities/session/queries';
import { useTranslation } from '@/shared/i18n';
import { AvariLogo } from '@/shared/components/AvariLogo';
import { UserAvatar } from '@/shared/components/UserAvatar';
import { Sun, Moon, Github, Sparkles, Languages, ChevronDown, Link2 } from 'lucide-react';

export function Navbar() {
  const { theme, toggleTheme, setSessionModalOpen, sessionKey } = useAppStore();
  const { language, toggleLanguage, t } = useTranslation();
  const { data: sessionMe } = useSessionMe();
  const isPremium = Boolean(sessionMe?.is_premium);

  const userDisplayName = sessionKey || t.navbar.accessKey;

  return (
    <header className="avari-nav sticky top-0 z-40 w-full border-b border-[var(--av-border-subtle)]/80 bg-[color-mix(in_srgb,var(--av-bg)_92%,transparent)] backdrop-blur-xl">
      {/* Top ambient gold highlight hairline */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[var(--av-gold)]/25 to-transparent pointer-events-none" />

      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-[68px] sm:h-[72px] flex items-center justify-between gap-3">
        {/* Left: Brand / Logo */}
        <a
          href="#top"
          className="flex items-center gap-2.5 sm:gap-3 min-w-0 rounded-xl group select-none"
          aria-label={t.navbar.toTop}
        >
          <span className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl border border-[var(--av-gold)]/40 bg-gradient-to-b from-[var(--av-surface-raised)] to-[var(--av-surface)] flex items-center justify-center shrink-0 p-1.5 shadow-[0_0_14px_rgba(213,173,104,0.12)] group-hover:border-[var(--av-gold)] group-hover:shadow-[0_0_20px_rgba(213,173,104,0.25)] transition-all duration-300">
            <AvariLogo className="w-full h-full object-contain" />
          </span>
          <span className="font-serif text-[1.45rem] sm:text-[1.65rem] leading-none tracking-wide text-[var(--av-text)] group-hover:text-white dark:group-hover:text-[var(--av-text)] transition-colors">
            Avari Links<span className="avari-gold">.</span>
          </span>
        </a>

        {/* Right: Actions, Profile & Utilities */}
        <nav className="flex items-center gap-2 sm:gap-2.5" aria-label={t.navbar.mainNav}>
          {/* My Links Anchor */}
          <a
            href="#links"
            className="hidden md:inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-mono font-medium text-[var(--av-text-secondary)] hover:text-[var(--av-text)] hover:bg-[var(--av-surface)]/80 avari-interactive select-none"
          >
            <Link2 className="w-3.5 h-3.5 text-[var(--av-text-muted)]" />
            <span>{t.navbar.myLinks}</span>
          </a>

          {/* User Session Profile Chip */}
          <button
            type="button"
            onClick={() => setSessionModalOpen(true)}
            className={`group inline-flex items-center gap-2 pl-2 pr-2.5 sm:pr-3 h-9 sm:h-10 rounded-xl border border-[var(--av-border-subtle)] bg-[var(--av-surface)]/70 hover:bg-[var(--av-surface-hover)] hover:border-[var(--av-border-control)] shadow-sm avari-interactive select-none ${
              isPremium ? 'border-[var(--av-gold)]/40 hover:border-[var(--av-gold)]/70' : ''
            }`}
            title={sessionKey ? `${t.navbar.manageSession}: ${sessionKey}${isPremium ? ' (Premium)' : ''}` : t.navbar.manageKey}
            aria-label={t.navbar.manageKey}
          >
            <UserAvatar name={sessionKey} size={22} className="shrink-0" />
            <span className="hidden sm:inline-block font-mono text-xs max-w-[130px] md:max-w-[170px] truncate text-[var(--av-text)]">
              {userDisplayName}
            </span>
            <span className="sm:hidden font-mono text-xs text-[var(--av-text)]">{t.navbar.key}</span>
            {isPremium ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase bg-[var(--av-gold)]/15 text-[var(--av-gold)] border border-[var(--av-gold)]/30">
                <Sparkles className="w-2.5 h-2.5" />
                PRO
              </span>
            ) : null}
            <ChevronDown className="w-3 h-3 text-[var(--av-text-muted)] group-hover:text-[var(--av-text)] group-hover:translate-y-0.5 transition-all duration-200" />
          </button>

          {/* Divider */}
          <div className="hidden sm:block w-px h-5 bg-[var(--av-border-subtle)] mx-0.5" aria-hidden="true" />

          {/* System Utilities Dock */}
          <div className="flex items-center gap-0.5 sm:gap-1 p-0.5 rounded-xl border border-[var(--av-border-subtle)] bg-[var(--av-surface)]/60 shadow-sm">
            {/* Language Switcher */}
            <button
              type="button"
              onClick={toggleLanguage}
              className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 h-8 rounded-lg text-xs font-mono font-medium text-[var(--av-text-secondary)] hover:text-[var(--av-text)] hover:bg-[var(--av-surface-raised)]/90 avari-interactive select-none group"
              aria-label={t.navbar.switchLanguage}
              title={language === 'ru' ? 'Switch to English' : 'Переключить на русский'}
            >
              <Languages className="w-3.5 h-3.5 text-[var(--av-gold)] group-hover:scale-110 transition-transform duration-200" />
              <span className="font-semibold text-[var(--av-text)] uppercase tracking-wide">{language}</span>
            </button>

            {/* Theme Switcher */}
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-[var(--av-text-secondary)] hover:text-[var(--av-text)] hover:bg-[var(--av-surface-raised)]/90 avari-interactive select-none group"
              aria-label={theme === 'dark' ? t.navbar.switchToLight : t.navbar.switchToDark}
              title={theme === 'dark' ? t.navbar.themeLight : t.navbar.themeDark}
            >
              {theme === 'dark' ? (
                <Sun className="w-3.5 h-3.5 text-[var(--av-gold)] group-hover:rotate-45 transition-transform duration-300" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-[var(--av-cyan)] group-hover:-rotate-12 transition-transform duration-300" />
              )}
            </button>

            {/* GitHub Link */}
            <a
              href="https://github.com/OstKost/avari-links"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-[var(--av-text-secondary)] hover:text-[var(--av-text)] hover:bg-[var(--av-surface-raised)]/90 avari-interactive select-none"
              aria-label={t.navbar.github}
              title="GitHub"
            >
              <Github className="w-3.5 h-3.5" />
            </a>
          </div>
        </nav>
      </div>
    </header>
  );
}
