import React, { useState } from 'react';
import { Modal } from '@/shared/components/Modal';
import { Input } from '@/shared/components/Input';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import { UserAvatar } from '@/shared/components/UserAvatar';
import { useAppStore, MAX_SESSION_REROLLS } from '@/shared/store/app-store';
import { useTranslation } from '@/shared/i18n';
import { useRestoreSession, useCreateSession, useSessionMe } from '@/entities/session/queries';
import { KeyRound, Copy, Check, ShieldAlert, Sparkles, RefreshCw, ArrowRight, Dices, AlertTriangle } from 'lucide-react';
import { trackEvent } from '@/shared/analytics';
import { toast } from 'sonner';

export function SessionModal() {
  const { isSessionModalOpen, setSessionModalOpen, sessionKey, rerollsCount, incrementRerolls } = useAppStore();
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [inputKey, setInputKey] = useState('');
  const [showRerollWarning, setShowRerollWarning] = useState(false);

  const { data: meData } = useSessionMe();
  const restoreMutation = useRestoreSession();
  const createMutation = useCreateSession();

  const remainingRerolls = Math.max(0, MAX_SESSION_REROLLS - rerollsCount);

  const handleCopyKey = () => {
    if (!sessionKey) return;
    navigator.clipboard.writeText(sessionKey);
    setCopied(true);
    trackEvent('session_key_copy');
    toast.success(t.sessionModal.copiedToast);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRestore = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputKey.trim();
    if (!clean) return;
    trackEvent('session_restore_attempt');
    restoreMutation.mutate(clean, {
      onSuccess: () => {
        trackEvent('session_restore_success');
        setInputKey('');
        setShowRerollWarning(false);
        setSessionModalOpen(false);
      },
      onError: () => {
        trackEvent('session_restore_error');
      },
    });
  };

  const executeReroll = () => {
    createMutation.mutate(undefined, {
      onSuccess: (data) => {
        incrementRerolls();
        setShowRerollWarning(false);
        trackEvent('session_reroll');
        if (data?.access_key) {
          toast.success(t.sessionModal.rerollSuccess(data.access_key));
        } else {
          toast.success(t.sessionModal.newProfileCreated);
        }
      },
    });
  };

  const handleRerollClick = () => {
    if (remainingRerolls <= 0) {
      toast.error(t.sessionModal.rerollLimitReached);
      return;
    }

    const linksCount = meData?.links_count ?? 0;
    if (linksCount > 0) {
      setShowRerollWarning(true);
    } else {
      executeReroll();
    }
  };

  const keySegments = sessionKey ? sessionKey.split('-') : [];

  return (
    <Modal
      isOpen={isSessionModalOpen}
      onClose={() => setSessionModalOpen(false)}
      title={t.sessionModal.title}
      description={t.sessionModal.description}
      className="max-w-2xl sm:max-w-2xl"
    >
      <div className="space-y-6">
        {/* Current Key Card */}
        <div className="relative overflow-hidden rounded-2xl border border-[var(--av-gold)]/40 bg-gradient-to-b from-[var(--av-surface-raised)]/95 via-[var(--av-surface)]/95 to-[var(--av-bg)]/95 p-5 shadow-lg space-y-4">
          <div className="absolute top-0 right-0 -mt-6 -mr-6 w-36 h-36 bg-[var(--av-gold)]/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -mb-6 -ml-6 w-32 h-32 bg-[var(--av-cyan)]/5 rounded-full blur-2xl pointer-events-none" />

          <div className="relative flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <UserAvatar name={sessionKey} size={36} className="ring-2 ring-[var(--av-gold)]/30 rounded-xl" />
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--av-gold)] flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5" />
                {t.sessionModal.personalKey}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {meData?.is_premium && (
                <Badge variant="gold" className="text-[10px] py-0.5 px-2 font-semibold">
                  ★ PREMIUM
                </Badge>
              )}
              {meData && (
                <Badge variant="indigo" className="text-[11px] py-0.5 px-2">
                  {t.sessionModal.linksCount(meData.links_count)}
                </Badge>
              )}
            </div>
          </div>

          {sessionKey ? (
            <div className="space-y-3 relative">
              {/* Key Display & Actions Row */}
              <div className="p-3 sm:p-3.5 rounded-xl bg-[var(--av-bg)]/90 border border-[var(--av-border-control)] hover:border-[var(--av-gold)]/40 transition-colors shadow-inner flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0 flex flex-wrap items-center gap-1 font-mono text-xs sm:text-sm font-semibold tracking-wide select-all py-0.5">
                  {keySegments.map((segment, idx) => (
                    <React.Fragment key={idx}>
                      <span
                        className={
                          idx === keySegments.length - 1
                            ? 'text-[var(--av-cyan)] font-bold px-1.5 py-0.5 rounded bg-[var(--av-cyan)]/10 border border-[var(--av-cyan)]/25 text-xs'
                            : 'text-[var(--av-text)]'
                        }
                      >
                        {segment}
                      </span>
                      {idx < keySegments.length - 1 && (
                        <span className="text-[var(--av-gold)]/50 font-normal select-none">-</span>
                      )}
                    </React.Fragment>
                  ))}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    variant={copied ? 'primary' : 'secondary'}
                    onClick={handleCopyKey}
                    aria-label={t.sessionModal.copy}
                    title={copied ? t.sessionModal.copied : t.sessionModal.copy}
                    className="shrink-0 transition-all min-h-0 h-9 w-9 p-0 rounded-full"
                  >
                    {copied ? <Check className="w-4 h-4 text-[var(--av-success)]" /> : <Copy className="w-4 h-4" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleRerollClick}
                    disabled={remainingRerolls <= 0 || createMutation.isPending}
                    isLoading={createMutation.isPending}
                    aria-label={t.sessionModal.rerollName}
                    title={remainingRerolls <= 0 ? t.sessionModal.rerollLimitReached : `${t.sessionModal.rerollName} (${remainingRerolls}/${MAX_SESSION_REROLLS})`}
                    className="shrink-0 font-medium min-h-0 h-9 px-3 rounded-full gap-1.5"
                  >
                    <Dices className="w-4 h-4 text-[var(--av-cyan)]" />
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-[var(--av-surface-raised)] border border-[var(--av-border-subtle)] text-[var(--av-cyan)]">
                      {remainingRerolls}/{MAX_SESSION_REROLLS}
                    </span>
                  </Button>
                </div>
              </div>

              {/* Warning when rerolling with existing links */}
              {showRerollWarning && (
                <div className="p-4 rounded-xl border border-[var(--av-warning)]/60 bg-[var(--av-warning)]/10 space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-[var(--av-warning)] shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h4 className="text-sm font-semibold text-[var(--av-warning)]">
                        {t.sessionModal.rerollWarningTitle}
                      </h4>
                      <p className="text-xs text-[var(--av-text)] leading-relaxed">
                        {t.sessionModal.rerollWarningText(meData?.links_count ?? 0)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-[var(--av-warning)]/20">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleCopyKey}
                      leftIcon={copied ? <Check className="w-3.5 h-3.5 text-[var(--av-success)]" /> : <Copy className="w-3.5 h-3.5" />}
                    >
                      {copied ? t.sessionModal.copied : t.sessionModal.copyCurrentKey}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setShowRerollWarning(false)}
                    >
                      {t.sessionModal.cancel}
                    </Button>
                    <Button
                      size="sm"
                      onClick={executeReroll}
                      isLoading={createMutation.isPending}
                      className="bg-[var(--av-warning)]/90 hover:bg-[var(--av-warning)] text-black border-transparent font-medium"
                    >
                      {t.sessionModal.confirmReroll}
                    </Button>
                  </div>
                </div>
              )}

              <p className="text-xs avari-muted leading-relaxed">
                {t.sessionModal.keyNotice}
              </p>
            </div>
          ) : (
            <div className="py-3 text-center space-y-2">
              <p className="text-sm avari-muted">{t.sessionModal.notGenerated}</p>
              <Button
                size="sm"
                onClick={() => createMutation.mutate()}
                isLoading={createMutation.isPending}
                leftIcon={<Sparkles className="w-4 h-4" />}
              >
                {t.sessionModal.createKeyNow}
              </Button>
            </div>
          )}
        </div>

        {/* Tier Status & Policy */}
        {meData?.is_premium ? (
          <div className="p-3.5 rounded-xl border border-[var(--av-gold)]/60 bg-[var(--av-gold)]/10 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-[var(--av-gold)] shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[var(--av-gold)] block">
                  {t.sessionModal.premiumActive}
                </span>
                <Badge variant="gold" className="text-[10px] py-0 px-1.5">{t.sessionModal.premiumVip}</Badge>
              </div>
              <span className="text-[var(--av-text)] block leading-relaxed">
                {t.sessionModal.premiumActiveDesc}
              </span>
            </div>
          </div>
        ) : (
          <>
            <div className="p-3.5 rounded-xl border border-[var(--av-border-control)] bg-[var(--av-bg)]/60 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-[var(--av-gold)] shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <span className="font-semibold text-[var(--av-text)] block">
                  {t.sessionModal.policyTitle}
                </span>
                <span className="avari-muted block leading-relaxed">
                  {t.sessionModal.policyText}
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-[var(--av-gold)]/30 bg-[var(--av-gold)]/5 flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-[var(--av-gold)] shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[var(--av-text)]">
                    {t.sessionModal.wantShortSlugs}
                  </span>
                  <Badge variant="gold" className="text-[10px] py-0 px-1.5">PREMIUM</Badge>
                </div>
                <span className="avari-muted block leading-relaxed">
                  {t.sessionModal.wantShortSlugsDesc}
                </span>
              </div>
            </div>
          </>
        )}

        {/* Restore Section */}
        <div className="pt-2 border-t border-[var(--av-border-control)] space-y-3">
          <h3 className="text-sm font-medium text-[var(--av-text)]">
            {t.sessionModal.restoreTitle}
          </h3>
          <form onSubmit={handleRestore} className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder={t.sessionModal.restorePlaceholder}
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              className="font-mono text-sm"
            />
            <Button
              type="submit"
              isLoading={restoreMutation.isPending}
              disabled={!inputKey.trim()}
              rightIcon={<ArrowRight className="w-4 h-4" />}
              className="shrink-0"
            >
              {t.sessionModal.signIn}
            </Button>
          </form>
        </div>

        {/* Reset / New profile */}
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs avari-muted">{t.sessionModal.needFresh}</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleRerollClick}
            disabled={remainingRerolls <= 0 || createMutation.isPending}
            isLoading={createMutation.isPending}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            {t.sessionModal.generateNew}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
