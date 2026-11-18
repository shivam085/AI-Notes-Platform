# AI note summarization

Reviewed against the local source on 25 October 2026. [Feature index](README.md).

## Purpose and user experience

Generate a short summary of a saved note. Open a note and choose Summarize this note. The summary appears separately from the editor; it does not replace the note or save itself to MongoDB.

The source is the last saved content. The summary button can be used while the editor has unsaved changes, but those changes are not sent. Save first if they should be included.

## Request and response

`POST /api/ai/summarize` requires a Clerk session:

```json
{"noteId": "an-owned-note-object-id"}
```

Successful response:

```json
{
  "noteId": "an-owned-note-object-id",
  "summary": "- Transactions group related operations.\n- Atomicity avoids partial changes."
}
```

The example illustrates the shape, not a promised model output. The client sends a note ID rather than arbitrary text or an owner ID.

## Code flow

1. React gets the current session token through the shared API helper.
2. Express derives the owner from Clerk and loads that owner's saved note.
3. The service trims its content and rejects an empty source.
4. The shared internal client sends `{"text":"..."}` to `POST /internal/summarize`.
5. FastAPI checks `X-AI-Service-Token` and validates the request.
6. GeminiSummaryService builds the summary prompt independently of the vendor SDK.
7. GeminiSummaryService calls Gemini directly to generate the summary.
8. The validated nonempty summary returns to React.

This is direct generation from a short source. No retrieval, embeddings, Qdrant, or document processing is involved.

## Prompt, limits, and persistence

The prompt asks for 3–5 short bullet points and a factual summary of the supplied note. The output budget is 1,000 tokens. A prompt instruction is not an exact bullet-count validator; the adapter/client check a usable text response.

Python's request schema accepts 1–12,000 characters. The Note model permits 50,000 characters, so a valid stored note can exceed the summary input limit. Express does not currently provide the same explicit upper-length precheck as the study service; a Python rejection can surface as a generic AI-service failure.

No Summary collection or summary field is written. The display is React state, and switching notes clears it. Copy useful output into the editor and explicitly save if it should become part of the note.

## Configuration and failures

Required: Clerk, MongoDB, matching server/Python `AI_SERVICE_TOKEN`, running FastAPI, and the selected generation provider's key/model.

Express waits up to 60 seconds for this endpoint. The configured provider timeout defaults to 55,000 milliseconds, but SDK retry behavior may affect total elapsed time. A missing source returns 404, empty content 400, absent Express AI configuration 503, and failed/internal-invalid AI calls generally 502. Python provider configuration errors are 503 internally, but the Express client uses a safe generic error for non-success responses.

A working health endpoint does not prove the selected model ID, key, quota, or account access works. See the [provider guide](12-gemini-claude-and-embedding-configuration.md) for switching and troubleshooting.

## Important implementation files

- [NotesWorkspace.jsx](D:/Projects/Notes_ai/client/src/NotesWorkspace.jsx): request and separate summary display.
- [ai.routes.js](D:/Projects/Notes_ai/server/src/routes/ai.routes.js) and [aiController.js](D:/Projects/Notes_ai/server/src/controllers/aiController.js): public API.
- [aiService.js](D:/Projects/Notes_ai/server/src/services/aiService.js): owned saved-note lookup.
- [aiServiceClient.js](D:/Projects/Notes_ai/server/src/services/aiServiceClient.js): internal request and response validation.
- [gemini_service.py](D:/Projects/Notes_ai/ai-service/app/services/gemini_service.py): prompt and output budget.

## Verification and interview notes

Existing coverage: [ai.test.js](D:/Projects/Notes_ai/server/test/ai.test.js) proves ownership is checked before AI; [test_app.py](D:/Projects/Notes_ai/ai-service/tests/test_app.py) covers internal authentication, injected summary results, and provider-independent prompts.

Manual check to perform: summarize a short saved note, compare the bullets to its facts, refresh, and confirm the original content is unchanged. Verify another account's note ID never reaches the AI client.

**Interview takeaway:** “This feature sends an owned short note directly to a generation model. RAG is unnecessary because the whole permitted source fits within the input limit.”
