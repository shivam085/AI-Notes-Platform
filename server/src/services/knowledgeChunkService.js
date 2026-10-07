import { KnowledgeChunk } from '../models/KnowledgeChunk.js';

export class KnowledgeChunkInputError extends Error {}

function validateChunks(chunks) {
  if (!Array.isArray(chunks) || !chunks.length) {
    throw new KnowledgeChunkInputError('No readable text chunks were returned for this document.');
  }

  return chunks.map((chunk, index) => {
    if (!Number.isInteger(chunk.position) || chunk.position !== index) {
      throw new KnowledgeChunkInputError('Document chunks must have consecutive positions.');
    }
    if (!Number.isInteger(chunk.pageNumber) || chunk.pageNumber < 1) {
      throw new KnowledgeChunkInputError('Document chunks must include a source page number.');
    }
    if (typeof chunk.text !== 'string' || !chunk.text.trim() || chunk.text.length > 2_000) {
      throw new KnowledgeChunkInputError('Document chunks must contain at most 2,000 characters.');
    }
    return { position: chunk.position, pageNumber: chunk.pageNumber, text: chunk.text.trim() };
  });
}

export function createKnowledgeChunkService(KnowledgeChunkModel = KnowledgeChunk) {
  return {
    async replaceDocumentChunks(ownerId, documentId, chunks) {
      const validChunks = validateChunks(chunks);
      const sourceFilter = { ownerId, sourceType: 'document', sourceId: documentId.toString() };

      await KnowledgeChunkModel.deleteMany(sourceFilter);
      await KnowledgeChunkModel.insertMany(validChunks.map((chunk) => ({ ...sourceFilter, ...chunk })));
      return validChunks.length;
    },
    async removeDocumentChunks(ownerId, documentId) {
      await KnowledgeChunkModel.deleteMany({ ownerId, sourceType: 'document', sourceId: documentId.toString() });
    },
  };
}
