import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { Document } from '../models/Document.js';

export class DocumentInputError extends Error {}
export class DocumentNotFoundError extends Error {}
export class DocumentProcessingStateError extends Error {}
export class DocumentProcessingSupersededError extends Error {}

const maxDocumentBytes = 10 * 1024 * 1024;
const supportedFormats = {
  pdf: {
    mimeType: 'application/pdf',
    acceptedMimeTypes: ['application/pdf'],
    validBytes: (buffer) => buffer.subarray(0, 5).equals(Buffer.from('%PDF-')),
  },
  docx: {
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    acceptedMimeTypes: [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/octet-stream',
    ],
    validBytes: (buffer) => buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])),
  },
  txt: {
    mimeType: 'text/plain',
    acceptedMimeTypes: ['text/plain', 'application/octet-stream', ''],
    validBytes: isReadableUtf8,
  },
  md: {
    mimeType: 'text/markdown',
    acceptedMimeTypes: ['text/markdown', 'text/plain', 'application/octet-stream', ''],
    validBytes: isReadableUtf8,
  },
};

function isReadableUtf8(buffer) {
  if (buffer.includes(0)) return false;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    return true;
  } catch {
    return false;
  }
}

function normalizeTags(value) {
  if (value === undefined) return [];
  // Multipart form fields arrive as strings, unlike JSON note requests.
  const values = typeof value === 'string' ? value.split(',') : value;
  if (!Array.isArray(values)) throw new DocumentInputError('Tags must be a list.');
  const tags = [...new Set(values.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean))];
  if (tags.length > 10 || tags.some((tag) => tag.length > 30)) {
    throw new DocumentInputError('Use up to 10 tags, each at most 30 characters.');
  }
  return tags;
}

function normalizeFolderId(value) {
  const folderId = value == null || value === '' ? null : String(value).trim();
  if (folderId && folderId.length > 100) throw new DocumentInputError('Folder must be at most 100 characters.');
  return folderId;
}

export function validateDocumentUpload(file) {
  if (!file) throw new DocumentInputError('Choose a PDF, DOCX, TXT, or Markdown file to upload.');
  if (file.size < 1) throw new DocumentInputError('The selected document is empty.');
  if (file.size > maxDocumentBytes) throw new DocumentInputError('Documents must be 10 MB or smaller.');

  const originalName = file.originalname?.trim() || '';
  const extension = originalName.toLowerCase().split('.').pop();
  const format = extension === 'markdown' ? 'md' : extension;
  const rules = supportedFormats[format];
  if (!rules) throw new DocumentInputError('Only PDF, DOCX, TXT, and Markdown files are supported.');
  if (!rules.acceptedMimeTypes.includes(file.mimetype || '')) {
    throw new DocumentInputError(`The selected file is not declared as a valid ${format.toUpperCase()} document.`);
  }
  if (!Buffer.isBuffer(file.buffer) || !rules.validBytes(file.buffer)) {
    throw new DocumentInputError(`The selected file does not contain valid ${format.toUpperCase()} content.`);
  }

  return { originalName, format, mimeType: rules.mimeType, size: file.size };
}

// Kept as a compatibility alias for older Phase 5 imports and documentation.
export const validatePdfUpload = validateDocumentUpload;

function requireValidId(id) {
  if (!mongoose.isObjectIdOrHexString(id)) throw new DocumentNotFoundError();
}

export function serializeDocument(document) {
  return {
    _id: document._id.toString(),
    originalName: document.originalName,
    format: document.format,
    size: document.size,
    folderId: document.folderId,
    tags: document.tags,
    processingStatus: document.processingStatus,
    processingError: document.processingError || null,
    processingAttempts: document.processingAttempts || 0,
    chunkCount: document.extractedChunkCount || 0,
    processedAt: document.processedAt || null,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

export function serializeDocumentText(document) {
  return {
    ...serializeDocument(document),
    pages: (document.extractedPages || []).map((page) => ({ pageNumber: page.pageNumber, text: page.text })),
  };
}

export function createDocumentService(DocumentModel = Document) {
  return {
    async create(ownerId, file, storageAsset, input = {}) {
      const details = validateDocumentUpload(file);
      return DocumentModel.create({
        ownerId,
        ...details,
        cloudinaryPublicId: storageAsset.publicId,
        folderId: normalizeFolderId(input.folderId),
        tags: normalizeTags(input.tags),
      });
    },
    async list(ownerId) {
      return DocumentModel.find({ ownerId, deletedAt: null }).sort({ updatedAt: -1 }).lean();
    },
    async getById(ownerId, id) {
      requireValidId(id);
      const document = await DocumentModel.findOne({ _id: id, ownerId, deletedAt: null }).lean();
      if (!document) throw new DocumentNotFoundError();
      return document;
    },
    async updateTags(ownerId, id, tags) {
      requireValidId(id);
      if (!Array.isArray(tags)) throw new DocumentInputError('Tags must be a list.');
      const document = await DocumentModel.findOneAndUpdate(
        { _id: id, ownerId, deletedAt: null },
        { $set: { tags: normalizeTags(tags) } },
        { new: true },
      ).lean();
      if (!document) throw new DocumentNotFoundError();
      return document;
    },
    async beginProcessing(ownerId, id) {
      const existing = await this.getById(ownerId, id);
      if (existing.processingStatus === 'processing') {
        throw new DocumentProcessingStateError('This document is already being processed. Please wait a moment.');
      }
      if (existing.processingStatus === 'ready') {
        throw new DocumentProcessingStateError('This document is already ready to read.');
      }

      const runId = randomUUID();
      const document = await DocumentModel.findOneAndUpdate(
        { _id: id, ownerId, deletedAt: null, processingStatus: { $in: ['uploaded', 'failed'] } },
        {
          $set: {
            processingStatus: 'processing',
            processingError: null,
            processingRunId: runId,
            processingAttempts: 1,
            processingStartedAt: new Date(),
          },
        },
        { new: true },
      ).lean();
      if (!document) throw new DocumentProcessingStateError('This document changed before processing could start. Refresh and try again.');
      return document;
    },
    async reclaimInterruptedProcessing(ownerId, id, maximumAttempts = 3) {
      requireValidId(id);
      const runId = randomUUID();
      return DocumentModel.findOneAndUpdate(
        {
          _id: id,
          ownerId,
          deletedAt: null,
          processingStatus: 'processing',
          processingAttempts: { $lt: maximumAttempts },
        },
        {
          $set: { processingRunId: runId, processingError: null, processingStartedAt: new Date() },
          $inc: { processingAttempts: 1 },
        },
        { new: true },
      ).lean();
    },
    async listInterruptedProcessing() {
      return DocumentModel.find({ deletedAt: null, processingStatus: 'processing' }).sort({ processingStartedAt: 1 }).lean();
    },
    async completeProcessing(ownerId, id, runId, pages, chunkCount) {
      const document = await DocumentModel.findOneAndUpdate(
        { _id: id, ownerId, deletedAt: null, processingStatus: 'processing', processingRunId: runId },
        {
          $set: {
            processingStatus: 'ready',
            processingError: null,
            processingRunId: null,
            processingStartedAt: null,
            extractedPages: pages,
            extractedChunkCount: chunkCount,
            processedAt: new Date(),
          },
        },
        { new: true },
      ).lean();
      if (!document) throw new DocumentProcessingSupersededError('This processing run is no longer active.');
      return document;
    },
    async failProcessing(ownerId, id, runId, message) {
      return DocumentModel.findOneAndUpdate(
        { _id: id, ownerId, deletedAt: null, processingStatus: 'processing', processingRunId: runId },
        {
          $set: {
            processingStatus: 'failed',
            processingError: String(message || 'Document processing failed.').slice(0, 300),
            processingRunId: null,
            processingStartedAt: null,
          },
        },
        { new: true },
      ).lean();
    },
    async failExhaustedRecovery(ownerId, id, message) {
      return DocumentModel.findOneAndUpdate(
        { _id: id, ownerId, deletedAt: null, processingStatus: 'processing' },
        {
          $set: {
            processingStatus: 'failed',
            processingError: String(message).slice(0, 300),
            processingRunId: null,
            processingStartedAt: null,
          },
        },
        { new: true },
      ).lean();
    },
    async beginDeletion(ownerId, id) {
      requireValidId(id);
      const deletionRunId = randomUUID();
      const document = await DocumentModel.findOneAndUpdate(
        { _id: id, ownerId, deletedAt: null },
        {
          $set: {
            processingStatus: 'deleting',
            processingRunId: deletionRunId,
            processingStartedAt: null,
            deletedAt: new Date(),
          },
        },
        { new: true },
      ).lean();
      if (!document) throw new DocumentNotFoundError();
      return document;
    },
    async listPendingDeletions() {
      return DocumentModel.find({ processingStatus: 'deleting', deletedAt: { $ne: null } }).sort({ deletedAt: 1 }).lean();
    },
    async completeDeletion(ownerId, id, deletionRunId) {
      return DocumentModel.findOneAndDelete({
        _id: id,
        ownerId,
        processingStatus: 'deleting',
        processingRunId: deletionRunId,
      }).lean();
    },
    async getExtractedText(ownerId, id) {
      const document = await this.getById(ownerId, id);
      if (document.processingStatus !== 'ready') {
        throw new DocumentProcessingStateError('Extracted text is not ready for this document yet.');
      }
      return document;
    },
  };
}
