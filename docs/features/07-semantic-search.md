# Semantic search across notes and documents

Reviewed against the local source on 25 October 2026. [Feature index](README.md).

## Purpose and user experience

Find relevant saved passages by meaning rather than only exact words. For example, “How do I avoid partial database updates?” may retrieve a passage about transaction atomicity even without that exact sentence.

First [index the sources](06-embeddings-and-vector-indexing.md), then enter a question or phrase in Semantic Search. Results show source title, passage text, source type, and page information when available.

## API contract

`GET /api/search/semantic` accepts these query parameters:

| Parameter | Rule |
| --- | --- |
| query | Required nonblank text, maximum 2,000 characters |
| sourceType | Optional `note` or `document` |
| folderId | Optional exact folder value, maximum 100 characters |
| tags | Optional tag value(s), up to 10 of 30 characters each |
| limit | Default 5, bounded to 1–10 |

Example:

```text
/api/search/semantic?query=database%20consistency&sourceType=note&folderId=interview-preparation&tags=database&limit=5
```

Response envelope is `{results: [...]}`. Each result contains `chunkId`, `sourceType`, `sourceId`, `title`, `pageNumber`, `position`, `text`, and `score`. A valid query with no acceptable matches returns an empty results array.

## Retrieval flow

1. Express verifies identity, validates the query, and derives the owner.
2. The internal client maps fields to Python's snake_case request.
3. Gemini embeds the query using the query-retrieval task.
4. Qdrant compares it with stored document/note vectors using cosine similarity.
5. The vector filter always includes owner ID. Optional source type and folder are exact matches; supplied tags use “match any.”
6. Express treats returned points as candidates, not trusted records.
7. It reloads owned Note/Document and KnowledgeChunk records from MongoDB.
8. Missing sources, missing chunks, mismatched source references, unready/deleted documents, and old note versions are removed.
9. Current MongoDB text and metadata are returned with the candidate similarity score.

For a note, the stored chunk's `sourceVersion` must equal the current note version. This makes an old vector unable to expose text that was replaced in a later save.

## Difference from keyword search and Q&A

| Feature | Main operation | Output |
| --- | --- | --- |
| Note keyword search | MongoDB text index | Notes matching words |
| Semantic search | Query embedding plus Qdrant retrieval | Relevant passages |
| Document Q&A | Retrieval plus generation | Answer and source references |

Semantic search does not call a text-generation model. It can operate while generation is unavailable if Gemini embeddings, Qdrant, and the internal service are working.

## Freshness and ranking caveats

Reindex after content or metadata changes. Qdrant applies folder/tag filters against indexed payload metadata, so those filters can lag behind MongoDB edits until reindexing. Returned display text/title comes from the current database recheck.

This search endpoint does not apply the RAG feature's 0.55 minimum-similarity threshold. A returned score is not a probability that the passage answers the user's question. Filtering stale candidates after retrieval can leave fewer results than requested; the service does not automatically fetch replacements.

## Failures and important files

Empty or invalid query returns 400; unauthenticated use returns 401; missing internal client configuration returns 503; embedding/vector/transport failure generally returns 502.

- [SemanticSearch.jsx](D:/Projects/Notes_ai/client/src/SemanticSearch.jsx): search form and results.
- [semanticSearch.routes.js](D:/Projects/Notes_ai/server/src/routes/semanticSearch.routes.js): search/index routes.
- [semanticSearchController.js](D:/Projects/Notes_ai/server/src/controllers/semanticSearchController.js): HTTP mapping.
- [semanticSearchService.js](D:/Projects/Notes_ai/server/src/services/semanticSearchService.js): validation and MongoDB rechecks.
- [vector_store.py](D:/Projects/Notes_ai/ai-service/app/services/vector_store.py): vector query and mandatory owner filter.

## Verification and interview notes

Existing coverage: [semanticSearch.test.js](D:/Projects/Notes_ai/server/test/semanticSearch.test.js) checks derived ownership, optional filters, empty queries, stale results, and current notes; [test_app.py](D:/Projects/Notes_ai/ai-service/tests/test_app.py) checks owner isolation in vector search.

Manual check to perform: search a paraphrase, filter by source type/tag, delete a source, and verify it no longer appears even if an old vector remains.

**Interview takeaway:** “Qdrant finds possible matches, but MongoDB decides whether their source is still owned and current. Retrieval ranking alone is never an authorization check.”
