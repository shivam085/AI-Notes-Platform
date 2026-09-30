import multer from 'multer';
import { Router } from 'express';
import { createDocumentsController } from '../controllers/index.js';
import { Document } from '../models/index.js';
import { createCloudinaryDocumentStorage, createDocumentService, validatePdfUpload } from '../services/index.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });

function singlePdfUpload(req, res, next) {
  upload.single('document')(req, res, (error) => {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'PDF files must be 10 MB or smaller.' });
    }
    if (error) return next(error);
    return next();
  });
}

export function createDocumentsRouter({ clerk, DocumentModel = Document, databaseConfigured = Boolean(process.env.MONGODB_URI), storageConfigured = Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET), documentStorage } = {}) {
  const router = Router();

  // All document operations require a verified Clerk identity.
  router.use(clerk.requireConfiguration, clerk.middleware);
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!databaseConfigured) return res.status(503).json({ message: 'Document storage is not configured on the server yet.' });
    if (!storageConfigured) return res.status(503).json({ message: 'Cloudinary document storage is not configured on the server yet.' });
    return next();
  });

  const service = createDocumentService(DocumentModel);
  const controller = createDocumentsController({
    documentService: { ...service, validateUpload: validatePdfUpload },
    // Do not construct Cloudinary's client until its environment settings exist.
    // The middleware above returns the useful setup response when they are absent.
    documentStorage: documentStorage || (storageConfigured ? createCloudinaryDocumentStorage() : null),
  });

  router.post('/', singlePdfUpload, controller.upload);
  router.get('/', controller.list);
  router.get('/:id/open', (req, res, next) => controller.access(req, res, next, false));
  router.get('/:id/download', (req, res, next) => controller.access(req, res, next, true));
  router.delete('/:id', controller.remove);

  return router;
}
