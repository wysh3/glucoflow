import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, HeartPulse, Search, ShieldCheck, X } from 'lucide-react';
import { Button, Card, Input, Spinner } from '@glucoflow/ui';
import type { PublicReceiptProofDto, PublicReceiptStage } from '@glucoflow/contracts';
import { useApi } from '../../auth/session';

const STAGE_COPY: Record<PublicReceiptStage, { title: string; detail: string; tone: 'success' | 'review' | 'error' | 'neutral' }> = {
  received: {
    title: 'Receipt created',
    detail: 'The clinic recorded that the report arrived. It has not recorded a clinician value echo yet.',
    tone: 'review',
  },
  acknowledged: {
    title: 'A clinician echoed the value',
    detail: 'A named clinician entered the printed value and flag. The patient-side last mile is still open.',
    tone: 'review',
  },
  patient_contacted: {
    title: 'Patient contact recorded',
    detail: 'The clinic recorded who was reached or attempted, the channel, and the next administrative step.',
    tone: 'success',
  },
  next_step_completed: {
    title: 'Next step completed',
    detail: 'The clinic recorded that the next administrative step was completed.',
    tone: 'success',
  },
  closed: {
    title: 'Loop closed',
    detail: 'The receipt is closed with an explicit disposition. This is an administrative closure, not a clinical outcome.',
    tone: 'success',
  },
  closed_unreachable: {
    title: 'Closed as unreachable',
    detail: 'The clinic recorded attempts and closed the receipt without falsely recording that the patient was informed.',
    tone: 'review',
  },
  invalid: {
    title: 'The receipt chain does not match',
    detail: 'The stored events and the anchored count or head disagree. Treat the receipt as unverified and contact the clinic.',
    tone: 'error',
  },
  not_found: {
    title: 'No receipt found',
    detail: 'Check the code. A code is printed on the patient receipt slip or the hospital closure certificate.',
    tone: 'neutral',
  },
  revoked: {
    title: 'Receipt withdrawn',
    detail: 'The clinic withdrew this receipt, for example after a lawful erasure request. It is not evidence of tampering.',
    tone: 'neutral',
  },
};

const PROGRESS: { stage: PublicReceiptStage; label: string }[] = [
  { stage: 'received', label: 'Report received' },
  { stage: 'acknowledged', label: 'Clinician value echo' },
  { stage: 'patient_contacted', label: 'Patient contacted' },
  { stage: 'next_step_completed', label: 'Next step completed' },
  { stage: 'closed', label: 'Receipt closed' },
];

function progressIndex(stage: PublicReceiptStage): number {
  switch (stage) {
    case 'received': return 0;
    case 'acknowledged': return 1;
    case 'patient_contacted': return 2;
    case 'next_step_completed': return 3;
    case 'closed': return 4;
    case 'closed_unreachable': return 4;
    default: return -1;
  }
}

export function VerifyReceiptPage(): React.ReactElement {
  const { code } = useParams<{ code?: string }>();
  const navigate = useNavigate();
  const api = useApi();
  const [query, setQuery] = React.useState(code ?? '');
  const [proof, setProof] = React.useState<PublicReceiptProofDto | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const verify = React.useCallback(async (value: string): Promise<void> => {
    const trimmed = value.trim().toUpperCase();
    if (trimmed.length < 6) return;
    setLoading(true);
    setError(null);
    setProof(null);
    try {
      const result = await api.request<PublicReceiptProofDto>(`/api/v1/public/receipts/${encodeURIComponent(trimmed)}`);
      setProof(result);
      navigate(`/verify/${trimmed}`, { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The receipt could not be checked.');
    } finally {
      setLoading(false);
    }
  }, [api, navigate]);

  React.useEffect(() => {
    if (code) void verify(code);
    // The code in the URL is the input on first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const copy = proof ? STAGE_COPY[proof.stage] : null;
  const current = proof ? progressIndex(proof.stage) : -1;
  const valid = proof?.valid ?? false;
  const unreachable = proof?.stage === 'closed_unreachable';

  return (
    <main className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[920px] items-center justify-between gap-4 px-5 py-4">
          <Link to="/" className="flex items-center gap-2.5 text-primary">
            <HeartPulse size={22} aria-hidden />
            <span className="text-lg font-semibold tracking-tight">glucoflow</span>
          </Link>
          <Link to="/" className="inline-flex min-h-9 items-center gap-1.5 text-sm text-ink-soft hover:text-ink">
            <ArrowLeft size={15} aria-hidden /> Back
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-[760px] px-5 py-12 sm:py-16">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Patient receipt check</p>
        <h1 className="mt-3 text-[32px] font-semibold leading-tight tracking-tight text-ink sm:text-[40px]">
          What happened to this result?
        </h1>
        <p className="mt-3 max-w-[60ch] text-[16px] leading-7 text-ink-soft">
          A receipt code shows the recorded administrative stage and whether the clinic's event chain is intact. It does not show a patient name, test value, diagnosis or clinical decision.
        </p>

        <form
          className="mt-7 flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => { event.preventDefault(); void verify(query); }}
        >
          <Input
            aria-label="Receipt code"
            placeholder="GLF-XXXXXXXXXX"
            value={query}
            onChange={(event) => setQuery(event.target.value.toUpperCase())}
            className="min-w-0 flex-1"
          />
          <Button type="submit" variant="primary" disabled={loading || query.trim().length < 6}>
            {loading ? 'Checking' : 'Check receipt'}
            <Search size={16} aria-hidden />
          </Button>
        </form>

        {error ? (
          <Card className="mt-5 border-danger/30 bg-danger-bg p-5 text-danger">
            <p className="font-medium">The check did not complete.</p>
            <p className="mt-1 text-sm">{error}</p>
          </Card>
        ) : null}

        {loading ? <div className="mt-6"><Spinner label="Checking the receipt record" /></div> : null}

        {proof && copy ? (
          <Card className="mt-6 overflow-hidden">
            <div className={`flex items-center gap-3 px-5 py-4 ${copy.tone === 'success' ? 'bg-success-bg text-success' : copy.tone === 'error' ? 'bg-danger-bg text-danger' : copy.tone === 'review' ? 'bg-review-bg text-review' : 'bg-canvas text-ink'}`}>
              <span className="flex size-9 items-center justify-center rounded-full bg-surface">
                {copy.tone === 'error' ? <X size={20} aria-hidden /> : <Check size={20} aria-hidden />}
              </span>
              <div>
                <p className="font-semibold">{copy.title}</p>
                <p className="text-[12px]">{proof.found ? `Receipt ${code?.toUpperCase() ?? ''}` : 'The code is not in the receipt register.'}</p>
              </div>
            </div>
            <div className="space-y-4 px-5 py-4">
              <p className="text-sm leading-6 text-ink">{copy.detail}</p>
              {proof.found && proof.stage !== 'invalid' && proof.stage !== 'revoked' ? (
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-soft">Recorded stage</p>
                    <span className={`text-[12px] font-medium ${valid ? 'text-success' : 'text-danger'}`}>{valid ? 'Chain intact' : 'Chain not intact'}</span>
                  </div>
                  <ol className="mt-3 space-y-2">
                    {PROGRESS.map((item, index) => {
                      const notConfirmed = unreachable && (item.stage === 'patient_contacted' || item.stage === 'next_step_completed');
                      const done = index <= current && !notConfirmed;
                      const isCurrent = index === current;
                      const label = notConfirmed
                        ? item.stage === 'patient_contacted' ? 'Patient contact not confirmed' : 'Next step not confirmed'
                        : item.label;
                      return (
                        <li key={item.stage} className="flex items-center gap-3 text-sm">
                          <span className={`flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px] ${done ? 'border-primary bg-primary text-canvas' : 'border-line bg-surface text-ink-soft'}`}>
                            {done ? <Check size={11} aria-hidden /> : index + 1}
                          </span>
                          <span className={isCurrent ? 'font-medium text-ink' : done ? 'text-ink' : 'text-ink-soft'}>{label}</span>
                          {isCurrent ? <span className="ml-auto text-[11px] font-medium uppercase tracking-[0.1em] text-primary">Current</span> : null}
                        </li>
                      );
                    })}
                  </ol>
                </div>
              ) : null}
              <p className="flex items-start gap-2 border-t border-dotted border-line pt-3 text-[12px] leading-5 text-ink-soft">
                <ShieldCheck size={14} className="mt-0.5 shrink-0 text-primary" aria-hidden />
                The check confirms the recorded administrative stage and the clinic's event chain. It does not prove that a diagnosis or treatment was correct, and it is not a clinical outcome.
              </p>
            </div>
          </Card>
        ) : null}

        <p className="mt-8 text-[12px] leading-5 text-ink-soft">
          The code is printed on the patient receipt slip and the hospital closure certificate. No login is needed. If the code is lost, ask the clinic that sent the report.
        </p>
        <Link to="/sign-in" className="mt-4 inline-flex min-h-9 items-center gap-1.5 text-sm font-medium text-primary hover:underline">
          Open the clinic workspace <ArrowRight size={15} aria-hidden />
        </Link>
      </div>
    </main>
  );
}
