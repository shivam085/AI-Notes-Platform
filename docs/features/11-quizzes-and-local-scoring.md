# Quiz generation, saved quizzes, and local scoring

Reviewed against the local source on 25 October 2026. [Feature index](README.md).

## Purpose and user flow

Generate five multiple-choice questions from a saved note. Each question includes four distinct options, one correct option index, and an explanation.

Choose a saved note in Quizzes, generate, review the preview answer key/explanations, and save. Open a saved quiz, select an answer for every question, then choose Check score. React shows the score and explanations. Try again clears the current selections.

## API contract

| Method and path | Input | Success |
| --- | --- | --- |
| `POST /api/study/quizzes/generate` | `{noteId}` | `{noteId, noteTitle, questions}` |
| `POST /api/study/quizzes` | `{noteId, questions}` | 201, `{studySet}` |
| `GET /api/study/quizzes` | None | `{studySets}`, metadata/counts |
| `GET /api/study/quizzes/:id` | Quiz ID | `{studySet}`, including questions |
| `DELETE /api/study/quizzes/:id` | Quiz ID | 204 |

One question in a five-question array:

```json
{
  "question": "Which property prevents partial transaction completion?",
  "options": ["Atomicity", "Sorting", "Pagination", "Caching"],
  "correctOptionIndex": 0,
  "explanation": "Atomicity makes the transaction an all-or-nothing operation."
}
```

Python's structured output calls the index `correct_option_index`. The shared Express client converts it to `correctOptionIndex` for the browser and saved application data.

## Generation and validation

1. Load the owned saved note and require 1–12,000 characters of content.
2. Send title/text to `/internal/generate-quiz`.
3. GeminiStudyService builds the prompt and uses the selected Gemini adapter.
4. Validate exactly five questions, each with four distinct options.
5. Validate question length ≤240, option length ≤240, explanation length ≤1,000, and integer correct index 0–3.
6. Return a temporary preview.
7. A separate save revalidates the content and source, then creates a private StudySet.

The output budget is 4,000 tokens. Pydantic and Express both enforce structure, but neither proves that the answer key is factually correct. Review generated material against the source.

## Storage and deterministic scoring

Quiz rows use StudySet `type: "quiz"`, `questions`, owner ID, title, note-source snapshot, and timestamps. List responses expose `questionCount`; detail responses include the answer key.

Scoring is a React calculation:

```text
score = count of questions where selected option index equals correctOptionIndex
```

All questions must be answered before submission. After checking, option inputs are disabled until Try again. No model call is used to grade answers, and there is no score-submission API or persisted attempt history.

The correct answers are delivered to the browser with the saved quiz. This is personal revision software, not a secure examination system with hidden answer keys.

## Snapshot behavior and independence

Editing the source note does not update existing quizzes. Deleting the source does not delete the saved quiz. A new save still checks that its source note exists, is owned, and meets study-input limits.

Saved quizzes can be listed/opened/deleted without AI-generation configuration because the shared study service creates the AI client lazily. Flashcards and quizzes are isolated by both owner and type even though they share a collection.

## Troubleshooting

- No notes: create and save one first.
- Empty or overlong note: add useful content or shorten it to the study limit.
- Generation failure: check the selected provider/model, key access, internal token, and FastAPI availability.
- Successful health check but failed quiz: health does not test model permissions, quota, structured-output compatibility, or response validity.
- Malformed/unfinished model output: schema validation rejects it; do not save partial data.
- Failed configuration can become a safe generic 502 through the public API; it does not necessarily mean the API key is correct.

Generation has a 60-second Express timeout. There is no custom automatic generation retry in the app; SDK behavior may differ. A later successful retry alone does not establish the exact cause of an earlier failure.

## Important implementation files

- [Quiz.jsx](D:/Projects/Notes_ai/client/src/Quiz.jsx): preview, selection, score, explanations, retry.
- [study.routes.js](D:/Projects/Notes_ai/server/src/routes/study.routes.js), [studyController.js](D:/Projects/Notes_ai/server/src/controllers/studyController.js), [studyService.js](D:/Projects/Notes_ai/server/src/services/studyService.js): API and persistence.
- [aiServiceClient.js](D:/Projects/Notes_ai/server/src/services/aiServiceClient.js): index-field mapping and response validation.
- [StudySet.js](D:/Projects/Notes_ai/server/src/models/StudySet.js): quiz storage.
- [study_service.py](D:/Projects/Notes_ai/ai-service/app/services/study_service.py) and [schemas.py](D:/Projects/Notes_ai/ai-service/app/schemas.py): prompt and output schema.

## Verification and interview notes

Existing coverage: [quizzes.test.js](D:/Projects/Notes_ai/server/test/quizzes.test.js) checks ownership, CRUD, invalid material, type isolation, and saved access without AI configuration; [test_app.py](D:/Projects/Notes_ai/ai-service/tests/test_app.py) checks five-question responses and duplicate-option rejection.

Manual check to perform: save a generated quiz, refresh, attempt to score with an unanswered question, answer all, verify the score against the key, then use Try again. Local scoring/UI behavior needs a browser check; backend tests alone do not verify it.

**Interview takeaway:** “The model creates the learning material, but grading uses a deterministic index comparison. Saved quizzes are private snapshots, and scores are temporary client state.”
