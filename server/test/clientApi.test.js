import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApiRequest } from '../../client/src/services/api.js';

test('shared browser requests attach the current session and JSON headers', async () => {
  const request = createApiRequest(async () => 'session-token', async (path, options) => {
    assert.equal(path, '/api/notes');
    assert.equal(options.headers.get('Authorization'), 'Bearer session-token');
    assert.equal(options.headers.get('Content-Type'), 'application/json');
    assert.equal(options.method, 'POST');
    return Response.json({ note: { title: 'Revision' } });
  });
  assert.deepEqual(await request('/api/notes', { method: 'POST', body: '{"title":"Revision"}' }), { note: { title: 'Revision' } });
});

test('shared browser requests preserve multipart boundaries for document uploads', async () => {
  const body = new FormData();
  body.append('document', new Blob(['Revision']), 'notes.txt');
  const request = createApiRequest(async () => 'session-token', async (path, options) => {
    assert.equal(options.body, body);
    assert.equal(options.headers.has('Content-Type'), false);
    return Response.json({ document: { originalName: 'notes.txt' } });
  });
  await request('/api/documents', { method: 'POST', body });
});

test('shared browser requests handle deletion, lost sessions, and failed or malformed responses', async () => {
  const token = async () => 'session-token';
  assert.equal(await createApiRequest(token, async () => new Response(null, { status: 204 }))('/api/notes/id'), null);
  await assert.rejects(createApiRequest(async () => null, () => assert.fail('Must not send a request'))('/api/notes'), /session ended/);
  await assert.rejects(createApiRequest(token, async () => Response.json({ message: 'Note not found.' }, { status: 404 }))('/api/notes/id'), /Note not found/);
  await assert.rejects(createApiRequest(token, async () => new Response('Proxy failed', { status: 502 }))('/api/study/flashcards'), /HTTP 502/);
  await assert.rejects(createApiRequest(token, async () => new Response('<html>Wrong server</html>'))('/api/notes'), /invalid response/);
});
