import { Router } from 'express';
import { createFlashcardsController, createQuizController } from '../controllers/index.js';
import { createAiServiceClient, createFlashcardService, createNoteService, createQuizService } from '../services/index.js';

export function createStudyRouter({ clerk, NoteModel, StudySetModel, databaseConfigured, aiClient } = {}) {
  const router = Router();

  router.use(clerk.requireConfiguration, clerk.middleware);
  router.use((req, res, next) => {
    if (!databaseConfigured) return res.status(503).json({ message: 'Study-set storage is not configured on the server yet.' });
    return next();
  });

  function flashcardsController() {
    return createFlashcardsController(createFlashcardService({
      noteService: createNoteService(NoteModel),
      StudySetModel,
      aiClient: aiClient || createAiServiceClient(),
    }));
  }

  function quizController() {
    return createQuizController(createQuizService({
      noteService: createNoteService(NoteModel),
      StudySetModel,
      aiClient: aiClient || createAiServiceClient(),
    }));
  }

  router.post('/flashcards/generate', (req, res, next) => flashcardsController().generate(req, res, next));
  router.post('/flashcards', (req, res, next) => flashcardsController().save(req, res, next));
  router.get('/flashcards', (req, res, next) => flashcardsController().list(req, res, next));
  router.get('/flashcards/:id', (req, res, next) => flashcardsController().get(req, res, next));
  router.delete('/flashcards/:id', (req, res, next) => flashcardsController().remove(req, res, next));

  router.post('/quizzes/generate', (req, res, next) => quizController().generate(req, res, next));
  router.post('/quizzes', (req, res, next) => quizController().save(req, res, next));
  router.get('/quizzes', (req, res, next) => quizController().list(req, res, next));
  router.get('/quizzes/:id', (req, res, next) => quizController().get(req, res, next));
  router.delete('/quizzes/:id', (req, res, next) => quizController().remove(req, res, next));

  return router;
}
