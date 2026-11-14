import type { TourStep, TourStepContext } from './engine';

export type TourId = 'quick' | 'full';
export const TOUR_QUESTION = 'What needs my attention this shift? Include source references.';

const CARE = '/clinic/care';
const care = (context: TourStepContext) => context.care();
/** Every care step starts from a clean desk unless it opens its own view or dialog. */
const desk = (view: Parameters<NonNullable<ReturnType<TourStepContext['care']>>['openView']>[0] = 'ask') =>
  (context: TourStepContext) => { care(context)?.closeAll(); care(context)?.openView(view); };
const careStep = (step: Omit<TourStep, 'route' | 'needsCare'>): TourStep => ({ route: CARE, needsCare: true, enter: desk(), ...step });

function clickButton(scope: string, text: RegExp) {
  const root = document.querySelector(scope);
  const button = Array.from(root?.querySelectorAll<HTMLElement>('button, a') ?? []).find((node) => text.test(node.textContent ?? ''));
  button?.click();
}

export const chapters = [
  { id: 'glance', title: 'Shift at a glance', summary: 'Unit board, live lab event, corrected results' },
  { id: 'ask', title: 'Ask Gluco', summary: 'Plain-language answers with evidence' },
  { id: 'pipeline', title: 'Follow one patient', summary: 'Pipeline across teams and the episode view' },
  { id: 'approval', title: 'Nothing runs unapproved', summary: 'Worklist, task approval, shift monitoring' },
  { id: 'handover', title: 'Handover with receipt', summary: 'Versioned handover, named recipient' },
  { id: 'roles', title: 'Every role, its own work', summary: 'Nurse shift and lab queue views' },
  { id: 'learning', title: 'Learning, governed', summary: 'Care routines, activity, history' },
  { id: 'records', title: 'Patient records', summary: 'Approved results, trends, report review' },
  { id: 'trust', title: 'Under the hood', summary: 'Architecture and server-enforced rules' },
] as const;

// ——— Shared steps ———
const glance = careStep({
  id: 'glance', chapter: 'Shift at a glance', target: 'shift-glance', title: 'Your shift in four numbers',
  body: <>
    <p><strong>Red:</strong> samples past their local target, or results the lab corrected after someone acknowledged them.</p>
    <p><strong>Amber:</strong> validated results still waiting for a clinician.</p>
    <p>Every number is counted from recorded hospital (HIS) and lab (LIS) events. Nothing is estimated.</p>
  </>,
});
const board = careStep({
  id: 'board', chapter: 'Shift at a glance', target: 'board-first-row', title: 'A ward board that updates itself',
  body: <>
    <p>One row per patient, most urgent first. The five bars show where the sample is now: <strong>ordered → collected → at lab → result → acknowledged</strong>.</p>
    <p>The striped bar is the step still missing. With no event, it stays unknown. Nobody had to phone the lab to learn this.</p>
  </>,
});
const feed = careStep({
  id: 'feed', chapter: 'Shift at a glance', target: 'feed-button', advanceOn: 'feed-receipt', actionHint: 'Click the highlighted Simulate button',
  title: 'Now, play the hospital lab',
  body: <>
    <p>In a hospital this event comes from the lab system when the specimen arrives. Here, you send it.</p>
    <p>A fictional lab technician records it, because the server only accepts lab events from the lab role.</p>
  </>,
});
const evidence = careStep({
  id: 'evidence', chapter: 'Shift at a glance', target: 'feed-receipt', enter: () => undefined, title: 'Closed by evidence, not a tick-box',
  body: <>
    <p>The matching source event arrived, so the follow-up closed by itself and the patient moved down the board.</p>
    <p><strong>View source</strong> shows the exact LIS reference, time and who recorded it. Reports keep system-confirmed and person-attested work apart.</p>
  </>,
});
const corrected = careStep({
  id: 'corrected', chapter: 'Shift at a glance', target: 'board-corrected', title: 'A corrected result reopens the work',
  body: <>
    <p>This potassium was acknowledged an hour ago. Then the lab issued a <strong>corrected result</strong>.</p>
    <p>Gluco does not trust the old acknowledgement. The new version needs its own, so the case is back at the top.</p>
  </>,
});
const assistantReplies = () => document.querySelectorAll('li.conversation-item[data-role="assistant"]').length;
async function askAndWait(context: TourStepContext) {
  const before = assistantReplies();
  care(context)?.askQuestion(TOUR_QUESTION, true);
  for (let i = 0; i < 180; i++) {
    await new Promise((resolve) => window.setTimeout(resolve, 500));
    const pending = document.querySelector('li.conversation-item[data-role="assistant"] [role="status"]');
    if (assistantReplies() > before && !pending) { context.goTo('reply'); return; }
  }
}
const ask = careStep({
  id: 'ask', chapter: 'Ask Gluco', target: 'composer', title: 'Ask the way you would ask a colleague',
  body: <>
    <p>Gluco answers from this workspace's records only, and shows its progress while it works. You can stop a reply at any time.</p>
    <p>Type your own question, or let the tour ask one and wait for the answer. Speech input and read-aloud are on the composer too.</p>
  </>,
  actions: [{ label: 'Ask for me', primary: true, run: askAndWait }],
});
const reply = careStep({
  id: 'reply', chapter: 'Ask Gluco', target: 'css-last:li.conversation-item[data-role="assistant"]', enter: () => undefined,
  title: 'Every answer shows its evidence',
  body: <>
    <p>Each patient line links to the source events behind it. Gluco can cite only records that exist in this workspace; the server rejects anything else.</p>
    <p>It never diagnoses or recommends treatment, and it can only <strong>propose</strong> work. A person approves it.</p>
  </>,
});
const pipeline = careStep({
  id: 'pipeline', chapter: 'Follow one patient', target: 'dialog:Care pipeline',
  enter: (context) => { care(context)?.closeAll(); care(context)?.openPipeline(); },
  title: 'One order, every team',
  body: <>
    <p>Clinical, nursing, laboratory and coordination lanes for one order. Select any step to see its source, time, who recorded it and who owns what comes next.</p>
    <p>Missing steps say <strong>unknown</strong> instead of guessing.</p>
  </>,
});

// ——— Quick tour ———
const quick: TourStep[] = [
  {
    ...careStep({ id: 'quick-welcome', title: 'Your diabetes unit shift starts now', body: null }),
    body: <>
      <p>In about three minutes you will see how GlucoFlow stops work between doctors, nurses and the lab from falling through the cracks.</p>
      <ul>
        <li>See what is stuck, and why</li>
        <li>Watch the lab system close a task with <strong>evidence</strong></li>
        <li>Ask Gluco in plain language</li>
      </ul>
      <p>All patients are fictional. Gluco coordinates work; clinical decisions stay with you.</p>
    </>,
    actions: [{ label: 'Full A–Z tour instead', run: (context) => context.start('full') }],
  },
  glance, board, feed, evidence, corrected, pipeline,
  { ...ask, actions: [{ label: 'Write a question for me', primary: true, run: (context) => care(context)?.askQuestion(TOUR_QUESTION, false) }] },
  careStep({
    id: 'quick-done', title: 'That is the core loop',
    body: <>
      <ul>
        <li><strong>Evidence:</strong> every status comes from a recorded source event</li>
        <li><strong>Ownership:</strong> every open step has a named owner</li>
        <li><strong>Control:</strong> nothing runs without a person approving it</li>
      </ul>
      <p>The full tour adds approval, handover, other roles, learning, patient records and the architecture.</p>
    </>,
    actions: [{ label: 'Continue: full tour', primary: true, run: (context) => context.start('full', 'reply') }],
  }),
];

// ——— Full A–Z tour ———
const full: TourStep[] = [
  careStep({
    id: 'full-welcome', title: 'GlucoFlow from A to Z',
    body: (context) => <>
      <p>About ten minutes, nine short chapters, all with fictional patients. Jump to any chapter, or press Next to start at the top.</p>
      <div className="gf-tour-chapters">
        {chapters.map((chapter, index) => <button key={chapter.id} type="button" onClick={() => context.goTo(chapter.id)}>
          <strong>{index + 1}. {chapter.title}</strong><span>{chapter.summary}</span>
        </button>)}
      </div>
    </>,
  }),
  glance, board, feed, evidence, corrected,
  ask, reply,
  pipeline,
  careStep({
    id: 'episode', chapter: 'Follow one patient', target: 'dialog:Episode',
    enter: (context) => { care(context)?.closeAll(); care(context)?.openEpisode('Dev Mehta'); },
    title: 'The episode: everything about one patient',
    body: <>
      <p>Documented context from the HIS, each order's evidence chain, open tasks and their owners, in one place.</p>
      <p>Context lines are what the hospital system recorded. GlucoFlow never adds its own clinical interpretation.</p>
    </>,
  }),
  careStep({
    id: 'approval', chapter: 'Nothing runs unapproved', target: 'css:.care-working-pane', enter: desk('worklist'),
    title: 'The worklist: what needs attention',
    body: <>
      <p>Exceptions first: samples past their target with the elapsed time. Below, every operational task with its state and owner.</p>
      <p>States are honest: <strong>Awaiting approval</strong>, <strong>Monitoring</strong>, <strong>Source confirmed</strong> or <strong>Human attested</strong>. They are never mixed together.</p>
    </>,
  }),
  careStep({
    id: 'approve-task', chapter: 'Nothing runs unapproved', target: 'css:[role="dialog"][data-state="open"]',
    enter: (context) => { care(context)?.closeAll(); care(context)?.openView('worklist'); care(context)?.openTask('awaiting_approval'); },
    title: 'You approve the scope, the owner and the expiry',
    body: <>
      <p>A proposed monitoring task names the exact order, the evidence that would close it, its owner and when it stops.</p>
      <p>Until a doctor or coordinator approves it, nothing is watched. Approving does not acknowledge any result.</p>
    </>,
  }),
  careStep({
    id: 'monitoring', chapter: 'Nothing runs unapproved', target: 'dialog:Shift monitoring',
    enter: (context) => { care(context)?.closeAll(); care(context)?.openMonitoring(); },
    title: 'Delegate a whole shift, within limits',
    body: <>
      <p>Pick the patients, one rule (validated results awaiting acknowledgement, or specimen receipt), the named recipients and an absolute expiry.</p>
      <p>The scope is versioned. Editing it clears the approval, and you can pause or stop it at any time. Background checks use source events only.</p>
    </>,
  }),
  careStep({
    id: 'handover', chapter: 'Handover with receipt', target: 'css:#shift-handover', enter: desk('teams'),
    title: 'A handover someone actually receives',
    body: <>
      <p>Gluco drafts the handover from unresolved work and its sources. You edit it; every edit is a new immutable version.</p>
      <p>Share it with a <strong>named colleague</strong>. Their receipt records the exact version they saw. Clinical responsibility does not silently move.</p>
    </>,
    actions: [{ label: 'Prepare one', run: () => clickButton('#shift-handover', /Prepare handover/) }],
  }),
  careStep({
    id: 'roles', chapter: 'Every role, its own work', target: 'css:.care-working-pane',
    enter: async (context) => { care(context)?.closeAll(); await care(context)?.switchPersona('nurse'); care(context)?.openView('worklist'); },
    title: 'The nurse sees "My shift"',
    body: <>
      <p>You are now Anita Joseph, a fictional emergency nurse. Her queue shows specimens to collect and source exceptions.</p>
      <p>A nurse can mark "seen it" (a <strong>soft acknowledgement</strong>), but that never counts as completion. Only the source event does.</p>
    </>,
  }),
  careStep({
    id: 'lab', chapter: 'Every role, its own work', target: 'css:.care-working-pane',
    enter: async (context) => { care(context)?.closeAll(); await care(context)?.switchPersona('lab'); care(context)?.openView('worklist'); },
    title: 'The lab sees its own queue',
    body: <>
      <p>Priya Shah, laboratory: expected specimens, received ones, and validated results.</p>
      <p>Processing that was never recorded is shown as <strong>unverified</strong>, not assumed. Each role can record only its own events.</p>
    </>,
  }),
  careStep({
    id: 'persona', chapter: 'Every role, its own work', target: 'persona',
    enter: async (context) => { care(context)?.closeAll(); await care(context)?.switchPersona('doctor'); care(context)?.openView('ask'); },
    title: 'Back to Dr Mira Rao',
    body: <>
      <p>Switch people here at any time. In a real shared workspace each person signs in, and authority comes from their own account; the switch is a demo convenience.</p>
    </>,
  }),
  careStep({
    id: 'learning', chapter: 'Learning, governed', target: 'css:.care-working-pane', enter: desk('learning'),
    title: 'Care routines: learning without losing control',
    body: <>
      <p>A task that closed with source evidence can become a reusable <strong>Care routine</strong>, a fixed operational pattern rather than a clinical rule.</p>
      <p>Each version runs sandbox tests and needs clinician approval before reuse, and you can roll it back. Applying it to another patient still needs that patient's own evidence and a new approval.</p>
    </>,
  }),
  careStep({
    id: 'activity', chapter: 'Learning, governed', target: 'css:.care-working-pane', enter: desk('activity'),
    title: 'An activity log of every change',
    body: <><p>Approvals, events, persona switches and monitoring, each with an actor and a time. Your actions from this tour are already here.</p></>,
  }),
  careStep({
    id: 'history', chapter: 'Learning, governed', target: 'dialog:Workspace history',
    enter: (context) => { care(context)?.closeAll(); care(context)?.openHistory(); },
    title: 'Append-only history',
    body: <><p>Every saved revision is kept with its source evidence. Opening an older revision never changes current work, and concurrent edits are refused rather than overwritten.</p></>,
  }),
  {
    id: 'records', chapter: 'Patient records', route: '/clinic/patients', routeTo: '/clinic/patients', target: 'css:main table',
    advanceOn: 'path:^/clinic/patients/[^/]+/', actionHint: 'Open a patient with records',
    title: 'Outpatient records, reviewed by people',
    body: <>
      <p>Lab reports uploaded by patients or the clinic are read into draft values with their page evidence. <strong>Nothing reaches the chart until a person approves it.</strong></p>
      <p>Open Asha Rao, the fictional patient with a full history.</p>
    </>,
    actions: [{ label: 'Open Asha Rao', primary: true, run: async (context) => {
      // Patients with records are listed first; wait briefly for the list, then open the first through its own link.
      for (let attempt = 0; attempt < 40; attempt++) {
        const link = Array.from(document.querySelectorAll<HTMLAnchorElement>('main tr a'))
          .find((node) => /Open patient/.test(node.textContent ?? '') && node.getClientRects().length > 0);
        if (link) { context.navigate(new URL(link.href).pathname); return; }
        await new Promise((resolve) => window.setTimeout(resolve, 150));
      }
    } }],
  },
  {
    id: 'overview', chapter: 'Patient records', route: '/clinic/patients/', target: 'css:main',
    title: 'One visit overview',
    body: <>
      <p>Latest approved measurements with units and dates, documented prescriptions and examinations, and the patient's own notes. Each one has <strong>Open source</strong>.</p>
      <p>Prescriptions are labelled as documented history, not proof of current use. Missing records are never read as "not done".</p>
    </>,
  },
  {
    id: 'progression', chapter: 'Patient records', route: '/clinic/patients/', target: 'css:main .recharts-wrapper',
    routeTo: () => null,
    enter: (context) => { if (!window.location.pathname.endsWith('/progression')) context.navigate(window.location.pathname.replace(/\/[^/]+$/, '/progression')); },
    title: 'Trends you can trace back',
    body: <>
      <p>HbA1c, glucose, kidney markers and blood pressure over time, with true date spacing and a table equivalent.</p>
      <p>Every point opens the report page it came from. There is no risk score, prediction or filled-in missing value.</p>
    </>,
  },
  {
    id: 'queue', chapter: 'Patient records', route: '/clinic/queue', target: 'css:main',
    title: 'The review queue',
    body: <>
      <p>Each upload shows its state: processing, awaiting review, could not finish, or <strong>identity blocked</strong> when a report's patient details do not match.</p>
      <p>Reviewers approve value by value. A stale review is refused instead of overwriting someone else's decision.</p>
    </>,
  },
  {
    id: 'trust', chapter: 'Under the hood', route: '/how-it-works', target: 'css:.hiw-arch',
    title: 'Real software, simulated hospital',
    body: <>
      <p>A live web app, API, worker, assistant runtime and PostgreSQL database, deployed on Vercel, Azure and Supabase in India.</p>
      <p>Only the hospital feeds and the patients are simulated.</p>
    </>,
  },
  {
    id: 'rules', chapter: 'Under the hood', route: '/how-it-works', target: 'css:.hiw-grid',
    title: 'Rules the server enforces',
    body: <><p>Role-gated events, evidence-based closure, corrections that reopen work, approval before monitoring, append-only history and database-level isolation. Each one holds whatever the screen shows.</p></>,
  },
  {
    id: 'full-done', chapter: 'Done', route: '/how-it-works', title: 'You have seen all of GlucoFlow',
    body: <>
      <p>Evidence instead of assumptions, named ownership instead of chasing, and human approval for every action.</p>
      <p>Explore freely, try the patient view from the home page, or retake any chapter from the <strong>Tour</strong> button.</p>
    </>,
    actions: [{ label: 'Back to the care desk', primary: true, run: (context) => { context.stop(); context.navigate(CARE); } }],
  },
];

export const tours: Record<TourId, TourStep[]> = { quick, full };
