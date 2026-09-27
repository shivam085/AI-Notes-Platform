import express from 'express';
import { clerkMiddleware, getAuth } from '@clerk/express';

export function createApp({ clerkOptions = {}, configured = Boolean(process.env.CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY) } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.get('/api/health', (req, res) => res.set('Cache-Control', 'no-store').json({ status: 'ok' }));

  // Fail closed: missing keys never create a fake signed-in user.
  app.use('/api/auth', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!configured) return res.status(503).json({ message: 'Sign-in is not configured on the server yet.' });
    next();
  });
  app.use('/api/auth', clerkMiddleware({
    authorizedParties: (process.env.CLERK_AUTHORIZED_PARTIES || 'http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:4173').split(',').map(value => value.trim()).filter(Boolean),
    ...clerkOptions,
  }));
  app.get('/api/auth/me', (req, res) => {
    const { userId, sessionId } = getAuth(req);
    if (!userId || !sessionId) return res.status(401).json({ message: 'Please sign in to continue.' });
    // Identity comes from Clerk's verified token, never a query/body userId.
    res.json({ userId });
  });
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
