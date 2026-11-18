# Gemini and Qdrant connection troubleshooting

## Verified fixes — 18 November 2026

Two independent failures prevented live AI features from working even though mocked automated tests and health endpoints passed.

### Gemini generation

The configured `gemini-3.8-flash` returned HTTP 503 high-demand errors and timeouts. Its model ID was recognized, and embeddings worked with the same key. Increasing a timeout did not restore generation.

Live checks succeeded with `gemini-3.1-flash-lite`, so the local `ai-service/.env`, default in `app/config.py`, and `.env.example` now use:

```dotenv
GEMINI_MODEL=gemini-3.1-flash-lite
GEMINI_REQUEST_TIMEOUT_MS=55000
```

This changes generation only. The embedding model remains `gemini-embedding-001` with 768 dimensions; existing vectors do not require reindexing for this generation-model switch. Availability can change, so verify a real request with the configured key when deploying. Gemini API keys are not interchangeable with consumer subscriptions.

`app/services/rag_service.py` and `embedding_service.py` now apply the configured SDK request timeout and close their clients, matching summary/study services. This is a per-request timeout, not a total deadline for multi-chunk indexing or SDK retries.

### Qdrant connectivity

The user reported a healthy cluster. Both ports 443 and 6333 failed with Python's default TLS negotiation; a raw socket connected, then TLS setup was reset with Windows error 10054. Authenticated Windows curl requests succeeded and the collection was green. Python also succeeded with TLS 1.2. This isolates a TLS negotiation compatibility problem on the tested connection; it does not identify whether the endpoint or an intermediate network component caused the reset.

The existing URL and key were preserved. The local `.env` now includes:

```dotenv
QDRANT_FORCE_TLS12=true
```

`app/services/vector_store.py` uses a verified SSL context restricted to TLS 1.2 when this option is true. Certificate and hostname verification remain enabled. The default is false: leave it unset/false on Render unless the same failure is reproduced there. Do not use `verify=False` or remove HTTPS to work around a handshake failure.

After any `.env` change, restart FastAPI. From `ai-service` on Windows:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

Stop the existing FastAPI process before manually starting another on port 8000. During this repair the existing development reloader picked up the new settings.

## What was verified

- Running FastAPI: summary, tags, five flashcards, five quiz questions, a 768-dimensional query embedding, and an answer from supplied context all returned HTTP 200 with real Gemini responses.
- Live retrieval: indexed one synthetic document chunk into the existing Qdrant collection under a unique test owner/source; retrieved it for that owner; verified an unrelated owner got no results; passed the retrieved context to Gemini and checked the answer. Deleted only the synthetic source's vector and verified no test results remained.
- `npm.cmd run verify`: 59 Node tests, 35 Python tests and production frontend build passed after the model/timeout changes. After the TLS change, `npm.cmd run test:ai` passed all 37 Python tests, including certificate verification and opt-in TLS coverage. `git diff --check` passed.
- No signed-in browser journey, real-user PDF reprocessing, MongoDB persistence round trip, or hosted deployment was verified in this repair. Phase 10 remains In Progress.

Automated tests use mocks or isolated stores. A green test suite or `/health` response cannot prove live provider capacity, Qdrant connectivity, or account quota. Run both automated and live checks before deployment.

References: [Google API troubleshooting](https://ai.google.dev/gemini-api/docs/generate-content/api-errors), [Qdrant Cloud connections](https://qdrant.tech/documentation/cloud/cluster-access/).
