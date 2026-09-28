import { getAuth } from '@clerk/express';

export function getCurrentUser(req, res) {
  const { userId, sessionId } = getAuth(req);
  if (!userId || !sessionId) return res.status(401).json({ message: 'Please sign in to continue.' });
  return res.json({ userId });
}
