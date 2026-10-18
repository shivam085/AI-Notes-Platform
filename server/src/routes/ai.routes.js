import { Router } from 'express';
import { createAiController, createRagController } from '../controllers/index.js';
import {
  createAiServiceClient,
  createDocumentService,
  createNoteService,
  createRagService,
  createSemanticSearchService,
  createAiService,
} from '../services/index.js';

export function createAiRouter({ clerk, NoteModel, DocumentModel, KnowledgeChunkModel, ConversationModel, MessageModel, databaseConfigured, aiClient, semanticSearchClient, ragClient } = {}) {
  const router = Router();

  // All AI actions use a Clerk-verified owner before reading saved source content.
  router.use(clerk.requireConfiguration, clerk.middleware);

  function contentController() {
    return createAiController(createAiService({
      noteService: createNoteService(NoteModel),
      documentService: createDocumentService(DocumentModel),
      aiClient: aiClient || createAiServiceClient(),
    }));
  }

  router.use((req, res, next) => {
    if (!databaseConfigured) return res.status(503).json({ message: 'AI source storage is not configured on the server yet.' });
    return next();
  });

  router.post('/summarize', (req, res, next) => contentController().summarize(req, res, next));
  router.post('/suggest-tags', (req, res, next) => contentController().suggest(req, res, next));
  router.post('/documents/:id/suggest-tags', (req, res, next) => contentController().suggestDocument(req, res, next));

  function ragController() {
    return createRagController(createRagService({
      DocumentModel,
      KnowledgeChunkModel,
      ConversationModel,
      MessageModel,
      semanticSearchService: createSemanticSearchService({ DocumentModel, KnowledgeChunkModel, semanticSearchClient: semanticSearchClient || createAiServiceClient() }),
      ragClient: ragClient || createAiServiceClient(),
    }));
  }

  router.post('/chat', (req, res, next) => ragController().ask(req, res, next));
  router.get('/conversations', (req, res, next) => ragController().list(req, res, next));
  router.get('/conversations/:id', (req, res, next) => ragController().get(req, res, next));
  router.delete('/conversations/:id', (req, res, next) => ragController().remove(req, res, next));

  return router;
}
