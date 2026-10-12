import { Router } from 'express';
import { createAiController, createRagController } from '../controllers/index.js';
import { createAiServiceClient, createNoteService, createRagClient, createRagService, createSemanticSearchClient, createSemanticSearchService, createSummaryService } from '../services/index.js';

export function createAiRouter({ clerk, NoteModel, DocumentModel, KnowledgeChunkModel, ConversationModel, MessageModel, databaseConfigured, aiClient, semanticSearchClient, ragClient } = {}) {
  const router = Router();

  // All AI actions use a Clerk-verified owner before reading note content.
  router.use(clerk.requireConfiguration, clerk.middleware);

  router.post('/summarize', (req, res, next) => {
    if (!databaseConfigured) {
      return res.status(503).json({ message: 'Notes storage is not configured on the server yet.' });
    }

    try {
      const controller = createAiController(
        createSummaryService({
          noteService: createNoteService(NoteModel),
          aiClient: aiClient || createAiServiceClient(),
        }),
      );

      return controller.summarize(req, res, next);
    } catch (error) {
      return next(error);
    }
  });

  function ragController() {
    return createRagController(createRagService({
      DocumentModel,
      KnowledgeChunkModel,
      ConversationModel,
      MessageModel,
      semanticSearchService: createSemanticSearchService({ DocumentModel, KnowledgeChunkModel, semanticSearchClient: semanticSearchClient || createSemanticSearchClient() }),
      ragClient: ragClient || createRagClient(),
    }));
  }

  router.use((req, res, next) => {
    if (!databaseConfigured) return res.status(503).json({ message: 'Document Q&A storage is not configured on the server yet.' });
    return next();
  });
  router.post('/chat', (req, res, next) => ragController().ask(req, res, next));
  router.get('/conversations', (req, res, next) => ragController().list(req, res, next));
  router.get('/conversations/:id', (req, res, next) => ragController().get(req, res, next));
  router.delete('/conversations/:id', (req, res, next) => ragController().remove(req, res, next));

  return router;
}
