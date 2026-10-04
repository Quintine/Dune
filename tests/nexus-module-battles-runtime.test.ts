import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, normalizeAutomaticGame, viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { ownedTech } from '../game/tech-tokens';
import { quoteSpiceCollection } from '../game/board-resolution-quote';
import { nexusInventory } from './fixture-nexus-cards';
import {
  createNexusModuleBattleFixture, revealNexusModuleBattle, quoteNexusModuleBattle,
  advanceNexusModuleBattle, nexusModuleBattlePlayer,
} from './fixture-nexus-module-battles';

const reload = (game: Game): Game => JSON.parse(JSON.stringify(game)) as Game;

for (const modules of [
  { label: 'Basic Tech-only', advanced: false, tech: true, strongholds: false },
  { label: 'Advanced Tech + actual Arrakeen card', advanced: true, tech: true, strongholds: true },
]) void test(`${modules.label}: physical Moritani retention precedes winner Tech, then CHOAM inspects only the unused card`, () => {
  const fixture = createNexusModuleBattleFixture({ ...modules, family: 'retention' });
  const revealed = revealNexusModuleBattle(fixture);
  const quote = quoteNexusModuleBattle(revealed);
  assert.equal(quote.winner, fixture.owner);
  assert.deepEqual(quote.destroyedArmies, [fixture.opponent]);
  const payment = quote.payments.find(p => p.player === fixture.owner);
  if (modules.advanced) {
    assert.ok(payment);
    assert.equal(payment.cost, 4);
    assert.equal(payment.bankSupport, 2);
    assert.equal(payment.allyPayment, 0);
  } else assert.deepEqual(quote.payments, [], 'Basic force commitments consume no spice support.');
  assert.equal(quote.retention?.source, 'nexus');
  const token = ownedTech(revealed.techTokens, fixture.opponent)[0];
  assert.ok(token);
  const bank = nexusModuleBattlePlayer(revealed, fixture.owner).spice;
  const guildTanks = nexusModuleBattlePlayer(revealed, fixture.opponent).tanks;
  const emperorTanks = nexusModuleBattlePlayer(revealed, fixture.owner).tanks;
  let game = advanceNexusModuleBattle(revealed, state => state.decision?.kind === 'moritaniRetention');
  assert.equal(nexusModuleBattlePlayer(game, fixture.owner).spice, bank - (payment?.ownPayment ?? 0));
  assert.equal(nexusModuleBattlePlayer(game, fixture.opponent).tanks, guildTanks + 6);
  assert.equal(nexusModuleBattlePlayer(game, fixture.owner).tanks, emperorTanks + 6);
  assert.equal(game.techTokens![token].owner, fixture.opponent);
  assert.equal(game.lastBattleContext?.nexusChoamInspection?.stage, 'pending');
  assert.equal(game.lastBattleContext?.nexusMoritaniRetention?.stage, 'offer');
  assert.equal(viewGame(game, fixture.opponent).nexusMoritaniRetention?.canKeep, true);
  const event = game.lastBattleContext!.event;
  const before = reload(game);
  assert.throws(() => applyAction(game, fixture.owner, { type: 'decision', event, keep: fixture.played.id }));
  assert.throws(() => applyAction(game, fixture.opponent, { type: 'decision', event, keep: fixture.unused.id }));
  assert.throws(() => applyAction(game, fixture.owner, { type: 'decision', event, inspect: true }));
  assert.deepEqual(game, before);
  const keep = { type: 'decision', event, keep: fixture.played.id };
  game = applyAction(game, fixture.opponent, keep);
  // Single original token transfer occurs inside the retention continuation.
  assert.equal(game.techTokens![token].owner, fixture.owner);
  assert.equal(game.decision?.kind, 'nexusChoamInspection');
  assert.equal(game.lastBattleContext?.nexusMoritaniRetention?.kept, fixture.played.id);
  assert.equal(game.nexusCards!.cards!.discard.filter(card => card === 'moritani').length, 1);
  assert.ok(nexusModuleBattlePlayer(game, fixture.opponent).hand.some(card => card.id === fixture.played.id));
  assert.equal(game.discard.some(card => card.id === fixture.played.id), false);
  assert.throws(() => applyAction(game, fixture.opponent, keep));
  const inspect = { type: 'decision', event, inspect: true };
  assert.throws(() => applyAction(game, fixture.owner, { ...inspect, card: fixture.played.id }));
  game = applyAction(game, fixture.owner, inspect);
  assert.equal(game.nexusChoamInsight?.card.id, fixture.unused.id);
  assert.equal(game.nexusCards!.cards!.discard.filter(card => card === 'choam').length, 1);
  assert.ok(nexusModuleBattlePlayer(game, fixture.opponent).hand.some(card => card.id === fixture.played.id));
  assert.ok(nexusModuleBattlePlayer(game, fixture.opponent).hand.some(card => card.id === fixture.unused.id));
  assert.ok(nexusModuleBattlePlayer(game, fixture.owner).hand.some(card => card.id === fixture.defense.id));
  assert.equal(game.lastBattleContext?.nexusChoamInspection?.stage, 'complete');
  assert.equal(game.phase, 7);
  assert.throws(() => applyAction(game, fixture.owner, inspect));
  assert.deepEqual(normalizeAutomaticGame(reload(game)), game);
  nexusInventory(game);
});

void test('Strongholds-only all-pass keeps Nexus cards, discards the original losing weapon once and preserves actual Arrakeen support', () => {
  const fixture = createNexusModuleBattleFixture({ tech: false, strongholds: true });
  const revealed = revealNexusModuleBattle(fixture);
  const quote = quoteNexusModuleBattle(revealed);
  const balance = nexusModuleBattlePlayer(revealed, fixture.owner).spice;
  let game = advanceNexusModuleBattle(revealed, state => state.decision?.kind === 'moritaniRetention');
  const event = game.lastBattleContext!.event;
  game = applyAction(game, fixture.opponent, { type: 'decision', event, keep: null });
  assert.equal(game.decision?.kind, 'nexusChoamInspection');
  assert.equal(game.discard.filter(card => card.id === fixture.played.id).length, 1);
  assert.deepEqual(nexusModuleBattlePlayer(game, fixture.opponent).hand.map(card => card.id), [fixture.unused.id]);
  const collection = quoteSpiceCollection(game).receipts.find(p => p.player === fixture.owner)!;
  game = applyAction(game, fixture.owner, { type: 'decision', event, inspect: false });
  assert.equal(game.nexusCards!.cards!.hands[fixture.owner], 'choam');
  assert.equal(game.nexusCards!.cards!.hands[fixture.opponent], 'moritani');
  assert.equal(nexusModuleBattlePlayer(game, fixture.owner).spice,
    balance - quote.payments.find(p => p.player === fixture.owner)!.ownPayment +
    collection.strongholds + collection.collected);
  assert.equal(nexusModuleBattlePlayer(game, fixture.owner).forces[fixture.location], 1);
  assert.equal(game.strongholdCards!.owners.arrakeen, fixture.owner);
  assert.equal(game.phase, 7);
  assert.deepEqual(normalizeAutomaticGame(reload(game)), game);
  nexusInventory(game);
});

void test('Tech-only Emperor passing Cunning retains its Nexus and pays ordinary support before losing ordinary counters', () => {
  const fixture = createNexusModuleBattleFixture({ family: 'emperor', strongholds: false });
  const revealed = revealNexusModuleBattle(fixture);
  const quote = quoteNexusModuleBattle(revealed);
  const payment = quote.payments.find(p => p.player === fixture.owner)!;
  assert.equal(payment.ownPayment, 6);
  assert.equal(payment.bankSupport, 0);
  assert.deepEqual(quote.casualties!.options, [{ normal: 6, elite: 0, paidNormal: 6, paidElite: 0 }]);
  const balance = nexusModuleBattlePlayer(revealed, fixture.owner).spice;
  const elites = structuredClone(nexusModuleBattlePlayer(revealed, fixture.owner).elites);
  const settled = advanceNexusModuleBattle(revealed, state => state.decision?.kind === 'nexusChoamInspection');
  const collection = quoteSpiceCollection(settled).receipts.find(p => p.player === fixture.owner)!;
  const done = advanceNexusModuleBattle(settled, state => state.phase === 7);
  assert.equal(done.nexusCards!.cards!.hands[fixture.owner], 'emperor');
  assert.equal(done.nexusCards!.cards!.hands[fixture.opponent], 'moritani');
  assert.equal(nexusModuleBattlePlayer(done, fixture.owner).forces[fixture.location], 1);
  assert.equal(nexusModuleBattlePlayer(done, fixture.owner).spice,
    balance - 6 + collection.strongholds + collection.collected);
  assert.deepEqual(nexusModuleBattlePlayer(done, fixture.owner).elites, elites);
  assert.equal(done.discard.filter(card => card.id === fixture.played.id).length, 1);
  const token = ownedTech(revealed.techTokens, fixture.opponent)[0];
  assert.equal(done.techTokens![token].owner, fixture.owner);
  assert.deepEqual(normalizeAutomaticGame(reload(done)), done);
  nexusInventory(done);
});

void test('Emperor Cunning counts ordinary forces temporarily, pays actual-holder Arrakeen support and loses no starred counters', () => {
  const fixture = createNexusModuleBattleFixture({ family: 'emperor' });
  const originalElites = structuredClone(nexusModuleBattlePlayer(fixture.game, fixture.owner).elites);
  const revealed = revealNexusModuleBattle(fixture, fixture.game, true);
  const quote = quoteNexusModuleBattle(revealed);
  assert.equal(quote.winner, fixture.owner);
  assert.deepEqual(quote.casualties!.forces, viewGame(revealed, fixture.owner).battle!.ownForces);
  assert.equal(quote.casualties!.forces.temporaryElite, 5);
  assert.equal(quote.casualties!.forces.normal, 7);
  assert.equal(quote.casualties!.forces.elite, 0);
  assert.deepEqual(quote.casualties!.options[0], { normal: 3, elite: 0, paidNormal: 3, paidElite: 0 });
  const payment = quote.payments.find(p => p.player === fixture.owner)!;
  assert.equal(payment.cost, 1);
  assert.equal(payment.bankSupport, 2);
  assert.equal(payment.ownPayment, 1);
  assert.equal(payment.allyPayment, 0);
  const bank = nexusModuleBattlePlayer(revealed, fixture.owner).spice;
  const tanks = nexusModuleBattlePlayer(revealed, fixture.owner).tanks;
  let game = advanceNexusModuleBattle(revealed, state => state.decision?.kind === 'moritaniRetention');
  const event = game.lastBattleContext!.event;
  assert.equal(nexusModuleBattlePlayer(game, fixture.owner).tanks, tanks + 3);
  assert.equal(nexusModuleBattlePlayer(game, fixture.owner).forces[fixture.location], 4);
  assert.deepEqual(nexusModuleBattlePlayer(game, fixture.owner).elites, originalElites);
  assert.equal(nexusModuleBattlePlayer(game, fixture.owner).spice, bank - 1);
  assert.equal(game.nexusSardaukarHistory?.length, 1);
  assert.equal(game.nexusSardaukarHistory![0].casualties?.outcome, 'complete');
  assert.equal(game.nexusCards!.cards!.discard.filter(card => card === 'emperor').length, 1);
  game = applyAction(game, fixture.opponent, { type: 'decision', event, keep: null });
  assert.equal(viewGame(game, fixture.owner).nexusChoamInspection?.canInspect, false);
  game = applyAction(game, fixture.owner, { type: 'decision', event, inspect: false });
  assert.equal(game.phase, 7);
  assert.deepEqual(nexusModuleBattlePlayer(game, fixture.owner).elites, originalElites);
  assert.deepEqual(normalizeAutomaticGame(reload(game)), game);
  assert.throws(() => applyAction(game, fixture.owner, { type: 'nexusSardaukar', event: game.nexusSardaukarHistory![0].receipt.event }));
  nexusInventory(game);
});

void test('minimal legal bot continuation retains the played card, completes single-owner Tech and inspects the unused card', () => {
  const fixture = createNexusModuleBattleFixture();
  let game = advanceNexusModuleBattle(revealNexusModuleBattle(fixture), state => state.decision?.kind === 'moritaniRetention');
  for (const actor of [fixture.opponent, fixture.owner]) {
    const view = viewGame(game, actor);
    view.players.find(p => p.id === actor)!.bot = 'Easy';
    const action = botActions(view)[0];
    assert.ok(action);
    if (actor === fixture.opponent) assert.equal(action.keep, fixture.played.id);
    else assert.equal(action.inspect, true);
    game = applyAction(game, actor, action);
  }
  assert.equal(game.techTokens![ownedTech(fixture.game.techTokens, fixture.opponent)[0]].owner, fixture.owner);
  assert.equal(game.nexusChoamInsight?.card.id, fixture.unused.id);
  assert.equal(game.phase, 7);
  nexusInventory(game);
});
