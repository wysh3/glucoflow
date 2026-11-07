import {describe,it,expect} from 'vitest';
import {MASTER_SCENARIO, screeningState} from './master';
describe('PDF master dashboard rules',()=>{
 it('preserves all supplied values without extra periods',()=>{
  expect(MASTER_SCENARIO.map(p=>p.hba1c)).toEqual([7.2,7.3,7,7.6,8]);
  expect(MASTER_SCENARIO.map(p=>p.fasting)).toEqual([132,140,118,135,142]);
  expect(MASTER_SCENARIO.map(p=>p.postmeal)).toEqual([175,188,165,195,210]);
  expect(MASTER_SCENARIO.map(p=>p.egfr)).toEqual([75,70,64,58,55]);
 });


 it('leaves missing dates unknown and uses the configured boundary',()=>{
  expect(screeningState(null,365,'2026-10-03')).toBe('No recorded date');
  expect(screeningState('2025-10-03',365,'2026-10-02')).toBe('Recorded');
  expect(screeningState('2025-10-03',365,'2026-10-03')).toBe('Pending review');
 });
});
