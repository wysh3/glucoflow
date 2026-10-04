import { z } from 'zod';
export const GUIDE_SCREENS = [
  'landing',
  'patients',
  'overview',
  'progression',
  'documents',
  'review',
  'history',
  'home',
  'records',
  'upload',
  'notes',
  'account',
] as const;
export const GUIDE_TOPICS = [
  'welcome',
  'upload',
  'review',
  'publication',
  'sources',
  'overview',
  'trends',
  'prescriptions',
  'notes',
  'home',
  'snapshot',
  'history',
  'account',
  'privacy',
  'clinical',
  'unsupported',
] as const;
export type GuideScreen = (typeof GUIDE_SCREENS)[number];
export type GuideTopic = (typeof GUIDE_TOPICS)[number];
export type GuideRole = 'patient' | 'reviewer' | 'clinician' | 'clinic';
export type GuideActionId =
  | 'patients'
  | 'overview'
  | 'progression'
  | 'documents'
  | 'home'
  | 'history'
  | 'queue'
  | 'records'
  | 'upload'
  | 'notes'
  | 'account'
  | 'samples';
export type GuideAnswer = {
  message: string;
  actions: { id: GuideActionId; label: string }[];
  mode: 'live' | 'local';
  model?: 'gpt-6-luna';
};
export const guideRequestSchema = z
  .object({
    screen: z.enum(GUIDE_SCREENS),
    message: z.string().trim().min(1).max(600),
  })
  .strict();

export const guideChatRequestSchema = z
  .object({
    screen: z.enum(GUIDE_SCREENS),
    patientId: z.string().uuid(),
    message: z.string().trim().min(1).max(600),
    history: z.array(z.string().trim().min(1).max(600)).max(6).default([]),
  })
  .strict();
export type GuideChatRequest = z.infer<typeof guideChatRequestSchema>;
export type GuideCard = {
  id: string;
  kind: 'approved' | 'reported';
  title: string;
  detail: string;
  date: string | null;
  dateLabel: string;
  source?: {
    documentId: string;
    versionId: string;
    page: number;
    quote: string;
    bbox: [number, number, number, number] | null;
  };
};
export type GuideChatAnswer = GuideAnswer & {
  patient: { patientId: string; displayName: string; clinicIdentifier: string };
  cards: GuideCard[];
  suggestions: string[];
  scopeNote: string;
};
