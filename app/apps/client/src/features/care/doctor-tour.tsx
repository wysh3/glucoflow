import type { TourStep } from './tour';

export const DOCTOR_TOUR_QUESTION = 'What needs my attention this shift? Include source references.';

export function doctorTourSteps({ askQuestion, openEncounters }: { askQuestion: () => void; openEncounters: () => void }): TourStep[] {
  return [
    {
      id: 'welcome', title: 'Your diabetes unit shift starts now',
      body: <>
        <p>In about three minutes you will see how GlucoFlow keeps work between doctors, nurses and the lab from falling through the cracks.</p>
        <ul>
          <li>See which samples and results are stuck, and why</li>
          <li>Watch the lab system close a task with <strong>evidence</strong></li>
          <li>Ask Gluco in plain language and hand over safely</li>
        </ul>
        <p>All patients are fictional. Gluco coordinates work; clinical decisions stay with you.</p>
      </>,
    },
    {
      id: 'glance', target: 'shift-glance', title: 'Your shift in four numbers',
      body: <>
        <p><strong>Red:</strong> samples past their local target, or results the lab has corrected.</p>
        <p><strong>Amber:</strong> validated results still waiting for a clinician to acknowledge them.</p>
        <p>Every number is counted from recorded hospital (HIS) and lab (LIS) events, never estimated.</p>
      </>,
    },
    {
      id: 'board', target: 'board-first-row', title: 'The unit board, most urgent first',
      body: <>
        <p>Each row is one patient. The five bars show where the sample is right now: <strong>ordered → collected → at lab → result → acknowledged</strong>.</p>
        <p>The striped bar is the step that has not happened yet. If no event arrives, it stays unknown; Gluco never assumes it happened. Nobody had to phone the lab to find this out.</p>
      </>,
    },
    {
      id: 'feed', target: 'feed-button', advanceOn: 'feed-receipt', actionHint: 'Click the highlighted Simulate button',
      title: 'Now, play the hospital lab',
      body: <>
        <p>In a hospital, the lab system (LIS) sends this event when the specimen arrives. Here, you send it.</p>
        <p>It is recorded by a fictional lab technician because the server only accepts lab events from the lab role.</p>
      </>,
    },
    {
      id: 'evidence', target: 'feed-receipt', title: 'Closed by evidence, not by a tick-box',
      body: <>
        <p>The matching source event arrived, so the follow-up task closed by itself and the board moved on.</p>
        <p>Select <strong>View source</strong> to see the exact LIS reference, time and who recorded it. Reports can tell what the system confirmed apart from what a person attested.</p>
      </>,
    },
    {
      id: 'corrected', target: 'board-corrected', title: 'A corrected result reopens the work',
      body: <>
        <p>This potassium result was already acknowledged. Then the lab issued a <strong>corrected result</strong>.</p>
        <p>Gluco does not trust the old acknowledgement. The new version needs its own, so the case moves back to the top of the board.</p>
      </>,
    },
    {
      id: 'pipeline', target: 'pipeline-button', title: 'One patient, every team',
      body: <>
        <p>Open <strong>Pipeline</strong> to follow one order across clinical, nursing, laboratory and coordination lanes.</p>
        <p>Selecting a step shows its source, time and who recorded it, plus who owns the next step.</p>
      </>,
    },
    {
      id: 'ask', target: 'composer', title: 'Ask in plain language',
      body: <>
        <p>Ask Gluco what you would ask a colleague. It answers from this workspace's records only, with source links you can check.</p>
        <p>Use the button to write a starter question, then press <strong>Enter</strong> to send.</p>
      </>,
      actions: [{ label: 'Write a question for me', run: askQuestion, primary: true }],
    },
    {
      id: 'persona', target: 'persona', title: 'See it from the nurse or the lab',
      body: <>
        <p>Switch to a fictional nurse or lab technician. Each role gets its own queue and can only record its own events.</p>
        <p>A soft "seen it" from a nurse is kept separate from real completion.</p>
      </>,
    },
    {
      id: 'done', title: 'That is the whole loop',
      body: <>
        <ul>
          <li><strong>Evidence:</strong> every status comes from a recorded source event</li>
          <li><strong>Ownership:</strong> every open step has a named owner</li>
          <li><strong>Handover:</strong> reviewed, versioned and received by a named colleague</li>
        </ul>
        <p>GlucoFlow does not diagnose, prescribe, score risk or close work without evidence.</p>
      </>,
      actions: [{ label: 'Prepare a handover', run: openEncounters }],
    },
  ];
}
