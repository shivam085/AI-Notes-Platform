export class AiServiceConfigurationError extends Error {}
export class AiServiceUnavailableError extends Error {}

export function createAiServiceClient({
  baseUrl = process.env.AI_SERVICE_URL,
  serviceToken = process.env.AI_SERVICE_TOKEN,
  fetchImplementation = fetch,
} = {}) {
  if (!baseUrl || !serviceToken) {
    throw new AiServiceConfigurationError('AI summarization is not configured on the server yet.');
  }

  return {
    async summarize(text) {
      let response;
      try {
        response = await fetchImplementation(`${baseUrl.replace(/\/$/, '')}/internal/summarize`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-AI-Service-Token': serviceToken },
          body: JSON.stringify({ text }),
          signal: AbortSignal.timeout(20_000),
        });
      } catch {
        throw new AiServiceUnavailableError('The AI service is unavailable. Please try again shortly.');
      }

      const data = await response.json().catch(() => ({}));
      if (!response.ok || typeof data.summary !== 'string' || !data.summary.trim()) {
        throw new AiServiceUnavailableError('The AI service could not create a summary. Please try again shortly.');
      }
      return data.summary.trim();
    },
  };
}
