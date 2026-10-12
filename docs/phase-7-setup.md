# Phase 7: Gemini embeddings, Qdrant, and semantic PDF search

Phase 7 makes the extracted PDF text from Phase 6 searchable by **meaning**.

## The simple idea

An **embedding** is a list of numbers that represents the meaning of text. Gemini creates one for every saved PDF chunk and one for a search question. **Qdrant** stores those number lists and finds the chunks nearest to the question's list.

This lets a question such as “How do communication technologies affect society?” find a chunk about information revolutions even when the wording is different.

```text
Signed-in browser
  → Express verifies the Clerk user
  → FastAPI asks Gemini for embeddings
  → Qdrant searches only that user's vectors
  → React shows the chunk, page number, score, and private PDF link
```

## What was built

- `POST /api/search/reindex` indexes every ready PDF chunk that belongs to the signed-in user.
- `GET /api/search/semantic` accepts a question plus optional folder/tag filters.
- FastAPI keeps the internal-only endpoints `POST /internal/index-chunks` and `POST /internal/semantic-search` behind `X-AI-Service-Token`.
- `QdrantVectorStore` stores the chunk text plus owner, source, title, page, folder, and tag payload. The owner is a required Qdrant filter for every search.
- The workspace has **Index ready PDFs** and **Search by meaning** controls. Results show matching text, its PDF page, a similarity score, and an authorized source link.

## Qdrant Cloud setup

Install the Python requirements after pulling this phase:

```powershell
cd D:\Projects\Notes_ai\ai-service
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Create a free Qdrant Cloud cluster, then copy its cluster URL and Database API key into `ai-service/.env`:

```env
QDRANT_URL=https://your-cluster.cloud.qdrant.io
QDRANT_API_KEY=your-qdrant-cloud-api-key
QDRANT_COLLECTION=ai_notes_chunks
```

The AI service uses Qdrant Cloud only. It cannot index or search until both values are configured. Do not commit the API key. The collection name, Gemini embedding model, and vector dimensions must stay compatible with existing vectors.

## Run the three local services

Terminal 1, from `D:\Projects\Notes_ai`:

```powershell
npm.cmd run dev
```

Terminal 2, from `D:\Projects\Notes_ai\ai-service`:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

Open `http://127.0.0.1:5173/workspace`, sign in, and make sure you already have a PDF with **ready** extracted text.

## Verify the flow

1. Select **Index ready PDFs**. Gemini creates one 768-number document embedding per saved chunk and Qdrant stores it.
2. Enter a question using wording from the PDF only as a guide, or use different wording.
3. Select **Search by meaning**.
4. Check that every result has a PDF title, matching text, page number, and **Open private source PDF** link.
5. Try an optional folder or tag filter.

The index button is safe to run again: the app replaces vectors for the same document source instead of creating duplicate vector points.

## Tests

Run the backend and Python checks:

```powershell
cd D:\Projects\Notes_ai
npm.cmd test
npm.cmd run build

cd ai-service
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

The Node tests verify that Clerk supplies the owner ID and another user's chunks are never sent for indexing or search. The Python tests use an isolated in-memory Qdrant test client to verify that the owner filter returns only the requested user's vector; production requests always use Qdrant Cloud.

## What to remember

- **Embedding:** numbers representing text meaning; it is not a generated answer.
- **Vector search:** comparing those numbers to rank relevant chunks.
- **Qdrant payload:** source facts stored beside a vector, such as `ownerId` and `pageNumber`.
- **Owner filter:** a hard Qdrant search condition, so other users' vectors are excluded before results return.
- **Reindexing:** make new embeddings when chunk text, the model, or vector dimensions change.

Phase 8 will reuse these owner-filtered chunks for RAG: retrieve relevant text first, then send only that focused context and the user's question to Gemini.
