import { AiServiceConfigurationError, AiServiceUnavailableError } from './aiServiceClient.js';

export { AiServiceConfigurationError, AiServiceUnavailableError };

export function createSummaryService({ noteService, aiClient }) {
  return {
    async summarizeNote(ownerId, noteId) {
      const note = await noteService.getById(ownerId, noteId);
      const text = note.content.trim();
      if (!text) throw new Error('Add some note content before requesting a summary.');
      return { noteId: note._id.toString(), summary: await aiClient.summarize(text) };
    },
  };
}
