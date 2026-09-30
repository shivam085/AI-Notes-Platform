# Phase 5: private PDF uploads

This phase stores the **original PDF** in Cloudinary and stores only its metadata in MongoDB. A metadata record includes the signed-in owner, file name, size, format, storage ID, optional folder/tags, and processing status.

Cloudinary is file storage. MongoDB is the database record that lets the app find the file and prove who owns it.

## 1. Create a Cloudinary account

1. Open [Cloudinary](https://cloudinary.com/) and create a free account.
2. In the Cloudinary Console, open **Settings → API Keys**.
3. Copy these three values into your local `server/.env` file. Do not put them in the client folder or in Git.

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

Keep the API secret private. The React browser never receives it. Express uses it only to store a PDF and create a short-lived private access link after it verifies the signed-in owner.

## 2. Restart the Express server

From the project folder, run:

```powershell
cd D:\Projects\Notes_ai\server
npm.cmd run dev
```

If an earlier Express server is already running, stop that terminal with `Ctrl+C` first. The Vite frontend and the FastAPI service do not need to restart for this configuration change.

## 3. Try the first real upload

1. Sign in at `http://127.0.0.1:5173/workspace`.
2. In **Phase 5 — private documents**, choose a small PDF with selectable text.
3. Click **Upload PDF**.
4. Confirm the PDF appears in the list, then try **Open**, **Download**, and **Delete**.

The first upload supports PDFs only, with a 10 MB limit. The server checks the file extension, declared MIME type, and the PDF header before it sends any bytes to Cloudinary. DOCX, TXT, and Markdown will be added after the PDF path is proven.

## Request flow

```text
React upload form
  → Express checks Clerk identity and the PDF
  → Cloudinary stores a private original
  → MongoDB stores metadata with the verified owner ID
  → React lists the safe metadata
```

When opening or downloading, React asks Express for an access link. Express first checks document ownership, then returns a Cloudinary link that expires after five minutes. A guessed MongoDB document ID from another account returns `404` and never produces a Cloudinary link.

## Commands worth remembering

```powershell
npm.cmd test --workspace server
npm.cmd run build --workspace client
```

The automated checks use a fake storage service, so they do not require your Cloudinary values or upload real files. They currently verify valid PDF upload/listing, rejected renamed files, and owner-only private access.
