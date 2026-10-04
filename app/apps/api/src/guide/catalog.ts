import type {
  GuideRole,
  GuideTopic,
  GuideActionId,
  GuideAnswer,
  GuideScreen,
} from '@glucoflow/contracts';
const entries: Record<GuideTopic, { text: string; actions: GuideActionId[] }> =
  {
    welcome: {
      text: 'I’m Gluco, your app guide. I can help you find records, use samples, understand review steps and move around this workspace. Ask about the app; please leave health details out of chat.',
      actions: ['overview', 'records', 'upload'],
    },
    upload: {
      text: 'Open Add report to upload a PDF or image. The synthetic sample library lets you try the full workflow without finding a document. Uploaded entries appear in the approved record only after clinic review.',
      actions: ['upload', 'samples'],
    },
    review: {
      text: 'A clinic reviewer checks patient identity and every proposed entry against its source. Review, correct or exclude each entry, then publish the supported facts. Patients and doctors without reviewer permission cannot approve.',
      actions: ['queue', 'documents', 'records'],
    },
    publication: {
      text: 'Publication adds reviewed entries to the approved timeline and shows a confirmation with the approval revision. The published review is locked; use Documents & corrections when a later correction is needed.',
      actions: ['overview', 'documents', 'records'],
    },
    sources: {
      text: 'Use Open source beside an entry to see its original report, quoted evidence and page. Source access is temporary; Refresh access renews an expired link. The original document remains the evidence.',
      actions: ['overview', 'documents', 'records'],
    },
    overview: {
      text: 'Visit overview gathers the latest approved measurements, documented prescriptions, examinations and patient-reported notes. Open each source for evidence, or Progression for the full dated record.',
      actions: ['overview', 'progression', 'records'],
    },
    trends: {
      text: 'Progression plots approved, dated measurements. Choose a test and range, compare compatible panels or switch to Table. Gaps are missing records; lines connect recorded values and do not predict outcomes.',
      actions: ['progression', 'records'],
    },
    prescriptions: {
      text: 'Documented prescriptions appear in the visit overview and Progression with dates and source links. A prescription record does not confirm that a medicine is currently taken. Interpretation stays with the clinician.',
      actions: ['overview', 'progression', 'records'],
    },
    notes: {
      text: 'Visit notes are patient-reported statements. Write a note, preview it, then send. To correct one, open Send a corrected version, edit the draft and send the correction; earlier versions remain in history.',
      actions: ['notes', 'overview', 'records'],
    },
    home: {
      text: 'Home readings lets patients enter a glucose reading or report a problem with its own timestamp. These stay patient-reported and separate from approved laboratory facts. Clinic staff can inspect them in Home reports.',
      actions: ['home'],
    },
    snapshot: {
      text: 'The demo SOS button freezes a snapshot for the synthetic clinic desk. Inspect snapshot shows the saved content; Download JSON saves a copy. It does not contact emergency responders or replace emergency services.',
      actions: ['home'],
    },
    history: {
      text: 'History records reviewed changes and actor information for clinic staff. Document amendments and note corrections preserve earlier versions rather than silently replacing the original record.',
      actions: ['history', 'documents', 'records'],
    },
    account: {
      text: 'Account shows your authorized workspace. Switch role signs out of this demo account so you can choose another. Each role has separate permissions; role switching never grants access to another patient’s records.',
      actions: ['account'],
    },
    privacy: {
      text: 'The guide receives app screen and role context, not patient records or source documents. Messages stay in this session and are not saved by Glucoflow. Please do not enter health details or personal information. Model requests use the configured provider.',
      actions: ['account'],
    },
    clinical: {
      text: 'I can help you use Glucoflow, but I cannot diagnose, interpret results or recommend treatment. A qualified clinician should interpret the source records. For immediate danger, contact local emergency services; this demo does not dispatch help.',
      actions: [],
    },
    unsupported: {
      text: 'I can help with Glucoflow navigation, uploads, source review, notes and exports. I cannot change records, approve entries, interpret medical results or answer unrelated questions. Try “Where do I upload a report?” or “How do I open a source?”',
      actions: [],
    },
  };
const labels: Record<GuideActionId, string> = {
  patients: 'Patients',
  overview: 'Visit overview',
  progression: 'Progression',
  documents: 'Documents',
  home: 'Home readings & reports',
  history: 'History',
  queue: 'Review queue',
  records: 'My records',
  upload: 'Add report',
  notes: 'Visit notes',
  account: 'Account',
  samples: 'Try a sample report',
};
export function guideReply(
  topic: GuideTopic,
  role: GuideRole,
): Omit<GuideAnswer, 'mode' | 'model'> {
  const patient = role === 'patient';
  const reviewer = role === 'reviewer' || role === 'clinic';
  const allowed = new Set<GuideActionId>(
    patient
      ? ['records', 'upload', 'notes', 'home', 'account']
      : [
          'patients',
          'overview',
          'progression',
          'documents',
          'home',
          'history',
          'account',
          ...(reviewer ? (['queue', 'samples'] as const) : []),
        ],
  );
  return {
    message: entries[topic].text,
    actions: entries[topic].actions
      .filter((id) => allowed.has(id))
      .map((id) => ({ id, label: labels[id] })),
  };
}
export function clinicalRequest(message: string): boolean {
  return (
    /\b(diagnos\w*|treat(?:ment)?|recommend\w*|prescrib\w*|dosage|dose|cure|prognos\w*|risk\s+score)\b/i.test(
      message,
    ) ||
    /\b(should\s+(?:i|we|the patient)\s+(?:take|stop|start|change)|(?:is|are)\s+(?:my|this|these)\s+(?:result|reading|value).*?(?:normal|safe|dangerous)|do\s+i\s+have|what.*?(?:disease|condition)\s+(?:do|does|is))\b/i.test(
      message,
    )
  );
}
export function localTopic(message: string, screen: GuideScreen): GuideTopic {
  if (clinicalRequest(message)) return 'clinical';
  const rules: [RegExp, GuideTopic][] = [
    [/privacy|personal|chat.*(?:data|save)|provider/i, 'privacy'],
    [/upload|sample|add.*report/i, 'upload'],
    [/approve|review|queue/i, 'review'],
    [/publish|revision/i, 'publication'],
    [/source|original|evidence|pdf/i, 'sources'],
    [/export|summary|overview/i, 'overview'],
    [/trend|chart|range|compare|table/i, 'trends'],
    [/prescription|medication|medicine/i, 'prescriptions'],
    [/note|correct.*note/i, 'notes'],
    [/snapshot|sos|emergency/i, 'snapshot'],
    [/home|reading|symptom|problem/i, 'home'],
    [/history|audit|amend/i, 'history'],
    [/account|sign.?out|switch.*role/i, 'account'],
  ];
  for (const [match, topic] of rules) if (match.test(message)) return topic;
  const screenTopic: Record<GuideScreen, GuideTopic> = {
    landing: 'welcome',
    patients: 'overview',
    overview: 'overview',
    progression: 'trends',
    documents: 'sources',
    review: 'review',
    history: 'history',
    home: 'home',
    records: 'sources',
    upload: 'upload',
    notes: 'notes',
    account: 'account',
  };
  return /help|how|what|where|hello|hi\b/i.test(message)
    ? screenTopic[screen]
    : 'unsupported';
}
