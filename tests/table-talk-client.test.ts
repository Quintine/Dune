import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TableTalk } from '../components/table-talk';
import { createGame, newPlayer, viewGame } from '../game/engine';
import {
  validTalkDraft,
  clearTalkDraft,
  restoreTalkDraft,
  talkDraftKey,
  mergeTalkPages,
} from '../lib/table-talk';
void test('message retry validation preserves exact text and recipient, rejects injected identities and invalid payloads', () => {
  const draft = {
    id: crypto.randomUUID(),
    recipientId: crypto.randomUUID(),
    text: '  line one\n<script>literal text</script>  ',
  };
  assert.deepEqual(restoreTalkDraft(JSON.stringify(draft)), draft);
  for (const value of [
    null,
    [],
    {},
    { ...draft, senderId: 'forged' },
    { ...draft, id: 1 },
    { ...draft, text: '\u0000' },
    { ...draft, text: ' '.repeat(20) },
    { ...draft, text: 'a'.repeat(1001) },
    { ...draft, recipientId: 'table' },
  ])
    assert.equal(validTalkDraft(value), false);
  assert.equal(restoreTalkDraft('not JSON'), null);
  assert.notEqual(
    talkDraftKey('AAAAAAAA', 'one'),
    talkDraftKey('AAAAAAAA', 'two'),
  );
  assert.notEqual(
    talkDraftKey('AAAAAAAA', 'one'),
    talkDraftKey('BBBBBBBB', 'one'),
  );
});
void test('discussion entry has a named disclosure and no server-rendered private history', () => {
  const game = createGame(
    'ABCDEFGH',
    newPlayer('one', 'Human', 'atreides'),
    false,
    [],
  );
  const html = renderToStaticMarkup(
    createElement(TableTalk, { game: viewGame(game, 'one') }),
  );
  assert.match(html, /Table discussion/);
  assert.match(html, /aria-expanded="false"/);
  assert.doesNotMatch(html, /textarea|<script|href="https?:/);
  const message = {
    id: 'one',
    senderId: 'a',
    senderName: 'A',
    senderFaction: 'atreides',
    recipientId: null,
    recipientName: null,
    text: 'one',
    createdAt: 1,
  };
  assert.deepEqual(
    mergeTalkPages([message], [message, { ...message, id: 'two' }]).map(
      (m) => m.id,
    ),
    ['one', 'two'],
  );
});

void test('late completion cannot erase a newer message retry record', () => {
  const older = {
    id: crypto.randomUUID(),
    recipientId: null,
    text: 'Old send',
  };
  const newer = { ...older, id: crypto.randomUUID(), text: 'New send' };
  let saved: string | null = JSON.stringify(newer);
  const storage = {
    getItem: () => saved,
    removeItem: () => {
      saved = null;
    },
  };
  assert.equal(clearTalkDraft(storage, 'key', older), false);
  assert.deepEqual(restoreTalkDraft(saved), newer);
  assert.equal(clearTalkDraft(storage, 'key', newer), true);
  assert.equal(saved, null);
});
