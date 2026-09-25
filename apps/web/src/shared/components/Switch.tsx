import React, { useId } from 'react';
import { cn } from '@/shared/utils/cn';

export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode;
  description?: React.ReactNode;
  badge?: React.ReactNode;
}

export const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, label, description, badge, id, disabled, ...props }, ref) => {
    const generatedId = useId();
    const switchId = id || generatedId;

    const control = (
      <div className="relative inline-flex items-center flex-shrink-0">
        <input
          type="checkbox"
          role="switch"
          id={switchId}
          ref={ref}
          disabled={disabled}
          className="peer absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 m-0 p-0"
          {...props}
        />
        <div aria-hidden="true" className={cn('avari-switch-track', disabled && 'opacity-40 cursor-not-allowed')}>
          <span className="avari-switch-thumb shadow-sm" />
        </div>
      </div>
    );

    if (!label && !description) {
      return control;
    }

    return (
      <label
        htmlFor={switchId}
        className={cn(
          'relative flex items-start justify-between gap-4 rounded-xl border border-[var(--av-border-subtle)] bg-[var(--av-surface)]/60 p-3.5 cursor-pointer select-none transition-colors duration-150',
          'hover:border-[var(--av-border-control)] hover:bg-[var(--av-surface-raised)]/40',
          disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
          className
        )}
      >
        <div className="space-y-1 min-w-0 pr-2 select-none">
          <div className="flex items-center gap-2">
            {label && (
              <span className="text-sm font-medium text-[var(--av-text)] select-none">
                {label}
              </span>
            )}
            {badge}
          </div>
          {description && (
            <span className="block text-xs text-[var(--av-text-secondary)] leading-relaxed select-none">
              {description}
            </span>
          )}
        </div>
        <div className="pt-0.5 flex-shrink-0">
          {control}
        </div>
      </label>
    );
  }
);
Switch.displayName = 'Switch';
