import { describe, expect, it } from 'vitest';
import { readCareRuntimeStream } from '../../apps/api/src/care/progress';

const response = (frames: unknown[]) => new Response(frames.map(frame => JSON.stringify(frame)).join('\n') + '\n');
describe('scoped public action progress', () => {
  it('delivers progress before the final response exists, including split chunks', async () => {
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const seen: string[] = [];
    const encoder = new TextEncoder();
    const pending = readCareRuntimeStream(new Response(new ReadableStream({ start(c) { controller = c; } })), stage => seen.push(stage));
    controller.enqueue(encoder.encode('{"type":"progress","stage":"reading_'));
    controller.enqueue(encoder.encode('sources"}\n'));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(seen).toEqual(['reading_sources']);
    controller.enqueue(encoder.encode('{"type":"result","status":200,"payload":{"reply":"safe"}}\n'));
    controller.close();
    expect((await pending).payload).toEqual({ reply: 'safe' });
  });
  it('rejects arbitrary model text or extra fields instead of exposing them', async () => {
    const seen: string[] = [];
    await expect(readCareRuntimeStream(response([{ type: 'progress', stage: 'model', reasoning: 'secret' }]), s => seen.push(s))).rejects.toThrow();
    expect(seen).toEqual([]);
  });
  it('rejects truncated, duplicated and excessive streams', async () => {
    await expect(readCareRuntimeStream(response([{ type: 'progress', stage: 'model' }]), () => {})).rejects.toThrow('without a result');
    await expect(readCareRuntimeStream(response([{ type: 'result', status: 200, payload: {} }, { type: 'progress', stage: 'model' }]), () => {})).rejects.toThrow('Unexpected');
    await expect(readCareRuntimeStream(response(Array.from({ length: 33 }, () => ({ type: 'progress', stage: 'model' }))), () => {})).rejects.toThrow('Unexpected');
  });
});
