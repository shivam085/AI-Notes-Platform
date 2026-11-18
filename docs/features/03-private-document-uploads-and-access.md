# Private document uploads, opening, and downloading

Reviewed against the local source on 25 October 2026. [Feature index](README.md).

## Purpose and user flow

Upload study material, keep it private, and open or download it later. The supported formats are PDF, DOCX, TXT, and Markdown (`.md` or `.markdown`). Uploading stores the original file; extraction and semantic indexing are separate actions.

Choose a file in Documents, optionally enter folder/tags, and upload. The list shows the saved file and processing state. Open or Download requests a temporary signed access URL after another ownership check.

## Upload flow

1. The browser submits `FormData` with one file field named `document`.
2. The shared client helper adds the Clerk token and lets the browser set the multipart boundary.
3. Multer holds the bounded upload in memory; Express validates extension, declared MIME type, size, and basic bytes.
4. Cloudinary receives a private raw asset with a generated UUID and an owner-specific folder.
5. MongoDB stores metadata and the Cloudinary public ID, not the original file bytes.
6. The response returns safe document metadata with processing state `uploaded`.
7. If metadata creation fails after upload, the controller attempts to remove the uploaded asset.

## API contract

| Method and path | Input | Success |
| --- | --- | --- |
| `POST /api/documents` | Multipart document, optional folderId/tags | 201, `{document}` |
| `GET /api/documents` | None | 200, `{documents}` |
| `GET /api/documents/:id/open` | Document ID | 200, `{url}` |
| `GET /api/documents/:id/download` | Document ID | 200, `{url}` |
| `PATCH /api/documents/:id` | `{"tags":["database"]}` | 200, `{document}` |
| `DELETE /api/documents/:id` | Document ID | 204 complete, or 202 cleanup pending |

The PATCH endpoint updates tags only. Upload tags may be comma-separated multipart text; PATCH requires an array. Folder metadata is supplied during upload; there is no document-folder update endpoint.

## Validation and storage

The file must be nonempty and at most 10 MiB (10 × 1024 × 1024 bytes; the UI calls this 10 MB). The accepted MIME values are explicit in the service.

PDF validation checks `%PDF-`; DOCX checks the ZIP prefix; TXT/Markdown must be valid UTF-8 without null bytes. These are basic admission checks, not full format parsing, malware scanning, or proof that extraction will succeed. A damaged DOCX can pass the ZIP-prefix check and fail in the loader.

Document metadata includes owner, original name, format, MIME type, size, storage ID, folder/tags, timestamps, and processing/deletion state. Names are bounded by the model to 180 characters. Tags allow up to 10 unique lowercase values, each at most 30 characters.

## Signed access URLs

Both access routes first load a nondeleted document with the verified owner ID. Cloudinary signs a private download URL with an expiry of 300 seconds. The download route requests attachment delivery; the open route does not. Browser behavior still depends on the file format and browser capabilities.

The signed link is a temporary capability: someone holding it may use it while it remains valid. Do not put it in permanent public documentation. A fresh ownership check is required to obtain a new link.

## Configuration and failures

Express needs `MONGODB_URI`, Clerk configuration, and `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`. Upload/open do not need an LLM generation key. Deletion also attempts vector cleanup, which can remain pending if the AI/Qdrant path is unavailable.

Invalid upload: 400. Missing or other-user document: 404. Missing storage configuration: 503. Storage service error: 502. Deletion details are in [recovery and cleanup](13-recovery-deletion-and-failure-handling.md).

## Important implementation files

- [DocumentsWorkspace.jsx](D:/Projects/Notes_ai/client/src/DocumentsWorkspace.jsx): upload and access UI.
- [documents.routes.js](D:/Projects/Notes_ai/server/src/routes/documents.routes.js): Multer and routes.
- [documentsController.js](D:/Projects/Notes_ai/server/src/controllers/documentsController.js): upload compensation and access responses.
- [documentService.js](D:/Projects/Notes_ai/server/src/services/documentService.js): upload rules and ownership.
- [cloudinaryDocumentStorage.js](D:/Projects/Notes_ai/server/src/services/cloudinaryDocumentStorage.js): private upload, signing, destruction.
- [Document.js](D:/Projects/Notes_ai/server/src/models/Document.js): metadata schema.

## Verification and interview notes

Existing coverage: [documents.test.js](D:/Projects/Notes_ai/server/test/documents.test.js) covers file validation, owned uploads/listing, signed access, tag updates, and deletion. [clientApi.test.js](D:/Projects/Notes_ai/server/test/clientApi.test.js) checks multipart headers.

Manual check to perform: upload a small file of each format, open/download it, try an unsupported extension and renamed non-PDF, and verify another account cannot request its URL.

**Interview takeaway:** “Cloudinary stores private file bytes; MongoDB stores metadata. I validate the upload and verify ownership before issuing a short-lived signed URL.”
