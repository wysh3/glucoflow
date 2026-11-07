import type { CareSkillPattern } from '@glucoflow/contracts';
import { ApiError } from '../errors';

/** Data-only, allowlisted behavior. Never executable code or patient text. */
export interface SkillArtifact {
  schemaVersion: 1;
  engineRevision: 'source-chain-v1';
  pattern: CareSkillPattern;
  durationMinutes: 30;
  requiresFreshFeeds: true;
  requiresHumanApproval: true;
  completion: 'matching-source-event';
  cancellation: 'stop';
}

export function createSkillArtifact(pattern: CareSkillPattern): SkillArtifact {
  return {
    schemaVersion: 1, engineRevision: 'source-chain-v1', pattern, durationMinutes: 30,
    requiresFreshFeeds: true, requiresHumanApproval: true,
    completion: 'matching-source-event', cancellation: 'stop',
  };
}

export function validateSkillArtifact(value: unknown, pattern: CareSkillPattern): SkillArtifact {
  const expected = createSkillArtifact(pattern);
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).length !== Object.keys(expected).length ||
      Object.entries(expected).some(([key, entry]) => (value as Record<string, unknown>)[key] !== entry)) {
    throw ApiError.conflict('This skill artifact is unsupported or changed. Capture and test a new version.', 'skill_artifact_invalid');
  }
  return value as SkillArtifact;
}
