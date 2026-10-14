# Phase 9: Flashcards

This is the second small slice of Phase 9. It turns one **saved private note**
into exactly five question-and-answer cards. Gemini generates a preview first;
the browser does not save anything until you select **Save flashcard deck**.

## The request flow

```text
Choose a saved note
  -> React sends only its note ID to Express
  -> Express gets the signed-in user from Clerk
  -> Express loads that user's saved note from MongoDB
  -> Express sends the title and text to FastAPI
  -> FastAPI asks Gemini for JSON with exactly five cards
  -> FastAPI and Express validate every question and answer
  -> React shows a preview
  -> You choose Save flashcard deck
  -> MongoDB stores the deck under your account
```

This order is important. The browser never supplies note text or an `ownerId`,
so it cannot ask Gemini to process another user's note by changing a request.

## What structured output means here

Gemini is asked for this predictable JSON shape:

```json
{
  "cards": [
    {
      "question": "What is a database index?",
      "answer": "A structure that speeds up repeated data lookups."
    }
  ]
}
```

FastAPI requires exactly five cards. A question may contain up to 240
characters and an answer up to 1,000 characters. Express checks the result a
second time before returning the preview. This validates the *shape* of the
response, but you should still review whether each card is correct and useful.

## Try it in the workspace

1. Start the client, server, and AI service as described in the README.
2. Sign in, create a note with some useful content, and save it.
3. Open the **Flashcards** section.
4. Choose the saved note and select **Generate 5 flashcards**.
5. Review the preview. Select **Regenerate** if you want a new preview.
6. Select **Save flashcard deck** only when you want to keep it.
7. Open a saved deck, select a card to flip it, then use next, previous, or
   shuffle while studying.

Deleting a deck removes only that account's saved flashcards. The original
note is never changed or deleted.

## Routes

| Method and route | Purpose |
| --- | --- |
| `POST /api/study/flashcards/generate` | Generates a five-card preview from an owned saved note. |
| `POST /api/study/flashcards` | Saves a reviewed five-card deck for its owner. |
| `GET /api/study/flashcards` | Lists the signed-in user's saved decks. |
| `GET /api/study/flashcards/:id` | Opens one owned deck, including its cards. |
| `DELETE /api/study/flashcards/:id` | Deletes one owned deck. |
| `POST /internal/generate-flashcards` | Internal Express-to-FastAPI endpoint protected by `X-AI-Service-Token`. |

## Storage

MongoDB's `StudySet` model stores the deck owner, type, source-note details,
five cards, and timestamps. Each query includes the Clerk-derived `ownerId`,
which keeps decks private even if another account guesses an ID.

## Important files to learn from

| File | Responsibility |
| --- | --- |
| `client/src/Flashcards.jsx` | Lets users generate, review, save, and study decks. |
| `server/src/routes/study.routes.js` | Defines the protected REST routes. |
| `server/src/services/flashcardService.js` | Loads owned notes, validates cards, and saves private decks. |
| `server/src/models/StudySet.js` | Defines the MongoDB shape for a flashcard deck. |
| `ai-service/app/services/flashcard_service.py` | Prompts Gemini for structured flashcard JSON. |
| `ai-service/app/schemas.py` | Defines the request and exact five-card response. |

## Timeouts and verification

`server/.env` can set `AI_SERVICE_TIMEOUT_MS` (default `45000`).
`ai-service/.env` can set `GEMINI_REQUEST_TIMEOUT_MS` (default `30000`).
The Python limit finishes first, so a slow Gemini request becomes a clear error
instead of keeping the internal request open indefinitely. Keep both values out
of the frontend and restart the matching service after changing them.

Verification completed on 13 October 2026:

- `npm.cmd test` in `server/`: 30 passing tests, including private generation
  and save/open/list/delete coverage for flashcards.
- `.\\.venv\\Scripts\\python.exe -m unittest discover -s tests -v` in `ai-service/`: 21 passing tests,
  including the protected internal flashcard endpoint and the five-card schema.
- `npm.cmd run build` in `client/`: production build passed.
- A live request with safe sample text returned five validated cards from the
  configured Gemini service. No saved note or document content was used.

[Gemini structured output documentation](https://ai.google.dev/gemini-api/docs/structured-output)
