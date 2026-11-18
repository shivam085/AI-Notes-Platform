# Architecture, local configuration, and testing

Reviewed against the local source on 25 October 2026. [Feature index](README.md).

## System responsibilities

| Component | Responsibility |
| --- | --- |
| React + Vite | Protected workspace, forms, previews, saved-material review |
| Clerk | User accounts and signed sessions |
| Express | Public APIs, verified ownership, validation, application workflows |
| MongoDB + Mongoose | Notes, document metadata/text, chunks, history, study sets |
| Cloudinary | Private original document files |
| FastAPI + LangChain | Document loading, splitting, embedding/search orchestration, generation prompts |
| Gemini | Embeddings; optionally generation |
| Qdrant | Vector storage and semantic similarity queries |

Express handles application permissions before passing content to Python. FastAPI uses a shared internal token; it does not independently look up the Clerk user for each internal request.

## Data and request flow

```text
Browser -> Clerk session -> Express -> owned MongoDB data
                                |
                                +-> private Cloudinary storage
                                |
                                +-> FastAPI (internal service token)
                                      +-> LangChain loaders / splitter
                                      +-> Gemini embeddings -> Qdrant
                                      +-> Gemini generation
```

The six AI features are summarization, semantic search, document Q&A, tag suggestions, flashcards, and quizzes. Loading/chunking/indexing are supporting steps, not extra generation models.

The six MongoDB models are Note, Document, KnowledgeChunk, Conversation, Message, and StudySet. Folder labels and tags are fields; they are not separate collections.

## Configuration map

| Local environment file | Values |
| --- | --- |
| `D:/Projects/Notes_ai/client/.env` | Clerk publishable key |
| `D:/Projects/Notes_ai/server/.env` | Clerk keys/origins, MongoDB URI, Cloudinary settings, AI service URL/token, RAG threshold |
| `D:/Projects/Notes_ai/ai-service/.env` | Generation provider/model/keys, Gemini embedding settings, Qdrant settings, internal token, RAG context limits |

Use the committed example files as templates. Never expose secret values through React's `VITE_` variables. The internal token must match in Express and FastAPI. A valid health response is a process check, not a full dependency-readiness test.

## Install and start locally

From `D:/Projects/Notes_ai`, use Node 22.12+ and the project's Python 3.13 setup:

```powershell
npm.cmd ci
python -m venv ai-service/.venv
ai-service/.venv/Scripts/python.exe -m pip install -r ai-service/requirements.txt
npm.cmd run dev:all
```

Create/fill the three private environment files before starting. Do not overwrite an existing configured file merely to copy a template.

| Command | Function |
| --- | --- |
| `npm.cmd run dev:all` | React, Express, FastAPI |
| `npm.cmd run dev` | React and Express only |
| `npm.cmd run dev:client` | Frontend, port 5173 |
| `npm.cmd run dev:server` | Express, port 5000 |
| `npm.cmd run dev:ai` | FastAPI, port 8000 |
| `npm.cmd run build` | Production client build |
| `npm.cmd run preview` | Serve built frontend on 4173; backend still separate |

The AI startup script uses the Windows virtual-environment path. Stop existing instances before restarting on the same ports. Vite's proxy sends API calls to Express; changing the Express port requires a matching proxy adjustment.

## API and error boundaries

Public feature APIs are under `/api/auth`, `/api/notes`, `/api/documents`, `/api/ai`, `/api/search`, and `/api/study`. The feature guides contain their payloads.

Python's internal POST routes are summarize, suggest-tags, generate-flashcards, generate-quiz, extract-document, extract-pdf (alias), split-text, embed, index-chunks, semantic-search, delete-source-vectors, and answer-question, each under `/internal/`. All share `X-AI-Service-Token` authentication.

`GET /api/health` and Python `GET /health` return `{"status":"ok"}`. They do not call cloud dependencies. FastAPI also provides its framework-generated API schema/docs.

Typical public codes: 400 invalid input, 401 unauthenticated, 404 missing/inaccessible record, 409 stale save or processing-state conflict, 422 readable-document validation failure, 502 upstream AI/storage failure, and 503 missing configuration. Internal errors may be translated into safer generic public errors.

## Automated verification

```powershell
npm.cmd test
npm.cmd run test:ai
npm.cmd run build
# Or run all three:
npm.cmd run verify
```

Node's built-in test runner exercises HTTP routes and injected service/model behavior. Python unittest covers FastAPI boundaries, schemas, loaders/splitting, vector behavior, and mocked provider adapters. The frontend build checks compilation; it is not a browser interaction test.

| Area | Existing test files |
| --- | --- |
| Identity, health, browser helper | auth.test.js, health.test.js, clientApi.test.js |
| Notes | notes.test.js |
| Upload/extraction/recovery | documents.test.js, documentReliability.test.js |
| Summary and tags | ai.test.js, tagSuggestion.test.js |
| Retrieval and chat | semanticSearch.test.js, rag.test.js |
| Study material | flashcards.test.js, quizzes.test.js |
| Express-to-Python transport | aiServiceClient.test.js |
| Python AI/document behavior | test_app.py |

All Node test paths are in [server/test](D:/Projects/Notes_ai/server/test); Python tests are in [ai-service/tests](D:/Projects/Notes_ai/ai-service/tests).

These guides describe existing test coverage, not newly passed runtime tests. Documentation verification checks links, route coverage, and source consistency. Prior phase results remain in the historical [Phase 10 guide](../phase-10-local-hardening.md).

## Manual end-to-end checklist

1. Sign in; save a short note with folder/tags; find it by keyword.
2. Summarize and suggest tags; explicitly save accepted metadata.
3. Upload a small supported document, extract text, and inspect its page/section labels.
4. Index notes/documents and search by a paraphrase.
5. Ask an answerable document question and inspect sources; try a question without evidence.
6. Generate and save cards and a quiz; refresh and use their review controls.
7. Confirm another account cannot access the records.
8. Delete a document and verify normal views/search/history links reflect its removal.
9. Switch generation provider using the provider guide and test text plus structured generation.

These steps require live private configuration and are not a claim that this docs task executed them.

## Current scope and future work

Local V1 features exist; Phase 10 remains In Progress. Docker, Compose, Nginx, HTTPS, and public deployment are deferred. OCR, automatic reindexing, large-library batching, distributed leases/queues, persisted quiz attempts, and spaced repetition are not current features.

Sharing, editor/viewer roles, Yjs, WebSockets, and live collaboration are optional V2 only. A plan entry is not evidence that one of these has been implemented.

## Code starting points and interview notes

- [package.json](D:/Projects/Notes_ai/package.json): workspace scripts.
- [Root.jsx](D:/Projects/Notes_ai/client/src/Root.jsx): feature composition.
- [app.js](D:/Projects/Notes_ai/server/src/app.js) and [routes/index.js](D:/Projects/Notes_ai/server/src/routes/index.js): Express wiring.
- [main.py](D:/Projects/Notes_ai/ai-service/app/main.py): FastAPI services and endpoints.
- [coding-implementation-plan.md](D:/Projects/Notes_ai/docs/coding-implementation-plan.md): phased plan; compare plans with actual source.

**Interview takeaway:** “I split user permissions/persistence from AI processing, keep generation replaceable, and test service boundaries with controlled dependencies. Live cloud availability and browser workflows require separate checks.”
