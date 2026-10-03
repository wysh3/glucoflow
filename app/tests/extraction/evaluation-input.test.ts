import {describe, expect, it} from 'vitest';
import {evaluationAssignment, evaluationObservations} from '../../scripts/lib/evaluation-input';
import type {DraftFactInput} from '@glucoflow/contracts';

describe('evaluation inputs', () => {
 it('keeps the assigned patient distinct from the identity printed on a foreign report', () => {
   expect(evaluationAssignment({identifier:'P0999',name:'Other',expectedIdentity:'mismatch',assignedIdentifier:'P0482',assignedName:'Asha'})).toEqual({identifier:'P0482',name:'Asha'});
 });
 it('refuses a mismatch case without a separately labelled assignment', () => {
   expect(() => evaluationAssignment({identifier:'P0999',name:'Other',expectedIdentity:'mismatch'})).toThrow(/assignedIdentifier/);
 });
 it('excludes context from the observation metric and preserves literal values when normalization is unavailable', () => {
   const facts = [
     {kind:'observation',rawLabel:'HbA1c',rawValue:'<5',rawUnit:'%',eventDate:'2026-09-14',normalized:{testCode:'hba1c',numericValue:null,unitCode:'%'}},
     {kind:'prescription',rawLabel:'Metformin',normalized:{name:'Metformin',strength:'500 mg',instructions:'Daily'}},
   ] as DraftFactInput[];
   expect(evaluationObservations(facts)).toEqual([{rawLabel:'HbA1c',testCode:'hba1c',value:'<5',unit:'%',eventDate:'2026-09-14'}]);
 });
});
