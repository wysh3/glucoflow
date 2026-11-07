import { EventEmitter } from 'node:events';
import { expect, it } from 'vitest';
import { responseLifetime } from './request-lifetime';

function response() {
  return Object.assign(new EventEmitter(), { writableEnded: false, destroyed: false });
}

it('cancels disconnected responses and removes its listener on completion', () => {
  const raw = response();
  const lifetime = responseLifetime(raw as never);
  raw.emit('close');
  expect(lifetime.signal.aborted).toBe(true);
  lifetime.dispose();
  expect(raw.listenerCount('close')).toBe(0);
});

it('does not cancel a successfully finished response or a completed request body', () => {
  const raw = response();
  const lifetime = responseLifetime(raw as never);
  raw.emit('end');
  expect(lifetime.signal.aborted).toBe(false);
  raw.writableEnded = true;
  raw.emit('close');
  expect(lifetime.signal.aborted).toBe(false);
  lifetime.dispose();
});

it('recognizes a connection already destroyed before dispatch', () => {
  const raw = response();
  raw.destroyed = true;
  const lifetime = responseLifetime(raw as never);
  expect(lifetime.signal.aborted).toBe(true);
  lifetime.dispose();
});
