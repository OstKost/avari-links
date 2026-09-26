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
    toast.success(t.sessionModal.copiedToast);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRestore = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputKey.trim();
    if (!clean) return;
    restoreMutation.mutate(clean, {
      onSuccess: () => {
        setInputKey('');
        setShowRerollWarning(false);
        setSessionModalOpen(false);
      },
    });
  };

  const executeReroll = () => {
    createMutation.mutate(undefined, {
      onSuccess: (data) => {
        incrementRerolls();
        setShowRerollWarning(false);
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
      className="max-w-xl"
    >
      <div className="space-y-6">
        {/* Current Key Card */}
        <div className="p-4 rounded-xl border border-[var(--av-gold)]/40 bg-[var(--av-surface)] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <UserAvatar name={sessionKey} size={32} />
              <span className="text-xs font-medium uppercase tracking-wider text-[var(--av-gold)] flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5" />
                {t.sessionModal.personalKey}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {meData?.is_premium && (
                <Badge variant="gold" className="text-[10px] py-0.5">
                  ★ PREMIUM
                </Badge>
              )}
              {meData && (
                <Badge variant="indigo">
                  {t.sessionModal.linksCount(meData.links_count)}
                </Badge>
              )}
            </div>
          </div>

          {sessionKey ? (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 p-3 bg-[var(--av-bg)] border border-[var(--av-border-control)] rounded-lg">
                <div className="flex flex-wrap gap-1.5 font-mono text-sm font-semibold tracking-wide select-all items-center">
                  {keySegments.map((segment, idx) => (
                    <span
                      key={idx}
                      className={idx === keySegments.length - 1 ? 'text-[var(--av-cyan)]' : 'text-[var(--av-text)]'}
                    >
                      {segment}{idx < keySegments.length - 1 ? '-' : ''}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleCopyKey}
                    leftIcon={copied ? <Check className="w-3.5 h-3.5 text-[var(--av-success)]" /> : <Copy className="w-3.5 h-3.5" />}
                    className="shrink-0"
                  >
                    {copied ? t.sessionModal.copied : t.sessionModal.copy}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleRerollClick}
                    disabled={remainingRerolls <= 0 || createMutation.isPending}
                    isLoading={createMutation.isPending}
                    leftIcon={<Dices className="w-3.5 h-3.5 text-[var(--av-cyan)]" />}
                    className="shrink-0"
                    title={remainingRerolls <= 0 ? t.sessionModal.rerollLimitReached : `${t.sessionModal.rerollName} (${remainingRerolls}/${MAX_SESSION_REROLLS})`}
                  >
                    <span>{t.sessionModal.rerollName}</span>
                    <span className="ml-1 text-[10px] font-mono opacity-80 px-1 py-0.5 rounded bg-[var(--av-surface-raised)] border border-[var(--av-border-subtle)]">
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

              <p className="text-xs avari-muted">
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
