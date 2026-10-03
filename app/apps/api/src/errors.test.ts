import {expect, it} from 'vitest';
import {toApiError} from './errors';
it('keeps rate-limit and oversized-body refusals as client errors', () => {
  expect(toApiError(Object.assign(new Error('Rate limit exceeded'), {statusCode:429})).status).toBe(429);
  expect(toApiError(Object.assign(new Error('Request body too large'), {statusCode:413})).status).toBe(413);
});
