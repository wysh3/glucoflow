import { CheckCircle2, Eye, FlaskConical, GitPullRequest, Repeat, ShieldCheck } from 'lucide-react';
import { Button } from '@glucoflow/ui';
import type { CareSkill, CareTask, CareWorkspace } from '@glucoflow/contracts';
import type { LoopStage, LoopState } from './learning-loop-state';
import './learning-loop.css';

const stages: { id: LoopStage; label: string; icon: typeof Eye; text: string }[] = [
  { id: 'observe', label: 'Observe', icon: Eye, text: 'A task closes because the hospital system recorded the outcome.' },
  { id: 'capture', label: 'Capture', icon: GitPullRequest, text: 'That workflow becomes a draft routine, with no patient details.' },
  { id: 'test', label: 'Test', icon: FlaskConical, text: 'Sandbox cases check it before anyone can use it.' },
  { id: 'approve', label: 'Approve', icon: ShieldCheck, text: 'A clinician approves the version. Nothing is reused before that.' },
  { id: 'reuse', label: 'Reuse', icon: Repeat, text: 'Another patient gets it, checked against that patient’s own evidence.' },
];

export function LearningLoop({ workspace, state, busy, canReview, onCapture, onTest, onApprove, onReuse, capturing }: {
  workspace: CareWorkspace; state: LoopState; busy: boolean; canReview: boolean; capturing: boolean;
  onCapture: (task: CareTask) => void; onTest: (skill: CareSkill) => void; onApprove: (skill: CareSkill) => void; onReuse: (skill: CareSkill) => void;
}) {
  const current = stages.findIndex((stage) => stage.id === state.stage);
  const patient = (task: CareTask) => workspace.encounters.find((item) => item.id === task.encounterId)?.patientName ?? 'a patient';
  const action = (() => {
    switch (state.stage) {
      case 'observe': return { note: 'Close a task with source evidence first, for example with the Simulate buttons on the unit board.', button: null };
      case 'capture': return state.capturable ? {
        note: `“${state.capturable.title}” for ${patient(state.capturable)} closed by source evidence. Turn it into a reusable routine.`,
        button: <Button type="button" size="sm" variant="primary" disabled={busy || capturing} onClick={() => onCapture(state.capturable!)}>
          <GitPullRequest size={14} aria-hidden /> {capturing ? 'Capturing…' : 'Capture this workflow'}</Button>,
      } : { note: '', button: null };
      case 'test': return {
        note: `${state.draft!.title} · v${state.draft!.version} is a draft. Run its sandbox cases.`,
        button: state.draft!.canTest ? <Button type="button" size="sm" variant="primary" disabled={busy} onClick={() => onTest(state.draft!)}>
          <FlaskConical size={14} aria-hidden /> Run sandbox tests</Button> : null,
      };
      case 'approve': return {
        note: `All ${state.draft!.tests.length} sandbox cases passed for v${state.draft!.version}. It waits for a clinician.`,
        button: canReview ? <Button type="button" size="sm" variant="primary" disabled={busy} onClick={() => onApprove(state.draft!)}>
          <ShieldCheck size={14} aria-hidden /> Review and approve</Button> : null,
      };
      case 'reuse': return {
        note: `${state.active!.title} · v${state.active!.version} is approved for this clinic. Preview it on another patient; it still needs that patient’s evidence and a new approval.`,
        button: <Button type="button" size="sm" variant="primary" disabled={busy} onClick={() => onReuse(state.active!)}>
          <Repeat size={14} aria-hidden /> Preview on another patient</Button>,
      };
    }
  })();

  return <section className="gf-loop" aria-label="Learning loop" data-tour="learning-loop">
    <div className="gf-loop-head">
      <p className="gf-loop-kicker">Governed learning loop</p>
      <h3>GlucoFlow learns your team’s workflows as reusable skills</h3>
      <p>It learns workflows, never diagnoses. Every skill has a version, tests, an approving clinician and an off-switch.</p>
    </div>
    <ol className="gf-loop-track" style={{ ['--fill' as string]: `${(current / (stages.length - 1)) * 100}%` }}>
      {stages.map((stage, index) => {
        const Icon = stage.icon;
        const status = index < current ? 'done' : index === current ? 'now' : 'next';
        return <li key={stage.id} data-status={status} aria-current={status === 'now' ? 'step' : undefined}>
          <span className="gf-loop-node">{status === 'done' ? <CheckCircle2 size={18} aria-hidden /> : <Icon size={18} aria-hidden />}</span>
          <strong>{stage.label}{stage.id === 'observe' && state.confirmed ? <em> · {state.confirmed}</em> : null}</strong>
          <span>{stage.text}</span>
        </li>;
      })}
    </ol>
    <p className="gf-loop-return" aria-hidden><Repeat size={12} /> New evidence starts the next version</p>
    {action.note ? <div className="gf-loop-action" role="status">
      <p>{action.note}</p>
      {action.button}
    </div> : null}
  </section>;
}
