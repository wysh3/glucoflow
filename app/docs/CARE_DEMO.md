# Try GlucoFlow care

Open https://glucoflow.vercel.app, choose **Try the clinic demo**, then **Create workspace**. You can explore freely; the steps below are a short route through the main capabilities. All encounters and hospital events are synthetic. New workspaces keep different testers' exercises separate, but the public demo sign-ins are shared identities, not private accounts for real records.

## Ask and inspect

In **Ask GlucoFlow**, keep **Hermes live** selected when the runtime is connected. Ask: “Show the latest recorded events for all orders.” The response can include an interactive evidence card. Choose an encounter, inspect its source event, then switch to **Monitoring status**. The response identifies its engine. If Hermes is unavailable or its configured call budget is reached, deliberately select **Deterministic helper** to continue without model calls.

## Close a handoff using evidence

1. Open **My Worklist** and review Asha Shah's specimen receipt task.
2. Choose **Approve monitoring**, then confirm. Approval alone leaves the task monitoring.
3. Open **Hospital simulator**, choose **Nurse**, keep Asha selected, and emit the specimen collection event.
4. Switch the simulation role to **Lab staff** and emit the specimen receipt event.
5. Open **My Activity** or filter the worklist to completed tasks. The task is now source-confirmed, with the exact LIS receipt attached.

Try disconnecting LIS first. The app should show unknown source status, not infer that a missing receipt means completion. Human attestation is a separately named action with a required reason; it does not create a source receipt. Pause, resume, cancellation, expiry and corrections preserve their history.

## Review a workflow improvement

After completing Asha's specimen receipt, open that task and capture its operational skill. **Workflow learning → Skill library** holds the draft, its source-confirmed origin, scope, stop conditions and test results. Run the skill tests, then approve it using an account with actual clinic clinician membership. Changing the simulator role alone does not grant skill publication authority.

Create a new fictional encounter in **My Care Teams**, add an order as Doctor and record its specimen collection as Nurse. Return to the skill library, preview the approved receipt skill against that new order, inspect its own collection evidence and create the proposed task. Approve monitoring separately. Finally, emit a matching LIS receipt as Lab staff. The new task closes on the new encounter's receipt, never on Asha's earlier receipt.

Try an order without collection, a disconnected feed or an already-covered order: the preview should explain why it cannot apply. Retire the version to block future applications; restore an earlier version to record a versioned rollback.

These are two fixed operational patterns—specimen receipt and result acknowledgement—not newly invented medical procedures. Capture does not copy patient notes into the shared library, rewrite clinical rules or train a model. Sandbox checks exercise matching evidence, a wrong stage, mismatched encounter/order, unavailable feed and cancellation. Full clinical governance and measured improvement remain future work.

**Handover layout preferences** remains a separate section. Propose an evidence-first layout, test and approve it, then draft a handover. This changes presentation order and is not a learned care procedure.

## Explore beyond the walkthrough

Open an encounter's episode to inspect its context, tasks and sources together. Prepare a static appointment logistics message with a manually selected date and location; approve the demo preview and verify that no message is sent. Export a JSON snapshot to inspect events, task links and version history. Create a new workspace to restart, then use **Saved workspaces** to return to the earlier exercise.

**Patient records** provides the longitudinal record and report review workflow. **Result closure** contains clinician review, patient calls, lab intake and the closure register. These cohorts and tasks are separate from the inpatient simulation. A patient demo account can upload and view its own records; it cannot open the clinic care workspace.

## What this proves

The useful demonstration is the whole operational loop: ask with source evidence, propose bounded work, approve it, wait for an independently emitted matching event, and inspect the recorded completion. OpenUI makes cited data interactive; Hermes provides the agent loop; the GlucoFlow application owns authority and persistence.

Hospital feeds and team-role changes are a simulator. There is no live HIS/LIS connector, autonomous treatment, real notification dispatch or production care-team collaboration. Monitoring reconciles on reads and commands, with periodic refresh while the app is visible. Android builds contain the same client, but physical-device behavior requires a device check.
