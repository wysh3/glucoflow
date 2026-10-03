import { createServer, type Server } from 'node:http';
import { afterEach, expect, it } from 'vitest';
import { SupabaseStorageAdapter } from './storage';
let server: Server | undefined;
afterEach(async () => { if (server) await new Promise<void>(resolve => server!.close(() => resolve())); });
async function storageResponse(status: number, body: unknown): Promise<SupabaseStorageAdapter> {
 server = createServer((_request,response) => {response.writeHead(status,{'content-type':'application/json'});response.end(JSON.stringify(body));});
 await new Promise<void>(resolve => server!.listen(0,'127.0.0.1',resolve));
 const address=server.address(); if (!address || typeof address === 'string') throw new Error('Missing test listener');
 return new SupabaseStorageAdapter({supabaseUrl:`http://127.0.0.1:${address.port}`,serviceKey:'synthetic-test-key'});
}
it('treats a Supabase 400 object-not-found payload as an absent object', async () => {
 const storage=await storageResponse(400,{statusCode:'404',error:'not_found',message:'Object not found'});
 expect(await storage.headObject('private-exports','snapshots/test.json')).toBeNull();
});
it('does not treat storage permission errors as an absent object', async () => {
 const storage=await storageResponse(400,{statusCode:'403',error:'AccessDenied',message:'Access denied'});
 await expect(storage.headObject('private-exports','snapshots/test.json')).rejects.toThrow();
});
