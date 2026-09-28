import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSummaryService } from '../src/services/summaryService.js';
import { NoteNotFoundError } from '../src/services/noteService.js';

test('summarization sends only an owned note to the AI client', async () => {
  const received = [];
  const service = createSummaryService({
    noteService: { async getById(ownerId, noteId) { assert.equal(ownerId, 'user_123'); assert.equal(noteId, 'note_123'); return { _id: noteId, content: 'Study database indexes.' }; } },
    aiClient: { async summarize(text) { received.push(text); return '- Learn index types.'; } },
  });
  const result = await service.summarizeNote('user_123', 'note_123');
  assert.deepEqual(received, ['Study database indexes.']);
  assert.deepEqual(result, { noteId: 'note_123', summary: '- Learn index types.' });
});

test('summarization does not call AI when the note does not belong to the user', async () => {
  const service = createSummaryService({
    noteService: { async getById() { throw new NoteNotFoundError(); } },
    aiClient: { async summarize() { throw new Error('This must not run.'); } },
  });
  await assert.rejects(() => service.summarizeNote('user_123', 'someone-elses-note'), NoteNotFoundError);
});
