import { useState } from 'react';
import { ClerkProvider, SignIn, SignUp, UserButton, useAuth } from '@clerk/react';
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import ConnectionPage from './App.jsx';
import NotesWorkspace from './NotesWorkspace.jsx';

const key = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.trim();
const button = 'inline-block rounded-xl bg-forest px-5 py-3 text-sm font-semibold text-white';
function Layout({ children }) {
  return <div className="min-h-screen bg-paper text-ink"><header className="border-b border-line px-6 py-5"><nav className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4"><Link to="/" className="text-lg font-semibold">AI Notes</Link><div className="flex items-center gap-5 text-sm"><Link to="/connection">Connection check</Link><Link to="/workspace">My workspace</Link></div></nav></header><main className="mx-auto max-w-5xl px-6 py-14">{children}</main></div>;
}
function Setup() {
  return <Layout><p className="text-sm text-muted">Version 1 / Phase 02</p><h1 className="mt-4 font-display text-4xl">Your private workspace starts here.</h1><section className="mt-8 max-w-2xl rounded-2xl border border-line bg-white p-7"><h2 className="text-xl font-semibold">One setup step before sign-in</h2><p className="mt-4 leading-7 text-muted">Create your Clerk application, then add its development keys to the local configuration files. The setup guide walks you through each step.</p><p className="mt-4 text-sm">Open <code>docs/phase-2-setup.md</code> in your project folder.</p><p className="mt-4 text-sm text-muted">Once the keys are saved, restart the app. Your sign-in and account creation screens will appear here.</p><Link to="/connection" className={`${button} mt-6`}>Check backend connection</Link></section></Layout>;
}
function Workspace() {
  const { getToken, userId } = useAuth();
  const [state, setState] = useState({ status: 'idle' });
  async function verify() {
    setState({ status: 'loading' });
    try {
      const token = await getToken();
      if (!token) throw new Error('Your session ended. Please sign in again.');
      const response = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, cache: 'no-store', signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error(response.status === 401 ? 'Your session could not be verified. Please sign in again.' : 'The backend cannot verify sign-in yet. Check the server setup and try again.');
      const data = await response.json();
      if (data.userId !== userId) throw new Error('The verified account does not match. Please sign out and sign in again.');
      setState({ status: 'success', userId: data.userId });
    } catch (error) { setState({ status: 'error', message: error.name === 'TimeoutError' ? 'The request timed out. Please try again.' : error.message }); }
  }
  return <Layout><div className="flex items-center justify-between"><p className="text-sm text-muted">Your personal space</p><UserButton /></div><h1 className="mt-4 font-display text-4xl">Welcome to your workspace.</h1><p className="mt-4 text-muted">Create and manage private notes. Your account identity is checked by Express before notes are read or changed.</p><section className="mt-8 rounded-2xl border border-line bg-white p-7"><h2 className="text-xl font-semibold">Verify your account with the backend</h2><p className="mt-3 text-muted">Express independently checks your session before returning your account ID.</p><button className={`${button} mt-6 disabled:opacity-60`} onClick={verify} disabled={state.status === 'loading'}>{state.status === 'loading' ? 'Verifying…' : 'Verify my session'}</button><div role="status" className="mt-4 break-all">{state.status === 'success' && <p>Session verified. Account: {state.userId}</p>}{state.status === 'error' && <p>{state.message}</p>}</div></section><NotesWorkspace getToken={getToken} /></Layout>;
}
function ProtectedWorkspace() {
  const { isLoaded, isSignedIn, sessionId } = useAuth();
  if (!isLoaded) return <Layout><p role="status">Loading your session…</p></Layout>;
  if (!isSignedIn) return <Navigate to="/sign-in" replace />;
  return <Workspace key={sessionId} />;
}
function AuthPage({ signUp = false }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <Layout><p role="status">Loading sign-in…</p></Layout>;
  if (isSignedIn) return <Navigate to="/workspace" replace />;
  return <Layout><div className="flex justify-center">{signUp ? <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" /> : <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />}</div></Layout>;
}
export default function Root() {
  return <BrowserRouter>{!key ? <Routes><Route path="/connection" element={<ConnectionPage />} /><Route path="*" element={<Setup />} /></Routes> : <ClerkProvider publishableKey={key} signInUrl="/sign-in" signUpUrl="/sign-up" signInForceRedirectUrl="/workspace" signUpForceRedirectUrl="/workspace" afterSignOutUrl="/sign-in"><Routes><Route path="/" element={<Navigate to="/workspace" replace />} /><Route path="/sign-in/*" element={<AuthPage />} /><Route path="/sign-up/*" element={<AuthPage signUp />} /><Route path="/workspace" element={<ProtectedWorkspace />} /><Route path="/connection" element={<ConnectionPage />} /><Route path="*" element={<Layout><h1>Page not found</h1><Link to="/">Go home</Link></Layout>} /></Routes></ClerkProvider>}</BrowserRouter>;
}
