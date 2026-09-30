import { useEffect, useState } from 'react';

function formatBytes(size) {
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value) {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '';
}

export default function DocumentsWorkspace({ getToken }) {
  const [documents, setDocuments] = useState([]);
  const [file, setFile] = useState(null);
  const [folderId, setFolderId] = useState('');
  const [tags, setTags] = useState('');
  const [status, setStatus] = useState({ type: 'loading', message: 'Loading your documents…' });
  const [uploading, setUploading] = useState(false);
  const [workingId, setWorkingId] = useState(null);

  async function request(path, options = {}) {
    const token = await getToken();
    if (!token) throw new Error('Your session ended. Please sign in again.');

    const headers = { Accept: 'application/json', Authorization: `Bearer ${token}`, ...options.headers };
    if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';

    const response = await fetch(path, { ...options, headers });
    if (response.status === 204) return null;
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'The request could not be completed.');
    return data;
  }

  async function loadDocuments() {
    setStatus({ type: 'loading', message: 'Loading your documents…' });
    try {
      const data = await request('/api/documents');
      setDocuments(data.documents);
      setStatus({ type: 'success', message: data.documents.length ? `${data.documents.length} document${data.documents.length === 1 ? '' : 's'} saved privately.` : 'No documents yet. Upload your first PDF.' });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    }
  }

  useEffect(() => { loadDocuments(); }, []);

  async function uploadDocument(event) {
    event.preventDefault();
    if (!file) {
      setStatus({ type: 'error', message: 'Choose a PDF file before uploading.' });
      return;
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.append('document', file);
      form.append('folderId', folderId);
      form.append('tags', tags);
      const data = await request('/api/documents', { method: 'POST', body: form });
      setDocuments((current) => [data.document, ...current]);
      setFile(null);
      setFolderId('');
      setTags('');
      event.currentTarget.reset();
      setStatus({ type: 'success', message: 'PDF uploaded privately. Text extraction arrives in the next phase.' });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setUploading(false);
    }
  }

  async function accessDocument(document, action) {
    setWorkingId(document._id);
    try {
      const data = await request(`/api/documents/${document._id}/${action}`);
      window.open(data.url, '_blank', 'noopener,noreferrer');
      setStatus({ type: 'success', message: action === 'open' ? 'Opening your private PDF…' : 'Starting your private download…' });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setWorkingId(null);
    }
  }

  async function deleteDocument(document) {
    if (!window.confirm(`Delete “${document.originalName}” from private storage? This cannot be undone.`)) return;
    setWorkingId(document._id);
    try {
      await request(`/api/documents/${document._id}`, { method: 'DELETE' });
      setDocuments((current) => current.filter((item) => item._id !== document._id));
      setStatus({ type: 'success', message: 'Document deleted.' });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <section className="mt-10 rounded-2xl border border-line bg-white p-6">
      <p className="text-sm text-muted">Phase 5 — private documents</p>
      <h2 className="mt-2 font-display text-3xl">Upload a PDF</h2>
      <p className="mt-3 max-w-3xl text-muted">Your file is checked by the server, stored privately, and linked only to your account. PDF text extraction and AI search come in later phases.</p>

      <form className="mt-6 grid gap-4" onSubmit={uploadDocument}>
        <label className="block font-medium" htmlFor="document-file">
          PDF file (maximum 10 MB)
          <input id="document-file" type="file" accept="application/pdf,.pdf" required className="mt-2 block w-full rounded-lg border border-line p-2 text-sm font-normal" onChange={(event) => setFile(event.target.files?.[0] || null)} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block font-medium" htmlFor="document-folder">
            Folder (optional)
            <input id="document-folder" maxLength="100" value={folderId} className="mt-2 w-full rounded-lg border border-line px-3 py-2 font-normal" placeholder="Study" onChange={(event) => setFolderId(event.target.value)} />
          </label>
          <label className="block font-medium" htmlFor="document-tags">
            Tags (optional)
            <input id="document-tags" value={tags} className="mt-2 w-full rounded-lg border border-line px-3 py-2 font-normal" placeholder="database, revision" onChange={(event) => setTags(event.target.value)} />
          </label>
        </div>
        <div><button className="rounded-xl bg-forest px-5 py-3 text-sm font-semibold text-white disabled:opacity-60" type="submit" disabled={uploading}>{uploading ? 'Uploading…' : 'Upload PDF'}</button></div>
      </form>

      <div role="status" className={`mt-6 rounded-lg p-3 text-sm ${status.type === 'error' ? 'bg-red-50 text-red-800' : 'bg-sage text-forest'}`}>{status.message}</div>

      <ul className="mt-5 space-y-3" aria-label="Saved documents">
        {documents.map((document) => (
          <li key={document._id} className="rounded-xl border border-line bg-paper p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold">{document.originalName}</h3>
                <p className="mt-1 text-sm text-muted">{formatBytes(document.size)} · {document.processingStatus} · Uploaded {formatDate(document.createdAt)}</p>
                {(document.folderId || document.tags?.length) && <p className="mt-1 text-xs text-muted">{document.folderId && `Folder: ${document.folderId}`}{document.folderId && document.tags?.length ? ' · ' : ''}{document.tags?.length ? `Tags: ${document.tags.join(', ')}` : ''}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="rounded-lg border border-forest px-3 py-2 text-sm font-semibold text-forest disabled:opacity-60" type="button" disabled={workingId === document._id} onClick={() => accessDocument(document, 'open')}>Open</button>
                <button className="rounded-lg border border-forest px-3 py-2 text-sm font-semibold text-forest disabled:opacity-60" type="button" disabled={workingId === document._id} onClick={() => accessDocument(document, 'download')}>Download</button>
                <button className="rounded-lg border border-red-700 px-3 py-2 text-sm font-semibold text-red-800 disabled:opacity-60" type="button" disabled={workingId === document._id} onClick={() => deleteDocument(document)}>Delete</button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
