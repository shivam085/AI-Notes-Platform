import { createApiRequest } from './services/api.js';
import { useEffect, useState } from 'react';

function formatDate(value) {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '';
}

export default function Quiz({ getToken }) {
  const [notes, setNotes] = useState([]);
  const [studySets, setStudySets] = useState([]);
  const [noteId, setNoteId] = useState('');
  const [preview, setPreview] = useState(null);
  const [selectedSet, setSelectedSet] = useState(null);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [status, setStatus] = useState({ type: 'loading', message: 'Loading quizzes…' });
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  const request = createApiRequest(getToken);

  async function loadInitialData() {
    setStatus({ type: 'loading', message: 'Loading quizzes…' });
    try {
      const [notesData, studySetsData] = await Promise.all([
        request('/api/notes'),
        request('/api/study/quizzes'),
      ]);
      setNotes(notesData.notes);
      setStudySets(studySetsData.studySets);
      setStatus({ type: 'idle', message: notesData.notes.length ? 'Choose a saved note to create five quiz questions.' : 'Create a note before generating a quiz.' });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    }
  }

  useEffect(() => { loadInitialData(); }, []);

  function selectStudySet(studySet) {
    setSelectedSet(studySet);
    setPreview(null);
    setAnswers({});
    setSubmitted(false);
    setStatus({ type: 'idle', message: `Taking “${studySet.title}”.` });
  }

  async function generateQuiz() {
    if (!noteId) {
      setStatus({ type: 'error', message: 'Choose a saved note first.' });
      return;
    }

    setGenerating(true);
    try {
      const data = await request('/api/study/quizzes/generate', {
        method: 'POST',
        body: JSON.stringify({ noteId }),
      });
      setPreview(data);
      setSelectedSet(null);
      setStatus({ type: 'success', message: 'Five quiz questions are ready for review. Save them to keep the quiz.' });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setGenerating(false);
    }
  }

  async function saveQuiz() {
    if (!preview) return;

    setSaving(true);
    try {
      const data = await request('/api/study/quizzes', {
        method: 'POST',
        body: JSON.stringify({ noteId: preview.noteId, questions: preview.questions }),
      });
      setStudySets((current) => [data.studySet, ...current]);
      selectStudySet(data.studySet);
      setStatus({ type: 'success', message: 'Quiz saved.' });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setSaving(false);
    }
  }

  async function openStudySet(studySetId) {
    try {
      const data = await request(`/api/study/quizzes/${studySetId}`);
      selectStudySet(data.studySet);
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    }
  }

  async function deleteStudySet() {
    if (!selectedSet || !window.confirm(`Delete “${selectedSet.title}”? This cannot be undone.`)) return;

    setSaving(true);
    try {
      await request(`/api/study/quizzes/${selectedSet._id}`, { method: 'DELETE' });
      setStudySets((current) => current.filter((studySet) => studySet._id !== selectedSet._id));
      setSelectedSet(null);
      setAnswers({});
      setSubmitted(false);
      setStatus({ type: 'success', message: 'Quiz deleted.' });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setSaving(false);
    }
  }

  function chooseAnswer(questionIndex, optionIndex) {
    if (submitted) return;
    setAnswers((current) => ({ ...current, [questionIndex]: optionIndex }));
  }

  function submitQuiz() {
    if (!selectedSet) return;
    if (Object.keys(answers).length !== selectedSet.questions.length) {
      setStatus({ type: 'error', message: 'Choose one answer for every question before checking your score.' });
      return;
    }
    setSubmitted(true);
    setStatus({ type: 'success', message: 'Your answers have been checked. Read each explanation to review the topic.' });
  }

  const score = selectedSet && submitted
    ? selectedSet.questions.reduce((total, question, index) => total + (answers[index] === question.correctOptionIndex ? 1 : 0), 0)
    : null;

  return (
    <section className="mt-10 grid gap-6 lg:grid-cols-[minmax(15rem,0.8fr)_minmax(0,1.7fr)]">
      <aside className="rounded-2xl border border-line bg-white p-5">
        <h2 className="text-xl font-semibold">Saved quizzes</h2>
        <p className="mt-2 text-sm text-muted">Each quiz belongs only to your account.</p>
        <div role="status" className={`mt-4 rounded-lg p-3 text-sm ${status.type === 'error' ? 'bg-red-50 text-red-800' : 'bg-sage text-forest'}`}>{status.message}</div>
        <ul className="mt-4 space-y-2" aria-label="Saved quizzes">
          {studySets.map((studySet) => (
            <li key={studySet._id}>
              <button type="button" onClick={() => openStudySet(studySet._id)} className={`w-full rounded-lg p-3 text-left ${selectedSet?._id === studySet._id ? 'bg-forest text-white' : 'bg-paper hover:bg-sage'}`}>
                <strong className="block truncate">{studySet.title}</strong>
                <span className="mt-1 block text-xs opacity-75">{studySet.questionCount} questions · {formatDate(studySet.updatedAt)}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="rounded-2xl border border-line bg-white p-6">
        <p className="text-sm text-muted">Phase 9 — private study tools</p>
        <h1 className="mt-2 font-display text-3xl">Quizzes</h1>
        <p className="mt-3 text-muted">Generate five multiple-choice questions from a saved note, then review and save a private quiz.</p>

        <div className="mt-6 rounded-xl border border-sage bg-paper p-4">
          <label className="block font-medium" htmlFor="quiz-note">
            Saved note
            <select id="quiz-note" value={noteId} onChange={(event) => setNoteId(event.target.value)} className="mt-2 w-full rounded-lg border border-line bg-white px-3 py-2 font-normal">
              <option value="">Choose a note</option>
              {notes.map((note) => <option key={note._id} value={note._id}>{note.title}</option>)}
            </select>
          </label>
          <button type="button" className="mt-4 rounded-xl bg-forest px-5 py-3 text-sm font-semibold text-white disabled:opacity-60" disabled={generating || !notes.length} onClick={generateQuiz}>{generating ? 'Creating quiz…' : 'Generate 5 questions'}</button>
        </div>

        {preview && (
          <section className="mt-6 rounded-xl border border-sage bg-paper p-4" aria-live="polite">
            <h2 className="font-semibold text-forest">Review generated quiz</h2>
            <p className="mt-1 text-sm text-muted">Review the questions, correct answers, and explanations before saving “{preview.noteTitle}”.</p>
            <ol className="mt-4 space-y-4">
              {preview.questions.map((question, index) => (
                <li key={index} className="rounded-lg bg-white p-4 text-sm">
                  <strong>{index + 1}. {question.question}</strong>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
                    {question.options.map((option, optionIndex) => <li key={option} className={optionIndex === question.correctOptionIndex ? 'font-semibold text-forest' : ''}>{option}</li>)}
                  </ul>
                  <p className="mt-2 text-muted"><strong className="text-ink">Explanation:</strong> {question.explanation}</p>
                </li>
              ))}
            </ol>
            <div className="mt-4 flex flex-wrap gap-3">
              <button type="button" className="rounded-lg bg-forest px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={saving} onClick={saveQuiz}>{saving ? 'Saving…' : 'Save quiz'}</button>
              <button type="button" className="rounded-lg border border-forest px-4 py-2 text-sm font-semibold text-forest disabled:opacity-60" disabled={generating || saving} onClick={generateQuiz}>Regenerate</button>
            </div>
          </section>
        )}

        {selectedSet && (
          <section className="mt-6 rounded-xl border border-sage bg-paper p-5" aria-live="polite">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-forest">{selectedSet.title}</h2>
                <p className="mt-1 text-sm text-muted">Choose an answer for every question, then check your score.</p>
              </div>
              <button type="button" className="rounded-lg border border-red-700 px-3 py-2 text-sm font-semibold text-red-800 disabled:opacity-60" disabled={saving} onClick={deleteStudySet}>Delete quiz</button>
            </div>

            {score !== null && <p className="mt-5 rounded-lg bg-white p-3 font-semibold text-forest">Score: {score} / {selectedSet.questions.length}</p>}

            <ol className="mt-5 space-y-6">
              {selectedSet.questions.map((question, questionIndex) => (
                <li key={questionIndex} className="rounded-xl bg-white p-4">
                  <p className="font-semibold">{questionIndex + 1}. {question.question}</p>
                  <div className="mt-3 grid gap-2">
                    {question.options.map((option, optionIndex) => {
                      const selected = answers[questionIndex] === optionIndex;
                      const resultClass = submitted && optionIndex === question.correctOptionIndex
                        ? 'border-forest bg-sage'
                        : submitted && selected ? 'border-red-700 bg-red-50' : 'border-line bg-paper';
                      return (
                        <label key={option} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm ${resultClass}`}>
                          <input type="radio" name={`quiz-${questionIndex}`} checked={selected} disabled={submitted} onChange={() => chooseAnswer(questionIndex, optionIndex)} />
                          <span>{option}</span>
                        </label>
                      );
                    })}
                  </div>
                  {submitted && <p className="mt-3 text-sm text-muted"><strong className="text-ink">Explanation:</strong> {question.explanation}</p>}
                </li>
              ))}
            </ol>

            <div className="mt-5 flex flex-wrap gap-3">
              {!submitted ? <button type="button" className="rounded-lg bg-forest px-4 py-2 text-sm font-semibold text-white" onClick={submitQuiz}>Check score</button> : <button type="button" className="rounded-lg border border-forest px-4 py-2 text-sm font-semibold text-forest" onClick={() => { setAnswers({}); setSubmitted(false); }}>Try again</button>}
            </div>
          </section>
        )}
      </section>
    </section>
  );
}
