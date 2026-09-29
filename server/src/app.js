import express from 'express';
import { createClerkConfiguration } from './config/clerk.js';
import { errorHandler } from './middlewares/index.js';
import { createApiRouter } from './routes/index.js';

export function createApp({ clerkOptions = {}, configured = Boolean(process.env.CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY), noteModel, databaseConfigured = Boolean(process.env.MONGODB_URI), aiClient } = {}) {
  const app = express();
  const clerk = createClerkConfiguration({ clerkOptions, configured });
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  app.get('/api/health', (req, res) => res.set('Cache-Control', 'no-store').json({ status: 'ok' }));

  // Fail closed: missing keys never create a fake signed-in user.
  app.use('/api', createApiRouter({ clerk, NoteModel: noteModel, databaseConfigured, aiClient }));
  app.use((req, res) => res.status(404).json({ message: 'This endpoint does not exist.' }));
  app.use(errorHandler);
  return app;
}
export const app = createApp();
