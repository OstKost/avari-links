import { useAppStore } from '@/shared/store/app-store';
import { Button } from '@/shared/components/Button';
import { AvariLogo } from '@/shared/components/AvariLogo';
import { Sun, Moon, Github, Plus } from 'lucide-react';

export function Navbar() {
  const { theme, toggleTheme, setCreateModalOpen } = useAppStore();
  return (
    <header className="avari-nav sticky top-0 z-40 w-full border-b">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-[72px] flex items-center justify-between gap-4">
        <a href="#top" className="flex items-center gap-3 min-w-0 rounded-lg group" aria-label="Avari — наверх">
          <span className="w-10 h-10 rounded-xl border border-[var(--av-gold)]/50 bg-[var(--av-surface)] flex items-center justify-center shrink-0 p-1.5 shadow-[0_0_12px_rgba(213,173,104,0.15)] group-hover:border-[var(--av-gold)] transition-colors">
            <AvariLogo className="w-full h-full object-contain" />
          </span>
          <span className="font-serif text-[1.65rem] leading-none tracking-wide">Avari<span className="avari-gold">.</span></span>
        </a>
        <nav className="flex items-center gap-1 sm:gap-3" aria-label="Основная навигация">
          <a href="#links" className="hidden sm:inline-flex items-center min-h-11 px-3 rounded-lg text-sm avari-secondary avari-interactive">Мои ссылки</a>
          <a href="https://github.com/OstKost/avari-links" target="_blank" rel="noreferrer" className="inline-flex items-center justify-center w-11 h-11 rounded-lg avari-secondary avari-interactive" aria-label="GitHub"><Github className="w-[18px] h-[18px]" /></a>
          <button onClick={toggleTheme} className="inline-flex items-center justify-center w-11 h-11 rounded-lg avari-secondary avari-interactive" aria-label={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'} title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}>
            {theme === 'dark' ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
          </button>
          <Button size="sm" onClick={() => setCreateModalOpen(true)} leftIcon={<Plus className="w-4 h-4" />} className="hidden sm:inline-flex">Новая ссылка</Button>
        </nav>
      </div>
    </header>
  );
}
