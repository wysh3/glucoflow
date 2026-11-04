import * as React from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { Button, Card, ErrorState, Spinner, formatDateTime } from '@glucoflow/ui';
import { useResult } from '../../../lib/queries';
import { ReceiptQr } from './qr';

export function PatientReceiptSlipPage(): React.ReactElement {
  const { resultId } = useParams<{ resultId: string }>();
  const detail = useResult(resultId);
  const result = detail.data;

  if (detail.isLoading) return <main className="mx-auto max-w-[520px] px-5 py-12"><Spinner label="Preparing the patient slip" /></main>;
  if (detail.isError || !result) return <main className="mx-auto max-w-[520px] px-5 py-12"><ErrorState title="The slip could not be prepared" description="Return to the ledger and try again." action={<Button asChild><Link to="/clinic/results">Back to the ledger</Link></Button>} /></main>;

  return (
    <main className="min-h-screen bg-canvas">
      <div className="mx-auto max-w-[540px] px-4 py-6 print:max-w-none print:px-0 print:py-0">
        <div className="mb-4 flex items-center justify-between print:hidden">
          <Button asChild variant="quiet" size="sm"><Link to="/clinic/results"><ArrowLeft size={15} aria-hidden /> Back</Link></Button>
          <Button variant="primary" size="sm" onClick={() => window.print()}><Printer size={15} aria-hidden /> Print slip</Button>
        </div>
        <Card className="bg-white p-7 text-center print:border-0 print:shadow-none">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Patient receipt</p>
          <h1 className="mt-2 text-[24px] font-semibold tracking-tight">Your report is ready.</h1>
          <p className="mt-2 text-[13px] leading-6 text-ink-soft">Please contact the clinic to discuss the next step. This slip does not contain your result.</p>
          <div className="mt-5 flex justify-center"><ReceiptQr value={`${window.location.origin}/verify/${result.receiptCode}`} size={160} /></div>
          <p className="mt-3 font-mono text-[18px] font-semibold tracking-[0.08em]">{result.receiptCode}</p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-ink-soft">Receipt code</p>
          <div className="mt-4 rounded-[8px] border border-line bg-canvas px-3 py-2 text-left text-[11px] leading-5 text-ink-soft">
            <p>Scan the code to see the recorded stage. It shows whether the clinic has acknowledged the report and contacted you. It does not show your name or result.</p>
          </div>
          <p className="mt-4 text-[11px] text-ink-soft">Printed {formatDateTime(new Date().toISOString())}. If this slip is not yours, return it to the clinic.</p>
        </Card>
      </div>
    </main>
  );
}
