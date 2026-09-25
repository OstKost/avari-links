import { Github, Database, Cpu, ShieldCheck, Zap } from 'lucide-react';
import { useTranslation } from '@/shared/i18n';

export function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="w-full border-t avari-divider mt-20 pt-10 pb-12 bg-[var(--av-surface)]/30">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand & Concept */}
          <div className="space-y-3">
            <span className="font-serif text-2xl avari-secondary block">
              Avari Links<span className="avari-gold">.</span>
            </span>
            <p className="text-sm avari-muted leading-relaxed">
              {t.footer.description}
            </p>
          </div>

          {/* Technical Stack (Portfolio) */}
          <div className="space-y-2">
            <p className="font-mono text-xs font-semibold text-[var(--av-cyan)] uppercase tracking-wider">
              {t.footer.stackTitle}
            </p>
            <ul className="text-xs avari-muted space-y-1.5 font-mono">
              <li className="flex items-center gap-2">
                <Cpu className="w-3.5 h-3.5 text-[var(--av-gold)] shrink-0" />
                <span>{t.footer.backendStack}</span>
              </li>
              <li className="flex items-center gap-2">
                <Database className="w-3.5 h-3.5 text-[var(--av-cyan)] shrink-0" />
                <span>{t.footer.storageStack}</span>
              </li>
              <li className="flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-[var(--av-gold)] shrink-0" />
                <span>{t.footer.frontendStack}</span>
              </li>
              <li className="flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-[var(--av-success)] shrink-0" />
                <span>{t.footer.securityStack}</span>
              </li>
            </ul>
          </div>

          {/* Architecture & Performance */}
          <div className="space-y-2">
            <p className="font-mono text-xs font-semibold text-[var(--av-gold)] uppercase tracking-wider">
              {t.footer.archTitle}
            </p>
            <div className="text-xs avari-muted space-y-1.5 leading-relaxed">
              <p>{t.footer.archText}</p>
              <div className="pt-2">
                <a
                  href="https://github.com/OstKost/avari-links"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-[var(--av-text-secondary)] hover:text-[var(--av-cyan)] transition-colors font-mono"
                >
                  <Github className="w-3.5 h-3.5" />
                  <span>{t.footer.githubSource}</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-[var(--av-border-subtle)] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs avari-muted">
          <span>&copy; {new Date().getFullYear()} Avari Links. {t.footer.copyright}</span>
          <span className="font-mono">{t.footer.architectureBadge}</span>
        </div>
      </div>
    </footer>
  );
}
