import { Router } from 'express';
import { createStudyController } from '../controllers/index.js';
import { createAiServiceClient, createNoteService, createStudyService } from '../services/index.js';

export function createStudyRouter({ clerk, NoteModel, StudySetModel, databaseConfigured, aiClient } = {}) {
  const router = Router();

  router.use(clerk.requireConfiguration, clerk.middleware);
  router.use((req, res, next) => {
    if (!databaseConfigured) return res.status(503).json({ message: 'Study-set storage is not configured on the server yet.' });
    return next();
  });

  const dependencies = {
    noteService: createNoteService(NoteModel),
    StudySetModel,
    getAiClient: () => aiClient || createAiServiceClient(),
  };
  const flashcards = createStudyController(
    createStudyService({ ...dependencies, type: 'flashcards' }),
    'Flashcard set or source note not found.',
  );
  const quizzes = createStudyController(
    createStudyService({ ...dependencies, type: 'quiz' }),
    'Quiz or source note not found.',
  );

  router.post('/flashcards/generate', flashcards.generate);
  router.post('/flashcards', flashcards.save);
  router.get('/flashcards', flashcards.list);
  router.get('/flashcards/:id', flashcards.get);
  router.delete('/flashcards/:id', flashcards.remove);

  router.post('/quizzes/generate', quizzes.generate);
  router.post('/quizzes', quizzes.save);
  router.get('/quizzes', quizzes.list);
  router.get('/quizzes/:id', quizzes.get);
  router.delete('/quizzes/:id', quizzes.remove);

  return router;
}
