import { clerkMiddleware } from '@clerk/express';

export function createClerkConfiguration({ clerkOptions = {}, configured = Boolean(process.env.CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY) } = {}) {
  const authorizedParties = (process.env.CLERK_AUTHORIZED_PARTIES || 'http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:4173')
    .split(',').map((value) => value.trim()).filter(Boolean);

  return {
    requireConfiguration(req, res, next) {
      res.set('Cache-Control', 'no-store');
      if (!configured) return res.status(503).json({ message: 'Sign-in is not configured on the server yet.' });
      next();
    },
    middleware: clerkMiddleware({ authorizedParties, ...clerkOptions }),
  };
}
