import { createApiRequest } from './services/api.js';
import { useEffect, useState } from 'react';

export default function RagChat({ getToken }) {
  const [question, setQuestion] = useState('');
  const [conversations, setConversations] = useState([]);
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState({ type: 'idle', message: '' });
  const [asking, setAsking] = useState(false);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [openingId, setOpeningId] = useState(null);

  const request = createApiRequest(getToken);

  async function loadConversations() {
    try {
      const data = await request('/api/ai/conversations');
      setConversations(data.conversations);
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    }
  }

  async function selectConversation(conversationId) {
    setLoadingConversation(true);
    try {
      const data = await request(`/api/ai/conversations/${conversationId}`);
      setSelectedConversationId(data.conversation._id);
      setMessages(data.messages);
      setStatus({ type: 'idle', message: '' });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setLoadingConversation(false);
    }
  }

  useEffect(() => { loadConversations(); }, []);

  async function askQuestion(event) {
    event.preventDefault();
    if (!question.trim()) {
      setStatus({ type: 'error', message: 'Enter a question about your indexed documents.' });
      return;
    }

    setAsking(true);
    setStatus({ type: 'loading', message: 'Finding your private document context and preparing an answer…' });
    try {
      const data = await request('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim(), conversationId: selectedConversationId || undefined }),
      });
      setQuestion('');
      setSelectedConversationId(data.conversation._id);
      setMessages((current) => selectedConversationId === data.conversation._id
        ? [...current, data.userMessage, data.assistantMessage]
        : [data.userMessage, data.assistantMessage]);
      await loadConversations();
      setStatus({
        type: data.assistantMessage.grounded ? 'success' : 'idle',
        message: data.assistantMessage.grounded
          ? 'Answer created from retrieved document chunks. Review the source cards below.'
          : 'No suitable document context was found, so no unsupported answer was generated.',
      });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setAsking(false);
    }
  }

  async function deleteConversation(conversationId) {
    setDeletingId(conversationId);
    try {
      await request(`/api/ai/conversations/${conversationId}`, { method: 'DELETE' });
      setConversations((current) => current.filter((conversation) => conversation._id !== conversationId));
      if (selectedConversationId === conversationId) {
        setSelectedConversationId(null);
        setMessages([]);
        setStatus({ type: 'success', message: 'Conversation deleted.' });
      }
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setDeletingId(null);
    }
  }

  async function openDocument(source) {
    setOpeningId(source.sourceId);
    try {
      const data = await request(`/api/documents/${source.sourceId}/open`);
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setOpeningId(null);
    }
  }

  return (
    <section className="mt-10 rounded-2xl border border-line bg-white p-6">
      <p className="text-sm text-muted">Phase 8 — grounded RAG Q&amp;A</p>
      <h2 className="mt-2 font-display text-3xl">Ask your documents</h2>
      <p className="mt-3 max-w-3xl text-muted">Your question retrieves related private chunks first. Gemini receives only that focused context and the app shows the real document sections used as sources.</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="rounded-xl border border-line bg-paper p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold text-forest">Conversations</h3>
            <button className="text-sm font-semibold text-forest underline underline-offset-4" type="button" onClick={() => { setSelectedConversationId(null); setMessages([]); setStatus({ type: 'idle', message: '' }); }}>New chat</button>
          </div>
          {conversations.length === 0 ? <p className="mt-4 text-sm text-muted">Your question history will appear here.</p> : (
            <ul className="mt-4 space-y-2">
              {conversations.map((conversation) => (
                <li className="flex items-start gap-2" key={conversation._id}>
                  <button className={`min-w-0 flex-1 rounded-lg px-3 py-2 text-left text-sm ${selectedConversationId === conversation._id ? 'bg-sage text-forest' : 'hover:bg-white'}`} type="button" onClick={() => selectConversation(conversation._id)} disabled={loadingConversation}>
                    <span className="block truncate font-medium">{conversation.title}</span>
                  </button>
                  <button className="rounded-lg px-2 py-2 text-xs text-muted underline underline-offset-2 disabled:opacity-60" type="button" aria-label={`Delete ${conversation.title}`} onClick={() => deleteConversation(conversation._id)} disabled={deletingId === conversation._id}>
                    {deletingId === conversation._id ? '…' : 'Delete'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <div>
          <div className="space-y-4" aria-live="polite">
            {messages.length === 0 && <p className="rounded-xl bg-paper p-4 text-sm text-muted">Ask about an indexed document. If your documents do not contain enough evidence, the assistant will say so instead of guessing.</p>}
            {messages.map((message) => (
              <article className={`rounded-xl border p-4 ${message.role === 'user' ? 'border-line bg-paper' : 'border-sage bg-white'}`} key={message._id}>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">{message.role === 'user' ? 'You' : 'Document answer'}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink">{message.content}</p>
                {message.sourceUnavailable && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">The document used for this saved answer has since been deleted, so its source link is no longer available.</p>}
                {message.role === 'assistant' && message.sources?.length > 0 && (
                  <div className="mt-4 border-t border-line pt-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">Sources retrieved for this answer</p>
                    <ul className="mt-2 space-y-2">
                      {message.sources.map((source) => (
                        <li className="flex flex-wrap items-center justify-between gap-2 text-sm" key={source.chunkId}>
                          <span className="text-muted">{source.title} · section {source.pageNumber || 'unknown'} · chunk {source.position + 1}</span>
                          <button className="font-semibold text-forest underline underline-offset-4 disabled:opacity-60" type="button" onClick={() => openDocument(source)} disabled={openingId === source.sourceId}>
                            {openingId === source.sourceId ? 'Opening…' : 'Open document'}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </article>
            ))}
          </div>

          <form className="mt-5" onSubmit={askQuestion}>
            <label className="block font-medium" htmlFor="rag-question">
              Ask a question about your indexed documents
              <textarea id="rag-question" value={question} maxLength="2000" rows="4" className="mt-2 w-full rounded-lg border border-line px-3 py-2 font-normal" placeholder="How did communication technologies change society?" onChange={(event) => setQuestion(event.target.value)} />
            </label>
            <button className="mt-3 rounded-xl bg-forest px-5 py-3 text-sm font-semibold text-white disabled:opacity-60" type="submit" disabled={asking || loadingConversation}>
              {asking ? 'Answering…' : 'Ask your documents'}
            </button>
          </form>
        </div>
      </div>

      {status.message && <p role="status" className={`mt-5 rounded-lg p-3 text-sm ${status.type === 'error' ? 'bg-red-50 text-red-800' : status.type === 'success' ? 'bg-sage text-forest' : 'bg-paper text-muted'}`}>{status.message}</p>}
    </section>
  );
}
