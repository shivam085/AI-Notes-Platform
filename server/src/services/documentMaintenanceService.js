export function createDocumentMaintenanceService({
  documentService,
  documentProcessingService,
  documentCleanupService,
}) {
  return {
    async recover() {
      const [interruptedDocuments, pendingDeletions] = await Promise.all([
        documentService.listInterruptedProcessing(),
        documentService.listPendingDeletions(),
      ]);

      const processingResults = [];
      for (const document of interruptedDocuments) {
        try {
          await documentProcessingService.recoverDocument(document.ownerId, document._id.toString());
          processingResults.push({ documentId: document._id.toString(), recovered: true });
        } catch {
          processingResults.push({ documentId: document._id.toString(), recovered: false });
        }
      }

      const deletionResults = [];
      for (const document of pendingDeletions) {
        try {
          const result = await documentCleanupService.cleanClaimedDocument(document);
          deletionResults.push({ documentId: document._id.toString(), completed: result.completed });
        } catch {
          deletionResults.push({ documentId: document._id.toString(), completed: false });
        }
      }

      return { processingResults, deletionResults };
    },
  };
}
