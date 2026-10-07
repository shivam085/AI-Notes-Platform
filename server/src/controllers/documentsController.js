import { getAuth } from '@clerk/express';
import {
  DocumentExtractionConfigurationError,
  DocumentExtractionInputError,
  DocumentExtractionUnavailableError,
  DocumentInputError,
  DocumentNotFoundError,
  DocumentProcessingStateError,
  serializeDocument,
  serializeDocumentText,
} from '../services/index.js';
import { DocumentStorageConfigurationError, DocumentStorageError } from '../services/cloudinaryDocumentStorage.js';

function ownerIdFromRequest(req, res) {
  const { userId, sessionId } = getAuth(req);
  if (!userId || !sessionId) {
    res.status(401).json({ message: 'Please sign in to continue.' });
    return null;
  }
  return userId;
}

function respondToDocumentError(error, res, next) {
  if (error instanceof DocumentInputError) return res.status(400).json({ message: error.message });
  if (error instanceof DocumentNotFoundError) return res.status(404).json({ message: 'Document not found.' });
  if (error instanceof DocumentProcessingStateError) return res.status(409).json({ message: error.message });
  if (error instanceof DocumentExtractionInputError) return res.status(422).json({ message: error.message });
  if (error instanceof DocumentExtractionConfigurationError) return res.status(503).json({ message: error.message });
  if (error instanceof DocumentExtractionUnavailableError) return res.status(502).json({ message: error.message });
  if (error instanceof DocumentStorageConfigurationError) return res.status(503).json({ message: error.message });
  if (error instanceof DocumentStorageError) return res.status(502).json({ message: error.message });
  return next(error);
}

export function createDocumentsController({ documentService, documentStorage, documentProcessingService, knowledgeChunkService }) {
  return {
    async upload(req, res, next) {
      const ownerId = ownerIdFromRequest(req, res);
      if (!ownerId) return;
      let storageAsset;
      try {
        const file = req.file;
        // Validate before sending bytes to third-party storage.
        const details = documentService.validateUpload(file);
        storageAsset = await documentStorage.uploadPdf({ buffer: file.buffer, ownerId, originalName: details.originalName });
        const document = await documentService.create(ownerId, file, storageAsset, req.body);
        return res.status(201).json({ document: serializeDocument(document) });
      } catch (error) {
        if (storageAsset?.publicId) {
          try { await documentStorage.remove(storageAsset.publicId); } catch { /* The original error is more useful to the user. */ }
        }
        return respondToDocumentError(error, res, next);
      }
    },
    async list(req, res, next) {
      const ownerId = ownerIdFromRequest(req, res);
      if (!ownerId) return;
      try {
        const documents = await documentService.list(ownerId);
        return res.json({ documents: documents.map(serializeDocument) });
      } catch (error) { return respondToDocumentError(error, res, next); }
    },
    async access(req, res, next, download) {
      const ownerId = ownerIdFromRequest(req, res);
      if (!ownerId) return;
      try {
        const document = await documentService.getById(ownerId, req.params.id);
        return res.json({ url: documentStorage.createAccessUrl({ publicId: document.cloudinaryPublicId, format: document.format, download }) });
      } catch (error) { return respondToDocumentError(error, res, next); }
    },
    async remove(req, res, next) {
      const ownerId = ownerIdFromRequest(req, res);
      if (!ownerId) return;
      try {
        const document = await documentService.getById(ownerId, req.params.id);
        await documentStorage.remove(document.cloudinaryPublicId);
        await knowledgeChunkService.removeDocumentChunks(ownerId, document._id);
        await documentService.remove(ownerId, req.params.id);
        return res.status(204).end();
      } catch (error) { return respondToDocumentError(error, res, next); }
    },
    async process(req, res, next) {
      const ownerId = ownerIdFromRequest(req, res);
      if (!ownerId) return;
      try {
        const document = await documentProcessingService.processDocument(ownerId, req.params.id);
        return res.json({ document: serializeDocument(document) });
      } catch (error) { return respondToDocumentError(error, res, next); }
    },
    async extractedText(req, res, next) {
      const ownerId = ownerIdFromRequest(req, res);
      if (!ownerId) return;
      try {
        const document = await documentService.getExtractedText(ownerId, req.params.id);
        return res.json({ document: serializeDocumentText(document) });
      } catch (error) { return respondToDocumentError(error, res, next); }
    },
  };
}
