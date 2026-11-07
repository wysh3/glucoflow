import {expect,it} from 'vitest';
import {isCareGreeting} from '../../apps/client/src/features/care/greeting-intent';
it('recognizes standalone greetings without swallowing operational questions',()=>{
 for(const text of ['hi','Hello Gluco!','hey there','नमस्ते','good morning']) expect(isCareGreeting(text)).toBe(true);
 for(const text of ['hi, show pending results','high glucose','hello can you draft a handover','']) expect(isCareGreeting(text)).toBe(false);
});
