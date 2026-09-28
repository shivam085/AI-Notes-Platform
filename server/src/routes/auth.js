import { Router } from 'express';
import { getCurrentUser } from '../controllers/authController.js';

export function createAuthRouter() {
  const router = Router();
  router.get('/me', getCurrentUser);
  return router;
}
