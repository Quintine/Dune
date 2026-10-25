import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, initializeSemutaGameForAudit, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  createSemutaEcazEconomyFixture as fixture, actSemutaEcazEconomy as act,
  passSemutaEcazEconomy as pass, claimSemutaEcazEconomy as claim,
  allowSemutaEcazEconomy as allow, finishSemutaEcazEconomy as finish,
  semutaEcazEconomyPlayer as player, semutaEcazEconomyInventory as inventory,
  semutaEcazEconomyPhysical as physical, semutaEcazEconomyProfile as profile,
  type SemutaEcazOccupyFixture as SemutaEcazEconomyFixture,
  type SemutaEcazEconomyFixture as SemutaEcazEconomySource,
  type SemutaEcazCollectionFixture,
} from './fixture-semuta-ecaz-economy';

const leads = ['ecaz', 'ally'] as const;
const clock = (game: Game) => ({ turn: game.turn, phase: game.phase, active: game.active, ready: game.ready,
  order: game.order, movementRemaining: game.movementRemaining, storm: game.storm,
  spiceDeck: game.spiceDeck, spiceDiscard: game.spiceDiscard });
function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}
function nativeSource(f: SemutaEcazEconomyFixture) {
  assert.equal(f.setup.status, 'setup'); assert.equal(f.setup.advanced, false); assert.equal(f.setup.semutaPreview, true);
  assert.equal(f.setup.ecazOccupyPreview, true); assert.ok(f.beforeStartingDeal.players.every(p => p.hand.length === 0));
  assert.deepEqual(f.afterSetup.players.flatMap(p => p.hand.map(card => card.id)), f.deal);
  assert.ok(player(f.afterSetup, f.spender).hand.some(card => card.id === f.cost && card.effect === 'karama'));
  assert.deepEqual(player(f.afterSetup, f.owner).forces, { 'imperial_basin:9': 6 });
  assert.equal(player(f.afterSetup, f.owner).reserves, 14);
  assert.equal(f.acquisition.bid.actor, f.holder); assert.equal(f.acquisition.bid.action.amount, 1);
  assert.equal(player(f.acquisition.before, f.holder).spice - player(f.acquired, f.holder).spice, 1);
  assert.equal(player(f.acquired, f.ally).spice - player(f.acquisition.before, f.ally).spice, 1);
  assert.equal(f.placement.steps[0].action.token, f.selfToken); assert.equal(f.placement.steps[0].action.territory, f.territory);
  assert.equal(player(f.ecazShipment.before, f.owner).spice - player(f.ecazShipment.after, f.owner).spice, 2);
  assert.equal(player(f.alliance.before, f.ally).spice - player(f.alliance.after, f.ally).spice, 2);
  assert.ok(f.alliance.steps.some(step => step.actor === f.owner && step.action.trigger === true && step.action.choice === 'alliance'));
  assert.ok(f.alliance.steps.some(step => step.actor === f.ally && step.action.accept === true));
  assert.ok(f.alliance.steps.some(step => step.actor === f.owner && step.action.loan === false));
  assert.equal(player(f.sharedStronghold, f.owner).ally, f.ally); assert.equal(player(f.sharedStronghold, f.ally).ally, f.owner);
  assert.equal(player(f.sharedStronghold, f.owner).forces[f.location], 2);
  assert.equal(player(f.sharedStronghold, f.ally).forces[f.location], 2);
  assert.equal(f.basicCollectionQuote.collectionBonus, null, 'Basic does not gain the Advanced bank-income source');
  assert.equal(player(f.opponentShipment.before, f.opponent).spice - player(f.opponentShipment.after, f.opponent).spice, 1);
  assert.equal(player(f.game, f.opponent).forces[f.location], 1);
  assert.equal(f.beforeLead.decision?.kind, 'ecazBattleLead'); assert.equal(f.beforeLead.decision?.player, f.owner);
  assert.equal(f.leadAction.lead, f.lead); assert.equal(f.game.battle?.ecazOccupy?.lead, f.lead);
  assert.equal(f.game.battle?.ecazOccupy?.canceled, false); assert.equal(f.game.battle?.revealed, false);
  assert.deepEqual(f.game.battle?.plans, {}); assert.deepEqual(f.game.battle, f.originalBattle);
  assert.deepEqual(f.game.response, f.originalResponse); assert.equal(f.game.response?.kind, 'ecazOccupy');
  assert.equal(f.game.turn, 1); assert.equal(f.game.phase, 6); assert.equal(f.game.pendingAmbassador ?? null, null);
  assert.equal(f.allowedProfile.fixedEcazDial, 1); assert.equal(f.allowedProfile.forceOwner, f.ally);
  assert.equal(f.allowedProfile.maxDial, 3); assert.equal(f.canceledProfile.maxDial, 2);
  assert.equal(f.canceledProfile.forceOwner, f.lead); assert.equal(f.canceledProfile.fixedEcazDial, 0);
  assert.equal(f.originalInventory.length, 45); assert.deepEqual(inventory(f.game), f.originalInventory);
  assert.equal(f.sourceActionCount, f.actions.length);
}
function open(f: SemutaEcazEconomySource) {
  const game = act(structuredClone(f.game), f.spender, f.action), pending = game.pendingTreacheryDiscard;
  assert.ok(pending); assert.equal(pending.continuation.kind, 'karamaEcazMoritaniDiscard');
  if (pending.continuation.kind !== 'karamaEcazMoritaniDiscard') throw Error('Expected the original Ecaz cost');
  assert.equal(pending.batch.cause, `karama:${f.kind}`); assert.equal(pending.reaction?.stage, 'offer');
  assert.deepEqual(pending.batch.entries.map(entry => ({ card: entry.card.id, by: entry.discardedBy, face: entry.publicFace })),
    [{ card: f.cost, by: f.spender, face: true }]);
  assert.deepEqual(pending.continuation.use.response, f.originalResponse);
  assert.deepEqual(pending.continuation.resume.response, f.originalResponse);
  assert.deepEqual(game.battle, f.originalBattle); assert.deepEqual(game.ecazCollection ?? null, f.collection);
  assert.deepEqual(physical(game), f.originalPhysical); assert.deepEqual(clock(game), clock(f.game));
  assert.equal(game.response ?? null, null); assert.equal(game.decision ?? null, null);
  assert.equal(game.discard.filter(card => card.id === f.cost).length, 1);
  assert.equal(viewGame(game, f.holder).semutaReaction?.canCommit, true);
  assert.deepEqual(inventory(game), f.originalInventory); return game;
}
function planEntry(state: Game, f: SemutaEcazEconomyFixture, canceled: boolean) {
  assert.equal(state.pendingTreacheryDiscard ?? null, null); assert.equal(state.battle?.ecazOccupy?.lead, f.lead);
  assert.equal(state.battle?.ecazOccupy?.canceled, canceled); assert.deepEqual(state.battle?.plans, {});
  assert.equal(state.battle?.revealed, false); assert.deepEqual(physical(state), f.originalPhysical);
  const steps: { actor: string; action: Action }[] = [], game = finish(state, steps);
  assert.equal(game.phase, 6); assert.equal(game.turn, 1); assert.equal(game.battle?.event, f.originalBattle.event);
  assert.equal(game.response ?? null, null); assert.equal(game.decision ?? null, null);
  assert.equal(game.battle?.ecazOccupy?.lead, f.lead); assert.equal(game.battle?.ecazOccupy?.canceled, canceled);
  assert.equal(game.battle?.revealed, false); assert.deepEqual(game.battle?.plans, {});
  assert.deepEqual(profile(game), canceled ? f.canceledProfile : f.allowedProfile);
  assert.deepEqual(physical(game), f.originalPhysical); assert.deepEqual(clock(game), clock(f.game));
  assert.deepEqual(new Set(game.battle?.preLeader?.ready), new Set([f.lead, f.opponent]));
  assert.ok(steps.every(step => step.action.type !== 'battlePlan' && step.action.type !== 'card'));
  const otherAlly = f.lead === f.owner ? f.ally : f.owner;
  reject(game, otherAlly, f.canceledPlan);
  if (canceled) reject(game, f.lead, f.allowedPlan);
  const plan = canceled ? f.canceledPlan : f.allowedPlan;
  const sealed = act(structuredClone(game), f.lead, plan);
  assert.equal(sealed.battle?.plans[f.lead]?.dial, plan.dial); assert.equal(sealed.battle?.revealed, false);
  assert.deepEqual(physical(sealed), f.originalPhysical); assert.deepEqual(inventory(sealed), f.originalInventory);
  return game;
}
function denied(state: Game, f: SemutaEcazEconomyFixture, claimed: boolean) {
  const game = planEntry(state, f, true);
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.cost).length, Number(claimed));
  assert.equal(game.discard.filter(card => card.id === f.cost).length, Number(!claimed));
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.semuta).length, Number(!claimed));
  assert.equal(game.discard.filter(card => card.id === f.semuta).length, Number(claimed));
  reject(game, f.spender, f.action); assert.deepEqual(inventory(game), f.originalInventory); return game;
}

for (const lead of leads) for (const claimed of [false, true]) void test(
  `Basic native Occupy ${lead} lead cost Semuta ${claimed ? 'claim' : 'pass'} retains the lead and only disables the combined dial`, () => {
    const f = fixture({ kind: 'ecazOccupy', lead }); nativeSource(f); const offered = open(f);
    denied(claimed ? claim(offered, f.holder) : pass(offered), f, claimed);
  },
);

void test('native Basic Occupy allowance keeps its mandatory free Ecaz contribution and actual Richese variable pool', () => {
  for (const lead of leads) {
    const f = fixture({ kind: 'ecazOccupy', lead }); nativeSource(f);
    const game = planEntry(allow(structuredClone(f.game)), f, false);
    assert.ok(player(game, f.spender).hand.some(card => card.id === f.cost));
    assert.ok(player(game, f.holder).hand.some(card => card.id === f.semuta));
  }
});

void test('native Occupy cost reactions reject stale foreign and underlying lead or plan replies before native preparation', () => {
  for (const lead of leads) {
    const f = fixture({ kind: 'ecazOccupy', lead }), game = open(f), event = game.pendingTreacheryDiscard!.batch.event;
    reject(game, f.holder, { type: 'semutaCommit', event: `${event}:stale` });
    reject(game, f.spender, { type: 'semutaCommit', event }); reject(game, f.spender, f.action);
    reject(game, f.owner, f.leadAction); reject(game, f.owner, { type: 'passResponse' });
    reject(game, f.lead, f.allowedPlan); reject(game, f.opponent, f.opponentPlan);
    const done = denied(pass(game), f, false); reject(done, f.holder, { type: 'semutaCommit', event });
  }
});

void test('all four minimal profiles legally claim or pass Basic native Occupy costs for either earned lead', () => {
  for (const lead of leads) {
    const f = fixture({ kind: 'ecazOccupy', lead }), offered = open(f), event = offered.pendingTreacheryDiscard!.batch.event;
    for (const difficulty of DIFFICULTIES) {
      const own = viewGame(offered, f.holder); own.players.find(p => p.id === f.holder)!.bot = difficulty;
      const proposed = botActions(own)[0]; assert.ok(proposed, difficulty);
      assert.ok(proposed.type === 'semutaPass' || proposed.type === 'semutaCommit'); assert.equal(proposed.event, event);
      let game = act(structuredClone(offered), f.holder, proposed);
      const claimed = proposed.type === 'semutaCommit';
      if (game.pendingTreacheryDiscard?.reaction?.stage === 'select') {
        const selecting = viewGame(game, f.holder); selecting.players.find(p => p.id === f.holder)!.bot = difficulty;
        const selected = botActions(selecting)[0]; assert.ok(selected);
        assert.equal(selected.type, 'semutaSelect'); assert.equal(selected.card, f.cost);
        game = act(game, f.holder, selected);
      } else if (game.pendingTreacheryDiscard) game = pass(game);
      denied(game, f, claimed);
    }
  }
});

function nativeCollectionSource(f: SemutaEcazCollectionFixture) {
  assert.equal(f.lobby.advanced, true); assert.equal(f.setup.advanced, true); assert.equal(f.setup.semutaPreview, true);
  assert.equal(f.setup.status, 'setup'); assert.ok(f.beforeStartingDeal.players.every(p => p.hand.length === 0));
  assert.deepEqual(f.game.players.map(p => p.faction), ['richese', 'choam', 'ecaz', 'emperor']);
  assert.deepEqual(f.afterSetup.players.flatMap(p => p.hand.map(card => card.id)), f.deal);
  assert.ok(player(f.afterSetup, f.spender).hand.some(card => card.id === f.cost && card.effect === 'karama'));
  assert.deepEqual(player(f.afterSetup, f.owner).forces, { 'imperial_basin:9': 6 });
  assert.equal(f.acquisition.bid.actor, f.holder); assert.equal(f.acquisition.bid.action.amount, 1);
  assert.equal(player(f.acquisition.before, f.holder).spice - player(f.acquired, f.holder).spice, 1);
  assert.equal(player(f.acquired, f.ally).spice - player(f.acquisition.before, f.ally).spice, 1);
  assert.equal(player(f.alliance.before, f.ally).spice - player(f.alliance.after, f.ally).spice, 2);
  assert.equal(player(f.ecazShipment.before, f.owner).spice - player(f.ecazShipment.after, f.owner).spice, 2);
  assert.equal(player(f.ordinaryShipment.before, f.holder).spice - player(f.ordinaryShipment.after, f.holder).spice, 2);
  assert.ok(f.ordinaryShipment.steps.some(step => step.actor === f.holder && step.action.type === 'ship' && step.action.amount === 1));
  assert.equal(player(f.game, f.holder).forces['funeral_plain:15'], 1);
  assert.ok(f.alliance.steps.some(step => step.actor === f.owner && step.action.trigger === true && step.action.choice === 'alliance'));
  assert.ok(f.alliance.steps.some(step => step.actor === f.ally && step.action.accept === true));
  assert.ok(f.alliance.steps.every(step => step.action.loan === undefined), 'Advanced alliance needs no fabricated Basic loan reply');
  assert.equal(player(f.game, f.owner).ally, f.ally); assert.equal(player(f.game, f.ally).ally, f.owner);
  assert.equal(player(f.game, f.owner).forces[f.location], 2); assert.equal(player(f.game, f.ally).forces[f.location], 2);
  assert.equal(f.game.turn, 1); assert.equal(f.game.phase, 7); assert.equal(f.game.battle ?? null, null);
  assert.equal(f.game.pendingAmbassador ?? null, null); assert.equal(f.game.phaseOpening ?? null, null);
  assert.equal(f.game.response?.kind, 'ecazCollection'); assert.equal(f.game.response?.owner, f.owner);
  assert.deepEqual(f.game.ecazCollection, f.collection); assert.equal(f.collection.stage, 'response');
  assert.deepEqual(f.allowedQuote.collectionBonus?.strongholds, [f.territory]);
  assert.ok(f.allowedQuote.collectionBonus && f.allowedQuote.collectionBonus.amount > 0);
  const allowed = f.allowedQuote.receipts.find(receipt => receipt.player === f.owner)!;
  const canceled = f.canceledQuote.receipts.find(receipt => receipt.player === f.owner)!;
  assert.equal(allowed.balance - canceled.balance, f.allowedQuote.collectionBonus.amount);
  assert.ok(f.canceledQuote.receipts.find(receipt => receipt.player === f.ally)!.strongholds > 0,
    'The canceled special benefit still has native ordinary allied city income');
  assert.ok(f.canceledQuote.receipts.find(receipt => receipt.player === f.holder)!.desert > 0,
    'An actual paid CHOAM desert cohort gives nonzero ordinary Collection independent of the bank bonus');
  assert.equal(f.sourceActionCount, f.actions.length); assert.equal(f.originalInventory.length, 45);
  assert.deepEqual(inventory(f.game), f.originalInventory);
}
const collectionForces = (game: Game) => game.players.map(p => ({ id: p.id, forces: p.forces, elites: p.elites,
  reserves: p.reserves, tanks: p.tanks, shipped: p.shipped, moved: p.moved, ally: p.ally }));
function collectionOutcome(state: Game, f: SemutaEcazCollectionFixture, canceled: boolean) {
  const steps: { actor: string; action: Action }[] = [], game = finish(state, steps);
  const quote = canceled ? f.canceledQuote : f.allowedQuote;
  assert.equal(game.phase, 7); assert.equal(game.turn, 1); assert.equal(game.response ?? null, null);
  assert.equal(game.decision ?? null, null); assert.equal(game.pendingTreacheryDiscard ?? null, null);
  assert.equal(game.battle ?? null, null); assert.equal(game.ecazCollection?.event, f.collection.event);
  assert.equal(game.ecazCollection?.stage, 'complete'); assert.equal(game.ecazCollection?.canceled, canceled);
  assert.equal(game.ecazCollection?.allocation, null); assert.deepEqual(game.ecazCollection?.settled, []);
  assert.deepEqual(game.spice, quote.spice); assert.deepEqual(collectionForces(game), collectionForces(f.game));
  assert.deepEqual(game.ecazAmbassadors, f.game.ecazAmbassadors); assert.deepEqual(game.dukeVidal, f.game.dukeVidal);
  for (const receipt of quote.receipts) assert.equal(player(game, receipt.player).spice, receipt.balance);
  assert.deepEqual(clock(game), clock(f.game));
  assert.ok(steps.every(step => step.action.type !== 'ship' && step.action.type !== 'card'));
  const balances = game.players.map(p => [p.id, p.spice]), ready = act(structuredClone(game), f.owner, { type: 'ready' });
  assert.equal(ready.phase, 7); assert.deepEqual(ready.players.map(p => [p.id, p.spice]), balances,
    'An original Collection acknowledgement cannot collect or initialize income again');
  assert.deepEqual(ready.ecazCollection, game.ecazCollection);
  reject(game, f.owner, { type: 'passResponse' }); assert.deepEqual(inventory(game), f.originalInventory); return game;
}
function collectionDenied(state: Game, f: SemutaEcazCollectionFixture, claimed: boolean) {
  const game = collectionOutcome(state, f, true);
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.cost).length, Number(claimed));
  assert.equal(game.discard.filter(card => card.id === f.cost).length, Number(!claimed));
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.semuta).length, Number(!claimed));
  assert.equal(game.discard.filter(card => card.id === f.semuta).length, Number(claimed));
  reject(game, f.spender, f.action); return game;
}

for (const claimed of [false, true]) void test(
  `Advanced native Ecaz Collection cost Semuta ${claimed ? 'claim' : 'pass'} credits only the native ordinary collection once`, () => {
    const f = fixture({ kind: 'ecazCollection' }); nativeCollectionSource(f); const offered = open(f);
    collectionDenied(claimed ? claim(offered, f.holder) : pass(offered), f, claimed);
  },
);

void test('native Advanced Ecaz Collection allowance credits the quoted real shared-stronghold bonus once', () => {
  const f = fixture({ kind: 'ecazCollection' }); nativeCollectionSource(f);
  const game = collectionOutcome(allow(structuredClone(f.game)), f, false);
  assert.ok(player(game, f.spender).hand.some(card => card.id === f.cost));
  assert.ok(player(game, f.holder).hand.some(card => card.id === f.semuta));
});

void test('native Advanced Ecaz Collection cost rejects stale foreign and underlying acknowledgements before income', () => {
  const f = fixture({ kind: 'ecazCollection' }), game = open(f), event = game.pendingTreacheryDiscard!.batch.event;
  reject(game, f.holder, { type: 'semutaCommit', event: `${event}:stale` });
  reject(game, f.spender, { type: 'semutaCommit', event }); reject(game, f.spender, f.action);
  reject(game, f.owner, { type: 'passResponse' }); reject(game, f.owner, { type: 'ready' });
  const done = collectionDenied(pass(game), f, false); reject(done, f.holder, { type: 'semutaCommit', event });
});

void test('all four minimal profiles legally claim or pass native Advanced Ecaz Collection costs', () => {
  const f = fixture({ kind: 'ecazCollection' }), offered = open(f), event = offered.pendingTreacheryDiscard!.batch.event;
  for (const difficulty of DIFFICULTIES) {
    const own = viewGame(offered, f.holder); own.players.find(p => p.id === f.holder)!.bot = difficulty;
    const proposed = botActions(own)[0]; assert.ok(proposed, difficulty);
    assert.ok(proposed.type === 'semutaPass' || proposed.type === 'semutaCommit'); assert.equal(proposed.event, event);
    let game = act(structuredClone(offered), f.holder, proposed);
    const claimed = proposed.type === 'semutaCommit';
    if (game.pendingTreacheryDiscard?.reaction?.stage === 'select') {
      const selecting = viewGame(game, f.holder); selecting.players.find(p => p.id === f.holder)!.bot = difficulty;
      const selected = botActions(selecting)[0]; assert.ok(selected);
      assert.equal(selected.type, 'semutaSelect'); assert.equal(selected.card, f.cost);
      game = act(game, f.holder, selected);
    } else if (game.pendingTreacheryDiscard) game = pass(game);
    collectionDenied(game, f, claimed);
  }
});

void test('fresh Advanced Ecaz Semuta initialization preserves original undealt inventories and public preview behavior', () => {
  const f = fixture({ kind: 'ecazCollection' }); nativeCollectionSource(f);
  reject(f.lobby, f.lobby.host, { type: 'start' });
  const ordinaryPreview = act(structuredClone(f.lobby), f.lobby.host, { type: 'start', advancedPreview: true });
  assert.equal(ordinaryPreview.advanced, true); assert.equal(ordinaryPreview.status, 'setup');
  assert.equal(ordinaryPreview.semutaPreview, undefined, 'Normal Advanced preview does not silently gain the private Semuta profile');
  assert.deepEqual(inventory(ordinaryPreview), f.originalInventory);
  const before = structuredClone(f.setup);
  assert.throws(() => initializeSemutaGameForAudit(f.setup)); assert.deepEqual(f.setup, before,
    'The original development initializer cannot overwrite an initialized inventory');
});
