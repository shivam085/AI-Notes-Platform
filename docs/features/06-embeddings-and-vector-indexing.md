# Embeddings and vector indexing

Reviewed against the local source on 25 October 2026. [Feature index](README.md).

## Purpose and concept

An embedding is a list of numbers representing aspects of a text's meaning. Similar passages can have nearby vectors. Indexing prepares stored text for semantic search; it does not itself answer a question.

This project uses Gemini embeddings for indexing and retrieval. Qdrant stores and compares vectors, while MongoDB remains the source of truth for ownership and current content.

## User action and API

After saving notes or extracting documents, select Index notes and documents.

`POST /api/search/reindex` requires authentication and no source IDs in its body. Express loads the current owner's saved notes and ready, nondeleted documents.

Example response:

```json
{"indexedCount": 8, "documentChunkCount": 5, "noteChunkCount": 3}
```

Counts describe chunks submitted/indexed in this operation, not a count of files. An empty set returns all three counts as zero.

## Indexing flow

1. Read ready document chunks already stored in MongoDB.
2. Load the owner's notes and send nonempty note content to `/internal/split-text`.
3. Build note chunks with fresh MongoDB IDs and the note's current `sourceVersion`. Note chunks use a null page number in storage/search.
4. For empty notes, remove their existing vectors and stored note chunks.
5. Combine note and document chunks and call `/internal/index-chunks`.
6. Python embeds each chunk using Gemini's document-retrieval task.
7. Qdrant prepares payload indexes and computes a deterministic UUID from each chunk ID.
8. All replacement embeddings are prepared before existing vectors for each owner/source are deleted.
9. New points are upserted. Express then replaces stored note chunks with the indexed versions.

The embedding-before-deletion order protects existing vectors from an early embedding failure. It is not a transaction: an upsert failure after deletion or a later MongoDB write failure can still leave partial state.

## Data stored in Qdrant

Each point contains a vector and payload fields: `chunkId`, `ownerId`, `sourceType`, `sourceId`, `position`, `pageNumber`, `text`, `title`, `folderId`, and `tags`.

Payload indexes support filters on owner/source/folder/tags. The vector collection uses cosine distance. Stored source IDs and chunk IDs allow Express to recheck a candidate against MongoDB before exposing content.

## Configuration

In `D:/Projects/Notes_ai/ai-service/.env`:

```dotenv
GEMINI_API_KEY=<private-gemini-key>
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
GEMINI_EMBEDDING_DIMENSIONS=768
QDRANT_URL=<your-qdrant-cloud-cluster-url>
QDRANT_API_KEY=<private-qdrant-database-key>
QDRANT_COLLECTION=ai_notes_chunks
```

The model and dimensions above are repository defaults, not a claim about the newest provider model. A runtime cloud configuration is required; tests may inject an in-memory client.

A new collection is created with the configured dimensions if absent. Existing collections are not automatically migrated or fully checked for a matching model/dimension setup. Changing embedding model or dimensions requires compatible storage and a full reindex. Changing only generation provider/model does not.

## Capacity and freshness limitations

- Each embedding input is limited to 2,000 characters.
- The internal index request accepts 1–100 chunks.
- Express currently submits one combined batch; it does not split a larger library into batches. More than 100 total chunks can fail validation.
- The internal indexing request timeout is 120 seconds; large batches can still exceed available provider capacity or time.
- Indexing is explicit, not automatically triggered on saves, extraction, or tag changes.
- Reindexing current sources is not a general sweep of every orphaned Qdrant point.
- Note version rechecks hide stale results until a new index is available.

## Important implementation files

- [SemanticSearch.jsx](D:/Projects/Notes_ai/client/src/SemanticSearch.jsx): index action/counts.
- [semanticSearchService.js](D:/Projects/Notes_ai/server/src/services/semanticSearchService.js): owned source selection, note splitting, one-batch indexing.
- [KnowledgeChunk.js](D:/Projects/Notes_ai/server/src/models/KnowledgeChunk.js): source version and metadata.
- [embedding_service.py](D:/Projects/Notes_ai/ai-service/app/services/embedding_service.py): Gemini document/query tasks.
- [vector_store.py](D:/Projects/Notes_ai/ai-service/app/services/vector_store.py): collection, payload filters and replacement.
- [schemas.py](D:/Projects/Notes_ai/ai-service/app/schemas.py): request limits.

## Verification and interview notes

Existing coverage: [semanticSearch.test.js](D:/Projects/Notes_ai/server/test/semanticSearch.test.js) covers owned source indexing; [test_app.py](D:/Projects/Notes_ai/ai-service/tests/test_app.py) covers embedding task selection, owner filters, vector deletion, and cloud configuration.

Manual check to perform: index one short note and one ready document, compare reported chunk counts, edit the note, verify stale text disappears from search, then reindex and find the new content.

**Interview takeaway:** “Embeddings prepare semantic retrieval; they are different from generated answers. Query and document vectors must use a compatible model and dimensions.”
