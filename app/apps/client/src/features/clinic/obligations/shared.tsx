import * as React from 'react';
import { Badge, cn, formatDateTime } from '@glucoflow/ui';
import { RESULT_FLAG_LABELS } from '@glucoflow/contracts';
import type { ObligationRow } from '@glucoflow/contracts';

export const FLAG_TONE: Record<ObligationRow['labFlag'], 'error' | 'review' | 'success' | 'neutral'> = {
  critical: 'error',
  abnormal: 'review',
  normal: 'success',
  unknown: 'neutral',
};

export function FlagChip({ flag }: { flag: ObligationRow['labFlag'] }): React.ReactElement {
  return <Badge tone={FLAG_TONE[flag]}>{RESULT_FLAG_LABELS[flag]}</Badge>;
}

export function breachLabel(row: ObligationRow): { text: string; urgent: boolean } {
  if (row.pausedAt) {
    return { text: `Paused${row.pauseReason ? `: ${row.pauseReason}` : ''}`, urgent: false };
  }
  if (!row.breachAt) return { text: 'No clock', urgent: false };
  const minutes = Math.round((Date.parse(row.breachAt) - Date.now()) / 60_000);
  if (minutes < 0) return { text: `Breached ${Math.abs(minutes)} min ago`, urgent: true };
  if (minutes < 60) return { text: `${minutes} min to breach`, urgent: minutes <= 15 };
  const hours = Math.round(minutes / 60);
  return { text: `${hours} h to breach`, urgent: false };
}

export function receivedLabel(row: ObligationRow): string {
  return formatDateTime(row.receivedAt);
}

export function PatientLine({ row }: { row: ObligationRow }): React.ReactElement {
  return (
    <p className="text-[13px] text-ink-soft">
      <span className="font-medium text-ink">{row.patientName ?? 'Unmatched report'}</span>
      {row.patientIdentifier ? <span> · {row.patientIdentifier}</span> : null}
      {row.labName ? <span> · {row.labName}</span> : null}
    </p>
  );
}

export function BreachLine({ row }: { row: ObligationRow }): React.ReactElement {
  const breach = breachLabel(row);
  return (
    <span className={cn('text-[12px] tabular-nums', breach.urgent ? 'font-semibold text-danger' : 'text-ink-soft')}>
      {breach.text}
    </span>
  );
}

export function AttemptLine({ row }: { row: ObligationRow }): React.ReactElement | null {
  if (row.attemptCount === 0) return null;
  return (
    <p className="text-[12px] text-ink-soft">
      {row.attemptCount} attempt{row.attemptCount === 1 ? '' : 's'} on record
      {row.lastAttemptAt ? ` · last ${formatDateTime(row.lastAttemptAt)}` : ''}
    </p>
  );
}

export function ValueLine({ row }: { row: ObligationRow }): React.ReactElement {
  return (
    <p className="text-[20px] font-semibold tracking-tight text-ink">
      {row.testName} {row.valueText}
      {row.unit ? <span className="ml-1 text-[14px] font-medium text-ink-soft">{row.unit}</span> : null}
    </p>
  );
}
