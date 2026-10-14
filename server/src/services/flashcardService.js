import mongoose from 'mongoose';
import { StudySet } from '../models/StudySet.js';
import { AiServiceConfigurationError, AiServiceUnavailableError } from './aiServiceClient.js';

export { AiServiceConfigurationError, AiServiceUnavailableError };

export class FlashcardInputError extends Error {}
export class FlashcardSetNotFoundError extends Error {}

const maxFlashcardInputChars = 12_000;

function normalizeCardText(value, fieldName, maximumLength) {
  const text = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  if (!text || text.length > maximumLength) {
    throw new FlashcardInputError(`${fieldName} must contain 1 to ${maximumLength} characters.`);
  }
  return text;
}

function normalizeCards(value) {
  if (!Array.isArray(value) || value.length !== 5) {
    throw new FlashcardInputError('Save exactly five flashcards.');
  }

  return value.map((card) => ({
    question: normalizeCardText(card?.question, 'Each flashcard question', 240),
    answer: normalizeCardText(card?.answer, 'Each flashcard answer', 1_000),
  }));
}

function requireValidId(id) {
  if (!mongoose.isObjectIdOrHexString(id)) throw new FlashcardSetNotFoundError();
}

function serializeStudySet(studySet, includeCards = false) {
  return {
    _id: studySet._id.toString(),
    type: studySet.type,
    title: studySet.title,
    source: studySet.source,
    cardCount: studySet.cards.length,
    createdAt: studySet.createdAt,
    updatedAt: studySet.updatedAt,
    ...(includeCards ? { cards: studySet.cards.map((card) => ({ question: card.question, answer: card.answer })) } : {}),
  };
}

export function createFlashcardService({ noteService, aiClient, StudySetModel = StudySet }) {
  async function getOwnedNote(ownerId, noteId) {
    const note = await noteService.getById(ownerId, noteId);
    const text = note.content.trim();

    if (!text) throw new FlashcardInputError('Add some note content before creating flashcards.');
    if (text.length > maxFlashcardInputChars) {
      throw new FlashcardInputError('Keep note content to 12,000 characters or fewer before creating flashcards.');
    }

    return { note, text };
  }

  async function getOwnedStudySet(ownerId, studySetId) {
    requireValidId(studySetId);
    const studySet = await StudySetModel.findOne({ _id: studySetId, ownerId, type: 'flashcards' }).lean();
    if (!studySet) throw new FlashcardSetNotFoundError();
    return studySet;
  }

  return {
    async generateForNote(ownerId, noteId) {
      const { note, text } = await getOwnedNote(ownerId, noteId);
      return {
        noteId: note._id.toString(),
        noteTitle: note.title,
        cards: normalizeCards(await aiClient.generateFlashcards({ title: note.title, text })),
      };
    },

    async save(ownerId, input = {}) {
      if (typeof input.noteId !== 'string') throw new FlashcardInputError('A saved note is required to save flashcards.');
      const { note } = await getOwnedNote(ownerId, input.noteId);
      const studySet = await StudySetModel.create({
        ownerId,
        type: 'flashcards',
        title: `${note.title} flashcards`,
        source: { sourceType: 'note', sourceId: note._id.toString(), title: note.title },
        cards: normalizeCards(input.cards),
      });
      return serializeStudySet(studySet, true);
    },

    async list(ownerId) {
      const studySets = await StudySetModel.find({ ownerId, type: 'flashcards' }).sort({ updatedAt: -1 }).lean();
      return studySets.map((studySet) => serializeStudySet(studySet));
    },

    async get(ownerId, studySetId) {
      return serializeStudySet(await getOwnedStudySet(ownerId, studySetId), true);
    },

    async remove(ownerId, studySetId) {
      requireValidId(studySetId);
      const studySet = await StudySetModel.findOneAndDelete({ _id: studySetId, ownerId, type: 'flashcards' }).lean();
      if (!studySet) throw new FlashcardSetNotFoundError();
    },
  };
}
