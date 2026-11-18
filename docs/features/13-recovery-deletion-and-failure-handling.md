# Recovery, deletion, and failure handling

Reviewed against the local source on 25 October 2026. [Feature index](README.md).

## Purpose

External storage and AI calls can fail or outlive the original browser request. The application records document state in MongoDB so interrupted processing and incomplete deletion can be identified after an Express restart.

These protections support one local Express instance. They are not a distributed job queue or a guarantee of atomic consistency across MongoDB, Cloudinary, and Qdrant.

## Processing state and run IDs

Document stores `processingStatus`, `processingRunId`, `processingAttempts`, `processingStartedAt`, `processingError`, `processedAt`, and `deletedAt`.

| Event | State change |
| --- | --- |
| Upload | New record in uploaded |
| Explicit extraction/retry | uploaded or failed → processing; fresh run ID, attempts reset to 1 |
| Successful current run | processing → ready; extracted text/chunk count saved |
| Failed current run | processing → failed; safe bounded error text |
| Startup recovery | Claim interrupted processing with a new run ID and increment attempts |
| Delete | Nondeleted → deleting, deletedAt set, run ID replaced |

Completion requires the record to still belong to the owner, be nondeleted/processing, and hold the same run ID. Deletion or recovery changes that ID, preventing an older request from marking the record ready.

Chunk writes/cleanup and metadata completion are separate operations. The run-ID guard protects the document state, but does not turn all cross-store/chunk operations into one transaction.

## Two distinct retry mechanisms

**Extraction retry:** one processing run may make at most two extraction calls. Only the shared client’s unavailable-service error gets the retry, with an initial 250 ms backoff. An invalid/damaged/readability response is not treated as a retryable transport error.

**Startup recovery:** Express scans saved processing jobs on startup. It reclaims eligible jobs with a new run ID while attempts are below three. Exhausted records become failed and ask the user to use Retry extraction. A manual retry starts a fresh attempt sequence.

There is no recurring background timer that continuously retries failed work. Recovery runs when the API starts. The frontend's two-second polling reads saved status; polling itself does not execute jobs.

## Document deletion flow

1. Verify ownership and mark the document deleting with `deletedAt`.
2. Normal lists, access links, extraction, and source rechecks stop seeing it.
3. Start Cloudinary asset removal, MongoDB chunk removal, and owner/source-filtered Qdrant deletion using `Promise.allSettled`.
4. If all cleanup operations succeed, remove the document metadata with the deletion run ID.
5. Return 204 when complete.
6. If cleanup fails, retain the hidden record and return 202 with `cleanupPending: true`.
7. On the next Express startup, retry pending deletion cleanup.

The three external/chunk cleanup operations run concurrently, not as a guaranteed sequential chain. Their success is checked before metadata deletion. Cloudinary “not found” is accepted so repeat cleanup can succeed.

There is no restore/recycle-bin feature; hidden pending deletion is an internal recovery state.

## Related data behavior

- Semantic search reloads current sources/chunks, hiding orphaned or deleted candidates.
- Saved chat history keeps answer text but removes unavailable document source links.
- Note deletion currently deletes the Note record without the document-style chunk/vector cleanup workflow.
- Saved flashcards/quizzes remain snapshots if their source note disappears.
- Conversation deletion removes its conversation and then messages; those writes are not a transaction.
- Expiring access links reduce link lifetime but are not a replacement for backend ownership checks.

## Other failure boundaries

The browser helper distinguishes JSON errors, malformed responses, missing sessions, and empty 204 responses. Express's internal AI client attaches one shared token, uses endpoint-specific timeouts, and rejects malformed result shapes.

| Internal operation | Express timeout |
| --- | --- |
| Extract document | 30 seconds |
| Summary, tags, flashcards, quiz, Q&A | 60 seconds |
| Split text, semantic search, vector deletion | 60 seconds |
| Index chunks | 120 seconds |

The client has a validated generic timeout setting, but these listed feature methods explicitly pass their own timeouts. Changing `AI_SERVICE_TIMEOUT_MS` alone does not override those explicit values.

## Important implementation files

- [documentService.js](D:/Projects/Notes_ai/server/src/services/documentService.js): run-ID transitions and pending-work queries.
- [documentProcessingService.js](D:/Projects/Notes_ai/server/src/services/documentProcessingService.js): retry and completion orchestration.
- [documentCleanupService.js](D:/Projects/Notes_ai/server/src/services/documentCleanupService.js): concurrent cleanup and pending result.
- [documentMaintenanceService.js](D:/Projects/Notes_ai/server/src/services/documentMaintenanceService.js): startup processing/deletion recovery.
- [server.js](D:/Projects/Notes_ai/server/src/server.js): startup hook.
- [aiServiceClient.js](D:/Projects/Notes_ai/server/src/services/aiServiceClient.js): bounded internal HTTP calls.

## Verification and interview notes

Existing coverage: [documentReliability.test.js](D:/Projects/Notes_ai/server/test/documentReliability.test.js) checks outdated completion, bounded retry, hide-before-cleanup behavior, and maintenance; [documents.test.js](D:/Projects/Notes_ai/server/test/documents.test.js), [rag.test.js](D:/Projects/Notes_ai/server/test/rag.test.js), and [semanticSearch.test.js](D:/Projects/Notes_ai/server/test/semanticSearch.test.js) check connected behavior.

Manual check to perform with disposable data: interrupt extraction by restarting Express, reload and inspect recovery; temporarily make vector cleanup unavailable, delete a document, verify it disappears, restore the service and restart Express to finish cleanup. These scenarios were not executed as part of this docs-only task.

**Interview takeaway:** “I record recoverable intent before external operations. Run IDs reject outdated completion, and source rechecks protect reads while cross-service cleanup catches up.”
