import { z } from 'zod';
import {
  GUIDE_TOPICS,
  type GuideAnswer,
  type GuideRole,
  type GuideScreen,
} from '@glucoflow/contracts';
import { clinicalRequest, guideReply, localTopic } from './catalog';
import { createGuidePlanner, type GuideConfig } from './planner';
import { GUIDE_HELP_PROMPT } from './prompts';

const classified = z.strictObject({ topic: z.enum(GUIDE_TOPICS) });

/** Model classifies a help intent. Only application-owned copy and actions leave this boundary. */
export function createGuideService(config: GuideConfig) {
  const planner = createGuidePlanner(config);
  return {
    async answer(input: {
      role: GuideRole;
      screen: GuideScreen;
      message: string;
    }): Promise<GuideAnswer> {
      if (clinicalRequest(input.message)) {
        return { ...guideReply('clinical', input.role), mode: 'local' };
      }
      const result = await planner.plan(GUIDE_HELP_PROMPT, {
        role: input.role, screen: input.screen, question: input.message,
      }, 120, classified);
      return result
        ? { ...guideReply(result.data.topic, input.role), mode: 'live', model: result.model }
        : { ...guideReply(localTopic(input.message, input.screen), input.role), mode: 'local' };
    },
  };
}
