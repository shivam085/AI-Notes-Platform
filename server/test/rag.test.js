import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { test } from 'node:test';
import { createApp } from '../src/app.js';
import { insufficientContextAnswer } from '../src/services/ragService.js';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const origin = 'http://127.0.0.1:5173';
const issuer = 'https://rag-test.clerk.accounts.dev';
const publishableKey = `pk_test_${Buffer.from('rag-test.clerk.accounts.dev$').toString('base64')}`;
const ownedDocumentId = '507f1f77bcf86cd799439012';
const otherDocumentId = '507f1f77bcf86cd799439013';
const ownedChunkId = '507f1f77bcf86cd799439014';
const otherChunkId = '507f1f77bcf86cd799439015';
const conversationId = '507f1f77bcf86cd799439016';

function token() {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'rag-key' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ iss: issuer, sub: 'user_verified', sid: 'sess_rag', azp: origin, iat: now, nbf: now - 10, exp: now + 300 })).toString('base64url');
  const body = `${header}.${payload}`;
  return `${body}.${sign('RSA-SHA256', Buffer.from(body), privateKey).toString('base64url')}`;
}

function matches(record, filter) {
  return Object.entries(filter).every(([key, value]) => {
    if (value && typeof value === 'object' && '$in' in value) return value.$in.map(String).includes(String(record[key]));
    return String(record[key]) === String(value);
  });
}

function query(value) {
  return {
    lean: async () => value,
    sort: () => ({ lean: async () => value }),
  };
}

function fakeDocumentModel() {
  const documents = [
    { _id: ownedDocumentId, ownerId: 'user_verified', originalName: 'communication.pdf', processingStatus: 'ready' },
    { _id: otherDocumentId, ownerId: 'another_user', originalName: 'private.pdf', processingStatus: 'ready' },
  ];
  return { find(filter) { return query(documents.filter((document) => matches(document, filter))); } };
}

function fakeKnowledgeChunkModel() {
  const chunks = [
    { _id: ownedChunkId, ownerId: 'user_verified', sourceType: 'document', sourceId: ownedDocumentId, pageNumber: 2, position: 1, text: 'Communication technologies made information travel farther and faster.' },
    { _id: otherChunkId, ownerId: 'another_user', sourceType: 'document', sourceId: otherDocumentId, pageNumber: 1, position: 0, text: 'Another account private material.' },
  ];
  return { find(filter) { return query(chunks.filter((chunk) => matches(chunk, filter))); } };
}

function fakeConversationModel() {
  const records = [{ _id: '507f1f77bcf86cd799439017', ownerId: 'another_user', title: 'Private history', lastMessageAt: new Date(), createdAt: new Date(), updatedAt: new Date() }];
  return {
    records,
    async create(data) {
      const record = { _id: conversationId, ...data, createdAt: new Date(), updatedAt: new Date() };
      records.push(record);
      return record;
    },
    find(filter) { return query(records.filter((record) => matches(record, filter))); },
    findOne(filter) { return query(records.find((record) => matches(record, filter)) || null); },
    findOneAndUpdate(filter, update) {
      const record = records.find((item) => matches(item, filter));
      if (record) Object.assign(record, update.$set, { updatedAt: new Date() });
      return query(record || null);
    },
    findOneAndDelete(filter) {
      const record = records.find((item) => matches(item, filter));
      if (record) records.splice(records.indexOf(record), 1);
      return query(record || null);
    },
  };
}

function fakeMessageModel() {
  const records = [];
  return {
    records,
    async create(data) {
      const record = { _id: `507f1f77bcf86cd7994390${20 + records.length}`, ...data, createdAt: new Date() };
      records.push(record);
      return record;
    },
    find(filter) { return query(records.filter((record) => matches(record, filter))); },
    async deleteMany(filter) {
      for (const record of records.filter((item) => matches(item, filter))) records.splice(records.indexOf(record), 1);
    },
  };
}

function fakeSemanticSearchClient(results) {
  return {
    searches: [],
    async search(input) { this.searches.push(input); return results; },
    async indexChunks() { return 0; },
  };
}

function fakeRagClient() {
  return {
    calls: [],
    async answerQuestion(question, contexts) {
      this.calls.push({ question, contexts });
      return { answer: 'Communication technologies made information travel faster.', grounded: true };
    },
  };
}

async function request(t, path, options = {}, { searchResults = [], semanticSearchClient = fakeSemanticSearchClient(searchResults), ragClient = fakeRagClient(), conversationModel = fakeConversationModel(), messageModel = fakeMessageModel() } = {}) {
  const app = createApp({
    configured: true,
    databaseConfigured: true,
    documentModel: fakeDocumentModel(),
    knowledgeChunkModel: fakeKnowledgeChunkModel(),
    conversationModel,
    messageModel,
    semanticSearchClient,
    ragClient,
    clerkOptions: { secretKey: 'sk_test_not_a_real_key_for_offline_tests', publishableKey, jwtKey: publicKey.export({ type: 'spki', format: 'pem' }), authorizedParties: [origin] },
  });
  const server = await new Promise((resolve) => { const running = app.listen(0, '127.0.0.1', () => resolve(running)); });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token()}`, Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
  });
  return { response, semanticSearchClient, ragClient, conversationModel, messageModel };
}

test('document Q&A sends only rechecked owned chunks to the AI and saves real sources', async (t) => {
  const results = [
    { chunkId: ownedChunkId, sourceType: 'document', sourceId: ownedDocumentId, text: 'Qdrant text must not be sent directly.', title: 'wrong title', pageNumber: 99, position: 0, score: 0.9 },
    { chunkId: otherChunkId, sourceType: 'document', sourceId: otherDocumentId, text: 'Private Qdrant text.', title: 'private.pdf', pageNumber: 1, position: 0, score: 0.8 },
  ];
  const ragClient = fakeRagClient();
  const { response, semanticSearchClient } = await request(t, '/api/ai/chat', { method: 'POST', body: JSON.stringify({ question: 'How did communication technologies change society?' }) }, { searchResults: results, ragClient });

  assert.equal(response.status, 201);
  const data = await response.json();
  assert.equal(data.assistantMessage.grounded, true);
  assert.deepEqual(data.assistantMessage.sources, [{ chunkId: ownedChunkId, sourceType: 'document', sourceId: ownedDocumentId, title: 'communication.pdf', pageNumber: 2, position: 1 }]);
  assert.deepEqual(semanticSearchClient.searches[0], { ownerId: 'user_verified', query: 'How did communication technologies change society?', limit: 4, sourceType: 'document', folderId: null, tags: [] });
  assert.deepEqual(ragClient.calls[0].contexts, [{ chunk_id: ownedChunkId, source_id: ownedDocumentId, title: 'communication.pdf', page_number: 2, text: 'Communication technologies made information travel farther and faster.' }]);
});

test('document Q&A abstains when retrieval has no owned evidence and does not call Gemini', async (t) => {
  const ragClient = fakeRagClient();
  const { response } = await request(t, '/api/ai/chat', { method: 'POST', body: JSON.stringify({ question: 'What is the capital of Mars?' }) }, { searchResults: [], ragClient });

  assert.equal(response.status, 201);
  const data = await response.json();
  assert.equal(data.assistantMessage.content, insufficientContextAnswer);
  assert.equal(data.assistantMessage.grounded, false);
  assert.deepEqual(data.assistantMessage.sources, []);
  assert.equal(ragClient.calls.length, 0);
});

test('document Q&A abstains when semantic matches are too weak to be evidence', async (t) => {
  const ragClient = fakeRagClient();
  const weakResult = [{ chunkId: ownedChunkId, sourceType: 'document', sourceId: ownedDocumentId, score: 0.2 }];
  const { response } = await request(t, '/api/ai/chat', { method: 'POST', body: JSON.stringify({ question: 'What is the capital of Mars?' }) }, { searchResults: weakResult, ragClient });

  assert.equal(response.status, 201);
  const data = await response.json();
  assert.equal(data.assistantMessage.content, insufficientContextAnswer);
  assert.equal(ragClient.calls.length, 0);
});

test('conversation history and deletion are scoped to the signed-in owner', async (t) => {
  const searchResults = [{ chunkId: ownedChunkId, sourceType: 'document', sourceId: ownedDocumentId, score: 0.9 }];
  const conversationModel = fakeConversationModel();
  const messageModel = fakeMessageModel();
  const created = await request(t, '/api/ai/chat', { method: 'POST', body: JSON.stringify({ question: 'What changed?' }) }, { searchResults, conversationModel, messageModel });
  const conversation = (await created.response.json()).conversation;

  const listed = await request(t, '/api/ai/conversations', {}, { searchResults, conversationModel, messageModel });
  assert.deepEqual((await listed.response.json()).conversations.map((item) => item._id), [conversation._id]);

  const blocked = await request(t, '/api/ai/conversations/507f1f77bcf86cd799439017', {}, { searchResults, conversationModel, messageModel });
  assert.equal(blocked.response.status, 404);

  const removed = await request(t, `/api/ai/conversations/${conversation._id}`, { method: 'DELETE' }, { searchResults, conversationModel, messageModel });
  assert.equal(removed.response.status, 204);
  assert.equal(messageModel.records.length, 0);
});
