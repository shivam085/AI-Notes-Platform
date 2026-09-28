import { useEffect, useMemo, useState } from 'react';

const emptyDraft = { title: '', content: '', folderId: '', tags: [] };

function tagsToText(tags = []) {
  return tags.join(', ');
}

function textToTags(value) {
  return value.split(',').map((tag) => tag.trim()).filter(Boolean);
}

function formatDate(value) {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '';
}

export default function NotesWorkspace({ getToken }) {
  const [notes, setNotes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState({ type: 'loading', message: 'Loading your notes…' });
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState('');
  const [summarizing, setSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState('');

  const selectedNote = useMemo(() => notes.find((note) => note._id === selectedId) || null, [notes, selectedId]);

  async function request(path, options = {}) {
    const token = await getToken();
    if (!token) throw new Error('Your session ended. Please sign in again.');
    const response = await fetch(path, {
      ...options,
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
    });
    if (response.status === 204) return null;
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'The request could not be completed.');
    return data;
  }

  async function loadNotes(query = '') {
    setStatus({ type: 'loading', message: 'Loading your notes…' });
    try {
      const data = await request(`/api/notes${query ? `?q=${encodeURIComponent(query)}` : ''}`);
      setNotes(data.notes);
      setStatus({ type: 'success', message: data.notes.length ? `${data.notes.length} note${data.notes.length === 1 ? '' : 's'} found.` : 'No notes yet. Create your first one.' });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    }
  }

  useEffect(() => { loadNotes(); }, []);

  function selectNote(note) {
    setSelectedId(note._id);
    setDraft({ title: note.title, content: note.content, folderId: note.folderId || '', tags: note.tags || [], version: note.version });
    setStatus({ type: 'idle', message: `Editing “${note.title}”.` });
    setSummary('');
    setSummaryError('');
  }

  function startNew() {
    setSelectedId(null);
    setDraft(emptyDraft);
    setStatus({ type: 'idle', message: 'New note. Add a title and save when ready.' });
    setSummary('');
    setSummaryError('');
  }

  async function saveNote(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = { title: draft.title, content: draft.content, folderId: draft.folderId, tags: draft.tags };
      const data = selectedNote
        ? await request(`/api/notes/${selectedNote._id}`, { method: 'PUT', body: JSON.stringify({ ...payload, version: draft.version }) })
        : await request('/api/notes', { method: 'POST', body: JSON.stringify(payload) });
      const note = data.note;
      setNotes((current) => [note, ...current.filter((item) => item._id !== note._id)].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)));
      setSelectedId(note._id);
      setDraft({ title: note.title, content: note.content, folderId: note.folderId || '', tags: note.tags || [], version: note.version });
      setStatus({ type: 'success', message: 'Note saved.' });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally { setSaving(false); }
  }

  async function deleteNote() {
    if (!selectedNote || !window.confirm(`Delete “${selectedNote.title}”? This cannot be undone.`)) return;
    setSaving(true);
    try {
      await request(`/api/notes/${selectedNote._id}`, { method: 'DELETE' });
      setNotes((current) => current.filter((note) => note._id !== selectedNote._id));
      startNew();
      setStatus({ type: 'success', message: 'Note deleted.' });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally { setSaving(false); }
  }

  async function submitSearch(event) {
    event.preventDefault();
    await loadNotes(search.trim());
  }

  async function summarizeNote() {
    if (!selectedNote) return;
    setSummarizing(true);
    setSummaryError('');
    try {
      const data = await request('/api/ai/summarize', { method: 'POST', body: JSON.stringify({ noteId: selectedNote._id }) });
      setSummary(data.summary);
    } catch (error) {
      setSummaryError(error.message);
    } finally { setSummarizing(false); }
  }

  return <section className="mt-10 grid gap-6 lg:grid-cols-[minmax(15rem,0.8fr)_minmax(0,1.7fr)]">
    <aside className="rounded-2xl border border-line bg-white p-5">
      <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-semibold">My notes</h2><button type="button" className="rounded-lg border border-forest px-3 py-2 text-sm font-semibold text-forest" onClick={startNew}>New note</button></div>
      <form className="mt-4 flex gap-2" onSubmit={submitSearch}><label className="sr-only" htmlFor="note-search">Search notes</label><input id="note-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search keyword" className="min-w-0 flex-1 rounded-lg border border-line px-3 py-2 text-sm"/><button className="rounded-lg bg-sage px-3 text-sm font-semibold text-forest" type="submit">Search</button></form>
      <button type="button" className="mt-2 text-sm text-muted underline" onClick={() => { setSearch(''); loadNotes(); }}>Show all</button>
      <div role="status" className={`mt-4 rounded-lg p-3 text-sm ${status.type === 'error' ? 'bg-red-50 text-red-800' : 'bg-sage text-forest'}`}>{status.message}</div>
      <ul className="mt-4 space-y-2" aria-label="Saved notes">{notes.map((note) => <li key={note._id}><button type="button" onClick={() => selectNote(note)} className={`w-full rounded-lg p-3 text-left ${selectedId === note._id ? 'bg-forest text-white' : 'bg-paper hover:bg-sage'}`}><strong className="block truncate">{note.title}</strong><span className="mt-1 block text-xs opacity-75">Updated {formatDate(note.updatedAt)}</span></button></li>)}</ul>
    </aside>
    <section className="rounded-2xl border border-line bg-white p-6">
      <p className="text-sm text-muted">Phase 3 — private notes</p><h1 className="mt-2 font-display text-3xl">{selectedNote ? 'Edit note' : 'Write a note'}</h1>
      <form className="mt-6 space-y-5" onSubmit={saveNote}>
        <label className="block font-medium" htmlFor="note-title">Title<input id="note-title" required maxLength="140" value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} className="mt-2 w-full rounded-lg border border-line px-3 py-2 font-normal" placeholder="For example: Database revision notes"/></label>
        <label className="block font-medium" htmlFor="note-content">Content<textarea id="note-content" required maxLength="50000" value={draft.content} onChange={(event) => setDraft((current) => ({ ...current, content: event.target.value }))} className="mt-2 min-h-72 w-full rounded-lg border border-line px-3 py-3 font-normal" placeholder="Write your note here…"/></label>
        <div className="grid gap-5 sm:grid-cols-2"><label className="block font-medium" htmlFor="note-folder">Folder (optional)<input id="note-folder" maxLength="100" value={draft.folderId} onChange={(event) => setDraft((current) => ({ ...current, folderId: event.target.value }))} className="mt-2 w-full rounded-lg border border-line px-3 py-2 font-normal" placeholder="Study"/></label><label className="block font-medium" htmlFor="note-tags">Tags (optional)<input id="note-tags" value={tagsToText(draft.tags)} onChange={(event) => setDraft((current) => ({ ...current, tags: textToTags(event.target.value) }))} className="mt-2 w-full rounded-lg border border-line px-3 py-2 font-normal" placeholder="database, revision"/></label></div>
        <div className="flex flex-wrap gap-3"><button className="rounded-xl bg-forest px-5 py-3 text-sm font-semibold text-white disabled:opacity-60" disabled={saving} type="submit">{saving ? 'Saving…' : 'Save note'}</button>{selectedNote && <><button className="rounded-xl border border-forest px-5 py-3 text-sm font-semibold text-forest disabled:opacity-60" disabled={saving || summarizing} type="button" onClick={summarizeNote}>{summarizing ? 'Summarizing…' : 'Summarize this note'}</button><button className="rounded-xl border border-red-700 px-5 py-3 text-sm font-semibold text-red-800 disabled:opacity-60" disabled={saving || summarizing} type="button" onClick={deleteNote}>Delete note</button></>}</div>
      </form>
      {selectedNote && <section className="mt-6 rounded-xl border border-sage bg-paper p-4" aria-live="polite"><h2 className="font-semibold text-forest">AI summary</h2><p className="mt-1 text-sm text-muted">This leaves your original note unchanged.</p>{summaryError && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{summaryError}</p>}{summary && <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-ink">{summary}</div>}{!summary && !summaryError && <p className="mt-3 text-sm text-muted">Save a note, then request a short summary here.</p>}</section>}
    </section>
  </section>;
}
