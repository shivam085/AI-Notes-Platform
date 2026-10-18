import multer from 'multer';
import { Router } from 'express';
import { createDocumentsController } from '../controllers/index.js';
import { Document, KnowledgeChunk } from '../models/index.js';
import {
  createCloudinaryDocumentStorage,
  createDocumentCleanupService,
  createAiServiceClient,
  createDocumentProcessingService,
  createDocumentService,
  createKnowledgeChunkService,
  validateDocumentUpload,
} from '../services/index.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });

function singleDocumentUpload(req, res, next) {
  upload.single('document')(req, res, (error) => {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'Documents must be 10 MB or smaller.' });
    }
    if (error) return next(error);
    return next();
  });
}

export function createDocumentsRouter({ clerk, DocumentModel = Document, KnowledgeChunkModel = KnowledgeChunk, databaseConfigured = Boolean(process.env.MONGODB_URI), storageConfigured = Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET), documentStorage, documentExtractionClient, semanticSearchClient } = {}) {
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
  const knowledgeChunkService = createKnowledgeChunkService(KnowledgeChunkModel);
  const storage = documentStorage || (storageConfigured ? createCloudinaryDocumentStorage() : null);
  const getSemanticSearchClient = () => semanticSearchClient || createAiServiceClient();
  const documentProcessingService = createDocumentProcessingService({
    documentService: service,
    documentStorage: storage,
    knowledgeChunkService,
    // Read AI configuration only when a user starts processing. Upload/list/open remain available without it.
    getExtractionClient: () => documentExtractionClient || createAiServiceClient(),
  });
  const controller = createDocumentsController({
    documentService: { ...service, validateUpload: validateDocumentUpload },
    // Do not construct Cloudinary's client until its environment settings exist.
    // The middleware above returns the useful setup response when they are absent.
    documentStorage: storage,
    documentProcessingService,
    documentCleanupService: createDocumentCleanupService({
      documentService: service,
      documentStorage: storage,
      knowledgeChunkService,
      getSemanticSearchClient,
    }),
  });

  router.post('/', singleDocumentUpload, controller.upload);
  router.get('/', controller.list);
  router.get('/:id/open', (req, res, next) => controller.access(req, res, next, false));
  router.get('/:id/download', (req, res, next) => controller.access(req, res, next, true));
  router.patch('/:id', controller.updateTags);
  router.post('/:id/process', controller.process);
  router.post('/:id/retry', controller.process);
  router.get('/:id/text', controller.extractedText);
  router.delete('/:id', controller.remove);

  return router;
}
