import { getAuth } from '@clerk/express';
import { AiServiceConfigurationError, AiServiceUnavailableError } from '../services/aiServiceClient.js';
import { SemanticSearchInputError } from '../services/semanticSearchService.js';

export function createSemanticSearchController(semanticSearchService) {
  function ownerIdFromRequest(req, res) {
    const { userId } = getAuth(req);
    if (!userId) {
      res.status(401).json({ message: 'Sign in to search your notes and documents.' });
      return null;
    }
    return userId;
  }

  function respondToError(error, res, next) {
    if (error instanceof SemanticSearchInputError) return res.status(400).json({ message: error.message });
    if (error instanceof AiServiceConfigurationError) return res.status(503).json({ message: error.message });
    if (error instanceof AiServiceUnavailableError) return res.status(502).json({ message: error.message });
    return next(error);
  }

  return {
    async reindex(req, res, next) {
      const ownerId = ownerIdFromRequest(req, res);
      if (!ownerId) return;
      try {
        return res.json(await semanticSearchService.reindexReadyDocuments(ownerId));
      } catch (error) {
        return respondToError(error, res, next);
      }
    },
    async search(req, res, next) {
      const ownerId = ownerIdFromRequest(req, res);
      if (!ownerId) return;
      try {
        const results = await semanticSearchService.search(ownerId, req.query);
        return res.json({ results });
      } catch (error) {
        return respondToError(error, res, next);
      }
    },
  };
}
