import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, normalizeAutomaticGame, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { MOBILE_LOCATION, MOBILE_STRONGHOLD, gameDistance, gameTerritories } from '../game/board';
import { strongholdControllers } from '../game/stronghold-cards';
import { quoteStrongholdFactionsBattle } from './fixture-stronghold-factions';
import {
  assertDiscoveryNativeStrongholdCustody,
  createDiscoveryNativeStrongholdFixture, discoveryNativeStrongholdPlayer,
  discoveryNativeStrongholdReload, finishDiscoveryNativeStrongholdBattle,
  prepareDiscoveryNativeStrongholdBattle, revealDiscoveryNativeStrongholdBattle,
} from './fixture-discovery-native-strongholds';

function reject(game: Game, actor: string, action: Action): void {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before, 'Rejected native controls cannot debit wallets, move counters or change retained card custody');
}
function legalPolicies(game: Game, actor: string): void {
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(game, actor);
    view.players.find(p => p.id === actor)!.bot = difficulty;
    const choices = botActions(view);
    assert.ok(choices.length, `${difficulty} supplies an actual native continuation`);
    for (const action of choices) {
      const next = applyAction(discoveryNativeStrongholdReload(game), actor, action);
      assertDiscoveryNativeStrongholdCustody(next);
    }
  }
}

void test('native Advanced Discovery blow/reveal and original final Mentat produce retained cards without redealing authenticated setup', () => {
  for (const kind of ['ix-hms-invoice', 'richese-nested-defense'] as const) {
    const fixture = createDiscoveryNativeStrongholdFixture({ kind, tech: true });
    const { owner } = fixture;
    const original = discoveryNativeStrongholdReload(fixture.setup);
    const fromSetup = createDiscoveryNativeStrongholdFixture({ kind, initial: fixture.setup });
    assert.deepEqual(fixture.setup, original);
    assert.deepEqual(fromSetup.setup, original, 'An original undealt native setup is continued, never initialized twice');
    assert.equal(fixture.setup.strongholdCards!.claimedTurn, 0);
    assert.ok(Object.values(fixture.setup.strongholdCards!.owners).every(id => id === null));
    const old = discoveryNativeStrongholdPlayer(fixture.beforeBlow, owner);
    const blown = discoveryNativeStrongholdPlayer(fixture.afterBlow, owner);
    assert.equal(old.forces['hagga_basin:12'], 2);
    assert.equal(blown.forces['hagga_basin:12'], undefined);
    assert.equal(blown.tanks, old.tanks + 2);
    if (kind === 'ix-hms-invoice') {
      assert.equal(old.elites!.forces['hagga_basin:12'], 1);
      assert.equal(blown.elites!.forces['hagga_basin:12'], undefined);
      assert.equal(blown.elites!.tanks, old.elites!.tanks + 1);
      assert.equal(discoveryNativeStrongholdPlayer(fixture.afterSetup, owner).forces[MOBILE_LOCATION], 6);
      assert.equal(discoveryNativeStrongholdPlayer(fixture.afterSetup, owner).elites!.forces[MOBILE_LOCATION], 3);
    }
    const token = fixture.afterBlow.discoveries!.tokens.find(t => t.id === fixture.token)!;
    assert.equal(token.status, 'placed');
    assert.equal(token.territory, 'gara_kulon');
    assert.equal(token.sector, 8);
    assert.ok(fixture.afterBlow.spiceDiscard.flat().some(c => 'territory' in c && c.discovery === 'discovery-hagga-basin'));
    assert.equal(gameTerritories(fixture.beforeReveal).some(t => t.id === 'shrine'), false);
    assert.equal(gameTerritories(fixture.afterReveal).some(t => t.id === 'shrine'), true);
    assert.equal(fixture.beforeFirstMentat.phase, 8);
    assert.equal(fixture.beforeFirstMentat.turn, 1);
    assert.equal(fixture.beforeFirstMentat.strongholdCards!.claimedTurn, 0);
    const claimed = applyAction(discoveryNativeStrongholdReload(fixture.beforeFirstMentat),
      fixture.firstMentatStep.actor, fixture.firstMentatStep.action);
    assert.equal(claimed.turn, 2);
    assert.deepEqual(claimed.strongholdCards, fixture.afterFirstMentat.strongholdCards);
    assert.deepEqual(claimed.strongholdCards!.owners,
      strongholdControllers(fixture.beforeFirstMentat.players, kind === 'ix-hms-invoice'));
    assert.equal(claimed.strongholdCards!.owners[kind === 'ix-hms-invoice' ? MOBILE_STRONGHOLD : 'carthag'], owner);
    assert.deepEqual(fixture.beforeBattle.strongholdCards, claimed.strongholdCards);
    for (const snapshot of [fixture.setup, fixture.afterSetup, fixture.beforeReveal, claimed, fixture.beforeBattle])
      assertDiscoveryNativeStrongholdCustody(snapshot);
  }
});

void test('earned HMS card composes with actual typed Discovery free entry, paid nested shipment and optional original industry', () => {
  for (const tech of [false, true]) {
    const f = createDiscoveryNativeStrongholdFixture({ tech });
    const before = discoveryNativeStrongholdPlayer(f.entry.before, f.owner);
    const entered = discoveryNativeStrongholdPlayer(f.entry.after, f.owner);
    const offer = viewGame(f.entry.before, f.owner).discoveryEntry!;
    assert.deepEqual(offer.sources, [{ source: f.source, normal: 2, elite: 1 }]);
    legalPolicies(f.entry.before, f.owner);
    assert.equal(entered.forces['shrine:0'], 2);
    assert.equal(entered.elites!.forces['shrine:0'], 1);
    assert.equal(entered.forces[f.source], 1);
    assert.equal(entered.elites!.forces[f.source] ?? 0, 0);
    assert.equal(entered.reserves, before.reserves);
    assert.equal(entered.elites!.reserves, before.elites!.reserves);
    assert.equal(entered.spice, before.spice);
    assert.equal(entered.shipped, before.shipped);
    assert.equal(entered.moved, before.moved);
    assert.equal(f.entry.after.discoveryEntry, undefined);
    reject(f.entry.after, f.owner, f.entry.step.action);
    const shipping = discoveryNativeStrongholdPlayer(f.shipment.before, f.owner);
    const shipped = discoveryNativeStrongholdPlayer(f.shipment.after, f.owner);
    assert.equal(gameDistance(f.shipment.before, f.source, 'shrine:0'), 1);
    assert.equal(shipped.forces['shrine:0'], 4);
    assert.equal(shipped.elites!.forces['shrine:0'], 2);
    assert.equal(shipped.reserves, shipping.reserves - 2);
    assert.equal(shipped.elites!.reserves, shipping.elites!.reserves - 1);
    assert.equal(shipped.spice, shipping.spice - 2);
    assert.equal(discoveryNativeStrongholdPlayer(f.shipment.after, f.opponent).spice,
      discoveryNativeStrongholdPlayer(f.shipment.before, f.opponent).spice + 2);
    assert.equal(shipped.forces[MOBILE_LOCATION], 6);
    assert.equal(shipped.elites!.forces[MOBILE_LOCATION], 3);
    assert.equal(shipped.shipped, true);
    assert.deepEqual(f.shipment.after.strongholdCards, f.afterFirstMentat.strongholdCards);
    reject(f.shipment.after, f.owner, f.shipment.step.action);
    if (tech) {
      assert.equal(f.shipment.after.techTokens!.heighliners.owner, f.owner);
      assert.equal(f.shipment.after.techTokens!.heighliners.triggeredTurn, 2);
      assert.equal(f.shipment.after.techTokens!.heighliners.spice, 1);
      assert.equal(f.beforeBattle.techTokens!.heighliners.spice, 0);
      assert.equal(discoveryNativeStrongholdPlayer(f.beforeBattle, f.owner).spice, shipped.spice + 1);
    } else assert.equal(f.beforeBattle.techTokens, undefined);
    assertDiscoveryNativeStrongholdCustody(f.shipment.after);
  }
});

void test('original HMS declaration copies CURRENT Arrakeen control before plans; native CHOAM invoice includes bank support but pays no cash subsidy', () => {
  const f = createDiscoveryNativeStrongholdFixture({ tech: true });
  assert.equal(f.game.decision?.kind, 'strongholdCopy');
  assert.equal(strongholdControllers(f.game.players, true).arrakeen, f.owner);
  assert.ok(f.game.decision?.kind === 'strongholdCopy');
  assert.deepEqual(f.game.decision.choices, ['arrakeen', 'sietch_tabr']);
  assert.equal(f.game.strongholdCards!.owners.sietch_tabr, null, 'Current control offers a choice without fabricating retained card custody');
  assert.equal(f.game.strongholdCards!.owners[MOBILE_STRONGHOLD], f.owner);
  legalPolicies(f.game, f.owner);
  reject(f.game, f.opponent, f.copyStep!.action);
  reject(f.game, f.owner, { ...f.copyStep!.action, event: 'stale-original-declaration' });
  reject(f.game, f.owner, { ...f.copyStep!.action, stronghold: 'carthag' });
  const ready = prepareDiscoveryNativeStrongholdBattle(f);
  assert.equal(viewGame(ready, f.owner).battle!.strongholdEffects[f.owner], 'arrakeen');
  assert.equal(viewGame(ready, f.owner).battle!.ownForces!.normalFixedHalf, true);
  const revealed = revealDiscoveryNativeStrongholdBattle(f);
  assert.equal(discoveryNativeStrongholdPlayer(revealed, f.owner).spice,
    discoveryNativeStrongholdPlayer(ready, f.owner).spice, 'Sealing the plan never credits spendable bank support');
  const quote = quoteStrongholdFactionsBattle(revealed);
  assert.equal(quote.winner, f.owner);
  assert.deepEqual(quote.payments.find(p => p.player === f.owner), {
    player: f.owner, cost: 1, ownPayment: 1, allyPayment: 0, donor: null, bankSupport: 2, freeByTraitor: false,
  });
  assert.deepEqual(quote.choamIncome, { owner: f.choam, amount: 1 });
  assert.deepEqual(quote.casualties!.options, [{ normal: 0, elite: 3, paidNormal: 0, paidElite: 3 }]);
  const done = finishDiscoveryNativeStrongholdBattle(revealed);
  assert.equal(discoveryNativeStrongholdPlayer(done, f.owner).tanks,
    discoveryNativeStrongholdPlayer(revealed, f.owner).tanks + 3);
  assert.equal(discoveryNativeStrongholdPlayer(done, f.owner).elites!.tanks,
    discoveryNativeStrongholdPlayer(revealed, f.owner).elites!.tanks + 3);
  assert.equal(discoveryNativeStrongholdPlayer(done, f.owner).forces[MOBILE_LOCATION], 3);
  assert.equal(discoveryNativeStrongholdPlayer(done, f.owner).elites!.forces[MOBILE_LOCATION] ?? 0, 0);
  assert.equal(done.phase, 6, 'A real second conflict prevents unrelated Collection from contaminating this invoice');
  assert.equal(done.lastBattleContext!.winner, f.owner);
  assert.equal(discoveryNativeStrongholdPlayer(done, f.owner).spice,
    discoveryNativeStrongholdPlayer(revealed, f.owner).spice - 1);
  assert.equal(discoveryNativeStrongholdPlayer(done, f.choam).spice,
    discoveryNativeStrongholdPlayer(revealed, f.choam).spice + 1);
  assert.deepEqual(done.strongholdCards, f.afterFirstMentat.strongholdCards);
  const expectedTech = structuredClone(f.beforeBattle.techTokens!);
  assert.equal(Object.values(expectedTech).filter(t => t.owner === f.opponent).length, 1);
  for (const token of Object.values(expectedTech)) if (token.owner === f.opponent) token.owner = f.owner;
  assert.deepEqual(done.techTokens, expectedTech, 'Original winner takes the defeated seat’s one actual token only after battle cleanup');
  assertDiscoveryNativeStrongholdCustody(done);
  assert.deepEqual(normalizeAutomaticGame(discoveryNativeStrongholdReload(done)), done);
});

void test('physical E2 No-Field shipment/reveal at native nested Shrine does not import retained Carthag poison protection or parent armies', () => {
  const f = createDiscoveryNativeStrongholdFixture({ kind: 'richese-nested-defense', tech: true });
  assert.equal(f.parent, 'gara_kulon', 'Printed native placement is a sand parent, never an invented Carthag token');
  const before = discoveryNativeStrongholdPlayer(f.shipment.before, f.owner);
  const shipped = discoveryNativeStrongholdPlayer(f.shipment.after, f.owner);
  const token = before.noField!.tokens.find(t => t.value === 5)!;
  const originalTokens = structuredClone(before.noField!.tokens);
  legalPolicies(f.shipment.before, f.owner);
  assert.equal(shipped.spice, before.spice - 1);
  assert.equal(discoveryNativeStrongholdPlayer(f.shipment.after, f.opponent).spice,
    discoveryNativeStrongholdPlayer(f.shipment.before, f.opponent).spice + 1);
  assert.deepEqual(shipped.forces, before.forces);
  assert.equal(shipped.reserves, before.reserves);
  assert.deepEqual(shipped.noField!.deployed!.location, { territory: 'shrine', sector: 0 });
  assert.deepEqual(shipped.noField!.tokens, originalTokens);
  const reveal = f.markerReveal!;
  reject(reveal.before, f.opponent, reveal.step.action);
  reject(reveal.before, f.owner, { ...reveal.step.action, event: before.noFieldEvent });
  const materialized = discoveryNativeStrongholdPlayer(reveal.after, f.owner);
  assert.equal(materialized.forces['shrine:0'], 5);
  assert.equal(materialized.reserves, shipped.reserves - 5);
  assert.equal(materialized.spice, shipped.spice);
  assert.equal(materialized.noField!.deployed, null);
  assert.equal(materialized.noField!.lastShipped, token.id);
  assert.deepEqual(materialized.noField!.tokens, originalTokens);
  reject(reveal.after, f.owner, reveal.step.action);
  assert.equal(discoveryNativeStrongholdPlayer(f.beforeBattle, f.opponent).forces[f.source], 1);
  assert.equal(f.beforeBattle.strongholdCards!.owners.carthag, f.owner);
  const ready = prepareDiscoveryNativeStrongholdBattle(f);
  assert.equal(viewGame(ready, f.owner).battle!.strongholdEffects[f.owner], null);
  assert.equal(viewGame(ready, f.owner).battle!.ownForces!.normal, 5);
  assert.equal(viewGame(ready, f.opponent).battle!.ownForces!.normal, 6, 'Parent-sector counter is not a nested fighter');
  const revealed = revealDiscoveryNativeStrongholdBattle(f), quote = quoteStrongholdFactionsBattle(revealed);
  assert.equal(quote.winner, f.opponent);
  assert.equal(quote.strongholdIncome.length, 0);
  const done = finishDiscoveryNativeStrongholdBattle(revealed);
  assert.equal(discoveryNativeStrongholdPlayer(done, f.owner).leaders.find(l => l.id === f.leader)!.dead, true,
    'A real Shield in Shrine does not gain the poison coverage of a retained Carthag card elsewhere');
  assert.equal(discoveryNativeStrongholdPlayer(done, f.owner).tanks,
    discoveryNativeStrongholdPlayer(revealed, f.owner).tanks + 5);
  assert.equal(discoveryNativeStrongholdPlayer(done, f.owner).forces['shrine:0'], undefined);
  assert.equal(discoveryNativeStrongholdPlayer(done, f.opponent).forces['shrine:0'], 6);
  assert.equal(discoveryNativeStrongholdPlayer(done, f.opponent).forces[f.source], 1);
  assert.equal(discoveryNativeStrongholdPlayer(done, f.opponent).spice,
    discoveryNativeStrongholdPlayer(revealed, f.opponent).spice + quote.bounty!.amount);
  assert.ok(done.discard.some(c => c.id === f.defense));
  assert.ok(discoveryNativeStrongholdPlayer(done, f.opponent).hand.some(c => c.id === f.weapon));
  const expectedTech = structuredClone(f.beforeBattle.techTokens!);
  assert.equal(Object.values(expectedTech).filter(t => t.owner === f.owner).length, 1);
  for (const token of Object.values(expectedTech)) if (token.owner === f.owner) token.owner = f.opponent;
  assert.deepEqual(done.techTokens, expectedTech, 'Retained Carthag custody cannot divert the native loser’s Tech reward');
  assert.deepEqual(done.strongholdCards, f.afterFirstMentat.strongholdCards);
  assert.equal(done.phase, 6);
  assertDiscoveryNativeStrongholdCustody(done);
  assert.deepEqual(normalizeAutomaticGame(discoveryNativeStrongholdReload(done)), done);
});

