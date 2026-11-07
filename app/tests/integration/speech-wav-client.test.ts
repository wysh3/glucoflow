import { describe, expect, it } from 'vitest';
import { encodePcm16Wav, normalizeUploadedWav } from '../../apps/client/src/features/speech/wav';

describe('client speech WAV preparation', () => {
  it('encodes canonical little-endian 16 kHz mono PCM and safely clamps samples', () => {
    const encoded = encodePcm16Wav(new Float32Array([-2, -0.5, 0, 0.5, 2, Number.NaN]));
    const view = new DataView(encoded);
    expect(Buffer.from(encoded, 0, 4).toString('ascii')).toBe('RIFF');
    expect(Buffer.from(encoded, 8, 4).toString('ascii')).toBe('WAVE');
    expect(view.getUint32(4, true)).toBe(encoded.byteLength - 8);
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(16_000);
    expect(view.getUint32(28, true)).toBe(32_000);
    expect(view.getUint16(32, true)).toBe(2);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(12);
    expect([44, 46, 48, 50, 52, 54].map((offset) => view.getInt16(offset, true)))
      .toEqual([-32768, -16384, 0, 16384, 32767, 0]);
  });

  it('accepts the full 30 seconds and rejects additional or empty samples', () => {
    const full = encodePcm16Wav(new Float32Array(480_000));
    expect(full.byteLength).toBe(960_044);
    expect(normalizeUploadedWav(full).byteLength).toBe(full.byteLength);
    expect(() => encodePcm16Wav(new Float32Array(480_001))).toThrow(/limit/i);
    expect(() => encodePcm16Wav(new Float32Array())).toThrow(/empty/i);
    expect(() => normalizeUploadedWav(full, { maxDurationSeconds: 1, maxAudioBytes: 32_044 })).toThrow(/limit/i);
  });

  it('rejects wrong channel count, sample rate, codec and truncated data', () => {
    const canonical = encodePcm16Wav(new Float32Array([0.25, -0.25]));
    for (const [offset, value] of [[20, 3], [22, 2], [24, 44_100], [34, 24]]) {
      const invalid = canonical.slice(0);
      new DataView(invalid).setUint16(offset!, value!, true);
      expect(() => normalizeUploadedWav(invalid)).toThrow(/16 kHz mono PCM/i);
    }
    expect(() => normalizeUploadedWav(canonical.slice(0, -1))).toThrow(/valid WAV/i);
  });

  it('strips optional WAV metadata without changing the PCM samples', () => {
    const original = encodePcm16Wav(new Float32Array([0.25, -0.25]));
    const extra = new Uint8Array(original.byteLength + 12);
    extra.set(new Uint8Array(original, 0, 36), 0);
    extra.set([76, 73, 83, 84, 4, 0, 0, 0, 109, 101, 116, 97], 36);
    extra.set(new Uint8Array(original, 36), 48);
    new DataView(extra.buffer).setUint32(4, extra.byteLength - 8, true);
    expect(Buffer.from(normalizeUploadedWav(extra.buffer))).toEqual(Buffer.from(original));
  });
});
