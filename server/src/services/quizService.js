import mongoose from 'mongoose';
import { StudySet } from '../models/StudySet.js';
import { AiServiceConfigurationError, AiServiceUnavailableError } from './aiServiceClient.js';

export { AiServiceConfigurationError, AiServiceUnavailableError };

export class QuizInputError extends Error {}
export class QuizSetNotFoundError extends Error {}

const maxQuizInputChars = 12_000;

function normalizeText(value, fieldName, maximumLength) {
  const text = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  if (!text || text.length > maximumLength) {
    throw new QuizInputError(`${fieldName} must contain 1 to ${maximumLength} characters.`);
  }
  return text;
}

function normalizeQuestions(value) {
  if (!Array.isArray(value) || value.length !== 5) {
    throw new QuizInputError('Save exactly five quiz questions.');
  }

  return value.map((item) => {
    const options = Array.isArray(item?.options)
      ? item.options.map((option) => normalizeText(option, 'Each quiz option', 240))
      : [];
    const correctOptionIndex = item?.correctOptionIndex;

    if (options.length !== 4 || new Set(options).size !== 4) {
      throw new QuizInputError('Each quiz question needs four different options.');
    }
    if (!Number.isInteger(correctOptionIndex) || correctOptionIndex < 0 || correctOptionIndex > 3) {
      throw new QuizInputError('Each quiz question needs a valid correct option.');
    }

    return {
      question: normalizeText(item?.question, 'Each quiz question', 240),
      options,
      correctOptionIndex,
      explanation: normalizeText(item?.explanation, 'Each quiz explanation', 1_000),
    };
  });
}

function requireValidId(id) {
  if (!mongoose.isObjectIdOrHexString(id)) throw new QuizSetNotFoundError();
}

function serializeStudySet(studySet, includeQuestions = false) {
  return {
    _id: studySet._id.toString(),
    type: studySet.type,
    title: studySet.title,
    source: studySet.source,
    questionCount: studySet.questions.length,
    createdAt: studySet.createdAt,
    updatedAt: studySet.updatedAt,
    ...(includeQuestions ? {
      questions: studySet.questions.map((item) => ({
        question: item.question,
        options: item.options,
        correctOptionIndex: item.correctOptionIndex,
        explanation: item.explanation,
      })),
    } : {}),
  };
}

export function createQuizService({ noteService, aiClient, StudySetModel = StudySet }) {
  async function getOwnedNote(ownerId, noteId) {
    const note = await noteService.getById(ownerId, noteId);
    const text = note.content.trim();

    if (!text) throw new QuizInputError('Add some note content before creating a quiz.');
    if (text.length > maxQuizInputChars) {
      throw new QuizInputError('Keep note content to 12,000 characters or fewer before creating a quiz.');
    }

    return { note, text };
  }

  async function getOwnedStudySet(ownerId, studySetId) {
    requireValidId(studySetId);
    const studySet = await StudySetModel.findOne({ _id: studySetId, ownerId, type: 'quiz' }).lean();
    if (!studySet) throw new QuizSetNotFoundError();
    return studySet;
  }

  return {
    async generateForNote(ownerId, noteId) {
      const { note, text } = await getOwnedNote(ownerId, noteId);
      return {
        noteId: note._id.toString(),
        noteTitle: note.title,
        questions: normalizeQuestions(await aiClient.generateQuiz({ title: note.title, text })),
      };
    },

    async save(ownerId, input = {}) {
      if (typeof input.noteId !== 'string') throw new QuizInputError('A saved note is required to save a quiz.');
      const { note } = await getOwnedNote(ownerId, input.noteId);
      const studySet = await StudySetModel.create({
        ownerId,
        type: 'quiz',
        title: `${note.title} quiz`,
        source: { sourceType: 'note', sourceId: note._id.toString(), title: note.title },
        questions: normalizeQuestions(input.questions),
      });
      return serializeStudySet(studySet, true);
    },

    async list(ownerId) {
      const studySets = await StudySetModel.find({ ownerId, type: 'quiz' }).sort({ updatedAt: -1 }).lean();
      return studySets.map((studySet) => serializeStudySet(studySet));
    },

    async get(ownerId, studySetId) {
      return serializeStudySet(await getOwnedStudySet(ownerId, studySetId), true);
    },

    async remove(ownerId, studySetId) {
      requireValidId(studySetId);
      const studySet = await StudySetModel.findOneAndDelete({ _id: studySetId, ownerId, type: 'quiz' }).lean();
      if (!studySet) throw new QuizSetNotFoundError();
    },
  };
}
