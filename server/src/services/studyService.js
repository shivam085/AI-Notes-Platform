import mongoose from 'mongoose';
import { StudySet } from '../models/StudySet.js';

export class StudyInputError extends Error {}
export class StudySetNotFoundError extends Error {}

function normalizeText(value, fieldName, maximumLength) {
  const text = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  if (!text || text.length > maximumLength) {
    throw new StudyInputError(`${fieldName} must contain 1 to ${maximumLength} characters.`);
  }
  return text;
}

function normalizeCards(value) {
  if (!Array.isArray(value) || value.length !== 5) throw new StudyInputError('Save exactly five flashcards.');
  return value.map((card) => ({
    question: normalizeText(card?.question, 'Each flashcard question', 240),
    answer: normalizeText(card?.answer, 'Each flashcard answer', 1_000),
  }));
}

function normalizeQuestions(value) {
  if (!Array.isArray(value) || value.length !== 5) throw new StudyInputError('Save exactly five quiz questions.');
  return value.map((item) => {
    const options = Array.isArray(item?.options)
      ? item.options.map((option) => normalizeText(option, 'Each quiz option', 240))
      : [];
    const correctOptionIndex = item?.correctOptionIndex;
    if (options.length !== 4 || new Set(options).size !== 4) {
      throw new StudyInputError('Each quiz question needs four different options.');
    }
    if (!Number.isInteger(correctOptionIndex) || correctOptionIndex < 0 || correctOptionIndex > 3) {
      throw new StudyInputError('Each quiz question needs a valid correct option.');
    }
    return {
      question: normalizeText(item?.question, 'Each quiz question', 240),
      options,
      correctOptionIndex,
      explanation: normalizeText(item?.explanation, 'Each quiz explanation', 1_000),
    };
  });
}

// Flashcards and quizzes share storage and ownership rules, but keep explicit validators.
export function createStudyService({ type, noteService, getAiClient, StudySetModel = StudySet }) {
  if (!['flashcards', 'quiz'].includes(type)) throw new Error('Unsupported study-set type.');
  const isQuiz = type === 'quiz';
  const field = isQuiz ? 'questions' : 'cards';
  const countField = isQuiz ? 'questionCount' : 'cardCount';
  const normalize = isQuiz ? normalizeQuestions : normalizeCards;

  function filterById(ownerId, id) {
    if (!mongoose.isObjectIdOrHexString(id)) throw new StudySetNotFoundError();
    return { _id: id, ownerId, type };
  }

  function serialize(studySet, includeItems = false) {
    return {
      _id: studySet._id.toString(),
      type: studySet.type,
      title: studySet.title,
      source: studySet.source,
      [countField]: studySet[field].length,
      createdAt: studySet.createdAt,
      updatedAt: studySet.updatedAt,
      ...(includeItems ? { [field]: normalize(studySet[field]) } : {}),
    };
  }

  async function getOwnedNote(ownerId, noteId) {
    if (typeof noteId !== 'string') throw new StudyInputError('A saved note is required.');
    const note = await noteService.getById(ownerId, noteId);
    const text = note.content.trim();
    if (!text) throw new StudyInputError('Add some note content before creating study material.');
    if (text.length > 12_000) throw new StudyInputError('Keep note content to 12,000 characters or fewer.');
    return { note, text };
  }

  return {
    async generateForNote(ownerId, noteId) {
      const { note, text } = await getOwnedNote(ownerId, noteId);
      // Saved decks remain usable even when Gemini configuration is unavailable.
      const aiClient = getAiClient();
      const input = { title: note.title, text };
      const items = isQuiz ? await aiClient.generateQuiz(input) : await aiClient.generateFlashcards(input);
      return { noteId: note._id.toString(), noteTitle: note.title, [field]: normalize(items) };
    },
    async save(ownerId, input = {}) {
      const { note } = await getOwnedNote(ownerId, input.noteId);
      const studySet = await StudySetModel.create({
        ownerId,
        type,
        title: `${note.title} ${type}`,
        source: { sourceType: 'note', sourceId: note._id.toString(), title: note.title },
        [field]: normalize(input[field]),
      });
      return serialize(studySet, true);
    },
    async list(ownerId) {
      const studySets = await StudySetModel.find({ ownerId, type }).sort({ updatedAt: -1 }).lean();
      return studySets.map((studySet) => serialize(studySet));
    },
    async get(ownerId, id) {
      const studySet = await StudySetModel.findOne(filterById(ownerId, id)).lean();
      if (!studySet) throw new StudySetNotFoundError();
      return serialize(studySet, true);
    },
    async remove(ownerId, id) {
      const studySet = await StudySetModel.findOneAndDelete(filterById(ownerId, id)).lean();
      if (!studySet) throw new StudySetNotFoundError();
    },
  };
}
