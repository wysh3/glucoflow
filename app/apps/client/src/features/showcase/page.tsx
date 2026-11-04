import * as React from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Card } from '@glucoflow/ui';
import { SystemPageHeader } from '../../components/system-page-header';

const STEPS = [
  {
    index: '01',
    title: 'A report arrives',
    to: '/clinic/intake',
    action: 'Open intake',
    line: 'The lab prints a code; the clinic scans or imports it. The flag is the lab\u2019s.',
  },
  {
    index: '02',
    title: 'The doctor sees one line',
    to: '/clinic/line',
    action: 'Open the line',
    line: 'One card, one tap. She is back with the patient.',
  },
  {
    index: '03',
    title: 'The nurse records the read-back',
    to: '/clinic/calls',
    action: 'Open the calls',
    line: 'The call that was already happening, now with a value echo and an outcome.',
  },
  {
    index: '04',
    title: 'The receipt',
    to: '/clinic/line',
    action: 'Open a source',
    line: 'The timeline and the chain head. Readable by a surveyor or a lab. The chain proves order, not truth.',
  },
  {
    index: '05',
    title: 'The refusal',
    to: '/clinic/intake',
    action: 'Open a hold',
    line: 'Two patients, one phone. The system does not guess.',
  },
  {
    index: '06',
    title: 'The exception',
    to: '/clinic/register?tab=exceptions',
    action: 'Open the exceptions',
    line: 'Not informed. Two attempts. A named owner. Never a false closure.',
  },
  {
    index: '07',
    title: 'The register',
    to: '/clinic/register',
    action: 'Open the register',
    line: 'The page the surveyor files, printed on A4.',
  },
  {
    index: '08',
    title: 'The number',
    to: '/clinic/replay',
    action: 'Open the replay',
    line: 'Baseline against the loop, on the same cohort, with the assumptions shown.',
  },
];

export function ShowcasePage(): React.ReactElement {
  return (
    <div className="mx-auto w-full max-w-[980px] px-4 py-8 sm:px-6">
      <SystemPageHeader
        index="00"
        label="Health-a-thon 2026"
        title="The 4-minute showcase"
        meta="The real screens, in the order the room should see them. Synthetic data. No separate demo mode."
        actions={<Badge tone="review">Synthetic data</Badge>}
      />

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {STEPS.map((step) => (
          <Card key={step.index} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold tabular-nums text-primary">{step.index}</p>
                <p className="mt-1 text-[16px] font-semibold text-ink">{step.title}</p>
                <p className="mt-1 text-[13px] leading-5 text-ink-soft">{step.line}</p>
              </div>
              <Link to={step.to}>
                <Button variant="secondary" size="sm">{step.action}</Button>
              </Link>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link to="/sign-in">
          <Button variant="primary">Start the clinic demo</Button>
        </Link>
        <Link to="/clinic/replay">
          <Button variant="quiet">See the number first</Button>
        </Link>
      </div>

      <p className="mt-6 max-w-[70ch] text-[12px] leading-5 text-ink-soft">
        The product is an administrative receipt, not a clinical opinion. The lab flag is reproduced, not interpreted.
        The synthetic cohort is labelled wherever a number appears. The three sentences to say out loud are the
        problem, the one tap, and the number.
      </p>
    </div>
  );
}
