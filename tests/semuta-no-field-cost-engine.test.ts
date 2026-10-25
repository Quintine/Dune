import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  createSemutaNoFieldCostFixture as fixture, actSemutaNoFieldCost as act,
  passSemutaNoFieldCost as pass, claimSemutaNoFieldCost as claim,
  allowSemutaNoFieldCost as allow, finishSemutaNoFieldCost as finish,
  semutaNoFieldCostPlayer as player, semutaNoFieldCostInventory as inventory,
  semutaNoFieldCostPhysical as physical, type SemutaNoFieldCostFixture,
} from './fixture-semuta-no-field-cost';

const variants = [
  { kind: 'own' as const, advanced: false }, { kind: 'own' as const, advanced: true },
  { kind: 'allied' as const, advanced: false }, { kind: 'allied' as const, advanced: true },
  { kind: 'ambassador' as const, advanced: false },
];
const clock = (game: Game) => ({ turn: game.turn, phase: game.phase, active: game.active, ready: game.ready,
  order: game.order, movementRemaining: game.movementRemaining, storm: game.storm,
  spiceDeck: game.spiceDeck, spiceDiscard: game.spiceDiscard });
function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}
function nativeSource(f: SemutaNoFieldCostFixture) {
  assert.equal(f.setup.status, 'setup'); assert.equal(f.setup.advanced, f.advanced); assert.equal(f.setup.semutaPreview, true);
  assert.ok(f.beforeStartingDeal.players.every(p => p.hand.length === 0));
  assert.deepEqual(f.afterSetup.players.flatMap(p => p.hand.map(card => card.id)), f.deal);
  assert.ok(player(f.afterSetup, f.spender).hand.some(card => card.id === f.cost && card.effect === 'karama'));
  assert.equal(f.acquisition.bid.actor, f.holder); assert.equal(f.acquisition.bid.action.amount, 1);
  assert.equal(player(f.acquisition.before, f.holder).spice - player(f.acquired, f.holder).spice, 1);
  assert.equal(player(f.acquired, f.owner).spice - player(f.acquisition.before, f.owner).spice, 1);
  assert.deepEqual(player(f.game, f.owner).noField, f.originalNoField);
  assert.deepEqual(f.originalNoField.tokens.map(token => token.value).sort((a, b) => a - b), [0, 3, 5]);
  assert.equal(f.token.value, 5); assert.equal(f.originalNoField.lastShipped, null); assert.equal(f.originalNoField.deployed, null);
  assert.equal(f.game.response?.kind, 'richeseNoField'); assert.equal(f.game.response?.owner, f.owner);
  assert.deepEqual(f.game.response, f.originalResponse); assert.deepEqual(f.game.pendingShipment, f.originalShipment);
  assert.equal(f.game.phase, 5); assert.equal(f.game.turn, f.turn); assert.equal(f.game.phaseOpening ?? null, null);
  assert.equal(f.game.decision ?? null, null); assert.equal(f.game.pendingTreacheryDiscard ?? null, null);
  assert.deepEqual(physical(f.game), physical(f.beforeDeclaration));
  assert.ok(player(f.game, f.holder).hand.some(card => card.id === f.semuta));
  assert.ok(player(f.game, f.spender).hand.some(card => card.id === f.cost));
  if (f.kind === 'own') {
    assert.equal(f.turn, 1); assert.equal(f.alliance, null); assert.equal(f.entry, null);
    assert.equal(f.originalShipment.noField?.tokenId, f.token.id); assert.equal(f.originalShipment.cost, 2);
    assert.equal(player(f.game, f.owner).reserves, 20); assert.equal(player(f.game, f.owner).shipped, false);
  } else {
    assert.equal(f.turn, 2); assert.ok(f.alliance); assert.equal(f.alliance.steps.length, 2);
    assert.ok(f.alliance.steps.every(step => step.action.type === 'alliance'));
    const ally = f.kind === 'ambassador' ? f.ecaz! : f.recipient;
    assert.equal(player(f.game, f.owner).ally, ally); assert.equal(player(f.game, ally).ally, f.owner);
  }
  if (f.kind === 'allied') {
    assert.equal(f.declaration.steps.length, 2); assert.equal(f.declaration.steps[0].action.type, 'offerRicheseNoField');
    assert.equal(f.declaration.steps[1].actor, f.recipient); assert.equal(f.declaration.steps[1].action.accept, true);
    assert.equal(f.originalShipment.alliedNoField?.tokenId, f.token.id); assert.equal(f.originalShipment.amount, 5);
    assert.equal(f.originalShipment.elite, 0); assert.equal(f.originalShipment.cost, 2);
    assert.equal(player(f.game, f.recipient).reserves, 20); assert.equal(player(f.game, f.recipient).shipped, false);
  }
  if (f.kind === 'ambassador') {
    assert.equal(f.advanced, false); assert.ok(f.ecaz && f.packetCreation && f.placement && f.entry);
    assert.equal(f.placement.steps[0].actor, f.ecaz); assert.equal(f.placement.steps[0].action.token, f.guildToken);
    assert.equal(player(f.placement.before, f.ecaz).spice - player(f.placement.after, f.ecaz).spice, 1);
    assert.ok(f.priorShipment && f.entrantShipment);
    assert.ok(f.priorShipment.steps.some(step => step.actor === f.owner && step.action.type === 'ship' && step.action.amount === 1));
    assert.equal(player(f.priorShipment.before, f.owner).spice - player(f.priorShipment.after, f.owner).spice, 2);
    assert.equal(player(f.entrantShipment.before, f.emperor).spice - player(f.entrantShipment.after, f.emperor).spice, 1);
    assert.equal(player(f.game, f.owner).forces['polar_sink:0'], 1); assert.equal(player(f.game, f.owner).reserves, 19);
    assert.equal(player(f.game, f.owner).shipped, true); assert.equal(player(f.game, f.emperor).forces['carthag:11'], 1);
    assert.equal(f.game.active, f.emperor); assert.equal(f.entry.effect, 'guild'); assert.equal(f.entry.stage, 'ship');
    assert.equal(f.originalResponse.source, 'ambassadorNoField'); assert.equal(f.originalShipment.source, 'ambassador');
    assert.equal(f.originalShipment.ambassadorMarker?.mode, 'own'); assert.equal(f.originalShipment.cost, 0);
    assert.equal(f.originalShipment.ambassadorEvent, f.entry.event); assert.equal(f.originalShipment.ambassadorMarker?.tokenId, f.token.id);
  }
  assert.equal(f.originalInventory.length, 45); assert.deepEqual(inventory(f.game), f.originalInventory);
  assert.equal(f.sourceActionCount, f.actions.length);
}
function open(f: SemutaNoFieldCostFixture) {
  const game = act(structuredClone(f.game), f.spender, f.action), pending = game.pendingTreacheryDiscard;
  assert.ok(pending); assert.equal(pending.continuation.kind, 'karamaNoFieldDiscard');
  if (pending.continuation.kind !== 'karamaNoFieldDiscard') throw Error('Expected the original unpaid No-Field cost');
  assert.equal(pending.batch.cause, 'karama:richeseNoField'); assert.equal(pending.reaction?.stage, 'offer');
  assert.deepEqual(pending.batch.entries.map(entry => ({ card: entry.card.id, by: entry.discardedBy, face: entry.publicFace })),
    [{ card: f.cost, by: f.spender, face: true }]);
  assert.deepEqual(pending.continuation.use.response, f.originalResponse);
  assert.deepEqual(pending.continuation.resume.response, f.originalResponse);
  assert.deepEqual(game.pendingShipment, f.originalShipment); assert.deepEqual(game.pendingAmbassador ?? null, f.entry);
  assert.deepEqual(physical(game), f.originalPhysical); assert.deepEqual(clock(game), clock(f.game));
  assert.equal(player(game, f.owner).noFieldBlockedTurn ?? null, player(f.game, f.owner).noFieldBlockedTurn ?? null);
  assert.deepEqual(game.richeseAllyBlocked ?? null, f.game.richeseAllyBlocked ?? null);
  assert.equal(game.response ?? null, null); assert.equal(game.decision ?? null, null);
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(game.discard.filter(card => card.id === f.cost).length, 1);
  assert.equal(viewGame(game, f.holder).semutaReaction?.canCommit, true);
  assert.deepEqual(inventory(game), f.originalInventory); return game;
}
function denied(state: Game, f: SemutaNoFieldCostFixture, claimed: boolean) {
  const game = finish(state);
  assert.equal(game.pendingTreacheryDiscard ?? null, null); assert.equal(game.pendingShipment ?? null, null);
  assert.equal(game.response ?? null, null); assert.deepEqual(physical(game), f.originalPhysical);
  assert.deepEqual(clock(game), clock(f.game)); assert.deepEqual(player(game, f.owner).noField, f.originalNoField);
  assert.equal(player(game, f.owner).noFieldEvent, f.tokenEvent);
  if (f.kind === 'own') {
    assert.equal(player(game, f.owner).noFieldBlockedTurn, game.turn); assert.equal(game.decision ?? null, null);
  } else if (f.kind === 'allied') {
    assert.deepEqual(game.richeseAllyBlocked, { turn: game.turn, recipient: f.recipient });
    assert.equal(game.decision ?? null, null);
  } else {
    assert.equal(game.pendingAmbassador?.event, f.entry!.event); assert.equal(game.pendingAmbassador?.stage, 'ship');
    assert.equal(game.pendingAmbassador?.guildMarkerBlocked, true); assert.equal(game.pendingAmbassador?.guildMarkerRequest, undefined);
    assert.equal(game.decision?.kind, 'ecazAmbassador'); assert.equal(game.decision?.player, f.owner);
    assert.equal(player(game, f.owner).noFieldBlockedTurn ?? null, player(f.game, f.owner).noFieldBlockedTurn ?? null);
  }
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.cost).length, Number(claimed));
  assert.equal(game.discard.filter(card => card.id === f.cost).length, Number(!claimed));
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.semuta).length, Number(!claimed));
  assert.equal(game.discard.filter(card => card.id === f.semuta).length, Number(claimed));
  reject(game, f.owner, f.nativeAction); reject(game, f.spender, f.action);
  const replacement = finish(act(structuredClone(game), f.replacementActor, f.replacementAction));
  assert.equal(replacement.pendingShipment ?? null, null); assert.equal(replacement.pendingAmbassador ?? null, null);
  assert.equal(replacement.response ?? null, null); assert.equal(replacement.decision ?? null, null);
  assert.equal(replacement.phase, 5); assert.equal(replacement.active, f.game.active);
  assert.equal(player(replacement, f.recipient).forces[f.location], 1);
  assert.equal(player(replacement, f.recipient).reserves, player(f.game, f.recipient).reserves - 1);
  assert.equal(player(replacement, f.recipient).elites?.reserves, player(f.game, f.recipient).elites?.reserves);
  assert.equal(player(replacement, f.recipient).spice, player(f.game, f.recipient).spice - f.shipmentCost);
  assert.equal(player(replacement, f.guild).spice, player(f.game, f.guild).spice + f.shipmentCost);
  assert.equal(player(replacement, f.recipient).moved, player(f.game, f.recipient).moved);
  assert.equal(player(replacement, f.recipient).shipped, true);
  assert.deepEqual(player(replacement, f.owner).noField, f.originalNoField);
  if (f.kind === 'ambassador') {
    assert.equal(player(replacement, f.emperor).forces['carthag:11'], 1);
    assert.equal(player(replacement, f.emperor).spice, player(f.game, f.emperor).spice);
    assert.equal(player(replacement, f.owner).forces['polar_sink:0'], 1);
  }
  reject(replacement, f.replacementActor, f.replacementAction);
  assert.deepEqual(inventory(replacement), f.originalInventory); return game;
}

for (const variant of variants) for (const claimed of [false, true]) void test(
  `${variant.advanced ? 'Advanced' : 'Basic'} native ${variant.kind} No-Field cost Semuta ${claimed ? 'claim' : 'pass'} preserves unpaid stock and earns a real replacement`, () => {
    const f = fixture(variant); nativeSource(f); const offered = open(f);
    denied(claimed ? claim(offered, f.holder) : pass(offered), f, claimed);
  },
);

void test('native own allied and independent No-Field allowances commit the original token forces and payment exactly once', () => {
  for (const variant of variants) {
    const f = fixture(variant); nativeSource(f); let game = finish(allow(structuredClone(f.game)));
    assert.equal(game.pendingShipment ?? null, null); assert.equal(game.pendingAmbassador ?? null, null);
    assert.equal(game.response ?? null, null); assert.equal(game.decision ?? null, null);
    assert.equal(game.phase, 5); assert.equal(game.active, f.game.active);
    assert.equal(player(game, f.recipient).spice, player(f.game, f.recipient).spice - f.shipmentCost);
    assert.equal(player(game, f.guild).spice, player(f.game, f.guild).spice + f.shipmentCost);
    assert.equal(player(game, f.owner).noField!.lastShipped, f.token.id);
    assert.notEqual(player(game, f.owner).noFieldEvent, f.tokenEvent);
    assert.equal(player(game, f.recipient).moved, player(f.game, f.recipient).moved);
    if (f.kind === 'allied') {
      assert.equal(player(game, f.owner).noField!.deployed, null);
      assert.equal(player(game, f.recipient).forces[f.location], 5);
      assert.equal(player(game, f.recipient).reserves, player(f.game, f.recipient).reserves - 5);
      assert.equal(player(game, f.owner).reserves, player(f.game, f.owner).reserves);
      assert.equal(player(game, f.recipient).shipped, true);
    } else {
      assert.deepEqual(player(game, f.owner).noField!.deployed, { tokenId: f.token.id, controller: f.owner,
        location: { territory: f.territory, sector: f.sector } });
      assert.deepEqual(player(game, f.owner).forces, player(f.game, f.owner).forces);
      assert.equal(player(game, f.owner).reserves, player(f.game, f.owner).reserves);
      assert.equal(player(game, f.owner).shipped, true);
      if (f.kind === 'own') {
        game = act(game, f.owner, { type: 'revealNoField', event: player(game, f.owner).noFieldEvent, token: f.token.id });
        assert.equal(player(game, f.owner).forces[f.location], 5);
        assert.equal(player(game, f.owner).reserves, player(f.game, f.owner).reserves - 5);
        assert.equal(player(game, f.owner).spice, player(f.game, f.owner).spice - 2);
      }
    }
    assert.ok(player(game, f.spender).hand.some(card => card.id === f.cost));
    assert.ok(player(game, f.holder).hand.some(card => card.id === f.semuta));
    reject(game, f.owner, f.nativeAction); assert.deepEqual(inventory(game), f.originalInventory);
  }
});

void test('native No-Field cost reactions reject stale foreign and underlying replies without selecting or consuming a marker', () => {
  for (const variant of variants) {
    const f = fixture(variant), game = open(f), event = game.pendingTreacheryDiscard!.batch.event;
    reject(game, f.holder, { type: 'semutaCommit', event: `${event}:stale` });
    reject(game, f.spender, { type: 'semutaCommit', event }); reject(game, f.spender, f.action);
    reject(game, f.owner, f.nativeAction); reject(game, f.recipient, f.replacementAction);
    reject(game, f.owner, { type: 'passResponse' }); reject(game, f.owner, { type: 'ready' });
    const done = denied(pass(game), f, false); reject(done, f.holder, { type: 'semutaCommit', event });
  }
});

void test('all four minimal profiles legally claim or pass native own allied and independent No-Field cancellation costs', () => {
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
