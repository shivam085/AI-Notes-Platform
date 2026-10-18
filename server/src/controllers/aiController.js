import { getAuth } from '@clerk/express';
import { NoteInputError, NoteNotFoundError } from '../services/noteService.js';
import { DocumentNotFoundError, DocumentProcessingStateError } from '../services/documentService.js';
import { TagSuggestionInputError } from '../services/aiService.js';
import { AiServiceConfigurationError, AiServiceUnavailableError } from '../services/aiServiceClient.js';

function respondToError(error, res, next) {
  if (error instanceof NoteInputError || error instanceof TagSuggestionInputError) return res.status(400).json({ message: error.message });
  if (error instanceof NoteNotFoundError) return res.status(404).json({ message: 'Note not found.' });
  if (error instanceof DocumentNotFoundError) return res.status(404).json({ message: 'Document not found.' });
  if (error instanceof DocumentProcessingStateError) return res.status(409).json({ message: error.message });
  if (error instanceof AiServiceConfigurationError) return res.status(503).json({ message: error.message });
  if (error instanceof AiServiceUnavailableError) return res.status(502).json({ message: error.message });
  return next(error);
}

export function createAiController(aiService) {
  return {
    async summarize(req, res, next) {
      const { userId } = getAuth(req);
      if (!userId) return res.status(401).json({ message: 'Sign in to summarize a note.' });
      if (typeof req.body?.noteId !== 'string') return res.status(400).json({ message: 'A saved note is required to create a summary.' });
      try {
        return res.set('Cache-Control', 'no-store').json(await aiService.summarizeNote(userId, req.body.noteId));
      } catch (error) {
        return respondToError(error, res, next);
      }
    },

    async suggest(req, res, next) {
      const { userId } = getAuth(req);
      if (!userId) return res.status(401).json({ message: 'Sign in to request note tags.' });
      if (typeof req.body?.noteId !== 'string') return res.status(400).json({ message: 'A saved note is required for tag suggestions.' });
      try {
        return res.set('Cache-Control', 'no-store').json(await aiService.suggestTagsForNote(userId, req.body.noteId));
      } catch (error) {
        return respondToError(error, res, next);
      }
    },

    async suggestDocument(req, res, next) {
      const { userId } = getAuth(req);
      if (!userId) return res.status(401).json({ message: 'Sign in to request document tags.' });
      try {
        return res.set('Cache-Control', 'no-store').json(await aiService.suggestTagsForDocument(userId, req.params.id));
      } catch (error) {
        return respondToError(error, res, next);
      }
    },
  };
}
