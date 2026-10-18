import { AiServiceConfigurationError, DocumentExtractionInputError, AiServiceUnavailableError } from './aiServiceClient.js';
import { DocumentProcessingSupersededError } from './documentService.js';

export {
  AiServiceConfigurationError,
  DocumentExtractionInputError,
  AiServiceUnavailableError,
};

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export function createDocumentProcessingService({
  documentService,
  documentStorage,
  knowledgeChunkService,
  getExtractionClient,
  maximumProviderAttempts = 2,
  waitImplementation = wait,
}) {
  async function extractWithRetry(document) {
    let lastError;
    for (let attempt = 1; attempt <= maximumProviderAttempts; attempt += 1) {
      try {
        const sourceUrl = documentStorage.createAccessUrl({
          publicId: document.cloudinaryPublicId,
          format: document.format,
          download: false,
        });
        return await getExtractionClient().extractDocument(sourceUrl, document.format);
      } catch (error) {
        lastError = error;
        if (!(error instanceof AiServiceUnavailableError) || attempt === maximumProviderAttempts) throw error;
        await waitImplementation(250 * (2 ** (attempt - 1)));
      }
    }
    throw lastError;
  }

  async function processClaimedDocument(document) {
    const ownerId = document.ownerId;
    const documentId = document._id.toString();
    const runId = document.processingRunId;

    try {
      const extracted = await extractWithRetry(document);
      const chunkCount = await knowledgeChunkService.replaceDocumentChunks(ownerId, documentId, extracted.chunks);
      return await documentService.completeProcessing(ownerId, documentId, runId, extracted.pages, chunkCount);
    } catch (error) {
      try {
        await knowledgeChunkService.removeDocumentChunks(ownerId, documentId);
        if (!(error instanceof DocumentProcessingSupersededError)) {
          await documentService.failProcessing(ownerId, documentId, runId, error.message);
        }
      } catch {
        // The original processing error is the most useful result for this request.
      }
      throw error;
    }
  }

  return {
    async processDocument(ownerId, documentId) {
      const document = await documentService.beginProcessing(ownerId, documentId);
      return processClaimedDocument(document);
    },
    async recoverDocument(ownerId, documentId) {
      const document = await documentService.reclaimInterruptedProcessing(ownerId, documentId);
      if (!document) {
        await documentService.failExhaustedRecovery(
          ownerId,
          documentId,
          'Processing stopped after three attempts. Select Retry extraction to start a new attempt.',
        );
        return null;
      }
      return processClaimedDocument(document);
    },
  };
}
