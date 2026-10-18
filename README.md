# AI Notes Platform

A personal knowledge-management app, built one small phase at a time.

## Current progress

Phases 1–9 are complete. Phase 10 is in progress. Local V1 hardening now includes recoverable document processing, bounded extraction retries, deletion-race protection, Cloudinary/MongoDB/Qdrant cleanup, stale-source checks, PDF/DOCX/TXT/Markdown processing, semantic search across notes and documents, a private workspace and clearer loading/error states. Docker, Docker Compose, Nginx, HTTPS, and public deployment remain intentionally deferred.

## Scope simplification — 17 October 2026

The app keeps notes with folder/tag fields, private document uploads, processing, semantic search, RAG Q&A, summaries, AI tags, flashcards, quizzes, and Clerk access control. The old connection demo, marketing landing page, and duplicate session-check screens were removed. Health/auth endpoints remain available. Frontend requests, study-set storage/controllers, structured Gemini calls, and internal-service authentication now share focused helpers.

## Run it locally

You need **Node.js 22.12 or newer**, npm, and **Python 3.13**. The complete V1 also uses Clerk, MongoDB Atlas, Cloudinary, Gemini, and Qdrant Cloud. Put configuration in the application-specific `.env` files; never commit real keys.

Open PowerShell inside `D:\Projects\Notes_ai`, then install the JavaScript dependencies:

```powershell
npm.cmd ci
```

Create the Python environment and install the AI dependencies:

```powershell
cd ai-service
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
cd ..
```

Create these local files from their examples and fill in your own values:

- `client/.env` from `client/.env.example`
- `server/.env` from `server/.env.example`
- `ai-service/.env` from `ai-service/.env.example`

The value of `AI_SERVICE_TOKEN` must match in `server/.env` and `ai-service/.env`. Start React, Express, and FastAPI together:

```powershell
npm.cmd run dev:all
```

Open **http://127.0.0.1:5173**. Press **Ctrl+C** once in the shared terminal to stop all three services.

`npm run dev` still starts only React and Express, which is useful when you are not testing AI features. If PowerShell blocks `npm.ps1`, use `npm.cmd` without changing the computer's execution policy.

The root package uses **npm workspaces**: one install manages the dependencies in both `client/` and `server/`. Commit the root `package-lock.json` for repeatable installs; a fresh checkout can use `npm ci`.

`.npmrc` keeps npm's download cache in the ignored `.npm-cache/` folder inside this project. This lets installation work without writing to the system-wide user cache.

| Command | What it does |
|---|---|
| `npm run dev:all` | Start React, Express, and FastAPI together. |
| `npm run dev` | Start React/Vite and Express together. |
| `npm run dev:client` | Run only the frontend on port 5173. |
| `npm run dev:server` | Run only Express on port 5000, restarting when server files change. |
| `npm run dev:ai` | Run only FastAPI on port 8000 with automatic reload. |
| `npm test` | Run the backend's real HTTP checks with Node's built-in test runner. |
| `npm run test:ai` | Run the FastAPI and document-loader tests. |
| `npm run build` | Build the React app into `client/dist/`. |
| `npm run verify` | Run the Node tests, Python tests, and frontend production build. |
| `npm run preview` | View the built frontend on port 4173; run the backend separately for API requests. |

The preview command is for local testing. Docker and Nginx are deferred and are not part of the current local completion claim.

## Understand the request flow

```text
React feature -> shared API helper attaches Clerk token
  -> Express route -> controller -> service checks source ownership
  -> MongoDB reads/writes private data
  -> AI requests: FastAPI checks internal token -> Gemini -> validated result
  -> React displays the result for review
```

For RAG, Qdrant first finds similar chunks; Express rechecks their MongoDB owners and content before Gemini receives the context. Upload bytes stay in private Cloudinary storage.

## Files to read first

| File/directory | Responsibility |
| --- | --- |
| `client/src/Root.jsx` | Clerk, routes, protected workspace and feature panels. |
| `client/src/services/api.js` | Shared authenticated JSON/multipart requests and response errors. |
| `server/src/app.js` | Express application configuration. |
| `server/src/routes/` | Explicit HTTP method/path mappings. |
| `server/src/controllers/` | HTTP inputs, status codes and error handling. |
| `server/src/services/` | Ownership, validation and feature logic. |
| `server/src/models/` | MongoDB schemas. |
| `ai-service/app/main.py` | FastAPI endpoints and one internal-token dependency. |
| `ai-service/app/services/study_service.py` | Explicit tag/card/quiz prompts with one validated Gemini call. |

## Phase 4: AI summarization

The internal Python service now lives in `ai-service/`. It accepts a request only from Express, then calls Gemini to summarize an owned, saved note. Follow [docs/phase-4-setup.md](docs/phase-4-setup.md) to install Python, configure the two local `.env` files, and start FastAPI.

## Phase 5: private document uploads

The first verified upload path used PDFs. Phase 10 extends the same private Cloudinary flow to PDF, DOCX, TXT, and Markdown files up to 10 MB. Express verifies the signed-in user and validates the extension, MIME type, and file bytes before uploading. MongoDB stores owner-scoped metadata rather than the original bytes. Follow [docs/phase-5-setup.md](docs/phase-5-setup.md) for Cloudinary configuration.

## Phase 6 and Phase 10: readable document text

After upload, select **Extract text**. Express verifies ownership before FastAPI receives a short-lived private Cloudinary link. LangChain uses `PyPDFLoader` for PDF pages, `Docx2txtLoader` for DOCX, and `TextLoader` for TXT/Markdown. `RecursiveCharacterTextSplitter` creates bounded chunks while keeping page or section metadata. MongoDB saves extracted text and chunks. Processing run IDs prevent an older request from restoring deleted content, and interrupted processing is recovered from MongoDB when Express restarts.

## Phase 7 and Phase 10: embeddings and semantic search

Select **Index notes and documents** to split saved notes with the same LangChain rules as uploaded files, turn all ready chunks into 768-number Gemini embeddings, and store them in Qdrant Cloud. Search can cover both source types or filter to one. Every result is rechecked against the current owned MongoDB note/document and chunk before it reaches the browser, so deleted or older note content is not shown.

## Phase 8: grounded document Q&A

Use **Ask your documents** to question ready, indexed documents. RAG retrieves related chunks from Qdrant, then Express rechecks the owner, document, and MongoDB chunk before sending focused context to Gemini. Saved answers expose source links only while the owned source still exists. Weak or absent evidence produces an honest missing-information response without calling Gemini.

## Phase 9: study tools

Select **Suggest tags with AI** on a saved note or text-ready private document to receive 3–5 editable tag ideas. Express loads only the signed-in user's saved source, FastAPI requests structured JSON from Gemini, and both services validate the response. Nothing is stored automatically.

Use **Flashcards** to select a saved note, generate exactly five question-and-answer cards, review them, then explicitly save a private deck. Each deck stays scoped to the signed-in account and supports flip, next/previous, shuffle, and deletion. Follow [docs/phase-9-flashcards.md](docs/phase-9-flashcards.md) for the request flow, routes, and verification steps.

Use **Quizzes** to create five multiple-choice questions from a saved note. Review the answer key and explanations before saving a private quiz. When taking a saved quiz, React scores the selected answers locally and reveals the explanations after submission. Follow [docs/phase-9-quizzes.md](docs/phase-9-quizzes.md) for the request flow, routes, and verification steps.

## Phase 10: local V1 hardening

The API stores processing status, a unique run ID, attempt count, and start time with each document. A temporary extraction-service failure gets one bounded retry. If Express restarts during processing, startup recovery claims the saved job with a new run ID. Completion succeeds only for the currently active run.

Deletion first marks a document as deleting, which immediately removes it from lists, access links, AI features, and search rechecks. Cleanup then removes the Cloudinary file, MongoDB chunks, and owner-scoped Qdrant vectors. Incomplete cleanup remains recoverable on the next API start.

See [docs/phase-10-local-hardening.md](docs/phase-10-local-hardening.md) for the flow, files, limitations, and manual checks.

## API reference

### GET /api/health

- **Authentication:** None; this public endpoint returns no personal data.
- **Request body:** None.
- **Success:** HTTP `200`, JSON content, `Cache-Control: no-store`.

```json
{ "status": "ok" }
```

Unknown endpoints return HTTP `404` with:

```json
{ "message": "This endpoint does not exist." }
```

The shared frontend helper handles JSON errors, non-JSON failures, and empty HTTP 204 responses. Multipart uploads let the browser set its own content-type boundary.

## Verify locally

1. Start the app, sign in, and save a private note with folder/tag fields.
2. Upload a document, extract text, and inspect its chunks.
3. Index notes/documents, search by meaning, and ask a document question with sources.
4. Generate a note summary and tag suggestions. Review and save flashcards and a quiz.
5. Check deletion and confirm another account cannot access your sources or study sets.
6. Run `npm.cmd run verify` for automated regression tests and the production build.

These manual checks require working external-service configuration. Automated tests use injected/mocked providers and do not prove live provider availability.

## Configuration and troubleshooting

- The API binds to `127.0.0.1:5000`; Vite binds to `127.0.0.1:5173`. These are local development services.
- If a port is busy, stop the earlier instance you started. Vite deliberately reports a busy port instead of silently picking another one.
- The API reads an optional `PORT` environment variable. If you change it, update the proxy target in `client/vite.config.js` too.
- Clerk uses the client publishable key plus the server publishable/secret keys. MongoDB uses `MONGODB_URI`. Cloudinary uses its cloud name, API key, and API secret. Gemini and Qdrant values stay in `ai-service/.env`. The server and AI service share one `AI_SERVICE_TOKEN`. See the per-application `.env.example` files; never commit real values.
- When the backend is stopped, a Vite proxy connection error is expected. Restart Express and retry the operation.
- Keep future secrets out of React and Git. `.gitignore` excludes `.env` files, dependencies, and build output.

## Development and learning log

- [Development Log](https://app.notion.com/p/3e8c1e94c8d181ffa4f0cb43a71caa0f)
- [Architecture & Concepts](https://app.notion.com/p/3e8c1e94c8d181cda0b3cc006c35018b)

Update the existing phase entry with actual work and checks. Preserve unchanged earlier phases. Phase 10 local hardening is in progress; container and public deployment work is deferred.

## Official setup references

- [Vite getting started](https://vite.dev/guide/)
- [Tailwind's Vite integration](https://tailwindcss.com/docs/installation/using-vite)
- [Express installation](https://expressjs.com/en/starter/installing/)
