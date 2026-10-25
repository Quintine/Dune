import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { validateWormCancellation } from '../game/disaster-preflight';
import {
  createSemutaDisasterWormFixture as fixture, actSemutaDisasterWorm as act,
  passSemutaDisasterWorm as pass, claimSemutaDisasterWorm as claim,
  allowSemutaDisasterWorm as allow, finishSemutaDisasterWorm as finish,
  semutaDisasterWormPlayer as player, semutaDisasterWormInventory as inventory,
  semutaDisasterWormPhysical as physical, type SemutaDisasterWormFixture,
} from './fixture-semuta-disaster-worm';

const variants = [
  { kind: 'wormSurvival' as const, advanced: false },
  { kind: 'wormSurvival' as const, advanced: true },
  { kind: 'wormAllyProtection' as const, advanced: false },
  { kind: 'wormAllyProtection' as const, advanced: true },
  { kind: 'wormPlacement' as const, advanced: true },
  { kind: 'wormSurvival' as const, advanced: true, summoned: true },
];
const clock = (game: Game) => ({ turn: game.turn, phase: game.phase, ready: game.ready, active: game.active,
  storm: game.storm, spiceDeck: game.spiceDeck, spiceDiscard: game.spiceDiscard,
  spiceSequence: game.spiceSequence, spiceResolution: game.spiceResolution, spiceWindow: game.spiceWindow,
  wormRides: game.wormRides, summonedWorm: game.summonedWorm, summonedBeforeBlow: game.summonedBeforeBlow,
  nexus: game.nexus, wormPlacementCanceledTurn: game.wormPlacementCanceledTurn });
const appearances = (game: Game, territory: string) => {
  const name = territory === 'funeral_plain' ? 'Funeral Plain' : 'The Great Flat';
  return game.log.filter(row => row.text === `Shai-Hulud appeared in ${name}.`).length;
};
function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}
function nativeSource(f: SemutaDisasterWormFixture) {
  assert.equal(f.setup.status, 'setup'); assert.equal(f.setup.advanced, f.advanced); assert.equal(f.setup.semutaPreview, true);
  assert.ok(f.beforeStartingDeal.players.every(p => p.hand.length === 0));
  assert.deepEqual(f.game.players.map(p => p.faction), ['richese', 'choam', 'fremen', 'guild', 'emperor']);
  assert.ok(player(f.afterSetup, f.spender).hand.some(card => card.id === f.cost && card.effect === 'karama'));
  assert.ok(player(f.afterSetup, f.owner).hand.some(card => card.id === f.summonCost && card.effect === 'karama'));
  assert.notEqual(f.cost, f.summonCost);
  assert.equal(player(f.afterSetup, f.owner).forces['sietch_tabr:14'], 10);
  if (f.advanced) assert.equal(player(f.afterSetup, f.owner).elites?.reserves, 3);
  assert.equal(f.acquisition.bid.actor, f.holder); assert.equal(f.acquisition.bid.action.amount, 1);
  assert.equal(player(f.acquisition.before, f.holder).spice - player(f.acquired, f.holder).spice, 1);
  assert.equal(player(f.acquired, f.richese).spice - player(f.acquisition.before, f.richese).spice, 1);
  assert.equal(f.shipments.length, 2);
  for (const shipment of f.shipments) {
    assert.ok(shipment.steps.some(step => step.actor === shipment.actor && step.action.type === 'ship' &&
      step.action.amount === 1 && step.action.elite === 0));
    assert.equal(player(shipment.before, shipment.actor).spice - player(shipment.after, shipment.actor).spice, shipment.cost);
    assert.equal(player(shipment.after, shipment.actor).forces[shipment.location], 1);
    assert.equal(player(shipment.before, shipment.actor).reserves - player(shipment.after, shipment.actor).reserves, 1);
  }
  assert.equal(player(f.game, f.owner).forces[f.fremenLocation], 1);
  assert.equal(player(f.game, f.holder).forces[f.allyLocation], 1);
  assert.equal(f.game.turn, f.kind === 'wormAllyProtection' ? 3 : 2); assert.equal(f.game.phase, 1);
  assert.equal(f.game.response?.kind, f.kind); assert.deepEqual(f.game.response, f.originalResponse);
  assert.equal(f.game.phaseOpening ?? null, null); assert.equal(f.game.decision ?? null, null);
  assert.equal(f.game.pendingTreacheryDiscard ?? null, null); validateWormCancellation(f.game, f.game.response!);
  assert.ok(player(f.game, f.holder).hand.some(card => card.id === f.semuta));
  assert.ok(player(f.game, f.spender).hand.some(card => card.id === f.cost));
  if (f.kind === 'wormAllyProtection') {
    assert.ok(f.alliance); assert.equal(f.alliance.steps.length, 2);
    assert.ok(f.alliance.steps.every(step => step.action.type === 'alliance'));
    assert.equal(player(f.game, f.owner).ally, f.holder); assert.equal(player(f.game, f.holder).ally, f.owner);
    assert.equal(player(f.game, f.owner).forces[f.location] ?? 0, 0, 'The protector is genuinely remote');
    assert.equal(f.recipient, f.holder); assert.equal(f.priorSurvivals.length, 1);
  } else {
    assert.equal(f.alliance, null); assert.equal(f.recipient, null);
    assert.equal(player(f.game, f.owner).ally ?? null, null);
  }
  if (f.kind === 'wormPlacement') {
    assert.equal(f.advanced, true); assert.equal(f.beforeDeclaration?.decision?.kind, 'wormPlacement');
    assert.deepEqual(f.nativeAction, { type: 'decision', accept: true, territory: 'funeral_plain' });
    assert.equal(f.priorSurvivals.length, 1); assert.equal(appearances(f.game, f.territory), 1);
    assert.deepEqual(f.originalRides, ['funeral_plain']);
  }
  for (const previous of f.priorSurvivals) {
    assert.equal(previous.before.response?.kind, 'wormSurvival');
    assert.ok(previous.steps.every(step => step.action.type === 'passResponse'));
  }
  if (f.summoned) {
    assert.ok(f.originalSummoned); assert.deepEqual(f.originalSummoned.resume, f.game.summonedWorm!.resume);
    assert.ok(f.summonDiscard, 'The original summon cost really passed its earlier fresh batch');
    assert.ok(f.summonDiscard.steps.every(step => step.action.type === 'semutaPass'));
    assert.equal(player(f.game, f.owner).specialKaramaUsed, true);
    assert.equal(f.game.discard.filter(card => card.id === f.summonCost).length, 1);
    assert.equal(f.game.spiceSequence ?? null, null); assert.equal(f.game.spiceResolution ?? null, null);
  } else assert.equal(f.originalSummoned, null);
  assert.equal(f.originalInventory.length, 45); assert.deepEqual(inventory(f.game), f.originalInventory);
  assert.equal(f.sourceActionCount, f.actions.length);
}
function open(f: SemutaDisasterWormFixture) {
  const game = act(structuredClone(f.game), f.spender, f.action), pending = game.pendingTreacheryDiscard;
  assert.ok(pending); assert.equal(pending.continuation.kind, 'karamaDisasterDiscard');
  if (pending.continuation.kind !== 'karamaDisasterDiscard') throw Error('Expected the original worm cancellation cost');
  assert.equal(pending.batch.cause, `karama:${f.kind}`); assert.equal(pending.reaction?.stage, 'offer');
  assert.deepEqual(pending.batch.entries.map(entry => ({ card: entry.card.id, by: entry.discardedBy, face: entry.publicFace })),
    [{ card: f.cost, by: f.spender, face: true }]);
  assert.deepEqual(pending.continuation.use.response, f.originalResponse);
  assert.deepEqual(pending.continuation.resume.response, f.originalResponse);
  assert.equal(game.response ?? null, null); assert.equal(game.decision ?? null, null);
  assert.deepEqual(physical(game), f.originalPhysical); assert.deepEqual(clock(game), clock(f.game));
  assert.equal(appearances(game, f.territory), appearances(f.game, f.territory));
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(game.discard.filter(card => card.id === f.cost).length, 1);
  assert.equal(viewGame(game, f.holder).semutaReaction?.canCommit, true);
  assert.deepEqual(inventory(game), f.originalInventory); return game;
}
function outcome(state: Game, f: SemutaDisasterWormFixture, canceled: boolean) {
  const beforeFinish = structuredClone(state), finishSteps: { actor: string; action: Action }[] = [];
  const game = finish(state, finishSteps), victim = f.kind === 'wormAllyProtection' ? f.holder : f.owner;
  const loss = Number(canceled && f.kind !== 'wormPlacement');
  assert.equal(game.turn, f.game.turn); assert.equal(game.phase, 2); assert.equal(game.response ?? null, null);
  assert.equal(game.decision ?? null, null); assert.equal(game.pendingTreacheryDiscard ?? null, null);
  assert.equal(game.spiceSequence ?? null, null); assert.equal(game.spiceResolution ?? null, null);
  assert.equal(game.spiceWindow ?? null, null); assert.equal(game.nexus, false); assert.deepEqual(game.wormRides, []);
  assert.equal(game.summonedWorm ?? null, null);
  assert.equal(player(game, victim).forces[f.location] ?? 0, 1 - loss);
  assert.equal(player(game, victim).tanks, player(f.game, victim).tanks + loss);
  assert.equal(player(game, victim).elites?.tanks ?? 0, player(f.game, victim).elites?.tanks ?? 0);
  assert.equal(player(game, f.owner).forces['sietch_tabr:14'], 10);
  for (const p of f.game.players) {
    assert.equal(player(game, p.id).reserves, p.reserves);
    assert.equal(player(game, p.id).elites?.reserves, p.elites?.reserves);
    if (p.id !== victim) {
      assert.deepEqual(player(game, p.id).forces, p.forces); assert.equal(player(game, p.id).tanks, p.tanks);
    }
  }
  assert.equal(appearances(game, f.territory) - appearances(f.game, f.territory),
    Number(!(canceled && f.kind === 'wormPlacement')));
  if (f.kind === 'wormPlacement') {
    assert.equal(game.wormPlacementCanceledTurn ?? null, canceled ? game.turn : f.game.wormPlacementCanceledTurn ?? null);
    if (!canceled) assert.ok(beforeFinish.response?.kind === 'wormSurvival' ||
      finishSteps.some(step => step.action.type === 'passResponse'), 'The later real survival window receives actual passes');
  }
  if (f.kind === 'wormAllyProtection') {
    assert.equal(player(game, f.owner).ally, f.holder); assert.equal(player(game, f.holder).ally, f.owner);
    assert.equal(player(game, f.owner).forces[f.fremenLocation], 1);
  }
  if (f.summoned) {
    assert.equal(player(game, f.owner).specialKaramaUsed, true);
    assert.equal(game.discard.filter(card => card.id === f.summonCost).length, 1);
  }
  assert.ok(finishSteps.every(step => step.action.type !== 'ship' && step.action.type !== 'card'));
  assert.deepEqual(inventory(game), f.originalInventory); return game;
}
function denied(state: Game, f: SemutaDisasterWormFixture, claimed: boolean) {
  const game = outcome(state, f, true);
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.cost).length, Number(claimed));
  assert.equal(game.discard.filter(card => card.id === f.cost).length, Number(!claimed));
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.semuta).length, Number(!claimed));
  assert.equal(game.discard.filter(card => card.id === f.semuta).length, Number(claimed));
  reject(game, f.spender, f.action); return game;
}

for (const variant of variants) for (const claimed of [false, true]) void test(
  `${variant.advanced ? 'Advanced' : 'Basic'} native ${variant.summoned ? 'summoned ' : ''}${variant.kind} cost Semuta ${claimed ? 'claim' : 'pass'} resumes the original worm once`, () => {
    const f = fixture(variant); nativeSource(f); const offered = open(f);
    denied(claimed ? claim(offered, f.holder) : pass(offered), f, claimed);
  },
);

void test('native worm allowances retain protection and resolve actual additional survival and summoned parents', () => {
  for (const variant of variants) {
    const f = fixture(variant); nativeSource(f); const game = outcome(allow(structuredClone(f.game)), f, false);
    assert.ok(player(game, f.spender).hand.some(card => card.id === f.cost));
    assert.ok(player(game, f.holder).hand.some(card => card.id === f.semuta));
  }
});

void test('native worm cost reactions reject stale foreign and underlying replies before any devouring or draw', () => {
  for (const variant of variants) {
    const f = fixture(variant), game = open(f), event = game.pendingTreacheryDiscard!.batch.event;
    reject(game, f.holder, { type: 'semutaCommit', event: `${event}:stale` });
    reject(game, f.spender, { type: 'semutaCommit', event }); reject(game, f.spender, f.action);
    reject(game, f.owner, { type: 'passResponse' }); reject(game, f.owner, { type: 'ready' });
    if (f.nativeAction) reject(game, f.owner, f.nativeAction);
    if (f.summonDiscard) reject(game, f.holder, { type: 'semutaCommit', event: f.summonDiscard.before.pendingTreacheryDiscard!.batch.event });
    const done = denied(pass(game), f, false); reject(done, f.holder, { type: 'semutaCommit', event });
  }
});

void test('all four minimal profiles legally claim or pass native survival ally placement and summoned worm costs', () => {
  for (const variant of variants) {
    const f = fixture(variant), offered = open(f), event = offered.pendingTreacheryDiscard!.batch.event;
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
