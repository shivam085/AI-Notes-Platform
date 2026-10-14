import { getAuth } from '@clerk/express';
import { NoteInputError, NoteNotFoundError } from '../services/noteService.js';
import { AiServiceConfigurationError, AiServiceUnavailableError, QuizInputError, QuizSetNotFoundError } from '../services/quizService.js';

function ownerIdFromRequest(req, res) {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ message: 'Sign in to use quizzes.' });
    return null;
  }
  return userId;
}

function respondToError(error, res, next) {
  if (error instanceof NoteInputError || error instanceof QuizInputError) return res.status(400).json({ message: error.message });
  if (error instanceof NoteNotFoundError || error instanceof QuizSetNotFoundError) return res.status(404).json({ message: 'Quiz or source note not found.' });
  if (error instanceof AiServiceConfigurationError) return res.status(503).json({ message: error.message });
  if (error instanceof AiServiceUnavailableError) return res.status(502).json({ message: error.message });
  return next(error);
}

export function createQuizController(quizService) {
  return {
    async generate(req, res, next) {
      const ownerId = ownerIdFromRequest(req, res);
      if (!ownerId) return;
      if (typeof req.body?.noteId !== 'string') return res.status(400).json({ message: 'A saved note is required to create a quiz.' });
      try {
        return res.set('Cache-Control', 'no-store').json(await quizService.generateForNote(ownerId, req.body.noteId));
      } catch (error) { return respondToError(error, res, next); }
    },

    async save(req, res, next) {
      const ownerId = ownerIdFromRequest(req, res);
      if (!ownerId) return;
      try {
        return res.status(201).json({ studySet: await quizService.save(ownerId, req.body) });
      } catch (error) { return respondToError(error, res, next); }
    },

    async list(req, res, next) {
      const ownerId = ownerIdFromRequest(req, res);
      if (!ownerId) return;
      try {
        return res.set('Cache-Control', 'no-store').json({ studySets: await quizService.list(ownerId) });
      } catch (error) { return respondToError(error, res, next); }
    },

    async get(req, res, next) {
      const ownerId = ownerIdFromRequest(req, res);
      if (!ownerId) return;
      try {
        return res.set('Cache-Control', 'no-store').json({ studySet: await quizService.get(ownerId, req.params.id) });
      } catch (error) { return respondToError(error, res, next); }
    },

    async remove(req, res, next) {
      const ownerId = ownerIdFromRequest(req, res);
      if (!ownerId) return;
      try {
        await quizService.remove(ownerId, req.params.id);
        return res.status(204).end();
      } catch (error) { return respondToError(error, res, next); }
    },
  };
}
