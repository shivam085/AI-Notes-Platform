import { Router } from 'express';
import { createSemanticSearchController } from '../controllers/index.js';
import { createSemanticSearchClient, createSemanticSearchService } from '../services/index.js';

export function createSemanticSearchRouter({ clerk, DocumentModel, KnowledgeChunkModel, databaseConfigured, semanticSearchClient } = {}) {
  const router = Router();

  // The browser never supplies an owner ID: Clerk provides it before every indexing or search request.
  router.use(clerk.requireConfiguration, clerk.middleware);
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!databaseConfigured) return res.status(503).json({ message: 'Document storage is not configured on the server yet.' });
    return next();
  });

  function controller() {
    return createSemanticSearchController(createSemanticSearchService({
      DocumentModel,
      KnowledgeChunkModel,
      semanticSearchClient: semanticSearchClient || createSemanticSearchClient(),
    }));
  }

  router.post('/reindex', (req, res, next) => controller().reindex(req, res, next));
  router.get('/semantic', (req, res, next) => controller().search(req, res, next));

  return router;
}
