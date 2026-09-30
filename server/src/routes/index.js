import { Router } from 'express';
import { createAuthRouter } from './auth.routes.js';
import { createNotesRouter } from './notes.routes.js';
import { createAiRouter } from './ai.routes.js';
import { createDocumentsRouter } from './documents.routes.js';

// This is the single entry point for all /api routes, matching the backend structure
// used across the user's projects while keeping each feature in its own route file.
export function createApiRouter({ clerk, NoteModel, DocumentModel, databaseConfigured, aiClient, documentStorage, cloudinaryConfigured } = {}) {
  const router = Router();

  router.use('/auth', createAuthRouter({ clerk }));
  router.use('/notes', createNotesRouter({ clerk, NoteModel, databaseConfigured }));
  router.use('/ai', createAiRouter({ clerk, NoteModel, databaseConfigured, aiClient }));
  router.use('/documents', createDocumentsRouter({ clerk, DocumentModel, databaseConfigured, documentStorage, storageConfigured: cloudinaryConfigured }));

  return router;
}
