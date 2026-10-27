import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { actTruthFlightPoison as act, createTruthFlightPoisonFixture,
  truthFlightPoisonAction, truthFlightPoisonInventory, truthFlightPoisonPlayer as player } from './fixture-truth-flight-poison';

/** Genuine bare Basic setup, real cache purchase of Residual Poison, paid
 * shipment and opened battle. The only controlled supplement moves the real
 * Semuta card from the original Richese cache to Guild's hand; acquiring it
 * is not presented as an earned purchase or a separate natural journey. */
function source() {
  const f = createTruthFlightPoisonFixture({ effect: 'residualPoison', advanced: false });
  const game = structuredClone(f.game), holder = 'guild';
  assert.equal(game.semutaPreview, true);
  assert.ok(!game.homeworlds && !game.nexusCards && !game.leaderSkills);
  const index = game.richeseCache!.findIndex(card => card.id === SEMUTA_DRUG_ID);
  assert.ok(index >= 0, 'The original unpurchased Semuta remains in the cache');
  assert.ok(player(game, holder).hand.length < 4);
  player(game, holder).hand.push(game.richeseCache!.splice(index, 1)[0]);
  assert.deepEqual(truthFlightPoisonInventory(game), f.originalCards);
  assert.ok(game.battle?.preLeader && !game.battle.preLeader.closed);
  assert.deepEqual(game.battle.preLeader.ready, []);
  return { ...f, game, holder };
}

function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => act(game, actor, action));
  assert.deepEqual(game, before);
}

function open(f: ReturnType<typeof source>, readyActor: string) {
  const ready = act(f.game, readyActor, { type: 'battlePreparationReady', event: f.event });
  assert.deepEqual(ready.battle!.preLeader!.ready, [readyActor]);
  const before = structuredClone(ready), action = truthFlightPoisonAction(ready, f);
  const pending = act(ready, f.target, action);
  assert.deepEqual(ready, before);
  assert.equal(pending.pendingTreacheryDiscard?.continuation.kind, 'residualPoisonDiscard');
  assert.equal(pending.pendingTreacheryDiscard?.reaction?.stage, 'offer');
  assert.deepEqual(pending.battle!.preLeader!.ready, [readyActor], 'The accepted preparation is held during the offer');
  const earlier = player(ready, f.asker).leaders.filter(leader => leader.dead).map(leader => leader.id);
  const newlyDead = player(pending, f.asker).leaders.filter(leader => leader.dead && !earlier.includes(leader.id));
  assert.equal(newlyDead.length, 1, 'Poison chooses and commits exactly one physical death');
  assert.equal(pending.discard.filter(card => card.id === f.card).length, 1);
  assert.equal(viewGame(pending, f.holder).semutaReaction?.canCommit, true);
  assert.deepEqual(truthFlightPoisonInventory(pending), f.originalCards);
  return { ready, pending, victim: newlyDead[0].id, event: pending.pendingTreacheryDiscard!.batch.event };
}

function react(game: Game, holder: string, event: string, claim: boolean): Game {
  if (claim) return act(game, holder, { type: 'semutaCommit', event });
  let current = game;
  for (const seat of game.players) {
    if (!current.pendingTreacheryDiscard?.reaction) break;
    current = act(current, seat.id, { type: 'semutaPass', event });
  }
  return current;
}

for (const who of ['owner', 'opponent'] as const) for (const claim of [false, true]) {
  void test(`Basic ${who}-ready Residual Poison offers Semuta and ${claim ? 'claim' : 'pass'} resumes once`, () => {
    const f = source(), readyActor = who === 'owner' ? f.target : f.asker;
    const { pending, victim, event } = open(f, readyActor);
    const resumed = react(JSON.parse(JSON.stringify(pending)) as Game, f.holder, event, claim);
    assert.equal(resumed.pendingTreacheryDiscard ?? null, null);
    assert.deepEqual(resumed.battle!.preLeader!.ready, who === 'owner' ? [] : [readyActor],
      'Native Poison reopens its own readiness without erasing its opponent’s readiness');
    assert.equal(player(resumed, f.asker).leaders.find(leader => leader.id === victim)?.dead, true);
    assert.equal(player(resumed, f.asker).leaders.filter(leader => leader.dead).length,
      player(pending, f.asker).leaders.filter(leader => leader.dead).length);
    assert.equal(player(resumed, f.holder).hand.some(card => card.id === f.card), claim);
    assert.equal(resumed.discard.some(card => card.id === SEMUTA_DRUG_ID), claim);
    assert.equal(resumed.discard.some(card => card.id === f.card), !claim);
    assert.deepEqual(truthFlightPoisonInventory(resumed), f.originalCards);
    rejected(resumed, f.holder, { type: 'semutaCommit', event });
  });
}

void test('ready Poison offer rejects stale events and corrupt battle custody without mutation', () => {
  const f = source(), { pending, event, victim } = open(f, f.asker);
  rejected(pending, f.holder, { type: 'semutaCommit', event: `${event}-stale` });
  const corrupt = structuredClone(pending);
  player(corrupt, f.asker).leaders.find(leader => leader.id === victim)!.dead = false;
  rejected(corrupt, f.holder, { type: 'semutaCommit', event });
});

for (const difficulty of DIFFICULTIES) void test(`${difficulty} uses a legal Semuta response after ready Poison`, () => {
  const f = source(), { pending, event } = open(f, f.asker);
  const view = viewGame(pending, f.holder);
  view.players.find(seat => seat.id === f.holder)!.bot = difficulty;
  const action = botActions(view)[0];
  assert.ok(action && (action.type === 'semutaCommit' || action.type === 'semutaPass'));
  let current = act(pending, f.holder, action);
  for (const seat of current.players) {
    if (!current.pendingTreacheryDiscard?.reaction) break;
    const offer = viewGame(current, seat.id).semutaReaction;
    if (offer && !offer.passed) current = act(current, seat.id, { type: 'semutaPass', event });
  }
  assert.equal(current.pendingTreacheryDiscard ?? null, null);
  assert.deepEqual(current.battle!.preLeader!.ready, [f.asker]);
  assert.deepEqual(truthFlightPoisonInventory(current), f.originalCards);
});
