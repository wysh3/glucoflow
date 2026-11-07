import type { CareEvent, CareMessage, CareWorkspace } from '@glucoflow/contracts';

export function careSummaryPresentation(message: CareMessage) {
  if (message.role !== 'assistant' || (message.languageCode && message.languageCode !== 'en-IN') ||
      !(/^(?:Draft handover[^\n]*\n)?Synthetic workspace snapshot\./).test(message.content)) return null;
  const stale = ['HIS', 'LIS'].filter((feed) => message.content.includes(`The ${feed} feed is stale.`));
  return {
    lead: message.content.startsWith('Draft handover')
      ? 'Here is the handover outline, with each owner and the latest recorded evidence. Review the draft before sharing.'
      : 'Here are the latest recorded updates. Open an encounter to inspect its evidence.',
    warning: stale.length ? `${stale.join(' and ')} updates were out of date when this reply was prepared. Missing events remain unverified.` : null,
  };
}

// The renderer reads transport markers before parsing OpenUI string literals.
const literal = (value: string) => JSON.stringify(value).replaceAll(']]>', ']]\\u003e');

/** Compile only links resolvable within the authorized workspace response. */
export function compileCareReply(message: CareMessage, workspace: CareWorkspace) {
  if (message.role !== 'assistant') return null;

  const encounters = new Map(workspace.encounters.map((encounter) => [encounter.id, encounter]));
  const orders = new Map(workspace.orders.map((order) => [order.id, order]));
  const events = new Map(workspace.events.map((event) => [event.id, event]));
  const citedEvents = [...new Set(message.sources ?? [])].flatMap((id) => {
    const event = events.get(id);
    if (!event || !encounters.has(event.encounterId)) return [];
    if (event.orderId && orders.get(event.orderId)?.encounterId !== event.encounterId) return [];
    return [event];
  }).sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));

  const scope = new Map<string, Set<string | null>>();
  const include = (encounterId: string, orderId: string | null) => {
    const linkedOrders = scope.get(encounterId) ?? new Set();
    linkedOrders.add(orderId);
    scope.set(encounterId, linkedOrders);
  };
  for (const event of citedEvents) include(event.encounterId, event.orderId);
  for (const proposal of message.proposals ?? []) {
    const { encounterId, orderId, kind } = proposal;
    if (kind === 'playbook' || !encounterId || !encounters.has(encounterId)) continue;
    if (orderId !== undefined && orders.get(orderId)?.encounterId !== encounterId) continue;
    include(encounterId, orderId ?? null);
  }
  if (!scope.size) return null;

  const options: string[] = [];
  const panels: string[] = [];
  for (const [encounterId, linkedOrders] of scope) {
    const encounter = encounters.get(encounterId);
    if (!encounter) continue;

    const evidence = citedEvents
      .filter((event) => event.encounterId === encounterId)
      .map((event) => `CareEvidence(${literal(event.id)})`);
    const tasks = workspace.tasks.filter((task) =>
      task.encounterId === encounterId && linkedOrders.has(task.orderId),
    );
    if (!evidence.length && !tasks.length) continue;

    const summaries = [...linkedOrders].flatMap((id) => {
      const order = id ? orders.get(id) : null;
      if (!order) return [];
      const prefix = `${encounter.patientCode} · ${order.testName}. `;
      const lines = message.content.split('\n');
      const line = lines.find((line) => line.startsWith(prefix));
      const blockStart = lines.findIndex((line) => line.trim() === encounter.patientCode);
      const block = blockStart < 0 ? [] : lines.slice(blockStart + 1, blockStart + 3);
      const handoverEvidence = block.find((line) => line.startsWith(`Evidence · ${order.testName}. `));
      const owner = block.find((line) => line.startsWith('Owner · '))?.slice('Owner · '.length);
      const detail = (line?.slice(prefix.length) ?? handoverEvidence?.slice(`Evidence · ${order.testName}. `.length))
        ?.replace(/Source event [^.]+\./g, '')
        .replace(/The (?:HIS|LIS) feed is stale\./g, '').trim();
      return detail ? [`${order.testName}: ${detail}${owner ? `\nOwner: ${owner}` : ''}`] : [];
    });
    options.push(`{summary:${literal(summaries.join('\n'))},value:${literal(encounterId)},label:${literal(`${encounter.patientName} · ${encounter.patientCode}`)}}`);
    const monitoring = tasks.map((task) =>
      `{id:${literal(task.id)},title:${literal(task.title)},status:${literal(task.status)}}`,
    );
    panels.push(`CareEncounter([${evidence.join(',')}],[${monitoring.join(',')}])`);
  }
  if (!panels.length) return null;

  const sources = new Map<string, CareEvent>(citedEvents.map((event) => [event.id, event]));
  return {
    program: `root = CareReply($encounter,[${options.join(',')}],[${panels.join(',')}])`,
    sources,
  };
}
