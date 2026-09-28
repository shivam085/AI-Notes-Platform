import mongoose from 'mongoose';
import { Note } from '../models/Note.js';

export class NoteInputError extends Error {}
export class NoteNotFoundError extends Error {}
export class NoteVersionConflictError extends Error {}

function normalizeTags(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new NoteInputError('Tags must be a list.');
  const tags = [...new Set(value.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean))];
  if (tags.length > 10 || tags.some((tag) => tag.length > 30)) throw new NoteInputError('Use up to 10 tags, each at most 30 characters.');
  return tags;
}

export function validateNoteInput(input = {}) {
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  const content = typeof input.content === 'string' ? input.content : '';
  const folderId = input.folderId == null || input.folderId === '' ? null : String(input.folderId).trim();
  if (!title || title.length > 140) throw new NoteInputError('Title must be between 1 and 140 characters.');
  if (content.length > 50000) throw new NoteInputError('Content must be at most 50,000 characters.');
  if (folderId && folderId.length > 100) throw new NoteInputError('Folder must be at most 100 characters.');
  return { title, content, folderId, tags: normalizeTags(input.tags) };
}

function requireValidId(id) {
  if (!mongoose.isObjectIdOrHexString(id)) throw new NoteNotFoundError();
}

export function createNoteService(NoteModel = Note) {
  return {
    async create(ownerId, input) {
      return NoteModel.create({ ownerId, ...validateNoteInput(input) });
    },
    async list(ownerId, search) {
      const query = typeof search === 'string' ? search.trim() : '';
      if (query.length > 100) throw new NoteInputError('Search must be at most 100 characters.');
      const filter = { ownerId, ...(query ? { $text: { $search: query } } : {}) };
      return NoteModel.find(filter).sort(query ? { score: { $meta: 'textScore' }, updatedAt: -1 } : { updatedAt: -1 }).lean();
    },
    async getById(ownerId, id) {
      requireValidId(id);
      const note = await NoteModel.findOne({ _id: id, ownerId }).lean();
      if (!note) throw new NoteNotFoundError();
      return note;
    },
    async update(ownerId, id, input) {
      requireValidId(id);
      const version = Number(input?.version);
      if (!Number.isInteger(version) || version < 0) throw new NoteInputError('A current note version is required to save.');
      const note = await NoteModel.findOneAndUpdate({ _id: id, ownerId, version }, { $set: validateNoteInput(input), $inc: { version: 1 } }, { new: true, runValidators: true }).lean();
      if (note) return note;
      if (await NoteModel.exists({ _id: id, ownerId })) throw new NoteVersionConflictError();
      throw new NoteNotFoundError();
    },
    async remove(ownerId, id) {
      requireValidId(id);
      const note = await NoteModel.findOneAndDelete({ _id: id, ownerId }).lean();
      if (!note) throw new NoteNotFoundError();
    },
  };
}
