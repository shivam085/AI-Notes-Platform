# Phase 8: RAG document Q&A

Phase 8 turns semantic search into private question answering. It is the first
full **RAG** flow in this project.

## What RAG means here

RAG stands for **retrieval-augmented generation**. Gemini does not read every
PDF each time you ask a question. Instead, the app does this:

```text
Your question
  -> Express verifies your Clerk session
  -> FastAPI turns the question into an embedding
  -> Qdrant Cloud finds similar chunks for your account
  -> Express rechecks every chosen chunk in MongoDB
  -> FastAPI gives only those trusted chunks and the question to Gemini
  -> React shows the answer and its PDF/page sources
```

Qdrant helps find candidates by meaning. It is **not** the final permission
check. Before text is sent to Gemini, Express checks the chunk and its PDF
again in MongoDB using the signed-in user's owner ID.

## Configure the limits

The Phase 7 Qdrant Cloud settings and matching `AI_SERVICE_TOKEN` must already
be present in the local `.env` files. Add these optional values to `ai-service/.env`:

```dotenv
RAG_MAX_CONTEXT_CHUNKS=4
RAG_MAX_CONTEXT_CHARS=7000
```

Add this optional value to `server/.env`:

```dotenv
RAG_MIN_SIMILARITY_SCORE=0.55
```

The defaults above are used when values are omitted. The score prevents a weak
semantic match from being treated as evidence. If no sufficiently relevant,
owned PDF chunk is found, the app saves and displays:

> I couldn't find enough information in your documents to answer that.

That response does not call Gemini and has no source cards.

## Start the three local services

From the project root, run the JavaScript apps together:

```powershell
npm.cmd run dev
```

In a second terminal, start FastAPI:

```powershell
cd D:\Projects\Notes_ai\ai-service
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

Open `http://127.0.0.1:5173/workspace`, sign in, and make sure at least one
PDF has status **Ready** and has been indexed in Qdrant Cloud.

## Try it in the workspace

1. Open the **Ask your documents** panel.
2. Ask a question answered by your uploaded PDF.
3. Confirm the answer shows source cards with the PDF name and page number.
4. Use a source card to open the private PDF through the existing authorized
   document route.
5. Ask an unrelated question. Confirm that the app says it lacks enough
   information and shows no source cards.
6. Select **New chat**, select an older conversation, and delete a conversation
   to see that history is private to your account.

## API routes

All browser routes require a valid Clerk session. The browser never sends an
owner ID; Express gets it from the verified session.

| Method and route | What it does |
| --- | --- |
| `POST /api/ai/chat` | Creates a conversation when needed, retrieves evidence, and saves the question and answer. |
| `GET /api/ai/conversations` | Lists only the signed-in user's conversations. |
| `GET /api/ai/conversations/:id` | Returns one owned conversation and its messages. |
| `DELETE /api/ai/conversations/:id` | Removes one owned conversation and its messages. |
| `POST /internal/answer-question` | Internal Express-to-FastAPI endpoint protected by `X-AI-Service-Token`. |

## Files to learn from

| File | Why it exists |
| --- | --- |
| `server/src/services/ragService.js` | Retrieves candidates, rechecks MongoDB ownership, stores chat history, and prepares verified context. |
| `server/src/services/aiServiceClient.js` | Sends the verified question and chunks from Express to FastAPI. |
| `ai-service/app/services/rag_service.py` | Builds the bounded Gemini prompt and generates the answer. |
| `server/src/models/Conversation.js` | Stores a private conversation heading and timestamps. |
| `server/src/models/Message.js` | Stores questions, answers, grounded state, and the source references used. |
| `client/src/RagChat.jsx` | Displays conversations, answers, source cards, loading, and errors. |

## Run the checks

From the project root:

```powershell
npm.cmd test
npm.cmd run build
```

From `ai-service`:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

The Node tests include ownership rechecking, weak-match abstention, and
conversation isolation/deletion. The Python tests verify the protected
internal question endpoint receives a question and rechecked context.
