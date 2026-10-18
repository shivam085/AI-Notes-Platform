import mongoose from 'mongoose';
import { Document } from '../models/Document.js';
import { KnowledgeChunk } from '../models/KnowledgeChunk.js';
import { Note } from '../models/Note.js';

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
  NoteModel = Note,
  semanticSearchClient,
}) {
  return {
    async reindexReadyDocuments(ownerId) {
      const [documents, notes] = await Promise.all([
        DocumentModel.find({ ownerId, deletedAt: null, processingStatus: 'ready' }).sort({ updatedAt: -1 }).lean(),
        NoteModel.find({ ownerId }).sort({ updatedAt: -1 }).lean(),
      ]);
      const documentById = new Map(documents.map((document) => [document._id.toString(), document]));
      const chunks = await KnowledgeChunkModel.find({ ownerId, sourceType: 'document' }).sort({ sourceId: 1, position: 1 }).lean();
      const documentChunks = chunks
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

      const noteChunksBySource = [];
      for (const note of notes) {
        const sourceId = note._id.toString();
        const text = note.content.trim();
        if (!text) {
          await semanticSearchClient.deleteSource(ownerId, sourceId);
          await KnowledgeChunkModel.deleteMany({ ownerId, sourceType: 'note', sourceId });
          continue;
        }

        const splitChunks = await semanticSearchClient.splitText(text);
        noteChunksBySource.push({
          sourceId,
          chunks: splitChunks.map((chunk) => ({
            _id: new mongoose.Types.ObjectId().toString(),
            ownerId,
            sourceType: 'note',
            sourceId,
            sourceVersion: note.version,
            position: chunk.position,
            pageNumber: null,
            text: chunk.text,
            title: note.title,
            folderId: note.folderId,
            tags: note.tags || [],
          })),
        });
      }

      const noteChunks = noteChunksBySource.flatMap(({ chunks: sourceChunks }) => sourceChunks);
      const indexableChunks = [
        ...documentChunks,
        ...noteChunks.map((chunk) => ({
          chunk_id: chunk._id,
          owner_id: chunk.ownerId,
          source_type: chunk.sourceType,
          source_id: chunk.sourceId,
          position: chunk.position,
          page_number: null,
          text: chunk.text,
          title: chunk.title,
          folder_id: chunk.folderId,
          tags: chunk.tags,
        })),
      ];

      if (!indexableChunks.length) return { indexedCount: 0, documentChunkCount: 0, noteChunkCount: 0 };
      const indexedCount = await semanticSearchClient.indexChunks(indexableChunks);

      for (const { sourceId, chunks: sourceChunks } of noteChunksBySource) {
        await KnowledgeChunkModel.deleteMany({ ownerId, sourceType: 'note', sourceId });
        await KnowledgeChunkModel.insertMany(sourceChunks.map(({ title, folderId, tags, ...chunk }) => chunk));
      }

      return {
        indexedCount,
        documentChunkCount: documentChunks.length,
        noteChunkCount: noteChunks.length,
      };
    },
    async search(ownerId, input = {}) {
      const query = normalizeOptionalText(input.query, 'Search text', 2_000);
      if (!query) throw new SemanticSearchInputError('Enter a question or phrase to search your notes and documents.');
      const sourceType = normalizeOptionalText(input.sourceType, 'Source type', 20);
      if (sourceType && !['document', 'note'].includes(sourceType)) throw new SemanticSearchInputError('Source type must be document or note.');

      const candidateResults = await semanticSearchClient.search({
        ownerId,
        query,
        limit: Math.min(Math.max(Number(input.limit) || 5, 1), 10),
        sourceType,
        folderId: normalizeOptionalText(input.folderId, 'Folder', 100),
        tags: normalizeTags(input.tags),
      });

      const documentIds = [...new Set(candidateResults
        .filter((result) => result.sourceType === 'document')
        .map((result) => result.sourceId))];
      const noteIds = [...new Set(candidateResults
        .filter((result) => result.sourceType === 'note')
        .map((result) => result.sourceId))];
      const chunkIds = [...new Set(candidateResults.map((result) => result.chunkId))];
      if (!chunkIds.length) return [];

      const [documents, notes, chunks] = await Promise.all([
        documentIds.length
          ? DocumentModel.find({ ownerId, deletedAt: null, processingStatus: 'ready', _id: { $in: documentIds } }).lean()
          : [],
        noteIds.length ? NoteModel.find({ ownerId, _id: { $in: noteIds } }).lean() : [],
        KnowledgeChunkModel.find({ ownerId, _id: { $in: chunkIds } }).lean(),
      ]);
      const documentById = new Map(documents.map((document) => [document._id.toString(), document]));
      const noteById = new Map(notes.map((note) => [note._id.toString(), note]));
      const chunkById = new Map(chunks.map((chunk) => [chunk._id.toString(), chunk]));

      return candidateResults.flatMap((result) => {
        const chunk = chunkById.get(result.chunkId);
        if (!chunk || chunk.sourceId !== result.sourceId || chunk.sourceType !== result.sourceType) return [];
        if (result.sourceType === 'note') {
          const note = noteById.get(result.sourceId);
          if (!note || chunk.sourceVersion !== note.version) return [];
          return [{
            chunkId: chunk._id.toString(),
            sourceType: 'note',
            sourceId: note._id.toString(),
            title: note.title,
            pageNumber: null,
            position: chunk.position,
            text: chunk.text,
            score: result.score,
          }];
        }

        const document = documentById.get(result.sourceId);
        if (!document) return [];
        return [{
          chunkId: chunk._id.toString(),
          sourceType: 'document',
          sourceId: document._id.toString(),
          title: document.originalName,
          pageNumber: chunk.pageNumber || null,
          position: chunk.position,
          text: chunk.text,
          score: result.score,
        }];
      });
    },
  };
}
