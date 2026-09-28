import { Router } from 'express';
import { createAiController } from '../controllers/aiController.js';
import { createNoteService } from '../services/noteService.js';
import { createAiServiceClient } from '../services/aiServiceClient.js';
import { createSummaryService } from '../services/summaryService.js';

export function createAiRouter({ NoteModel, databaseConfigured, aiClient } = {}) {
  const router = Router();
  router.post('/summarize', (req, res, next) => {
    if (!databaseConfigured) return res.status(503).json({ message: 'Notes storage is not configured on the server yet.' });
    let controller;
    try {
      controller = createAiController(createSummaryService({ noteService: createNoteService(NoteModel), aiClient: aiClient || createAiServiceClient() }));
    } catch (error) {
      return next(error);
    }
    return controller.summarize(req, res, next);
  });
  return router;
}
