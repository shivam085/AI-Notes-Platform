import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { test } from 'node:test';
import { createApp } from '../src/app.js';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const origin = 'http://127.0.0.1:5173';
const issuer = 'https://flashcard-test.clerk.accounts.dev';
const publishableKey = `pk_test_${Buffer.from('flashcard-test.clerk.accounts.dev$').toString('base64')}`;
const ownedNoteId = '507f1f77bcf86cd799439011';
const otherNoteId = '507f1f77bcf86cd799439012';

function token() {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'flashcard-key' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ iss: issuer, sub: 'user_verified', sid: 'sess_flashcards', azp: origin, iat: now, nbf: now - 10, exp: now + 300 })).toString('base64url');
  const body = `${header}.${payload}`;
  return `${body}.${sign('RSA-SHA256', Buffer.from(body), privateKey).toString('base64url')}`;
}

function fakeNoteModel() {
  const notes = [
    { _id: ownedNoteId, ownerId: 'user_verified', title: 'Database revision', content: 'Indexes organize data so repeated lookups can be faster.', tags: [], folderId: null },
    { _id: otherNoteId, ownerId: 'another_user', title: 'Private note', content: 'This must never reach Gemini.', tags: [], folderId: null },
  ];

  return {
    findOne(filter) {
      const note = notes.find((item) => item._id === filter._id && item.ownerId === filter.ownerId) || null;
      return { lean: async () => note };
    },
  };
}

function fakeStudySetModel() {
  const records = [];
  const matches = (record, filter) => Object.entries(filter).every(([key, value]) => record[key] === value);
  const query = (value) => ({ lean: async () => value });

  return {
    records,
    async create(data) {
      const now = new Date();
      const record = { _id: `507f1f77bcf86cd7994390${20 + records.length}`, ...data, createdAt: now, updatedAt: now };
      records.push(record);
      return record;
    },
    find(filter) {
      return { sort: () => query(records.filter((record) => matches(record, filter))) };
    },
    findOne(filter) {
      return query(records.find((record) => matches(record, filter)) || null);
    },
    findOneAndDelete(filter) {
      const record = records.find((item) => matches(item, filter)) || null;
      if (record) records.splice(records.indexOf(record), 1);
      return query(record);
    },
  };
}

function cards() {
  return Array.from({ length: 5 }, (_, index) => ({ question: `Question ${index + 1}`, answer: `Answer ${index + 1}` }));
}

async function request(t, path, options = {}, { aiClient, studySetModel = fakeStudySetModel() } = {}) {
  const app = createApp({
    configured: true,
    databaseConfigured: true,
    noteModel: fakeNoteModel(),
    studySetModel,
    aiClient,
    clerkOptions: { secretKey: 'sk_test_not_a_real_key_for_offline_tests', publishableKey, jwtKey: publicKey.export({ type: 'spki', format: 'pem' }), authorizedParties: [origin] },
  });
  const server = await new Promise((resolve) => { const running = app.listen(0, '127.0.0.1', () => resolve(running)); });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token()}`, Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
  });
  return { response, studySetModel };
}

test('flashcard generation sends only the signed-in owner\'s saved note to the AI service', async (t) => {
  const received = [];
  const aiClient = {
    async generateFlashcards(note) {
      received.push(note);
      return cards();
    },
  };
  const { response } = await request(t, '/api/study/flashcards/generate', { method: 'POST', body: JSON.stringify({ noteId: ownedNoteId, text: 'Browser text must be ignored.' }) }, { aiClient });

  assert.equal(response.status, 200);
  assert.equal((await response.json()).cards.length, 5);
  assert.deepEqual(received, [{ title: 'Database revision', text: 'Indexes organize data so repeated lookups can be faster.' }]);
});

test('flashcard generation does not send another user\'s note to the AI service', async (t) => {
  const aiClient = { async generateFlashcards() { throw new Error('This must not run.'); } };
  const { response } = await request(t, '/api/study/flashcards/generate', { method: 'POST', body: JSON.stringify({ noteId: otherNoteId }) }, { aiClient });

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { message: 'Flashcard set or source note not found.' });
});

test('an owner can save, open, list, and delete a private flashcard set', async (t) => {
  const studySetModel = fakeStudySetModel();
  const aiClient = { async generateFlashcards() { return cards(); } };
  const saved = await request(t, '/api/study/flashcards', { method: 'POST', body: JSON.stringify({ noteId: ownedNoteId, cards: cards() }) }, { aiClient, studySetModel });
  assert.equal(saved.response.status, 201);
  const studySet = (await saved.response.json()).studySet;
  assert.equal(studySet.cardCount, 5);

  const listed = await request(t, '/api/study/flashcards', {}, { aiClient, studySetModel });
  assert.deepEqual((await listed.response.json()).studySets.map((item) => item._id), [studySet._id]);

  const opened = await request(t, `/api/study/flashcards/${studySet._id}`, {}, { aiClient, studySetModel });
  assert.equal((await opened.response.json()).studySet.cards.length, 5);

  const removed = await request(t, `/api/study/flashcards/${studySet._id}`, { method: 'DELETE' }, { aiClient, studySetModel });
  assert.equal(removed.response.status, 204);
  assert.equal(studySetModel.records.length, 0);
});
