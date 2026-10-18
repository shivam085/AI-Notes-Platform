# Phase 9: Quizzes

This is the third small slice of Phase 9. It turns one **saved private note**
into exactly five multiple-choice questions. Each question has four options, a
correct answer, and a short explanation. Gemini creates a preview first; no
quiz is stored until you select **Save quiz**.

## The request flow

```text
Choose a saved note
  -> React sends only its note ID to Express
  -> Express gets the signed-in user from Clerk
  -> Express loads that user's saved note from MongoDB
  -> Express sends the title and text to FastAPI
  -> FastAPI asks Gemini for JSON with five quiz questions
  -> FastAPI and Express validate every field
  -> React shows the answer key for review
  -> You choose Save quiz
  -> MongoDB stores the quiz under your account
```

When taking a saved quiz, React keeps the chosen answers in browser state,
calculates the score, and reveals the stored explanations. Gemini does not
grade the user or receive their answers.

## Structured quiz output

Gemini is asked for this JSON shape:

```json
{
  "questions": [
    {
      "question": "What is a database index used for?",
      "options": ["Faster lookups", "Deleting rows", "Encrypting data", "Backing up files"],
      "correct_option_index": 0,
      "explanation": "An index organizes data to make repeated lookups faster."
    }
  ]
}
```

FastAPI requires exactly five questions and four different options per
question. The correct-answer index must be from 0 through 3. Express repeats
these checks before the browser receives a preview. This validates response
structure; you should still review whether the facts and wording are useful.

## Try it in the workspace

1. Start the client, server, and AI service as described in the README.
2. Sign in, create a note with useful content, and save it.
3. Open the **Quizzes** section.
4. Choose the saved note and select **Generate 5 questions**.
5. Review all questions, answers, and explanations. Select **Regenerate** if
   the preview is not suitable.
6. Select **Save quiz** to keep it.
7. Open a saved quiz, choose one option for each question, then select
   **Check score**. The explanations appear after submission.

Deleting a quiz removes only the saved quiz. It never changes the source note.

## Routes

| Method and route | Purpose |
| --- | --- |
| `POST /api/study/quizzes/generate` | Generates a five-question preview from an owned saved note. |
| `POST /api/study/quizzes` | Saves a reviewed quiz for its owner. |
| `GET /api/study/quizzes` | Lists the signed-in user's saved quizzes. |
| `GET /api/study/quizzes/:id` | Opens one owned quiz, including its questions. |
| `DELETE /api/study/quizzes/:id` | Deletes one owned quiz. |
| `POST /internal/generate-quiz` | Internal Express-to-FastAPI endpoint protected by `X-AI-Service-Token`. |

## Storage and privacy

The existing MongoDB `StudySet` model now stores both flashcard and quiz study
sets. A quiz records its source-note details, five questions, options, correct
answer indexes, explanations, timestamps, and the Clerk-derived owner ID. Each
query filters by both owner ID and the `quiz` type.

## Important files to learn from

| File | Responsibility |
| --- | --- |
| `client/src/Quiz.jsx` | Generates, reviews, saves, takes, and scores quizzes. |
| `server/src/routes/study.routes.js` | Defines the protected quiz REST routes. |
| `server/src/services/studyService.js` | Loads owned notes, validates questions, and saves private quizzes. |
| `server/src/models/StudySet.js` | Defines the shared MongoDB shape for flashcards and quizzes. |
| `ai-service/app/services/study_service.py` | Prompts Gemini for structured quiz JSON. |
| `ai-service/app/schemas.py` | Defines the request and five-question response rules. |

## Verification

Verification completed on 13 October 2026:

- `npm.cmd test` in `server/`: 33 passing tests, including owned-note quiz
  generation and private save/open/list/delete coverage.
- `.\\.venv\\Scripts\\python.exe -m unittest discover -s tests -v` in `ai-service/`:
  24 passing tests, including the protected quiz endpoint and duplicate-option
  validation.
- `npm.cmd run build` in `client/`: production build passed.
- A live request with safe sample database text returned five validated quiz
  questions. No saved note or document content was used.

[Gemini structured output documentation](https://ai.google.dev/gemini-api/docs/structured-output)

## Code simplification — 17 October 2026

Current paths above reflect shared study-set services/controllers and one structured Gemini service. Each feature keeps its own validation and explicit routes; public API and saved data shapes are unchanged. Earlier verification notes remain historical.
