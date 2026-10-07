# AI Notes Platform

A personal knowledge-management app, built one small phase at a time.

## Current progress

Phases 1–5 are complete. Clerk sign-in, the backend session check, MongoDB Atlas, private notes, AI summarization, and private PDF uploads are verified. Phase 6 adds page-aware PDF text extraction and reusable chunks for the later semantic-search and RAG phases. The protected workspace lets each signed-in user create, search, edit, organize, and delete their own notes. The original connection check remains at /connection.

## Phase 1: connect React to Express

This first phase contains a React page and one Express endpoint. Click **Check connection** to send a real request to the backend. The page shows loading, success, or an actionable error, and displays the returned JSON after a successful check.

Phase 2 adds Clerk sign-in. Notes, documents, and AI features will be added in later V1 phases. Sharing and collaborative editing are optional V2 work, only after V1 is complete.

## Run it locally

You need **Node.js 22.12 or newer** and npm. Development was started with Node 22.23.1 and npm 10.9.8. No database, API keys, or external accounts are required for Phase 1.

Open a terminal **inside `D:\Projects\Notes_ai`**, then run:

```sh
npm install
npm run dev
```

Open **http://127.0.0.1:5173** in your browser and click **Check connection**.

`npm run dev` starts both applications. Keep that terminal running while using the app; press **Ctrl+C** to stop it. If PowerShell blocks `npm.ps1`, use `npm.cmd` in place of `npm` without changing your computer's execution policy.

The root package uses **npm workspaces**: one install manages the dependencies in both `client/` and `server/`. Commit the root `package-lock.json` for repeatable installs; a fresh checkout can use `npm ci`.

`.npmrc` keeps npm's download cache in the ignored `.npm-cache/` folder inside this project. This lets installation work without writing to the system-wide user cache.

| Command | What it does |
|---|---|
| `npm run dev` | Start React/Vite and Express together. |
| `npm run dev:client` | Run only the frontend on port 5173. |
| `npm run dev:server` | Run only Express on port 5000, restarting when server files change. |
| `npm test` | Run the backend's real HTTP checks with Node's built-in test runner. |
| `npm run build` | Build the React app into `client/dist/`. |
| `npm run preview` | View the built frontend on port 4173; run the backend separately for its connection check. |

The preview command is for local testing, not the final production deployment. Docker and Nginx arrive in Phase 10.

## Understand what happens when you click

```text
Browser: React button
    ↓ GET /api/health
Vite: forwards /api requests to 127.0.0.1:5000
    ↓
Express: returns { "status": "ok" }
    ↓
React: displays “Backend connected” and the response
```

- **Frontend:** Code running in the browser. React displays the page and responds to the button click.
- **Backend:** Code running in Node.js. Express receives the request and decides the response.
- **Endpoint:** An address and HTTP method your server handles. This endpoint is `GET /api/health`.
- **JSON:** A text format for structured data. Here the server sends an object with a `status` value.
- **React state:** Values that change what the page shows, such as `checking`, `connected`, or `error`.
- **Development proxy:** Vite forwards `/api` requests to Express. The browser uses one origin, so Phase 1 does not need a separate CORS setup.

A green result proves the HTTP connection works. It does not check a database, authentication, or AI service; those do not exist in this phase.

## Files to read first

```text
Notes_ai/
  package.json                # Run commands for the whole project
  package-lock.json           # Exact installed dependency tree
  .env.example                # Phase 1 needs no secrets
  client/
    index.html                # Browser entry page
    vite.config.js            # React/Tailwind plugins and /api forwarding
    src/
      main.jsx                # Mount React into the HTML page
      App.jsx                 # Page, button and connection state
      styles.css              # Tailwind and the visual theme
      services/api.js         # Fetch the API, validate its reply, handle errors
  server/
    src/
      app.js                  # Express routes
      server.js               # Listen for connections on port 5000
    test/
      health.test.js          # Tests that make actual HTTP requests
```

## Phase 4: AI summarization

The internal Python service now lives in `ai-service/`. It accepts a request only from Express, then calls Gemini to summarize an owned, saved note. Follow [docs/phase-4-setup.md](docs/phase-4-setup.md) to install Python, configure the two local `.env` files, and start FastAPI.

## Phase 5: private PDF uploads

The document upload screen accepts PDFs up to 10 MB. Express verifies the signed-in user and validates the file before sending it to Cloudinary private storage. MongoDB stores the owner and file metadata; it does not store the original file. Follow [docs/phase-5-setup.md](docs/phase-5-setup.md) to add the three Cloudinary values to `server/.env` and perform the live check.

## Phase 6: readable PDF text

After upload, select **Extract text** in the workspace. Express checks that the signed-in user owns the document, then FastAPI downloads a short-lived private Cloudinary link. LangChain's `PyPDFLoader` creates page-level documents, and `RecursiveCharacterTextSplitter` creates small page-aware chunks. MongoDB stores the extracted pages and chunks. The browser lets you inspect the exact text before embeddings and semantic search are added. Follow [docs/phase-6-setup.md](docs/phase-6-setup.md) to refresh the Python environment, run all three services, and verify the flow.

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

The frontend treats non-success responses, invalid JSON, an unexpected status, and a five-second timeout as failures. The button becomes available again so you can retry.

## Verify this phase yourself

1. Start the app and open the page. It should say **Ready to check**.
2. Click **Check connection**. It should say **Backend connected** and display the actual JSON.
3. To test failure, run the frontend and backend in two separate terminals using `dev:client` and `dev:server`.
4. Stop only the backend terminal and click the button. It should explain the failure and offer **Try again**.
5. Restart the backend and retry. The success state should return.
6. Run `npm test` and `npm run build`.

## Configuration and troubleshooting

- The API binds to `127.0.0.1:5000`; Vite binds to `127.0.0.1:5173`. These are local development services.
- If a port is busy, stop the earlier instance you started. Vite deliberately reports a busy port instead of silently picking another one.
- The API reads an optional `PORT` environment variable. If you change it, update the proxy target in `client/vite.config.js` too.
- Phase 2 loads client/.env through Vite and server/.env through Node. Phase 3 also requires MONGODB_URI in server/.env. Phase 5 requires CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in server/.env. Phases 4 and 6 need the existing matching AI_SERVICE_TOKEN in server/.env and ai-service/.env. See the per-application .env.example files; never commit real values.
- When the backend is stopped, a Vite proxy connection error is expected. Restart Express and try the button again.
- Keep future secrets out of React and Git. `.gitignore` excludes `.env` files, dependencies, and build output.

## Development and learning log

- [Development Log](https://app.notion.com/p/3e8c1e94c8d181ffa4f0cb43a71caa0f)
- [Architecture & Concepts](https://app.notion.com/p/3e8c1e94c8d181cda0b3cc006c35018b)

Update the existing phase entry with actual work and checks. Preserve unchanged earlier phases. Phase 6 text extraction is the current phase.

## Official setup references

- [Vite getting started](https://vite.dev/guide/)
- [Tailwind's Vite integration](https://tailwindcss.com/docs/installation/using-vite)
- [Express installation](https://expressjs.com/en/starter/installing/)

