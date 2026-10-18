import { ClerkProvider, SignIn, SignUp, UserButton, useAuth } from '@clerk/react';
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import NotesWorkspace from './NotesWorkspace.jsx';
import DocumentsWorkspace from './DocumentsWorkspace.jsx';
import SemanticSearch from './SemanticSearch.jsx';
import RagChat from './RagChat.jsx';
import Flashcards from './Flashcards.jsx';
import Quiz from './Quiz.jsx';

const key = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.trim();

function Layout({ children }) {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <header className="border-b border-line px-6 py-5">
        <nav className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4">
          <Link to="/" className="text-lg font-semibold">AI Notes</Link>
          <div className="flex items-center gap-5 text-sm">
            <Link to="/workspace">My workspace</Link>
          </div>
        </nav>
      </header>
      <main id="main-content" className="mx-auto max-w-5xl px-6 py-14">{children}</main>
    </div>
  );
}

function Setup() {
  return (
    <Layout>
      <h1 className="mt-4 font-display text-4xl">Your private workspace starts here.</h1>
      <section className="mt-8 max-w-2xl rounded-2xl border border-line bg-white p-7">
        <h2 className="text-xl font-semibold">One setup step before sign-in</h2>
        <p className="mt-4 leading-7 text-muted">
          Create your Clerk application, then add its development keys to the local configuration files.
          The setup guide walks you through each step.
        </p>
        <p className="mt-4 text-sm">Open <code>docs/phase-2-setup.md</code> in your project folder.</p>
        <p className="mt-4 text-sm text-muted">
          Once the keys are saved, restart the app. Your sign-in and account creation screens will appear here.
        </p>
      </section>
    </Layout>
  );
}

function Workspace() {
  const { getToken } = useAuth();

  return (
    <Layout>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">Your personal space</p>
        <UserButton />
      </div>

      <h1 className="mt-4 font-display text-4xl">Welcome to your workspace.</h1>
      <p className="mt-4 text-muted">
        Create private notes and learn from PDF, DOCX, TXT, and Markdown documents. Express checks your account identity before private data is read or changed.
      </p>

      <nav className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Workspace tools">
        {[
          ['Notes', '#notes', 'Write, organize, search, and summarize.'],
          ['Documents', '#documents', 'Upload, process, inspect, and tag.'],
          ['Semantic search', '#semantic-search', 'Search document meaning with Qdrant.'],
          ['Document Q&A', '#document-chat', 'Ask grounded questions with sources.'],
          ['Flashcards', '#flashcards', 'Generate and review saved decks.'],
          ['Quizzes', '#quizzes', 'Take saved, self-scoring quizzes.'],
        ].map(([label, href, description]) => (
          <a className="rounded-xl border border-line bg-white p-4 hover:border-forest" href={href} key={href}>
            <span className="font-semibold text-forest">{label}</span>
            <span className="mt-1 block text-xs leading-5 text-muted">{description}</span>
          </a>
        ))}
      </nav>

      <div id="notes"><NotesWorkspace getToken={getToken} /></div>
      <div id="documents"><DocumentsWorkspace getToken={getToken} /></div>
      <div id="semantic-search"><SemanticSearch getToken={getToken} /></div>
      <div id="document-chat"><RagChat getToken={getToken} /></div>
      <div id="flashcards"><Flashcards getToken={getToken} /></div>
      <div id="quizzes"><Quiz getToken={getToken} /></div>
    </Layout>
  );
}

function ProtectedRoute({ element }) {
  const { isLoaded, isSignedIn, sessionId } = useAuth();

  if (!isLoaded) {
    return <Layout><p role="status">Loading your session…</p></Layout>;
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />;
  }

  return <div key={sessionId}>{element}</div>;
}

function AuthPage({ signUp = false }) {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return <Layout><p role="status">Loading sign-in…</p></Layout>;
  }

  if (isSignedIn) {
    return <Navigate to="/workspace" replace />;
  }

  return (
    <Layout>
      <div className="flex justify-center">
        {signUp ? (
          <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
        ) : (
          <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />
        )}
      </div>
    </Layout>
  );
}

export default function Root() {
  const routes = (
    <Routes>
      <Route path="/" element={<Navigate to="/workspace" replace />} />
      <Route path="/sign-in/*" element={<AuthPage />} />
      <Route path="/sign-up/*" element={<AuthPage signUp />} />
      <Route path="/workspace" element={<ProtectedRoute element={<Workspace />} />} />
      <Route
        path="*"
        element={
          <Layout>
            <h1>Page not found</h1>
            <Link to="/">Go home</Link>
          </Layout>
        }
      />
    </Routes>
  );

  return (
    <BrowserRouter>
      {!key ? (
        <Setup />
      ) : (
        <ClerkProvider
          publishableKey={key}
          signInUrl="/sign-in"
          signUpUrl="/sign-up"
          signInForceRedirectUrl="/workspace"
          signUpForceRedirectUrl="/workspace"
          afterSignOutUrl="/sign-in"
        >
          {routes}
        </ClerkProvider>
      )}
    </BrowserRouter>
  );
}
