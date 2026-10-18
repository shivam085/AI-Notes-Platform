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
| `ai-service/app/services/study_service.py` | Tag, flashcard and quiz prompts with shared Gemini JSON validation. |

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
- The full verification command currently passes 59 Node tests, 32 FastAPI
  tests, and the production React build.
- The recovery worker is designed for one Express instance. Multiple API copies
  require a stronger distributed lease before production scaling.
- Docker, Nginx, HTTPS, and public deployment are deferred.

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
