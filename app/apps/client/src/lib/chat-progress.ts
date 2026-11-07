import { ApiRequestError } from './api';

export const chatProgressLabels = {
  context: 'Opening your workspace',
  starting: 'Starting Gluco',
  model: 'Preparing the next step',
  reading_sources: 'Reading source events',
  preparing_reply: 'Preparing your reply',
  validating: 'Checking source references',
  saving: 'Saving your conversation',
} as const;
export type ChatProgressStage = keyof typeof chatProgressLabels;

/** Only public lifecycle stages are displayed. Model text/reasoning is never streamed. */
export async function readChatStream<T>(
  response: Response, aborted: Promise<never>,
  onProgress: (stage: ChatProgressStage) => void,
): Promise<T> {
  const reader = response.body?.getReader();
  if (!reader) throw new ApiRequestError(0, 'request_failed', 'The reply stream is unavailable.', null);
  const decoder = new TextDecoder();
  let buffer = '';
  let sequence = -1;
  try {
    while (true) {
      const { value, done } = await Promise.race([aborted, reader.read()]);
      buffer += decoder.decode(value, { stream: !done });
      if (buffer.length > 2_000_000) throw new Error('Reply stream exceeded its limit');
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      if (done && buffer.trim()) { lines.push(buffer); buffer = ''; }
      for (const line of lines) {
        if (!line.trim()) continue;
        const event = JSON.parse(line);
        if (event.type === 'progress' && Number.isInteger(event.sequence) && event.sequence > sequence) {
          sequence = event.sequence;
          if (Object.hasOwn(chatProgressLabels, event.stage)) onProgress(event.stage);
        } else if (event.type === 'result' && event.workspace) {
          return event.workspace as T;
        } else if (event.type === 'error') {
          throw new ApiRequestError(Number.isInteger(event.status) ? event.status : 0, event.error?.code ?? 'request_failed', event.error?.message ?? 'The reply could not be completed.', null);
        }
      }
      if (done) throw new ApiRequestError(0, 'request_interrupted', 'The reply was interrupted. Your draft is preserved; retry when ready.', null);
    }
  } finally {
    // Cancellation must not wait for a broken transport to acknowledge it.
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
