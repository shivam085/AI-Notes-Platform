export class RagConfigurationError extends Error {}
export class RagUnavailableError extends Error {}

export function createRagClient({
  baseUrl = process.env.AI_SERVICE_URL,
  serviceToken = process.env.AI_SERVICE_TOKEN,
  fetchImplementation = fetch,
} = {}) {
  if (!baseUrl || !serviceToken) {
    throw new RagConfigurationError('Document Q&A is not configured on the server yet.');
  }

  return {
    async answerQuestion(question, contexts) {
      let response;
      try {
        response = await fetchImplementation(`${baseUrl.replace(/\/$/, '')}/internal/answer-question`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-AI-Service-Token': serviceToken },
          body: JSON.stringify({ question, contexts }),
          signal: AbortSignal.timeout(60_000),
        });
      } catch {
        throw new RagUnavailableError('The AI question service is unavailable. Please try again shortly.');
      }

      const data = await response.json().catch(() => ({}));
      if (!response.ok || typeof data.answer !== 'string' || !data.answer.trim() || typeof data.grounded !== 'boolean') {
        throw new RagUnavailableError('The AI question service could not answer this question. Please try again shortly.');
      }
      return { answer: data.answer.trim(), grounded: data.grounded };
    },
  };
}
