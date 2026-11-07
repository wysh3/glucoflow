import { expect, it } from 'vitest';
import { shouldSendOnEnter } from '../../apps/client/src/features/care/composer-keys';
const enter = {key:'Enter',shiftKey:false,altKey:false,isComposing:false};
it('sends Enter while preserving Shift+Enter and composition confirmation', () => {
  expect(shouldSendOnEnter(enter)).toBe(true);
  expect(shouldSendOnEnter({...enter,shiftKey:true})).toBe(false);
  expect(shouldSendOnEnter({...enter,altKey:true})).toBe(false);
  expect(shouldSendOnEnter({...enter,isComposing:true})).toBe(false);
  expect(shouldSendOnEnter({...enter,keyCode:229})).toBe(false);
  expect(shouldSendOnEnter({...enter,key:'a'})).toBe(false);
});
