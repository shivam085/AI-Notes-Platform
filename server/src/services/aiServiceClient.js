export class AiServiceConfigurationError extends Error {}
export class AiServiceUnavailableError extends Error {}
export class DocumentExtractionInputError extends Error {}

export function createAiServiceClient({
  baseUrl = process.env.AI_SERVICE_URL,
  serviceToken = process.env.AI_SERVICE_TOKEN,
  timeoutMs = Number(process.env.AI_SERVICE_TIMEOUT_MS || 45_000),
  fetchImplementation = fetch,
} = {}) {
  if (!baseUrl || !serviceToken) {
    throw new AiServiceConfigurationError('AI features are not configured on the server yet.');
  }
  const safeTimeoutMs = Number.isFinite(timeoutMs) && timeoutMs >= 5_000 && timeoutMs <= 120_000 ? timeoutMs : 45_000;

  async function post(path, body, unavailableMessage, requestTimeoutMs = safeTimeoutMs) {
    let response;
    try {
      response = await fetchImplementation(`${baseUrl.replace(/\/$/, '')}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-AI-Service-Token': serviceToken },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(requestTimeoutMs),
      });
    } catch {
      throw new AiServiceUnavailableError('The AI service is unavailable. Please try again shortly.');
    }

    const data = await response.json().catch(() => ({}));
    if (path === '/internal/extract-document' && response.status === 422 && typeof data?.detail === 'string') {
      throw new DocumentExtractionInputError(data.detail);
    }
    if (!response.ok) throw new AiServiceUnavailableError(unavailableMessage);
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new AiServiceUnavailableError(unavailableMessage);
    return data;
  }

  return {
    async extractDocument(sourceUrl, format = 'pdf') {
      const message = 'The document processing service could not read this file. Please try again shortly.';
      const data = await post('/internal/extract-document', { source_url: sourceUrl, format }, message, 30_000);
      if (!Array.isArray(data.pages) || !Array.isArray(data.chunks)) throw new AiServiceUnavailableError(message);
      return {
        pages: data.pages.map((page) => ({ pageNumber: page.page_number, text: page.text })),
        chunks: data.chunks.map((chunk) => ({ position: chunk.position, pageNumber: chunk.page_number, text: chunk.text })),
      };
    },

    async answerQuestion(question, contexts) {
      const message = 'The AI question service could not answer this question. Please try again shortly.';
      const data = await post('/internal/answer-question', { question, contexts }, message, 60_000);
      if (typeof data.answer !== 'string' || !data.answer.trim() || typeof data.grounded !== 'boolean') {
        throw new AiServiceUnavailableError(message);
      }
      return { answer: data.answer.trim(), grounded: data.grounded };
    },

    async splitText(text) {
      const message = 'The AI search service returned an unexpected chunking response.';
      const data = await post('/internal/split-text', { text }, message, 60_000);
      if (!Array.isArray(data.chunks)) throw new AiServiceUnavailableError(message);
      return data.chunks.map((chunk) => ({ position: chunk.position, pageNumber: chunk.page_number, text: chunk.text }));
    },

    async indexChunks(chunks) {
      const message = 'The AI search service returned an unexpected indexing response.';
      const data = await post('/internal/index-chunks', { chunks }, message, 60_000);
      if (!Number.isInteger(data.indexed_count) || data.indexed_count < 0) throw new AiServiceUnavailableError(message);
      return data.indexed_count;
    },

    async deleteSource(ownerId, sourceId) {
      const message = 'The AI search service returned an unexpected deletion response.';
      const data = await post('/internal/delete-source-vectors', { owner_id: ownerId, source_id: sourceId }, message, 60_000);
      if (data.deleted !== true) throw new AiServiceUnavailableError(message);
    },

    async search({ ownerId, query, limit, sourceType, folderId, tags }) {
      const message = 'The AI search service returned an unexpected search response.';
      const data = await post('/internal/semantic-search', {
        owner_id: ownerId, query, limit, source_type: sourceType || undefined, folder_id: folderId || undefined, tags,
      }, message, 60_000);
      if (!Array.isArray(data.results)) throw new AiServiceUnavailableError(message);
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

    async summarize(text) {
      const data = await post('/internal/summarize', { text }, 'The AI service could not create a summary. Please try again shortly.');
      if (typeof data.summary !== 'string' || !data.summary.trim()) {
        throw new AiServiceUnavailableError('The AI service could not create a summary. Please try again shortly.');
      }
      return data.summary.trim();
    },

    async suggestTags({ title, text }) {
      const data = await post('/internal/suggest-tags', { title, text }, 'The AI service could not suggest tags. Please try again shortly.');
      if (!Array.isArray(data.tags) || data.tags.length < 3 || data.tags.length > 5 || data.tags.some((tag) => typeof tag !== 'string' || !tag.trim() || tag.length > 30)) {
        throw new AiServiceUnavailableError('The AI service returned invalid tag suggestions. Please try again shortly.');
      }
      return [...new Set(data.tags.map((tag) => tag.trim().toLowerCase()))];
    },

    async generateFlashcards({ title, text }) {
      const data = await post('/internal/generate-flashcards', { title, text }, 'The AI service could not create flashcards. Please try again shortly.');
      if (!Array.isArray(data.cards) || data.cards.length !== 5) {
        throw new AiServiceUnavailableError('The AI service returned invalid flashcards. Please try again shortly.');
      }
      return data.cards.map((card) => {
        const question = typeof card?.question === 'string' ? card.question.trim() : '';
        const answer = typeof card?.answer === 'string' ? card.answer.trim() : '';
        if (!question || question.length > 240 || !answer || answer.length > 1_000) {
          throw new AiServiceUnavailableError('The AI service returned invalid flashcards. Please try again shortly.');
        }
        return { question, answer };
      });
    },

    async generateQuiz({ title, text }) {
      const data = await post('/internal/generate-quiz', { title, text }, 'The AI service could not create a quiz. Please try again shortly.');
      if (!Array.isArray(data.questions) || data.questions.length !== 5) {
        throw new AiServiceUnavailableError('The AI service returned an invalid quiz. Please try again shortly.');
      }
      return data.questions.map((question) => {
        const prompt = typeof question?.question === 'string' ? question.question.trim() : '';
        const options = Array.isArray(question?.options)
          ? question.options.map((option) => typeof option === 'string' ? option.trim() : '')
          : [];
        const correctOptionIndex = question?.correct_option_index;
        const explanation = typeof question?.explanation === 'string' ? question.explanation.trim() : '';

        if (!prompt || prompt.length > 240 || options.length !== 4 || options.some((option) => !option || option.length > 240)
          || new Set(options).size !== 4 || !Number.isInteger(correctOptionIndex) || correctOptionIndex < 0 || correctOptionIndex > 3
          || !explanation || explanation.length > 1_000) {
          throw new AiServiceUnavailableError('The AI service returned an invalid quiz. Please try again shortly.');
        }
        return { question: prompt, options, correctOptionIndex, explanation };
      });
    },
  };
}
