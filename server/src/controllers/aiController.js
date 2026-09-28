import { getAuth } from '@clerk/express';
import { NoteInputError, NoteNotFoundError } from '../services/noteService.js';
import { AiServiceConfigurationError, AiServiceUnavailableError } from '../services/summaryService.js';

export function createAiController(summaryService) {
  return {
    async summarize(req, res) {
      const { userId } = getAuth(req);
      if (!userId) return res.status(401).json({ message: 'Sign in to summarize a note.' });
      if (typeof req.body?.noteId !== 'string') return res.status(400).json({ message: 'A saved note is required to create a summary.' });
      try {
        res.set('Cache-Control', 'no-store').json(await summaryService.summarizeNote(userId, req.body.noteId));
      } catch (error) {
        if (error instanceof NoteInputError || error.message === 'Add some note content before requesting a summary.') return res.status(400).json({ message: error.message });
        if (error instanceof NoteNotFoundError) return res.status(404).json({ message: 'Note not found.' });
        if (error instanceof AiServiceConfigurationError) return res.status(503).json({ message: error.message });
        if (error instanceof AiServiceUnavailableError) return res.status(502).json({ message: error.message });
        throw error;
      }
    },
  };
}
