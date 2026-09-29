import { Router } from 'express';
import { createNotesController } from '../controllers/index.js';
import { Note } from '../models/index.js';
import { createNoteService } from '../services/index.js';

export function createNotesRouter({ clerk, NoteModel = Note, databaseConfigured = Boolean(process.env.MONGODB_URI) } = {}) {
  const router = Router();
  const controller = createNotesController(createNoteService(NoteModel));

  // All note endpoints require a verified Clerk identity.
  router.use(clerk.requireConfiguration, clerk.middleware);

  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');

    if (!databaseConfigured) {
      return res.status(503).json({ message: 'Notes are not configured on the server yet.' });
    }

    return next();
  });

  router.post('/', controller.create);
  router.get('/', controller.list);
  router.get('/:id', controller.getById);
  router.put('/:id', controller.update);
  router.delete('/:id', controller.remove);

  return router;
}
