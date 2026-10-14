import { useEffect, useMemo, useState } from 'react';

function formatDate(value) {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '';
}

function shuffledOrder(length) {
  const order = Array.from({ length }, (_, index) => index);
  for (let index = order.length - 1; index > 0; index -= 1) {
    const replacementIndex = Math.floor(Math.random() * (index + 1));
    [order[index], order[replacementIndex]] = [order[replacementIndex], order[index]];
  }
  return order;
}

export default function Flashcards({ getToken }) {
  const [notes, setNotes] = useState([]);
  const [studySets, setStudySets] = useState([]);
  const [noteId, setNoteId] = useState('');
  const [preview, setPreview] = useState(null);
  const [selectedSet, setSelectedSet] = useState(null);
  const [cardOrder, setCardOrder] = useState([]);
  const [cardPosition, setCardPosition] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [status, setStatus] = useState({ type: 'loading', message: 'Loading flashcards…' });
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  const currentCard = useMemo(() => {
    if (!selectedSet || !cardOrder.length) return null;
    return selectedSet.cards[cardOrder[cardPosition]];
  }, [selectedSet, cardOrder, cardPosition]);

  async function request(path, options = {}) {
    const token = await getToken();
    if (!token) throw new Error('Your session ended. Please sign in again.');

    const response = await fetch(path, {
      ...options,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    });

    if (response.status === 204) return null;
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'The request could not be completed.');
    return data;
  }

  async function loadInitialData() {
    setStatus({ type: 'loading', message: 'Loading flashcards…' });
    try {
      const [notesData, studySetsData] = await Promise.all([
        request('/api/notes'),
        request('/api/study/flashcards'),
      ]);
      setNotes(notesData.notes);
      setStudySets(studySetsData.studySets);
      setStatus({ type: 'idle', message: notesData.notes.length ? 'Choose a saved note to create five study cards.' : 'Create a note before generating flashcards.' });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    }
  }

  useEffect(() => { loadInitialData(); }, []);

  function selectStudySet(studySet) {
    setSelectedSet(studySet);
    setCardOrder(Array.from({ length: studySet.cards.length }, (_, index) => index));
    setCardPosition(0);
    setShowAnswer(false);
    setPreview(null);
    setStatus({ type: 'idle', message: `Studying “${studySet.title}”.` });
  }

  async function generateFlashcards() {
    if (!noteId) {
      setStatus({ type: 'error', message: 'Choose a saved note first.' });
      return;
    }

    setGenerating(true);
    try {
      const data = await request('/api/study/flashcards/generate', {
        method: 'POST',
        body: JSON.stringify({ noteId }),
      });
      setPreview(data);
      setSelectedSet(null);
      setStatus({ type: 'success', message: 'Five flashcards are ready for review. Save them to keep the deck.' });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setGenerating(false);
    }
  }

  async function saveFlashcards() {
    if (!preview) return;

    setSaving(true);
    try {
      const data = await request('/api/study/flashcards', {
        method: 'POST',
        body: JSON.stringify({ noteId: preview.noteId, cards: preview.cards }),
      });
      setStudySets((current) => [data.studySet, ...current]);
      selectStudySet(data.studySet);
      setStatus({ type: 'success', message: 'Flashcard deck saved.' });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setSaving(false);
    }
  }

  async function openStudySet(studySetId) {
    try {
      const data = await request(`/api/study/flashcards/${studySetId}`);
      selectStudySet(data.studySet);
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    }
  }

  async function deleteStudySet() {
    if (!selectedSet || !window.confirm(`Delete “${selectedSet.title}”? This cannot be undone.`)) return;

    setSaving(true);
    try {
      await request(`/api/study/flashcards/${selectedSet._id}`, { method: 'DELETE' });
      setStudySets((current) => current.filter((studySet) => studySet._id !== selectedSet._id));
      setSelectedSet(null);
      setCardOrder([]);
      setStatus({ type: 'success', message: 'Flashcard deck deleted.' });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setSaving(false);
    }
  }

  function showNextCard(direction) {
    if (!cardOrder.length) return;
    setCardPosition((current) => (current + direction + cardOrder.length) % cardOrder.length);
    setShowAnswer(false);
  }

  function shuffleCards() {
    setCardOrder(shuffledOrder(cardOrder.length));
    setCardPosition(0);
    setShowAnswer(false);
  }

  return (
    <section className="mt-10 grid gap-6 lg:grid-cols-[minmax(15rem,0.8fr)_minmax(0,1.7fr)]">
      <aside className="rounded-2xl border border-line bg-white p-5">
        <h2 className="text-xl font-semibold">Saved flashcards</h2>
        <p className="mt-2 text-sm text-muted">Each deck belongs only to your account.</p>
        <div role="status" className={`mt-4 rounded-lg p-3 text-sm ${status.type === 'error' ? 'bg-red-50 text-red-800' : 'bg-sage text-forest'}`}>{status.message}</div>
        <ul className="mt-4 space-y-2" aria-label="Saved flashcard decks">
          {studySets.map((studySet) => (
            <li key={studySet._id}>
              <button type="button" onClick={() => openStudySet(studySet._id)} className={`w-full rounded-lg p-3 text-left ${selectedSet?._id === studySet._id ? 'bg-forest text-white' : 'bg-paper hover:bg-sage'}`}>
                <strong className="block truncate">{studySet.title}</strong>
                <span className="mt-1 block text-xs opacity-75">{studySet.cardCount} cards · {formatDate(studySet.updatedAt)}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="rounded-2xl border border-line bg-white p-6">
        <p className="text-sm text-muted">Phase 9 — private study tools</p>
        <h1 className="mt-2 font-display text-3xl">Flashcards</h1>
        <p className="mt-3 text-muted">Generate five cards from a saved note, then review them before you save a private study deck.</p>

        <div className="mt-6 rounded-xl border border-sage bg-paper p-4">
          <label className="block font-medium" htmlFor="flashcard-note">
            Saved note
            <select id="flashcard-note" value={noteId} onChange={(event) => setNoteId(event.target.value)} className="mt-2 w-full rounded-lg border border-line bg-white px-3 py-2 font-normal">
              <option value="">Choose a note</option>
              {notes.map((note) => <option key={note._id} value={note._id}>{note.title}</option>)}
            </select>
          </label>
          <button type="button" className="mt-4 rounded-xl bg-forest px-5 py-3 text-sm font-semibold text-white disabled:opacity-60" disabled={generating || !notes.length} onClick={generateFlashcards}>{generating ? 'Creating flashcards…' : 'Generate 5 flashcards'}</button>
        </div>

        {preview && (
          <section className="mt-6 rounded-xl border border-sage bg-paper p-4" aria-live="polite">
            <h2 className="font-semibold text-forest">Review generated cards</h2>
            <p className="mt-1 text-sm text-muted">Review these cards before saving the deck for “{preview.noteTitle}”.</p>
            <ol className="mt-4 space-y-3">
              {preview.cards.map((card, index) => (
                <li key={card.question} className="rounded-lg bg-white p-3 text-sm">
                  <strong>{index + 1}. {card.question}</strong>
                  <p className="mt-1 text-muted">{card.answer}</p>
                </li>
              ))}
            </ol>
            <div className="mt-4 flex flex-wrap gap-3">
              <button type="button" className="rounded-lg bg-forest px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={saving} onClick={saveFlashcards}>{saving ? 'Saving…' : 'Save flashcard deck'}</button>
              <button type="button" className="rounded-lg border border-forest px-4 py-2 text-sm font-semibold text-forest disabled:opacity-60" disabled={generating || saving} onClick={generateFlashcards}>Regenerate</button>
            </div>
          </section>
        )}

        {selectedSet && currentCard && (
          <section className="mt-6 rounded-xl border border-sage bg-paper p-5" aria-live="polite">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-forest">{selectedSet.title}</h2>
                <p className="mt-1 text-sm text-muted">Card {cardPosition + 1} of {cardOrder.length}</p>
              </div>
              <button type="button" className="rounded-lg border border-red-700 px-3 py-2 text-sm font-semibold text-red-800 disabled:opacity-60" disabled={saving} onClick={deleteStudySet}>Delete deck</button>
            </div>
            <button type="button" className="mt-5 min-h-48 w-full rounded-xl border border-forest bg-white p-6 text-left" onClick={() => setShowAnswer((current) => !current)}>
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">{showAnswer ? 'Answer' : 'Question'} · Select to flip</span>
              <p className="mt-4 text-lg leading-8">{showAnswer ? currentCard.answer : currentCard.question}</p>
            </button>
            <div className="mt-4 flex flex-wrap gap-3">
              <button type="button" className="rounded-lg border border-forest px-4 py-2 text-sm font-semibold text-forest" onClick={() => showNextCard(-1)}>Previous</button>
              <button type="button" className="rounded-lg border border-forest px-4 py-2 text-sm font-semibold text-forest" onClick={() => setShowAnswer((current) => !current)}>Flip card</button>
              <button type="button" className="rounded-lg border border-forest px-4 py-2 text-sm font-semibold text-forest" onClick={() => showNextCard(1)}>Next</button>
              <button type="button" className="rounded-lg border border-forest px-4 py-2 text-sm font-semibold text-forest" onClick={shuffleCards}>Shuffle</button>
            </div>
          </section>
        )}
      </section>
    </section>
  );
}
