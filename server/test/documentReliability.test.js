import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDocumentCleanupService } from '../src/services/documentCleanupService.js';
import { createDocumentMaintenanceService } from '../src/services/documentMaintenanceService.js';
import { createDocumentProcessingService } from '../src/services/documentProcessingService.js';
import { createDocumentService, DocumentNotFoundError, DocumentProcessingSupersededError } from '../src/services/documentService.js';
import { AiServiceUnavailableError } from '../src/services/aiServiceClient.js';

const documentId = '507f1f77bcf86cd799439012';

function matches(record, filter) {
  return Object.entries(filter).every(([key, expected]) => {
    const actual = record[key];
    if (expected === null) return actual == null;
    if (expected && typeof expected === 'object') {
      if ('$in' in expected) return expected.$in.includes(actual);
      if ('$lt' in expected) return actual < expected.$lt;
      if ('$ne' in expected) return actual !== expected.$ne;
    }
    return String(actual) === String(expected);
  });
}

function query(value) {
  return { lean: async () => value, sort: () => ({ lean: async () => value }) };
}

function fakeDocumentModel() {
  const record = {
    _id: documentId,
    ownerId: 'user-1',
    originalName: 'revision.txt',
    format: 'txt',
    mimeType: 'text/plain',
    size: 40,
    cloudinaryPublicId: 'private-file',
    processingStatus: 'uploaded',
    processingAttempts: 0,
    processingRunId: null,
    processingStartedAt: null,
    deletedAt: null,
    extractedPages: [],
  };
  return {
    record,
    find(filter) { return query(matches(record, filter) ? [record] : []); },
    findOne(filter) { return query(matches(record, filter) ? record : null); },
    findOneAndUpdate(filter, update) {
      if (!matches(record, filter)) return query(null);
      Object.assign(record, update.$set || {});
      for (const [key, value] of Object.entries(update.$inc || {})) record[key] = (record[key] || 0) + value;
      return query(record);
    },
    findOneAndDelete(filter) { return query(matches(record, filter) ? { ...record } : null); },
  };
}

test('a deleted document rejects completion from its older processing run', async () => {
  const model = fakeDocumentModel();
  const service = createDocumentService(model);
  const processing = await service.beginProcessing('user-1', documentId);

  await service.beginDeletion('user-1', documentId);

  await assert.rejects(
    service.completeProcessing('user-1', documentId, processing.processingRunId, [{ pageNumber: 1, text: 'old text' }], 1),
    DocumentProcessingSupersededError,
  );
  await assert.rejects(service.getById('user-1', documentId), DocumentNotFoundError);
});

test('transient extraction is retried once before processing completes', async () => {
  let extractionCalls = 0;
  let completedRunId;
  const processingService = createDocumentProcessingService({
    documentService: {
      async beginProcessing() {
        return { _id: documentId, ownerId: 'user-1', format: 'txt', cloudinaryPublicId: 'private-file', processingRunId: 'run-1' };
      },
      async completeProcessing(ownerId, id, runId) { completedRunId = runId; return { _id: id, ownerId, processingStatus: 'ready' }; },
      async failProcessing() { throw new Error('Processing should not fail after a successful retry.'); },
    },
    documentStorage: { createAccessUrl: () => 'https://files.example/revision.txt' },
    knowledgeChunkService: {
      async replaceDocumentChunks() { return 1; },
      async removeDocumentChunks() {},
    },
    getExtractionClient: () => ({
      async extractDocument() {
        extractionCalls += 1;
        if (extractionCalls === 1) throw new AiServiceUnavailableError('Temporary failure.');
        return {
          pages: [{ pageNumber: 1, text: 'Recovered text.' }],
          chunks: [{ position: 0, pageNumber: 1, text: 'Recovered text.' }],
        };
      },
    }),
    waitImplementation: async () => {},
  });

  const document = await processingService.processDocument('user-1', documentId);
  assert.equal(document.processingStatus, 'ready');
  assert.equal(extractionCalls, 2);
  assert.equal(completedRunId, 'run-1');
});

test('deletion hides the document before external cleanup and keeps failed cleanup recoverable', async () => {
  const events = [];
  const cleanupService = createDocumentCleanupService({
    documentService: {
      async beginDeletion() {
        events.push('hidden');
        return { _id: documentId, ownerId: 'user-1', cloudinaryPublicId: 'private-file', processingRunId: 'delete-1' };
      },
      async completeDeletion() { events.push('removed'); },
    },
    documentStorage: { async remove() { events.push('cloudinary'); } },
    knowledgeChunkService: { async removeDocumentChunks() { events.push('mongodb-chunks'); } },
    getSemanticSearchClient: () => ({ async deleteSource() { events.push('qdrant'); } }),
  });

  const result = await cleanupService.deleteDocument('user-1', documentId);
  assert.deepEqual(events, ['hidden', 'cloudinary', 'mongodb-chunks', 'qdrant', 'removed']);
  assert.equal(result.completed, true);

  const pendingCleanup = createDocumentCleanupService({
    documentService: {
      async beginDeletion() {
        return { _id: documentId, ownerId: 'user-1', cloudinaryPublicId: 'private-file', processingRunId: 'delete-2' };
      },
      async completeDeletion() { throw new Error('Incomplete cleanup must not remove the database record.'); },
    },
    documentStorage: { async remove() {} },
    knowledgeChunkService: { async removeDocumentChunks() {} },
    getSemanticSearchClient: () => ({ async deleteSource() { throw new Error('Qdrant unavailable.'); } }),
  });
  assert.equal((await pendingCleanup.deleteDocument('user-1', documentId)).completed, false);
});

test('startup maintenance handles saved processing and deletion work', async () => {
  const recovered = [];
  const cleaned = [];
  const result = await createDocumentMaintenanceService({
    documentService: {
      async listInterruptedProcessing() { return [{ _id: 'processing-1', ownerId: 'user-1' }]; },
      async listPendingDeletions() { return [{ _id: 'deleting-1', ownerId: 'user-1' }]; },
    },
    documentProcessingService: {
      async recoverDocument(ownerId, id) { recovered.push({ ownerId, id }); },
    },
    documentCleanupService: {
      async cleanClaimedDocument(document) { cleaned.push(document._id); return { completed: true }; },
    },
  }).recover();

  assert.deepEqual(recovered, [{ ownerId: 'user-1', id: 'processing-1' }]);
  assert.deepEqual(cleaned, ['deleting-1']);
  assert.equal(result.processingResults[0].recovered, true);
  assert.equal(result.deletionResults[0].completed, true);
});
