import * as React from 'react';
import { NavLink } from 'react-router-dom';
import type { PatientSummaryDto } from '@glucoflow/contracts';
import { Badge, ScreenTitle, cn, formatDateOnly } from '@glucoflow/ui';

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
  const tabs = [
    { to: 'overview', label: 'Visit overview' },
    { to: 'master', label: 'Home reports' },
    { to: 'progression', label: 'Progression' },
    { to: 'documents', label: 'Documents' },
    { to: 'history', label: 'History' },
  ];
  return (
    <div className="space-y-4">
      <div className="rounded-[18px] border border-line bg-surface px-4 py-3">
        <ScreenTitle
          title={patient.displayName}
          meta={
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-ink">{patient.clinicIdentifier}</span>
              <span>·</span>
              <span>Approval revision {patient.approvalRevision}</span>
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
      <div className="min-w-0 lg:hidden">
        <nav className="flex max-w-full items-center gap-1 overflow-x-auto pb-1" aria-label="Patient record sections">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                cn(
                  'inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-[10px] px-4 text-sm font-medium',
                  isActive ? 'bg-primary/10 text-primary' : 'text-ink-soft hover:bg-surface',
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
