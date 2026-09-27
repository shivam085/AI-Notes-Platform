import { useState } from 'react';
import { checkBackendConnection } from './services/api.js';

const developmentLog = 'https://app.notion.com/p/3e8c1e94c8d181ffa4f0cb43a71caa0f';

function NoteIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M6 3h9l4 4v14H6V3Z" strokeLinejoin="round" />
      <path d="M14 3v5h5M10 12h5M10 16h4" strokeLinecap="round" />
    </svg>
  );
}

export default function App() {
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [lastChecked, setLastChecked] = useState('');

  async function handleCheckConnection() {
    setStatus('checking');
    setError('');
    setResult(null);

    try {
      const data = await checkBackendConnection();
      setResult(data);
      setStatus('connected');
    } catch (error) {
      setError(error.message);
      setStatus('error');
    } finally {
      setLastChecked(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }
  }

  const statusText = {
    idle: 'Ready to check',
    checking: 'Checking connection…',
    connected: 'Backend connected',
    error: 'Connection unsuccessful',
  }[status];

  return (
    <div className="min-h-screen bg-paper text-ink">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-6 sm:px-10">
          <a className="flex items-center gap-3 rounded-md" href="#main-content" aria-label="AI Notes Platform home">
            <span className="flex size-10 items-center justify-center rounded-xl bg-forest text-paper"><NoteIcon className="size-6" /></span>
            <span className="text-lg font-semibold tracking-tight">AI Notes<span className="ml-1.5 hidden text-sm font-normal text-muted sm:inline">Platform</span></span>
          </a>
          <a href={developmentLog} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-md text-sm font-medium text-muted transition-colors hover:text-forest">
            Development log <span aria-hidden="true">↗</span>
          </a>
        </div>
      </header>

      <main id="main-content" className="mx-auto max-w-6xl px-6 pb-14 pt-12 sm:px-10 sm:pt-16">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-line bg-white/60 px-3 py-1.5 text-xs font-medium text-forest">
          <span className="size-1.5 rounded-full bg-forest" /> Version 1 <span className="text-muted">/</span> Phase 01
        </div>
        <div className="mb-12 flex flex-col justify-between gap-6 sm:mb-14 md:flex-row md:items-end">
          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-muted">A little structure. A lot of possibility.</p>
            <h1 className="font-display text-5xl leading-[1.07] tracking-tight sm:text-6xl">A home for<br />what you learn<span className="text-forest">.</span></h1>
          </div>
          <p className="max-w-xs text-base leading-7 text-muted md:pb-1">Your personal knowledge workspace starts with one small step. Let’s connect the page to its backend.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(260px,1fr)]">
          <section className="min-w-0 rounded-2xl border border-line bg-white p-6 shadow-[0_8px_32px_#273f3010] sm:p-8" aria-labelledby="connection-heading">
            <div className="mb-8 flex items-start justify-between gap-4">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">Workspace connection</p>
                <h2 id="connection-heading" className="text-2xl font-semibold tracking-tight">Make the first connection</h2>
              </div>
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sage text-forest" aria-hidden="true">↗</span>
            </div>
            <p className="mb-7 max-w-lg text-sm leading-6 text-muted">This button sends a request to Express. A successful reply tells us the frontend and backend can talk to each other.</p>

            <div className={`status-panel status-${status}`} role="status" aria-live="polite" aria-atomic="true">
              <span className={`status-dot ${status === 'checking' ? 'animate-pulse' : ''}`} aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold">{statusText}</p>
                <p className="mt-1 text-xs leading-5 opacity-80">
                  {status === 'idle' && 'Run a quick check to see if the API is reachable.'}
                  {status === 'checking' && 'Waiting for a response from Express…'}
                  {status === 'connected' && `Express replied successfully. Last checked at ${lastChecked}.`}
                  {status === 'error' && error}
                </p>
              </div>
            </div>

            <button type="button" onClick={handleCheckConnection} disabled={status === 'checking'} aria-busy={status === 'checking'} className="mt-6 inline-flex w-full items-center justify-center gap-3 rounded-xl bg-forest px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-forest-dark disabled:cursor-wait disabled:opacity-70 sm:w-auto">
              {status === 'checking' ? <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white motion-reduce:animate-none" aria-hidden="true" /> : <span aria-hidden="true">↗</span>}
              {status === 'checking' ? 'Checking…' : status === 'error' ? 'Try again' : 'Check connection'}
            </button>

            {result && (
              <div className="mt-7 border-t border-line pt-5">
                <div className="mb-3 flex items-center justify-between text-xs text-muted"><span>Response from the backend</span><span>JSON</span></div>
                <pre className="overflow-x-auto rounded-lg bg-paper p-4 text-sm text-forest"><code>{JSON.stringify(result, null, 2)}</code></pre>
              </div>
            )}
          </section>

          <aside className="rounded-2xl border border-line bg-sage/50 p-6 sm:p-8" aria-labelledby="milestone-heading">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">One step at a time</p>
            <h2 id="milestone-heading" className="mb-7 font-display text-3xl tracking-tight">A solid beginning.</h2>
            <ol className="space-y-6">
              <li className="flex gap-4"><span className="step-number bg-forest text-white">01</span><div><h3 className="text-sm font-semibold">A page to start from</h3><p className="mt-1 text-sm leading-6 text-muted">React brings your workspace to the browser.</p></div></li>
              <li className="flex gap-4"><span className={`step-number ${status === 'connected' ? 'bg-forest text-white' : 'border border-forest/25 text-forest'}`}>02</span><div><h3 className="text-sm font-semibold">A backend that responds</h3><p className="mt-1 text-sm leading-6 text-muted">Express replies to the connection check.</p></div></li>
              <li className="flex gap-4"><span className="step-number border border-line text-muted">03</span><div><h3 className="text-sm font-semibold text-muted">Your own private space</h3><p className="mt-1 text-sm leading-6 text-muted">Sign-in comes next, in Phase 2.</p></div></li>
            </ol>
          </aside>
        </div>

        <section className="mt-8 flex flex-col gap-4 border-y border-line py-5 sm:flex-row sm:items-center sm:justify-between" aria-label="How this check works">
          <p className="text-xs font-medium uppercase tracking-widest text-muted">Behind the button</p>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted"><span className="font-medium text-ink">React</span><span aria-hidden="true">→</span><span>GET /api/health</span><span aria-hidden="true">→</span><span className="font-medium text-ink">Express</span><span aria-hidden="true">→</span><span>JSON response</span></p>
        </section>
        <footer className="mt-7 flex flex-wrap justify-between gap-3 text-xs text-muted"><p>AI Notes Platform · Built one phase at a time.</p><p>Phase 01 / Frontend meets backend</p></footer>
      </main>
    </div>
  );
}
