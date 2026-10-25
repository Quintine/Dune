import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { maxCombatDial } from '../game/combat';
import { quoteStrongholdFactionsBattle } from './fixture-stronghold-factions';
import {
  createSemutaCombatCapabilitiesFixture as fixture, actSemutaCombatCapabilities as act,
  passSemutaCombatCapabilities as pass, claimSemutaCombatCapabilities as claim,
  allowSemutaCombatCapabilities as allow, finishSemutaCombatCapabilities as finish,
  semutaCombatCapabilitiesPlayer as player, semutaCombatCapabilitiesInventory as inventory,
  type SemutaCombatCapabilitiesFixture,
} from './fixture-semuta-combat-capabilities';

const variants = [{ kind: 'kwisatz' as const }, { kind: 'ixElite' as const }];
const physical = (game: Game) => ({
  turn: game.turn, phase: game.phase, active: game.active, order: game.order, ready: game.ready,
  storm: game.storm, spiceDeck: game.spiceDeck, spiceDiscard: game.spiceDiscard,
  movementRemaining: game.movementRemaining, pendingArrivalReaction: game.pendingArrivalReaction,
  players: game.players.map(p => ({ id: p.id, spice: p.spice, reserves: p.reserves, tanks: p.tanks,
    forces: p.forces, elites: p.elites, leaders: p.leaders, moved: p.moved, shipped: p.shipped,
    battleLosses: p.battleLosses, kwisatz: p.kwisatz })),
});
function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}
function nativeSource(f: SemutaCombatCapabilitiesFixture) {
  assert.equal(f.setup.status, 'setup'); assert.equal(f.setup.advanced, f.advanced); assert.equal(f.setup.semutaPreview, true);
  assert.ok(f.beforeStartingDeal.players.every(p => p.hand.length === 0));
  assert.deepEqual(f.game.players.map(p => p.faction), ['richese', 'choam', f.advanced ? 'atreides' : 'ixians', 'emperor']);
  assert.ok(player(f.afterSetup, f.spender).hand.some(card => card.id === f.cost && card.effect === 'karama'));
  assert.equal(f.acquisition.price, 1);
  assert.ok(f.acquisition.steps.some(step => step.actor === f.holder && step.action.type === 'richeseBid' && step.action.amount === 1));
  assert.equal(player(f.acquisition.before, f.holder).spice - player(f.acquisition.after, f.holder).spice, 1);
  assert.equal(player(f.acquisition.after, f.richese).spice - player(f.acquisition.before, f.richese).spice, 1);
  assert.equal(f.shipments.length, 2); assert.equal(f.moves.length, 1);
  for (const shipment of f.shipments) {
    const step = shipment.steps.find(row => row.action.type === 'ship'); assert.ok(step);
    assert.equal(step.action.amount, 1);
    assert.equal(player(shipment.before, step.actor).reserves - player(shipment.after, step.actor).reserves, 1);
    assert.ok(player(shipment.before, step.actor).spice > player(shipment.after, step.actor).spice,
      'Every counter in this battle source is paid by its original native shipment');
  }
  if (f.advanced) {
    assert.ok(f.earningBattle); assert.equal(f.game.turn, 2);
    assert.equal(player(f.earningBattle.before, f.owner).battleLosses, 0);
    assert.ok(f.moves[0].steps.some(step => step.actor === f.owner && step.action.type === 'move' && step.action.amount === 7));
    assert.ok(f.earningBattle.steps.some(step => step.actor === f.owner && step.action.type === 'battlePlan' &&
      step.action.dial === 3.5 && step.action.support === 0));
    assert.equal(f.earningBattle.steps.filter(step => step.action.type === 'traitorCall' && step.action.call === false).length, 2);
    assert.equal(f.earningBattle.steps.filter(step => step.action.type === 'battleOutcomeReady').length, 2);
    assert.equal(f.earningBattle.after.lastBattleContext?.winner, f.owner);
    assert.equal(player(f.earningBattle.after, f.owner).battleLosses, 7);
    assert.equal(player(f.earningBattle.after, f.owner).tanks, 7);
    assert.equal(player(f.game, f.owner).forces['arrakeen:10'], 3);
    assert.equal(player(f.game, f.owner).battleLosses, 7);
    assert.ok(player(f.game, f.spender).traitors.includes(f.ownerLeader), 'The opponent really holds the dealt leader Traitor');
  } else {
    assert.equal(f.earningBattle, null); assert.equal(f.game.turn, 1);
    assert.ok(f.actions.some(step => step.action.type === 'decision' && step.action.card ===
      player(f.afterSetup, f.owner).hand.find(card => card.kind === 'shield')?.id));
    assert.ok(f.moves[0].steps.some(step => step.actor === f.owner && step.action.type === 'move' &&
      JSON.stringify(step.action.forces) === JSON.stringify({ 'polar_sink:0': 1 }) &&
      JSON.stringify(step.action.eliteForces) === JSON.stringify({ 'polar_sink:0': 1 })));
    assert.equal(viewGame(f.game, f.owner).battle?.ownForces?.elite, 1);
    assert.equal(viewGame(f.game, f.owner).battle?.ownForces?.eliteStrength, 2);
  }
  assert.equal(f.game.phase, 6); assert.equal(f.game.response?.kind, f.responseKind);
  assert.equal(f.game.response?.owner, f.owner); assert.equal(f.game.battle?.revealed, false);
  assert.deepEqual(f.game.battle?.plans, {}); assert.deepEqual(f.game.battle, f.originalBattle);
  assert.deepEqual(f.game.response, f.originalResponse); assert.equal(f.game.phaseOpening ?? null, null);
  assert.equal(f.game.pendingTreacheryDiscard ?? null, null); assert.equal(f.game.decision ?? null, null);
  assert.equal(f.originalInventory.length, f.advanced ? 45 : 57);
  assert.deepEqual(inventory(f.game), f.originalInventory); assert.equal(f.sourceActionCount, f.actions.length);
}
function open(f: SemutaCombatCapabilitiesFixture) {
  const game = act(structuredClone(f.game), f.spender, f.action), pending = game.pendingTreacheryDiscard;
  assert.ok(pending); assert.equal(pending.continuation.kind, 'karamaCombatDiscard');
  if (pending.continuation.kind !== 'karamaCombatDiscard') throw Error('Use the original combat capability cost');
  assert.equal(pending.batch.cause, `karama:${f.responseKind}`); assert.equal(pending.reaction?.stage, 'offer');
  assert.deepEqual(pending.batch.entries.map(entry => ({ card: entry.card.id, by: entry.discardedBy, face: entry.publicFace })),
    [{ card: f.cost, by: f.spender, face: true }]);
  assert.deepEqual(pending.continuation.use.response, f.originalResponse);
  assert.deepEqual(pending.continuation.resume.response, f.originalResponse);
  assert.deepEqual(game.battle, f.originalBattle); assert.deepEqual(physical(game), physical(f.game));
  assert.equal(game.response ?? null, null); assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(game.discard.filter(card => card.id === f.cost).length, 1);
  assert.equal(viewGame(game, f.holder).semutaReaction?.canCommit, true);
  assert.deepEqual(inventory(game), f.originalInventory); return game;
}
function beforePlans(state: Game, f: SemutaCombatCapabilitiesFixture, canceled: boolean) {
  assert.equal(state.pendingTreacheryDiscard ?? null, null); assert.deepEqual(physical(state), physical(f.game));
  assert.equal(state.battle?.event, f.originalBattle.event); assert.equal(state.battle?.revealed, false);
  assert.deepEqual(state.battle?.plans, {});
  const steps: { actor: string; action: Action }[] = [], game = finish(state, steps);
  assert.equal(game.response ?? null, null); assert.equal(game.decision ?? null, null);
  assert.equal(game.battle?.event, f.originalBattle.event); assert.deepEqual(game.battle?.powerChecks, []);
  assert.equal(game.battle?.preLeader?.closed, true); assert.equal(game.battle?.preparation, undefined);
  assert.deepEqual(game.battle?.plans, {}); assert.deepEqual(physical(game), physical(f.game));
  assert.ok(steps.every(step => step.action.type !== 'battlePlan' && step.action.type !== 'card'));
  if (f.advanced) {
    assert.equal(game.battle?.kwisatzBlocked ?? false, canceled);
    assert.equal(player(game, f.owner).battleLosses, 7);
    if (canceled) reject(game, f.owner, { ...f.ownerPlan, kwisatz: true });
  } else {
    assert.equal(game.battle?.eliteBlocked?.includes(f.owner) ?? false, canceled);
    const forces = viewGame(game, f.owner).battle!.ownForces!;
    assert.equal(forces.elite, 1); assert.equal(forces.eliteStrength, canceled ? 1 : 2);
    assert.equal(maxCombatDial(forces), canceled ? 1 : 2);
    if (canceled) reject(game, f.owner, { ...f.ownerPlan, dial: 2 });
  }
  const sealed = act(structuredClone(game), f.owner,
    f.advanced ? { ...f.ownerPlan, kwisatz: !canceled } : { ...f.ownerPlan, dial: canceled ? 1 : 2 });
  assert.equal(sealed.battle?.revealed, false); assert.ok(sealed.battle?.plans[f.owner]);
  assert.deepEqual(inventory(sealed), f.originalInventory); return game;
}
function prevented(state: Game, f: SemutaCombatCapabilitiesFixture, claimed: boolean) {
  const game = beforePlans(state, f, true);
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.cost).length, Number(claimed));
  assert.equal(game.discard.filter(card => card.id === f.cost).length, Number(!claimed));
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.semuta).length, Number(!claimed));
  assert.equal(game.discard.filter(card => card.id === f.semuta).length, Number(claimed));
  assert.deepEqual(inventory(game), f.originalInventory); return game;
}

for (const variant of variants) for (const claimed of [false, true]) void test(
  `${variant.kind === 'kwisatz' ? 'Advanced earned KH' : 'Basic native Cyborg'} used cancellation cost Semuta ${claimed ? 'claim' : 'pass'} parks the original battle and resumes one check`, () => {
    const f = fixture(variant); nativeSource(f); const offered = open(f), event = offered.pendingTreacheryDiscard!.batch.event;
    const game = prevented(claimed ? claim(offered, f.holder) : pass(offered), f, claimed);
    reject(game, f.holder, { type: 'semutaCommit', event }); reject(game, f.holder, { type: 'semutaPass', event });
  },
);

void test('earned KH allowance keeps its actual two-strength bonus and protects the genuinely held Traitor; prevention removes both', () => {
  const f = fixture({ kind: 'kwisatz' }); nativeSource(f);
  for (const canceled of [false, true]) {
    let game = canceled ? prevented(pass(open(f)), f, false) : beforePlans(allow(structuredClone(f.game)), f, false);
    game = act(game, f.owner, { ...f.ownerPlan, kwisatz: !canceled });
    game = act(game, f.spender, f.opponentPlan);
    assert.equal(game.battle?.revealed, true); assert.equal(game.battle?.plans[f.owner].kwisatz ?? false, !canceled);
    if (canceled) {
      const called = act(structuredClone(game), f.spender, { type: 'traitorCall', call: true });
      assert.equal(called.battle?.traitorCalls[f.spender], true);
    } else reject(game, f.spender, { type: 'traitorCall', call: true });
    const voters = viewGame(game, f.owner).battle!.traitorVoters;
    for (const voter of voters) game = act(game, voter, { type: 'traitorCall', call: false });
    assert.ok(game.battle?.outcomeWindow && !game.battle.outcomeWindow.closed);
    const quote = quoteStrongholdFactionsBattle(game); assert.ok(quote.scores);
    const strength = player(game, f.owner).leaders.find(row => row.id === f.ownerLeader)!.strength;
    assert.equal(quote.scores[game.battle!.attacker === f.owner ? 'attacker' : 'defender'], strength + (canceled ? 0 : 2));
    assert.equal(player(game, f.owner).battleLosses, 7);
  }
});

void test('Basic Cyborg allowance retains a legal two-strength dial after actual paid shipment and movement', () => {
  const f = fixture({ kind: 'ixElite' }); nativeSource(f);
  const game = beforePlans(allow(structuredClone(f.game)), f, false);
  assert.ok(player(game, f.spender).hand.some(card => card.id === f.cost));
  assert.ok(player(game, f.holder).hand.some(card => card.id === f.semuta));
});

void test('fresh KH and Cyborg cost reactions reject stale foreign and underlying controls without moving the battle cursor', () => {
  for (const variant of variants) {
    const f = fixture(variant), game = open(f), event = game.pendingTreacheryDiscard!.batch.event;
    reject(game, f.holder, { type: 'semutaCommit', event: `${event}:stale` });
    reject(game, f.spender, { type: 'semutaCommit', event }); reject(game, f.spender, f.action);
    reject(game, f.owner, { type: 'passResponse' }); reject(game, f.owner, f.ownerPlan);
    reject(game, f.spender, f.opponentPlan); reject(game, f.owner, { type: 'declineBattlePower' });
    reject(game, f.owner, { type: 'battlePreparationReady', event: f.originalBattle.event });
    assert.deepEqual(game.battle, f.originalBattle); assert.deepEqual(physical(game), physical(f.game));
    prevented(pass(game), f, false);
  }
});

void test('all four minimal profiles legally answer the actual earned-KH and Basic Cyborg used-cost opportunities', () => {
  for (const variant of variants) {
    const f = fixture(variant), offered = open(f), event = offered.pendingTreacheryDiscard!.batch.event;
    for (const difficulty of DIFFICULTIES) {
      const own = viewGame(offered, f.holder); own.players.find(p => p.id === f.holder)!.bot = difficulty;
      const before = structuredClone(own), action = botActions(own)[0]; assert.ok(action, difficulty);
      assert.deepEqual(own, before); assert.ok(action.type === 'semutaPass' || action.type === 'semutaCommit');
      assert.equal(action.event, event);
      let game = act(structuredClone(offered), f.holder, action);
      const claimed = action.type === 'semutaCommit';
      if (game.pendingTreacheryDiscard?.reaction?.stage === 'select') {
        const selecting = viewGame(game, f.holder); selecting.players.find(p => p.id === f.holder)!.bot = difficulty;
        const selected = botActions(selecting)[0]; assert.ok(selected);
        assert.equal(selected.type, 'semutaSelect'); assert.equal(selected.card, f.cost);
        game = act(game, f.holder, selected);
      } else if (game.pendingTreacheryDiscard) game = pass(game);
      prevented(game, f, claimed);
    }
  }
});
