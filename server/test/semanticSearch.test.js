import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { test } from 'node:test';
import { createApp } from '../src/app.js';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const origin = 'http://127.0.0.1:5173';
const issuer = 'https://semantic-search-test.clerk.accounts.dev';
const publishableKey = `pk_test_${Buffer.from('semantic-search-test.clerk.accounts.dev$').toString('base64')}`;

function token() {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'semantic-search-key' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ iss: issuer, sub: 'user_verified', sid: 'sess_search', azp: origin, iat: now, nbf: now - 10, exp: now + 300 })).toString('base64url');
  const body = `${header}.${payload}`;
  return `${body}.${sign('RSA-SHA256', Buffer.from(body), privateKey).toString('base64url')}`;
}

function query(value) {
  return { sort: () => ({ lean: async () => value }) };
}

function fakeDocumentModel() {
  const documents = [
    { _id: 'document-owned', ownerId: 'user_verified', originalName: 'database-revision.pdf', processingStatus: 'ready', folderId: 'study', tags: ['database'] },
    { _id: 'document-other', ownerId: 'another_user', originalName: 'private.pdf', processingStatus: 'ready', folderId: null, tags: [] },
  ];
  return {
    find(filter) {
      return query(documents.filter((document) => Object.entries(filter).every(([key, value]) => document[key] === value)));
    },
  };
}

function fakeKnowledgeChunkModel() {
  const chunks = [
    { _id: 'chunk-owned', ownerId: 'user_verified', sourceType: 'document', sourceId: 'document-owned', position: 0, pageNumber: 2, text: 'Indexes make repeated database lookups faster.' },
    { _id: 'chunk-other', ownerId: 'another_user', sourceType: 'document', sourceId: 'document-other', position: 0, pageNumber: 1, text: 'Another account private content.' },
  ];
  return {
    find(filter) {
      return query(chunks.filter((chunk) => Object.entries(filter).every(([key, value]) => chunk[key] === value)));
    },
  };
}

function fakeStorage() {
  return {
    createAccessUrl() { return 'https://storage.example/private.pdf'; },
    async uploadPdf() { return { publicId: 'unused' }; },
    async remove() {},
  };
}

function fakeSemanticSearchClient() {
  return {
    indexed: [],
    searches: [],
    async indexChunks(chunks) {
      this.indexed.push(chunks);
      return chunks.length;
    },
    async search(input) {
      this.searches.push(input);
      return [{
        chunkId: 'chunk-owned',
        sourceType: 'document',
        sourceId: 'document-owned',
        title: 'database-revision.pdf',
        pageNumber: 2,
        position: 0,
        text: 'Indexes make repeated database lookups faster.',
        score: 0.91,
      }];
    },
  };
}

async function request(t, path, options = {}, semanticSearchClient = fakeSemanticSearchClient()) {
  const app = createApp({
    configured: true,
    databaseConfigured: true,
    cloudinaryConfigured: true,
    documentModel: fakeDocumentModel(),
    knowledgeChunkModel: fakeKnowledgeChunkModel(),
    documentStorage: fakeStorage(),
    semanticSearchClient,
    clerkOptions: { secretKey: 'sk_test_not_a_real_key_for_offline_tests', publishableKey, jwtKey: publicKey.export({ type: 'spki', format: 'pem' }), authorizedParties: [origin] },
  });
  const server = await new Promise((resolve) => { const running = app.listen(0, '127.0.0.1', () => resolve(running)); });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token()}`, Accept: 'application/json', ...options.headers },
  });
  return { response, semanticSearchClient };
}

test('a verified user indexes only their own ready document chunks', async (t) => {
  const client = fakeSemanticSearchClient();
  const { response } = await request(t, '/api/search/reindex', { method: 'POST' }, client);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { indexedCount: 1 });
  assert.equal(client.indexed[0].length, 1);
  assert.deepEqual(client.indexed[0][0], {
    chunk_id: 'chunk-owned',
    owner_id: 'user_verified',
    source_type: 'document',
    source_id: 'document-owned',
    position: 0,
    page_number: 2,
    text: 'Indexes make repeated database lookups faster.',
    title: 'database-revision.pdf',
    folder_id: 'study',
    tags: ['database'],
  });
});

test('semantic search derives the owner from Clerk and applies optional filters', async (t) => {
  const client = fakeSemanticSearchClient();
  const { response } = await request(t, '/api/search/semantic?query=faster%20database%20lookup&ownerId=another_user&folderId=study&tags=database', {}, client);

  assert.equal(response.status, 200);
  assert.equal((await response.json()).results[0].sourceId, 'document-owned');
  assert.deepEqual(client.searches[0], {
    ownerId: 'user_verified',
    query: 'faster database lookup',
    limit: 5,
    sourceType: null,
    folderId: 'study',
    tags: ['database'],
  });
});

test('semantic search rejects an empty query before it reaches the AI service', async (t) => {
  const client = fakeSemanticSearchClient();
  const { response } = await request(t, '/api/search/semantic?query=%20%20', {}, client);

  assert.equal(response.status, 400);
  assert.match((await response.json()).message, /Enter a question/);
  assert.equal(client.searches.length, 0);
});
