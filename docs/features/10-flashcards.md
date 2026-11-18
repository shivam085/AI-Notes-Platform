# Flashcard generation, saved decks, and review

Reviewed against the local source on 25 October 2026. [Feature index](README.md).

## Purpose and user flow

Turn a saved note into exactly five question-and-answer cards for revision. Select a note in Flashcards, generate cards, inspect the preview, and explicitly save a deck.

Saved decks can be opened later, flipped to reveal answers, navigated with previous/next, shuffled, and deleted. Generation and persistence are separate: the preview is temporary until saved.

## API contract

| Method and path | Input | Success |
| --- | --- | --- |
| `POST /api/study/flashcards/generate` | `{noteId}` | `{noteId, noteTitle, cards}` |
| `POST /api/study/flashcards` | `{noteId, cards}` | 201, `{studySet}` |
| `GET /api/study/flashcards` | None | `{studySets}`, metadata/counts |
| `GET /api/study/flashcards/:id` | Deck ID | `{studySet}`, including cards |
| `DELETE /api/study/flashcards/:id` | Deck ID | 204 |

Each card has this shape:

```json
{
  "question": "What does atomicity mean?",
  "answer": "All operations in a transaction succeed together or none take effect."
}
```

A valid generation/save array must contain exactly five such objects. The example above shows one item's schema, not a complete save payload.

## Generation flow

1. Express's shared study service loads the owned saved note.
2. It requires nonempty content of at most 12,000 characters.
3. It obtains the AI client lazily and sends the note title/text to `/internal/generate-flashcards`.
4. Python builds a source-focused prompt using the common generation provider.
5. The provider returns structured data matching FlashcardGenerationResponse.
6. Python and Express validate exactly five cards and bounded nonempty fields.
7. React stores the preview without creating a StudySet.
8. Save posts the selected note ID and preview cards; the service rechecks the note and card schema before creating the deck.

Questions allow at most 240 characters; answers allow at most 1,000. Text is trimmed and whitespace-normalized. The model output budget is 4,000 tokens.

## Persistence and ownership

Flashcards and quizzes share the StudySet collection, with a `type` discriminator and separate validators. Flashcard rows use `type: "flashcards"`, `cards`, owner ID, generated title, source snapshot, and timestamps.

The source snapshot records source type, note ID, and note title. The deck title is built from the note title plus “flashcards.” List responses include `cardCount`; get/save responses include the cards.

Every deck lookup filters both owner and type. A quiz ID cannot be used as a flashcard deck. Generation currently supports saved notes only, even though the storage model has a broader source-type enum.

## Snapshot behavior and limitations

Saved cards remain unchanged when the original note is edited. They remain readable if that note is later deleted. Creating a new saved set still requires an accessible nonempty note within the study limit.

The save API validates shape and source ownership; it does not verify that the cards were actually produced by the model or factually follow the note. This is suitable for personal study, not an authoritative assessment record.

There is no spaced-repetition scheduler, recall tracking, deck sharing, saved review progress, or deck-edit endpoint. Flipping/shuffling/navigation are client state.

## Configuration, failures, and files

Generation needs the selected provider and FastAPI. Already saved decks remain usable without AI-generation configuration because the client is created only when generating.

Invalid note/card input returns 400, missing/inaccessible note or deck 404, missing AI configuration 503, and provider/transport failure generally 502. Generation uses a 60-second internal timeout.

- [Flashcards.jsx](D:/Projects/Notes_ai/client/src/Flashcards.jsx): preview, saving, flip/navigation/shuffle.
- [study.routes.js](D:/Projects/Notes_ai/server/src/routes/study.routes.js): flashcard and quiz mappings.
- [studyController.js](D:/Projects/Notes_ai/server/src/controllers/studyController.js): shared HTTP handlers.
- [studyService.js](D:/Projects/Notes_ai/server/src/services/studyService.js): source checks, validators, persistence.
- [StudySet.js](D:/Projects/Notes_ai/server/src/models/StudySet.js): shared storage.
- [study_service.py](D:/Projects/Notes_ai/ai-service/app/services/study_service.py): card-generation prompt.

## Verification and interview notes

Existing coverage: [flashcards.test.js](D:/Projects/Notes_ai/server/test/flashcards.test.js) checks source ownership, CRUD, type isolation, invalid material, and reading without AI configuration. [test_app.py](D:/Projects/Notes_ai/ai-service/tests/test_app.py) checks the internal schema and provider mapping.

Manual check to perform: generate five cards, review and save, refresh, flip/navigate/shuffle, then delete the deck. Confirm a second account cannot open its ID.

**Interview takeaway:** “I separate generation from persistence so users can review content. Saved decks are snapshots and don't require another model call to study them.”
