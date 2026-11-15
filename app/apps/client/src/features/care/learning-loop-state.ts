import type { CareSkill, CareTask, CareWorkspace } from '@glucoflow/contracts';
import { captureEvidence } from './skill-evidence';

export type LoopStage = 'observe' | 'capture' | 'test' | 'approve' | 'reuse';
export interface LoopState {
  stage: LoopStage;
  confirmed: number;
  capturable: CareTask | undefined;
  draft: CareSkill | undefined;
  active: CareSkill | undefined;
}

/** Derives where the learning loop stands from recorded tasks and skill versions only. */
export function loopState(workspace: CareWorkspace, skills: CareSkill[]): LoopState {
  const confirmed = workspace.tasks.filter((task) => task.status === 'source_confirmed');
  const capturable = confirmed.find((task) => captureEvidence(task, workspace.events));
  const draft = skills.find((skill) => skill.status === 'draft');
  const active = skills.find((skill) => skill.status === 'approved');
  const passed = !!draft && draft.tests.length > 0 && draft.tests.every((item) => item.passed);
  const stage: LoopStage = draft ? (passed ? 'approve' : 'test')
    : active ? 'reuse'
    : capturable ? 'capture' : 'observe';
  return { stage, confirmed: confirmed.length, capturable, draft, active };
}

