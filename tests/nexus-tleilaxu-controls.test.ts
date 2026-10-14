import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, newPlayer, viewGame, type GameView } from '../game/engine';
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
    secretAlly: null,
  };
  return v;
}

void test('Cunning binds owner, held card, event and server block while preserving anytime decision access', () => {
  const v = fixture();
  v.decision = { kind: 'nullentropy', player: 'a' };
  v.automaticContinuationPending = true;
  assert.ok(nexusFaceDancersAction(v, 'dancer-event'));
  assert.equal(nexusFaceDancersAction(v, 'stale'), null);
  v.nexusTleilaxu!.cunning!.blocked = 'Finish the current Nexus return first.';
  assert.equal(nexusFaceDancersAction(v, 'dancer-event'), null);
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
});

