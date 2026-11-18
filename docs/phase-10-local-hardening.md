# Phase 10: Local V1 hardening

This Phase 10 slice makes the local V1 safer to restart, delete from, test, and
learn from. Docker, Docker Compose, Nginx, HTTPS, and public deployment are
deliberately deferred. Phase 10 therefore remains **In Progress**.

## 1. Recoverable document processing

Document processing still follows the beginner-friendly AI sequence:

```text
Private file in Cloudinary
  -> LangChain loader reads the document
  -> RecursiveCharacterTextSplitter creates chunks
  -> MongoDB stores extracted text and chunks
  -> Gemini embeddings and Qdrant indexing happen when the user reindexes
```

MongoDB now also stores a processing run ID, attempt count, and start time on
the document. The run ID works like a ticket: only the request holding the
current ticket may mark that document ready. Deleting or reclaiming the job
replaces the ticket, so older work cannot restore stale content.

A temporary FastAPI/network failure receives one automatic retry with a short
backoff. When Express starts, it checks MongoDB for documents left in
`processing` and reclaims them up to a maximum of three saved attempts. After
that it marks the document failed and asks the user to start a fresh retry.

The React document screen polls every two seconds while a saved document says
`processing`. The status therefore updates after recovered work finishes.

## 2. Safe deletion

Deletion is intentionally ordered:

```text
Mark MongoDB document as deleting
  -> it disappears from user queries immediately
  -> remove the private Cloudinary file
  -> remove MongoDB KnowledgeChunk records
  -> remove owner + source vectors from Qdrant
  -> permanently remove the MongoDB document record
```

If an external cleanup step fails, the document stays hidden with its cleanup
claim saved in MongoDB. Express retries that cleanup after its next restart.
Semantic search rechecks every Qdrant result against an owned, ready MongoDB
document and chunk. Saved RAG history also removes source links after the source
document is deleted.

## 3. Supported document formats

| Format | LangChain loader | Source numbering |
| --- | --- | --- |
| PDF | `PyPDFLoader` | Original PDF page |
| DOCX | `Docx2txtLoader` | Section 1 |
| TXT | `TextLoader` | Section 1 |
| Markdown | `TextLoader` | Section 1 |

All formats use `RecursiveCharacterTextSplitter` with the same configured chunk
size and overlap. The server accepts at most 10 MB and validates the extension,
declared MIME type, and basic file bytes before Cloudinary receives the file.
Image-only scanned PDFs still need OCR and remain outside V1.

## 4. Interface additions

- `/` redirects to the protected workspace (or Clerk sign-in when signed out).
- `/workspace` starts with a dashboard linking to notes, documents, semantic
  search, document Q&A, flashcards, and quizzes.
- On 17 October, the connection demo, landing page, and duplicate session-check
  screens were removed to keep only the requested product features.
- Document upload and search language now covers PDF, DOCX, TXT, and Markdown.
- Semantic search indexes both saved notes and ready documents, with an optional
  source-type filter. Notes use the same FastAPI/LangChain chunking rules.
- Processing, empty, loading, provider-error, cleanup, and deleted-source states
  have user-facing messages.

## Important files

| File | Responsibility |
| --- | --- |
| `server/src/models/Document.js` | Stores processing/recovery/deletion state and supported formats. |
| `server/src/services/documentService.js` | Validates files and performs run-ID guarded state changes. |
| `server/src/services/documentProcessingService.js` | Loads, splits, retries, saves, and rejects superseded work. |
| `server/src/services/documentCleanupService.js` | Coordinates Cloudinary, MongoDB chunk, and Qdrant cleanup. |
| `server/src/services/documentMaintenanceService.js` | Recovers interrupted processing and deletion work at startup. |
| `server/src/services/semanticSearchService.js` | Chunks notes, indexes both source types, and rechecks vector candidates against current owned sources. |
| `server/src/services/ragService.js` | Rechecks live sources before showing saved citations. |
| `ai-service/app/services/pdf_extraction_service.py` | Uses the appropriate LangChain loader for all four formats. |
| `ai-service/app/services/vector_store.py` | Deletes vectors using owner and source filters. |
| `client/src/DocumentsWorkspace.jsx` | Uploads formats, polls processing, and shows extracted text. |
| `client/src/Root.jsx` | Clerk and the protected feature workspace. |
| `client/src/services/api.js` | Shared authenticated requests, JSON errors and multipart uploads. |
| `server/src/services/studyService.js` | Shared flashcard/quiz storage with separate validators. |
| `server/src/controllers/studyController.js` | Shared study HTTP responses and errors. |
| `ai-service/app/services/generation_provider.py` | Selects the configured text-generation adapter. |
| `ai-service/app/services/gemini_service.py` | Gemini text and structured-output adapter. |
| `ai-service/app/services/anthropic_service.py` | Anthropic Claude text and structured-output adapter. |
| `ai-service/app/services/summary_service.py` | Provider-neutral summary prompt. |
| `ai-service/app/services/study_service.py` | Provider-neutral tag, flashcard and quiz prompts. |

## Run and verify

From `D:\Projects\Notes_ai`:

```powershell
npm.cmd run dev:all
```

In another terminal:

```powershell
npm.cmd run verify
```

Manual checks:

1. Sign in and create one private note.
2. Upload one small file from each supported format.
3. Extract and inspect the text. Confirm a PDF keeps its page numbers.
4. Restart Express during one processing request, reload the workspace, and
   watch the saved processing status recover.
5. Index notes and ready documents, search each source type by meaning, and ask
   a grounded document question.
6. Delete a source document. Confirm it disappears immediately, cannot open,
   does not appear in semantic search, and no longer has a source link in saved
   chat history.
7. Generate tags, flashcards, and a quiz, then refresh and confirm saved study
   material remains.

## Current limitations

- Scanned PDFs are not OCR-processed.
- DOCX/TXT/Markdown are treated as one source section; headings are not yet
  converted into separate sections.
- Qdrant indexing remains an explicit **Index notes and documents** action after
  note edits, document extraction, or tag changes.
- The full verification command currently passes 59 Node tests, 38 FastAPI
  tests, and the production React build.
- The recovery worker is designed for one Express instance. Multiple API copies
  require a stronger distributed lease before production scaling.
- Docker, Nginx, HTTPS, and public deployment are deferred.

## Generation-provider configuration — 25 October 2026

Documentation follow-up — 25 October 2026: added [14 detailed feature guides and an index](features/README.md), covering current user flows, API contracts, code/storage paths, configuration, existing tests, manual checks, and limitations. The main README links to the index. A documentation-only check verified 155 local links, all 35 public routes (including health), all 12 internal routes, and Markdown structure. Application tests, live provider calls, and browser checks were not rerun for this documentation task; earlier results below remain historical. Phase 10 remains In Progress.

Source-review clarifications: extraction waits for completion and returns HTTP 200; it is not a queued HTTP 202 job API. Deletion hides the record first, then attempts Cloudinary/chunk/vector cleanup concurrently before final metadata removal; the earlier diagram describes dependencies rather than sequential execution. Current reindexing submits one request capped at 100 chunks. RAG history is stored for display, not supplied as model memory, and its grounded flag is not an independent factual verifier. These are documentation clarifications, not new behavior changes.

Text generation now uses one common provider contract. `GENERATION_PROVIDER=gemini`
selects the Gemini adapter and `GENERATION_PROVIDER=anthropic` selects the Claude
adapter. `GENERATION_MODEL` holds the model ID for the selected provider. Summary,
RAG, tag, flashcard, and quiz prompts stay in provider-neutral services, so switching
providers does not change the feature routes or saved data.

Semantic search continues to use `GEMINI_API_KEY` and
`GEMINI_EMBEDDING_MODEL`. Anthropic does not supply embeddings in this project.
Changing only the generation provider therefore does not require reindexing Qdrant.
Changing an embedding model or its dimensions does require a compatible collection
and reindexing, because embeddings from different models should not be mixed.

The old `GEMINI_MODEL` and `GEMINI_REQUEST_TIMEOUT_MS` names remain accepted as
fallbacks for existing private `.env` files. New configuration uses
`GENERATION_MODEL` and `GENERATION_REQUEST_TIMEOUT_MS`.

Verification on 25 October 2026: `npm.cmd run verify` passed 59 Node tests,
38 Python tests, and the production React build. Provider tests use mocked SDK
clients; a live Claude request was not made because no private key is part of
the repository.

Live Gemini verification on 25 October 2026 used the configured private key
without printing it. Summary, tag suggestions, five flashcards, five quiz
questions, a grounded RAG answer, and a 768-dimensional query embedding all
passed against the updated FastAPI service. Tag generation had one earlier
transient failure; flashcard and quiz generation each needed one retry. The
same structured calls then passed, so this was recorded as provider
availability rather than a schema failure. React, Express, and FastAPI were
left running on ports 5173, 5000, and 8000, with each health check returning
HTTP 200.

Anthropic verification follow-up — 25 October 2026: the private environment now
selects `anthropic` with `claude-sonnet-4-6`; no key value was printed or stored
in documentation. Full automated verification passed with 59 Node tests, 38
Python tests, and the production React build. The Python tests include mocked
Claude text/structured responses, factory selection, validation, timeouts, safe
errors, and internal-token protection.

A minimal live Claude request reached Anthropic but returned HTTP 400 because
the API credit balance was too low. Therefore live summary, tag, flashcard,
quiz, and RAG generation could not be marked passed. This is an Anthropic
account/billing blocker rather than a key-format, adapter, or model-ID result.
The signed-in browser showed the safe summary retry message. Provider-independent
live checks passed for LangChain chunking, 768-dimensional Gemini document/query
embeddings, temporary Qdrant indexing/search, owner isolation, and vector
cleanup. Browser semantic search returned five owned results. React, Express,
and FastAPI health checks all returned HTTP 200, and FastAPI was left running
with the Anthropic configuration. Repeat live generation after adding Anthropic
API credits.

## Scope review — 17 October 2026

All six AI features, Clerk ownership checks, private uploads, note folder/tag fields, saved study material and source-cleanup protections remain. Frontend API requests and FastAPI internal authentication are shared once. The deprecated PDF endpoint remains as an alias to the shared document handler for compatibility. No database migration is required.

Source inventory fell from 75 files / 5,737 lines to 68 files / 4,955 lines before the final readability pass (client/src, server/src, ai-service/app; JS, JSX, CSS and Python only). Regression tests were added, not removed. Live cloud generation and signed-in browser checks were not repeated for this cleanup.

Follow-up model review (17 October 2026): tags, flashcards and quizzes share StudyRequest in ai-service/app/schemas.py. Request fields/limits and saved data are unchanged; OpenAPI now references the shared schema name. All six MongoDB models remain distinct. Full verification passed again: 55 Node tests, 32 Python tests and the production build.

## Service/controller review — 17 October 2026

- Four Express-to-FastAPI clients now use server/src/services/aiServiceClient.js, with one token/JSON/error transport and explicit endpoint methods.
- Summary and tag services now share server/src/services/aiService.js and server/src/controllers/aiController.js; routes remain explicit in ai.routes.js.
- Reviewed all 34 service/controller files (including index/init files); the merged directories contain 29 files and 130 fewer lines.
- Keep notes, document CRUD, processing, cleanup/recovery, search and RAG separate because their data and failure rules differ. Python loading, chunking, embeddings, vector search and generation retain the explicit learning sequence.
- API URLs, successful response shapes, ownership checks and persisted data are unchanged. AI transport errors now use common classes; extraction input errors still use HTTP 422 and are not retried as network failures.
- Verification: 59 Node tests, 32 Python tests and production frontend build passed. New tests cover all client endpoints, field mapping, error handling and timeout choices. No live cloud/browser checks were repeated.

## Gemini-only rollback — 26 October 2026

At the user's request, removed Claude integration and provider selection, restored direct Gemini summary/study/RAG services and Gemini environment names, and removed the Anthropic dependency. Private configuration now uses Gemini. Existing data and embedding configuration were preserved. Kept the earlier 55-second Gemini, 60-second Node generation, and 120-second indexing timeouts. Earlier provider rollout entries above remain historical. Verification: npm run verify passed 59 Node tests, 33 Python tests, and the React production build. A fresh FastAPI app loaded with Gemini-only settings and the configured key present; the running health endpoint returned HTTP 200. No live generation request was made for this rollback.

## Live AI repair — 18 November 2026

Phase 10 remains In Progress. Live checks reproduced Gemini generation failures despite passing mocked tests: `gemini-3.8-flash` returned high-demand 503s/timeouts. Switched local generation and the code/example defaults to `gemini-3.1-flash-lite` after verifying it. Added configured request timeouts and client cleanup to RAG and embedding services. Qdrant was healthy but Python's default TLS handshake was reset; verified Windows curl and Python TLS 1.2 both succeeded. Added opt-in `QDRANT_FORCE_TLS12` with certificate/hostname verification retained, enabled locally only. No API key, embedding model, dimension, or existing vector data was changed.

Verification: full `npm.cmd run verify` passed 59 Node tests, 35 Python tests and the React build after the model/timeout changes; final Python verification passed 37 tests after the TLS change. Live FastAPI summary, tags, five flashcards, five quiz questions, query embeddings, and supplied-context RAG passed. A temporary Qdrant indexing → owner-scoped retrieval → grounded answer test also passed, including another-owner exclusion and verified vector cleanup. Browser, real-user PDF processing, and hosted deployment checks remain outstanding. See [AI service troubleshooting](ai-service-troubleshooting.md) for configuration and evidence. Lesson: mocked tests and health checks do not establish live dependency availability; isolate model errors and TLS failures before changing credentials or data.

## Vercel routing correction — 18 November 2026

The user reported `rewrites[0] missing required property destination` during deployment. The committed JavaScript configuration contained a computed destination, but the precise platform evaluation failure was not established. Replaced `vercel.mjs` with `vercel.json`, using the user-confirmed `https://ai-notes-express.onrender.com` as a literal API rewrite destination and retaining the React route fallback and workspace build commands. `EXPRESS_API_ORIGIN` is no longer used; Vercel needs only `VITE_CLERK_PUBLISHABLE_KEY` for this frontend. No application API or database change.

Verification: `npm.cmd run build` passed; every configured property was validated against its unchanged definition from Vercel's official JSON schema. The entire published schema mixed draft versions in unrelated experimental fields, so validation was scoped to all fields this project uses. The public Render Express `/api/health` returned HTTP 200 with `{"status":"ok"}`. Vercel production deployment and browser flows still need verification after this commit is deployed; Phase 10 remains In Progress.
