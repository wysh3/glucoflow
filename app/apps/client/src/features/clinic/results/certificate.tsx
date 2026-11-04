import * as React from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Printer, ShieldCheck } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  ErrorState,
  Spinner,
  formatDateTime,
} from '@glucoflow/ui';
import {
  COMMUNICATION_OUTCOME_LABELS,
  DISPOSITION_LABELS,
  NEXT_STEP_LABELS,
  RESULT_FLAG_LABELS,
} from '@glucoflow/contracts';
import { useSession } from '../../../auth/session';
import { useResult, useResultProof } from '../../../lib/queries';
import { ReceiptQr } from './qr';

export function ClosureCertificatePage(): React.ReactElement {
  const { resultId } = useParams<{ resultId: string }>();
  const { me } = useSession();
  const detail = useResult(resultId);
  const proof = useResultProof(resultId);
  const clinicName = me?.contexts.find((context) => context.kind === 'clinic')?.clinicName ?? 'Clinic';
  const result = detail.data;
  const evidence = proof.data;

  if (detail.isLoading || proof.isLoading) {
    return <main className="mx-auto max-w-[820px] px-5 py-12"><Spinner label="Preparing the closure certificate" /></main>;
  }
  if (detail.isError || !result || proof.isError || !evidence) {
    return <main className="mx-auto max-w-[820px] px-5 py-12"><ErrorState title="The certificate could not be prepared" description="Return to the result ledger and try again." action={<Button asChild><Link to="/clinic/results">Back to the ledger</Link></Button>} /></main>;
  }

  return (
    <main className="min-h-screen bg-canvas">
      <div className="mx-auto max-w-[860px] px-4 py-6 print:max-w-none print:px-0 print:py-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
          <Button asChild variant="quiet" size="sm"><Link to="/clinic/results"><ArrowLeft size={15} aria-hidden /> Back to the ledger</Link></Button>
          <Button variant="primary" size="sm" onClick={() => window.print()}><Printer size={15} aria-hidden /> Print or save PDF</Button>
        </div>

        <Card className="overflow-hidden bg-white p-7 text-ink shadow-sm print:border-0 print:shadow-none">
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Closure certificate</p>
              <h1 className="mt-1 text-[28px] font-semibold tracking-tight">{clinicName}</h1>
              <p className="mt-1 text-[12px] text-ink-soft">Administrative result-closure record. Confidential. Not a diagnosis or a clinical outcome.</p>
            </div>
            <div className="text-right">
              <ReceiptQr value={`${window.location.origin}/verify/${result.receiptCode}`} size={96} />
              <p className="mt-1 font-mono text-[11px] font-semibold">{result.receiptCode}</p>
            </div>
          </header>

          <section className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft">Patient</p>
              <p className="mt-1 text-lg font-semibold">{result.patientName ?? result.patientNameRaw}</p>
              <p className="text-[12px] text-ink-soft">{result.patientIdentifier ?? result.patientIdentifierRaw ?? 'Identifier not recorded'}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft">Report</p>
              <p className="mt-1 text-lg font-semibold">{result.testName} <span className="font-normal">{result.valueText}{result.unit ? ` ${result.unit}` : ''}</span></p>
              <p className="text-[12px] text-ink-soft">{result.labName ?? 'Lab not recorded'} · {RESULT_FLAG_LABELS[result.labFlag]}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft">Lab release</p>
              <p className="mt-1 text-sm">{result.labReleasedAt ? formatDateTime(result.labReleasedAt) : 'Not recorded'}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft">Receipt status</p>
              <p className="mt-1 text-sm">{result.statusLabel}{result.disposition ? ` · ${DISPOSITION_LABELS[result.disposition]}` : ''}</p>
            </div>
          </section>

          <section className="mt-6">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-soft">Evidence present</h2>
            <table className="mt-2 w-full border-collapse text-left text-[12px]">
              <thead><tr className="border-b border-line text-ink-soft"><th className="py-2 pr-2 font-medium">Control</th><th className="py-2 pr-2 font-medium">Evidence</th><th className="py-2 font-medium">What it records</th></tr></thead>
              <tbody>
                {evidence.controls.map((control) => (
                  <tr key={control.code} className="border-b border-line/70 align-top">
                    <td className="py-2 pr-2 font-medium">{control.label}</td>
                    <td className="py-2 pr-2">{control.status === 'present' ? <Badge tone="success">Present</Badge> : control.status === 'missing' ? <Badge tone="error">Missing</Badge> : <Badge tone="neutral">N/A</Badge>}</td>
                    <td className="py-2 text-ink-soft">{control.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-soft">Clinician acknowledgement</h2>
              <p className="mt-2 text-[12px] leading-5 text-ink-soft">
                {result.acknowledgedByName ? `${result.acknowledgedByName} echoed ${result.acknowledgedValueText ?? 'the value'} and selected ${result.acknowledgedFlag ?? 'the flag'}.` : 'No clinician value echo is recorded.'}
              </p>
              <p className="mt-1 text-[12px] text-ink-soft">{result.labNotifierName ? `Lab notifier: ${result.labNotifierName}${result.labNotifierRole ? ` (${result.labNotifierRole})` : ''}. Read-back: ${result.labReadBackValueText ?? 'not recorded'}.` : 'No lab notifier is recorded.'}</p>
            </div>
            <div>
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-soft">Patient-side last mile</h2>
              <p className="mt-2 text-[12px] leading-5 text-ink-soft">
                {result.communicationOutcome ? COMMUNICATION_OUTCOME_LABELS[result.communicationOutcome] : 'No patient contact outcome recorded.'}
                {result.communicationRecipient ? ` · ${result.communicationRecipient}` : ''}
                {result.communicationRelation ? ` (${result.communicationRelation})` : ''}
                {result.communicationLanguage ? ` · ${result.communicationLanguage}` : ''}
              </p>
              <p className="mt-1 text-[12px] text-ink-soft">{result.nextStep ? `Next step: ${NEXT_STEP_LABELS[result.nextStep]}.` : 'No next step recorded.'} {result.teachBackConfirmed ? 'The patient or caregiver repeated the next step.' : 'Teach-back was not recorded.'}</p>
              <p className="mt-1 text-[12px] text-ink-soft">{result.nextStepCompletedAt ? `Completed ${formatDateTime(result.nextStepCompletedAt)}.` : 'Completion is not recorded.'}</p>
            </div>
          </section>

          <section className="mt-6 border-t border-line pt-4">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-soft">Event timeline</h2>
            <ol className="mt-2 space-y-1.5">
              {result.events.map((event) => (
                <li key={event.eventId} className="flex gap-2 text-[11px] leading-5">
                  <span className="w-[132px] shrink-0 text-ink-soft">{formatDateTime(event.createdAt)}</span>
                  <span className="font-medium capitalize">{event.eventType.replaceAll('_', ' ')}</span>
                  <span className="text-ink-soft">{event.actorName ? `· ${event.actorName}` : ''}{event.note ? ` · ${event.note}` : ''}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="mt-6 rounded-[8px] border border-line bg-canvas p-4 print:bg-white">
            <div className="flex items-start gap-2">
              <ShieldCheck size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden />
              <div>
                <h2 className="text-[13px] font-semibold">Draft certificate under section 63(4), Bharatiya Sakshya Adhiniyam, 2023</h2>
                <p className="mt-1 text-[11px] leading-5 text-ink-soft">
                  This computer output is produced from the electronic record maintained by {clinicName} in the ordinary course of its activities. The event chain head is <span className="break-all font-mono">{evidence.head ?? 'not available'}</span>, checked at {formatDateTime(evidence.checkedAt)}. The record is complete for the receipt on this page to the extent of the evidence shown.
                </p>
                <p className="mt-2 text-[11px] leading-5 text-ink-soft">
                  Person in charge: {me?.actor.displayName ?? '____________________'} · Signature: ____________________ · Date: {formatDateTime(new Date().toISOString())}
                </p>
                <p className="mt-2 text-[10px] leading-4 text-ink-soft">Draft for signature. This is not a legal opinion or a certification that the record meets every statutory requirement. The chain is tamper-evident inside this database; it is not externally anchored yet.</p>
              </div>
            </div>
          </section>

          <footer className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-[10px] text-ink-soft">
            <span>Generated from the clinic result ledger. Evidence present is not a compliance verdict.</span>
            <span className="font-mono">{result.receiptCode}</span>
          </footer>
        </Card>
      </div>
    </main>
  );
}
