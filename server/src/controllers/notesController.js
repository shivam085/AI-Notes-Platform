import { getAuth } from '@clerk/express';
import { NoteInputError, NoteNotFoundError, NoteVersionConflictError } from '../services/noteService.js';

function ownerIdFromRequest(req, res) {
  const { userId, sessionId } = getAuth(req);
  if (!userId || !sessionId) {
    res.status(401).json({ message: 'Please sign in to continue.' });
    return null;
  }
  return userId;
}

function respondToNoteError(error, res, next) {
  if (error instanceof NoteInputError) return res.status(400).json({ message: error.message });
  if (error instanceof NoteNotFoundError) return res.status(404).json({ message: 'Note not found.' });
  if (error instanceof NoteVersionConflictError) return res.status(409).json({ message: 'This note changed elsewhere. Reload it before saving.' });
  return next(error);
}

export function createNotesController(noteService) {
  return {
    async create(req, res, next) {
      const ownerId = ownerIdFromRequest(req, res);
      if (!ownerId) return;
      try { return res.status(201).json({ note: await noteService.create(ownerId, req.body) }); }
      catch (error) { return respondToNoteError(error, res, next); }
    },
    async list(req, res, next) {
      const ownerId = ownerIdFromRequest(req, res);
      if (!ownerId) return;
      try { return res.json({ notes: await noteService.list(ownerId, req.query.q) }); }
      catch (error) { return respondToNoteError(error, res, next); }
    },
    async getById(req, res, next) {
      const ownerId = ownerIdFromRequest(req, res);
      if (!ownerId) return;
      try { return res.json({ note: await noteService.getById(ownerId, req.params.id) }); }
      catch (error) { return respondToNoteError(error, res, next); }
    },
    async update(req, res, next) {
      const ownerId = ownerIdFromRequest(req, res);
      if (!ownerId) return;
      try { return res.json({ note: await noteService.update(ownerId, req.params.id, req.body) }); }
      catch (error) { return respondToNoteError(error, res, next); }
    },
    async remove(req, res, next) {
      const ownerId = ownerIdFromRequest(req, res);
      if (!ownerId) return;
      try { await noteService.remove(ownerId, req.params.id); return res.status(204).end(); }
      catch (error) { return respondToNoteError(error, res, next); }
    },
  };
}
