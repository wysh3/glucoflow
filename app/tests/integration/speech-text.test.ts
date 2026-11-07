import { expect, it } from 'vitest';
import { speechChunks } from '../../apps/client/src/features/speech/text';
it('never exceeds the provider character limit at a whitespace boundary', () => {
  const chunks = speechChunks('A'.repeat(500) + ' ' + 'B'.repeat(100), 500);
  expect(chunks.every(chunk => chunk.length <= 500)).toBe(true);
  expect(chunks.join(' ').replace(/\s/g, '')).toBe('A'.repeat(500) + 'B'.repeat(100));
});
it('keeps Unicode characters whole at a chunk boundary', () => {
  const chunks = speechChunks('A'.repeat(499) + '🎙️ Hindi हिन्दी', 500);
  expect(chunks.every(chunk => new TextDecoder().decode(new TextEncoder().encode(chunk)) === chunk)).toBe(true);
});
