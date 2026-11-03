import * as React from 'react';

/**
 * Shared editorial page header. The index and rule make the screen's place in
 * the record legible without adding decoration that carries no meaning.
 */
export function SystemPageHeader({
  index,
  label,
  title,
  meta,
  actions,
}: {
  index: string;
  label: string;
  title: string;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
}): React.ReactElement {
  return (
    <header className="border-b border-line pb-4">
      <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
        <span className="tabular-nums text-primary">{index}</span>
        <span className="rule-reveal h-px flex-1 bg-line" aria-hidden />
        <span>{label}</span>
      </div>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[24px] font-semibold tracking-tight text-ink">{title}</h1>
          {meta ? <div className="mt-1 text-[14px] leading-5 text-ink-soft">{meta}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
