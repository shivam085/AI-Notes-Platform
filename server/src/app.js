import express from 'express';
import { createClerkConfiguration } from './config/clerk.js';
import { createAuthRouter } from './routes/auth.js';
import { createNotesRouter } from './routes/notes.js';
import { createAiRouter } from './routes/ai.js';

export function createApp({ clerkOptions = {}, configured = Boolean(process.env.CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY), noteModel, databaseConfigured = Boolean(process.env.MONGODB_URI), aiClient } = {}) {
  const app = express();
  const clerk = createClerkConfiguration({ clerkOptions, configured });
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  app.get('/api/health', (req, res) => res.set('Cache-Control', 'no-store').json({ status: 'ok' }));

  // Fail closed: missing keys never create a fake signed-in user.
  app.use('/api/auth', clerk.requireConfiguration, clerk.middleware, createAuthRouter());
  app.use('/api/notes', clerk.requireConfiguration, clerk.middleware);
  app.use('/api/notes', createNotesRouter({ NoteModel: noteModel, databaseConfigured }));
  app.use('/api/ai', clerk.requireConfiguration, clerk.middleware);
  app.use('/api/ai', createAiRouter({ NoteModel: noteModel, databaseConfigured, aiClient }));
  app.use((req, res) => res.status(404).json({ message: 'This endpoint does not exist.' }));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    // Do not expose SDK errors, tokens or secret configuration to the client.
    console.error('Clerk authentication middleware error:', error?.code || error?.name || 'UnknownError');
    res.status(503).json({ message: 'Sign-in verification is unavailable. Please try again.' });
  });
  return app;
}
export const app = createApp();
