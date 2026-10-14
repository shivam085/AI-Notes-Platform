import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { test } from 'node:test';
import { createApp } from '../src/app.js';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const origin = 'http://127.0.0.1:5173';
const issuer = 'https://tag-suggestion-test.clerk.accounts.dev';
const publishableKey = `pk_test_${Buffer.from('tag-suggestion-test.clerk.accounts.dev$').toString('base64')}`;
const ownedNoteId = '507f1f77bcf86cd799439011';
const otherNoteId = '507f1f77bcf86cd799439012';
const ownedDocumentId = '507f1f77bcf86cd799439021';
const otherDocumentId = '507f1f77bcf86cd799439022';
const unprocessedDocumentId = '507f1f77bcf86cd799439023';

function token() {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'tag-key' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ iss: issuer, sub: 'user_verified', sid: 'sess_tags', azp: origin, iat: now, nbf: now - 10, exp: now + 300 })).toString('base64url');
  const body = `${header}.${payload}`;
  return `${body}.${sign('RSA-SHA256', Buffer.from(body), privateKey).toString('base64url')}`;
}

function fakeNoteModel() {
  const notes = [
    { _id: ownedNoteId, ownerId: 'user_verified', title: 'Database revision', content: 'Indexes make repeated lookups faster.', tags: [], folderId: null },
    { _id: otherNoteId, ownerId: 'another_user', title: 'Private note', content: 'This must never reach Gemini.', tags: [], folderId: null },
  ];

  return {
    findOne(filter) {
      const note = notes.find((item) => item._id === filter._id && item.ownerId === filter.ownerId) || null;
      return { lean: async () => note };
    },
  };
}

function fakeDocumentModel() {
  const documents = [
    {
      _id: ownedDocumentId,
      ownerId: 'user_verified',
      originalName: 'database-revision.pdf',
      processingStatus: 'ready',
      extractedPages: [{ pageNumber: 1, text: 'Indexes make repeated lookups faster.' }],
    },
    {
      _id: otherDocumentId,
      ownerId: 'another_user',
      originalName: 'private.pdf',
      processingStatus: 'ready',
      extractedPages: [{ pageNumber: 1, text: 'This must never reach Gemini.' }],
    },
    {
      _id: unprocessedDocumentId,
      ownerId: 'user_verified',
      originalName: 'unprocessed.pdf',
      processingStatus: 'uploaded',
      extractedPages: [],
    },
  ];

  return {
    findOne(filter) {
      const document = documents.find((item) => item._id === filter._id && item.ownerId === filter.ownerId) || null;
      return { lean: async () => document };
    },
  };
}

async function request(t, noteId, aiClient) {
  const app = createApp({
    configured: true,
    databaseConfigured: true,
    noteModel: fakeNoteModel(),
    aiClient,
    clerkOptions: { secretKey: 'sk_test_not_a_real_key_for_offline_tests', publishableKey, jwtKey: publicKey.export({ type: 'spki', format: 'pem' }), authorizedParties: [origin] },
  });
  const server = await new Promise((resolve) => { const running = app.listen(0, '127.0.0.1', () => resolve(running)); });
  t.after(() => new Promise((resolve) => server.close(resolve)));

  return fetch(`http://127.0.0.1:${server.address().port}/api/ai/suggest-tags`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token()}`, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ noteId, text: 'A browser-supplied value must be ignored.' }),
  });
}

async function documentRequest(t, documentId, aiClient) {
  const app = createApp({
    configured: true,
    databaseConfigured: true,
    noteModel: fakeNoteModel(),
    documentModel: fakeDocumentModel(),
    aiClient,
    clerkOptions: { secretKey: 'sk_test_not_a_real_key_for_offline_tests', publishableKey, jwtKey: publicKey.export({ type: 'spki', format: 'pem' }), authorizedParties: [origin] },
  });
  const server = await new Promise((resolve) => { const running = app.listen(0, '127.0.0.1', () => resolve(running)); });
  t.after(() => new Promise((resolve) => server.close(resolve)));

  return fetch(`http://127.0.0.1:${server.address().port}/api/ai/documents/${documentId}/suggest-tags`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token()}`, Accept: 'application/json' },
  });
}

test('auto-tagging sends only the signed-in owner\'s saved note to the AI service', async (t) => {
  const received = [];
  const response = await request(t, ownedNoteId, {
    async suggestTags(note) {
      received.push(note);
      return ['database', 'revision', 'indexes'];
    },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { noteId: ownedNoteId, tags: ['database', 'revision', 'indexes'] });
  assert.deepEqual(received, [{ title: 'Database revision', text: 'Indexes make repeated lookups faster.' }]);
});

test('auto-tagging does not send another user\'s note to the AI service', async (t) => {
  const aiClient = { async suggestTags() { throw new Error('This must not run.'); } };
  const response = await request(t, otherNoteId, aiClient);

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { message: 'Note not found.' });
});

test('PDF auto-tagging sends only the signed-in owner\'s extracted text to the AI service', async (t) => {
  const received = [];
  const response = await documentRequest(t, ownedDocumentId, {
    async suggestTags(document) {
      received.push(document);
      return ['database', 'revision', 'indexes'];
    },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { documentId: ownedDocumentId, tags: ['database', 'revision', 'indexes'] });
  assert.deepEqual(received, [{ title: 'database-revision.pdf', text: 'Indexes make repeated lookups faster.' }]);
});

test('PDF auto-tagging does not send another user\'s document to the AI service', async (t) => {
  const aiClient = { async suggestTags() { throw new Error('This must not run.'); } };
  const response = await documentRequest(t, otherDocumentId, aiClient);

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { message: 'Document not found.' });
});

test('PDF auto-tagging requires extracted text before it calls the AI service', async (t) => {
  const aiClient = { async suggestTags() { throw new Error('This must not run.'); } };
  const response = await documentRequest(t, unprocessedDocumentId, aiClient);

  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { message: 'Extracted text is not ready for this document yet.' });
});
