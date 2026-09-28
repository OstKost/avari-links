import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { getCreateLinkSchema, normalizeUrlInput, isKnownNSFWUrl, type CreateLinkFormData } from './schema';
import { useCreateLink, usePreviewLink } from '@/entities/link/queries';
import type { LinkPreview } from '@/entities/link/types';
import { useSessionMe } from '@/entities/session/queries';
import { useAppStore } from '@/shared/store/app-store';
import { useTranslation } from '@/shared/i18n';
import { Input } from '@/shared/components/Input';
import { Button } from '@/shared/components/Button';
import { Switch } from '@/shared/components/Switch';
import { LinkPreviewCard } from './LinkPreviewCard';
import { Link2, Sparkles, Tag, Globe, RotateCcw, Check } from 'lucide-react';

export type PreviewStatus = 'idle' | 'inspecting' | 'success' | 'failed';

interface CreateLinkFormProps {
  onSuccess?: () => void;
  compact?: boolean;
  onPreviewStateChange?: (preview: LinkPreview | null, isInspecting: boolean, targetUrl: string) => void;
  showInlinePreview?: boolean;
}

export function CreateLinkForm({
  onSuccess,
  compact = false,
  onPreviewStateChange,
  showInlinePreview = false,
}: CreateLinkFormProps) {
  const { language, t } = useTranslation();
  const createLink = useCreateLink();
  const previewLink = usePreviewLink();
  const { data: sessionMe } = useSessionMe();
  const setSessionModalOpen = useAppStore((s) => s.setSessionModalOpen);
  const isPremium = Boolean(sessionMe?.is_premium);

  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>('idle');
  const [inspectedUrl, setInspectedUrl] = useState<string>('');
  const [cooldown, setCooldown] = useState<number>(0);
  const [isNSFWForced, setIsNSFWForced] = useState<boolean>(false);

  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isHoldingSuccessRef = useRef(false);

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateLinkFormData>({
    resolver: zodResolver(getCreateLinkSchema(isPremium, language)),
    defaultValues: {
      original_url: '',
      title: '',
      custom_code: '',
      is_nsfw: false,
    },
  });

  const watchedUrl = watch('original_url');

  // React to URL input typing for known adult domains/keywords
  useEffect(() => {
    if (isKnownNSFWUrl(watchedUrl)) {
      setValue('is_nsfw', true);
      setIsNSFWForced(true);
    } else if (previewStatus === 'idle' && !preview?.is_nsfw) {
      setIsNSFWForced(false);
    }
  }, [watchedUrl, previewStatus, preview, setValue]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Reset preview state if user edits the target URL and not in active success hold
  useEffect(() => {
    const normWatched = normalizeUrlInput(watchedUrl);
    const normInspected = normalizeUrlInput(inspectedUrl);

    if (isHoldingSuccessRef.current) {
      // While in success hold, only reset if user actively types a new non-empty URL
      if (normWatched && normWatched !== normInspected) {
        isHoldingSuccessRef.current = false;
        if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
        if (intervalRef.current) clearInterval(intervalRef.current);
        setPreview(null);
        setPreviewStatus('idle');
        setInspectedUrl('');
        setCooldown(0);
        onPreviewStateChange?.(null, false, watchedUrl);
      }
      return;
    }

    if (previewStatus !== 'idle' && normWatched && normInspected && normWatched !== normInspected) {
      setPreview(null);
      setPreviewStatus('idle');
      setInspectedUrl('');
      onPreviewStateChange?.(null, false, watchedUrl);
    }
  }, [watchedUrl, inspectedUrl, previewStatus, onPreviewStateChange]);

  const handleDismiss = () => {
    isHoldingSuccessRef.current = false;
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    setPreview(null);
    setPreviewStatus('idle');
    setInspectedUrl('');
    setCooldown(0);
    setIsNSFWForced(false);
    onPreviewStateChange?.(null, false, '');
  };

  const startSuccessHold = () => {
    isHoldingSuccessRef.current = true;
    setCooldown(30);

    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    clearTimerRef.current = setTimeout(() => {
      isHoldingSuccessRef.current = false;
      setPreview(null);
      setPreviewStatus('idle');
      setInspectedUrl('');
      onPreviewStateChange?.(null, false, '');
      setCooldown(0);
      setIsNSFWForced(false);
    }, 30000);
  };

  const executeCheck = async (urlToCheck: string, currentData: CreateLinkFormData) => {
    const normalizedUrl = normalizeUrlInput(urlToCheck);
    setPreviewStatus('inspecting');
    setInspectedUrl(normalizedUrl);
    onPreviewStateChange?.(null, true, normalizedUrl);

    try {
      const res = await previewLink.mutateAsync(normalizedUrl);
      setPreview(res);
      setInspectedUrl(normalizedUrl);

      const isKnown = isKnownNSFWUrl(normalizedUrl) || isKnownNSFWUrl(urlToCheck);
      let effectiveNSFW = currentData.is_nsfw || isKnown;
      if (res.is_nsfw || isKnown) {
        effectiveNSFW = true;
        setValue('is_nsfw', true);
        setIsNSFWForced(true);
      } else {
        setIsNSFWForced(false);
      }

      if (res.is_reachable) {
        setPreviewStatus('success');
        onPreviewStateChange?.(res, false, urlToCheck);

        // Auto-fill title if empty
        let effectiveTitle = currentData.title;
        if (!effectiveTitle && res.title) {
          effectiveTitle = res.title;
          setValue('title', res.title);
        }

        // Automatically create shortened link
        await createLink.mutateAsync({
          original_url: currentData.original_url,
          title: effectiveTitle || undefined,
          custom_code: currentData.custom_code || undefined,
          is_nsfw: effectiveNSFW,
        });

        startSuccessHold();
        reset();
        setIsNSFWForced(false);
        onSuccess?.();
      } else {
        setPreviewStatus('failed');
        onPreviewStateChange?.(res, false, urlToCheck);
      }
    } catch (err: unknown) {
      const isKnown = isKnownNSFWUrl(urlToCheck) || isKnownNSFWUrl(normalizedUrl);
      if (isKnown) {
        setValue('is_nsfw', true);
        setIsNSFWForced(true);
      }
      const errorMsg = err instanceof Error ? err.message : 'Ошибка сети при проверке сайта';
      const fallbackPreview: LinkPreview = {
        url: urlToCheck,
        is_reachable: false,
        status_code: 0,
        is_nsfw: isKnown,
        error: errorMsg,
      };
      setPreview(fallbackPreview);
      setInspectedUrl(urlToCheck);
      setPreviewStatus('failed');
      onPreviewStateChange?.(fallbackPreview, false, urlToCheck);
    }
  };

  const onSubmit = async (data: CreateLinkFormData) => {
    const trimmedUrl = data.original_url.trim();
    const normalizedUrl = normalizeUrlInput(trimmedUrl);
    const effectiveNSFW = isNSFWForced || data.is_nsfw || isKnownNSFWUrl(normalizedUrl);

    // If already failed and user clicks submit again -> Force create
    if (previewStatus === 'failed' && (inspectedUrl === trimmedUrl || inspectedUrl === normalizedUrl)) {
      try {
        await createLink.mutateAsync({
          original_url: normalizedUrl,
          title: data.title || undefined,
          custom_code: data.custom_code || undefined,
          is_nsfw: effectiveNSFW,
        });
        startSuccessHold();
        reset();
        setIsNSFWForced(false);
        onSuccess?.();
      } catch {
        // Handled by TanStack Query onError toast
      }
      return;
    }

    // Step 1: Run preview check
    await executeCheck(normalizedUrl, data);
  };

  const handleRetryCheck = () => {
    const currentData = getValues();
    const currentUrl = currentData.original_url.trim();
    if (currentUrl) {
      void executeCheck(currentUrl, currentData);
    }
  };

  const isChecking = previewStatus === 'inspecting' || previewLink.isPending;
  const isCreating = isSubmitting || createLink.isPending;
  const isLoading = isChecking || isCreating;
  const isLocked = isLoading || cooldown > 0;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input
        label={t.createForm.urlLabel}
        placeholder={t.createForm.urlPlaceholder}
        leftIcon={<Globe className="w-4 h-4" />}
        error={errors.original_url?.message}
        {...register('original_url')}
      />

      <div className={compact ? 'grid grid-cols-1 gap-3' : 'grid grid-cols-1 sm:grid-cols-2 gap-4'}>
        <Input
          label={t.createForm.titleLabel}
          placeholder={t.createForm.titlePlaceholder}
          leftIcon={<Tag className="w-4 h-4" />}
          error={errors.title?.message}
          {...register('title')}
        />

        <Input
          label={t.createForm.customCodeLabel}
          placeholder={isPremium ? (language === 'en' ? 'e.g. dev, avari' : 'Например, dev, avari') : t.createForm.customCodePlaceholder}
          leftIcon={<Link2 className="w-4 h-4" />}
          error={errors.custom_code?.message}
          helperText={
            isPremium ? (
              <span className="text-[var(--av-gold)] flex items-center gap-1 font-medium">
                ★ {language === 'en' ? 'Short custom slugs from 4 characters available (Premium)' : 'Доступны короткие коды от 4 символов (Premium)'}
              </span>
            ) : (
              <span>
                {language === 'en' ? '8+ characters. Slugs from 4 characters require ' : 'От 8 символов. Для кодов от 4 символов нужен '}
                <button
                  type="button"
                  onClick={() => setSessionModalOpen(true)}
                  className="text-[var(--av-gold)] underline hover:text-[var(--av-gold-hover)] cursor-pointer"
                >
                  {language === 'en' ? 'Premium status' : 'Premium-статус'}
                </button>
              </span>
            )
          }
          {...register('custom_code')}
        />
      </div>

      <Switch
        label={t.createForm.nsfwLabel}
        badge={
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium border border-[var(--av-warning)]/40 text-[var(--av-warning)] bg-[var(--av-bg)]">
            {t.createForm.nsfwBadge}
          </span>
        }
        description={isNSFWForced ? t.createForm.nsfwDetected : t.createForm.nsfwDescription}
        disabled={isNSFWForced}
        {...register('is_nsfw')}
      />

      {/* Inline Preview for compact/mobile view if enabled */}
      {showInlinePreview && (previewStatus !== 'idle' || isChecking) && (
        <div className="pt-2">
          <LinkPreviewCard
            isLoading={isChecking}
            preview={preview}
            targetUrl={watchedUrl}
            onClose={handleDismiss}
          />
        </div>
      )}

      <div className="pt-2 flex flex-wrap items-center justify-end gap-3">
        {/* Retry button appears beside submit button when inspection failed */}
        {previewStatus === 'failed' && (
          <Button
            type="button"
            variant="secondary"
            onClick={handleRetryCheck}
            disabled={isLocked}
            leftIcon={<RotateCcw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />}
            className="w-full sm:w-auto border-[var(--av-warning)]/40 text-[var(--av-warning)] hover:border-[var(--av-warning)]"
            title={t.createForm.retryCheck}
          >
            {t.createForm.retryCheck}
          </Button>
        )}

        <Button
          type="submit"
          isLoading={isLoading}
          disabled={isLocked}
          leftIcon={
            cooldown > 0 ? (
              <Check className="w-4 h-4 text-[var(--av-success)]" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )
          }
          className="w-full sm:w-auto"
        >
          {cooldown > 0
            ? t.createForm.createdSuccessCooldown(cooldown)
            : previewStatus === 'failed'
            ? t.createForm.createAnyway
            : t.createForm.submitButton}
        </Button>
      </div>
    </form>
  );
}
