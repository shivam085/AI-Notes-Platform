# Phase 6: extract PDF text and create chunks

This phase turns a privately stored PDF into two useful kinds of data:

- **Extracted pages:** the readable text, kept with its original PDF page number so you can inspect it.
- **Chunks:** smaller overlapping pieces of that text. These are stored separately and will become the inputs for embeddings, semantic search, and RAG in later phases.

Cloudinary still stores the original file. MongoDB stores the document record, extracted pages, and chunk records. FastAPI does the PDF reading because the Python code will also own the later AI/document-processing steps.

## 1. Refresh the Python environment

From the project folder, run:

```powershell
cd D:\Projects\Notes_ai\ai-service
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

This phase adds `langchain-community` for `PyPDFLoader` and `langchain-text-splitters` for `RecursiveCharacterTextSplitter`. `pypdf` remains the PDF parser underneath the loader. This follows the course sequence: load a PDF into page `Document` objects, then split those documents into chunks. It reads selectable text already present in PDF pages; it does **not** perform OCR on image-only scanned pages.

If PowerShell cannot find `python` after activation, run the virtual-environment interpreter directly:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

## 2. Start all three local services

Open three terminals:

```powershell
# Terminal 1 — React and Express together
cd D:\Projects\Notes_ai
npm.cmd run dev
```

```powershell
# Terminal 2 — FastAPI document processing service
cd D:\Projects\Notes_ai\ai-service
.\.venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --reload
```

The FastAPI service uses the existing `AI_SERVICE_TOKEN` value in its local `.env`. It must match the value in `server/.env`; do not put it in React or Git.

## 3. Verify the feature in the browser

1. Open `http://127.0.0.1:5173/workspace` and sign in.
2. Upload a small, text-based PDF, or use one you already uploaded.
3. Select **Extract text**.
4. Confirm the document reaches **ready**, shows its chunk count, and opens **View extracted text**.
5. Check that each displayed section has the same page number as the source PDF.
6. Try an image-only scan or damaged PDF. It should become **failed** with a clear message. **Retry extraction** is for a temporary processing failure; delete an unsupported PDF and upload a text-based replacement.

## Request flow

```text
React: Extract text
  → Express verifies the Clerk user owns the document
  → Express creates a short-lived private Cloudinary link
  → FastAPI downloads that link and PyPDFLoader creates one LangChain Document per PDF page
  → RecursiveCharacterTextSplitter splits each page into 2,000-character chunks with 200-character overlap
  → Express saves extracted pages on Document and chunks in KnowledgeChunk
  → React shows the page-aware text
```

The browser never receives the Cloudinary API secret, the FastAPI service token, or the original database ownership query.

## Configuration to remember

- A PDF can be at most **10 MB**.
- The first chunk settings are **2,000 characters** with **200 characters of overlap**.
- A chunk stays within one PDF page. This makes a later search result easy to trace back to the page that produced it.
- PDFs with no selectable text fail clearly. OCR is intentionally out of scope for V1.

## Automated checks

```powershell
cd D:\Projects\Notes_ai
npm.cmd test --workspace server
npm.cmd run build --workspace client

cd ai-service
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

The backend tests use fake Cloudinary and FastAPI clients, so they do not upload a real file. The FastAPI suite checks token protection, page-aware responses, clear scan errors, real `PyPDFLoader` parsing of a small text PDF, and `RecursiveCharacterTextSplitter` overlap while retaining page metadata.
