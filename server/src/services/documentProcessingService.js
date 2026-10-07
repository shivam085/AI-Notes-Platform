import {
  DocumentExtractionConfigurationError,
  DocumentExtractionInputError,
  DocumentExtractionUnavailableError,
} from './documentExtractionClient.js';

export {
  DocumentExtractionConfigurationError,
  DocumentExtractionInputError,
  DocumentExtractionUnavailableError,
};

export function createDocumentProcessingService({ documentService, documentStorage, knowledgeChunkService, getExtractionClient }) {
  return {
    async processDocument(ownerId, documentId) {
      const document = await documentService.beginProcessing(ownerId, documentId);

      try {
        const sourceUrl = documentStorage.createAccessUrl({
          publicId: document.cloudinaryPublicId,
          format: document.format,
          download: false,
        });
        const extracted = await getExtractionClient().extractPdf(sourceUrl);
        const chunkCount = await knowledgeChunkService.replaceDocumentChunks(ownerId, documentId, extracted.chunks);
        return await documentService.completeProcessing(ownerId, documentId, extracted.pages, chunkCount);
      } catch (error) {
        try {
          await knowledgeChunkService.removeDocumentChunks(ownerId, documentId);
          await documentService.failProcessing(ownerId, documentId, error.message);
        } catch {
          // The original processing error is the most useful result for this request.
        }
        throw error;
      }
    },
  };
}
