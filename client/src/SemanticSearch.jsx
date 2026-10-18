import { createApiRequest } from './services/api.js';
import { useState } from 'react';

function scoreAsPercent(score) {
  return `${Math.round(Math.max(0, Math.min(1, score)) * 100)}% match`;
}

export default function SemanticSearch({ getToken }) {
  const [query, setQuery] = useState('');
  const [folderId, setFolderId] = useState('');
  const [tag, setTag] = useState('');
  const [sourceType, setSourceType] = useState('');
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState({ type: 'idle', message: '' });
  const [indexing, setIndexing] = useState(false);
  const [searching, setSearching] = useState(false);
  const [openingId, setOpeningId] = useState(null);

  const request = createApiRequest(getToken);

  async function indexSources() {
    setIndexing(true);
    setStatus({ type: 'loading', message: 'Creating embeddings for your notes and ready documents…' });
    try {
      const data = await request('/api/search/reindex', { method: 'POST' });
      setStatus({
        type: 'success',
        message: data.indexedCount
          ? `${data.indexedCount} private chunks indexed (${data.noteChunkCount} note, ${data.documentChunkCount} document).`
          : 'No note text or ready document chunks are available to index yet.',
      });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setIndexing(false);
    }
  }

  async function search(event) {
    event.preventDefault();
    if (!query.trim()) {
      setStatus({ type: 'error', message: 'Enter a question or phrase to search your notes and documents.' });
      return;
    }

    setSearching(true);
    setStatus({ type: 'loading', message: 'Finding related chunks by meaning…' });
    try {
      const parameters = new URLSearchParams({ query: query.trim() });
      if (folderId.trim()) parameters.set('folderId', folderId.trim());
      if (tag.trim()) parameters.set('tags', tag.trim());
      if (sourceType) parameters.set('sourceType', sourceType);
      const data = await request(`/api/search/semantic?${parameters.toString()}`);
      setResults(data.results);
      setStatus({ type: 'success', message: data.results.length ? `${data.results.length} related chunk${data.results.length === 1 ? '' : 's'} found.` : 'No related indexed chunks were found. Try different wording or index your sources first.' });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setSearching(false);
    }
  }

  async function openDocument(result) {
    setOpeningId(result.sourceId);
    try {
      const data = await request(`/api/documents/${result.sourceId}/open`);
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setOpeningId(null);
    }
  }

  return (
    <section className="mt-10 rounded-2xl border border-line bg-white p-6">
      <p className="text-sm text-muted">Phase 7 — semantic search</p>
      <h2 className="mt-2 font-display text-3xl">Search notes and documents by meaning</h2>
      <p className="mt-3 max-w-3xl text-muted">First index your saved notes and ready document chunks. Then ask in your own words; Qdrant compares their Gemini embeddings while keeping your account as a required search filter.</p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button className="rounded-xl bg-sage px-4 py-3 text-sm font-semibold text-forest disabled:opacity-60" type="button" onClick={indexSources} disabled={indexing}>
          {indexing ? 'Indexing…' : 'Index notes and documents'}
        </button>
        <p className="text-sm text-muted">Index again after saving note changes or processing a new document.</p>
      </div>

      <form className="mt-6 grid gap-4" onSubmit={search}>
        <label className="block font-medium" htmlFor="semantic-search-query">
          Ask a question or enter a concept
          <input id="semantic-search-query" value={query} maxLength="2000" className="mt-2 w-full rounded-lg border border-line px-3 py-2 font-normal" placeholder="How do information revolutions affect society?" onChange={(event) => setQuery(event.target.value)} />
        </label>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block font-medium" htmlFor="semantic-search-source">
            Source type
            <select id="semantic-search-source" value={sourceType} className="mt-2 w-full rounded-lg border border-line bg-white px-3 py-2 font-normal" onChange={(event) => setSourceType(event.target.value)}>
              <option value="">Notes and documents</option>
              <option value="note">Notes only</option>
              <option value="document">Documents only</option>
            </select>
          </label>
          <label className="block font-medium" htmlFor="semantic-search-folder">
            Folder filter (optional)
            <input id="semantic-search-folder" value={folderId} maxLength="100" className="mt-2 w-full rounded-lg border border-line px-3 py-2 font-normal" placeholder="Study" onChange={(event) => setFolderId(event.target.value)} />
          </label>
          <label className="block font-medium" htmlFor="semantic-search-tag">
            Tag filter (optional)
            <input id="semantic-search-tag" value={tag} maxLength="30" className="mt-2 w-full rounded-lg border border-line px-3 py-2 font-normal" placeholder="revision" onChange={(event) => setTag(event.target.value)} />
          </label>
        </div>
        <div><button className="rounded-xl bg-forest px-5 py-3 text-sm font-semibold text-white disabled:opacity-60" type="submit" disabled={searching}>{searching ? 'Searching…' : 'Search by meaning'}</button></div>
      </form>

      {status.message && <p role="status" className={`mt-5 rounded-lg p-3 text-sm ${status.type === 'error' ? 'bg-red-50 text-red-800' : status.type === 'success' ? 'bg-sage text-forest' : 'bg-paper text-muted'}`}>{status.message}</p>}

      {results.length > 0 && (
        <div className="mt-6 space-y-4" aria-live="polite">
          {results.map((result) => (
            <article className="rounded-xl border border-line p-4" key={result.chunkId}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-forest">{result.title}</h3>
                <span className="rounded-full bg-sage px-2 py-1 text-xs font-medium text-forest">{scoreAsPercent(result.score)}</span>
              </div>
              <p className="mt-2 text-sm text-muted">{result.sourceType === 'document' ? `Document · section ${result.pageNumber || 'unknown'}` : 'Note'} · chunk {result.position + 1}</p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-ink">{result.text}</p>
              {result.sourceType === 'document' && <button className="mt-4 text-sm font-semibold text-forest underline underline-offset-4 disabled:opacity-60" type="button" onClick={() => openDocument(result)} disabled={openingId === result.sourceId}>{openingId === result.sourceId ? 'Opening…' : 'Open private source document'}</button>}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
