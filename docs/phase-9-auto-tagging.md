# Phase 9: Auto-tagging notes and PDFs

This Phase 9 feature suggests tags for a saved private note or a text-ready
private PDF. Suggestions are never saved automatically. For a note, you review
them, add them to the tag field, and choose **Save note**. For a PDF, you review
or edit the document tag field, then choose **Save tags**.

## What happens when you select “Suggest tags with AI” for a note

```text
Saved note
  -> React sends only the note ID to Express
  -> Express verifies the Clerk session and loads that user's note
  -> Express sends the saved title and text to FastAPI
  -> FastAPI asks Gemini for structured JSON: { "tags": [...] }
  -> FastAPI and Express validate the tag list
  -> React displays editable suggestions
  -> You choose “Use suggestions” and then save the note
```

The browser cannot provide note text or an owner ID for this action. Express
uses the signed-in user ID and the saved note ID, so another account's note is
never sent to Gemini.

## What happens for a PDF

```text
Text-ready private PDF
  -> React sends only the document ID to Express
  -> Express verifies the Clerk session and loads that user's extracted PDF text
  -> Express sends the saved filename and extracted text to FastAPI
  -> FastAPI asks Gemini for structured JSON: { "tags": [...] }
  -> FastAPI and Express validate the tag list
  -> React places the suggestions in an editable document tag field
  -> You choose “Save tags” to store the final list
```

The PDF must first have **Extract text** completed. An unprocessed PDF never
reaches Gemini. A document belonging to another account returns a normal 404,
without sending any of its text to the AI service.

## Structured AI output

For summaries, Gemini returns normal text. For tag suggestions, the app asks
for a predictable JSON object:

```json
{ "tags": ["database", "revision", "indexes"] }
```

FastAPI validates the response before Express receives it. Each tag must be
non-empty, lowercase after normalization, at most 30 characters, and the list
may contain at most five suggestions. Express checks the returned shape again.

Structured output makes it easier for application code to use a model response,
but it does not make each suggestion correct. That is why the user keeps the
final choice.

## Try it in the workspace

1. Start the JavaScript and Python services as described in the README.
2. Sign in and open a saved note with content.
3. Save any edits first. Suggestions always use the saved version of the note.
4. Select **Suggest tags with AI**.
5. Review the 3–5 suggestions in the AI tag suggestions panel.
6. Select **Use suggestions** to place them in the normal tags field.
7. Edit or remove any tag, then select **Save note** to store the final list.

The first version accepts note content up to 12,000 characters for a tag
request. A longer note shows a clear message instead of silently dropping text.
The PDF path has the same 12,000-character limit for all extracted page text;
the app asks you to use a shorter PDF rather than silently truncating it.
The shared server-to-FastAPI timeout defaults to 45 seconds through
`AI_SERVICE_TIMEOUT_MS` in `server/.env`; this also gives later study tools
enough time to return structured output.

## API routes

| Method and route | Purpose |
| --- | --- |
| `POST /api/ai/suggest-tags` | Uses an owned, saved note to return validated tag suggestions. |
| `POST /api/ai/documents/:id/suggest-tags` | Uses an owned, text-ready PDF to return validated tag suggestions. |
| `PATCH /api/documents/:id` | Explicitly saves reviewed document tags. |
| `POST /internal/suggest-tags` | Internal Express-to-FastAPI endpoint protected by `X-AI-Service-Token`. |

## Files to learn from

| File | Responsibility |
| --- | --- |
| `server/src/services/tagSuggestionService.js` | Loads the owned saved note or extracted PDF text and applies the request limit. |
| `server/src/controllers/tagController.js` | Converts HTTP requests and errors into JSON responses. |
| `server/src/services/documentService.js` | Reads ready extracted text and saves explicitly reviewed document tags. |
| `server/src/services/aiServiceClient.js` | Sends the internal request from Express to FastAPI. |
| `ai-service/app/services/tag_service.py` | Prompts Gemini for structured JSON and validates the result. |
| `ai-service/app/schemas.py` | Defines the incoming request and the JSON tag shape. |
| `client/src/NotesWorkspace.jsx` | Shows suggestions and lets the user add them before saving. |
| `client/src/DocumentsWorkspace.jsx` | Shows PDF suggestions in an editable tag field and saves them explicitly. |

## Verify the feature

```powershell
# From D:\Projects\Notes_ai
npm.cmd test
npm.cmd run build

# From D:\Projects\Notes_ai\ai-service
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

The tests check that only an owned saved note or an owned text-ready PDF is sent
to the AI service, another account's source is rejected, an unprocessed PDF is
blocked, document tags remain private when saved, the internal endpoint requires
its service token, and duplicate suggestions normalize to one tag.

Final verification on 14 October 2026 passed with 37 Node tests, 24 FastAPI
tests, the frontend production build, and a live Gemini request that returned
four validated tags for harmless sample study text. An earlier HTTP 503 was a
temporary Gemini capacity response; retrying later succeeded without changing
the API key or application code.

[Gemini structured output documentation](https://ai.google.dev/gemini-api/docs/structured-output)
