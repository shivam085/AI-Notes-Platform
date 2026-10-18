import { NoteInputError } from './noteService.js';

export class TagSuggestionInputError extends Error {}

const maxTagSuggestionInputChars = 12_000;

function requireTaggableText(text, emptyMessage, limitMessage) {
  const normalizedText = String(text || '').trim();

  if (!normalizedText) throw new TagSuggestionInputError(emptyMessage);
  if (normalizedText.length > maxTagSuggestionInputChars) {
    throw new TagSuggestionInputError(limitMessage);
  }

  return normalizedText;
}

function documentText(document) {
  return (document.extractedPages || []).map((page) => page.text?.trim()).filter(Boolean).join('\n\n');
}

export function createAiService({ noteService, documentService, aiClient }) {
  return {
    async summarizeNote(ownerId, noteId) {
      const note = await noteService.getById(ownerId, noteId);
      const text = note.content.trim();
      if (!text) throw new NoteInputError('Add some note content before requesting a summary.');
      return { noteId: note._id.toString(), summary: await aiClient.summarize(text) };
    },

    async suggestTagsForNote(ownerId, noteId) {
      const note = await noteService.getById(ownerId, noteId);
      const text = requireTaggableText(
        note.content,
        'Add some note content before requesting tag suggestions.',
        'Keep note content to 12,000 characters or fewer before requesting tag suggestions.',
      );

      return {
        noteId: note._id.toString(),
        tags: await aiClient.suggestTags({ title: note.title, text }),
      };
    },

    async suggestTagsForDocument(ownerId, documentId) {
      const document = await documentService.getExtractedText(ownerId, documentId);
      const text = requireTaggableText(
        documentText(document),
        'Extract text from this document before requesting tag suggestions.',
        'Keep extracted document text to 12,000 characters or fewer before requesting tag suggestions.',
      );

      return {
        documentId: document._id.toString(),
        tags: await aiClient.suggestTags({ title: document.originalName, text }),
      };
    },
  };
}
