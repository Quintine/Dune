import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame, type Action, type Game } from '../game/engine';
import {
  createSemutaArrivalOverlapFixture as fixture, actSemutaArrivalOverlap as act,
  player, inventory, passCurrentSemuta as pass, claimOverlapSemuta as claim,
  openOverlapAmbassadorGrant as grant, openOverlapTerrorDiscard as terrorDiscard,
  finishOverlapTerror as finishTerror, type SemutaArrivalOverlapFixture,
} from './fixture-semuta-arrival-overlap';

function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => act(game, actor, action));
  assert.deepEqual(game, before);
}
function arrived(game: Game, f: SemutaArrivalOverlapFixture) {
  assert.equal(player(game, f.entrant).forces[f.location], 1);
  assert.equal(player(game, f.entrant).shipped, true);
  assert.equal(player(game, f.entrant).moved, f.arrival === 'movement' ? 1 : 0);
  assert.equal(player(game, f.entrant).spice, f.balances[f.entrant] - Number(f.arrival === 'shipment'));
  for (const p of game.players)
    assert.equal(p.reserves + p.tanks + Object.values(p.forces).reduce((sum, count) => sum + count, 0), 20);
  assert.deepEqual(inventory(game), f.originalInventory);
}
function ambassadorDiscard(source: Game, f: SemutaArrivalOverlapFixture) {
  const entry = source.pendingAmbassador; assert.equal(entry?.stage, 'cards');
  const game = act(source, f.owner, { type: 'decision', event: entry!.event, cards: f.chosenCards });
  assert.equal(game.pendingTreacheryDiscard?.continuation.kind, 'ambassador');
  assert.equal(game.pendingTreacheryDiscard.reaction?.stage, 'offer');
  assert.equal(game.pendingAmbassador, null);
  assert.ok(game.pendingArrivalOverlap, 'The original ordered parent remains while the discard is read');
  assert.deepEqual(viewGame(game, f.claimant).semutaReaction!.candidates, []);
  arrived(game, f); return game;
}
function done(game: Game, f: SemutaArrivalOverlapFixture) {
  assert.ok(!game.pendingArrivalOverlap && !game.pendingAmbassador && !game.pendingTerrorEntry);
  assert.ok(!game.pendingTreacheryDiscard && !game.decision && !game.response);
  assert.equal(game.active, f.entrant); arrived(game, f);
  game = act(game, f.entrant, { type: 'endMovement' });
  assert.ok(!game.movementRemaining?.includes(f.entrant));
  assert.deepEqual(inventory(game), f.originalInventory);
}

for (const first of ['ambassador', 'terror'] as const)
  for (const arrival of ['shipment', 'movement'] as const)
    void test(`actual Basic ${arrival} snapshots both original native owners, ${first} first from real lobby circles`, () => {
      const f = fixture({ effect: 'choam', first, arrival });
      assert.equal(f.setup.status, 'setup'); assert.equal(f.setup.advanced, false);
      assert.equal(f.afterSetup.status, 'playing'); assert.equal(f.game.turn, 2);
      assert.equal(f.game.players.length, 5); assert.equal(f.game.semutaPreview, true);
      assert.ok(f.actions.some(step => step.action.type === 'seatPosition'));
      assert.equal(f.game.moritaniTerror!.placementTurn, 1);
      assert.equal(f.game.ecazAmbassadors!.tokens.find(token => token.id === f.token)!.zone, 'placed');
      assert.ok(f.game.players.every(p => !Object.keys(p.forces).some(key => key.startsWith(f.territory + ':'))));
      let game = act(f.game, f.arrivalStep.actor, f.arrivalStep.action);
      const overlap = game.pendingArrivalOverlap; assert.ok(overlap);
      assert.equal(overlap.first, first); assert.equal(overlap.stage, 'first');
      assert.equal(overlap.entrant, f.entrant); assert.equal(overlap.cause, arrival);
      assert.equal(overlap.ambassadorToken, f.token);
      assert.deepEqual(overlap.terrorTokens, [f.terrorToken]);
      assert.equal(game.decision?.player, first === 'ambassador' ? f.owner : f.moritani);
      arrived(game, f);
      reject(game, f.entrant, { type: 'endMovement' });
      game = first === 'ambassador'
        ? act(game, f.owner, { type: 'decision', event: game.pendingAmbassador!.event, decline: true })
        : act(game, f.moritani, { type: 'decision', decline: true });
      assert.equal(game.pendingArrivalOverlap?.stage, 'second'); arrived(game, f);
      game = first === 'ambassador'
        ? act(game, f.moritani, { type: 'decision', decline: true })
        : act(game, f.owner, { type: 'decision', event: game.pendingAmbassador!.event, decline: true });
      done(game, f);
    });

void test('CHOAM first recovers one private card before Sabotage, pays once and cannot spend the same Semuta twice', () => {
  const f = fixture({ effect: 'choam', first: 'ambassador', arrival: 'movement' });
  let game = grant(f.game, f);
  const beforeDiscard = structuredClone(game);
  game = ambassadorDiscard(game, f);
  const firstEvent = game.pendingTreacheryDiscard!.batch.event;
  const overlap = structuredClone(game.pendingArrivalOverlap);
  assert.equal(player(game, f.owner).spice, player(beforeDiscard, f.owner).spice + 6);
  reject(game, f.moritani, { type: 'decision', reveal: true });
  game = act(game, f.claimant, { type: 'semutaCommit', event: firstEvent });
  assert.equal(game.pendingTreacheryDiscard?.reaction?.stage, 'select');
  assert.deepEqual(viewGame(game, f.claimant).semutaReaction!.candidates.map(card => card.id), f.chosenCards);
  assert.deepEqual(game.pendingArrivalOverlap, overlap);
  for (const p of game.players.filter(p => p.id !== f.claimant))
    assert.deepEqual(viewGame(game, p.id).semutaReaction!.candidates, []);
  reject(game, f.owner, { type: 'semutaSelect', event: firstEvent, card: f.chosenCards[0] });
  game = act(game, f.claimant, { type: 'semutaSelect', event: firstEvent, card: f.chosenCards[0] });
  assert.equal(game.pendingArrivalOverlap?.stage, 'second');
  assert.equal(game.pendingTerrorEntry?.stage, 'offer');
  assert.equal(player(game, f.owner).spice, player(beforeDiscard, f.owner).spice + 6);
  assert.ok(player(game, f.claimant).hand.some(card => card.id === f.chosenCards[0]));
  game = terrorDiscard(game, f);
  assert.equal(game.pendingTreacheryDiscard?.reaction?.stage, 'offer');
  assert.notEqual(game.pendingTreacheryDiscard.batch.event, firstEvent);
  for (const p of game.players) assert.equal(viewGame(game, p.id).semutaReaction!.canCommit, false);
  reject(game, f.claimant, { type: 'semutaCommit', event: firstEvent });
  game = finishTerror(pass(game), f, { give: true });
  assert.ok(player(game, f.entrant).hand.some(card => card.id === f.gift));
  assert.equal(game.discard.filter(card => card.id === f.semuta).length, 1);
  assert.equal(player(game, f.owner).spice, player(beforeDiscard, f.owner).spice + 6);
  done(game, f);
});

void test('Robbery first passes its overflow before a full-hand Ixian claim and one original replacement', () => {
  const f = fixture({ effect: 'ixians', first: 'terror', terror: 'robbery', fullHand: true });
  let game = act(f.game, f.arrivalStep.actor, f.arrivalStep.action);
  const top = game.deck[0].id, size = game.deck.length;
  game = terrorDiscard(game, f);
  assert.equal(game.pendingTreacheryDiscard?.reaction?.stage, 'offer');
  assert.equal(game.pendingTreacheryDiscard.continuation.kind, 'terrorDiscard');
  assert.equal(game.pendingArrivalOverlap?.stage, 'first');
  assert.equal(game.deck.length, size - 1);
  assert.ok(player(game, f.moritani).hand.some(card => card.id === top));
  const terrorEvent = game.pendingTreacheryDiscard.batch.event;
  game = pass(game);
  assert.equal(game.pendingArrivalOverlap?.stage, 'second');
  assert.equal(game.pendingAmbassador?.stage, 'offer');
  game = grant(game, f); const replacement = game.deck[0].id;
  game = ambassadorDiscard(game, f);
  reject(game, f.claimant, { type: 'semutaCommit', event: terrorEvent });
  assert.equal(game.deck.length, size - 1, 'Ixian replacement has not drawn during the fresh discard');
  game = claim(game, f.claimant, f.chosenCards[0]);
  assert.equal(player(game, f.claimant).hand.length, 4);
  assert.ok(player(game, f.claimant).hand.some(card => card.id === f.chosenCards[0]));
  assert.equal(game.deck.length, size - 2);
  assert.ok(player(game, f.owner).hand.some(card => card.id === replacement));
  assert.ok(player(game, f.moritani).hand.some(card => card.id === top));
  assert.equal(game.discard.filter(card => card.id === f.semuta).length, 1);
  done(game, f);
});

void test('Sabotage first spends Semuta on its victim before copied CHOAM creates a distinct discard', () => {
  const f = fixture({ effect: 'choam', first: 'terror', arrival: 'movement', copied: true });
  let game = act(f.game, f.arrivalStep.actor, f.arrivalStep.action);
  game = terrorDiscard(game, f);
  const terrorEvent = game.pendingTreacheryDiscard!.batch.event;
  assert.equal(game.pendingTreacheryDiscard!.batch.entries[0].card.id, f.entrantCard);
  game = claim(game, f.claimant, f.entrantCard);
  assert.equal(game.pendingArrivalOverlap?.stage, 'first');
  game = finishTerror(game, f);
  assert.equal(game.pendingArrivalOverlap?.stage, 'second');
  game = grant(game, f);
  assert.equal(game.ecazAmbassadors!.tokens.find(token => token.id === f.token)!.zone, 'removed');
  game = ambassadorDiscard(game, f);
  assert.notEqual(game.pendingTreacheryDiscard!.batch.event, terrorEvent);
  for (const p of game.players) assert.equal(viewGame(game, p.id).semutaReaction!.canCommit, false);
  game = pass(game);
  assert.ok(player(game, f.claimant).hand.some(card => card.id === f.entrantCard));
  assert.equal(game.discard.filter(card => card.id === f.semuta).length, 1);
  done(game, f);
});

void test('Ixian first passes before Robbery overflow recovery without replaying either draw', () => {
  const f = fixture({ effect: 'ixians', first: 'ambassador', terror: 'robbery', arrival: 'movement' });
  let game = grant(f.game, f);
  const size = game.deck.length;
  const ixianDraw = game.deck[0].id;
  game = ambassadorDiscard(game, f);
  const event = game.pendingTreacheryDiscard!.batch.event;
  game = pass(game);
  assert.equal(game.deck.length, size - 1);
  assert.ok(player(game, f.owner).hand.some(card => card.id === ixianDraw));
  const robberyDraw = game.deck[0].id;
  game = terrorDiscard(game, f);
  assert.equal(game.pendingTreacheryDiscard?.reaction?.stage, 'offer');
  assert.notEqual(game.pendingTreacheryDiscard.batch.event, event);
  assert.equal(game.deck.length, size - 2);
  assert.ok(player(game, f.moritani).hand.some(card => card.id === robberyDraw));
  game = claim(game, f.claimant, f.overflowDiscard);
  assert.equal(game.deck.length, size - 2);
  assert.ok(player(game, f.claimant).hand.some(card => card.id === f.overflowDiscard));
  done(game, f);
});

void test('an empty copied CHOAM grant opens no empty fresh group and retains the second native Terror offer', () => {
  const f = fixture({ effect: 'choam', first: 'ambassador', copied: true });
  let game = grant(f.game, f); const spice = player(game, f.owner).spice;
  game = act(game, f.owner, { type: 'decision', event: game.pendingAmbassador!.event, cards: [] });
  assert.ok(!game.pendingTreacheryDiscard);
  assert.equal(player(game, f.owner).spice, spice);
  assert.equal(game.pendingArrivalOverlap?.stage, 'second');
  assert.equal(game.pendingTerrorEntry?.stage, 'offer');
  game = act(game, f.moritani, { type: 'decision', decline: true });
  done(game, f);
});

void test('the Ambassador discard must keep the original shared entry sector and active owner', () => {
  const f = fixture({ effect: 'choam', first: 'ambassador', arrival: 'movement' });
  const game = ambassadorDiscard(grant(f.game, f), f);
  const action: Action = { type: 'semutaPass', event: game.pendingTreacheryDiscard!.batch.event };
  const moved = structuredClone(game), continuation = moved.pendingTreacheryDiscard!.continuation;
  assert.equal(continuation.kind, 'ambassador');
  if (continuation.kind === 'ambassador') continuation.entry.sector = 18;
  reject(moved, f.claimant, action);
  const advanced = structuredClone(game);
  advanced.pendingArrivalOverlap!.stage = 'second';
  reject(advanced, f.claimant, action);
});

void test('the Terror discard must retain the original shared entry amount before Semuta resumes it', () => {
  const f = fixture({ effect: 'ixians', first: 'terror', terror: 'robbery' });
  const game = terrorDiscard(act(f.game, f.arrivalStep.actor, f.arrivalStep.action), f);
  const action: Action = { type: 'semutaPass', event: game.pendingTreacheryDiscard!.batch.event };
  const changed = structuredClone(game), continuation = changed.pendingTreacheryDiscard!.continuation;
  assert.equal(continuation.kind, 'terrorDiscard');
  if (continuation.kind === 'terrorDiscard') continuation.entry.amount++;
  reject(changed, f.claimant, action);
});
