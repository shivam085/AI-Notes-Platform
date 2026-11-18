# Document Q&A, source references, and conversation history

Reviewed against the local source on 25 October 2026. [Feature index](README.md).

## Purpose and user experience

Ask questions about ready, indexed documents. The app retrieves relevant passages, sends a focused prompt to Gemini, and saves the question/answer with source references.

Use Ask your documents, submit a question, then open a saved conversation to review earlier answers. Delete a conversation when it is no longer needed. This feature currently retrieves documents only, although general semantic search also supports notes.

## API contract

| Method and path | Input | Success |
| --- | --- | --- |
| `POST /api/ai/chat` | question; optional conversationId | 201 new conversation, 200 existing |
| `GET /api/ai/conversations` | None | `{conversations}` |
| `GET /api/ai/conversations/:id` | Conversation ID | `{conversation, messages}` |
| `DELETE /api/ai/conversations/:id` | Conversation ID | 204 |

Example request:

```json
{"question":"What does the document say about transaction isolation?"}
```

An ask response contains `conversation`, `userMessage`, and `assistantMessage`. Messages include role, content, grounded status, source availability, source references, and creation time. Subsequent questions can include the returned conversation ID.

## RAG flow

RAG means retrieval-augmented generation: retrieve evidence first, then generate from it.

1. Validate a nonblank question of at most 2,000 characters.
2. Load the owned conversation or create a new one titled from the first 160 characters.
3. Search documents with a candidate limit of four.
4. Reject nonfinite/weak scores using `RAG_MIN_SIMILARITY_SCORE` (default 0.55).
5. Recheck the owner, ready document, and stored chunk in MongoDB.
6. If no context survives, return the fixed insufficient-information answer without calling generation.
7. Otherwise send the question and authorized contexts to `/internal/answer-question`.
8. Python bounds the context, labels source titles/pages, and tells the model to use only supplied evidence.
9. Express saves both messages and source metadata, then updates conversation ordering.

The prompt treats retrieved text as untrusted reference material rather than commands. This reduces a prompt-injection risk but is not a proof of immunity.

## Context limits and grounding

Defaults are four chunks and a 7,000-character budget for source headers/text. Separator text adds a small amount beyond that budget; this is not an exact cap on the whole prompt. The question and instructions are additional. Generation has a 4,000-token output budget.

The fixed refusal is:

> I couldn't find enough information in your documents to answer that.

Python currently sets `grounded` by comparing the generated answer with that exact refusal string. It is not an independent factual verifier. The model can still make mistakes; source inspection remains necessary.

Source references are built by Express from verified retrieved chunks, not invented IDs returned by the model. They are a list of supplied evidence, not sentence-by-sentence attribution. Context truncation can also mean not every attached source was fully included in the final prompt.

## History and persistence

Conversation stores owner, title, last-message time, and timestamps. Message stores owner, conversation ID, role, content, grounded flag, and source references.

History is persisted for display, but prior messages are not currently included in the next generation request. A follow-up such as “Explain that again” may lack context; ask a self-contained question.

When loading history, Express rechecks source documents. Deleted/unavailable source links are removed. An answer whose original sources are all gone is marked `sourceUnavailable` and no longer presented as grounded, while its saved text remains.

Conversation creation and message writes are not one database transaction. An upstream failure after creation can leave an empty conversation; concurrent writes are not a distributed chat protocol.

## Configuration, errors, and files

Requires generation configuration plus Gemini embeddings and Qdrant. Set the similarity threshold in the server environment; context settings belong in Python's environment. The answer call has a 60-second Express timeout.

Invalid input returns 400; inaccessible conversation 404; AI configuration/service failures 503/502. Weak evidence is a normal successful refusal, not an HTTP error.

- [RagChat.jsx](D:/Projects/Notes_ai/client/src/RagChat.jsx): question form, source links, history.
- [ragController.js](D:/Projects/Notes_ai/server/src/controllers/ragController.js) and [ragService.js](D:/Projects/Notes_ai/server/src/services/ragService.js): ownership, retrieval filtering, persistence.
- [Conversation.js](D:/Projects/Notes_ai/server/src/models/Conversation.js) and [Message.js](D:/Projects/Notes_ai/server/src/models/Message.js): history schemas.
- [rag_service.py](D:/Projects/Notes_ai/ai-service/app/services/rag_service.py): bounded prompt and refusal behavior.

## Verification and interview notes

Existing coverage: [rag.test.js](D:/Projects/Notes_ai/server/test/rag.test.js) checks rechecked context, absent/weak evidence, owner-scoped history/deletion, and unavailable sources. [test_app.py](D:/Projects/Notes_ai/ai-service/tests/test_app.py) checks internal RAG request handling.

Manual check to perform: ask an answerable document question, inspect its source, ask an unrelated question, then delete the source and reopen the saved conversation.

**Interview takeaway:** “RAG reduces unsupported answers by limiting generation to retrieved evidence. My app also filters weak matches and rechecks ownership, but the grounded flag does not prove factual accuracy.”
