import * as React from 'react';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  EmptyState,
  ErrorState,
  Select,
  Spinner,
} from '@glucoflow/ui';
import type {
  CommunicationOutcome,
  InformedChannel,
  NextStep,
  ObligationRow,
} from '@glucoflow/contracts';
import {
  COMMUNICATION_OUTCOME_LABELS,
  NEXT_STEP_LABELS,
} from '@glucoflow/contracts';
import { useObligationActions, useObligations } from '../../../lib/obligations';
import { AttemptLine, BreachLine, FlagChip, PatientLine, ValueLine } from './shared';

const OUTCOMES: CommunicationOutcome[] = [
  'informed_patient',
  'informed_caregiver',
  'informed_treating_doctor',
  'unreachable',
  'invalid_number',
  'declined',
  'deceased',
  'transferred',
];

const CHANNELS: InformedChannel[] = ['call', 'whatsapp', 'sms', 'in_person', 'letter'];
const CHANNEL_LABELS: Record<InformedChannel, string> = {
  call: 'Call',
  whatsapp: 'WhatsApp',
  sms: 'SMS',
  in_person: 'In person',
  letter: 'Letter',
  other: 'Other',
};

const NEXT_STEPS: NextStep[] = [
  'book_appointment',
  'repeat_test',
  'see_specialist',
  'collect_report',
  'urgent_attendance',
  'other',
];

function isInformed(outcome: CommunicationOutcome): boolean {
  return outcome === 'informed_patient' || outcome === 'informed_caregiver' || outcome === 'informed_treating_doctor';
}

export function ObligationCalls({ onOpen }: { onOpen: (id: string) => void }): React.ReactElement {
  const query = useObligations('calls');
  if (query.isLoading) return <Spinner label="Loading the calls" />;
  if (query.error) {
    return (
      <ErrorState
        description={query.error instanceof Error ? query.error.message : 'The call list could not load.'}
        action={<Button variant="secondary" onClick={() => void query.refetch()}>Try again</Button>}
      />
    );
  }
  const rows = query.data?.items ?? [];
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No calls waiting."
        description="Every result the clinician has seen has a recorded outcome. New calls appear as soon as a clinician marks a result seen."
      />
    );
  }
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <CallCard key={row.id} row={row} onOpen={onOpen} />
      ))}
    </div>
  );
}

function CallCard({ row, onOpen }: { row: ObligationRow; onOpen: (id: string) => void }): React.ReactElement {
  const actions = useObligationActions();
  const [channel, setChannel] = React.useState<InformedChannel>('call');
  const [outcome, setOutcome] = React.useState<CommunicationOutcome | ''>('');
  const [readBack, setReadBack] = React.useState(false);
  const [teachBack, setTeachBack] = React.useState(false);
  const [nextStep, setNextStep] = React.useState<NextStep | ''>('');
  const [error, setError] = React.useState<string | null>(null);
  const [recorded, setRecorded] = React.useState(false);

  const critical = row.labFlag === 'critical';
  const informed = outcome !== '' && isInformed(outcome);
  const needsReadBack = informed && !readBack;

  const submit = async (): Promise<void> => {
    setError(null);
    setRecorded(false);
    if (outcome === '') {
      setError('Choose what happened before recording the contact.');
      return;
    }
    try {
      if (informed) {
        await actions.informed.mutateAsync({
          id: row.id,
          body: {
            channel,
            outcome,
            readBack,
            teachBack,
            nextStep: nextStep || undefined,
          },
        });
      } else {
        await actions.attempt.mutateAsync({ id: row.id, body: { channel, outcome } });
      }
      setRecorded(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The contact was not recorded.');
    }
  };

  const closeUnreachable = async (): Promise<void> => {
    setError(null);
    try {
      await actions.closeUnreachable.mutateAsync({
        id: row.id,
        body: { disposition: 'unreachable', note: 'Closed after documented attempts.' },
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The exception was not recorded.');
    }
  };

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <ValueLine row={row} />
          <BreachLine row={row} />
          <PatientLine row={row} />
          <AttemptLine row={row} />
        </div>
        <FlagChip flag={row.labFlag} />
      </div>

      <p className="mt-3 text-[13px] leading-5 text-ink-soft">
        Read the value back. Ask the patient to say what they understood. Record what happened, not what should have happened.
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="text-[12px] font-medium text-ink-soft" htmlFor={`channel-${row.id}`}>Channel</label>
        <label className="text-[12px] font-medium text-ink-soft" htmlFor={`outcome-${row.id}`}>Outcome</label>
        <Select id={`channel-${row.id}`} value={channel} onChange={(event) => setChannel(event.target.value as InformedChannel)}>
          {CHANNELS.map((item) => (
            <option key={item} value={item}>{CHANNEL_LABELS[item]}</option>
          ))}
        </Select>
        <Select id={`outcome-${row.id}`} value={outcome} onChange={(event) => setOutcome(event.target.value as CommunicationOutcome)}>
          <option value="">Choose an outcome</option>
          {OUTCOMES.map((item) => (
            <option key={item} value={item}>{COMMUNICATION_OUTCOME_LABELS[item]}</option>
          ))}
        </Select>
      </div>

      {informed ? (
        <div className="mt-3 space-y-2 rounded-[10px] border border-line bg-canvas p-3">
          <label className="flex items-center gap-2 text-[13px] text-ink">
            <Checkbox checked={readBack} onChange={(event) => setReadBack(event.target.checked)} />
            Value read back and confirmed (required before an informed outcome)
          </label>
          <label className="flex items-center gap-2 text-[13px] text-ink">
            <Checkbox checked={teachBack} onChange={(event) => setTeachBack(event.target.checked)} />
            Patient said back what they understood
          </label>
          <div>
            <label className="text-[12px] font-medium text-ink-soft" htmlFor={`next-${row.id}`}>Next step</label>
            <Select id={`next-${row.id}`} value={nextStep} onChange={(event) => setNextStep(event.target.value as NextStep | '')}>
              <option value="">No next step</option>
              {NEXT_STEPS.map((item) => (
                <option key={item} value={item}>{NEXT_STEP_LABELS[item]}</option>
              ))}
            </Select>
          </div>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="primary" size="sm" disabled={actions.informed.isPending || actions.attempt.isPending || needsReadBack || outcome === ''} onClick={() => void submit()}>
          {actions.informed.isPending || actions.attempt.isPending ? 'Recording' : 'Record contact'}
        </Button>
        <Button variant="quiet" size="sm" onClick={() => onOpen(row.id)}>Source</Button>
        {row.attemptCount >= 2 && row.communication === 'in_progress' ? (
          <Button variant="danger" size="sm" disabled={actions.closeUnreachable.isPending} onClick={() => void closeUnreachable()}>
            Close as unreachable
          </Button>
        ) : null}
        {recorded ? <span className="text-[12px] text-success">Contact recorded.</span> : null}
      </div>

      {needsReadBack ? (
        <p className="mt-2 text-[12px] text-danger">An informed outcome cannot be recorded without the read-back.</p>
      ) : null}
      {error ? (
        <div className="mt-3">
          <Alert tone="error" title="Not recorded">{error}</Alert>
        </div>
      ) : null}
    </Card>
  );
}
