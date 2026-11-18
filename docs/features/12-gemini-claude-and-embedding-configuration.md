# Gemini generation and embedding configuration

Updated 26 October 2026: Claude support has been reverted at the user's request. The filename is retained to preserve existing links.

## Configuration

Set these in the private ai-service/.env file:

- GEMINI_API_KEY: your private Gemini key.
- GEMINI_MODEL: the Gemini text-generation model.
- GEMINI_REQUEST_TIMEOUT_MS: 55000 by default.
- GEMINI_EMBEDDING_MODEL: gemini-embedding-001 by default.
- GEMINI_EMBEDDING_DIMENSIONS: 768 by default.
- AI_SERVICE_TOKEN: must match the Node service token.
- QDRANT_URL, QDRANT_API_KEY and QDRANT_COLLECTION: vector-store configuration.

Restart FastAPI after changing environment settings. GENERATION_PROVIDER, GENERATION_MODEL and ANTHROPIC_API_KEY are no longer used.

## Code flow

app/config.py reads settings. app/main.py creates GeminiSummaryService, GeminiStudyService and GeminiRagService. They call the Gemini SDK directly. Summary, tags, flashcards, quizzes and document answers all use GEMINI_MODEL.

EmbeddingService uses its separate embedding model for document and query vectors. Changing only the generation model does not require reindexing. Changing the embedding model or dimensions requires a compatible collection and reindexing.

## Verification

Run npm run verify for Node tests, Python tests and the frontend build. Mocked tests do not guarantee live Gemini availability. An HTTP 503 from Gemini can still mean provider overload.
