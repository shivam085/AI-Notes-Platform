import { Router } from 'express';
import { getCurrentUser } from '../controllers/index.js';

export function createAuthRouter({ clerk } = {}) {
  const router = Router();

  // Every authentication endpoint needs Clerk to verify the supplied session token.
  router.use(clerk.requireConfiguration, clerk.middleware);
  router.get('/me', getCurrentUser);

  return router;
}
