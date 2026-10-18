import { getAuth } from '@clerk/express';
import { NoteInputError, NoteNotFoundError } from '../services/noteService.js';
import { StudyInputError, StudySetNotFoundError } from '../services/studyService.js';
import { AiServiceConfigurationError, AiServiceUnavailableError } from '../services/aiServiceClient.js';

export function createStudyController(studyService, notFoundMessage) {
  function ownerIdFromRequest(req, res) {
    const { userId } = getAuth(req);
    res.set('Cache-Control', 'no-store');
    if (!userId) {
      res.status(401).json({ message: 'Sign in to use study tools.' });
      return null;
    }
    return userId;
  }

  function respondToError(error, res, next) {
    if (error instanceof NoteInputError || error instanceof StudyInputError) return res.status(400).json({ message: error.message });
    if (error instanceof NoteNotFoundError || error instanceof StudySetNotFoundError) return res.status(404).json({ message: notFoundMessage });
    if (error instanceof AiServiceConfigurationError) return res.status(503).json({ message: error.message });
    if (error instanceof AiServiceUnavailableError) return res.status(502).json({ message: error.message });
    return next(error);
  }

  return {
    async generate(req, res, next) {
      const ownerId = ownerIdFromRequest(req, res);
      if (!ownerId) return;
      try {
        return res.json(await studyService.generateForNote(ownerId, req.body?.noteId));
      } catch (error) { return respondToError(error, res, next); }
    },
    async save(req, res, next) {
      const ownerId = ownerIdFromRequest(req, res);
      if (!ownerId) return;
      try {
        return res.status(201).json({ studySet: await studyService.save(ownerId, req.body) });
      } catch (error) { return respondToError(error, res, next); }
    },
    async list(req, res, next) {
      const ownerId = ownerIdFromRequest(req, res);
      if (!ownerId) return;
      try {
        return res.json({ studySets: await studyService.list(ownerId) });
      } catch (error) { return respondToError(error, res, next); }
    },
    async get(req, res, next) {
      const ownerId = ownerIdFromRequest(req, res);
      if (!ownerId) return;
      try {
        return res.json({ studySet: await studyService.get(ownerId, req.params.id) });
      } catch (error) { return respondToError(error, res, next); }
    },
    async remove(req, res, next) {
      const ownerId = ownerIdFromRequest(req, res);
      if (!ownerId) return;
      try {
        await studyService.remove(ownerId, req.params.id);
        return res.status(204).end();
      } catch (error) { return respondToError(error, res, next); }
    },
  };
}
