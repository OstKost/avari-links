import { useState } from 'react';
import { Card } from '@/shared/components/Card';
import { CreateLinkForm } from '@/features/create-link/CreateLinkForm';
import { LinkPreviewCard } from '@/features/create-link/LinkPreviewCard';
import type { LinkPreview } from '@/entities/link/types';
import { Fireflies, type FireflyItem } from '@/shared/components/Fireflies';
import { useTranslation } from '@/shared/i18n';
import { ArrowUpRight, Link2, QrCode, MousePointerClick, Cpu } from 'lucide-react';

function CodeOrb({ isLifted }: { isLifted: boolean }) {
  const orbFireflies: FireflyItem[] = [
    { top: '14%', left: '16%', size: 'w-2 h-2', color: 'gold', anim: '1', delay: '0.4s' },
    { top: '22%', left: '82%', size: 'w-2 h-2', color: 'cyan', anim: '2', delay: '1.6s' },
    { top: '80%', left: '26%', size: 'w-1.5 h-1.5', color: 'gold', anim: '3', delay: '2.8s' },
  ];

  return (
    <div
      className={`relative w-full max-w-[280px] mx-auto flex items-center justify-center transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        isLifted
          ? 'translate-y-0 scale-[0.82]'
          : 'translate-y-24 sm:translate-y-28 scale-100'
      }`}
    >
      <Fireflies items={orbFireflies} className="-inset-6" />
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(101,217,245,0.14)_0%,rgba(213,173,104,0.08)_40%,transparent_70%)] filter blur-xl pointer-events-none" />
      <img
        src="/assets/logo_detailed.png"
        alt="Avari Emblem"
        className="relative z-10 w-full max-w-[280px] object-contain drop-shadow-[0_12px_36px_rgba(0,0,0,0.6)] hover:scale-[1.02] transition-transform duration-500 ease-out"
        width={280}
        height={280}
      />
    </div>
  );
}

const titleFireflies: FireflyItem[] = [
  { top: '10%', left: '4%', size: 'w-2 h-2', color: 'gold', anim: '1', delay: '0s' },
  { top: '28%', left: '52%', size: 'w-1.5 h-1.5', color: 'cyan', anim: '2', delay: '1.2s' },
  { top: '78%', left: '14%', size: 'w-2 h-2', color: 'cyan', anim: '3', delay: '2.4s' },
  { top: '64%', left: '76%', size: 'w-2.5 h-2.5', color: 'gold', anim: '4', delay: '0.6s' },
  { top: '6%', left: '78%', size: 'w-1.5 h-1.5', color: 'cyan', anim: '1', delay: '3.3s' },
  { top: '88%', left: '48%', size: 'w-2 h-2', color: 'gold', anim: '2', delay: '1.7s' },
  { top: '45%', left: '92%', size: 'w-1.5 h-1.5', color: 'cyan', anim: '3', delay: '4.1s' },
];

const featureFireflies: FireflyItem[] = [
  { top: '-6px', left: '10%', size: 'w-1.5 h-1.5', color: 'gold', anim: '1', delay: '0.4s' },
  { top: '65%', left: '46%', size: 'w-2 h-2', color: 'cyan', anim: '2', delay: '1.8s' },
  { top: '-4px', left: '84%', size: 'w-1.5 h-1.5', color: 'gold', anim: '3', delay: '2.7s' },
];

export function HeroBanner() {
  const { t } = useTranslation();

  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [targetUrl, setTargetUrl] = useState('');

  const hasActivePreview = isInspecting || preview !== null;

  const handlePreviewStateChange = (
    newPreview: LinkPreview | null,
    inspecting: boolean,
    url: string
  ) => {
    setPreview(newPreview);
    setIsInspecting(inspecting);
    setTargetUrl(url);
  };

  return (
    <section className="relative pt-10 pb-8 sm:pt-16 sm:pb-12" aria-labelledby="hero-title">
      <div className="grid lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.95fr)] gap-8 lg:gap-8 items-start">
        {/* Left Column: Typography and Form (Higher z-index) */}
        <div className="relative z-20 space-y-7 avari-hero-content">
          <a
            href="#links"
            className="inline-flex items-center gap-2.5 rounded-full border border-[var(--av-border-subtle)] bg-[var(--av-surface)] px-3.5 py-1.5 font-mono text-xs avari-cyan hover:border-[var(--av-cyan)] hover:bg-[var(--av-surface-raised)] transition-all group"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--av-cyan)] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--av-cyan)]" />
            </span>
            <span className="flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-[var(--av-gold)]" />
              <span>{t.hero.techBadge}</span>
            </span>
            <span className="text-[var(--av-text-muted)] group-hover:text-[var(--av-cyan)] group-hover:translate-x-0.5 transition-all">→</span>
          </a>

          <div className="relative space-y-4">
            <Fireflies items={titleFireflies} className="-inset-4 sm:-inset-8" />
            <h1 id="hero-title" className="relative z-10 max-w-3xl text-[clamp(2.5rem,5vw,4.5rem)] leading-[1.08] avari-text">
              {t.hero.titleLine1}<br /><span className="avari-gold">{t.hero.titleLine2}</span>
            </h1>
            <p className="relative z-10 max-w-xl text-base sm:text-lg avari-secondary">
              {t.hero.subtitle}
            </p>
          </div>

          <Card className="avari-hero-form relative z-30 max-w-2xl p-5 sm:p-7 shadow-none">
            <div className="flex items-center justify-between gap-3 mb-5">
              <div>
                <p className="font-serif text-2xl">{t.hero.formTitle}</p>
                <p className="text-sm avari-muted">{t.hero.formSubtitle}</p>
              </div>
              <ArrowUpRight className="w-5 h-5 avari-gold shrink-0" aria-hidden="true" />
            </div>

            <CreateLinkForm
              onPreviewStateChange={handlePreviewStateChange}
              showInlinePreview={false}
            />
          </Card>

          {/* Mobile Preview Drawer (visible only on < lg screens with smooth transition) */}
          <div className="lg:hidden">
            {hasActivePreview && (
              <div className="mt-4 transition-all duration-500 ease-out">
                <LinkPreviewCard
                  isLoading={isInspecting}
                  preview={preview}
                  targetUrl={targetUrl}
                />
              </div>
            )}
          </div>
        </div>

        {/* Desktop Right Column: Top slot for Logo (beside headline) + Bottom slot for Preview (beside form) */}
        <div className="hidden lg:flex flex-col justify-between relative min-h-[560px] w-full pt-1" aria-hidden="false">
          {/* Logo emblem positioned alongside the headline when lifted */}
          <div className="w-full flex items-center justify-center z-10">
            <CodeOrb isLifted={hasActivePreview} />
          </div>

          {/* Sliding Preview Card Container (slides out from under the form directly beside it) */}
          <div
            className={`w-full z-20 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              hasActivePreview
                ? 'translate-x-0 opacity-100 pointer-events-auto'
                : '-translate-x-14 opacity-0 pointer-events-none'
            }`}
          >
            <LinkPreviewCard
              isLoading={isInspecting}
              preview={preview}
              targetUrl={targetUrl}
            />
          </div>
        </div>
      </div>

      <div className="relative mt-8 sm:mt-12 pt-5 border-t avari-divider flex flex-wrap gap-x-8 gap-y-3 text-sm avari-muted">
        <Fireflies items={featureFireflies} className="-inset-x-4 -inset-y-3" />
        <span className="relative z-10 inline-flex items-center gap-2"><Link2 className="w-4 h-4 avari-gold" /> {t.hero.featureCustomSlug}</span>
        <span className="relative z-10 inline-flex items-center gap-2"><MousePointerClick className="w-4 h-4 avari-cyan" /> {t.hero.featureStats}</span>
        <span className="relative z-10 inline-flex items-center gap-2"><QrCode className="w-4 h-4 avari-gold" /> {t.hero.featureQr}</span>
      </div>
    </section>
  );
}
