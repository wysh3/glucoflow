import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, HeartPulse, Search, ShieldCheck, X } from 'lucide-react';
import { Button, Card, Input, Spinner } from '@glucoflow/ui';
import type { PublicReceiptProofDto } from '@glucoflow/contracts';
import { useApi } from '../../auth/session';

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
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Receipt verification</p>
        <h1 className="mt-3 text-[32px] font-semibold leading-tight tracking-tight text-ink sm:text-[40px]">
          Check a result receipt.
        </h1>
        <p className="mt-3 max-w-[58ch] text-[16px] leading-7 text-ink-soft">
          A receipt code proves that a result audit chain exists and has not changed. The check returns no patient name, test value or clinical information.
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
            {loading ? 'Checking' : 'Verify receipt'}
            <Search size={16} aria-hidden />
          </Button>
        </form>

        {error ? (
          <Card className="mt-5 border-danger/30 bg-danger-bg p-5 text-danger">
            <p className="font-medium">The check did not complete.</p>
            <p className="mt-1 text-sm">{error}</p>
          </Card>
        ) : null}

        {loading ? <div className="mt-6"><Spinner label="Recomputing the audit chain" /></div> : null}

        {proof ? (
          <Card className="mt-6 overflow-hidden">
            <div className={`flex items-center gap-3 px-5 py-4 ${proof.valid ? 'bg-success-bg text-success' : 'bg-danger-bg text-danger'}`}>
              <span className="flex size-9 items-center justify-center rounded-full bg-surface">
                {proof.valid ? <Check size={20} aria-hidden /> : <X size={20} aria-hidden />}
              </span>
              <div>
                <p className="font-semibold">{proof.valid ? 'Receipt chain intact' : proof.found ? 'Receipt chain does not match' : 'No receipt found'}</p>
                <p className="text-[12px]">{proof.valid ? `${proof.eventCount} audit events verified` : proof.found ? 'The stored chain is broken.' : 'Check the code and try again.'}</p>
              </div>
            </div>
            {proof.found ? (
              <div className="space-y-3 px-5 py-4 text-sm">
                <div className="flex items-center justify-between gap-3"><span className="text-ink-soft">Receipt</span><span className="font-medium tabular-nums text-ink">{code?.toUpperCase()}</span></div>
                <div className="flex items-center justify-between gap-3"><span className="text-ink-soft">Events</span><span className="tabular-nums text-ink">{proof.eventCount}</span></div>
                <div className="flex items-start justify-between gap-3"><span className="text-ink-soft">Chain head</span><span className="max-w-[52%] break-all text-right font-medium tabular-nums text-ink">{proof.head ?? 'None'}</span></div>
                <p className="flex items-start gap-2 border-t border-dotted border-line pt-3 text-[12px] leading-5 text-ink-soft">
                  <ShieldCheck size={14} className="mt-0.5 shrink-0 text-primary" aria-hidden />
                  This verifies the audit chain only. It does not verify a diagnosis, a treatment or a clinical decision.
                </p>
              </div>
            ) : null}
          </Card>
        ) : null}

        <p className="mt-8 text-[12px] leading-5 text-ink-soft">
          The receipt code is printed on the hospital survey pack. No login, patient identifier or test result is exposed here.
        </p>
        <Link to="/sign-in" className="mt-4 inline-flex min-h-9 items-center gap-1.5 text-sm font-medium text-primary hover:underline">
          Open the clinic workspace <ArrowRight size={15} aria-hidden />
        </Link>
      </div>
    </main>
  );
}
