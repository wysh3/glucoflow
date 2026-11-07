import { describe, expect, it } from 'vitest';
import { createSkillArtifact, validateSkillArtifact } from './skill-artifact';

describe('governed data-only skill artifacts', () => {
  it.each(['specimen_receipt', 'result_acknowledgement'] as const)('accepts the supported %s artifact', (pattern) => {
    const artifact = createSkillArtifact(pattern);
    expect(validateSkillArtifact(artifact, pattern)).toBe(artifact);
  });
  it.each([
    { engineRevision: 'future-engine' }, { requiresHumanApproval: false },
    { durationMinutes: 300 }, { pattern: 'result_acknowledgement' },
    { completion: 'model-says-done' }, { code: 'execute-anything' },
  ])('fails closed for changed or unrecognized semantics %j', (changes) => {
    expect(() => validateSkillArtifact({ ...createSkillArtifact('specimen_receipt'), ...changes }, 'specimen_receipt'))
      .toThrow('unsupported or changed');
  });
  it('does not treat a missing historical artifact as the current default', () => {
    expect(() => validateSkillArtifact(null, 'specimen_receipt')).toThrow('unsupported or changed');
  });
});
