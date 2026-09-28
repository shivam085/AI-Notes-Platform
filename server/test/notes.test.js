import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { test } from 'node:test';
import { createApp } from '../src/app.js';
import { validateNoteInput } from '../src/services/noteService.js';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const origin = 'http://127.0.0.1:5173';
const issuer = 'https://notes-test.clerk.accounts.dev';
const publishableKey = `pk_test_${Buffer.from('notes-test.clerk.accounts.dev$').toString('base64')}`;
const noteId = '507f1f77bcf86cd799439011';

function token() {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'notes-key' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ iss: issuer, sub: 'user_verified', sid: 'sess_notes', azp: origin, iat: now, nbf: now - 10, exp: now + 300 })).toString('base64url');
  const body = `${header}.${payload}`;
  return `${body}.${sign('RSA-SHA256', Buffer.from(body), privateKey).toString('base64url')}`;
}

function fakeNoteModel() {
  const records = [{ _id: '507f191e810c19729de860ea', ownerId: 'another_user', title: 'Private', content: 'Must never leak', version: 0, tags: [], folderId: null }];
  const matching = (filter) => records.filter((note) => Object.entries(filter).every(([key, value]) => {
    if (key === '$text') return `${note.title} ${note.content}`.toLowerCase().includes(value.$search.toLowerCase());
    return note[key] === value;
  }));
  const query = (value) => ({ lean: async () => value });
  return {
    async create(data) { const note = { _id: noteId, ...data, version: 0, createdAt: new Date(), updatedAt: new Date() }; records.push(note); return note; },
    find(filter) { return { sort: () => query(matching(filter)) }; },
    findOne(filter) { return query(matching(filter)[0] || null); },
    findOneAndUpdate(filter, update) {
      const note = matching(filter)[0];
      if (note) Object.assign(note, update.$set, { version: note.version + update.$inc.version, updatedAt: new Date() });
      return query(note || null);
    },
    async exists(filter) { return matching(filter).length ? { _id: noteId } : null; },
    findOneAndDelete(filter) {
      const note = matching(filter)[0];
      if (note) records.splice(records.indexOf(note), 1);
      return query(note || null);
    },
  };
}

async function request(t, path, options = {}, noteModel = fakeNoteModel()) {
  const app = createApp({
    configured: true,
    databaseConfigured: true,
    noteModel,
    clerkOptions: { secretKey: 'sk_test_not_a_real_key_for_offline_tests', publishableKey, jwtKey: publicKey.export({ type: 'spki', format: 'pem' }), authorizedParties: [origin] },
  });
  const server = await new Promise((resolve) => { const running = app.listen(0, '127.0.0.1', () => resolve(running)); });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return fetch(`http://127.0.0.1:${server.address().port}${path}`, { ...options, headers: { Authorization: `Bearer ${token()}`, Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}) } });
}

test('note input trims titles and normalizes duplicate tags', () => {
  assert.deepEqual(validateNoteInput({ title: '  Exam plan  ', content: 'Revise indexes.', folderId: '', tags: [' Databases ', 'databases', 'Revision'] }), { title: 'Exam plan', content: 'Revise indexes.', folderId: null, tags: ['databases', 'revision'] });
});

test('a verified user can create and list only their own note', async (t) => {
  const noteModel = fakeNoteModel();
  const created = await request(t, '/api/notes', { method: 'POST', body: JSON.stringify({ title: 'Database revision', content: 'Review indexes.', tags: ['MongoDB'] }) }, noteModel);
  assert.equal(created.status, 201);
  assert.equal((await created.json()).note.ownerId, 'user_verified');

  const listed = await request(t, '/api/notes', {}, noteModel);
  assert.equal(listed.status, 200);
  const data = await listed.json();
  assert.deepEqual(data.notes.map((note) => note.ownerId), ['user_verified']);
});

test('a stale version cannot overwrite a note', async (t) => {
  const noteModel = fakeNoteModel();
  await request(t, '/api/notes', { method: 'POST', body: JSON.stringify({ title: 'Database revision', content: 'Review indexes.', tags: [] }) }, noteModel);
  const response = await request(t, `/api/notes/${noteId}`, { method: 'PUT', body: JSON.stringify({ title: 'Database revision', content: 'New content', tags: [], version: 8 }) }, noteModel);
  assert.equal(response.status, 409);
});
