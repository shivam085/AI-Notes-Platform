export class DocumentExtractionConfigurationError extends Error {}
export class DocumentExtractionUnavailableError extends Error {}
export class DocumentExtractionInputError extends Error {}

export function createDocumentExtractionClient({
  baseUrl = process.env.AI_SERVICE_URL,
  serviceToken = process.env.AI_SERVICE_TOKEN,
  fetchImplementation = fetch,
} = {}) {
  if (!baseUrl || !serviceToken) {
    throw new DocumentExtractionConfigurationError('Document text extraction is not configured on the server yet.');
  }

  return {
    async extractPdf(sourceUrl) {
      let response;
      try {
        response = await fetchImplementation(`${baseUrl.replace(/\/$/, '')}/internal/extract-pdf`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-AI-Service-Token': serviceToken },
          body: JSON.stringify({ source_url: sourceUrl }),
          signal: AbortSignal.timeout(30_000),
        });
      } catch {
        throw new DocumentExtractionUnavailableError('The document processing service is unavailable. Please try again shortly.');
      }

      const data = await response.json().catch(() => ({}));
      if (response.status === 422 && typeof data.detail === 'string') {
        throw new DocumentExtractionInputError(data.detail);
      }
      if (!response.ok || !Array.isArray(data.pages) || !Array.isArray(data.chunks)) {
        throw new DocumentExtractionUnavailableError('The document processing service could not read this PDF. Please try again shortly.');
      }

      return {
        pages: data.pages.map((page) => ({ pageNumber: page.page_number, text: page.text })),
        chunks: data.chunks.map((chunk) => ({ position: chunk.position, pageNumber: chunk.page_number, text: chunk.text })),
      };
    },
  };
}
