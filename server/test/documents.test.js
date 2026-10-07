import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { test } from 'node:test';
import { createApp } from '../src/app.js';
import { validatePdfUpload } from '../src/services/documentService.js';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const origin = 'http://127.0.0.1:5173';
const issuer = 'https://documents-test.clerk.accounts.dev';
const publishableKey = `pk_test_${Buffer.from('documents-test.clerk.accounts.dev$').toString('base64')}`;
const documentId = '507f1f77bcf86cd799439012';

function token() {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'documents-key' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ iss: issuer, sub: 'user_verified', sid: 'sess_documents', azp: origin, iat: now, nbf: now - 10, exp: now + 300 })).toString('base64url');
  const body = `${header}.${payload}`;
  return `${body}.${sign('RSA-SHA256', Buffer.from(body), privateKey).toString('base64url')}`;
}

function fakeDocumentModel() {
  const records = [{ _id: '507f191e810c19729de860ea', ownerId: 'another_user', originalName: 'private.pdf', format: 'pdf', mimeType: 'application/pdf', size: 100, cloudinaryPublicId: 'private-id', processingStatus: 'uploaded', tags: [], folderId: null }];
  const matching = (filter) => records.filter((document) => Object.entries(filter).every(([key, value]) => document[key] === value));
  const query = (value) => ({ lean: async () => value });
  return {
    async create(data) {
      const document = { _id: documentId, ...data, processingStatus: 'uploaded', createdAt: new Date(), updatedAt: new Date() };
      records.push(document);
      return document;
    },
    find(filter) { return { sort: () => query(matching(filter)) }; },
    findOne(filter) { return query(matching(filter)[0] || null); },
    findOneAndDelete(filter) {
      const document = matching(filter)[0];
      if (document) records.splice(records.indexOf(document), 1);
      return query(document || null);
    },
    findOneAndUpdate(filter, update) {
      const document = matching(filter)[0];
      if (document) Object.assign(document, update.$set);
      return query(document || null);
    },
  };
}

function fakeKnowledgeChunkModel() {
  const records = [];
  const matching = (filter) => records.filter((chunk) => Object.entries(filter).every(([key, value]) => chunk[key] === value));
  return {
    records,
    async deleteMany(filter) {
      for (const chunk of matching(filter)) records.splice(records.indexOf(chunk), 1);
    },
    async insertMany(chunks) { records.push(...chunks); },
  };
}

function fakeStorage() {
  const uploaded = [];
  const removed = [];
  return {
    uploaded,
    removed,
    async uploadPdf(file) { uploaded.push(file); return { publicId: 'owner-file-id' }; },
    async remove(publicId) { removed.push(publicId); },
    createAccessUrl({ publicId, download }) { return `https://storage.example/${publicId}?download=${download}`; },
  };
}

async function request(t, path, options = {}, documentModel = fakeDocumentModel(), documentStorage = fakeStorage(), knowledgeChunkModel = fakeKnowledgeChunkModel(), documentExtractionClient) {
  const app = createApp({
    configured: true,
    databaseConfigured: true,
    cloudinaryConfigured: true,
    documentModel,
    knowledgeChunkModel,
    documentStorage,
    documentExtractionClient,
    clerkOptions: { secretKey: 'sk_test_not_a_real_key_for_offline_tests', publishableKey, jwtKey: publicKey.export({ type: 'spki', format: 'pem' }), authorizedParties: [origin] },
  });
  const server = await new Promise((resolve) => { const running = app.listen(0, '127.0.0.1', () => resolve(running)); });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const headers = { Authorization: `Bearer ${token()}`, Accept: 'application/json', ...options.headers };
  return { response: await fetch(`http://127.0.0.1:${server.address().port}${path}`, { ...options, headers }), documentStorage };
}

test('PDF validation rejects a renamed non-PDF file', () => {
  assert.throws(() => validatePdfUpload({ originalname: 'not-a-pdf.pdf', mimetype: 'application/pdf', size: 12, buffer: Buffer.from('not a document') }));
});

test('a verified user can upload and list their own PDF', async (t) => {
  const body = new FormData();
  body.append('document', new Blob([Buffer.from('%PDF-1.7\nexample')], { type: 'application/pdf' }), 'revision.pdf');
  body.append('tags', '');
  const documentModel = fakeDocumentModel();
  const storage = fakeStorage();
  const { response: uploaded } = await request(t, '/api/documents', { method: 'POST', body }, documentModel, storage);
  assert.equal(uploaded.status, 201);
  assert.equal((await uploaded.json()).document.originalName, 'revision.pdf');
  assert.equal(storage.uploaded.length, 1);

  const { response: listed } = await request(t, '/api/documents', {}, documentModel, storage);
  const data = await listed.json();
  assert.equal(listed.status, 200);
  assert.deepEqual(data.documents.map((document) => document.originalName), ['revision.pdf']);
  assert.equal(data.documents[0].cloudinaryPublicId, undefined);
});

test('an owner receives a short-lived access link and another account document is hidden', async (t) => {
  const documentModel = fakeDocumentModel();
  const storage = fakeStorage();
  const ownBody = new FormData();
  ownBody.append('document', new Blob([Buffer.from('%PDF-1.7\nexample')], { type: 'application/pdf' }), 'revision.pdf');
  await request(t, '/api/documents', { method: 'POST', body: ownBody }, documentModel, storage);

  const { response: ownAccess } = await request(t, `/api/documents/${documentId}/open`, {}, documentModel, storage);
  assert.equal(ownAccess.status, 200);
  assert.equal((await ownAccess.json()).url, 'https://storage.example/owner-file-id?download=false');

  const { response: blocked } = await request(t, '/api/documents/507f191e810c19729de860ea/download', {}, documentModel, storage);
  assert.equal(blocked.status, 404);
  assert.equal(storage.removed.length, 0);
});

test('an owner can extract page-aware text and cannot process a ready document again', async (t) => {
  const documentModel = fakeDocumentModel();
  const storage = fakeStorage();
  const chunkModel = fakeKnowledgeChunkModel();
  const extractor = {
    async extractPdf(url) {
      assert.match(url, /^https:\/\/storage\.example\/owner-file-id/);
      return {
        pages: [{ pageNumber: 1, text: 'Indexes speed up repeated database lookups.' }],
        chunks: [{ position: 0, pageNumber: 1, text: 'Indexes speed up repeated database lookups.' }],
      };
    },
  };
  const body = new FormData();
  body.append('document', new Blob([Buffer.from('%PDF-1.7\nexample')], { type: 'application/pdf' }), 'revision.pdf');
  await request(t, '/api/documents', { method: 'POST', body }, documentModel, storage, chunkModel, extractor);

  const { response: processed } = await request(t, `/api/documents/${documentId}/process`, { method: 'POST' }, documentModel, storage, chunkModel, extractor);
  assert.equal(processed.status, 200);
  assert.equal((await processed.json()).document.processingStatus, 'ready');
  assert.equal(chunkModel.records.length, 1);

  const { response: text } = await request(t, `/api/documents/${documentId}/text`, {}, documentModel, storage, chunkModel, extractor);
  assert.equal(text.status, 200);
  assert.equal((await text.json()).document.pages[0].pageNumber, 1);

  const { response: repeated } = await request(t, `/api/documents/${documentId}/retry`, { method: 'POST' }, documentModel, storage, chunkModel, extractor);
  assert.equal(repeated.status, 409);
});
