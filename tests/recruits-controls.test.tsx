import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Recruits } from '../components/recruits';
import { applyAction, viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { recruitsPlayAction } from '../game/recruits';
import { cardPresentation } from '../game/card-presentation';
import { recruitsGame } from './fixture-recruits';

function ownerGame() {
  const g = recruitsGame();
  const owner = g.players.find((p) => p.hand.some((c) => c.id === 'ecaz-recruits'))!;
  const atreides = g.players.find((p) => p.faction === 'atreides')!;
  const index = owner.hand.findIndex((c) => c.id === 'ecaz-recruits');
  // A conserved fixture exchange gives the free-rate faction the actual card.
  [owner.hand[index], atreides.hand[0]] = [atreides.hand[0], owner.hand[index]];
  return g;
}
const render = (g: Game, viewer = 'at', busy = false) => renderToStaticMarkup(
  createElement(Recruits, { game: viewGame(g, viewer), act() {}, busy }),
);
function allowRevival(g: Game) {
  for (let step = 0; g.pendingRevival && step < 20; step++) {
    let next: Game | undefined;
    for (const p of g.players) {
      const view = viewGame(g, p.id);
      view.players.find((player) => player.id === p.id)!.bot = 'Easy';
      const action = botActions(view)[0];
      if (action) { next = applyAction(g, p.id, action); break; }
    }
    assert.ok(next, 'Revival decisions must have legal continuation.');
    g = next;
  }
  assert.equal(g.pendingRevival, null);
  return g;
}

void test('Recruits owner has an accessible physical-card action; rivals cannot infer its owner before play', () => {
  const g = ownerGame(), html = render(g);
  assert.match(html, /Play Recruits · Discard card/);
  assert.match(html, /Current revival rates/);
  assert.match(html, /Unlimited/);
  assert.doesNotMatch(html, /disabled=""/);
  assert.match(render(g, 'at', true), /disabled=""/);
  assert.equal(render(g, 'fr'), '');
  assert.equal(viewGame(g, 'fr').recruitsPreview?.play, null);
  const card = g.players[0].hand.find((c) => c.id === 'ecaz-recruits')!;
  assert.ok(cardPresentation(card).topics.some((topic) => topic.id === 'card-recruits'));
});

void test('late-paid controls allow provisional Recruits without refunding prior paid returns', () => {
  const paid = allowRevival(applyAction(ownerGame(), 'at', { type: 'revive', amount: 3 }));
  assert.equal(paid.players[0].revived, 3);
  assert.equal(paid.players[0].freeForcesRevived, 2);
  assert.equal(paid.players[0].spice, 18);
  const preview = viewGame(paid, 'at').recruitsPreview;
  assert.equal(preview?.play?.blocked, null);
  const action = recruitsPlayAction(preview);
  assert.deepEqual(action, { type: 'card', card: 'ecaz-recruits' });
  assert.ok(action);
  assert.match(render(paid), /Play Recruits · Discard card/);
  assert.doesNotMatch(render(paid), /disabled=""/);
  const played = applyAction(paid, 'at', action);
  assert.deepEqual(played.recruits, { turn: paid.turn, player: 'at', card: 'ecaz-recruits' });
  assert.equal(played.discard.filter((card) => card.id === 'ecaz-recruits').length, 1);
  assert.ok(!played.players[0].hand.some((card) => card.id === 'ecaz-recruits'));
  assert.deepEqual(played.players.map((player) => player.spice), paid.players.map((player) => player.spice));
  assert.equal(played.players[0].revived, 3);
  assert.equal(played.players[0].freeForcesRevived, 2);
  assert.equal(viewGame(played, 'at').revival.freeRemaining, 2);
  assert.equal(viewGame(played, 'at').revival.forcesRemaining, 4);
  const free = allowRevival(applyAction(played, 'at', { type: 'revive', amount: 2 }));
  assert.equal(free.players[0].revived, 5);
  assert.equal(free.players[0].freeForcesRevived, 4);
  assert.equal(free.players[0].spice, paid.players[0].spice);
  assert.equal(viewGame(free, 'at').revival.freeRemaining, 0);
  assert.equal(viewGame(free, 'at').revival.forcesRemaining, 2);
});

void test('missing and inconsistent ledgers, pending transactions, wrong phase and replay remain immutable guards', () => {
  const paid = allowRevival(applyAction(ownerGame(), 'at', { type: 'revive', amount: 3 }));
  const missing = structuredClone(paid);
  delete missing.players[0].freeForcesRevived;
  const inconsistent = structuredClone(paid);
  inconsistent.players[0].freeForcesRevived = inconsistent.players[0].revived + 1;
  const pending = applyAction(ownerGame(), 'at', { type: 'revive', amount: 3 });
  assert.ok(pending.pendingRevival);
  const wrongPhase = ownerGame();
  wrongPhase.phase = 5;
  const active = applyAction(ownerGame(), 'at', { type: 'card', card: 'ecaz-recruits' });
  const recovered = structuredClone(active);
  const [card] = recovered.discard.splice(recovered.discard.findIndex((held) => held.id === 'ecaz-recruits'), 1);
  assert.ok(card);
  recovered.players[0].hand.push(card);
  for (const [label, g] of [
    ['missing ledger', missing],
    ['inconsistent ledger', inconsistent],
    ['pending transaction', pending],
    ['wrong phase', wrongPhase],
    ['already-active recovered copy', recovered],
  ] as const) {
    const before = structuredClone(g);
    const preview = viewGame(g, 'at').recruitsPreview;
    assert.ok(preview?.play?.blocked, label);
    assert.equal(recruitsPlayAction(preview), null, label);
    assert.throws(() => applyAction(g, 'at', { type: 'card', card: 'ecaz-recruits' }), label);
    assert.deepEqual(g, before, label);
  }
  const beforeReplay = structuredClone(active);
  assert.throws(() => applyAction(active, 'at', { type: 'card', card: 'ecaz-recruits' }));
  assert.deepEqual(active, beforeReplay);
  assert.match(render(missing), /aria-describedby="recruits-unavailable"/);
  assert.match(render(missing), /disabled=""/);
  assert.equal(render(wrongPhase), '');
  assert.equal(recruitsPlayAction(undefined), null);
});

void test('resolved public rates survive JSON restoration without displaying an extra card action', () => {
  const g = applyAction(ownerGame(), 'at', { type: 'card', card: 'ecaz-recruits' });
  const restored = JSON.parse(JSON.stringify(g)) as Game;
  for (const p of g.players) {
    const html = render(restored, p.id);
    assert.match(html, /Active this turn/);
    assert.doesNotMatch(html, /Play Recruits · Discard card/);
    assert.deepEqual(viewGame(restored, p.id).recruitsPreview, viewGame(g, p.id).recruitsPreview);
  }
});

for (const level of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
  void test(`${level} uses the owned offer once, then legally revives at the doubled rate`, () => {
    let g = ownerGame();
    let view = viewGame(g, 'at');
    view.players.find((p) => p.id === 'at')!.bot = level;
    const action = botActions(view)[0];
    assert.deepEqual(action, { type: 'card', card: 'ecaz-recruits' });
    assert.deepEqual(action, recruitsPlayAction(view.recruitsPreview));
    g = applyAction(g, 'at', action);
    view = viewGame(g, 'at');
    view.players.find((p) => p.id === 'at')!.bot = level;
    const revival = botActions(view).find((candidate) => candidate.type === 'revive');
    assert.ok(revival);
    const done = allowRevival(applyAction(g, 'at', revival));
    assert.ok(done.players[0].revived > 0);
    assert.equal(done.players[0].freeForcesRevived, 4);
    assert.equal(done.discard.filter((c) => c.id === 'ecaz-recruits').length, 1);
    assert.ok(!botActions(view).some((candidate) => candidate.type === 'card' && candidate.card === 'ecaz-recruits'));
  });
}

void test('all AI profiles skip the unresolved late Fremen grant while using other legal revival choices', () => {
  let g = ownerGame();
  g.players[0].ally = 'fr'; g.players[1].ally = 'at';
  g = applyAction(g, 'at', { type: 'card', card: 'ecaz-recruits' });
  for (const level of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const view = viewGame(g, 'fr');
    view.players.find((p) => p.id === 'fr')!.bot = level;
    const actions = botActions(view);
    assert.ok(actions.length);
    assert.ok(!actions.some((action) => action.type === 'grantRevival'));
    assert.doesNotThrow(() => applyAction(g, 'fr', actions[0]));
  }
});
