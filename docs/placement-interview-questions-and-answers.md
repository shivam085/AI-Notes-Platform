# AI Notes Platform — Placement Interview Questions and Answers

Prepared on **25 October 2026**, from the current working-tree source code and project documentation.

This guide contains **110 project-specific questions and answers**, followed by a demo script, revision checklist, and code-reading map. Answers use simple language suitable for a fresher placement interview. Start with the short explanation, then use the example or follow-up when the interviewer asks for detail.

First-person answers are practice scripts. Adapt statements about your contribution and learning to your actual experience. Code was inspected for this document; application tests and live cloud calls were not rerun while preparing it. Existing uncommitted changes are included in this snapshot, so this is not a description of a particular released commit.

## Contents

1. [Project introduction and scope — Q1–10](#1-project-introduction-and-scope)
2. [Architecture and request flow — Q11–20](#2-architecture-and-request-flow)
3. [React and frontend — Q21–30](#3-react-and-frontend)
4. [Backend, APIs, and security — Q31–45](#4-backend-apis-and-security)
5. [MongoDB and data consistency — Q46–55](#5-mongodb-and-data-consistency)
6. [Documents and processing — Q56–65](#6-documents-and-processing)
7. [Embeddings, search, and RAG — Q66–85](#7-embeddings-search-and-rag)
8. [Summaries and study tools — Q86–92](#8-summaries-and-study-tools)
9. [Testing, debugging, and scaling — Q93–103](#9-testing-debugging-and-scaling)
10. [Project discussion and behavioral questions — Q104–110](#10-project-discussion-and-behavioral-questions)
11. [Five-minute demo](#five-minute-demo)
12. [Last-day revision checklist](#last-day-revision-checklist)
13. [Code-reading map](#code-reading-map)

## Read this before preparing answers

The strongest interview answer describes **what happens, why it happens, and one tradeoff**. For example: “I check ownership in Express before sending saved content to the AI service. This prevents one account from generating answers from another account's notes. Authentication alone would only identify the requester.”

| Topic | Accurate statement for this code snapshot |
|---|---|
| Project status | Documentation marks phases 1–9 complete and Phase 10 in progress. Local hardening is implemented; public deployment is deferred. |
| AI features | Summaries, semantic search, document Q&A, suggested tags, flashcards, and quizzes. |
| AI models | Uses Gemini embeddings and selectable Gemini or Anthropic Claude generation. No custom model training or fine-tuning. |
| Search scope | Semantic search covers saved notes and ready documents. |
| Q&A scope | RAG Q&A currently retrieves documents only. |
| Study generation | Flashcards and quizzes currently use saved notes. A schema allowing document sources does not implement document-based generation. |
| Organization | Notes have folder/tag fields. There is no separate `Folder` model in the current model directory. |
| Editing | Explicit saves and optimistic version checks; no live collaborative editor. |
| Client networking | Shared native `fetch` helper; Axios is mentioned in older planning, but is not the current client implementation. |
| Persistence | MongoDB stores records and chunks; Cloudinary stores file bytes; Qdrant stores vectors and searchable payloads. |
| Deployment | Docker, Compose, Nginx, HTTPS configuration, and public hosting are deferred. |
| Quality claims | Tests cover important behavior. There is no measured retrieval accuracy, production latency target, or verified user-scale claim in this guide. |

## 1. Project introduction and scope

### Q1. Tell me about your project. ★

**Answer:** “My project is a private AI notes platform. A user can sign in, write and organize notes, upload documents, search by meaning, and ask questions about uploaded documents. It also generates summaries, tag suggestions, flashcards, and quizzes. I use React for the interface, Express for APIs and ownership checks, MongoDB for application data, and a Python FastAPI service for document processing and AI integration. Qdrant supports semantic retrieval, Gemini creates embeddings, and a configuration setting selects Gemini or Anthropic Claude for generation.”

**Follow-up:** “The main engineering challenge is keeping AI results connected to the current user's valid source content, including after edits and deletions.” Keep this introduction to roughly 45–60 seconds.

### Q2. What problem does this project solve?

**Answer:** Notes and study documents are easy to collect but harder to search and revise. A user may remember a concept without remembering the exact words in the source. The platform combines private storage, keyword search, semantic search, and study-material generation in one workspace.

**Example:** A student uploads operating-system notes and searches “how processes avoid waiting forever.” Semantic retrieval may find a passage about starvation even without an exact word match. Relevant retrieval is an intended behavior to demonstrate, not a guarantee for every query.

### Q3. What are the six AI features? ★

**Answer:** Summarization condenses a saved note. Semantic search retrieves related chunks from notes and documents. RAG Q&A generates an answer from retrieved document context. Auto-tagging proposes editable tags for notes or extracted documents. Flashcards produce five question-and-answer cards from a saved note. Quizzes produce five multiple-choice questions from a saved note.

**Important distinction:** Semantic search returns passages; Q&A adds answer generation. Generated tags and study material are reviewed before the user explicitly saves changes.

### Q4. What makes this more than a CRUD project?

**Answer:** CRUD—create, read, update, and delete—is the base. This project adds document parsing, chunking, embedding generation, vector retrieval, grounded prompting, and structured AI responses. It also handles consistency problems caused by maintaining application records and a separate vector index.

**Example:** A note can be edited after it has been embedded. The search service checks the chunk's source version against the current note version before displaying it. That is a data-consistency concern beyond a basic notes form.

### Q5. Did you train your own AI model? ★

**Answer:** “No. The application calls pretrained models through provider APIs. Gemini creates embeddings, while Gemini or Anthropic Claude can generate text. My work is the application pipeline: selecting authorized content, extracting and chunking it, creating embeddings, retrieving useful context, validating responses, and presenting results.”

**Follow-up:** Creating embeddings is inference, not training. RAG supplies information at request time; it does not update the model's weights. Do not describe API integration as building a foundation model.

### Q6. Is this a single-user or multi-user application?

**Answer:** Multiple users can register, but each account has a private workspace. The server derives an owner ID from the verified Clerk session and uses it in data queries. One account cannot access another account's notes simply by knowing their IDs.

**Follow-up:** Multiple accounts do not imply collaboration. Note sharing, editor/viewer roles, WebSockets, and simultaneous editing are optional V2 ideas and are not implemented in V1.

### Q7. What is complete, and what is still pending? ★

**Answer:** The current documentation records phases 1–9 as completed. The local app includes all six AI features and Phase 10 work on processing recovery, deletion cleanup, and error states. Phase 10 remains in progress because deployment-related work is deferred.

**Say clearly:** “I can explain and demonstrate the local implementation. I am not claiming a public production deployment.” Scanned-document OCR, distributed workers, and collaborative editing are also outside the current implementation.

### Q8. Why did you build the project in phases?

**Answer:** Each phase introduces a small number of new concepts and builds on a working previous step. Authentication and private notes come before AI; extraction comes before embeddings; retrieval comes before document Q&A. This makes it easier to isolate failures.

**Example:** If document Q&A fails, I can check whether the file was uploaded, text was extracted, chunks were indexed, and retrieval returned context before investigating the generation prompt.

### Q9. Why did you choose this technology stack?

**Answer:** React handles interactive forms and feature panels. Express is the application API and permission boundary. MongoDB stores notes and related records. Python gives direct access to LangChain document loaders and text splitting. Gemini supplies embeddings, while a common adapter selects Gemini or Anthropic Claude for generated content. Qdrant handles similarity retrieval with metadata filtering. Cloudinary stores private file bytes, and Clerk handles authentication.

**Tradeoff:** Several external services make setup and troubleshooting more involved. The stack is a deliberate learning and implementation choice, not proof that every component is necessary for every notes app.

### Q10. What are the most important limitations?

**Answer:** Public deployment is pending. Scanned PDFs need OCR, which is absent. Reindexing is user-triggered. RAG currently uses document context and does not send past chat messages to the model. Recovery assumes one Express instance. Indexing currently sends one request with a schema limit of 100 chunks, so larger collections need batching.

**Further detail:** Answer citations identify retrieved sources but do not prove every sentence is correct. Notes and documents also have different cleanup behavior; deleting a note does not currently perform the document-style vector cleanup sequence.

## 2. Architecture and request flow

### Q11. Explain the overall architecture. ★

**Answer:** The browser renders React and obtains a Clerk session token. React sends authenticated requests to Express. Express checks identity, validates inputs, checks ownership, and reads or writes MongoDB. For AI work, it calls FastAPI with an internal service token. FastAPI loads documents, splits text, creates Gemini embeddings, calls the selected generation provider, and communicates with Qdrant as needed. Express returns the result to the browser.

```text
React + Clerk session
        |
        | Authorization: Bearer <session token>
        v
Express: routes -> controllers -> services
        |                |                  |
        v                v                  v
     MongoDB       Private Cloudinary     FastAPI
                                          |
                               +----------+----------+
                               v                     v
                selected generation provider     Qdrant
```

The browser does not receive provider keys, Qdrant credentials, or the internal service token.

### Q12. Why use both Express and FastAPI?

**Answer:** Express owns application concerns such as users, notes, HTTP responses, permissions, and persistence. FastAPI keeps Python AI operations together: loading documents, splitting text, embedding, retrieval, and generation. This follows the project's learning sequence and keeps each module understandable.

**Tradeoff:** A second service adds another network hop, deployment unit, failure boundary, and set of contracts. A smaller application could put everything in one backend. The interview explanation should acknowledge that alternative.

### Q13. Is this a microservices architecture?

**Answer:** I would describe it as a React frontend, an application backend, and a separate Python AI service. It has a service boundary, but I would not claim a mature distributed microservices platform. There is no implemented service mesh, event bus, orchestration platform, or distributed job system.

**Follow-up:** Independent services can be scaled separately in a future deployment, but safe scaling also requires shared coordination, capacity planning, and consistent authorization.

### Q14. What is the role of routes, controllers, services, and models? ★

**Answer:** Routes connect HTTP methods and paths to handlers. Controllers read HTTP inputs, obtain the verified user, and choose response codes. Services implement rules such as ownership, validation, indexing, and deletion. Models describe persistent records and indexes.

**Example:** A note update moves through `notes.routes.js`, `notesController.js`, `noteService.js`, and the `Note` model. Keeping database rules out of React means they still apply if a caller sends a request without using the interface.

### Q15. Walk through saving a note from the button to the database. ★

**Answer:** React keeps form values in a draft. On save, it sends a POST for a new note or a PUT with the current version for an existing one. The shared API helper attaches the Clerk token. Express verifies identity, the service validates the note, and MongoDB creates or conditionally updates the owned record. The response contains the saved note and updated version; React replaces its local copy.

**Follow-up:** The submitted body does not get to choose the owner. Express supplies ownership from authentication.

### Q16. Walk through a document Q&A request. ★

**Answer:** React submits a question to `/api/ai/chat`. Express obtains the owner, checks any requested conversation, and asks semantic search for document matches. Gemini embeds the query, which is searched in Qdrant with the owner filter. Express rechecks the sources and chunks in MongoDB, drops weak matches, and sends a small authorized context to FastAPI. The selected generation provider answers from that context. Express saves the messages and source metadata.

**Failure case:** With no usable context, the application saves an insufficient-information answer without calling the answer-generation model. Query embedding may still have been needed for retrieval.

### Q17. Why not call an AI provider directly from React?

**Answer:** A normal browser bundle cannot keep an API secret private. Direct calls would also let a caller bypass application ownership checks, input validation, and server-side cost controls. Express loads the actual saved source after checking its owner, and FastAPI uses the provider key on the server.

**Example:** A summarization request supplies a note ID. The backend decides whether the user may read that note before any content reaches the selected provider.

### Q18. How do JavaScript and Python agree on request data?

**Answer:** They exchange JSON through explicit endpoints. The Express AI client maps JavaScript names to the Python schema, such as `ownerId` to `owner_id`, and maps responses back. Pydantic describes and validates the Python-side inputs and outputs. JavaScript validates the response fields its features need.

**Example:** Python returns `correct_option_index`; the Express client converts it to `correctOptionIndex` for saved quiz data and React. Transport tests cover these mappings.

### Q19. What is dependency injection, and where do you use it?

**Answer:** Dependency injection means supplying a component's dependencies instead of constructing every dependency inside it. The Express `createApp` factory accepts models, storage, and AI clients. Python `create_app` accepts services such as a summarizer, embedder, and vector store.

**Benefit:** A test can provide a fake generation provider that returns a known response or throws a controlled error. This makes tests faster and repeatable without calling a paid external service.

### Q19A. How can the project switch between Gemini and Claude?

**Answer:** FastAPI depends on a small `GenerationProvider` contract with text and structured-output methods. A factory reads `GENERATION_PROVIDER` and creates either the Gemini or Anthropic adapter. Feature services own the prompts and depend only on that contract. `GENERATION_MODEL` selects the provider-specific model ID, and the corresponding API key stays in `ai-service/.env`.

**Important distinction:** This switch changes generation for summaries, RAG answers, tags, flashcards, and quizzes. Semantic search still uses Gemini embeddings. Changing only the generation provider needs a FastAPI restart but no Qdrant reindex; changing the embedding model requires reindexing compatible vectors.

### Q20. What is the source of truth in this architecture?

**Answer:** MongoDB is the application authority for ownership, current notes, document state, and chunk records. Cloudinary is the location of original file bytes. Qdrant is a derived search index. A vector match is only a candidate; Express checks the current MongoDB source before returning its content.

**Tradeoff:** This adds database reads to search, but protects against deleted sources and outdated note chunks. “Source of truth” here concerns application validity; it does not mean every stored claim is factually true.

## 3. React and frontend

### Q21. How is the React interface organized?

**Answer:** `Root.jsx` configures Clerk, authentication routes, and the protected workspace. Feature components handle notes, documents, semantic search, document chat, flashcards, and quizzes. They share an authenticated request helper.

**Current detail:** The workspace renders feature sections on one page with anchor navigation. It does not currently have a separate route for each feature. This keeps navigation simple, although mounting all panels can cause several initial requests as the app grows.

### Q22. What are controlled components?

**Answer:** A controlled input takes its value from React state and updates that state through an event handler. In the notes editor, the draft stores title, content, folder, and tags. React uses this state when saving and when checking for unsaved changes.

**Example:** Typing changes the draft, not the database immediately. The saved note and draft remain separate until the user saves successfully.

### Q23. How do you use `useState`, `useEffect`, and `useMemo`?

**Answer:** `useState` holds changing UI values such as drafts, selected records, loading flags, and error messages. `useEffect` runs operations such as loading initial lists or managing document polling. `useMemo` caches derived values based on dependencies, such as finding the selected note from the current list and ID.

**Follow-up:** `useMemo` is not persistent storage and is not a correctness requirement for a simple lookup. State should remain minimal; values that can be derived need not be stored twice.

### Q24. How do protected routes work, and are they sufficient for security? ★

**Answer:** `ProtectedRoute` waits for Clerk to load, redirects signed-out users to sign-in, and renders the workspace for signed-in sessions. This controls the interface. The API independently verifies the session and ownership because an attacker can call HTTP endpoints directly.

**Example:** Hiding a Delete button does not authorize deletion. The backend still needs a query matching both document ID and owner ID.

### Q25. How do you avoid keeping the previous account's UI state?

**Answer:** The protected workspace wrapper uses the Clerk `sessionId` as a React key. A different session causes that subtree to remount, resetting component state and loading data for the new session.

**Boundary:** This is UI hygiene, not the main access-control mechanism. Every backend request must still be authorized. Request cancellation and stale-response guards would be useful additional protection against overlapping UI requests.

### Q26. Why create a shared API helper?

**Answer:** Each feature needs the same behavior: obtain a fresh session token, attach authorization, send a request, parse JSON, and show a useful error. Centralizing this avoids small differences between panels.

**Specific cases:** The helper handles a missing token, HTTP errors, invalid JSON responses, and successful HTTP 204 deletions. It supports both JSON and multipart uploads. The current implementation uses native `fetch`, not Axios.

### Q27. Why not manually set `Content-Type` for `FormData`?

**Answer:** Multipart requests need a boundary that separates the form fields and file bytes. The browser creates that boundary when sending `FormData`. Manually setting only `multipart/form-data` can leave the boundary missing and break server parsing.

**Project detail:** The request helper sets JSON content type for ordinary bodies and lets the browser handle `FormData`. The test suite includes a check that multipart requests preserve this behavior.

### Q28. How do loading and error states improve the application?

**Answer:** AI and file operations take longer than ordinary interactions. The components track activity and display useful success, empty, loading, and error states. A user can distinguish “there are no notes” from “notes could not load.” Separate AI errors also prevent a failed generation from being mistaken for a failed note save.

**Follow-up:** Disabled buttons improve the experience but cannot replace backend concurrency or authorization checks.

### Q29. Why poll document processing instead of using WebSockets?

**Answer:** The document component polls every two seconds while a document reports `processing`, and clears the interval through effect cleanup. Polling is sufficient for occasional extraction status changes and keeps the first version simple.

**Tradeoff:** Polling creates repeated requests and gives slightly delayed updates. Server-sent events could be considered for one-way status updates later. WebSockets are not currently part of the implementation.

### Q30. How does the frontend communicate with Express during development?

**Answer:** The browser sends relative `/api` requests to Vite. Vite forwards them to Express at `127.0.0.1:5000`. The app normally runs on Vite port 5173, with local build preview on 4173. This avoids hard-coding a backend host in each component.

**Follow-up:** A development proxy is not production hosting or API authorization. Public deployment would need a suitable reverse proxy or another explicit routing arrangement.

## 4. Backend, APIs, and security

### Q31. What is REST, and how does your API use HTTP methods?

**Answer:** REST-style APIs expose resources and use standard HTTP semantics. Notes use GET to read, POST to create, PUT to save the editable fields, and DELETE to remove. Document tag changes use PATCH. Processing and AI generation use POST because they start work.

| Example | Purpose |
|---|---|
| `GET /api/notes?q=database` | Owner-scoped keyword search |
| `PUT /api/notes/:id` | Save a note with version checking |
| `POST /api/documents/:id/process` | Extract and chunk an uploaded file |
| `POST /api/search/reindex` | Index current owned sources |
| `GET /api/search/semantic?query=...` | Retrieve semantically related chunks |
| `POST /api/ai/chat` | Ask a document question |
| `POST /api/study/quizzes/generate` | Generate a quiz preview |

### Q32. How is authentication different from authorization? ★

**Answer:** Authentication answers “Who is making this request?” Clerk verifies the session identity. Authorization answers “Can this identity use this resource?” The application checks that a note, document, conversation, or study set belongs to the verified user.

**Example:** User B can be correctly authenticated and still have no permission to read User A's note. A valid token must not imply access to every database record.

### Q33. How does Clerk authentication reach the backend?

**Answer:** React obtains the current session token and sends it in `Authorization: Bearer ...`. Clerk middleware processes the request, and controllers use `getAuth(req)` to obtain the verified user ID. The server also configures authorized parties for expected frontend origins.

**Follow-up:** The application does not accept a query parameter or JSON `userId` as proof of identity. Authentication tests include a caller-supplied user ID to check that it is ignored.

### Q34. Why must ownership be inside the database query? ★

**Answer:** A query such as `findOne({ _id: id, ownerId })` only returns a record matching both conditions. Checking just the ID could expose another user's data. The same rule applies to update and delete operations.

**Example:** Guessing a valid document ID should not produce a download URL. An owned lookup returns no document for the wrong account, so the controller can return a not-found response without revealing that the private record exists.

### Q35. What is an IDOR vulnerability?

**Answer:** Insecure direct object reference occurs when an application lets a caller access a resource by changing an identifier without enforcing permission. A notes API that reads any supplied note ID would be vulnerable even if users must sign in.

**Project defense:** Use the verified owner in every relevant lookup, including AI source loading and conversation history. Testing only list pages is insufficient; direct get, update, delete, processing, and generation endpoints also matter.

### Q36. How is the internal AI service protected?

**Answer:** Express sends a shared secret in `X-AI-Service-Token`. FastAPI has one router-level dependency that checks this token on internal endpoints. If authentication configuration is missing, it returns a service-unavailable error; a wrong or missing token is unauthorized.

**Tradeoff:** This identifies a trusted calling service, not an individual end user. Express must check end-user ownership before calling it. A future deployment should also restrict network access and protect transport.

### Q37. What does “fail closed” mean?

**Answer:** When security configuration is missing or invalid, access is denied rather than silently allowed. Missing Clerk configuration produces an error instead of a fake logged-in user. Missing internal AI authentication configuration also prevents internal operations.

**Interview point:** Convenience fallbacks that invent a user can accidentally become security bypasses. Tests should confirm that unavailable configuration never grants private access.

### Q38. How do you validate inputs at different layers?

**Answer:** React helps the user enter valid data. Express services enforce application rules regardless of the caller. Mongoose validates persistent structures. FastAPI/Pydantic validates the service boundary, and JavaScript checks returned AI shapes before using them.

**Example:** A quiz must have five questions, each with four distinct options and a valid answer index. The user can modify a browser request, so saving must validate again even if generation already produced a valid preview.

### Q39. Which HTTP status codes should you explain?

**Answer:** The application distinguishes invalid requests, missing identity, hidden resources, conflicting state, and provider failures.

| Code | Project-relevant meaning |
|---|---|
| 200 / 201 | Successful read/update or resource creation |
| 204 | Successful deletion with no response body |
| 400 | Invalid input such as an empty question |
| 401 | Missing or invalid authentication |
| 404 | Resource unavailable to this owner, or unknown endpoint |
| 409 | Stale note version or incompatible processing state |
| 422 | FastAPI validation/extraction input failure |
| 502 | Upstream AI service failure mapped by the backend |
| 503 | Required service configuration unavailable |

An internal 422 is not necessarily exposed as 422 by every public controller; inspect the relevant error mapping.

### Q40. How do timeouts work in your AI requests?

**Answer:** The shared Express AI client uses `AbortSignal.timeout` with operation-specific budgets. In this snapshot, extraction uses 30 seconds, generation/search-related calls generally use 60 seconds, and indexing uses 120 seconds. Python summary and structured study calls have a configurable provider timeout with a 55-second default.

**Important limit:** Aborting Express's wait does not guarantee downstream computation has stopped. The Python embedding and RAG code paths do not currently use the same explicit provider-timeout wrapper as summaries and study generation.

### Q41. How do you protect secrets and user data?

**Answer:** Provider credentials and the internal token belong in server-side configuration, not the React bundle or Git. Only the Clerk publishable key is intended for the frontend. Protected API responses use no-store headers in the relevant middleware and handlers, and private file links are generated after ownership checks.

**Boundary:** Private accounts do not mean processing is entirely on-device. Selected content is sent to configured external services. The project does not implement end-to-end encryption.

### Q42. How do you handle errors without leaking internal details?

**Answer:** Services raise focused errors, controllers map expected failures to useful HTTP responses, and unexpected failures reach shared error handling. Provider clients turn network or provider problems into messages suitable for users instead of returning raw credential-bearing errors.

**Improvement:** Production observability should retain safe request IDs and technical diagnostics in server logs while avoiding document text and secrets. That is a proposed operational improvement, not a claim of a complete tracing system.

### Q43. Does this application have rate limiting?

**Answer:** “I should distinguish input limits from request-rate limits. The code has file, text, chunk-count, and timeout limits. I have not found an implemented shared rate-limiting layer in the inspected API.”

**Proposed improvement:** Add per-user generation quotas, concurrency caps, and a shared store for limits if there are multiple API instances. A disabled UI button cannot stop scripts from sending requests directly. Do not claim that a planning note about rate limits proves a deployed limiter exists.

### Q44. What is prompt injection, and how do you address it?

**Answer:** Prompt injection is when text supplied as data tries to redirect the model's behavior, such as an uploaded page saying “ignore the user's question.” RAG and study prompts label source content as untrusted reference material and instruct the model not to follow commands inside it.

**Limit:** Instructions and delimiters reduce risk but are not a guarantee. Ownership checks happen in application code; the model is never trusted to decide which user's private content is accessible. The summary prompt has simpler source-only instructions and could be hardened consistently.

### Q45. Are file type checks enough to make uploads completely safe?

**Answer:** No. Extension, MIME-type, and basic byte checks reject obvious mismatches, and file-size limits bound some resource use. They are not a malware scanner or a proof that a complex document is harmless.

**Proposed improvement:** A public deployment could add malware scanning, parser isolation, stricter archive limits, and storage quotas. The internal downloader currently requires HTTPS; stricter destination and redirect checks would further constrain server-side fetching.

## 5. MongoDB and data consistency

### Q46. What are your main database models? ★

**Answer:** There are six main Mongoose models, each with a distinct responsibility.

| Model | Important data |
|---|---|
| `Note` | Owner, title, content, folder field, tags, version |
| `Document` | Owner, file metadata, Cloudinary ID, extraction and deletion state |
| `KnowledgeChunk` | Owner, source type/ID, source version, position, page, text |
| `Conversation` | Owner, title, last-message time |
| `Message` | Owner, conversation, role, content, grounding flag, sources |
| `StudySet` | Owner, flashcards/quiz type, source reference, cards or questions |

The current `KnowledgeChunk` schema stores text and metadata, not a numeric embedding array. Numeric vectors are stored in Qdrant.

### Q47. Why use MongoDB? Could SQL also work?

**Answer:** MongoDB fits the application's JSON-shaped records and nested study material, and Mongoose supplies explicit schemas and validation. Notes, document metadata, and small arrays of cards are convenient document records.

**Tradeoff:** SQL could also support this project well, especially where relational constraints and transactions are important. MongoDB does not automatically make an application more scalable. The choice must be supported by query patterns, indexes, operational needs, and developer familiarity.

### Q48. What indexes does the project define, and why?

**Answer:** Models define owner-based indexes and compound indexes for common access patterns: owner plus update time, owner plus conversation and creation time, or owner plus study-set type. Notes also have an owner-prefixed text index on title and content. Chunks have a unique compound index on owner, source type, source ID, and position.

**Tradeoff:** Indexes accelerate matching queries and can enforce uniqueness, but require storage and add write work. A schema declaration should still be checked against the indexes actually present in a deployed database.

### Q49. What is optimistic concurrency control? ★

**Answer:** It prevents one stale editor from silently overwriting a newer save. Each note has an application `version`. An update matches `_id`, `ownerId`, and the submitted version, then increments the version in the same update.

**Example:** Two tabs load version 3. Tab A saves and creates version 4. Tab B still submits version 3, so its update matches nothing. If the owned note still exists, the service reports a conflict rather than overwriting Tab A.

```javascript
// Simplified illustration of the implemented update pattern.
findOneAndUpdate(
  { _id: noteId, ownerId: verifiedOwnerId, version: submittedVersion },
  { $set: validatedFields, $inc: { version: 1 } },
  { new: true, runValidators: true },
);
```

**Follow-up:** This protects against lost updates; it does not merge simultaneous edits like a collaborative editor would.

### Q50. Is the note version the same as Mongoose's default version field?

**Answer:** No. The project explicitly defines `version` and disables Mongoose's default version key with `versionKey: false`. The service implements the matching and incrementing rules itself.

**Why it matters:** The same application version also identifies the note content used to build search chunks. An old chunk's `sourceVersion` must match the current note version before it is shown in search.

### Q51. What does `.lean()` do in the queries?

**Answer:** It asks Mongoose to return plain JavaScript objects instead of hydrated Mongoose document instances. This is useful for read paths that only need to serialize or inspect records.

**Tradeoff:** A lean result does not behave like a full Mongoose document: instance methods and features associated with hydration are unavailable. The project uses explicit update queries rather than expecting to call `.save()` on a lean result.

### Q52. How are embedding and chunk records related?

**Answer:** A MongoDB chunk has its own ID and points to a note or document. Qdrant stores a vector plus a payload containing that chunk ID, owner, source information, and other searchable metadata. The Qdrant point ID is deterministically derived from the chunk ID with UUIDv5.

**Purpose:** A retrieved point can be mapped back to an authoritative MongoDB chunk. Deterministic point IDs support repeatable upserts for the same chunk ID, but regenerated note chunks currently receive new IDs during reindexing.

### Q53. What happens to search when a note is edited or deleted? ★

**Answer:** After an edit, the note version increases. Search rejects chunks whose stored source version differs from the current note. After deletion, search cannot find an owned source note and rejects its old vector candidates. Reindexing creates searchable chunks for current note content.

**Important limitation:** Note deletion itself only removes the note record in the current service. It does not immediately purge all associated chunks and vectors. Search visibility is protected, but orphan cleanup remains an improvement. Document deletion has a more complete cleanup workflow.

### Q54. Are MongoDB, Cloudinary, and Qdrant updated in one transaction?

**Answer:** No. They are separate systems, so their operations can partially succeed. The application uses saved processing/deletion state, recovery, and source rechecks to manage these situations.

**Example:** The Cloudinary file may be deleted while Qdrant cleanup fails. The document remains marked for deletion and hidden from normal access; startup maintenance can retry cleanup. This is a compensating workflow, not an all-or-nothing distributed transaction.

### Q55. How would you make indexing more consistent at larger scale?

**Answer — proposed improvement:** I would version indexing jobs, batch chunks, and publish a new source generation only after its required writes succeed. A durable queue or outbox could record indexing work alongside source changes. A reconciliation job could remove orphan vectors and retry incomplete operations.

**Current limitation:** The vector code builds embeddings before deleting old source points, which protects against an early embedding failure. However, deletion followed by upsert is not atomic; an upsert failure can still leave a temporary search gap. MongoDB and Qdrant writes are also not a single transaction.

## 6. Documents and processing

### Q56. Explain the document upload workflow. ★

**Answer:** React sends a file using `FormData`. The Express document route applies Multer with memory storage, one-file handling, and a 10 MB limit. The upload path validates the file, stores its bytes as a private raw Cloudinary asset, and stores owner-scoped metadata in MongoDB.

**Follow-up:** Upload and extraction are separate actions. A successfully uploaded file begins with status `uploaded`; that does not mean its text has been extracted or its chunks indexed.

### Q57. Why separate file storage from MongoDB?

**Answer:** Cloudinary handles the original file bytes and private delivery. MongoDB holds structured information used by the application: owner, name, format, processing state, tags, and storage identifier. This separates file delivery from ordinary database queries.

**Tradeoff:** The separation creates cleanup and consistency work across two services. It is a design choice, not a claim that databases can never store files.

### Q58. How does private file access work?

**Answer:** The backend first looks up a document belonging to the signed-in owner. It then creates a signed Cloudinary access URL with a five-minute expiry. The frontend uses that URL to open or download the file.

**Important detail:** A signed URL is a temporary access capability. Someone who obtains it may use it while valid, so it should not be treated as a permanent public link or logged carelessly. Ownership checks govern issuing the URL; expiry limits its lifetime.

### Q59. Which file formats and loaders are supported?

**Answer:** PDFs use LangChain `PyPDFLoader`; DOCX uses `Docx2txtLoader`; TXT and Markdown use `TextLoader`. PDFs are loaded page by page, and the application converts the page metadata into one-based page numbers. DOCX, TXT, and Markdown currently behave as a single source section.

**Boundary:** The project does not reconstruct DOCX pagination or make Markdown headings into separate sections. A generic “section 1” should not be presented as an original printed page number.

### Q60. Why can a scanned PDF fail?

**Answer:** A scanned PDF may contain only images of text. Ordinary PDF text extraction reads an existing text layer; it does not automatically recognize characters inside images. The extractor detects missing readable text and returns a clear error.

**Future approach:** Add an OCR step—optical character recognition—to turn page images into text before chunking. This would introduce additional processing time, cost, and recognition errors, and is not part of the current implementation.

### Q61. Why use a temporary file during extraction?

**Answer:** The service downloads the authorized file, writes it to a temporary path, and passes that path to the appropriate loader. A `finally` block removes the temporary file, including when loading fails.

**Resource controls:** Downloading has a timeout and a 10 MB bound, and extraction enforces a text-size ceiling. These limits reduce accidental overload but do not replace parser sandboxing or comprehensive protection against compressed or unusually complex files.

### Q62. Explain the document processing states. ★

**Answer:** `uploaded` means the file is stored. `processing` means a run is extracting and chunking. `ready` means text and chunks were saved. `failed` records unsuccessful processing. `deleting` hides the source while cleanup completes.

```text
uploaded -> processing -> ready
                 |
                 +-----> failed -> processing (explicit retry)

An owned source can enter deleting during its lifecycle.
deleting -> external/chunk cleanup -> record removed
```

**Distinction:** “Ready” refers to extraction, not vector-index freshness. The user still triggers indexing separately.

### Q63. Why store a processing run ID? ★

**Answer:** A run ID identifies which extraction attempt may commit the document's completion. Deletion or recovery changes the active claim. Completion checks the owner, document state, and current run ID before marking the document ready.

**Example:** Run A starts. The user deletes the document, invalidating A's claim. If A finishes later, it cannot mark the deleted document ready using its old ID.

**Limit:** This is not a distributed lock covering every chunk operation. Multiple concurrent workers would need stronger leases and versioned chunk writes; the current recovery design assumes a single Express instance.

### Q64. How do retries and restart recovery work?

**Answer:** A retryable extraction-service failure gets up to two provider attempts in one processing invocation, meaning one automatic retry. The first retry delay is 250 milliseconds. Input/extraction errors are distinguished from generic unavailable-service failures and are not blindly retried by that loop.

**Restart behavior:** MongoDB stores the processing claim, attempts, and start time. At Express startup, maintenance finds interrupted work and attempts recovery with a new claim, up to the configured saved-attempt policy described as three attempts. Exhausted work is marked failed for explicit user retry. This is startup recovery, not a continuously scheduled worker queue.

### Q65. What happens if deletion partly fails? ★

**Answer:** The server first marks the document as deleting so normal access and source checks hide it. It then attempts Cloudinary file removal, MongoDB chunk removal, and Qdrant vector removal using `Promise.allSettled`. Only after all required cleanup succeeds does it finalize removal of the document record.

**Example:** If Qdrant is unavailable, the source remains hidden and the deletion claim remains available for startup recovery. The three cleanup operations are attempted concurrently; they are not a strict storage-then-chunks-then-vectors sequence. Already-missing Cloudinary files are treated as a successful cleanup condition.

## 7. Embeddings, search, and RAG

### Q66. Explain the complete AI learning pipeline. ★

**Answer:** Load the document, extract text, split it into chunks, create embeddings, retrieve related chunks, and send a focused prompt to the model. Each step has a separate purpose and an identifiable module.

```text
Preparation:
File -> loader -> readable pages -> chunks -> embeddings -> vector index

Question time:
Question -> query embedding -> owner-filtered search
         -> current-source checks -> focused context -> generated answer
```

**Follow-up:** Extraction, indexing, and question answering are separate stages. Uploading a file alone does not complete the entire pipeline.

### Q67. What is an embedding? ★

**Answer:** An embedding is a list of numbers representing properties of text learned by a model. Similar meanings can have similar vector representations, allowing retrieval even when wording differs. It is not a summary or a database ID.

**Project detail:** The embedding service requests a configured vector size and checks that the returned length matches it. The default in this code is 768 dimensions. [Official Gemini embedding documentation](https://ai.google.dev/gemini-api/docs/embeddings).

### Q68. Why use different embedding task types for documents and queries?

**Answer:** The service uses `RETRIEVAL_DOCUMENT` for stored chunks and `RETRIEVAL_QUERY` for search questions. This tells the embedding API how each text will be used in retrieval. Both sides use the same configured embedding model and compatible dimensionality.

**Example:** A long explanatory paragraph is a retrieval document; “what causes deadlock?” is a retrieval query. Creating these vectors does not call the answer-generation model. [Official task-type guidance](https://ai.google.dev/gemini-api/docs/embeddings).

### Q69. Why split documents into chunks? ★

**Answer:** A whole document may contain several unrelated topics. One vector for the entire document can make a specific passage harder to find, while sending the entire file to generation increases context size and cost. Chunks make retrieval more focused and preserve locations for sources.

**Tradeoff:** Very small chunks may lose necessary context; very large chunks may contain too much unrelated material. The chosen settings are a starting configuration, not a measured optimum.

### Q70. How does `RecursiveCharacterTextSplitter` work here?

**Answer:** The project supplies paragraph breaks, line breaks, spaces, and finally individual characters as splitting boundaries. The splitter tries these in order to produce bounded pieces while retaining useful text boundaries. The input consists of LangChain documents with page metadata.

**Current defaults:** Chunk size is 2,000 characters and overlap is 200 characters. This implementation measures characters, not model tokens. [LangChain recursive splitter documentation](https://docs.langchain.com/oss/python/integrations/splitters/recursive_text_splitter).

### Q71. Why have overlap between chunks?

**Answer:** Related information can cross a chunk boundary. Repeating some nearby text gives the next chunk context that it might otherwise lose.

**Example:** One passage introduces a term and the next explains it. Some overlap may help each retrieved piece remain understandable. The configured 200 characters are an overlap target; the recursive splitting process need not produce exactly that many repeated characters in every pair. More overlap also means more text to embed and potentially more duplicate retrieval results.

### Q72. How do you preserve source locations?

**Answer:** Each extracted page has a page number. That metadata is carried into LangChain documents and then into the resulting chunks. Chunks store source ID, position, and page number in MongoDB, and the index includes corresponding payload fields.

**Benefit:** A PDF search result or answer source can point the user toward the relevant page. The splitter processes pages separately, so chunks do not span input PDF pages; that helps citation clarity but can split a concept that crosses a page boundary.

### Q73. What is the difference between keyword search and semantic search? ★

**Answer:** Keyword search uses words in the note's title or content through MongoDB text search. Semantic search compares embeddings and retrieves related passages from Qdrant. Keyword search is useful for exact terms; semantic search can help when the user remembers the meaning but not the original wording.

**Example:** An exact identifier such as `processingRunId` may be better served by lexical search. “Prevent an old extraction from restoring a deleted document” may benefit from semantic retrieval. The application provides separate search paths, not an implemented hybrid ranker.

### Q74. What is cosine similarity?

**Answer:** It compares the direction of two nonzero vectors using their dot product divided by their lengths:

```text
cosine_similarity(a, b) = dot(a, b) / (length(a) * length(b))
```

**Example:** `[1, 0]` and `[1, 0]` have cosine similarity 1. `[1, 0]` and `[0, 1]` have similarity 0. The Qdrant collection is created with cosine distance configuration.

**Important:** A similarity score measures vector closeness under the chosen model and metric. It is not the probability that a generated answer is correct. A score of 0.8 must not be presented as “80% accurate.”

### Q75. Why use Qdrant instead of just MongoDB?

**Answer:** In this implementation, MongoDB manages application records and current ownership while Qdrant handles vector retrieval and metadata filters. The separation gives the project an explicit vector-search pipeline.

**Tradeoff:** Some database products also support vector search, so a separate vector store is not mandatory. Qdrant adds another service and synchronization work. The decision is supported by this project's architecture and learning goals, not a claim that MongoDB cannot support vector search.

### Q76. How do you prevent cross-user vector retrieval? ★

**Answer:** Qdrant queries include a mandatory `ownerId` condition. Optional source-type, folder, and tag conditions narrow the results further. Express supplies the owner from Clerk, and then rechecks retrieved source IDs and chunks in MongoDB before returning data.

**Why two checks:** Vector filters constrain retrieval, while database rechecks reject stale or invalid candidates. Metadata filtering is a capability of Qdrant, not a substitute for application authorization. [Qdrant filtering documentation](https://qdrant.tech/documentation/search/filtering/).

### Q77. What does reindexing do, and when is it needed?

**Answer:** The indexing service gathers the user's ready document chunks and current saved notes. It sends notes through the shared splitter, creates indexable chunk records, requests embeddings, and writes points to Qdrant. The UI exposes this as an explicit indexing action.

**When needed:** After document extraction and note changes, and when relevant search metadata changes. Editing a note does not automatically generate new vectors in the current code. Old note versions are suppressed until the current content is indexed.

### Q78. What happens if the embedding model or dimension changes?

**Answer:** Existing vectors cannot simply be mixed with vectors from an incompatible embedding configuration. Document and query vectors must belong to a compatible representation space, and stored vectors must match the collection's size.

**Proposed migration:** Create a new versioned collection, regenerate source embeddings, verify retrieval, and switch reads after the new index is ready. The current collection helper creates missing collections but does not implement a full dimension/model migration or validate every existing collection setting.

### Q79. What is RAG? ★

**Answer:** RAG means retrieval-augmented generation. The application first retrieves relevant source passages and then gives those passages to the language model along with the question. This allows the answer to use private application content that was not part of the model's training.

**Project example:** A user asks about an uploaded database chapter. The system retrieves matching chunks belonging to that user and asks the selected generation provider to answer using only the supplied context. RAG changes the information available to the request, not the model's parameters.

### Q80. Why use RAG rather than sending the whole document or fine-tuning?

**Answer:** RAG selects a smaller amount of relevant current content and makes source references possible. Sending every document on every question increases context size and repeatedly includes irrelevant material. Fine-tuning changes model behavior through training; it is not the implementation used here for frequently changing private sources.

**Tradeoff:** Retrieval can miss necessary information. RAG is only as useful as the extracted text, index quality, permission checks, and final prompt. For a tiny document, directly providing the full text might be a reasonable simpler alternative.

### Q81. How do you choose context, and what happens with weak results? ★

**Answer:** The RAG service requests up to four document matches. It checks that scores are finite and meet a default minimum of 0.55, then verifies the source and chunk in MongoDB. Python limits the included context using a default 7,000-character budget for source headers and text.

**No evidence:** It returns “I couldn't find enough information in your documents to answer that.” without calling answer generation. The threshold is a configurable heuristic, not a calibrated accuracy guarantee. Separators and the rest of the prompt add characters beyond the context text budget.

### Q82. Does RAG guarantee factual answers or correct citations? ★

**Answer:** No. It improves access to relevant source material and encourages source-based answers, but a model can still misinterpret a passage or add unsupported information. The current `grounded` flag is based on whether the answer equals the predefined refusal string; it is not an independent factual verifier.

**Citation detail:** Sources are the authorized chunks selected by the application, not model-invented URLs. They identify evidence provided to generation, but the current implementation does not validate every claim against an exact supporting sentence or track precisely which part of a truncated context supported it.

### Q83. Does the chatbot remember previous messages?

**Answer:** It stores conversation history in MongoDB and displays it when the conversation is opened. However, the generation call currently receives only the latest question and retrieved context. It does not include earlier messages.

**Consequence:** A follow-up like “Explain the second point” may lack enough context. A future improvement could include a bounded history or rewrite the question using earlier turns, with the same ownership and input limits. Saved history and model conversation memory are different features.

### Q84. How would you evaluate retrieval and answer quality?

**Answer — proposed evaluation:** Create a small representative set of documents, questions, expected supporting passages, and unanswerable questions. Measure whether retrieval includes the required evidence and whether the generated answer is supported by it.

**Useful measures:** Recall@k asks whether relevant evidence appears in the first k results. Precision@k measures how many of those results are relevant. Also assess answer faithfulness, source correctness, refusal behavior, latency, and cost. Include cross-user and deleted-source cases. No benchmark values are claimed without running such an evaluation.

### Q85. How would you improve retrieval if results were poor?

**Answer — proposed improvements:** First inspect extraction quality, query wording, source freshness, filters, and chunk boundaries. Then compare chunk-size and overlap settings using the evaluation set. If needed, test hybrid lexical/vector retrieval, retrieve more candidates and rerank them, or reduce duplicate overlapping passages.

**Tradeoff:** More context can increase latency, cost, and irrelevant information. Reranking adds another stage. A sensible improvement should be measured against the current baseline rather than added just because it is popular.

## 8. Summaries and study tools

### Q86. How does summarization work, and is it RAG?

**Answer:** Express loads the user's saved note and sends its text to the Python summary service. The prompt requests three to five short bullet points using the note's facts. The response is shown in React. It does not search Qdrant first, so this summary path is direct generation from the source, not retrieval-augmented generation.

**Boundary:** A note can store up to 50,000 characters, while the Python summary request allows 12,000. Larger-note summarization would need clearer prevalidation or a chunked summarization design. A generated summary is not automatically a saved note field.

### Q87. How are AI tag suggestions generated and saved?

**Answer:** The backend reads an owned saved note or a document whose text has been extracted. The Python service asks the selected generation provider for three to five short tags and validates the result. Tags are normalized, and the UI lets the user review suggestions before saving them through ordinary source-update APIs.

**Benefit:** A model suggestion does not silently rewrite the user's organization. The current input path limits source text to 12,000 characters, so very long extracted documents are not automatically condensed for tag generation.

### Q88. Why use structured output for study material? ★

**Answer:** React needs predictable fields such as `question`, `options`, and `correctOptionIndex`. Free-form prose would require unreliable parsing. The Python service supplies a response schema and requests JSON, then validates the returned text with Pydantic. Express also checks the application-facing structure.

**Important distinction:** Correct structure does not prove correct facts. A perfectly shaped quiz can still contain a mistaken answer, which is why user review matters. Each adapter requests provider-supported structured output, then Pydantic validates the result again inside the application.

### Q89. How do flashcards work?

**Answer:** The user selects a saved note. The backend loads that owned note and asks the AI service for exactly five question-and-answer pairs. The user reviews them and explicitly saves a private `StudySet` with type `flashcards`. The interface supports opening the deck, flipping cards, moving between them, shuffling, and deleting the set.

**Follow-up:** Generation and saving are separate requests. A temporary preview is not a database record until the save succeeds.

### Q90. How do quizzes work, and why is scoring in React?

**Answer:** A quiz contains five questions, four different options per question, one correct option index from 0 to 3, and an explanation. The user reviews and saves it. React compares chosen answers with the saved answer key and calculates the score locally.

**Tradeoff:** This is appropriate for self-study because the browser receives the answer key. It is not suitable for a secure examination. Graded assessments would require a separate design with server-side scoring and controlled answer disclosure.

### Q91. Why share one StudySet model and service?

**Answer:** Flashcards and quizzes share ownership, source references, titles, timestamps, list/get/delete behavior, and explicit saving. A type field distinguishes them, while separate validators preserve the different item structures. This reduces duplicated CRUD logic without hiding the feature-specific rules.

**Important detail:** Queries include both `ownerId` and `type`, so a quiz ID cannot be treated as a flashcard set merely because both use the same collection. The current generation and save flow accepts notes only.

### Q92. What happens to saved study material if the generation provider is unavailable or its source changes?

**Answer:** Saved decks and quizzes are ordinary MongoDB records and can be opened without constructing an AI client. Provider unavailability affects new generation rather than existing stored items. Saved sets contain their generated content and a source reference; they do not regenerate automatically after a note edit.

**Current behavior:** The study read path does not require the source note to still exist, so saved material can remain after source deletion. This is a snapshot behavior that should be made clear to users; it is not a live synchronized view of the note.

## 9. Testing, debugging, and scaling

### Q93. How did you test the project? ★

**Answer:** The repository has Node tests using the built-in test runner and Python tests using `unittest`. Tests cover authentication, owned CRUD operations, uploads, document processing, retrieval, RAG abstention, study material, and transport contracts. Application factories allow test models and providers to be injected. Some tests make actual local HTTP requests; document tests also exercise real loaders on fixtures, and a vector test checks owner filtering using a test client.

**Evidence boundary:** Explain the tests you can open and demonstrate. Existing documentation records earlier passing verification runs, but this interview guide does not claim that the current working tree was freshly tested when the guide was written.

### Q94. What is the difference between unit, integration, and end-to-end tests?

**Answer:** A unit test focuses on a small function or service, such as validating note tags. An integration test checks components working together, such as an HTTP route, controller, and injected service. An end-to-end test exercises a user journey through the running interface and its dependencies.

**Project nuance:** An HTTP test with a fake model verifies routing and behavior, but does not prove real MongoDB connectivity. A successful frontend build checks bundling; it does not prove the signed-in browser journey or live provider availability.

### Q95. Why mock external AI providers?

**Answer:** Live models can be slow, charge per request, change their wording, or be unavailable. A fake provider lets a test return a known valid response, an invalid response, or a controlled failure. Assertions can then focus on ownership, validation, error handling, and request contracts.

**Tradeoff:** Mocks cannot confirm that a real provider accepts the configured model, key, or schema. Live smoke checks should complement automated tests before a demo or deployment, without including secrets in logs.

### Q96. Which security and reliability tests are most valuable? ★

**Answer:** Tests that verify isolation and failure behavior are especially important:

1. A forged or missing session cannot access private resources.
2. Two verified users receive separate records.
3. Another user's source never reaches the AI client.
4. A stale note version cannot overwrite a recent save.
5. Deleted or outdated sources do not appear in semantic results.
6. Missing or weak RAG evidence avoids answer generation.
7. An old processing run cannot restore a deleted document's ready state.
8. Failed cleanup remains recoverable.

These are represented in the repository's tests; they do not imply exhaustive coverage of every concurrency ordering or cloud failure.

### Q97. How would you debug “the AI feature is not working”? ★

**Answer:** Follow the request through its layers instead of changing the prompt immediately. Check the browser response and status, then whether Express authenticated the request and found the owned source. Check whether FastAPI received the internal request, whether its validation passed, and whether the provider call succeeded.

**Examples:** A 401 suggests authentication; a 404 may be a missing or unowned source; 409 may be incompatible state; 502 indicates a mapped upstream failure; 503 may indicate missing configuration. For Q&A, also inspect extraction, indexing, and retrieved matches before debugging generation. Never print environment-file secrets.

### Q98. How would you debug empty or stale search results?

**Answer:** Confirm that extraction is complete and indexing has run. For notes, compare the note version with the chunk version. Check the owner and source-type filters, the query embedding configuration, and whether the MongoDB source still exists. Inspect whether Qdrant returned candidates that the application later rejected.

**Subtle point:** The service may return fewer than the requested number of results because post-retrieval validation removes invalid candidates. It does not currently over-fetch and refill until it has k valid results. Empty search can therefore be a safe filtering outcome rather than a provider outage.

### Q99. What happens if the user indexes more than 100 chunks?

**Answer:** The Python `IndexChunksRequest` schema permits at most 100 chunks, while the Express reindex flow currently combines available indexable chunks into one request. A larger collection can therefore exceed the request contract and fail validation. The present code does not implement automatic multi-batch indexing.

**Proposed fix:** Batch by source with a generation-aware replace strategy, track progress, and retry safely. Simply splitting arbitrary arrays is insufficient because the current vector writer deletes existing source vectors before upserting each call; separate batches for the same source could erase earlier batches.

### Q100. How would you reduce latency and API cost?

**Answer — proposed improvements:** Measure each stage first: text extraction, embedding, vector lookup, source rechecks, generation, and persistence. Avoid re-embedding unchanged chunks, batch embeddings where supported, reuse provider clients appropriately, and cache only with owner and source-version-aware keys. Keep prompts focused and add quotas for expensive operations.

**Current optimization:** The application bounds context and skips answer generation when evidence is insufficient. Do not claim implemented embedding caching or measured cost savings; the current indexer generates embeddings sequentially and reindexes available sources.

### Q101. How would you scale this application to many users?

**Answer — proposed design:** Start with measurements and bottlenecks. Add pagination to growing lists, move long extraction/indexing jobs to durable workers, introduce distributed leases and shared request limits, and use versioned indexing with reconciliation. Separate stateless HTTP serving from durable background work and monitor queue length and provider quotas.

**Current boundary:** Recovery is designed for one Express instance. Multiple instances could compete for work without stronger coordination. No load-test result justifies claiming support for thousands or millions of users yet.

### Q102. How would you deploy it, and what would you verify?

**Answer — planned, not implemented:** Build React, deploy the Express API and FastAPI service, configure secrets securely, and arrange HTTPS and routing. Keep the AI service restricted to trusted callers. Docker Compose and Nginx are in the deferred deployment plan. Configure Clerk's allowed origins and ensure database, file storage, and vector services are reachable.

**Checks:** Fresh setup, authentication, private uploads, extraction, indexing, grounded Q&A, saved study tools, account isolation, restart recovery, backups, logging, and failure handling. A health endpoint returning `ok` is a liveness signal, not proof that every external dependency is healthy.

### Q103. What engineering improvements would you prioritize next?

**Answer:** I would prioritize the remaining V1 work and correctness limits: deployment, robust chunk batching, source-version-aware indexing, note orphan cleanup, consistent provider timeout handling, and a small retrieval-quality evaluation set. Then I would improve long-list pagination, operational monitoring, and the most visible user experience problems.

**Scope discipline:** Collaboration is optional V2 and requires a separate decision. Adding a new framework or feature is less valuable than making the existing private workflow demonstrably reliable.

## 10. Project discussion and behavioral questions

### Q104. What was the most challenging part of this project? ★

**Practice answer:** “A challenging engineering problem was keeping retrieved content consistent with the source. A vector can remain after a note changes or a document is deleted. The application treats Qdrant results as candidates, verifies ownership and source state in MongoDB, and uses note versions to reject outdated chunks. Document deletion also hides the source before cleaning up external resources.”

**Make it personal only when true:** If this was not your own hardest task, choose a challenge you actually worked through. Discuss the implemented design without inventing a production incident or claiming responsibility for work you cannot explain.

### Q105. Describe a bug and how you fixed it.

**Answer structure:** State the observed symptom, how you reproduced it, the cause you confirmed, the change, and the verification. Use a real incident from your work or an accurately documented phase entry.

**Repository-backed example to study:** The code distinguishes extraction input errors from retryable unavailable-service errors, and a test verifies that distinction. You can explain why invalid input should not consume repeated provider attempts. Do not claim you personally discovered a specific incident unless that happened.

**Illustrative wording:** “The regression test ensures that an extraction validation response stays a non-retryable input error instead of becoming a generic retryable service failure.”

### Q106. What was your personal contribution? Did you use AI assistance?

**Answer:** Be specific about what you actually did: requirements, code you wrote or reviewed, integration decisions, debugging, testing, or documentation. If you used an AI coding assistant, say so and explain how you checked the output and learned the flow.

**Template:** “I used AI assistance for [actual task]. I personally verified [actual behavior] and can explain [specific module]. One correction I made was [real example].” Replace every bracket with something true. Do not claim sole authorship or complete independent implementation without evidence.

### Q107. What would you do differently if starting again?

**Practice answer:** “I would define source ownership and API contracts early, add tests for failure cases alongside each feature, and plan source versioning before introducing a second data store. I would also make current limitations visible, such as explicit reindexing and the maximum indexing batch size.”

**Follow-up:** Explain one concrete tradeoff. For example, starting with separate Node and Python services supports the selected learning stack but creates transport and deployment overhead. A different project might reasonably choose a single backend.

### Q108. How can you defend choosing a simple implementation?

**Answer:** Simplicity means solving the current problem with understandable components while identifying the limits. Polling is sufficient for occasional processing updates, a shared study service removes repeated CRUD code, and explicit loader/chunker modules make the AI pipeline easy to inspect.

**Tradeoff:** Simpler choices are not automatically suitable at large scale. I should be able to name the trigger for changing them: more concurrent users, long processing queues, larger indexes, or a demonstrated need for streaming updates.

### Q109. Explain the project to a nontechnical interviewer.

**Answer:** “It is a private study workspace. You can write notes and upload study documents. Instead of remembering the exact sentence to search for, you can search by meaning or ask a question. The app finds related passages and uses them to prepare an answer. It also helps create summaries, tags, flashcards, and quizzes. Each person's material stays separate, and users review generated study content before saving it.”

**Avoid:** Listing every library before explaining what the user can do.

### Q110. Why should we consider this project evidence of your engineering skills?

**Practice answer:** “It connects frontend state, authenticated APIs, database design, private storage, and an AI retrieval pipeline. I can explain how a request moves through these layers, what happens when a dependency fails, and where the current design has limits. The work includes ownership checks, version conflicts, source validation, recovery, and regression tests rather than only a successful AI demo.”

**Support the statement:** Open one relevant service and one test. Evidence is stronger than saying the project is “production-ready” or quoting an unsupported accuracy percentage.

## Five-minute demo

Prepare a short note and a small PDF with selectable text. Use content whose answer you can verify manually. Confirm external services work before the interview; generation and indexing time may vary.

| Time | Action | What to explain |
|---|---|---|
| 0:00–0:40 | Sign in and show the workspace | Private accounts; six AI features; honest local status |
| 0:40–1:20 | Create or open a note, edit and save it | Draft state, API flow, owner ID, note version |
| 1:20–2:00 | Show a summary and tag suggestions | Server loads saved content; review before saving |
| 2:00–2:50 | Upload/process a prepared PDF, or show already extracted pages | Loader, page metadata, chunks; extraction differs from indexing |
| 2:50–3:40 | Index and perform a semantic search | Embeddings, Qdrant owner filter, MongoDB recheck |
| 3:40–4:20 | Ask an answerable question and an unrelated question | Source-based answer; missing-evidence response |
| 4:20–5:00 | Show a saved deck or quiz and one relevant test | Structured responses, persistence, regression checks |

If a live service is unavailable, state the failure plainly and walk through the code and recorded test behavior. Do not present prerecorded output as a fresh live result. For a strict time limit, prepare indexed content in advance and explain which steps were already completed.

## Last-day revision checklist

### If you have only one hour

1. Practice Q1 aloud until the project introduction takes under one minute.
2. Draw the architecture and explain Q11, Q15, and Q16 without reading.
3. Learn authentication versus authorization: Q32–36.
4. Explain the two most useful correctness examples: note versioning in Q49 and deletion recovery in Q63–65.
5. Explain embeddings, chunking, semantic search, and RAG: Q66–82.
6. Know the testing boundary and current limitations: Q7, Q10, Q93, Q99, and Q102.
7. Prepare one truthful challenge, bug, and contribution answer: Q104–106.

### Numbers worth remembering

These are **code defaults or limits in the inspected snapshot**, not universal best practices or confirmation of private runtime environment settings.

| Setting | Current code value | Caveat |
|---|---|---|
| Upload size | 10 MiB in byte arithmetic, displayed as 10 MB | Not a complete resource-safety guarantee |
| Note title/content | 140 / 50,000 characters | AI input limits can be smaller |
| Tags on notes | Up to 10, 30 characters each | AI suggestions request 3–5 |
| Summary/study source input | 12,000 characters | Long-document reduction is not implemented |
| Extracted document text ceiling | 500,000 characters | Applies after loading/extraction |
| Chunk size / overlap | 2,000 / 200 characters | Not tokens; overlap is not always exact |
| Embedding dimensions | 768 by default | Configurable; must match collection |
| Semantic results | Default 5; bounded to 1–10 | Filtering can reduce final count |
| RAG candidate chunks | Up to 4 | Documents only |
| RAG score threshold | 0.55 by default | Heuristic, not a confidence percentage |
| RAG source-text budget | 7,000 characters by default | Headers counted; prompt/separators add overhead |
| Index request size | Maximum 100 chunks | Reindex path currently needs batching for larger sets |
| Flashcards / quiz questions | Exactly 5 | Quiz: 4 options, answer index 0–3 |
| Private access URL | 300 seconds | Temporary bearer capability |
| Document polling | Every 2 seconds while processing | Not WebSockets |

### Common statements to correct before the interview

| Avoid saying | Say instead |
|---|---|
| “I trained the model on my PDFs.” | “I embed and retrieve source chunks, then supply context to a pretrained model.” |
| “RAG guarantees no hallucinations.” | “RAG supplies evidence; source quality and generated claims still require evaluation.” |
| “A score of 0.8 means 80% accuracy.” | “It is a similarity score, not a calibrated probability.” |
| “Every AI feature uses RAG.” | “Document Q&A uses retrieval; summaries and study tools use source text directly.” |
| “All saved chat messages are passed to the model.” | “History is stored, but generation currently receives the latest question and context.” |
| “The model decides whether a user can read a document.” | “The backend enforces ownership before context reaches the model.” |
| “My app is publicly deployed and fully production-ready.” | “Local features and hardening exist; deployment work is deferred.” |
| “Every deletion instantly removes every related record.” | “Documents have recoverable cleanup; note orphan cleanup remains an improvement.” |
| “There is a background queue constantly retrying jobs.” | “Saved interrupted work is recovered at API startup.” |
| “It supports real-time collaboration.” | “V1 is private per user; collaboration is optional V2.” |
| “Tests passing proves the live provider works.” | “Mocked tests verify application behavior; live integration checks are separate.” |
| “A schema allowing document sources means quizzes support documents.” | “The current quiz and flashcard flows generate from saved notes.” |

### Practice exercises

These are suggested exercises, not features or tests added by this document.

1. Explain the conditional note update and predict two-tab behavior without running it.
2. Trace a document deletion through its claim, three cleanup operations, and completion check.
3. Draw the difference between extraction, indexing, semantic retrieval, and RAG generation.
4. Describe a test proving another user's source never reaches the AI provider.
5. Design a batching change that does not erase earlier batches for the same source.
6. Explain why storing a quiz answer key in React is suitable for self-study but unsuitable for a protected examination.

## Code-reading map

Use these links to connect answers to implementation. Paths are absolute for the current workspace.

| Topic | Read these files |
|---|---|
| Current scope and phase history | [README](D:/Projects/Notes_ai/README.md), [implementation plan](D:/Projects/Notes_ai/docs/coding-implementation-plan.md), [Phase 10 notes](D:/Projects/Notes_ai/docs/phase-10-local-hardening.md) |
| React authentication and routing | [Root.jsx](D:/Projects/Notes_ai/client/src/Root.jsx) |
| Note editing and state | [NotesWorkspace.jsx](D:/Projects/Notes_ai/client/src/NotesWorkspace.jsx) |
| Shared browser requests | [api.js](D:/Projects/Notes_ai/client/src/services/api.js), [request-helper tests](D:/Projects/Notes_ai/server/test/clientApi.test.js) |
| Development proxy | [vite.config.js](D:/Projects/Notes_ai/client/vite.config.js) |
| Express setup and authentication | [app.js](D:/Projects/Notes_ai/server/src/app.js), [Clerk configuration](D:/Projects/Notes_ai/server/src/config/clerk.js), [auth tests](D:/Projects/Notes_ai/server/test/auth.test.js) |
| Notes and optimistic updates | [Note model](D:/Projects/Notes_ai/server/src/models/Note.js), [note service](D:/Projects/Notes_ai/server/src/services/noteService.js), [note tests](D:/Projects/Notes_ai/server/test/notes.test.js) |
| Document state and private storage | [Document model](D:/Projects/Notes_ai/server/src/models/Document.js), [document service](D:/Projects/Notes_ai/server/src/services/documentService.js), [Cloudinary storage](D:/Projects/Notes_ai/server/src/services/cloudinaryDocumentStorage.js) |
| Processing, cleanup, and recovery | [processing service](D:/Projects/Notes_ai/server/src/services/documentProcessingService.js), [cleanup service](D:/Projects/Notes_ai/server/src/services/documentCleanupService.js), [maintenance service](D:/Projects/Notes_ai/server/src/services/documentMaintenanceService.js), [reliability tests](D:/Projects/Notes_ai/server/test/documentReliability.test.js) |
| API-to-AI contracts and timeouts | [AI service client](D:/Projects/Notes_ai/server/src/services/aiServiceClient.js), [transport tests](D:/Projects/Notes_ai/server/test/aiServiceClient.test.js) |
| Python routes, schemas, defaults | [main.py](D:/Projects/Notes_ai/ai-service/app/main.py), [schemas.py](D:/Projects/Notes_ai/ai-service/app/schemas.py), [config.py](D:/Projects/Notes_ai/ai-service/app/config.py) |
| Document loading and splitting | [extraction service](D:/Projects/Notes_ai/ai-service/app/services/pdf_extraction_service.py), [text_chunking.py](D:/Projects/Notes_ai/ai-service/app/services/text_chunking.py) |
| Embeddings and Qdrant | [embedding service](D:/Projects/Notes_ai/ai-service/app/services/embedding_service.py), [vector store](D:/Projects/Notes_ai/ai-service/app/services/vector_store.py) |
| Search indexing and source validation | [semantic search service](D:/Projects/Notes_ai/server/src/services/semanticSearchService.js), [KnowledgeChunk model](D:/Projects/Notes_ai/server/src/models/KnowledgeChunk.js), [search tests](D:/Projects/Notes_ai/server/test/semanticSearch.test.js) |
| RAG retrieval, history, and prompting | [Express RAG service](D:/Projects/Notes_ai/server/src/services/ragService.js), [Python RAG service](D:/Projects/Notes_ai/ai-service/app/services/rag_service.py), [RAG tests](D:/Projects/Notes_ai/server/test/rag.test.js) |
| Generation-provider selection | [provider contract and factory](D:/Projects/Notes_ai/ai-service/app/services/generation_provider.py), [Gemini adapter](D:/Projects/Notes_ai/ai-service/app/services/gemini_service.py), [Anthropic adapter](D:/Projects/Notes_ai/ai-service/app/services/anthropic_service.py) |
| Summaries and tag source checks | [application AI service](D:/Projects/Notes_ai/server/src/services/aiService.js), [summary service](D:/Projects/Notes_ai/ai-service/app/services/summary_service.py) |
| Study generation and storage | [Python study service](D:/Projects/Notes_ai/ai-service/app/services/study_service.py), [Express study service](D:/Projects/Notes_ai/server/src/services/studyService.js), [StudySet model](D:/Projects/Notes_ai/server/src/models/StudySet.js) |
| Study UI | [Flashcards.jsx](D:/Projects/Notes_ai/client/src/Flashcards.jsx), [Quiz.jsx](D:/Projects/Notes_ai/client/src/Quiz.jsx) |
| Python test examples | [test_app.py](D:/Projects/Notes_ai/ai-service/tests/test_app.py) |
| Available run/test scripts | [root package.json](D:/Projects/Notes_ai/package.json) |

### Commands to know

Run from the project root in PowerShell after dependencies and local configuration are ready:

```powershell
Set-Location D:\Projects\Notes_ai
npm.cmd run dev:all
```

In a separate terminal, the repository's verification script is:

```powershell
Set-Location D:\Projects\Notes_ai
npm.cmd run verify
```

The verification script runs Node tests, Python tests, and the React production build. These commands were checked against the package scripts, not executed as part of writing this guide. Do not memorize an old test count as a current result; quote the latest run you actually observe.

### Reference policy for model details

The source selects generation and embedding model names through configuration. Code defaults do not prove the value used in a private environment or current model availability. Explain the roles of generation and embedding separately, and verify a configured model with official documentation and a safe live check before a demo. This guide does not disclose environment values or claim a particular model is the newest.
