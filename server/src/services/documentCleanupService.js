export function createDocumentCleanupService({
  documentService,
  documentStorage,
  knowledgeChunkService,
  getSemanticSearchClient,
}) {
  async function cleanClaimedDocument(document) {
    const ownerId = document.ownerId;
    const documentId = document._id.toString();
    const results = await Promise.allSettled([
      Promise.resolve().then(() => documentStorage.remove(document.cloudinaryPublicId)),
      Promise.resolve().then(() => knowledgeChunkService.removeDocumentChunks(ownerId, documentId)),
      Promise.resolve().then(() => getSemanticSearchClient().deleteSource(ownerId, documentId)),
    ]);

    if (results.some((result) => result.status === 'rejected')) {
      return {
        completed: false,
        message: 'The document is hidden. Background cleanup will retry after the API restarts.',
      };
    }

    await documentService.completeDeletion(ownerId, documentId, document.processingRunId);
    return { completed: true };
  }

  return {
    async deleteDocument(ownerId, documentId) {
      const document = await documentService.beginDeletion(ownerId, documentId);
      return cleanClaimedDocument(document);
    },
    cleanClaimedDocument,
  };
}
