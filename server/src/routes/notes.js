import { Router } from 'express';
import { Note } from '../models/Note.js';
import { createNotesController } from '../controllers/notesController.js';
import { createNoteService } from '../services/noteService.js';

export function createNotesRouter({ NoteModel = Note, databaseConfigured = Boolean(process.env.MONGODB_URI) } = {}) {
  const router = Router();
  const controller = createNotesController(createNoteService(NoteModel));

  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!databaseConfigured) return res.status(503).json({ message: 'Notes are not configured on the server yet.' });
    next();
  });
  router.route('/').post(controller.create).get(controller.list);
  router.route('/:id').get(controller.getById).put(controller.update).delete(controller.remove);

  return router;
}
