import assert from 'node:assert/strict';
import { test } from 'node:test';
import { viewGame, type Game } from '../game/engine';
import { baseDeck } from '../game/cards';
import { ordinaryCardAvailability } from '../game/card-availability';
import { botActions } from '../game/bots';
import {
  HAJR_REPLAY_BOX, actHajrReplay, completeHajrReplay, createHajrReplayFixture,
  hajrReplayPlayer as player, type HajrReplayFixture,
} from './fixture-hajr-replay';

const own = (game: Game) => viewGame(game, 'emperor').players.find(player => player.id === 'emperor')!;
const availability = (game: Game, f: HajrReplayFixture) => ordinaryCardAvailability(viewGame(game, f.owner), f.hajr)?.available;
function physicalHajr(game: Game, f: HajrReplayFixture) {
  return [...game.deck, ...game.discard, ...game.players.flatMap(player => player.hand)]
    .filter(card => card.id === f.hajr);
}
function source(f: HajrReplayFixture) {
  assert.equal(baseDeck().filter(card => card.effect === 'hajr').length, 1,
    'This programme reuses the one printed Hajr rather than creating a second physical copy');
  assert.equal(f.box, HAJR_REPLAY_BOX);
  assert.ok(f.actions.some(step => step.actor === f.owner && step.action.type === 'richeseBid' && step.action.amount === 1));
  assert.ok(f.actions.some(step => step.actor === f.owner && step.action.type === 'bid' && step.action.amount === 1));
  assert.ok(player(f.game).hand.some(card => card.id === f.box));
  assert.ok(player(f.game).hand.some(card => card.id === f.hajr));
  assert.equal(physicalHajr(f.game, f).length, 1);
  assert.equal(player(f.beforeShipment).spice - player(f.afterShipment).spice, 6);
  assert.equal(player(f.game).spice, 2, 'The actual purchases and three-counter shipment preserve the Box fee');
  assert.equal(player(f.game).forces[f.source], 3);
  assert.equal(own(f.game).moved, 0);
  assert.equal(own(f.game).movesAllowed, 1);
  assert.equal(own(f.game).hajrUsed, false);
  assert.equal(own(f.game).hajrPlays, 0);
  assert.equal(availability(f.game, f), !f.game.advanced);
}
function settled(f: HajrReplayFixture, result: ReturnType<typeof completeHajrReplay>) {
  const game = result.completed;
  assert.equal(result.moves.length, 3);
  assert.equal(player(game).moved, 3);
  assert.equal(own(game).movesAllowed, 3);
  assert.equal(own(game).hajrUsed, true);
  assert.equal(own(game).hajrPlays, 2);
  assert.equal(game.hajr.filter(actor => actor === f.owner).length, 1,
    'The legacy Hajr summary remains a unique marker rather than a second allowance');
  assert.deepEqual(result.actions.filter(step => step.action.type === 'card' && step.action.card === f.hajr)
    .map(step => step.action.card), [f.hajr, f.hajr]);
  assert.equal(physicalHajr(game, f).length, 1);
  assert.equal(game.discard.filter(card => card.id === f.hajr).length, 1);
  assert.equal(game.discard.filter(card => card.id === f.box).length, 1);
  assert.equal(player(game).spice, player(f.game).spice - 2);
  assert.equal(player(game).reserves, player(f.game).reserves);
  assert.equal(player(game).tanks, player(f.game).tanks);
  assert.equal(Object.values(player(game).forces).reduce((sum, count) => sum + count, 0), 3);
  assert.notEqual(result.game.active, f.owner, 'The actual final endMovement action finishes the native owner turn');
  assert.throws(() => actHajrReplay(game, f.owner, { type: 'card', card: f.hajr }),
    'A third submission after the recovered physical Hajr is discarded cannot grant movement');
}
function recovered(f: HajrReplayFixture, result: ReturnType<typeof completeHajrReplay>) {
  const { recovery } = result;
  assert.equal(player(recovery.before).spice - player(recovery.paid).spice, 2);
  assert.equal(player(recovery.paid).moved, player(recovery.before).moved,
    'Paying for the Box supplies no Force Movement');
  assert.equal(own(recovery.paid).hajrPlays, 1);
  assert.equal(own(result.firstHajr).hajrPlays, 1);
  assert.equal(result.firstHajr.discard.filter(card => card.id === f.hajr).length, 1);
  assert.equal(availability(result.firstHajr, f), false);
  assert.throws(() => actHajrReplay(result.firstHajr, f.owner, { type: 'card', card: f.hajr }),
    'The consumed first-use ID is illegal until the Box actually returns that card');
  assert.equal(player(result.recovered).hand.filter(card => card.id === f.hajr).length, 1);
  assert.equal(result.recovered.discard.some(card => card.id === f.hajr), false);
  assert.equal(physicalHajr(result.recovered, f).length, 1);
  assert.equal(result.recovered.discard.at(-1)!.id, f.box, 'The played Box finishes on top after the real search');
  assert.equal(result.recovered.pendingNullentropy ?? null, null);
  assert.equal(result.recovered.pendingTreacheryDiscard ?? null, null);
  if (recovery.selectionStep) {
    const search = viewGame(recovery.paid, f.owner).nullentropy!.search!;
    assert.equal(recovery.selectionStep.action.event, search.event);
    assert.equal(recovery.selectionStep.action.card, f.hajr);
    assert.ok(search.cards.some(card => card.id === f.hajr));
  } else assert.ok(player(recovery.paid).hand.some(card => card.id === f.hajr),
    'The original Box automatically retrieves its sole eligible discard');
}

void test('genuine Basic paid Box recovers the single discarded Hajr for two grants and three ordinary moves', () => {
  const f = createHajrReplayFixture();
  source(f);
  const result = completeHajrReplay(f);
  recovered(f, result);
  assert.equal(own(result.beforeFirstMove).hajrPlays, 1);
  assert.equal(own(result.beforeFirstMove).movesAllowed, 2);
  assert.equal(player(result.beforeSecondHajr).moved, 1);
  assert.equal(availability(result.recovered, f), true);
  assert.equal(own(result.secondHajr).hajrPlays, 2);
  assert.equal(own(result.secondHajr).movesAllowed, 3);
  assert.equal(player(result.secondHajr).moved, 1);
  assert.equal(player(result.beforeThirdMove).moved, 2);
  settled(f, result);
});

void test('genuine Advanced paid Box recovery waits for the second typed Force Movement before replaying the same Hajr', () => {
  const f = createHajrReplayFixture({ advanced: true });
  source(f);
  assert.equal(player(f.game).elites!.forces[f.source], 2);
  const result = completeHajrReplay(f);
  recovered(f, result);
  assert.equal(own(result.beforeFirstMove).hajrPlays, 0);
  assert.equal(player(result.firstHajr).moved, 1);
  assert.equal(own(result.firstHajr).movesAllowed, 2);
  assert.equal(own(result.recovered).hajrAvailable, false,
    'A Box payment/search is voluntary and cannot open an immediate-after-movement window');
  assert.equal(availability(result.recovered, f), false);
  assert.throws(() => actHajrReplay(result.recovered, f.owner, { type: 'card', card: f.hajr }),
    /Force Movement|move|movement|immediately/i);
  assert.equal(player(result.beforeSecondHajr).moved, 2);
  assert.equal(own(result.beforeSecondHajr).hajrAvailable, true);
  assert.equal(availability(result.beforeSecondHajr, f), true);
  assert.equal(player(result.secondHajr).moved, 2);
  assert.equal(own(result.secondHajr).movesAllowed, 3);
  assert.ok(result.moves.every(move => move.step.action.elite === 1),
    'The same genuinely shipped Sardaukar may take all three ordinary moves');
  assert.equal(Object.values(player(result.completed).elites!.forces).reduce((sum, count) => sum + count, 0), 2);
  settled(f, result);
});

void test('all four minimal policies propose a legal third movement after genuine Basic and Advanced Hajr recovery', () => {
  for (const advanced of [false, true]) {
    const f = createHajrReplayFixture({ advanced });
    const { beforeThirdMove } = completeHajrReplay(f);
    assert.equal(player(beforeThirdMove).moved, 2);
    assert.equal(own(beforeThirdMove).hajrPlays, 2);
    assert.equal(own(beforeThirdMove).movesAllowed, 3);
    for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
      const view = viewGame(beforeThirdMove, f.owner);
      view.players.find(player => player.id === f.owner)!.bot = difficulty;
      const action = botActions(view).find(action => action.type === 'move');
      assert.ok(action, `${difficulty} retains the original recovered-Hajr third move`);
      assert.equal(action.ornithopterEvent, undefined);
      assert.equal(action.movementCard, undefined);
      const next = actHajrReplay(structuredClone(beforeThirdMove), f.owner, action);
      assert.ok(player(next).moved === 3 || next.response || next.decision,
        'The actual policy candidate completes the ordinary move or enters its native response');
    }
  }
});
