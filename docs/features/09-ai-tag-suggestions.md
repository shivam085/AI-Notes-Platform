# AI tag suggestions for notes and documents

Reviewed against the local source on 25 October 2026. [Feature index](README.md).

## Purpose and user flow

Suggest 3–5 short labels that help organize a saved note or extracted document. Suggestions are reviewed by the user before becoming metadata; generation does not automatically update the source.

For notes, save current edits, choose Suggest tags with AI, then add the suggestions to the tags field. Edit the combined list if necessary and Save note. For documents, extract text first, request suggestions, review/edit the tag field, and use Save tags.

## API contract

| Method and path | Input | Response |
| --- | --- | --- |
| `POST /api/ai/suggest-tags` | `{"noteId":"owned-id"}` | `{noteId, tags}` |
| `POST /api/ai/documents/:id/suggest-tags` | Document ID in path | `{documentId, tags}` |
| `PUT /api/notes/:id` | Complete note fields, tags, version | Persist note tags |
| `PATCH /api/documents/:id` | `{"tags":["database","transactions"]}` | Persist document tags |

A suggestion response might contain `["database", "transactions", "consistency"]`. This is illustrative; the actual tags depend on the source and model.

## Code and data flow

1. Express derives identity from Clerk.
2. For a note, load the owned saved note. For a document, require an owned document with ready extracted text.
3. Trim note content, or join nonempty extracted pages with blank lines.
4. Reject empty or overlong text before invoking the internal client.
5. Send title and text to `POST /internal/suggest-tags`.
6. Python's GeminiStudyService builds a provider-neutral tag prompt and requests structured output.
7. Pydantic normalizes and validates the generated tags.
8. Express validates the response shape and returns the suggestions.
9. A separate source-update request persists the user's accepted tags.

No vector lookup or generation-time database write occurs. Document tagging uses extracted text from MongoDB rather than fetching the original file again.

## Validation and practical limits

- Source text must contain 1–12,000 characters.
- Shared Python StudyRequest limits the title to 140 characters.
- Document filenames may be up to 180 characters in the model, so a long filename can pass upload yet exceed the study request's title limit.
- Generated output must contain 3–5 distinct normalized tags.
- Each tag is nonempty, at most 30 characters, lowercase, and whitespace-normalized.
- Saved source metadata allows up to 10 tags. Adding suggestions to an existing list can exceed that limit; review before saving.
- The structured-generation output budget is 4,000 tokens.

Structured output means the model is asked to produce a particular data shape. It does not guarantee that the suggested categories are the best ones.

## Configuration and failures

Uses the selected generation provider, matching internal token, Clerk, and MongoDB. Qdrant is not needed to generate tags. Documents must already have been successfully extracted.

An empty/oversized source returns 400 from the service; an unready document returns 409; inaccessible source returns 404. Invalid model output or an upstream service failure generally produces 502 at the public API. The internal request has a 60-second timeout.

Reindex after saving tags if semantic-search filters should use the updated metadata. Saving tags does not automatically refresh Qdrant payloads.

## Important implementation files

- [NotesWorkspace.jsx](D:/Projects/Notes_ai/client/src/NotesWorkspace.jsx): note suggestions, draft merge, explicit save.
- [DocumentsWorkspace.jsx](D:/Projects/Notes_ai/client/src/DocumentsWorkspace.jsx): document suggestions and tag PATCH.
- [aiService.js](D:/Projects/Notes_ai/server/src/services/aiService.js): source ownership and text limits.
- [aiController.js](D:/Projects/Notes_ai/server/src/controllers/aiController.js): response/error mapping.
- [study_service.py](D:/Projects/Notes_ai/ai-service/app/services/study_service.py): tag prompt.
- [schemas.py](D:/Projects/Notes_ai/ai-service/app/schemas.py): StudyRequest and TagSuggestionResponse.

## Verification and interview notes

Existing coverage: [tagSuggestion.test.js](D:/Projects/Notes_ai/server/test/tagSuggestion.test.js) checks owned notes/documents, forbidden sources, and extracted-text requirements; [documents.test.js](D:/Projects/Notes_ai/server/test/documents.test.js) checks saving tags; [test_app.py](D:/Projects/Notes_ai/ai-service/tests/test_app.py) checks normalization and structured generation.

Manual check to perform: generate tags, refresh before saving to confirm suggestions were temporary, then generate again and save. Check the updated metadata and reindex before filtering semantic results.

**Interview takeaway:** “AI proposes metadata; a separate validated save makes the change explicit. I validate the output in Python and again at the application boundary.”
