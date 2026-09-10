import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createGame, newPlayer, viewGame, type GameView } from '../game/engine';
import { NexusTleilaxu } from '../components/nexus-tleilaxu';
import { nexusFaceDancersAction } from '../game/nexus-tleilaxu-options';

/** Explicit projected offers isolate presentation/consumer validation. These
 * tests do not claim physical acquisition or replacement engine evidence. */
function fixture(): GameView {
  const g = createGame(
    'DANCERCONTROLS',
    newPlayer('t', 'Tleilaxu', 'tleilaxu'),
  );
  g.players.push(
    newPlayer('a', 'Atreides', 'atreides'),
    newPlayer('h', 'Harkonnen', 'harkonnen'),
  );
  Object.assign(g, {
    status: 'playing',
    phase: 6,
    turn: 2,
    active: 'a',
    order: ['t', 'a', 'h'],
  });
  const v = viewGame(g, 't');
  v.nexusCards = {
    card: 'tleilaxu',
    deckCount: 11,
    discardCount: 0,
    held: { t: true, a: false, h: false },
    turn: null,
    choices: [],
    waiting: [],
  };
  v.nexusTleilaxu = {
    cunning: { event: 'dancer-event', count: 2, blocked: null },
  };
  return v;
}
function html(game: GameView, busy = false) {
  return renderToStaticMarkup(
    createElement(NexusTleilaxu, { game, busy, act() {} }),
  );
}

void test('Cunning explains the ordered complete replacement and submits no selection or extra confirmation', () => {
  const v = fixture();
  const before = structuredClone(v);
  assert.deepEqual(nexusFaceDancersAction(v, 'dancer-event'), {
    type: 'nexusFaceDancers',
    event: 'dancer-event',
  });
  const text = html(v);
  assert.match(text, /secretly draw their replacements/);
  assert.match(text, /Then shuffle the set-aside cards/);
  assert.match(text, /unrevealed Face Dancers stay in your hand/);
  assert.match(text, /Replace 2 revealed Face Dancers/);
  assert.doesNotMatch(text, /type="checkbox"|<select|Confirm|disabled=""/);
  assert.deepEqual(v, before);
  assert.match(html(v, true), /disabled=""/);
});

void test('Cunning binds owner, held card, event and server block while preserving anytime decision access', () => {
  const v = fixture();
  v.decision = { kind: 'nullentropy', player: 'a' };
  v.automaticContinuationPending = true;
  assert.ok(nexusFaceDancersAction(v, 'dancer-event'));
  assert.equal(nexusFaceDancersAction(v, 'stale'), null);
  v.nexusTleilaxu!.cunning!.blocked = 'Finish the current Nexus return first.';
  assert.equal(nexusFaceDancersAction(v, 'dancer-event'), null);
  assert.match(html(v), /Finish the current Nexus return first/);
  assert.match(html(v), /disabled=""/);
  v.nexusTleilaxu!.cunning!.blocked = null;
  v.nexusCards!.card = 'harkonnen';
  assert.equal(nexusFaceDancersAction(v, 'dancer-event'), null);
  v.nexusCards!.card = 'tleilaxu';
  v.me = 'a';
  assert.equal(nexusFaceDancersAction(v, 'dancer-event'), null);
  v.me = 't';
  v.players[0].ally = 'a';
  assert.equal(nexusFaceDancersAction(v, 'dancer-event'), null);
});

void test('Cunning controls honor Truth and exchange priority and never inspect hidden identities', () => {
  const v = fixture();
  for (const p of v.players)
    for (const key of ['traitors', 'faceDancers', 'hand'])
      Object.defineProperty(p, key, {
        get() {
          throw new Error('Read a hidden identity');
        },
      });
  assert.ok(nexusFaceDancersAction(v, 'dancer-event'));
  assert.match(html(v), /Replace 2/);
  v.truthtrance = { stage: 'priority', queue: [], passed: [], question: null };
  assert.equal(nexusFaceDancersAction(v, 'dancer-event'), null);
  v.truthtrance = null;
  v.nexusCards!.waiting = ['a'];
  assert.equal(nexusFaceDancersAction(v, 'dancer-event'), null);
  v.nexusCards!.waiting = [];
  v.nexusTraitors = {
    offer: null,
    pending: {
      event: 'exchange',
      owner: 'h',
      mode: 'cunning',
      count: 1,
      choices: [],
    },
  };
  assert.equal(nexusFaceDancersAction(v, 'dancer-event'), null);
  v.nexusTraitors = null;
  for (const count of [0, -1, 1.5, NaN]) {
    v.nexusTleilaxu!.cunning!.count = count;
    assert.equal(nexusFaceDancersAction(v, 'dancer-event'), null);
  }
  v.nexusTleilaxu = null;
  assert.equal(html(v), '');
});

void test('unavailable Tleilaxu modes are explained only from the viewer’s own held Nexus card', () => {
  const v = fixture();
  v.nexusTleilaxu = { cunning: null };
  v.me = 'a';
  assert.match(html(v), /Betrayal is unavailable while its private response timing is pending/);
  v.players = v.players.filter((player) => player.faction !== 'tleilaxu');
  assert.match(html(v), /Secret Ally revival is unavailable while its revival-limit ruling is pending/);
  assert.doesNotMatch(html(v), /<button/);
  v.nexusCards!.card = null;
  assert.equal(html(v), '');
});
