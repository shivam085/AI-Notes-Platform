import { Router } from 'express';
import { createAiController } from '../controllers/index.js';
import { createAiServiceClient, createNoteService, createSummaryService } from '../services/index.js';

export function createAiRouter({ clerk, NoteModel, databaseConfigured, aiClient } = {}) {
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

  return router;
}
