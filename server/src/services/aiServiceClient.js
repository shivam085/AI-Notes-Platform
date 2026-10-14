export class AiServiceConfigurationError extends Error {}
export class AiServiceUnavailableError extends Error {}

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

  async function post(path, body, unavailableMessage) {
    let response;
    try {
      response = await fetchImplementation(`${baseUrl.replace(/\/$/, '')}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-AI-Service-Token': serviceToken },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(safeTimeoutMs),
      });
    } catch {
      throw new AiServiceUnavailableError('The AI service is unavailable. Please try again shortly.');
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new AiServiceUnavailableError(unavailableMessage);
    return data;
  }

  return {
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
