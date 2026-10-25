import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { quoteStrongholdFactionsBattle } from './fixture-stronghold-factions';
import {
  createSemutaAlliedTraitorFixture as fixture, actSemutaAlliedTraitor as act,
  passSemutaAlliedTraitor as pass, claimSemutaAlliedTraitor as claim,
  allowSemutaAlliedTraitor as allow, finishSemutaAlliedTraitor as finish,
  advanceSemutaAlliedTraitor as advance, semutaAlliedTraitorPlayer as player,
  semutaAlliedTraitorInventory as inventory, semutaAlliedTraitorClean as clean,
  type SemutaAlliedTraitorFixture,
} from './fixture-semuta-allied-traitor';

const variants = [
  { advanced: false, last: false }, { advanced: false, last: true },
  { advanced: true, last: false }, { advanced: true, last: true },
];
const physical = (game: Game) => ({
  turn: game.turn, phase: game.phase, storm: game.storm, active: game.active, order: game.order,
  ready: game.ready, spice: game.spice, spiceDeck: game.spiceDeck, spiceDiscard: game.spiceDiscard,
  movementRemaining: game.movementRemaining, aid: game.aid,
  players: game.players.map(p => ({ id: p.id, spice: p.spice, forces: p.forces, elites: p.elites,
    reserves: p.reserves, tanks: p.tanks, leaders: p.leaders, traitors: p.traitors,
    revealedTraitors: p.revealedTraitors, ally: p.ally, shipped: p.shipped, moved: p.moved, battleLosses: p.battleLosses })),
});
function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}
function nativeSource(f: SemutaAlliedTraitorFixture) {
  assert.equal(f.setup.status, 'setup'); assert.equal(f.setup.advanced, f.advanced); assert.equal(f.setup.semutaPreview, true);
  assert.ok(f.beforeStartingDeal.players.every(p => p.hand.length === 0));
  assert.deepEqual(f.game.players.map(p => p.faction), ['richese', 'choam', 'harkonnen', 'emperor', 'fremen']);
  assert.deepEqual(f.afterSetup.players.flatMap(p => p.hand.map(card => card.id)), f.deal);
  assert.equal(player(f.afterSetup, f.owner).hand.length, 2);
  assert.equal(player(f.afterSetup, f.owner).traitors.length, 4);
  assert.ok(player(f.afterSetup, f.owner).traitors.includes(f.traitorId));
  assert.ok(player(f.afterSetup, f.opponent).leaders.some(leader => leader.id === f.traitorId));
  assert.deepEqual(player(f.game, f.owner).traitors, player(f.afterSetup, f.owner).traitors);
  assert.ok(player(f.afterSetup, f.spender).hand.some(card => card.id === f.cost && card.effect === 'karama'));
  assert.equal(Object.keys(player(f.afterSetup, f.richese).forces).length, 0,
    'Richese never supplies a manufactured starting garrison');
  assert.equal(f.acquisition.bid.actor, f.holder); assert.equal(f.acquisition.bid.action.amount, 1);
  assert.equal(player(f.acquisition.before, f.holder).spice - player(f.acquisition.after, f.holder).spice, 1);
  assert.equal(player(f.acquisition.after, f.richese).spice - player(f.acquisition.before, f.richese).spice, 1);
  assert.equal(f.alliance.before.turn, 2); assert.equal(f.alliance.before.phase, 1); assert.equal(f.alliance.before.nexus, true);
  assert.equal(f.alliance.steps.length, 2); assert.ok(f.alliance.steps.every(step => step.action.type === 'alliance'));
  assert.equal(player(f.game, f.owner).ally, f.beneficiary); assert.equal(player(f.game, f.beneficiary).ally, f.owner);
  assert.ok(f.spiceOrder.some(row => row.turn === 2 && 'worm' in row.card));
  assert.equal(f.shipments.length, 2);
  for (const shipment of f.shipments) {
    assert.ok(shipment.steps.some(step => step.actor === shipment.actor && step.action.type === 'ship' &&
      step.action.amount === 1 && step.action.elite === 0));
    assert.equal(player(shipment.before, shipment.actor).spice - player(shipment.after, shipment.actor).spice, shipment.cost);
    assert.equal(player(shipment.before, shipment.actor).reserves - player(shipment.after, shipment.actor).reserves, 1);
    assert.equal(player(shipment.after, shipment.actor).forces[f.location], 1);
  }
  assert.equal(f.reveal.steps.filter(step => step.action.type === 'battlePlan').length, 2);
  assert.equal(f.game.phase, 6); assert.equal(f.game.turn, 2); assert.equal(f.game.battle?.revealed, true);
  assert.equal(f.game.battle?.plans[f.opponent].leader, f.traitorId);
  assert.equal([f.game.battle?.attacker, f.game.battle?.defender].includes(f.owner), false);
  assert.deepEqual(new Set(f.voters), new Set([f.beneficiary, f.opponent, f.owner]));
  assert.equal(f.votes.steps.length, f.last ? 3 : 1);
  assert.deepEqual(f.votes.steps.at(-1), { actor: f.owner, action: { type: 'traitorCall', call: true } });
  assert.equal(f.game.battle?.traitorCalls[f.owner], true);
  assert.equal(Object.keys(f.game.battle!.traitorCalls).length, f.last ? 3 : 1);
  assert.equal(f.game.battle?.outcomeWindow, undefined); assert.equal(f.game.lastBattleContext, undefined);
  assert.ok(f.game.response?.kind === 'harkonnenTraitor'); assert.equal(f.game.response.owner, f.owner);
  assert.deepEqual(f.game.battle, f.originalBattle); assert.deepEqual(f.game.response, f.originalResponse);
  assert.equal(f.game.pendingTreacheryDiscard ?? null, null); assert.equal(f.game.decision ?? null, null);
  assert.equal(f.originalInventory.length, 45); assert.deepEqual(inventory(f.game), f.originalInventory);
  assert.equal(f.sourceActionCount, f.actions.length);
}
function open(f: SemutaAlliedTraitorFixture) {
  const game = act(structuredClone(f.game), f.spender, f.action), pending = game.pendingTreacheryDiscard;
  assert.ok(pending); assert.equal(pending.continuation.kind, 'karamaAlliedTraitorDiscard');
  if (pending.continuation.kind !== 'karamaAlliedTraitorDiscard') throw Error('Use the actual allied Traitor cost');
  assert.equal(pending.batch.cause, 'karama:harkonnenTraitor'); assert.equal(pending.reaction?.stage, 'offer');
  assert.deepEqual(pending.batch.entries.map(entry => ({ card: entry.card.id, by: entry.discardedBy, face: entry.publicFace })),
    [{ card: f.cost, by: f.spender, face: true }]);
  assert.deepEqual(pending.continuation.use.response, f.originalResponse);
  assert.deepEqual(pending.continuation.resume.response, f.originalResponse);
  assert.deepEqual(game.battle, f.originalBattle); assert.deepEqual(physical(game), physical(f.game));
  assert.equal(game.battle?.traitorCalls[f.owner], true); assert.equal(game.response ?? null, null);
  assert.deepEqual(viewGame(game, f.holder).battle?.traitorSubmitted, viewGame(f.game, f.holder).battle?.traitorSubmitted);
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(game.discard.filter(card => card.id === f.cost).length, 1);
  assert.equal(viewGame(game, f.holder).semutaReaction?.canCommit, true);
  assert.deepEqual(inventory(game), f.originalInventory); return game;
}
function canceled(state: Game, f: SemutaAlliedTraitorFixture, claimed: boolean) {
  assert.equal(state.pendingTreacheryDiscard ?? null, null); assert.equal(state.response ?? null, null);
  assert.deepEqual(physical(state), physical(f.game)); assert.equal(state.battle?.event, f.originalBattle.event);
  assert.deepEqual(state.battle?.plans, f.originalBattle.plans);
  assert.deepEqual(state.battle?.traitorCalls, { ...f.originalBattle.traitorCalls, [f.owner]: false });
  assert.equal(!!state.battle?.outcomeWindow, f.last,
    'Only the all-voters branch advances to the real final battle window');
  assert.equal(state.lastBattleContext, undefined);
  assert.equal(player(state, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(player(state, f.holder).hand.filter(card => card.id === f.cost).length, Number(claimed));
  assert.equal(state.discard.filter(card => card.id === f.cost).length, Number(!claimed));
  assert.equal(player(state, f.holder).hand.filter(card => card.id === f.semuta).length, Number(!claimed));
  assert.equal(state.discard.filter(card => card.id === f.semuta).length, Number(claimed));
  assert.deepEqual(player(state, f.owner).traitors, player(f.game, f.owner).traitors);
  reject(state, f.spender, f.action);
  assert.deepEqual(inventory(state), f.originalInventory); return state;
}
function votesThenOutcome(state: Game, f: SemutaAlliedTraitorFixture, prevented: boolean) {
  const votes: { actor: string; action: Action }[] = [];
  const ready = advance(state, game => !!game.battle?.outcomeWindow && clean(game), votes);
  assert.equal(ready.battle?.event, f.originalBattle.event); assert.equal(ready.battle?.revealed, true);
  assert.deepEqual(ready.battle?.plans, f.originalBattle.plans);
  assert.equal(ready.battle?.traitorCalls[f.owner], !prevented);
  assert.equal(votes.filter(step => step.action.type === 'traitorCall').length, f.last ? 0 : 2);
  assert.ok(votes.every(step => step.action.type === 'traitorCall' && step.action.call === false && step.actor !== f.owner));
  assert.deepEqual(physical(ready), physical(f.game));
  const quote = quoteStrongholdFactionsBattle(ready);
  assert.equal(quote.result, prevented ? 'normal' : 'traitor');
  assert.equal(quote.winner, prevented ? f.opponent : f.beneficiary);
  assert.deepEqual(quote.revelations, prevented ? [] : [{ player: f.owner, identity: f.traitorId }]);
  const steps: { actor: string; action: Action }[] = [], game = finish(ready, steps);
  assert.equal(game.battle ?? null, null); assert.equal(game.pendingTreacheryDiscard ?? null, null);
  assert.equal(game.lastBattleContext?.event, f.originalBattle.event);
  assert.equal(game.lastBattleContext?.result, quote.result); assert.equal(game.lastBattleContext?.winner, quote.winner);
  assert.equal(steps.filter(step => step.action.type === 'battleOutcomeReady').length, 2);
  assert.ok(steps.every(step => !['battlePlan', 'traitorCall', 'ship', 'move', 'chooseBattle', 'card'].includes(step.action.type)));
  const winner = quote.winner!, loser = winner === f.opponent ? f.beneficiary : f.opponent;
  assert.equal(player(game, winner).forces[f.location], 1); assert.equal(player(game, loser).forces[f.location] ?? 0, 0);
  assert.equal(player(game, loser).tanks - player(f.game, loser).tanks, 1);
  assert.equal(player(game, f.opponent).leaders.find(leader => leader.id === f.traitorId)?.dead, !prevented);
  assert.deepEqual(player(game, f.owner).traitors, player(f.game, f.owner).traitors);
  assert.deepEqual(inventory(game), f.originalInventory);
  reject(game, f.owner, { type: 'traitorCall', call: true });
  reject(game, f.beneficiary, { type: 'battleOutcomeReady', event: f.originalBattle.event });
  return game;
}

for (const variant of variants) for (const claimed of [false, true]) void test(
  `${variant.advanced ? 'Advanced' : 'Basic'} native allied Harkonnen ${variant.last ? 'last' : 'early'} call cost Semuta ${claimed ? 'claim' : 'pass'} preserves revealed plans and changes only that effective vote`, () => {
    const f = fixture(variant); nativeSource(f); const offered = open(f), event = offered.pendingTreacheryDiscard!.batch.event;
    const game = canceled(claimed ? claim(offered, f.holder) : pass(offered), f, claimed);
    reject(game, f.holder, { type: 'semutaCommit', event }); reject(game, f.holder, { type: 'semutaPass', event });
    votesThenOutcome(game, f, true);
  },
);

void test('native allied Traitor allowance waits missing voters then settles the real held identity as a Traitor win', () => {
  for (const variant of variants) {
    const f = fixture(variant); nativeSource(f); const game = allow(structuredClone(f.game));
    assert.deepEqual(physical(game), physical(f.game)); assert.equal(game.battle?.traitorCalls[f.owner], true);
    assert.ok(player(game, f.spender).hand.some(card => card.id === f.cost));
    assert.ok(player(game, f.holder).hand.some(card => card.id === f.semuta));
    votesThenOutcome(game, f, false);
  }
});

void test('fresh allied-call costs reject stale and underlying controls while the original declaration remains true', () => {
  for (const variant of variants) {
    const f = fixture(variant), game = open(f), event = game.pendingTreacheryDiscard!.batch.event;
    reject(game, f.holder, { type: 'semutaCommit', event: `${event}:stale` });
    reject(game, f.spender, { type: 'semutaCommit', event }); reject(game, f.spender, f.action);
    reject(game, f.holder, { type: 'semutaSelect', event, card: f.traitorId });
    reject(game, f.owner, { type: 'traitorCall', call: false }); reject(game, f.owner, { type: 'passResponse' });
    reject(game, f.beneficiary, f.plans[f.beneficiary]); reject(game, f.opponent, f.plans[f.opponent]);
    for (const voter of f.voters) reject(game, voter, { type: 'traitorCall', call: false });
    reject(game, f.beneficiary, { type: 'battleOutcomeReady', event: f.originalBattle.event });
    assert.deepEqual(game.battle, f.originalBattle); assert.deepEqual(physical(game), physical(f.game));
    canceled(pass(game), f, false);
  }
});

void test('all four minimal profiles legally answer original Basic and Advanced allied-Traitor used costs', () => {
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
      const ready = canceled(game, f, claimed);
      const final = advance(ready, state => !!state.battle?.outcomeWindow && clean(state));
      assert.equal(quoteStrongholdFactionsBattle(final).result, 'normal');
      assert.equal(final.battle?.traitorCalls[f.owner], false);
    }
  }
});
