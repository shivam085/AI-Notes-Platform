> Superseded on 17 October 2026: the current Phase 10 results and scope cleanup were successfully synchronized to the existing Notion hub, Development Log and Architecture & Concepts pages. The older pending draft below is retained as history; do not apply it over the current pages.

# Pending Notion sync — Phase 10

Notion synchronization was attempted on 14 October 2026. The update was
rejected because the workspace had reached its free block limit. No Phase 10
content was created or changed in Notion. Apply the updates below when block
creation is available again.

## Hub — replace Current status

- **V1:** Phases 1–9 are completed. Phase 10 is in progress. Local reliability,
  safe deletion, PDF/DOCX/TXT/Markdown processing, semantic search across notes
  and documents, interface completion, regression tests, and local setup
  documentation are implemented. Docker, Docker Compose, Nginx, HTTPS, and
  public deployment are deferred at the user's request.
- **Project folder:** `D:\Projects\Notes_ai`
- **Latest verification:** On 14 October 2026, 48 Node tests, 28 FastAPI tests,
  and the production React build passed.
- **Next work:** Resume the deferred deployment slice, run the deployed user
  journey, then mark Phase 10 and V1 Completed.

## Development Log — replace Phase 10

## Phase 10 — Finish, test, and deploy V1

- **Status:** In Progress — started 14 October 2026
- **Goal:** Finish a reliable, documented V1. Local hardening is complete;
  containerization, Nginx, HTTPS, and public deployment are deferred.
- **What I implemented:** Recoverable document processing with saved run
  IDs/attempts, one bounded retry and startup recovery; immediate-hide deletion
  with recoverable Cloudinary/MongoDB/Qdrant cleanup; PDF, DOCX, TXT, and
  Markdown loading; stale-source and stale-note-version checks; semantic search
  across notes and documents; public landing, workspace dashboard, settings,
  loading/error states, and unified local run/verification commands.
- **Technologies/concepts used:** MongoDB durable state, guarded state
  transitions, bounded retry/backoff, LangChain loaders and
  `RecursiveCharacterTextSplitter`, Qdrant owner/source cleanup, Gemini
  embeddings, React polling, and regression tests.
- **Important files/components created or modified:**
  `server/src/models/Document.js`, `server/src/models/KnowledgeChunk.js`,
  `server/src/services/documentService.js`, `documentProcessingService.js`,
  `documentCleanupService.js`, `documentMaintenanceService.js`,
  `semanticSearchService.js`, `ragService.js`, `ai-service/app/main.py`,
  `schemas.py`, `services/pdf_extraction_service.py`, `services/vector_store.py`,
  `client/src/DocumentsWorkspace.jsx`, `SemanticSearch.jsx`, `RagChat.jsx`,
  `Landing.jsx`, `Settings.jsx`, `Root.jsx`, `README.md`, and
  `docs/phase-10-local-hardening.md`.
- **API/DB changes:** Document now supports `pdf/docx/txt/md`, processing claim
  fields, and the `deleting` state. KnowledgeChunk stores note `sourceVersion`.
  Added FastAPI `POST /internal/extract-document`, `/internal/split-text`, and
  `/internal/delete-source-vectors`. Search reindex returns total, note, and
  document chunk counts.
- **Key implementation decisions:** Store recovery state on Document instead of
  adding queue infrastructure. Treat the run ID as the current worker's claim.
  Hide before external deletion. Recheck Qdrant candidates against current
  owned MongoDB sources. Use the same LangChain splitter for notes and files.
- **Problems/errors faced:** The first mixed-source search implementation queried
  the real Note model even when RAG returned only document candidates, so the
  isolated RAG tests waited for a database and failed.
- **How I fixed them:** Skip Note or Document queries when that candidate-ID list
  is empty. This also avoids unnecessary database work.
- **Important concepts I learned:** Durable state survives restarts; bounded
  retries avoid infinite loops; a claim prevents stale completion; safe
  deletion hides first; vector candidates must be rechecked for current source
  ownership and version.
- **Commands/configuration worth remembering:** `npm.cmd run dev:all` starts all
  three services. `npm.cmd run verify` runs Node tests, FastAPI tests, and the
  production React build. Keep real keys only in ignored local `.env` files.
- **Testing/verification:** `npm.cmd run verify` passed 48 Node tests, 28 FastAPI
  tests, and the React production build on 14 October 2026. Express and FastAPI
  live health checks returned OK, and Vite served the application.
- **Next phase:** Resume Docker, Docker Compose, Nginx, HTTPS, and public
  deployment when requested; run the final deployed journey and mark Phase 10
  and V1 Completed.

## Development Log — append to Lessons Learned

- **Phase 10 — restart safety:** Save processing state and a unique run claim in
  MongoDB. A function running only in memory disappears on restart, while the
  current claim prevents older work from overwriting newer state.
- **Phase 10 — deletion order:** Hide an owned source before cleaning
  Cloudinary, MongoDB chunks, and Qdrant vectors. Keep a recoverable deletion
  record when an external cleanup step fails.
- **Phase 10 — retrieval freshness:** Qdrant finds candidates; MongoDB decides
  whether the source and chunk are current. A note chunk stores the note version
  so edited content stays hidden until reindexing.
- **Phase 10 — one chunking rule:** Saved notes and uploaded documents both use
  the FastAPI/LangChain recursive splitter, so size and overlap stay consistent.

## Architecture & Concepts — replace Document processing

### Document processing

- **What it is:** A pipeline that loads a private file, extracts readable text,
  splits it into small source-linked chunks, and records its status.
- **Why this project needs it:** Cloudinary stores bytes, while semantic search
  and RAG need current text linked to an owner and source location.
- **How it works in this project:** Express verifies ownership and creates a
  short-lived Cloudinary URL. FastAPI downloads the file and uses
  `PyPDFLoader`, `Docx2txtLoader`, or `TextLoader`, followed by
  `RecursiveCharacterTextSplitter`. Express stores pages/chunks in MongoDB.
  Run IDs, bounded retry, polling, and startup recovery protect interrupted work.
- **Where it is implemented:** `server/src/models/Document.js`,
  `server/src/services/documentProcessingService.js`,
  `server/src/services/documentMaintenanceService.js`,
  `ai-service/app/services/pdf_extraction_service.py`,
  `ai-service/app/services/text_chunking.py`, and
  `client/src/DocumentsWorkspace.jsx`.
- **Example:** A PDF keeps original page numbers; a TXT file becomes section 1.
  Both are split into overlapping chunks no longer than 2,000 characters.
- **Common mistakes:** Marking a source ready before chunks are saved, losing
  page metadata, retrying forever, or allowing an older run to overwrite a
  deleted/reclaimed source.
- **What I should remember for interviews:** Storage and processing are separate.
  A reliable pipeline persists status, bounds retries, preserves source metadata,
  and uses an idempotent claim before applying completion.

## Architecture & Concepts — targeted Qdrant correction

- Qdrant Cloud now stores both saved-note and ready-document chunk embeddings.
- Reindexing sends note text through FastAPI's shared LangChain splitter first.
- Search still filters by authenticated `ownerId` in Qdrant, then Express
  rechecks the current owned Note/Document and KnowledgeChunk in MongoDB.
- Note chunks store `sourceVersion`; edited notes are hidden from semantic
  results until reindexed.

