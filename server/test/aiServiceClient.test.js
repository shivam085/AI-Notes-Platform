import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createAiServiceClient,
  AiServiceConfigurationError,
  AiServiceUnavailableError,
  DocumentExtractionInputError,
} from '../src/services/aiServiceClient.js';

function clientWith(fetchImplementation, options = {}) {
  return createAiServiceClient({
    baseUrl: 'http://ai.test/', serviceToken: 'test-only-token', fetchImplementation, ...options,
  });
}

test('shared AI client preserves extraction, search, RAG and study request/response contracts', async () => {
  const calls = [];
  const chunk = { position: 0, page_number: 2, text: 'Indexes speed up lookups.' };
  const card = { question: 'What helps lookups?', answer: 'An index.' };
  const question = { question: 'Choose the index.', options: ['A', 'B', 'C', 'D'], correct_option_index: 2, explanation: 'C is the index.' };
  const replies = {
    '/internal/extract-document': { pages: [{ page_number: 2, text: chunk.text }], chunks: [chunk] },
    '/internal/split-text': { chunks: [chunk] },
    '/internal/index-chunks': { indexed_count: 1 },
    '/internal/delete-source-vectors': { deleted: true },
    '/internal/semantic-search': { results: [{ chunk_id: 'chunk-1', source_type: 'document', source_id: 'doc-1', title: 'Indexes', ...chunk, score: 0.9 }] },
    '/internal/answer-question': { answer: ' Indexes speed up lookups. ', grounded: true },
    '/internal/summarize': { summary: ' Indexes help. ' },
    '/internal/suggest-tags': { tags: ['Database', 'indexes', 'queries'] },
    '/internal/generate-flashcards': { cards: Array(5).fill(card) },
    '/internal/generate-quiz': { questions: Array(5).fill(question) },
  };
  const client = clientWith(async (url, options) => {
    const path = new URL(url).pathname;
    assert.equal(options.method, 'POST');
    assert.equal(options.headers['X-AI-Service-Token'], 'test-only-token');
    assert.equal(options.headers['Content-Type'], 'application/json');
    assert.ok(options.signal instanceof AbortSignal);
    calls.push({ path, body: JSON.parse(options.body) });
    assert.ok(replies[path], `Unexpected path: ${path}`);
    return Response.json(replies[path]);
  });

  const extracted = await client.extractDocument('https://files.test/doc', 'docx');
  assert.deepEqual(extracted, { pages: [{ pageNumber: 2, text: chunk.text }], chunks: [{ position: 0, pageNumber: 2, text: chunk.text }] });
  assert.deepEqual(await client.splitText(chunk.text), extracted.chunks);
  assert.equal(await client.indexChunks([chunk]), 1);
  await client.deleteSource('owner-1', 'doc-1');
  const results = await client.search({ ownerId: 'owner-1', query: 'indexes', limit: 4, sourceType: 'document', folderId: 'study', tags: ['database'] });
  assert.deepEqual(results, [{ chunkId: 'chunk-1', sourceType: 'document', sourceId: 'doc-1', title: 'Indexes', position: 0, pageNumber: 2, text: chunk.text, score: 0.9 }]);
  assert.deepEqual(await client.answerQuestion('Why indexes?', [chunk]), { answer: chunk.text, grounded: true });
  assert.equal(await client.summarize(chunk.text), 'Indexes help.');
  assert.deepEqual(await client.suggestTags({ title: 'Indexes', text: chunk.text }), ['database', 'indexes', 'queries']);
  assert.deepEqual(await client.generateFlashcards({ title: 'Indexes', text: chunk.text }), Array(5).fill(card));
  assert.deepEqual((await client.generateQuiz({ title: 'Indexes', text: chunk.text }))[0], {
    question: question.question, options: question.options, correctOptionIndex: 2, explanation: question.explanation,
  });
  assert.deepEqual(calls.find(({ path }) => path === '/internal/extract-document').body, { source_url: 'https://files.test/doc', format: 'docx' });
  assert.deepEqual(calls.find(({ path }) => path === '/internal/semantic-search').body, { owner_id: 'owner-1', query: 'indexes', limit: 4, source_type: 'document', folder_id: 'study', tags: ['database'] });
  assert.deepEqual(calls.find(({ path }) => path === '/internal/delete-source-vectors').body, { owner_id: 'owner-1', source_id: 'doc-1' });
  assert.deepEqual(calls.find(({ path }) => path === '/internal/answer-question').body, { question: 'Why indexes?', contexts: [chunk] });
});

test('shared AI client rejects missing configuration, malformed responses and provider failures safely', async () => {
  assert.throws(() => clientWith(() => assert.fail('Must not call provider'), { serviceToken: '' }), AiServiceConfigurationError);
  for (const response of [Response.json(null), Response.json([]), Response.json({}), new Response('invalid JSON'), Response.json({ detail: 'private provider details' }, { status: 500 })]) {
    await assert.rejects(() => clientWith(async () => response).answerQuestion('Question', []), (error) => {
      assert.ok(error instanceof AiServiceUnavailableError);
      assert.ok(!error.message.includes('private provider details'));
      return true;
    });
  }
  await assert.rejects(() => clientWith(async () => { throw new Error('private network details'); }).summarize('Text'), AiServiceUnavailableError);
});

test('extraction validation errors remain distinct from retryable AI failures', async () => {
  const client = clientWith(async () => Response.json({ detail: 'No readable text was found.' }, { status: 422 }));
  await assert.rejects(() => client.extractDocument('https://files.test/empty.pdf'), (error) => {
    assert.ok(error instanceof DocumentExtractionInputError);
    assert.ok(!(error instanceof AiServiceUnavailableError));
    assert.equal(error.message, 'No readable text was found.');
    return true;
  });
  await assert.rejects(() => client.answerQuestion('Question', []), AiServiceUnavailableError);
});

test('merged client retains separate extraction, retrieval and generation timeouts', async (t) => {
  const timeouts = [];
  t.mock.method(AbortSignal, 'timeout', (milliseconds) => {
    timeouts.push(milliseconds);
    return new AbortController().signal;
  });
  const client = clientWith(async (url) => Response.json(url.endsWith('extract-document')
    ? { pages: [], chunks: [] }
    : url.endsWith('answer-question') ? { answer: 'Answer', grounded: false } : { summary: 'Summary' }), { timeoutMs: 9_000 });
  await client.extractDocument('https://files.test/document.pdf');
  await client.answerQuestion('Question', []);
  await client.summarize('Text');
  assert.deepEqual(timeouts, [30_000, 60_000, 9_000]);
});
