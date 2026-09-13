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

void test('late-paid and wrong-phase controls stay guarded through the shared action adapter', () => {
  let g = ownerGame();
  g = allowRevival(applyAction(g, 'at', { type: 'revive', amount: 3 }));
  const preview = viewGame(g, 'at').recruitsPreview;
  assert.match(preview?.play?.blocked ?? '', /paid normal force revival/);
  assert.equal(recruitsPlayAction(preview), null);
  assert.match(render(g), /aria-describedby="recruits-unavailable"/);
  assert.match(render(g), /disabled=""/);
  g.phase = 5;
  assert.equal(render(g), '');
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
