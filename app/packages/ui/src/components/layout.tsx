import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils';

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return (
    <div
      className={cn('rounded-[12px] border border-line bg-surface shadow-[0_1px_2px_rgba(23,43,51,0.04)]', className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return <div className={cn('flex flex-wrap items-center justify-between gap-8 px-6 py-4', className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>): React.ReactElement {
  return <h2 className={cn('text-[15px] font-semibold text-ink', className)} {...props} />;
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return <div className={cn('px-6 pb-6', className)} {...props} />;
}

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[12px] font-medium',
  {
    variants: {
      tone: {
        neutral: 'border-line bg-canvas text-ink-soft',
        review: 'border-review/30 bg-review-bg text-review',
        error: 'border-danger/30 bg-danger-bg text-danger',
        success: 'border-success/30 bg-success-bg text-success',
        primary: 'border-primary/30 bg-primary/10 text-primary',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

export function Badge({ className, tone, ...props }: BadgeProps): React.ReactElement {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

/** Status is never carried by colour alone: every badge has a text label. */
export function StatusBadge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: BadgeProps['tone'];
}): React.ReactElement {
  return <Badge tone={tone}>{label}</Badge>;
}

export function Separator({ className }: { className?: string }): React.ReactElement {
  return <div className={cn('h-px w-full bg-line', className)} role="separator" />;
}

export function Alert({
  tone = 'neutral',
  title,
  children,
  action,
}: {
  tone?: 'neutral' | 'review' | 'error' | 'success';
  title?: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}): React.ReactElement {
  const tones = {
    neutral: 'border-line bg-canvas text-ink',
    review: 'border-review/30 bg-review-bg text-review',
    error: 'border-danger/30 bg-danger-bg text-danger',
    success: 'border-success/30 bg-success-bg text-success',
  } as const;
  return (
    <div className={cn('rounded-[12px] border px-4 py-3 text-sm', tones[tone])} role="status">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {title ? <p className="font-semibold">{title}</p> : null}
          {children ? <div className={title ? 'mt-1' : ''}>{children}</div> : null}
        </div>
        {action}
      </div>
    </div>
  );
}

export function Spinner({ label = 'Loading' }: { label?: string }): React.ReactElement {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-ink-soft" role="status" aria-live="polite">
      <span
        aria-hidden
        className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-primary motion-reduce:animate-none"
      />
      {label}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="rounded-[12px] border border-dashed border-line bg-surface px-6 py-8 text-center">
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description ? <p className="mx-auto mt-1 max-w-[52ch] text-sm text-ink-soft">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  description,
  action,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="rounded-[12px] border border-danger/30 bg-danger-bg px-6 py-6 text-center">
      <p className="text-sm font-semibold text-danger">{title}</p>
      {description ? <p className="mx-auto mt-1 max-w-[52ch] text-sm text-danger">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }): React.ReactElement {
  return <div className={cn('animate-pulse rounded-[10px] bg-line/60 motion-reduce:animate-none', className)} />;
}

export function ScreenTitle({
  title,
  meta,
  actions,
}: {
  title: string;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
}): React.ReactElement {
  // A single compact page title inside the toolbar. No promotional subtitle.
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-[22px] font-semibold leading-tight text-ink sm:text-[24px]">{title}</h1>
        {meta ? <div className="text-sm text-ink-soft">{meta}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** A measured progress bar. It is only rendered with a real measured value. */
export function Progress({ value, label }: { value: number; label?: string }): React.ReactElement {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className="space-y-1">
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-line"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clamped}
        aria-label={label ?? 'Progress'}
      >
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${clamped}%` }} />
      </div>
      {label ? <p className="text-[12px] text-ink-soft">{label}</p> : null}
    </div>
  );
}
