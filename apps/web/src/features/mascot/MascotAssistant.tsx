import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from '@/shared/i18n';
import { Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';

const TIPS_RU = [
  'Можно вводить ya.ru или google.com без https:// — протокол подставится автоматически!',
  'Нажмите на значок QR-кода у любой ссылки, чтобы мгновенно скачать его в высоком разрешении.',
  'С Premium-статусом вы можете создавать ультракороткие ссылки всего от 4 символов.',
  'Сохраните персональный ключ доступа — он позволяет управлять ссылками с любого устройства.',
  'Встроенный инспектор моментально проверяет сайт, собирает фавиконку и превью.',
  'Ссылки 18+ автоматически определяются нашей системой и выводят безопасное предупреждение.',
  'Редиректы через Avari обрабатываются со скоростью менее 10 мс на Go и SQLite WAL.',
  'Вы можете временно отключить ссылку переключателем в списке, не удаляя её навсегда.',
  'Следите за переходами по ссылкам — счётчик кликов обновляется в реальном времени.',
  'Все ссылки остаются приватными и защищены вашим уникальным анонимным ключом.',
  'В таблице можно искать ссылки не только по URL, но и по названию или коду.',
  'Нажмите на короткую ссылку в списке, чтобы быстро скопировать её в буфер обмена.',
  'Каждая ссылка получает свой QR-код с возможностью настройки для презентаций и печати.',
  'Вы можете изменить тему интерфейса на тёмную или светлую в верхнем правом углу.',
  'Если ссылка помечена как 18+, перед переходом открывается экран подтверждения возраста.',
  'Когда засыпаешь — закрывай глаза, так лучше.',
  'Если долго смотреть на пустой экран, он всё равно не заполнится сам... хотя подожди.',
  'Чтобы выпить чай, сначала нужно налить его в кружку. Проверено эльфами.',
  'Если нажать на клавиатуре много кнопок подряд, получится какой-то текст.',
  'Если не моргать слишком долго, глаза начинают грустить.',
];

const TIPS_EN = [
  'You can type ya.ru or google.com without https:// — we will add it automatically!',
  'Click the QR code icon next to any short link to instantly download a high-res image.',
  'With Premium status, you can create ultra-short slugs starting from just 4 characters.',
  'Keep your personal access key safe — it lets you manage your links across any browser.',
  'Our built-in inspector immediately checks the site, grabbing metadata and favicon.',
  'Adult 18+ links are automatically detected and display a safe interstitial warning.',
  'Redirects in Avari execute in under 10ms powered by Go 1.24 and SQLite WAL.',
  'You can temporarily pause or disable any short link without deleting it.',
  'Track your link clicks — the real-time analytics counter updates with every visit.',
  'Your short links stay private and securely tied to your unique anonymous access key.',
  'You can search your links by title, slug, or destination URL directly in the table.',
  'Click on any short link in the table to instantly copy it to your clipboard.',
  'Every link automatically gets a dedicated QR code ready for sharing and printing.',
  'You can toggle between dark and light themes using the switcher in the top navbar.',
  'When a link is flagged as 18+, a safe age confirmation interstitial protects visitors.',
  'When you go to sleep, close your eyes — it works much better that way.',
  'If you stare at an empty screen long enough, it won\'t fill itself... or will it?',
  'To drink tea, you first have to pour it into a mug. Tested by elves.',
  'If you press a lot of keyboard keys in a row, some text will definitely appear.',
  'If you don\'t blink for too long, your eyes start to feel sad.',
];

function getRandomIndex(current: number, total: number): number {
  if (total <= 1) return 0;
  let next = Math.floor(Math.random() * total);
  if (next === current) {
    next = (current + 1) % total;
  }
  return next;
}

export function MascotAssistant() {
  const { language } = useTranslation();
  const tips = language === 'en' ? TIPS_EN : TIPS_RU;

  const [tipIndex, setTipIndex] = useState(() => Math.floor(Math.random() * tips.length));
  const [displayedText, setDisplayedText] = useState('');
  const [phase, setPhase] = useState<'typing' | 'pausing' | 'deleting' | 'thinking'>('typing');

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Reset when language changes
  useEffect(() => {
    setDisplayedText('');
    setPhase('typing');
  }, [language]);

  const currentTip = tips[tipIndex % tips.length];

  const THINKING_DURATION_MS = 5000; // 5 seconds thinking pause

  const handleNextTip = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (timerRef.current) clearTimeout(timerRef.current);
    setTipIndex((prev) => getRandomIndex(prev, tips.length));
    setDisplayedText('');
    setPhase('thinking');
    timerRef.current = setTimeout(() => {
      setPhase('typing');
    }, THINKING_DURATION_MS);
  };

  const handlePrevTip = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (timerRef.current) clearTimeout(timerRef.current);
    setTipIndex((prev) => (prev - 1 + tips.length) % tips.length);
    setDisplayedText('');
    setPhase('thinking');
    timerRef.current = setTimeout(() => {
      setPhase('typing');
    }, THINKING_DURATION_MS);
  };

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (phase === 'typing') {
      if (displayedText.length < currentTip.length) {
        timerRef.current = setTimeout(() => {
          setDisplayedText(currentTip.slice(0, displayedText.length + 1));
        }, 28);
      } else {
        setPhase('pausing');
        timerRef.current = setTimeout(() => {
          setPhase('deleting');
        }, 6000);
      }
    } else if (phase === 'deleting') {
      if (displayedText.length > 0) {
        timerRef.current = setTimeout(() => {
          setDisplayedText(displayedText.slice(0, -1));
        }, 14);
      } else {
        setPhase('thinking');
        timerRef.current = setTimeout(() => {
          setTipIndex((prev) => getRandomIndex(prev, tips.length));
          setPhase('typing');
        }, THINKING_DURATION_MS);
      }
    } else if (phase === 'thinking') {
      // Transition handled by timers above
    }
  }, [phase, displayedText, currentTip, tips.length]);

  return (
    <div className="relative w-full flex flex-col items-center justify-center pt-2 select-none group">
      {/* Speech Bubble without top header */}
      <div
        onClick={() => handleNextTip()}
        className="relative z-20 w-full max-w-md rounded-2xl border border-[var(--av-border-subtle)] bg-[var(--av-surface-raised)]/90 backdrop-blur-md p-4 shadow-xl hover:border-[var(--av-cyan)]/50 transition-all duration-300 cursor-pointer flex flex-col justify-between"
        title={language === 'en' ? 'Click to show another tip' : 'Нажмите, чтобы показать другой совет'}
        role="region"
        aria-live="polite"
      >
        {/* Bubble Body: Animated Text or 3-Dots Thinking Loader */}
        <div className="min-h-[56px] flex items-center text-sm leading-relaxed text-[var(--av-text)] font-sans">
          {phase === 'thinking' ? (
            <div className="flex items-center gap-1.5 py-1 px-1">
              <span className="w-2 h-2 rounded-full bg-[var(--av-cyan)] animate-bounce [animation-delay:-0.3s]" />
              <span className="w-2 h-2 rounded-full bg-[var(--av-gold)] animate-bounce [animation-delay:-0.15s]" />
              <span className="w-2 h-2 rounded-full bg-[var(--av-cyan)] animate-bounce" />
              <span className="ml-2 text-xs text-[var(--av-text-muted)] italic">
                {language === 'en' ? 'Thinking of a tip...' : 'Вспоминаю совет...'}
              </span>
            </div>
          ) : (
            <p className="inline">
              {displayedText}
              <span className="inline-block w-1.5 h-4 ml-0.5 bg-[var(--av-cyan)] animate-pulse align-middle" />
            </p>
          )}
        </div>

        {/* Bubble Footer Row: Navigation Buttons (Left) + Ari Name (Right) */}
        <div className="flex items-center justify-between gap-2 pt-2.5 mt-1 border-t border-[var(--av-border-subtle)]/40">
          <div className="flex items-center gap-1 text-[var(--av-text-muted)]">
            <button
              type="button"
              onClick={handlePrevTip}
              className="p-1 rounded-md hover:text-[var(--av-cyan)] hover:bg-[var(--av-surface)] transition-all cursor-pointer"
              title={language === 'en' ? 'Previous tip' : 'Предыдущий совет'}
              aria-label={language === 'en' ? 'Previous tip' : 'Предыдущий совет'}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleNextTip}
              className="p-1 rounded-md hover:text-[var(--av-cyan)] hover:bg-[var(--av-surface)] transition-all cursor-pointer"
              title={language === 'en' ? 'Next tip' : 'Следующий совет'}
              aria-label={language === 'en' ? 'Next tip' : 'Следующий совет'}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-serif italic text-[var(--av-gold)] tracking-wide">
            <Sparkles className="w-3 h-3 text-[var(--av-gold)]" />
            <span>{language === 'en' ? 'Ari' : 'Ари'}</span>
          </div>
        </div>

        {/* Bubble Tail pointer pointing toward mascot below */}
        <div className="absolute -bottom-2 left-12 w-4 h-4 bg-[var(--av-surface-raised)] border-r border-b border-[var(--av-border-subtle)] rotate-45 transform pointer-events-none" />
      </div>

      {/* Mascot Elf Character */}
      <div className="relative mt-3 flex items-center justify-center">
        {/* Ambient Backlight Glow */}
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(101,217,245,0.18)_0%,rgba(213,173,104,0.1)_45%,transparent_70%)] filter blur-2xl pointer-events-none" />

        <img
          src="/assets/mascot.png"
          alt={language === 'en' ? 'Ari - Avari Mascot' : 'Ари — Маскот Авари'}
          className="relative z-10 max-h-[340px] sm:max-h-[380px] w-auto object-contain drop-shadow-[0_16px_36px_rgba(0,0,0,0.6)] hover:scale-[1.02] transition-transform duration-500 ease-out pointer-events-none"
          width={300}
          height={380}
        />
      </div>
    </div>
  );
}
