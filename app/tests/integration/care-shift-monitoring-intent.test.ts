import { describe, expect, it } from 'vitest';
import { isShiftMonitoringIntent } from '../../apps/client/src/features/care/shift-monitoring-intent';
describe('explicit shift monitoring intent',()=>{
 it('routes the blueprint phrase and concise equivalent to approval preview',()=>{
  expect(isShiftMonitoringIntent('Monitor validated results awaiting acknowledgement for my assigned patients until the end of this shift.')).toBe(true);
  expect(isShiftMonitoringIntent('Monitor results awaiting acknowledgement for my assigned patients until shift end')).toBe(true);
 });
 it('does not route clinical interpretation or unspecified scope requests',()=>{
  expect(isShiftMonitoringIntent('Monitor all patients forever')).toBe(false);
  expect(isShiftMonitoringIntent('Explain how to monitor results awaiting acknowledgement for my assigned patients until shift end')).toBe(false);
  expect(isShiftMonitoringIntent('Monitor glucose until shift end')).toBe(false);
 });
});
