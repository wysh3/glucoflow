import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Badge, Button, Card } from '@glucoflow/ui';
import { SystemPageHeader } from '../../components/system-page-header';
import { CARE_HOME } from '../../lib/clinic-home';

const steps = [
  { title: 'Ask about this shift', to: CARE_HOME, action: 'Open Ask', description: 'Create a workspace and ask what is pending. Open a cited HIS or LIS event from the reply.' },
  { title: 'Inspect an exception', to: `${CARE_HOME}?view=worklist`, action: 'Open Worklist', description: 'Find the specimen awaiting lab receipt. Compare elapsed time with the demo target and inspect the source.' },
  { title: 'Approve monitoring', to: `${CARE_HOME}?view=activity`, action: 'Open Activity', description: 'Open a pending request as the simulated doctor. Review the owner, evidence condition and expiry before approving.' },
  { title: 'Resolve through a source event', to: `${CARE_HOME}?view=worklist#care-simulator`, action: 'Open Simulator', description: 'Expand the hospital simulator, switch to Lab staff, and emit a specimen receipt for the matching order. Inspect the completion evidence.' },
  { title: 'Draft a handover', to: `${CARE_HOME}?view=teams`, action: 'Open Care Teams', description: 'Draft a handover from the current encounter context and export a JSON snapshot for review.' },
  { title: 'Test a workflow change', to: `${CARE_HOME}?view=learning`, action: 'Open Learning', description: 'Propose a source-first handover, run the sandbox tests, and review it as a simulated doctor or coordinator.' },
];

export function ShowcasePage() {
  return (
    <main className="mx-auto w-full max-w-[980px] px-4 py-8 sm:px-6">
      <SystemPageHeader   title="Care workspace walkthrough"
        meta="Explore a synthetic shift through the assistant, worklist, and hospital simulator."
        actions={<Badge tone="primary">Synthetic data</Badge>} />
      <ol className="mt-5 grid gap-3 sm:grid-cols-2">
        {steps.map((step, index) => (
          <li key={step.title}>
            <Card className="flex h-full flex-col items-start p-4 sm:p-5">
              <span className="text-xs font-semibold tabular-nums text-primary" aria-hidden>0{index + 1}</span>
              <h2 className="mt-1 text-base font-semibold">{step.title}</h2>
              <p className="mb-3 mt-1 text-sm leading-relaxed text-ink-soft">{step.description}</p>
              <Button asChild size="sm" className="mt-auto">
                <Link to={step.to}>{step.action} <ArrowRight size={14} aria-hidden /></Link>
              </Button>
            </Card>
          </li>
        ))}
      </ol>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button asChild variant="primary"><Link to={CARE_HOME}>Open care workspace <ArrowRight size={16} aria-hidden /></Link></Button>
        <Button asChild variant="quiet"><Link to="/clinic/results">Open the result ledger</Link></Button>
      </div>
    </main>
  );
}
