import assert from 'node:assert/strict';
import test from 'node:test';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { TERRITORIES, gameDistance, splitLocation } from '../game/board';
import { createTruthMovementChoamFixture } from './fixture-truth-movement-choam';
import { viewGame, normalizeAutomaticGame, type Game } from '../game/engine';
import { createTruthMovementBoxFixture, actTruthMovementBox as act } from './fixture-truth-movement-box';

function ask(game: Game, asker: string, card: string, question: Record<string, unknown>) {
  game = act(game, asker, { type: 'card', card });
  for (const p of game.players) if (!game.truthtrance!.passed.includes(p.id)) game = act(game, p.id, { type: 'truthPass' });
  return act(game, asker, { type: 'truthAsk', question });
}
void test('actual owned paid Box recovery makes a third Basic movement promise feasible', () => {
  const f = createTruthMovementBoxFixture();
  const game = ask(f.game, f.asker, f.truth, f.claim);
  assert.ok(viewGame(game, f.target).truthMovementAnswers!.includes('yes'));
});

function passDiscard(game: Game): Game {
  if (!game.pendingTreacheryDiscard?.reaction) return game;
  const event = game.pendingTreacheryDiscard.batch.event;
  for (const p of game.players) game = act(game, p.id, { type: 'semutaPass', event });
  return game;
}
function bindBox(answer: 'yes' | 'no' = 'yes') {
  const f = createTruthMovementBoxFixture();
  let game = ask(f.game, f.asker, f.truth, f.claim);
  game = act(game, f.target, { type: 'truthAnswer', answer });
  game = passDiscard(game); return { f, game };
}
void test('the actual paid search selects required Hajr once and finishes the third move without a second fee', () => {
  const { f, game: bound } = bindBox(); let game = bound;
  const before = structuredClone(game), first = viewGame(game, f.target).movementPromisePolicy?.[0];
  assert.deepEqual(first, { type: 'card', card: f.box });
  assert.deepEqual(game, before, 'Private feasibility cannot pay or shuffle the live game');
  game = act(game, f.target, first!);
  assert.equal(game.players.find(p => p.id === f.target)!.spice, 0);
  const paid = viewGame(game, f.target).nullentropy!.search!;
  assert.ok(paid.cards.some(card => card.id === f.hajr)); assert.ok(paid.cards.some(card => card.id === f.truth));
  const required = viewGame(game, f.target).movementPromisePolicy?.[0];
  assert.deepEqual(required, { type: 'decision', event: paid.event, card: f.hajr });
  const snapshot = structuredClone(game);
  assert.throws(() => act(game, f.target, { type: 'decision', event: paid.event, card: f.truth }));
  assert.deepEqual(game, snapshot, 'Rejected selection keeps the paid event and fee');
  assert.throws(() => act(game, f.target, { type: 'decision', event: 'stale', card: f.hajr }));
  game = act(game, f.target, required!); game = passDiscard(game);
  assert.equal(game.pendingNullentropy, null);
  const hajr = viewGame(game, f.target).movementPromisePolicy?.[0]; assert.deepEqual(hajr, { type: 'card', card: f.hajr });
  game = act(game, f.target, hajr!); game = passDiscard(game);
  game = act(game, f.target, viewGame(game, f.target).movementPromisePolicy![0]);
  assert.equal(game.movementPromises![0].fulfilled, true);
  game = act(game, f.target, { type: 'endMovement' });
  assert.equal(game.players.find(p => p.id === f.target)!.spice, 0);
  assert.equal(game.players.find(p => p.id === f.target)!.hajrPlays, 2);
  assert.equal(game.discard.filter(card => card.id === f.box).length, 1);
  assert.equal(game.discard.filter(card => card.id === f.hajr).length, 1);
});

void test('a No-only paid search retains its full original choice and never proposes End movement while searching', () => {
  const { f, game: bound } = bindBox('no'); let game = act(bound, f.target, { type: 'card', card: f.box });
  assert.equal(viewGame(game, f.target).movementPromisePolicy, null);
  const search = viewGame(game, f.target).nullentropy!.search!;
  assert.ok(search.cards.some(card => card.id === f.truth));
  game = act(game, f.target, { type: 'decision', event: search.event, card: f.truth });
  game = passDiscard(game);
  assert.equal(game.movementPromises![0].fulfilled, undefined);
  game = act(game, f.target, { type: 'endMovement' });
  assert.equal(game.movementPromises![0].fulfilled, true);
  assert.equal(game.players.find(p => p.id === f.target)!.spice, 0);
});
void test('a voluntary bribe cannot spend the Box fee reserved by the only remaining Yes route', () => {
  const { f, game } = bindBox(); const before = structuredClone(game);
  const view = viewGame(game, f.target);
  assert.equal(view.bribeOptions.targets.find(target => target.id === f.asker)!.maximum, 0);
  assert.throws(() => act(game, f.target, { type: 'bribe', target: f.asker, amount: 1 }));
  assert.deepEqual(game, before);
});
void test('controlled full-hand recovery keeps the approved atomic Box exchange and original paid event', () => {
  const f = createTruthMovementBoxFixture();
  const source = structuredClone(f.game), owner = source.players.find(p => p.id === f.target)!;
  while (owner.hand.length < 4) owner.hand.push(source.deck.pop()!);
  let game = ask(source, f.asker, f.truth, f.claim);
  assert.ok(viewGame(game, f.target).truthMovementAnswers!.includes('yes'));
  game = passDiscard(act(game, f.target, { type: 'truthAnswer', answer: 'yes' }));
  game = act(game, f.target, viewGame(game, f.target).movementPromisePolicy![0]);
  const search = viewGame(game, f.target).nullentropy!.search!;
  game = act(game, f.target, { type: 'decision', event: search.event, card: f.hajr });
  assert.equal(game.players.find(p => p.id === f.target)!.hand.length, 4);
  assert.equal(game.players.find(p => p.id === f.target)!.spice, 0);
});

void test('controlled legacy certainty cannot inspect hidden Box contents before payment', () => {
  const f = createTruthMovementBoxFixture(), unknown = structuredClone(f.game);
  delete unknown.movementDiscardKnowledge;
  const changed = structuredClone(unknown), index = changed.discard.findIndex(card => card.id === f.hajr);
  const alternate = changed.deck.findIndex(card => card.kind === 'shield'); assert.ok(alternate >= 0);
  [changed.discard[index], changed.deck[alternate]] = [changed.deck[alternate], changed.discard[index]];
  for (const source of [unknown, changed]) {
    const game = ask(source, f.asker, f.truth, f.claim), view = viewGame(game, f.target);
    assert.deepEqual(view.truthMovementAnswers, ['no']);
    assert.equal(Object.hasOwn(view, 'movementDiscardKnowledge'), false);
    assert.equal(view.nullentropy?.search, null);
  }
});
void test('a controlled opposing loss of the fee releases the Box-dependent Yes while keeping its actual pieces', () => {
  const { f, game: bound } = bindBox(); const harmed = structuredClone(bound);
  harmed.players.find(p => p.id === f.target)!.spice--;
  harmed.players.find(p => p.id === f.asker)!.spice++;
  const game = normalizeAutomaticGame(harmed);
  assert.equal(game.movementPromises![0].released, true);
  assert.ok(game.players.find(p => p.id === f.target)!.hand.some(card => card.id === f.box));
  assert.equal(game.discard.filter(card => card.id === f.hajr).length, 1);
});
function farChoamDestination(game: Game) {
  const destination = TERRITORIES.flatMap(t => t.sectors.map(sector => ({ territory: t.id, sector }))).find(to =>
    gameDistance(game, 'arrakeen:10', `${to.territory}:${to.sector}`, key => {
      const place = splitLocation(key); return place.sector !== 0 && place.sector === game.storm;
    }) === 4);
  assert.ok(destination); return destination;
}
void test('a genuinely held Kulon supplies its original native preparation before a promised four-step move', () => {
  const f = createTruthMovementChoamFixture(), source = f.beforeKulon, destination = farChoamDestination(source);
  let game = ask(source, f.asker, f.truth, { kind: 'movement', target: f.target, territory: destination.territory, minimum: 1 });
  assert.ok(viewGame(game, f.target).truthMovementAnswers!.includes('yes'));
  game = act(game, f.target, { type: 'truthAnswer', answer: 'yes' });
  assert.deepEqual(viewGame(game, f.target).movementPromisePolicy, [{ type: 'card', mode: 'choam', card: f.kulon }]);
  game = act(game, f.target, viewGame(game, f.target).movementPromisePolicy![0]);
  assert.equal(game.choamMovement?.bonus, 1);
  assert.ok(game.movementDiscardKnowledge?.[f.asker].includes(f.kulon), 'Public direct Kulon disposal establishes current-pile certainty');
  game = act(game, f.target, viewGame(game, f.target).movementPromisePolicy![0]);
  assert.equal(game.movementPromises![0].fulfilled, true);
});
void test('a controlled real Karama counter keeps Kulon held/blocked and releases the impossible promised route', () => {
  const f = createTruthMovementChoamFixture(), source = structuredClone(f.beforeKulon), destination = farChoamDestination(source);
  const karama = source.deck.splice(source.deck.findIndex(card => card.effect === 'karama'), 1)[0]; assert.ok(karama);
  source.players.find(p => p.id === f.asker)!.hand.push(karama);
  let game = ask(source, f.asker, f.truth, { kind: 'movement', target: f.target, territory: destination.territory, minimum: 1 });
  game = act(game, f.target, { type: 'truthAnswer', answer: 'yes' });
  game = act(game, f.target, viewGame(game, f.target).movementPromisePolicy![0]);
  assert.equal(game.response?.kind, 'choamWorthless');
  assert.equal(game.movementPromises![0].released, undefined, 'A pending opposing choice does not release the answer');
  game = act(game, f.asker, { type: 'card', card: karama.id, mode: 'cancel' });
  assert.equal(game.movementPromises![0].released, true);
  assert.ok(game.players.find(p => p.id === f.target)!.hand.some(card => card.id === f.kulon));
  assert.equal(game.choamMovement, undefined);
});
void test('all four minimal profiles select the required original paid event and complete real Box recovery', () => {
  const { f, game: bound } = bindBox();
  for (const difficulty of DIFFICULTIES) {
    let game = act(bound, f.target, { type: 'card', card: f.box }), count = 0;
    while (game.phase === 5 && game.active === f.target && count++ < 20) {
      if (game.pendingTreacheryDiscard) { game = passDiscard(game); continue; }
      const view = viewGame(game, f.target); view.players.find(p => p.id === f.target)!.bot = difficulty;
      const action = botActions(view)[0]; assert.ok(action);
      if (game.pendingNullentropy) assert.deepEqual(action, { type: 'decision', event: game.pendingNullentropy.event, card: f.hajr });
      game = act(game, f.target, action);
    }
    assert.ok(count < 20); assert.equal(game.movementPromises![0].fulfilled, true);
    assert.equal(game.players.find(p => p.id === f.target)!.spice, 0);
  }
});
