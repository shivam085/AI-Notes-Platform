import { getAuth } from '@clerk/express';
import { AiServiceConfigurationError, AiServiceUnavailableError } from '../services/aiServiceClient.js';
import { RagConversationNotFoundError, RagInputError } from '../services/ragService.js';
import { SemanticSearchInputError } from '../services/semanticSearchService.js';

function ownerIdFromRequest(req, res) {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ message: 'Sign in to ask questions about your documents.' });
    return null;
  }
  return userId;
}

function respondToError(error, res, next) {
  if (error instanceof RagInputError || error instanceof SemanticSearchInputError) return res.status(400).json({ message: error.message });
  if (error instanceof RagConversationNotFoundError) return res.status(404).json({ message: 'Conversation not found.' });
  if (error instanceof AiServiceConfigurationError) return res.status(503).json({ message: error.message });
  if (error instanceof AiServiceUnavailableError) return res.status(502).json({ message: error.message });
  return next(error);
}

export function createRagController(ragService) {
  return {
    async ask(req, res, next) {
      const ownerId = ownerIdFromRequest(req, res);
      if (!ownerId) return;
      try {
        return res.status(req.body?.conversationId ? 200 : 201).json(await ragService.ask(ownerId, req.body));
      } catch (error) { return respondToError(error, res, next); }
    },
    async list(req, res, next) {
      const ownerId = ownerIdFromRequest(req, res);
      if (!ownerId) return;
      try { return res.json({ conversations: await ragService.list(ownerId) }); } catch (error) { return respondToError(error, res, next); }
    },
    async get(req, res, next) {
      const ownerId = ownerIdFromRequest(req, res);
      if (!ownerId) return;
      try { return res.json(await ragService.get(ownerId, req.params.id)); } catch (error) { return respondToError(error, res, next); }
    },
    async remove(req, res, next) {
      const ownerId = ownerIdFromRequest(req, res);
      if (!ownerId) return;
      try {
        await ragService.remove(ownerId, req.params.id);
        return res.status(204).end();
      } catch (error) { return respondToError(error, res, next); }
    },
  };
}
