import assert from 'node:assert/strict';
import test from 'node:test';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { TERRITORIES, gameDistance, splitLocation } from '../game/board';
import { createTruthMovementChoamFixture } from './fixture-truth-movement-choam';
import { createBasicSemutaAmbassadorFixture } from './fixture-basic-semuta-ambassador';
import { viewGame, normalizeAutomaticGame, type Game } from '../game/engine';
import { createTruthMovementFixture, actTruthMovement as act, advanceTruthMovement as advance,
  truthMovementPlayer as player, truthMovementInventory as inventory, truthMovementClean as clean } from './fixture-truth-movement';

function ask(game: Game, asker: string, card: string, target: string, minimum = 6, territory = 'carthag') {
  game = act(game, asker, { type: 'card', card });
  for (const p of game.players) if (!game.truthtrance!.passed.includes(p.id)) game = act(game, p.id, { type: 'truthPass' });
  return act(game, asker, { type: 'truthAsk', question: { kind: 'movement', target, territory, minimum } });
}
void test('an original public Basic movement Yes binds a real six-force move before turn end', () => {
  const f = createTruthMovementFixture(), source = structuredClone(f.game);
  let game = ask(f.game, f.asker, f.truthtrance, f.target);
  assert.deepEqual(viewGame(game, f.target).truthMovementAnswers, ['yes', 'no']);
  game = act(game, f.target, { type: 'truthAnswer', answer: 'yes' });
  assert.equal(game.movementPromises?.length, 1);
  assert.throws(() => act(game, f.target, { type: 'endMovement' }));
  const guide = viewGame(game, f.target).movementPromisePolicy;
  assert.ok(guide?.length);
  game = act(game, f.target, { type: 'move', from: 'arrakeen:10', amount: 6, territory: 'carthag', sector: 11 });
  assert.equal(game.movementPromises![0].fulfilled, true);
  game = advance(game, clean);
  game = act(game, f.target, { type: 'endMovement' });
  assert.ok(!game.movementRemaining?.includes(f.target));
  assert.equal(player(game).forces['carthag:11'], 6);
  assert.deepEqual(inventory(game), f.originalCards); assert.deepEqual(f.game, source);
});

void test('a nonmatching first move keeps Yes live until an owned Hajr completion', () => {
  const f = createTruthMovementFixture();
  let game = ask(f.game, f.asker, f.truthtrance, f.target);
  game = act(game, f.target, { type: 'truthAnswer', answer: 'yes' });
  game = act(game, f.target, { type: 'move', from: 'arrakeen:10', amount: 4, territory: 'imperial_basin', sector: 9 });
  game = advance(game, clean);
  assert.equal(game.movementPromises![0].fulfilled, undefined);
  const next = viewGame(game, f.target).movementPromisePolicy?.[0];
  assert.deepEqual(next, { type: 'card', card: f.hajr });
  game = act(game, f.target, next!); game = advance(game, clean);
  game = act(game, f.target, { type: 'move', from: 'arrakeen:10', amount: 6, territory: 'carthag', sector: 11 });
  assert.equal(game.movementPromises![0].fulfilled, true);
  game = advance(game, clean); game = act(game, f.target, { type: 'endMovement' });
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('No survives a nonmatching first move and forbids a later matching Hajr movement', () => {
  const f = createTruthMovementFixture();
  let game = ask(f.game, f.asker, f.truthtrance, f.target);
  game = act(game, f.target, { type: 'truthAnswer', answer: 'no' });
  game = act(game, f.target, { type: 'move', from: 'arrakeen:10', amount: 4, territory: 'imperial_basin', sector: 9 });
  game = advance(game, clean);
  assert.equal(game.movementPromises![0].fulfilled, undefined);
  game = act(game, f.target, { type: 'card', card: f.hajr! }); game = advance(game, clean);
  const before = structuredClone(game);
  assert.throws(() => act(game, f.target, { type: 'move', from: 'arrakeen:10', amount: 6, territory: 'carthag', sector: 11 }));
  assert.deepEqual(game, before);
  game = act(game, f.target, { type: 'endMovement' });
  assert.equal(game.movementPromises![0].fulfilled, true);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('a voluntary nonmatching last movement cannot evade Yes when no Hajr is held', () => {
  const f = createTruthMovementFixture({ hajr: false });
  let game = ask(f.game, f.asker, f.truthtrance, f.target);
  game = act(game, f.target, { type: 'truthAnswer', answer: 'yes' });
  const before = structuredClone(game);
  assert.throws(() => act(game, f.target, { type: 'move', from: 'arrakeen:10', amount: 10, territory: 'imperial_basin', sector: 9 }));
  assert.deepEqual(game, before);
});

void test('controlled second physical Truthtrance binds compatible Yes/No thresholds without aggregating groups', () => {
  const f = createTruthMovementFixture();
  let game = ask(f.game, f.asker, f.truthtrance, f.target);
  game = act(game, f.target, { type: 'truthAnswer', answer: 'yes' });
  // Controlled acquisition of the other original card; the first question,
  // original army, wallets and all movement allowances remain genuine.
  const second = game.deck.splice(game.deck.findIndex(card => card.effect === 'truthtrance'), 1)[0];
  assert.ok(second); player(game, f.asker).hand.push(second);
  game = ask(game, f.asker, second.id, f.target, 7);
  assert.deepEqual(viewGame(game, f.target).truthMovementAnswers, ['yes', 'no']);
  game = act(game, f.target, { type: 'truthAnswer', answer: 'no' });
  game = act(game, f.target, { type: 'move', from: 'arrakeen:10', amount: 6, territory: 'carthag', sector: 11 });
  assert.equal(game.movementPromises![0].fulfilled, true);
  assert.equal(game.movementPromises![1].fulfilled, undefined);
  game = advance(game, clean); game = act(game, f.target, { type: 'endMovement' });
  assert.ok(game.movementPromises!.every(promise => promise.fulfilled));
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('a controlled impossible opposing outcome releases Yes without replaying or altering the original card cost', () => {
  const f = createTruthMovementFixture();
  let game = ask(f.game, f.asker, f.truthtrance, f.target);
  game = act(game, f.target, { type: 'truthAnswer', answer: 'yes' });
  // Explicit outcome staging, not a claim of an unstaged Atomics/Terror source.
  const harmed = structuredClone(game), owner = player(harmed);
  owner.tanks += owner.forces['arrakeen:10']; delete owner.forces['arrakeen:10'];
  game = normalizeAutomaticGame(harmed);
  assert.equal(game.movementPromises![0].released, true);
  assert.equal(game.discard.filter(card => card.id === f.truthtrance).length, 1);
  game = act(game, f.target, { type: 'endMovement' });
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('all four existing profiles answer and fulfill the actual Basic movement commitment legally', () => {
  const f = createTruthMovementFixture();
  const question = ask(f.game, f.asker, f.truthtrance, f.target);
  for (const difficulty of DIFFICULTIES) {
    let game = question, actions = 0;
    while (game.active === f.target && game.phase === 5 && actions++ < 20) {
      const view = viewGame(game, f.target); view.players.find(p => p.id === f.target)!.bot = difficulty;
      if (game.response || game.phaseOpening || game.decision) { game = advance(game, clean); continue; }
      const action = botActions(view)[0]; assert.ok(action); game = act(game, f.target, action);
    }
    assert.ok(actions < 20); assert.equal(game.movementPromises![0].fulfilled, true);
    assert.deepEqual(inventory(game), f.originalCards);
  }
});

function passSemuta(game: Game): Game {
  if (!game.pendingTreacheryDiscard?.reaction) return game;
  const event = game.pendingTreacheryDiscard.batch.event;
  for (const p of game.players) game = act(game, p.id, { type: 'semutaPass', event });
  return game;
}

function ornithopterSource() {
  const f = createBasicSemutaAmbassadorFixture({ effect: 'choam', cacheCard: 'ornithopter', ecazTruth: true });
  const game = act(f.game, f.beneficiary, { type: 'decision', event: f.event, cards: [] });
  const truth = player(game, f.owner).hand.find(card => card.effect === 'truthtrance')!;
  assert.ok(truth); return { ...f, game, asker: f.owner, target: f.holder, truth: truth.id };
}
for (const answer of ['yes', 'no'] as const) void test(`actual bought two-group Ornithopter retains ${answer} after its first nonmatching group`, () => {
  const f = ornithopterSource();
  let game = ask(f.game, f.asker, f.truth, f.target, 1, 'habbanya_ridge_flat');
  game = act(game, f.target, { type: 'truthAnswer', answer });
  assert.equal(game.pendingTreacheryDiscard?.continuation.kind, 'truthtranceDiscard');
  game = passSemuta(game);
  game = act(game, f.target, { type: 'move', from: 'tueks_sietch:5', amount: 1,
    territory: 'south_mesa', sector: 5, movementCard: f.cacheCard, ornithopter: 'twoGroups' });
  game = advance(game, clean);
  assert.equal(game.movementPromises![0].fulfilled, undefined);
  const event = game.ornithopter!.event;
  const second = { type: 'move', from: 'habbanya_ridge_sietch:17', amount: 1,
    territory: 'habbanya_ridge_flat', sector: 17, ornithopterEvent: event };
  if (answer === 'yes') {
    game = act(game, f.target, second);
    assert.equal(game.movementPromises![0].fulfilled, true, 'Physical commitment precedes final card disposal');
    // Native Ecaz retains its existing final-move Semuta boundary; the
    // physical card still retires once before the ordinary entry resumes.
    assert.equal(game.pendingTreacheryDiscard, null);
    game = act(game, f.target, { type: 'endMovement' });
  } else {
    const before = structuredClone(game); assert.throws(() => act(game, f.target, second)); assert.deepEqual(game, before);
    game = act(game, f.target, { type: 'endMovement' });
    assert.equal(game.movementPromises![0].fulfilled, undefined, 'No remains live until the original ending continuation');
    assert.equal(game.pendingTreacheryDiscard?.reaction?.stage, 'offer');
    game = passSemuta(game);
    assert.equal(game.movementPromises![0].fulfilled, true);
  }
  assert.equal(game.discard.filter(card => card.id === f.cacheCard).length, 1);
  assert.deepEqual(inventory(game), f.originalTreachery);
});

void test('a real bought range-three Ornithopter supplies the authoritative Yes completion', () => {
  const f = ornithopterSource();
  let game = ask(f.game, f.asker, f.truth, f.target, 1, 'the_greater_flat');
  assert.deepEqual(viewGame(game, f.target).truthMovementAnswers, ['yes', 'no']);
  game = act(game, f.target, { type: 'truthAnswer', answer: 'yes' });
  assert.equal(game.pendingTreacheryDiscard?.continuation.kind, 'truthtranceDiscard');
  game = passSemuta(game);
  const next = viewGame(game, f.target).movementPromisePolicy?.[0];
  assert.equal(next?.movementCard, f.cacheCard); assert.equal(next?.ornithopter, 'range3');
  game = act(game, f.target, next!);
  assert.equal(game.movementPromises![0].fulfilled, true);
  game = passSemuta(game); game = act(game, f.target, { type: 'endMovement' });
  assert.deepEqual(inventory(game), f.originalTreachery);
});

void test('a controlled opposing loss releases only the impossible Yes and keeps an independent smaller promise', () => {
  const f = createTruthMovementFixture();
  let game = ask(f.game, f.asker, f.truthtrance, f.target);
  game = act(game, f.target, { type: 'truthAnswer', answer: 'yes' });
  const second = game.deck.splice(game.deck.findIndex(card => card.effect === 'truthtrance'), 1)[0];
  assert.ok(second); player(game, f.asker).hand.push(second);
  game = ask(game, f.asker, second.id, f.target, 1, 'imperial_basin');
  assert.ok(viewGame(game, f.target).truthMovementAnswers!.includes('yes'));
  game = act(game, f.target, { type: 'truthAnswer', answer: 'yes' });
  const harmed = structuredClone(game), owner = player(harmed);
  owner.forces['arrakeen:10'] -= 9; owner.tanks += 9;
  game = normalizeAutomaticGame(harmed);
  assert.equal(game.movementPromises![0].released, true);
  assert.equal(game.movementPromises![1].released, undefined);
  assert.ok(viewGame(game, f.target).movementPromisePolicy?.length);
  game = act(game, f.target, viewGame(game, f.target).movementPromisePolicy![0]);
  assert.equal(game.movementPromises![1].fulfilled, true);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('actual native Kulon and city access preserve a four-territory CHOAM movement promise', () => {
  const f = createTruthMovementChoamFixture();
  const destination = TERRITORIES.flatMap(t => t.sectors.map(sector => ({ territory: t.id, sector }))).find(to =>
    gameDistance(f.game, 'arrakeen:10', `${to.territory}:${to.sector}`, key => {
      const location = splitLocation(key); return location.sector !== 0 && location.sector === f.game.storm;
    }) === 4);
  assert.ok(destination);
  let game = ask(f.game, f.asker, f.truth, f.target, 1, destination.territory);
  assert.ok(viewGame(game, f.target).truthMovementAnswers!.includes('yes'));
  game = act(game, f.target, { type: 'truthAnswer', answer: 'yes' });
  const next = viewGame(game, f.target).movementPromisePolicy?.[0]; assert.ok(next);
  assert.equal(next.movementCard, undefined);
  game = act(game, f.target, next);
  assert.equal(game.movementPromises![0].fulfilled, true);
  assert.deepEqual(inventory(game), f.originalCards);
});
