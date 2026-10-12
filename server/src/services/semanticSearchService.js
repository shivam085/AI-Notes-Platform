import { Document } from '../models/Document.js';
import { KnowledgeChunk } from '../models/KnowledgeChunk.js';

export class SemanticSearchInputError extends Error {}

function normalizeOptionalText(value, label, maxLength) {
  if (value == null || value === '') return null;
  const text = String(value).trim();
  if (!text) return null;
  if (text.length > maxLength) throw new SemanticSearchInputError(`${label} must be at most ${maxLength} characters.`);
  return text;
}

function normalizeTags(value) {
  const rawTags = value == null ? [] : Array.isArray(value) ? value : [value];
  const tags = [...new Set(rawTags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean))];
  if (tags.length > 10 || tags.some((tag) => tag.length > 30)) {
    throw new SemanticSearchInputError('Use up to 10 search tags, each at most 30 characters.');
  }
  return tags;
}

export function createSemanticSearchService({
  DocumentModel = Document,
  KnowledgeChunkModel = KnowledgeChunk,
  semanticSearchClient,
}) {
  return {
    async reindexReadyDocuments(ownerId) {
      const documents = await DocumentModel.find({ ownerId, processingStatus: 'ready' }).sort({ updatedAt: -1 }).lean();
      const documentById = new Map(documents.map((document) => [document._id.toString(), document]));
      const chunks = await KnowledgeChunkModel.find({ ownerId, sourceType: 'document' }).sort({ sourceId: 1, position: 1 }).lean();
      const indexableChunks = chunks
        .filter((chunk) => documentById.has(chunk.sourceId))
        .map((chunk) => {
          const document = documentById.get(chunk.sourceId);
          return {
            chunk_id: chunk._id.toString(),
            owner_id: ownerId,
            source_type: chunk.sourceType,
            source_id: chunk.sourceId,
            position: chunk.position,
            page_number: chunk.pageNumber,
            text: chunk.text,
            title: document.originalName,
            folder_id: document.folderId,
            tags: document.tags || [],
          };
        });

      if (!indexableChunks.length) return { indexedCount: 0 };
      return { indexedCount: await semanticSearchClient.indexChunks(indexableChunks) };
    },
    async search(ownerId, input = {}) {
      const query = normalizeOptionalText(input.query, 'Search text', 2_000);
      if (!query) throw new SemanticSearchInputError('Enter a question or phrase to search your documents.');
      const sourceType = normalizeOptionalText(input.sourceType, 'Source type', 20);
      if (sourceType && !['document', 'note'].includes(sourceType)) throw new SemanticSearchInputError('Source type must be document or note.');

      return semanticSearchClient.search({
        ownerId,
        query,
        limit: Math.min(Math.max(Number(input.limit) || 5, 1), 10),
        sourceType,
        folderId: normalizeOptionalText(input.folderId, 'Folder', 100),
        tags: normalizeTags(input.tags),
      });
    },
  };
}
