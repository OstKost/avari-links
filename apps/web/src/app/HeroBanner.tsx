import { Card } from '@/shared/components/Card';
import { CreateLinkForm } from '@/features/create-link/CreateLinkForm';
import { ArrowUpRight, Link2, QrCode, MousePointerClick } from 'lucide-react';

function CodeOrb() {
  return (
    <div className="relative w-full max-w-[380px] mx-auto flex items-center justify-center">
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(101,217,245,0.14)_0%,rgba(213,173,104,0.08)_40%,transparent_70%)] filter blur-xl pointer-events-none" />
      <img
        src="/assets/logo_detailed.png"
        alt="Avari Emblem"
        className="relative z-10 w-full max-w-[340px] object-contain drop-shadow-[0_12px_36px_rgba(0,0,0,0.6)] hover:scale-[1.02] transition-transform duration-500 ease-out"
        width={340}
        height={340}
      />
    </div>
  );
}

export function HeroBanner() {
  return (
    <section className="relative pt-10 pb-8 sm:pt-16 sm:pb-12" aria-labelledby="hero-title">
      <div className="grid lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,.7fr)] gap-8 lg:gap-4 items-center">
        <div className="relative z-10 space-y-7 avari-hero-content">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--av-border-subtle)] bg-[var(--av-surface)] px-3 py-1.5 font-mono text-xs avari-cyan">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--av-cyan)]" /> AVARI / LINK STUDIO
          </div>
          <div className="space-y-4">
            <h1 id="hero-title" className="max-w-3xl text-[clamp(2.5rem,5vw,4.5rem)] leading-[1.08] avari-text">
              Короткие ссылки.<br /><span className="avari-gold">Точный контроль.</span>
            </h1>
            <p className="max-w-xl text-base sm:text-lg avari-secondary">
              Создавайте короткие адреса, следите за переходами и делитесь ссылками через QR-код. Всё важное — в одном спокойном пространстве.
            </p>
          </div>
          <Card className="avari-hero-form max-w-2xl p-5 sm:p-7 shadow-none">
            <div className="flex items-center justify-between gap-3 mb-5">
              <div><p className="font-serif text-2xl">Создать ссылку</p><p className="text-sm avari-muted">Введите адрес назначения и получите короткий URL.</p></div>
              <ArrowUpRight className="w-5 h-5 avari-gold shrink-0" aria-hidden="true" />
            </div>
            <CreateLinkForm />
          </Card>
        </div>
        <div className="hidden lg:block" aria-hidden="true"><CodeOrb /></div>
      </div>
      <div className="mt-8 sm:mt-12 pt-5 border-t avari-divider flex flex-wrap gap-x-8 gap-y-3 text-sm avari-muted">
        <span className="inline-flex items-center gap-2"><Link2 className="w-4 h-4 avari-gold" /> Свой короткий адрес</span>
        <span className="inline-flex items-center gap-2"><MousePointerClick className="w-4 h-4 avari-cyan" /> Статистика переходов</span>
        <span className="inline-flex items-center gap-2"><QrCode className="w-4 h-4 avari-gold" /> QR-код для каждой ссылки</span>
      </div>
    </section>
  );
}
