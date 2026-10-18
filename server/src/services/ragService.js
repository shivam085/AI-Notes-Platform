import mongoose from 'mongoose';
import { Conversation } from '../models/Conversation.js';
import { Document } from '../models/Document.js';
import { KnowledgeChunk } from '../models/KnowledgeChunk.js';
import { Message } from '../models/Message.js';

export class RagInputError extends Error {}
export class RagConversationNotFoundError extends Error {}

export const insufficientContextAnswer = "I couldn't find enough information in your documents to answer that.";

function normalizeQuestion(value) {
  const question = typeof value === 'string' ? value.trim() : '';
  if (!question) throw new RagInputError('Enter a question about your documents.');
  if (question.length > 2_000) throw new RagInputError('Questions must be at most 2,000 characters.');
  return question;
}

function requireValidConversationId(id) {
  if (!mongoose.isObjectIdOrHexString(id)) throw new RagConversationNotFoundError();
}

function serializeConversation(conversation) {
  return {
    _id: conversation._id.toString(),
    title: conversation.title,
    lastMessageAt: conversation.lastMessageAt,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
}

function serializeMessage(message, availableSourceIds = null) {
  const originalSources = message.sources || [];
  const sources = originalSources.filter((source) => (
    availableSourceIds === null || availableSourceIds.has(source.sourceId)
  ));
  return {
    _id: message._id.toString(),
    role: message.role,
    content: message.content,
    grounded: Boolean(message.grounded && sources.length),
    sourceUnavailable: Boolean(message.grounded && originalSources.length && !sources.length),
    sources: sources.map((source) => ({
      chunkId: source.chunkId,
      sourceType: source.sourceType,
      sourceId: source.sourceId,
      title: source.title,
      pageNumber: source.pageNumber || null,
      position: source.position,
    })),
    createdAt: message.createdAt,
  };
}

async function findOwnedContext({ ownerId, searchResults, minimumSimilarityScore, DocumentModel, KnowledgeChunkModel }) {
  const candidateResults = searchResults
    .filter((result) => result.sourceType === 'document' && Number.isFinite(result.score) && result.score >= minimumSimilarityScore)
    .slice(0, 4);
  if (!candidateResults.length) return [];

  const documentIds = [...new Set(candidateResults.map((result) => result.sourceId))];
  const chunkIds = [...new Set(candidateResults.map((result) => result.chunkId))];
  const [documents, chunks] = await Promise.all([
    DocumentModel.find({ ownerId, deletedAt: null, processingStatus: 'ready', _id: { $in: documentIds } }).lean(),
    KnowledgeChunkModel.find({ ownerId, sourceType: 'document', _id: { $in: chunkIds } }).lean(),
  ]);
  const documentById = new Map(documents.map((document) => [document._id.toString(), document]));
  const chunkById = new Map(chunks.map((chunk) => [chunk._id.toString(), chunk]));

  return candidateResults.flatMap((result) => {
    const document = documentById.get(result.sourceId);
    const chunk = chunkById.get(result.chunkId);
    if (!document || !chunk || chunk.sourceId !== result.sourceId) return [];
    return [{
      context: {
        chunk_id: chunk._id.toString(),
        source_id: document._id.toString(),
        title: document.originalName,
        page_number: chunk.pageNumber || undefined,
        text: chunk.text,
      },
      source: {
        chunkId: chunk._id.toString(),
        sourceType: 'document',
        sourceId: document._id.toString(),
        title: document.originalName,
        pageNumber: chunk.pageNumber || null,
        position: chunk.position,
      },
    }];
  });
}

export function createRagService({
  DocumentModel = Document,
  KnowledgeChunkModel = KnowledgeChunk,
  ConversationModel = Conversation,
  MessageModel = Message,
  semanticSearchService,
  ragClient,
  minimumSimilarityScore = Number(process.env.RAG_MIN_SIMILARITY_SCORE || 0.55),
}) {
  const safeMinimumSimilarityScore = Number.isFinite(minimumSimilarityScore) && minimumSimilarityScore >= 0 && minimumSimilarityScore <= 1
    ? minimumSimilarityScore
    : 0.55;

  async function getConversation(ownerId, conversationId) {
    requireValidConversationId(conversationId);
    const conversation = await ConversationModel.findOne({ _id: conversationId, ownerId }).lean();
    if (!conversation) throw new RagConversationNotFoundError();
    return conversation;
  }

  return {
    async ask(ownerId, input = {}) {
      const question = normalizeQuestion(input.question);
      const conversation = input.conversationId
        ? await getConversation(ownerId, input.conversationId)
        : await ConversationModel.create({ ownerId, title: question.slice(0, 160), lastMessageAt: new Date() });

      const searchResults = await semanticSearchService.search(ownerId, {
        query: question,
        limit: 4,
        sourceType: 'document',
      });
      const ownedContext = await findOwnedContext({ ownerId, searchResults, minimumSimilarityScore: safeMinimumSimilarityScore, DocumentModel, KnowledgeChunkModel });
      const response = ownedContext.length
        ? await ragClient.answerQuestion(question, ownedContext.map(({ context }) => context))
        : { answer: insufficientContextAnswer, grounded: false };

      const now = new Date();
      const [userMessage, assistantMessage] = await Promise.all([
        MessageModel.create({ ownerId, conversationId: conversation._id, role: 'user', content: question, grounded: false }),
        MessageModel.create({
          ownerId,
          conversationId: conversation._id,
          role: 'assistant',
          content: response.answer,
          grounded: response.grounded,
          sources: response.grounded ? ownedContext.map(({ source }) => source) : [],
        }),
      ]);
      const updatedConversation = await ConversationModel.findOneAndUpdate(
        { _id: conversation._id, ownerId },
        { $set: { lastMessageAt: now } },
        { new: true },
      ).lean();

      return {
        conversation: serializeConversation(updatedConversation || conversation),
        userMessage: serializeMessage(userMessage),
        assistantMessage: serializeMessage(assistantMessage),
      };
    },

    async list(ownerId) {
      const conversations = await ConversationModel.find({ ownerId }).sort({ lastMessageAt: -1 }).lean();
      return conversations.map(serializeConversation);
    },

    async get(ownerId, conversationId) {
      const conversation = await getConversation(ownerId, conversationId);
      const messages = await MessageModel.find({ ownerId, conversationId: conversation._id }).sort({ createdAt: 1 }).lean();
      const sourceIds = [...new Set(messages.flatMap((message) => (message.sources || []).map((source) => source.sourceId)))];
      const availableDocuments = sourceIds.length
        ? await DocumentModel.find({ ownerId, deletedAt: null, processingStatus: 'ready', _id: { $in: sourceIds } }).lean()
        : [];
      const availableSourceIds = new Set(availableDocuments.map((document) => document._id.toString()));
      return {
        conversation: serializeConversation(conversation),
        messages: messages.map((message) => serializeMessage(message, availableSourceIds)),
      };
    },

    async remove(ownerId, conversationId) {
      requireValidConversationId(conversationId);
      const conversation = await ConversationModel.findOneAndDelete({ _id: conversationId, ownerId }).lean();
      if (!conversation) throw new RagConversationNotFoundError();
      await MessageModel.deleteMany({ ownerId, conversationId: conversation._id });
    },
  };
}
