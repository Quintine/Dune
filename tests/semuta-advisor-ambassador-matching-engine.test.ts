import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { isAdvisor } from '../game/advisors';
import { advisorAmbassadorMatchingKey } from '../game/advisor-ambassador-matching';
import {
  createSemutaAdvisorAmbassadorMatchingFixture as fixture, actSemutaAdvisorAmbassadorMatching as act,
  passSemutaAdvisorAmbassadorMatching as pass, claimSemutaAdvisorAmbassadorMatching as claim,
  allowSemutaAdvisorAmbassadorMatching as allow, finishSemutaAdvisorAmbassadorMatching as finish,
  semutaAdvisorAmbassadorMatchingPlayer as player, semutaAdvisorAmbassadorMatchingInventory as inventory,
  semutaAdvisorAmbassadorMatchingPhysical as physical, type SemutaAdvisorAmbassadorMatchingFixture,
} from './fixture-semuta-advisor-ambassador-matching';

const variants = [{ direction: 'fightersToAdvisors' as const }, { direction: 'advisorsToFighters' as const }];
const allowances = (game: Game) => game.players.map(p => ({ id: p.id, spice: p.spice, reserves: p.reserves,
  tanks: p.tanks, elites: p.elites, moved: p.moved, shipped: p.shipped, ally: p.ally, allySinceTurn: p.allySinceTurn }));
function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}
function nativeSource(f: SemutaAdvisorAmbassadorMatchingFixture) {
  assert.equal(f.setup.status, 'setup'); assert.equal(f.setup.advanced, true); assert.equal(f.setup.semutaPreview, true);
  assert.deepEqual(f.setup.expansions, ['choam', 'ecaz']); assert.ok(f.beforeStartingDeal.players.every(p => p.hand.length === 0));
  assert.deepEqual(f.game.players.map(p => p.faction), ['richese', 'choam', 'ecaz', 'beneGesserit', 'atreides', 'emperor']);
  assert.deepEqual(f.afterSetup.players.flatMap(p => p.hand.map(card => card.id)), f.deal);
  assert.ok(player(f.afterSetup, f.spender).hand.some(card => card.id === f.cost && card.effect === 'karama'));
  assert.equal(f.packet.scalars.length, 9); assert.equal(f.packetCreation.steps.length, 1);
  assert.equal(f.packetCreation.steps[0].action.type, 'traitor');
  assert.equal(f.advisorSetup.steps[0].action.type, 'advisorSetup');
  assert.equal(player(f.afterSetup, f.owner).forces['arrakeen:10'], 1);
  assert.equal(player(f.afterSetup, f.entrant).forces['arrakeen:10'], 10);
  assert.equal(isAdvisor(player(f.afterSetup, f.owner), 'arrakeen'), true);
  assert.equal(f.acquisition.bid.actor, f.holder); assert.equal(f.acquisition.bid.action.amount, 1);
  assert.equal(player(f.acquisition.before, f.holder).spice - player(f.acquisition.after, f.holder).spice, 1);
  assert.equal(player(f.acquisition.after, f.richese).spice - player(f.acquisition.before, f.richese).spice, 1);
  assert.equal(player(f.placement.before, f.ecaz).spice - player(f.placement.after, f.ecaz).spice, 1);
  assert.ok(f.placement.steps.some(step => step.actor === f.ecaz && step.action.type === 'decision' && step.action.token === f.token));
  assert.equal(player(f.fighterShipment.before, f.owner).spice - player(f.fighterShipment.after, f.owner).spice, 2);
  assert.equal(player(f.fighterShipment.after, f.owner).forces['tueks_sietch:5'], 2);
  assert.equal(isAdvisor(player(f.fighterShipment.after, f.owner), 'tueks_sietch'), false);
  assert.equal(f.alliance.before.turn, 2); assert.equal(f.alliance.before.phase, 1); assert.equal(f.alliance.before.nexus, true);
  assert.equal(f.alliance.steps.length, 2); assert.ok(f.alliance.steps.every(step => step.action.type === 'alliance'));
  assert.equal(player(f.game, f.owner).ally, f.ecaz); assert.equal(player(f.game, f.ecaz).ally, f.owner);
  assert.ok('worm' in f.wormOrder.card);
  assert.equal(player(f.entrantShipment.before, f.entrant).spice - player(f.entrantShipment.after, f.entrant).spice, 1);
  assert.equal(player(f.entrantShipment.after, f.entrant).forces['carthag:11'], 1);
  assert.equal(f.trigger.before.pendingAmbassador?.stage, 'offer'); assert.equal(f.trigger.after.pendingAmbassador?.stage, 'move');
  assert.equal(f.originalAmbassador.event, f.event); assert.equal(f.originalAmbassador.beneficiary, f.owner);
  assert.equal(f.originalAmbassador.effect, 'fremen'); assert.equal(f.originalAmbassador.entrant, f.entrant);
  assert.equal(f.game.ecazAmbassadors!.tokens.find(t => t.id === f.token)?.zone, 'used');
  assert.deepEqual(f.declaration.steps, [{ actor: f.owner, action: f.relocationAction }]);
  assert.deepEqual(physical(f.declaration.before), f.originalPhysical, 'The selected packet has not relocated before matching');
  assert.equal(f.game.active, f.entrant); assert.notEqual(f.game.active, f.owner);
  assert.deepEqual(Object.keys(f.originalSource).sort(), ['advisors', 'destination', 'event', 'group', 'origin', 'owner', 'parent', 'phase', 'sector', 'turn']);
  assert.equal(f.originalSource.owner, f.owner); assert.equal(f.originalSource.parent, f.event);
  assert.equal(f.originalSource.advisors, f.direction === 'fightersToAdvisors');
  assert.deepEqual(f.originalParent.receipt, f.originalSource);
  assert.equal(f.originalParent.parentSignature, JSON.stringify(f.originalAmbassador));
  assert.deepEqual(f.game.response, f.originalResponse); assert.equal(f.game.phase, 5); assert.equal(f.game.turn, 2);
  assert.equal(f.game.pendingTreacheryDiscard ?? null, null); assert.equal(f.originalInventory.length, 45);
  assert.deepEqual(inventory(f.game), f.originalInventory); assert.equal(f.sourceActionCount, f.actions.length);
}
function open(f: SemutaAdvisorAmbassadorMatchingFixture) {
  const game = act(structuredClone(f.game), f.spender, f.action), pending = game.pendingTreacheryDiscard;
  assert.ok(pending); assert.equal(pending.continuation.kind, 'karamaAdvisorFlipDiscard');
  if (pending.continuation.kind !== 'karamaAdvisorFlipDiscard') throw Error('Use the original precommit Ambassador matching cost');
  assert.equal(pending.batch.cause, 'karama:advisorFlip'); assert.equal(pending.reaction?.stage, 'offer');
  assert.deepEqual(pending.batch.entries.map(entry => ({ card: entry.card.id, by: entry.discardedBy, face: entry.publicFace })),
    [{ card: f.cost, by: f.spender, face: true }]);
  assert.deepEqual(pending.continuation.use.response, f.originalResponse);
  assert.deepEqual(pending.continuation.resume.response, f.originalResponse);
  assert.deepEqual(game.pendingAdvisorAmbassadorMatching, f.originalParent);
  assert.deepEqual(game.pendingAmbassador, f.originalAmbassador); assert.deepEqual(game.ecazAmbassadors, f.originalTokens);
  assert.deepEqual(physical(game), f.originalPhysical); assert.deepEqual(player(game, f.owner).advisors, f.originalStance);
  assert.equal(game.response ?? null, null); assert.equal(game.decision ?? null, null);
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(game.discard.filter(card => card.id === f.cost).length, 1);
  assert.equal(viewGame(game, f.holder).semutaReaction?.canCommit, true);
  assert.deepEqual(inventory(game), f.originalInventory); return game;
}
function canceled(game: Game, f: SemutaAdvisorAmbassadorMatchingFixture, claimed: boolean) {
  assert.equal(game.pendingTreacheryDiscard ?? null, null); assert.equal(game.pendingAdvisorAmbassadorMatching, undefined);
  assert.equal(game.response ?? null, null); assert.equal(game.decision?.kind, 'ecazAmbassador'); assert.equal(game.decision?.player, f.owner);
  assert.deepEqual(game.pendingAmbassador, { ...f.originalAmbassador,
    advisorMatchingDenied: [advisorAmbassadorMatchingKey(f.originalSource)] });
  assert.deepEqual(game.ecazAmbassadors, f.originalTokens); assert.deepEqual(physical(game), f.originalPhysical);
  assert.deepEqual(player(game, f.owner).advisors, f.originalStance);
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.cost).length, Number(claimed));
  assert.equal(game.discard.filter(card => card.id === f.cost).length, Number(!claimed));
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.semuta).length, Number(!claimed));
  assert.equal(game.discard.filter(card => card.id === f.semuta).length, Number(claimed));
  reject(game, f.owner, f.relocationAction); reject(game, f.owner, { ...f.relocationAction, fighters: true });
  reject(game, f.spender, f.action); assert.deepEqual(inventory(game), f.originalInventory); return game;
}
function alternate(game: Game, f: SemutaAdvisorAmbassadorMatchingFixture) {
  const steps: { actor: string; action: Action }[] = [];
  game = act(game, f.owner, f.alternate, steps); game = finish(game, steps);
  assert.equal(game.pendingAmbassador ?? null, null); assert.equal(game.pendingAdvisorAmbassadorMatching, undefined);
  assert.equal(player(game, f.owner).forces['tueks_sietch:5'], 1); assert.equal(player(game, f.owner).forces['polar_sink:0'], 1);
  assert.equal(player(game, f.owner).forces['arrakeen:10'], 1); assert.equal(isAdvisor(player(game, f.owner), 'arrakeen'), true);
  assert.equal(isAdvisor(player(game, f.owner), 'polar_sink'), false);
  assert.deepEqual(allowances(game), allowances(f.game)); assert.deepEqual(game.ecazAmbassadors, f.originalTokens);
  for (const row of physical(game).filter(p => p.id !== f.owner))
    assert.deepEqual(row, f.originalPhysical.find(p => p.id === row.id));
  assert.equal(game.log.filter(row => row.text.includes('through the Fremen Ambassador. Their ordinary')).length, 1);
  assert.ok(steps.every(step => !['ship', 'move', 'card', 'endMovement'].includes(step.action.type)));
  reject(game, f.owner, f.alternate); assert.deepEqual(inventory(game), f.originalInventory); return game;
}

for (const variant of variants) for (const claimed of [false, true]) void test(
  `Advanced native Fremen Ambassador ${variant.direction} matching cost Semuta ${claimed ? 'claim' : 'pass'} keeps its consumed trigger and permits one real legal alternate`, () => {
    const f = fixture(variant); nativeSource(f); const offered = open(f), event = offered.pendingTreacheryDiscard!.batch.event;
    const game = canceled(claimed ? claim(offered, f.holder) : pass(offered), f, claimed);
    reject(game, f.holder, { type: 'semutaCommit', event }); reject(game, f.holder, { type: 'semutaPass', event });
    alternate(game, f);
  },
);

void test('native Fremen Ambassador matching allowance relocates only the selected incoming packet and preserves resident type and ordinary allowances', () => {
  for (const variant of variants) {
    const f = fixture(variant); nativeSource(f); const game = finish(allow(structuredClone(f.game)));
    assert.equal(game.pendingAmbassador ?? null, null); assert.equal(game.pendingAdvisorAmbassadorMatching, undefined);
    assert.equal(player(game, f.owner).forces[f.from] ?? 0, player(f.game, f.owner).forces[f.from] - 1);
    assert.equal(player(game, f.owner).forces[f.to], player(f.game, f.owner).forces[f.to] + 1);
    assert.equal(isAdvisor(player(game, f.owner), f.originalSource.destination), f.direction === 'fightersToAdvisors');
    assert.deepEqual(allowances(game), allowances(f.game)); assert.deepEqual(game.ecazAmbassadors, f.originalTokens);
    for (const row of physical(game).filter(p => p.id !== f.owner))
      assert.deepEqual(row, f.originalPhysical.find(p => p.id === row.id));
    assert.equal(game.log.filter(row => row.text.includes('through the Fremen Ambassador. Their ordinary')).length, 1);
    assert.ok(player(game, f.spender).hand.some(card => card.id === f.cost));
    assert.ok(player(game, f.holder).hand.some(card => card.id === f.semuta));
    assert.deepEqual(inventory(game), f.originalInventory); reject(game, f.owner, f.relocationAction);
  }
});

void test('fresh Fremen Ambassador matching cost rejects stale and underlying controls before any physical relocation', () => {
  for (const variant of variants) {
    const f = fixture(variant), game = open(f), event = game.pendingTreacheryDiscard!.batch.event;
    reject(game, f.holder, { type: 'semutaCommit', event: `${event}:stale` });
    reject(game, f.spender, { type: 'semutaCommit', event }); reject(game, f.spender, f.action);
    reject(game, f.owner, { type: 'passResponse' }); reject(game, f.owner, f.relocationAction);
    reject(game, f.owner, f.alternate); reject(game, f.entrant, { type: 'endMovement' });
    assert.deepEqual(game.pendingAdvisorAmbassadorMatching, f.originalParent);
    assert.deepEqual(game.pendingAmbassador, f.originalAmbassador); assert.deepEqual(physical(game), f.originalPhysical);
    canceled(pass(game), f, false);
  }
});

void test('controlled Fremen matching parent and source mismatches reject before cost and fresh Semuta appropriation', () => {
  const f = fixture();
  // Separate negative copies; the primary programme never installs a parent,
  // receipt, army, stance or source event.
  const changes: ((game: Game) => void)[] = [
    game => { game.pendingAdvisorAmbassadorMatching!.signature += ':changed'; },
    game => { game.pendingAdvisorAmbassadorMatching!.parentSignature += ':changed'; },
    game => { game.pendingAdvisorAmbassadorMatching!.receipt.parent = `${f.event}:stale`; },
  ];
  for (const change of changes) {
    const beforeCost = structuredClone(f.game); change(beforeCost); reject(beforeCost, f.spender, f.action);
    assert.ok(player(beforeCost, f.spender).hand.some(card => card.id === f.cost));
    const offered = open(f), event = offered.pendingTreacheryDiscard!.batch.event; change(offered);
    reject(offered, f.holder, { type: 'semutaCommit', event });
    assert.ok(player(offered, f.holder).hand.some(card => card.id === f.semuta));
    assert.equal(offered.discard.filter(card => card.id === f.cost).length, 1);
  }
});

void test('all four minimal profiles legally answer both native Ambassador matching used costs and propose an actual legal alternate', () => {
  for (const variant of variants) {
    const f = fixture(variant), offered = open(f), event = offered.pendingTreacheryDiscard!.batch.event;
    for (const difficulty of DIFFICULTIES) {
      const own = viewGame(offered, f.holder); own.players.find(p => p.id === f.holder)!.bot = difficulty;
      const before = structuredClone(own), action = botActions(own)[0]; assert.ok(action, difficulty);
      assert.deepEqual(own, before); assert.ok(action.type === 'semutaPass' || action.type === 'semutaCommit'); assert.equal(action.event, event);
      let game = act(structuredClone(offered), f.holder, action); const claimed = action.type === 'semutaCommit';
      if (game.pendingTreacheryDiscard?.reaction?.stage === 'select') {
        const selecting = viewGame(game, f.holder); selecting.players.find(p => p.id === f.holder)!.bot = difficulty;
        const selected = botActions(selecting)[0]; assert.ok(selected);
        assert.equal(selected.type, 'semutaSelect'); assert.equal(selected.card, f.cost); game = act(game, f.holder, selected);
      } else if (game.pendingTreacheryDiscard) game = pass(game);
      game = canceled(game, f, claimed);
      const beneficiary = viewGame(game, f.owner); beneficiary.players.find(p => p.id === f.owner)!.bot = difficulty;
      const proposed = botActions(beneficiary)[0]; assert.ok(proposed); assert.equal(proposed.type, 'decision');
      assert.doesNotThrow(() => applyAction(game, f.owner, proposed));
    }
  }
});
