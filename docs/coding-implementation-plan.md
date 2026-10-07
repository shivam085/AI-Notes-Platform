# Your First AI Project: V1 Implementation Plan

**Project:** AI Driven Notes Management Platform  
**Version:** V1 — a complete personal AI notes application  
**Approach:** Build one small, working feature at a time.

Your first milestone is a notes app where you can sign in, write a note, save it, and reopen it. Then add a **“Summarize this note”** button. Once that works, move on to documents, search, and questions about your notes.

You will use an existing Gemini model through its API. You do not need to train a model or study advanced machine learning before starting.

V1 includes six AI features: summarization, semantic search, document Q&A, auto-tagging, flashcards, and quizzes. Finish, test, deploy, and use V1 before deciding whether to build V2. There is no fixed deadline: move forward when the current step works and you can explain what it does.

**V1 is complete on its own.** It can have multiple registered users, but each user works with their own private notes and documents. Note sharing, viewer/editor roles, and simultaneous editing belong to an optional V2. V2 is a future decision, not a commitment or a requirement for finishing V1.

**For now, read steps 1–4. The rest is your roadmap for later.**

## 1. Understand the parts as you use them

| Tool | Its job in your project | Introduce it in |
|---|---|---|
| React + Vite | Build and run the pages users see. | Step 1 |
| Tailwind CSS | Style those pages. Keep the first design simple. | Step 1 |
| Node + Express | Receive requests, check permissions, and save application data. | Step 1 |
| Clerk | Handle sign-in and identify the current user. | Step 2 |
| MongoDB Atlas + Mongoose | Store notes and other records; describe their structure in JavaScript. | Step 3 |
| React Router + Axios | Move between pages and send requests to your backend. | Steps 2–3 |
| Python + FastAPI | Run your document-processing and AI code. | Step 4 |
| Gemini API | Generate summaries, answers, study material, and embeddings. | Step 4 onward |
| Cloudinary | Store the original uploaded files. | Step 5 |
| Qdrant | Find text with a meaning similar to a question. | Step 7 |
| Docker + Nginx | Package the finished app and route incoming requests. | Step 10 |

Useful starting knowledge: JavaScript functions, objects, arrays, `async/await`, React state, basic HTTP requests, JSON, and basic Python functions. Learn any unfamiliar item when its step needs it; you do not need to learn the entire stack first.

## 2. Start with a small folder structure

```text
ai-notes-platform/
  client/         # React pages and components
  server/         # Express API and database models
  ai-service/     # Add Python AI code in step 4
  README.md       # Your setup notes and progress
  .gitignore      # Keeps secrets and generated files out of Git
```

Inside each application, add folders only when you need them. For example, create `server/src/models/` when you add the Note model. Docker and Nginx files arrive near the end.

Before AI, a request follows this path:

**React page → Express API → MongoDB → response shown on the page.**

For an AI action, it follows this path:

**React page → Express permission check → FastAPI → Gemini → result shown on the page.**

Express handles user accounts, permissions, and application data. FastAPI handles the AI and document-processing work.

## 3. Build in this order

### Step 1 — Connect one page to your backend

**Goal:** Understand how your frontend and backend communicate.

Build:

- [x] A React page with the project name and a “Check connection” button.
- [x] An Express endpoint, `GET /api/health`, that returns a small JSON response such as `{ "status": "ok" }`.
- [x] A button action that calls this endpoint and shows “Backend connected” or a useful error.

**Done when:** Clicking the button shows a response from Express. You can identify which code runs in the browser and which code runs on the server.

### Step 2 — Add sign-in

**Goal:** Let the server identify who is making a request.

Build:

- [x] Clerk sign-in, sign-up, and sign-out in React.
- [x] A page that requires sign-in.
- [x] Clerk verification in Express and `GET /api/auth/me`, which returns the verified user's ID.

Two terms to learn here: **authentication** means checking who someone is; **authorization** means checking what they are allowed to access.

**Done when:** Signed-in requests work and signed-out requests are rejected by Express. Hiding a page in React alone does not protect its API.

### Step 3 — Build a useful notes app

**Goal:** Save your first real data.

Build in small pieces:

- [ ] Connect Express to MongoDB Atlas and create a Note model.
- [ ] Add a title field, a plain text area, and a Save button in React.
- [ ] Create, list, open, edit, and delete notes.
- [ ] Add simple folders and tags after those actions work.
- [ ] Add keyword search, such as finding notes containing “deadlock.”

Start a note with these fields: `ownerId`, `title`, `content`, `folderId`, `tags`, and timestamps. Express sets `ownerId` using the verified Clerk identity. Use one version field to detect when an older browser tab tries to overwrite a newer save.

Your first note routes are:

| Route | Purpose |
|---|---|
| `POST /api/notes` | Create a note. |
| `GET /api/notes` | List the signed-in user's own notes. |
| `GET /api/notes/:id` | Open one note. |
| `PUT /api/notes/:id` | Update an owned note. |
| `DELETE /api/notes/:id` | Delete an owned note. |

**Done when:** A saved note survives a page refresh. A second account cannot read or change it. You can organize and search your notes.

**Milestone: You now have a working notes application.**

### Step 4 — Add your first AI feature: summarization

**Goal:** Understand one complete AI request before building RAG.

A **model** is the existing AI you call. A **prompt** is the instruction and text you send to it. An **API key** lets your server use the provider's service.

Build:

- [ ] A small FastAPI application with a health endpoint.
- [ ] One Gemini call that summarizes a short sample paragraph.
- [ ] `POST /api/ai/summarize` in Express. It loads the signed-in user's own note and sends its text to FastAPI.
- [ ] A “Summarize this note” button with loading, success, and error states.

Display the summary in a separate box. Keep the original note intact. Start with short notes and an explicit input-length limit; add whole-document summaries later.

Keep the Gemini key in the Python service's environment settings. Keep FastAPI local/internal and require a server-only credential for calls from Node. Verify the currently supported Gemini model name when implementing this step, and store it in configuration rather than repeating it throughout the code.

**Done when:** You can summarize a saved note and explain each hop between React, Express, FastAPI, and Gemini. A failed AI call leaves the original note untouched.

**Milestone: This is your first working AI feature.**

### Step 5 — Upload and open documents

**Goal:** Store original files separately from your database records.

Start with a small PDF containing selectable text. Add DOCX, TXT, and Markdown one format at a time after the PDF path works.

- [ ] Send an uploaded file from React to Express.
- [ ] Check its size, extension, and actual file format.
- [ ] Store the original privately in Cloudinary.
- [ ] Save its owner, name, format, size, Cloudinary identifiers, and processing status in MongoDB.
- [ ] Build a document list, authorized open/download action, folders/tags, and deletion.

MongoDB stores information about the file; Cloudinary stores the file itself. File downloads must also check ownership. Keep Cloudinary secrets on the server.

**Done when:** You can upload, list, open, and delete a document. Another account cannot download it by guessing its ID or using a public storage link.

### Step 6 — Turn documents into readable text

**Goal:** Inspect exactly what the AI will receive.

**Text extraction** means reading the words inside a file. A **chunk** is a smaller section of that text, such as a few paragraphs.

- [x] Use Python to extract PDF text while preserving page numbers.
- [x] Show the extracted text in a simple document view so you can check it.
- [ ] Add DOCX paragraphs and tables, followed by TXT and Markdown reading.
- [x] Split text into chunks and save each chunk with its owner, source ID, position, and PDF page number when available.
- [ ] Apply the same chunking function to note text.

**Implementation note — 7 October 2026:** The PDF path uses LangChain's `PyPDFLoader` to create one `Document` per page and `RecursiveCharacterTextSplitter` to create chunks. This makes the document-loading and splitting steps visible in the same order as the selected learning playlist.

For your first experiment, try around 2,000 characters per chunk with 200 characters repeated between neighboring chunks. This repeated section is called **overlap**; it helps preserve ideas near a boundary. Keep these values configurable and check the chosen model's input limit later.

Process one small file at a time during local development. Show processing/failure states and a retry button. Reliable background processing is added before deployment in step 10.

**Done when:** You can inspect sensible chunks and trace a PDF chunk back to its page. Empty, damaged, or scanned-only PDFs get a clear error; automatic reading of scanned images is outside the first release.

### Step 7 — Add embeddings and semantic search

**Goal:** Find relevant text even when the wording is different.

An **embedding** is a list of numbers that represents aspects of a text's meaning. Similar text can have similar embeddings. **Semantic search** compares these numbers to find related content.

For example, searching “How can we avoid processes getting stuck?” might find a note about deadlock prevention even without matching those exact words.

- [ ] Generate and store an embedding for each chunk through Gemini.
- [ ] Create a Qdrant collection. Think of this as the vector database setup needed to search those number lists.
- [ ] Turn the search query into an embedding using the same model and vector length.
- [ ] Retrieve relevant chunks, filtering by the authenticated owner's data inside the Qdrant search filter.
- [ ] Show the title, matching text, and source link. Add notes/documents, folder, and tag filters.

Save the embedding model name and vector length with the indexing configuration. A new embedding model can require regenerating stored vectors. When a note changes, update its chunks/embeddings; do not keep showing its old content as current.

**Done when:** A meaning-based query finds an appropriate note or document. Every result belongs to the signed-in user; another user's private content is never returned.

### Step 8 — Answer questions using your documents

**Goal:** Turn retrieval into grounded Q&A.

**RAG** means *retrieval-augmented generation*. In this project, it means finding relevant text first and giving that text to Gemini with the user's question.

```text
Question
   ↓
Find relevant, allowed chunks
   ↓
Send those chunks + the question to Gemini
   ↓
Show an answer + source references
```

- [ ] Reuse the search code from step 7.
- [ ] Start with a few useful chunks and a fixed maximum amount of context.
- [ ] Instruct Gemini to answer from that context and say when information is missing.
- [ ] Resolve source references from the actual retrieved chunks. Do not trust invented file names or page numbers.
- [ ] Add chat history, source links, loading/error states, and conversation deletion.

Check permissions again before sending source text to Gemini. Treat instructions found inside an uploaded document as document content, not instructions controlling your application.

**Done when:** A question answered by your document gets a supported answer with the correct source. An unrelated question gets an honest “I couldn't find enough information” response. Check answer correctness yourself; a citation alone is not proof.

**Milestone: You now have the main AI knowledge-management flow.**

### Step 9 — Add the study tools one at a time

**Goal:** Reuse your working AI connection for structured results.

Build in this order:

| Feature | First working version | Then extend it |
|---|---|---|
| Auto-tagging | Suggest a few tags for one note. | Let the user accept/edit them and support documents. |
| Flashcards | Generate five question-and-answer pairs. | Save sets; add flip, next/previous, shuffle, delete, regenerate, and 10/20-card choices. |
| Quizzes | Generate five multiple-choice questions with answers and explanations. | Save quizzes; add true/false and short-answer questions. |
| Broader summaries | Summarize selected text and a short document. | For long documents, summarize sections and combine the results within a clear size limit. |

Ask Gemini for a defined JSON structure, then check that the returned fields and values are valid. For example, a quiz's correct answer must be one of its options.

React can calculate multiple-choice and true/false scores. For short answers, show a reference answer and let the learner mark their own response; AI grading is not needed.

**Done when:** These features work for notes/documents and the required text selections, saved study sets survive refresh, and bad AI output produces a useful error.

### Step 10 — Finish, test, and deploy V1

**Goal:** Finish a complete, usable V1 that you can demonstrate and deploy.

Complete these in separate small tasks:

- [ ] **Recover processing work:** Store pending work in MongoDB so a restart does not lose it. Add bounded retries, status polling, and checks that an older job cannot replace newer content. Use the existing FastAPI service; no new queue infrastructure is needed.
- [ ] **Handle deletion:** Hide deleted sources immediately, stop old work from restoring them, and clean up files/chunks. Check ownership and source availability before showing saved source-backed AI output.
- [ ] **Finish the interface:** Landing, dashboard, notes/editor, documents/viewer, search, chat, flashcards, quizzes, and settings. Include useful empty/loading/error states.
- [ ] **Automate important checks:** Notes CRUD, ownership, private downloads, extraction/chunking, retrieval, missing-context answers, and study tools. Test with two accounts to prove their data stays separate. Add these tests as features grow; run them together here.
- [ ] **Add Docker Compose:** Start the applications using the documented environment settings.
- [ ] **Add Nginx:** Serve React and forward API traffic to Node. Keep FastAPI internal, with server-to-server authentication. Configure HTTPS for public deployment.
- [ ] **Write the README:** Setup, environment variables, external-service configuration, vector-index setup, API examples, architecture, tests, limitations, and screenshots.

Start deployment with one Node instance and one FastAPI instance. Document that in-memory request limits need more work before running multiple copies.

**Done when:** A fresh checkout starts using your instructions, the deployed app works, and you can demonstrate the complete V1 journey: sign in → create a note → upload a document → search → ask a question with sources → generate study material.

**V1 completion checklist**

- [ ] Sign-in and private accounts work.
- [ ] Notes, folders, tags, editing, deletion, and keyword search work.
- [ ] PDF, DOCX, TXT, and Markdown upload, storage, viewing, processing, retry, and deletion work.
- [ ] Semantic search works across the user's notes and documents.
- [ ] Q&A returns valid sources and admits when information is missing.
- [ ] Summaries, suggested tags, saved flashcards, and saved quizzes work.
- [ ] Saved notes, chat history, and study material survive refresh/restart.
- [ ] Account isolation, processing recovery, and important failure cases are tested.
- [ ] Docker, Nginx, deployment, setup instructions, and the README are complete.

When these checks pass, V1 is finished. Use it and gather feedback. Decide separately whether collaboration is worth adding in V2.

## 4. Add database records gradually

You do not need every model on day one.

| When | Add these records |
|---|---|
| Notes | `Note`, `Folder`: ownership, content, organization, timestamps. |
| Uploads | `Document`: file information, storage identifiers, processing status. |
| Extraction/search | `KnowledgeChunk`: source type/ID, owner, text, location, source version, embedding. Use it for both notes and documents. |
| Chat | `Conversation` and `Message`: history plus the actual sources supplied to AI. |
| Study tools | `StudySet`: saved cards/quizzes and their source references. |
| Processing recovery | `ProcessingJob`: pending work, attempts, and which worker currently owns the job. |

Agree on field names and ID formats before JavaScript and Python read/write the same collection. Add more advanced processing fields when implementing recovery rather than trying to understand them all before your first note works.

## 5. Small rules to follow from the beginning

- Keep API secrets and database credentials out of React and Git. Use `.env` locally and commit only placeholder `.env.example` files.
- Derive the current user from Clerk on the server. Never trust a user ID supplied by the browser as proof of ownership.
- Check permission for reading, editing, searching, downloading, and AI processing—not just page navigation.
- Limit input/file sizes and AI requests. Display useful failures instead of leaving a button spinning indefinitely.
- Save a working Git commit after each small feature, and keep short setup notes in the README.
- Stay with the requested tools and six AI features. Extra infrastructure and AI features can wait until the finished project needs them.

## 6. How to work through each step

1. Read only the next step and learn its unfamiliar terms.
2. Build the smallest working example, such as one short note or one two-page PDF.
3. Run its “Done when” check.
4. Try one failure case: no sign-in, invalid input, missing file, or unavailable AI service.
5. Explain the request flow in your own words, save a commit, and continue.

If something breaks, narrow it down: check the browser request/response, then Express logs, then FastAPI logs if the request reached Python. Fix one failing connection before adding another feature.

When using a coding assistant, request one step at a time and ask for an explanation of the changed files and how to verify them. Keep working code and extend it as you learn.

**Start today with step 1 only:** a React button that calls Express and displays “Backend connected.”

## 7. Official references to open when needed

Use these as references for the relevant step, not a reading list to finish before coding. Check the current SDK and model instructions at implementation time.

- Step 2: [Clerk's Express authentication guide](https://clerk.com/docs/reference/express/get-auth).
- Steps 4 and 9: [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output), for responses that follow a JSON structure.
- Step 5: [Cloudinary private-file access](https://cloudinary.com/documentation/control_access_to_media).
- Step 7: [Gemini embeddings](https://ai.google.dev/gemini-api/docs/embeddings) and [Qdrant collection setup](https://qdrant.tech/documentation/concepts/collections/).

## 8. Optional V2 — decide after V1 is finished

After using V1, you can decide whether people need to work on the same notes together. If the answer is yes, create a separate V2 implementation plan for:

- Sharing notes with other users.
- Viewer and editor permissions.
- Simultaneous editing using Yjs and WebSockets.
- Showing who is currently editing a note.
- Applying shared-note permissions to search and AI features.

These are possible future features. Keep sharing screens, collaboration packages, WebSocket routes, and collaborator database fields out of the V1 build. The current plan ends with a complete V1; starting V2 requires a later decision.

## 9. Keep a development and learning record in Notion

Your project documentation lives under [AI Notes Platform](https://app.notion.com/p/3e8c1e94c8d181dbaa6dd282d3e0a40f):

- [Development Log](https://app.notion.com/p/3e8c1e94c8d181ffa4f0cb43a71caa0f): one chronological section for each of the ten V1 phases, with implementation details, errors/fixes, verification, and Lessons Learned at the end.
- [Architecture & Concepts](https://app.notion.com/p/3e8c1e94c8d181cda0b3cc006c35018b): simple definitions, project examples, planned/actual implementation locations, common mistakes, and interview notes.

At the start of a phase, mark it In Progress. After its work and checks finish, update the existing phase entry with what actually happened and mark it Completed only if the completion check passes. Add new concepts and lessons as you encounter them. Keep previous phases intact unless a dated correction is needed.

Phases 1 and 2 were completed on 27 and 28 September 2026. Live Clerk sign-in and Express session verification passed. Phases 3–10 are Not Started. The active project folder is `C:\Users\ASUS\OneDrive\Desktop\Notes_ai`. These updates happen as part of project development, not through an unattended monitoring service. Project instructions preserve this workflow for future work in this workspace.

