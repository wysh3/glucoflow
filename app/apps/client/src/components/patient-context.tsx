import * as React from 'react';
import { NavLink } from 'react-router-dom';
import type { PatientSummaryDto } from '@glucoflow/contracts';
import { Badge, ScreenTitle, cn, formatDateOnly } from '@glucoflow/ui';

export const patientRecordSections = [
  { to: 'overview', label: 'Visit overview' },
  { to: 'progression', label: 'Progression' },
  { to: 'documents', label: 'Documents' },
  { to: 'master', label: 'Home reports' },
  { to: 'history', label: 'Record history' },
] as const;

/**
 * Persistent patient identity pinned above the record tabs. Every clinic record
 * screen shows this header so the active patient is never ambiguous.
 */
export function PatientContextHeader({
  patient,
  actions,
  testSelector,
}: {
  patient: PatientSummaryDto;
  actions?: React.ReactNode;
  testSelector?: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="space-y-4">
      <div className="border-b border-line py-3">
        <ScreenTitle
          title={patient.displayName}
          meta={
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-ink">{patient.clinicIdentifier}</span>
              <span>·</span>
              <span className="sr-only">Approval revision {patient.approvalRevision}</span>
              {patient.pendingCount > 0 ? (
                <Badge tone="review">
                  {patient.pendingCount} {patient.pendingCount === 1 ? 'document' : 'documents'} awaiting review
                </Badge>
              ) : null}
              <span>·</span>
              <span>
                {patient.latestReportDate
                  ? `Latest recorded result ${formatDateOnly(patient.latestReportDate)}`
                  : 'No approved result recorded yet'}
              </span>
            </span>
          }
          actions={actions}
        />
      </div>
      <div className="min-w-0">
        <nav className="flex flex-wrap gap-1" aria-label="Patient record sections">
          {patientRecordSections.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                cn(
                  'inline-flex min-h-11 items-center justify-center rounded-[10px] px-2 text-center text-[12px] font-medium leading-4 ',
                  isActive ? 'bg-zinc-200/60 text-ink' : 'text-ink-soft hover:bg-surface',
                )
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
        {testSelector}
      </div>
    </div>
  );
}
