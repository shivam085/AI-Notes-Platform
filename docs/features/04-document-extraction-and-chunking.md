# Document text extraction and chunking

Reviewed against the local source on 25 October 2026. [Feature index](README.md).

## Purpose

An uploaded file is not yet searchable text. Extraction reads its contents; chunking breaks that text into smaller passages for later embeddings and retrieval. This feature deliberately follows the learning sequence: load → extract → split → save. It does not generate embeddings automatically.

## User and API flow

Select Extract text on an uploaded document, or Retry extraction after a failure. When ready, inspect the extracted text.

| Method and path | Behavior |
| --- | --- |
| `POST /api/documents/:id/process` | Start extraction and wait for completion |
| `POST /api/documents/:id/retry` | Same processing handler, for eligible saved state |
| `GET /api/documents/:id/text` | Return ready metadata plus `pages` |

Successful processing returns HTTP 200 with `{document}`; it does not return a queued-job 202. Extracted-text retrieval returns `{document: {...metadata, pages: [{pageNumber, text}]}}`.

## Step-by-step implementation

1. Express loads the user's document and atomically changes `uploaded` or `failed` to `processing`.
2. It records a fresh run ID, start time, and attempt count.
3. It creates a short-lived signed Cloudinary link and calls Python's `POST /internal/extract-document` with `source_url` and `format`.
4. Python checks the internal token, downloads the HTTPS file with a size bound, and creates a temporary local file.
5. A LangChain loader reads the file; temporary files are removed afterward.
6. Extracted text is normalized, empty pages are skipped, and the total text limit is checked.
7. `RecursiveCharacterTextSplitter` splits each page/section separately.
8. Express replaces the document's KnowledgeChunk records and stores extracted pages on Document.
9. Completion checks the run ID before marking the document `ready`.

The deprecated `/internal/extract-pdf` URL remains an alias. Its shared request defaults to PDF.

## Loaders and chunk metadata

| Format | Loader | Source numbering |
| --- | --- | --- |
| PDF | PyPDFLoader in page mode | Original PDF page number, starting at 1 |
| DOCX | Docx2txtLoader | Section 1 for the current single-document loader output |
| TXT / Markdown | TextLoader with UTF-8 | Section 1 |

Current settings use a maximum of 500,000 extracted characters, chunks of up to 2,000 characters, and 200 characters of overlap. These are character limits, not token counts. The recursive splitter prefers natural separators such as paragraphs and lines before smaller separators.

Overlap keeps some boundary context available in adjacent chunks; the exact overlap can vary with split boundaries. Each chunk has a zero-based position, source ID/type, owner, page number, and text. A unique compound index identifies owner + source type + source ID + position.

Example: a PDF's third page can produce several chunks, all with `pageNumber: 3`. This enables a later answer to point back to that page. DOCX section numbering should not be described as original Word pagination.

## States, retries, and errors

Normal state: `uploaded → processing → ready`. Failure state: `processing → failed`. Already-processing or ready documents cannot be processed again through this route and return 409.

The extraction HTTP call has a 30-second timeout. The processing service retries `AiServiceUnavailableError` once after a short backoff; it does not retry extraction input errors. Python uses a 20-second download timeout. A readable-file error becomes 422; configuration and service failures use 503/502 where mapped by the Express controller.

The UI polls every two seconds when a saved list item is in `processing`. Startup recovery is separate from the original request; see [reliability](13-recovery-deletion-and-failure-handling.md).

## Limits and next step

Image-only scanned PDFs are rejected because OCR is not implemented. Markdown is loaded as text, not interpreted as a rich document. Headings are not converted into a section tree. The process runs through the current Express/Python services rather than a durable distributed queue.

After extraction, select Index notes and documents. A `ready` state proves extracted text/chunks exist, not that Qdrant already has vectors.

## Important implementation files

- [documentProcessingService.js](D:/Projects/Notes_ai/server/src/services/documentProcessingService.js): orchestration and bounded retries.
- [documentService.js](D:/Projects/Notes_ai/server/src/services/documentService.js): guarded state transitions.
- [knowledgeChunkService.js](D:/Projects/Notes_ai/server/src/services/knowledgeChunkService.js) and [KnowledgeChunk.js](D:/Projects/Notes_ai/server/src/models/KnowledgeChunk.js): chunk validation/storage.
- [pdf_extraction_service.py](D:/Projects/Notes_ai/ai-service/app/services/pdf_extraction_service.py): all four loaders despite the historical filename.
- [text_chunking.py](D:/Projects/Notes_ai/ai-service/app/services/text_chunking.py): shared recursive splitting.
- [main.py](D:/Projects/Notes_ai/ai-service/app/main.py): extraction HTTP endpoints.

## Verification and interview notes

Existing coverage: [documents.test.js](D:/Projects/Notes_ai/server/test/documents.test.js), [documentReliability.test.js](D:/Projects/Notes_ai/server/test/documentReliability.test.js), and [test_app.py](D:/Projects/Notes_ai/ai-service/tests/test_app.py), including real PDF/TXT/DOCX loaders, page metadata, overlap, and scanned-PDF errors.

Manual check to perform: extract a multipage text PDF, inspect page labels, then try an image-only PDF. Confirm extraction succeeds independently of vector indexing.

**Interview takeaway:** “Chunking makes long documents manageable for retrieval. I keep page metadata and a little overlap so retrieved passages remain understandable and traceable.”
