# Notes, organization, and keyword search

Reviewed against the local source on 25 October 2026. [Feature index](README.md).

## Purpose and user flow

Create and maintain private text notes. Each note has a title, content, an optional folder label, and tags. Select a saved note to edit it, use Save note to persist changes, or delete it after the UI confirmation.

Folder support is currently a `folderId` text field. There is no Folder collection, nested folder tree, or folder CRUD API. Tags are metadata on each note. The editor saves explicitly; it is not a collaborative or automatic-save editor.

## API contract

All endpoints require Clerk authentication and a configured MongoDB connection.

| Method and path | Input | Success |
| --- | --- | --- |
| `POST /api/notes` | title, content, folderId, tags | 201, `{note}` |
| `GET /api/notes` | Optional query `q` | 200, `{notes}` |
| `GET /api/notes/:id` | Note ID | 200, `{note}` |
| `PUT /api/notes/:id` | Complete editable fields and version | 200, `{note}` |
| `DELETE /api/notes/:id` | Note ID | 204, empty body |

Example create body, with no owner field:

```json
{
  "title": "Database transactions",
  "content": "A transaction groups operations into one logical unit.",
  "folderId": "interview-preparation",
  "tags": ["database", "transactions"]
}
```

To update, include the `version` returned by the last read or save. PUT validates the entire editable record; do not treat it as a partial PATCH.

## Validation and persistence

| Field | Rule |
| --- | --- |
| title | Trimmed, required, maximum 140 characters |
| content | Text, maximum 50,000 characters; may be empty |
| folderId | Optional, maximum 100 characters |
| tags | Trimmed, lowercase, unique, up to 10 tags of 30 characters each |
| version | Nonnegative integer required for updates |

MongoDB's Note model also stores an immutable `ownerId` and timestamps. The note ID identifies the record; the owner filter decides whether the current account can use it.

## Preventing lost updates

Suppose two tabs read version 0. Tab A saves with version 0; MongoDB atomically matches that version and increments it to 1. Tab B's later save with version 0 cannot match the current record. The server returns 409 and asks for a reload instead of silently overwriting A's work.

This is optimistic concurrency control. It detects conflicting saves; it does not merge edits or synchronize open tabs.

## Keyword search

`GET /api/notes?q=transaction` uses MongoDB's text index on title and content with an owner filter. Matching notes are ordered by text relevance, then update time; an empty search lists the user's notes by newest update. Search text is limited to 100 characters.

Keyword search does not call Python, Gemini, or Qdrant and needs no vector indexing. It searches note text rather than document contents or folder/tag fields. See [semantic search](07-semantic-search.md) for meaning-based retrieval and metadata filters.

## Connections to AI features

Summary, tags, flashcards, and quizzes load the saved note from MongoDB. Unsaved editor content is not their source. Save before generating. Notes may contain 50,000 characters, but summary/study generation accepts only 12,000; storing a long note does not guarantee it can be passed to every AI feature.

After editing a note, explicitly reindex to refresh semantic search. Stored chunks record the note version; search excludes stale versions. Deleting a note removes the Note record, but currently does not directly purge its old chunks/vectors. Source rechecks prevent those stale results from being returned.

## Important implementation files

- [NotesWorkspace.jsx](D:/Projects/Notes_ai/client/src/NotesWorkspace.jsx): editor, draft state, search and feature buttons.
- [notes.routes.js](D:/Projects/Notes_ai/server/src/routes/notes.routes.js): HTTP routes.
- [notesController.js](D:/Projects/Notes_ai/server/src/controllers/notesController.js): status codes and verified owner.
- [noteService.js](D:/Projects/Notes_ai/server/src/services/noteService.js): validation, text query, atomic version check.
- [Note.js](D:/Projects/Notes_ai/server/src/models/Note.js): persisted fields and indexes.

## Verification and interview notes

Existing coverage: [notes.test.js](D:/Projects/Notes_ai/server/test/notes.test.js) checks normalization, separate account lists, creation, and stale-version conflicts. Relevant search coverage lives in [semanticSearch.test.js](D:/Projects/Notes_ai/server/test/semanticSearch.test.js).

Manual check to perform: create a note, find it by a title/content word, edit it in two tabs, and confirm the second outdated save receives a conflict. Check that deleting it removes it from the normal list.

**Interview takeaway:** “I use a version field in the update filter to prevent lost updates. Keyword search is a MongoDB text-index operation; semantic search is a separate embedding-based feature.”
