import { getAuth } from '@clerk/express';
import { NoteInputError, NoteNotFoundError } from '../services/noteService.js';
import { AiServiceConfigurationError, AiServiceUnavailableError, FlashcardInputError, FlashcardSetNotFoundError } from '../services/flashcardService.js';

function ownerIdFromRequest(req, res) {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ message: 'Sign in to use flashcards.' });
    return null;
  }
  return userId;
}

function respondToError(error, res, next) {
  if (error instanceof NoteInputError || error instanceof FlashcardInputError) return res.status(400).json({ message: error.message });
  if (error instanceof NoteNotFoundError || error instanceof FlashcardSetNotFoundError) return res.status(404).json({ message: 'Flashcard set or source note not found.' });
  if (error instanceof AiServiceConfigurationError) return res.status(503).json({ message: error.message });
  if (error instanceof AiServiceUnavailableError) return res.status(502).json({ message: error.message });
  return next(error);
}

export function createFlashcardsController(flashcardService) {
  return {
    async generate(req, res, next) {
      const ownerId = ownerIdFromRequest(req, res);
      if (!ownerId) return;
      if (typeof req.body?.noteId !== 'string') return res.status(400).json({ message: 'A saved note is required to create flashcards.' });
      try {
        return res.set('Cache-Control', 'no-store').json(await flashcardService.generateForNote(ownerId, req.body.noteId));
      } catch (error) { return respondToError(error, res, next); }
    },

    async save(req, res, next) {
      const ownerId = ownerIdFromRequest(req, res);
      if (!ownerId) return;
      try {
        return res.status(201).json({ studySet: await flashcardService.save(ownerId, req.body) });
      } catch (error) { return respondToError(error, res, next); }
    },

    async list(req, res, next) {
      const ownerId = ownerIdFromRequest(req, res);
      if (!ownerId) return;
      try {
        return res.set('Cache-Control', 'no-store').json({ studySets: await flashcardService.list(ownerId) });
      } catch (error) { return respondToError(error, res, next); }
    },

    async get(req, res, next) {
      const ownerId = ownerIdFromRequest(req, res);
      if (!ownerId) return;
      try {
        return res.set('Cache-Control', 'no-store').json({ studySet: await flashcardService.get(ownerId, req.params.id) });
      } catch (error) { return respondToError(error, res, next); }
    },

    async remove(req, res, next) {
      const ownerId = ownerIdFromRequest(req, res);
      if (!ownerId) return;
      try {
        await flashcardService.remove(ownerId, req.params.id);
        return res.status(204).end();
      } catch (error) { return respondToError(error, res, next); }
    },
  };
}
