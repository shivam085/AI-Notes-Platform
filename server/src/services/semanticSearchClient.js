export class SemanticSearchConfigurationError extends Error {}
export class SemanticSearchUnavailableError extends Error {}

export function createSemanticSearchClient({
  baseUrl = process.env.AI_SERVICE_URL,
  serviceToken = process.env.AI_SERVICE_TOKEN,
  fetchImplementation = fetch,
} = {}) {
  if (!baseUrl || !serviceToken) {
    throw new SemanticSearchConfigurationError('Semantic search is not configured on the server yet.');
  }

  async function call(path, body) {
    let response;
    try {
      response = await fetchImplementation(`${baseUrl.replace(/\/$/, '')}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-AI-Service-Token': serviceToken },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60_000),
      });
    } catch {
      throw new SemanticSearchUnavailableError('The AI search service is unavailable. Please try again shortly.');
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new SemanticSearchUnavailableError('The AI search service could not complete this request. Please try again shortly.');
    }
    return data;
  }

  return {
    async indexChunks(chunks) {
      const data = await call('/internal/index-chunks', { chunks });
      if (!Number.isInteger(data.indexed_count) || data.indexed_count < 0) {
        throw new SemanticSearchUnavailableError('The AI search service returned an unexpected indexing response.');
      }
      return data.indexed_count;
    },
    async search({ ownerId, query, limit, sourceType, folderId, tags }) {
      const data = await call('/internal/semantic-search', {
        owner_id: ownerId,
        query,
        limit,
        source_type: sourceType || undefined,
        folder_id: folderId || undefined,
        tags,
      });
      if (!Array.isArray(data.results)) {
        throw new SemanticSearchUnavailableError('The AI search service returned an unexpected search response.');
      }
      return data.results.map((result) => ({
        chunkId: result.chunk_id,
        sourceType: result.source_type,
        sourceId: result.source_id,
        title: result.title,
        pageNumber: result.page_number,
        position: result.position,
        text: result.text,
        score: result.score,
      }));
    },
  };
}
