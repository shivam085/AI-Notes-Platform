# Detailed feature documentation

Source review: **25 October 2026**. These guides describe the current local implementation, including limitations. They complement the chronological phase notes; they do not mark deployment or optional V2 work complete.

## Start here

Read the numbered guides in order for a full walkthrough. Each explains the user flow, request/code flow, API and data contract, validation, configuration, important source files, failures, existing tests, manual checks, and an interview takeaway.

| # | Guide | What it covers |
| --- | --- | --- |
| 01 | [Authentication and private workspace](01-authentication-and-private-workspace.md) | Clerk, sessions, protected routes, ownership and account isolation |
| 02 | [Notes, organization, and keyword search](02-notes-organization-and-keyword-search.md) | Create/edit/delete notes, folder/tag fields, version conflicts, MongoDB text search |
| 03 | [Private document uploads and access](03-private-document-uploads-and-access.md) | PDF/DOCX/TXT/Markdown upload, validation, Cloudinary storage, signed open/download links |
| 04 | [Document extraction and chunking](04-document-extraction-and-chunking.md) | LangChain loaders, text inspection, page metadata, overlap, processing states |
| 05 | [Note summarization](05-note-summarization.md) | Saved-note summaries, provider calls, limits, temporary display |
| 06 | [Embeddings and vector indexing](06-embeddings-and-vector-indexing.md) | Gemini vectors, Qdrant payloads, note versions, explicit reindexing |
| 07 | [Semantic search](07-semantic-search.md) | Meaning-based retrieval, source/folder/tag filters, current-source rechecks |
| 08 | [Document Q&A, sources, and history](08-document-qa-sources-and-history.md) | RAG, similarity threshold, evidence, refusals, saved conversations, deleted sources |
| 09 | [AI tag suggestions](09-ai-tag-suggestions.md) | Notes/documents, structured output, review and explicit save |
| 10 | [Flashcards](10-flashcards.md) | Five-card generation, private saved decks, flip/navigation/shuffle |
| 11 | [Quizzes and local scoring](11-quizzes-and-local-scoring.md) | Five MCQs, answer explanations, saved quizzes, deterministic client scoring |
| 12 | [Gemini and embedding configuration](12-gemini-claude-and-embedding-configuration.md) | Exact environment variables, restart procedure, adapters, embedding independence |
| 13 | [Recovery, deletion, and failures](13-recovery-deletion-and-failure-handling.md) | Run IDs, bounded retry, startup recovery, multi-store cleanup, timeouts |
| 14 | [Architecture, configuration, and testing](14-architecture-configuration-and-testing.md) | Component responsibilities, setup commands, API boundaries, test map, end-to-end checklist |

## Feature dependencies

| Feature | Main dependencies after authentication |
| --- | --- |
| Notes and keyword search | MongoDB |
| Upload/open/download | MongoDB, Cloudinary |
| Extraction/chunking | MongoDB, Cloudinary, FastAPI, LangChain |
| Summary, tags, new flashcards/quizzes | MongoDB, FastAPI, selected generation provider |
| Existing saved cards/quizzes | MongoDB; no generation request |
| Indexing and semantic search | MongoDB, FastAPI, Gemini embeddings, Qdrant |
| Document Q&A | Ready/indexed documents, retrieval dependencies, selected generation provider |
| Document deletion | MongoDB plus Cloudinary and vector cleanup; can remain pending |

Generation and embeddings both use Gemini, with separate model settings. Python internal routes require the shared service token in every case.

## The main learning sequence

```text
Sign in -> save a note or upload a document
                      |
             load and extract text
                      |
                split into chunks
                      |
                create embeddings
                      |
                store in Qdrant
                      |
          retrieve relevant owned chunks
                      |
          generate an answer with sources
```

Direct summary/tag/study generation can use a short saved source without the retrieval pipeline. Document extraction, vector indexing, and asking a question are separate user actions.

## Current scope and cautions

- Six AI features are implemented: summary, semantic search, document Q&A, tag suggestions, flashcards, and quizzes.
- Folder support is a metadata field, not a separate folder-management feature.
- Summary/card/quiz generation uses saved notes; tags additionally support ready documents; Q&A retrieves documents only.
- Saved conversation history is displayed but is not passed as conversational memory to the next model call.
- Generated schemas and the grounded flag do not prove factual accuracy.
- Indexing is manual and currently submits one batch capped at 100 chunks.
- Document cleanup can recover after restart; note deletion does not use the same cleanup workflow.
- OCR, shared editing, spaced repetition, stored quiz attempts, automatic indexing, and distributed workers are not implemented.
- Phase 10 remains In Progress. Docker/Compose/Nginx/HTTPS/public deployment are deferred. Sharing, roles, Yjs, and WebSockets require a later V2 decision.

## How to use the examples and verification notes

IDs, API keys, URLs, and model placeholders in examples must be replaced with appropriate local values. Private environment values are deliberately not included.

Test sections identify existing automated coverage. Manual checklists describe actions to perform; they do not claim those actions were run for this documentation task. This documentation update checks Markdown links, API-route coverage, and consistency with the inspected source. It does not claim a new live Gemini or browser verification.

For historical implementation/results, read [Phase 10 local hardening](../phase-10-local-hardening.md) and the earlier phase guides. For additional interview questions, see [placement interview questions and answers](../placement-interview-questions-and-answers.md).

## Maintaining these guides

When behavior changes, update the owning feature guide and this index where scope/dependencies change. Check routes, schemas, service logic, and UI together; examples and test descriptions must match actual code. Preserve historical phase entries and date any correction to earlier behavior claims.
