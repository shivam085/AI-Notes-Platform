import { getAuth } from '@clerk/express';
import { DocumentNotFoundError, DocumentProcessingStateError } from '../services/documentService.js';
import { NoteInputError, NoteNotFoundError } from '../services/noteService.js';
import { AiServiceConfigurationError, AiServiceUnavailableError, TagSuggestionInputError } from '../services/tagSuggestionService.js';

export function createTagController(tagSuggestionService) {
  return {
    async suggest(req, res) {
      const { userId } = getAuth(req);
      if (!userId) return res.status(401).json({ message: 'Sign in to request note tags.' });
      if (typeof req.body?.noteId !== 'string') return res.status(400).json({ message: 'A saved note is required for tag suggestions.' });

      try {
        return res.set('Cache-Control', 'no-store').json(await tagSuggestionService.suggestTagsForNote(userId, req.body.noteId));
      } catch (error) {
        if (error instanceof NoteInputError || error instanceof TagSuggestionInputError) return res.status(400).json({ message: error.message });
        if (error instanceof NoteNotFoundError) return res.status(404).json({ message: 'Note not found.' });
        if (error instanceof AiServiceConfigurationError) return res.status(503).json({ message: error.message });
        if (error instanceof AiServiceUnavailableError) return res.status(502).json({ message: error.message });
        throw error;
      }
    },

    async suggestDocument(req, res, next) {
      const { userId } = getAuth(req);
      if (!userId) return res.status(401).json({ message: 'Sign in to request document tags.' });

      try {
        return res.set('Cache-Control', 'no-store').json(await tagSuggestionService.suggestTagsForDocument(userId, req.params.id));
      } catch (error) {
        if (error instanceof TagSuggestionInputError) return res.status(400).json({ message: error.message });
        if (error instanceof DocumentNotFoundError) return res.status(404).json({ message: 'Document not found.' });
        if (error instanceof DocumentProcessingStateError) return res.status(409).json({ message: error.message });
        if (error instanceof AiServiceConfigurationError) return res.status(503).json({ message: error.message });
        if (error instanceof AiServiceUnavailableError) return res.status(502).json({ message: error.message });
        return next(error);
      }
    },
  };
}
