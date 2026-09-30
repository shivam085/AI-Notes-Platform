import mongoose from 'mongoose';
import { Document } from '../models/Document.js';

export class DocumentInputError extends Error {}
export class DocumentNotFoundError extends Error {}

const maxDocumentBytes = 10 * 1024 * 1024;

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

export function validatePdfUpload(file) {
  if (!file) throw new DocumentInputError('Choose a PDF file to upload.');
  if (file.size < 1) throw new DocumentInputError('The selected PDF is empty.');
  if (file.size > maxDocumentBytes) throw new DocumentInputError('PDF files must be 10 MB or smaller.');
  if (!file.originalname?.toLowerCase().endsWith('.pdf')) throw new DocumentInputError('Only PDF files are supported in this first upload step.');
  if (file.mimetype !== 'application/pdf') throw new DocumentInputError('The selected file is not declared as a PDF.');
  if (!Buffer.isBuffer(file.buffer) || !file.buffer.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
    throw new DocumentInputError('The selected file does not contain a valid PDF signature.');
  }
  return { originalName: file.originalname.trim(), format: 'pdf', mimeType: 'application/pdf', size: file.size };
}

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
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

export function createDocumentService(DocumentModel = Document) {
  return {
    async create(ownerId, file, storageAsset, input = {}) {
      const details = validatePdfUpload(file);
      return DocumentModel.create({
        ownerId,
        ...details,
        cloudinaryPublicId: storageAsset.publicId,
        folderId: normalizeFolderId(input.folderId),
        tags: normalizeTags(input.tags),
      });
    },
    async list(ownerId) {
      return DocumentModel.find({ ownerId }).sort({ updatedAt: -1 }).lean();
    },
    async getById(ownerId, id) {
      requireValidId(id);
      const document = await DocumentModel.findOne({ _id: id, ownerId }).lean();
      if (!document) throw new DocumentNotFoundError();
      return document;
    },
    async remove(ownerId, id) {
      requireValidId(id);
      const document = await DocumentModel.findOneAndDelete({ _id: id, ownerId }).lean();
      if (!document) throw new DocumentNotFoundError();
      return document;
    },
  };
}
