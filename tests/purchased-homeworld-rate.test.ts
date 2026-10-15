import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction, viewGame, type Action, type Game, type GameView,
} from '../game/engine';
import { homeworldContext, homeworldGameIntegrity } from '../game/homeworld-game';
import { homeworldForceGroups } from '../game/homeworld-custody';
import { quoteHomeworldShipment } from '../game/homeworld-shipment';
import { homeworldShipmentChoice } from '../game/homeworld-shipment-options';
import { guildHomeworldShipmentActions, guildHomeworldShipmentChoice } from '../game/guild-homeworld-shipment-options';
import {
  createPurchasedHomeworldRate, createPurchasedHomeworldRateScene,
  createControlledPurchasedHomeworldCanceledRate, declarePurchasedHomeworldRate,
  completePurchasedHomeworldRate, type PurchasedHomeworldRateFixture,
} from './fixture-purchased-homeworld-rate';
import { holdGuildCunningCard } from './fixture-nexus-guild-cunning';
import { pairedE3NexusPlayer as player } from './fixture-paired-e3-nexus-modules';

const act = (g: Game, actor: string, action: Action) => applyAction(structuredClone(g), actor, action);
function context(g: Game, purchasedGuildRate: boolean, nativeGuildRateCanceled = false) {
  return { ...homeworldContext(g), purchasedGuildRate, nativeGuildRateCanceled,
    players: homeworldContext(g).players.map(p => ({ ...p, ally: player(g, p.id).ally })),
    storm: g.storm, discoveries: g.discoveries, mobileStronghold: g.mobileStronghold?.location ?? null,
    board: Object.fromEntries(g.players.map(p => [p.id, { forces: p.forces, eliteForces: p.elites?.forces ?? {} }])),
  };
}
function unpaid(f: PurchasedHomeworldRateFixture, g: Game) {
  assert.deepEqual(g.homeworlds, f.beforeAction.homeworlds);
  assert.deepEqual(g.aid, f.beforeAction.aid);
  for (const id of [f.shipper, f.guild, f.entrant]) {
    assert.equal(player(g, id).spice, player(f.beforeAction, id).spice);
    assert.equal(player(g, id).reserves, player(f.beforeAction, id).reserves);
    assert.equal(player(g, id).shipped, player(f.beforeAction, id).shipped);
    assert.deepEqual(player(g, id).forces, player(f.beforeAction, id).forces);
  }
  assert.deepEqual(g.karamaShipping, f.beforeAction.karamaShipping);
}
function paid(f: PurchasedHomeworldRateFixture, g: Game) {
  const before = f.beforeAction, old = player(before, f.shipper), p = player(g, f.shipper);
  assert.equal(p.spice, old.spice - (2 - f.allyPayment));
  if (f.shipper !== f.guild) assert.equal(player(g, f.guild).spice, player(before, f.guild).spice);
  if (f.allyPayment) {
    assert.equal(player(g, f.entrant).spice, player(before, f.entrant).spice);
    assert.equal(g.aid[f.entrant].amount, before.aid[f.entrant].amount - f.allyPayment);
  }
  assert.notEqual(g.response?.kind, 'guildIncome', 'Every purchased-price contribution goes to the bank, including an allied donor share.');
  assert.notEqual(g.response?.kind, 'guildRate', 'Native cancellation cannot target an independent card price.');
  assert.equal(p.shipped, true);
  assert.equal(p.moved, old.moved);
  assert.equal(g.karamaShipping, null);
  assert.ok(!g.pendingHomeworldShipment);
  assert.equal(g.discard.filter(c => c.id === f.karama).length, 1);
  assert.ok(!player(g, f.ecaz).hand.some(c => c.id === f.karama));
  assert.equal(p.reserves, old.reserves + (f.route === 'return' ? 3 : f.route === 'world' || f.route === 'guildWorld' ? -3 : 0));
  if (f.route === 'return' || f.route === 'arrakisForeign')
    assert.equal(p.forces[f.source] ?? 0, old.forces[f.source] - 3);
  else assert.deepEqual(p.forces, old.forces);
  if (f.route !== 'return')
    assert.deepEqual(g.homeworlds!.custody!.visitors[f.destination][f.shipper], { normal: 3, elite: 0 });
  else assert.equal(g.homeworlds!.custody!.visitors[f.destination]?.[f.shipper], undefined);
  homeworldGameIntegrity(g);
  const worlds = homeworldForceGroups(homeworldContext(g), g.homeworlds!.custody!);
  assert.equal(Object.values(p.forces).reduce((sum, n) => sum + n, 0) + p.tanks + worlds.reduce((sum, w) =>
    sum + (w.forces[f.shipper]?.normal ?? 0) + (w.forces[f.shipper]?.elite ?? 0), 0), 20);
  assert.throws(() => act(g, f.shipper, f.action));
  const ended = act(g, f.shipper, { type: 'endMovement' });
  assert.notEqual(ended.active, f.shipper);
  assert.deepEqual(player(ended, f.shipper).forces, p.forces);
}

for (const route of ['world', 'guildWorld', 'arrakisForeign', 'return'] as const) {
  void test(`original purchased Homeworld ${route}: actual auctioned gift pays the entire approved price to the bank only on completion`, () => {
    const f = createPurchasedHomeworldRateScene(route);
    const prior = viewGame(f.beforePurchase, f.shipper);
    const oldQuote = route === 'world' || route === 'guildWorld'
      ? homeworldShipmentChoice(prior, f.destination, f.sources, f.allyPayment)
      : guildHomeworldShipmentChoice(prior, f.destination, f.sources, f.allyPayment);
    assert.equal(oldQuote.cost, route === 'world' ? 3 : 2);
    assert.ok(player(f.beforePurchase, f.ecaz).hand.some(c => c.id === f.karama));
    assert.equal(player(f.beforeAction, f.ecaz).spice, player(f.beforePurchase, f.ecaz).spice);
    if (f.game.pendingHomeworldShipment) unpaid(f, f.game);
    const completed = completePurchasedHomeworldRate(f.game).game;
    paid(f, completed);
  });
}

void test('controlled second card after actual unaffordable native cancellation restores only the independent half price', () => {
  const f = createControlledPurchasedHomeworldCanceledRate();
  const before = viewGame(f.beforePurchase, f.guild);
  const native = guildHomeworldShipmentChoice(before, f.destination, f.sources, 1);
  assert.equal(native.cost, 3);
  assert.ok(native.blocked);
  assert.equal(viewGame(f.beforeAction, f.guild).guildRateCanceled, true);
  assert.equal(guildHomeworldShipmentChoice(viewGame(f.beforeAction, f.guild), f.destination, f.sources, 1).cost, 2);
  const declared = declarePurchasedHomeworldRate(f).game;
  if (declared.pendingHomeworldShipment) unpaid(f, declared);
  const done = completePurchasedHomeworldRate(declared).game;
  paid(f, done);
  assert.equal(done.discard.filter(c => c.id === f.canceledKarama).length, 1);
});

void test('purchased price changes neither typed physical identities nor original route permissions', () => {
  const f = createPurchasedHomeworldRate('world'), g = f.beforeAction;
  const ctx = context(g, true, true), custody = g.homeworlds!.custody!;
  const intent = { player: f.shipper, destination: f.destination, sources: f.sources };
  assert.equal(quoteHomeworldShipment(ctx, custody, intent).cost, 2);
  assert.equal(quoteHomeworldShipment({ ...ctx, purchasedGuildRate: false }, custody, intent).cost, 3);
  const own = homeworldShipmentChoice(viewGame(g, f.shipper), 'homeworld:moritani',
    { 'homeworld:moritani': { normal: 3, elite: 0 } });
  assert.equal(own.action, null);
  assert.ok(own.blocked);
  const invalid: Action[] = [
    { ...f.action, destination: 'homeworld:guild' }, // Its actual allied Homeworld.
    { ...f.action, sources: { [f.source]: { normal: 0, elite: 3 } } },
    { ...f.action, type: 'guildHomeworldShip', sources: { [Object.keys(player(g, f.shipper).forces)[0]]: { normal: 3, elite: 0 } } },
  ];
  for (const action of invalid) {
    const unchanged = structuredClone(g);
    assert.throws(() => applyAction(unchanged, f.shipper, action));
    assert.deepEqual(unchanged, g);
  }
  const otherOwner = { ...viewGame(g, f.shipper), karamaShipping: { player: f.ecaz, owner: f.ecaz, card: f.karama } };
  assert.equal(homeworldShipmentChoice(otherOwner, f.destination, f.sources).cost, 3);
});

void test('controlled second physical Guild card stops the original gifted purchase and refunds its card to the original owner without payment or departure', () => {
  const f = createPurchasedHomeworldRate('world');
  // This second physical acquisition is controlled, not an auction provenance claim.
  const stop = holdGuildCunningCard(f.beforeAction, f.guild, 'karama');
  const scene = declarePurchasedHomeworldRate(f).game;
  const done = act(scene, f.guild, { type: 'card', mode: 'special', card: stop.id });
  assert.deepEqual(done.homeworlds, f.beforeAction.homeworlds);
  assert.deepEqual(done.aid, f.beforeAction.aid);
  assert.equal(player(done, f.shipper).spice, player(f.beforeAction, f.shipper).spice);
  assert.deepEqual(player(done, f.shipper).forces, player(f.beforeAction, f.shipper).forces);
  assert.equal(done.karamaShipping, null);
  assert.ok(player(done, f.ecaz).hand.some(c => c.id === f.karama));
  assert.ok(!player(done, f.shipper).hand.some(c => c.id === f.karama));
  assert.equal(done.discard.filter(c => c.id === f.karama).length, 0);
  assert.equal(player(done, f.shipper).shipped, true);
  assert.equal(player(done, f.shipper).moved, player(f.beforeAction, f.shipper).moved);
  assert.equal(player(done, f.guild).specialKaramaUsed, true);
  assert.equal(done.discard.filter(c => c.id === stop.id).length, 1);
  assert.ok(!done.pendingHomeworldShipment);
  homeworldGameIntegrity(done);
});



void test('controlled second physical Karama cannot stack another grant on the original active beneficiary', () => {
  const f = createPurchasedHomeworldRate('world');
  // Only this second card's physical acquisition is controlled.
  const second = holdGuildCunningCard(f.beforeAction, f.ecaz, 'karama');
  const before = structuredClone(f.beforeAction);
  assert.notEqual(second.id, f.karama);
  assert.throws(() => applyAction(f.beforeAction, f.ecaz,
    { type: 'card', mode: 'shipment', card: second.id, target: f.shipper }));
  assert.deepEqual(f.beforeAction, before);
  assert.ok(player(f.beforeAction, f.ecaz).hand.some(c => c.id === second.id));
  const declared = declarePurchasedHomeworldRate(f).game;
  const done = completePurchasedHomeworldRate(declared).game;
  paid(f, done);
  assert.ok(player(done, f.ecaz).hand.some(c => c.id === second.id));
});

void test('controlled owner-view permission denial blocks native Guild routes but leaves purchased ordinary world-to-world transport legal', () => {
  // Narrow public permission-flag projections; original auction/action scenes above are unchanged.
  const f = createPurchasedHomeworldRate('guildWorld');
  const view = { ...viewGame(f.beforeAction, f.guild), guildTransportCanceled: true as const };
  const foreign = homeworldShipmentChoice(view, f.destination, f.sources, 1);
  assert.equal(foreign.cost, 2);
  assert.ok(foreign.action);
  const ownReturn = homeworldShipmentChoice(view, 'homeworld:guild',
    { 'homeworld:ecaz': { normal: 3, elite: 0 } }, 1);
  assert.equal(ownReturn.action, null);
  assert.ok(ownReturn.blocked);
  const r = createPurchasedHomeworldRate('return');
  const denied = { ...viewGame(r.beforeAction, r.guild), guildTransportCanceled: true as const };
  const arrakisReturn = guildHomeworldShipmentChoice(denied, r.destination, r.sources, 1);
  assert.equal(arrakisReturn.action, null);
  assert.ok(arrakisReturn.blocked);
  assert.deepEqual(guildHomeworldShipmentActions(denied, 0), []);
});

void test('controlled Secret Ally projection keeps its explicit source separate from an already purchased card price', () => {
  // Secret Ally needs Guild absent and no alliance; this is not a played-game chronology.
  const f = createPurchasedHomeworldRate('world'), original = viewGame(f.beforeAction, f.shipper);
  const event = JSON.stringify(['nexusGuildSecretAlly', original.turn, original.me]);
  const view = { ...original, guildRateCanceled: true,
    players: original.players.filter(p => p.id !== f.guild).map(p => ({ ...p, ally: null })),
    homeworlds: { ...original.homeworlds!, worlds: original.homeworlds!.worlds!.filter(w => w.native !== f.guild) },
    nexusCards: { ...original.nexusCards!, card: 'guild', waiting: [] },
    nexusGuildSecretAlly: { event, blocked: null },
    aid: { ...original.aid, available: 0 },
  } as GameView;
  assert.equal(homeworldShipmentChoice(view, f.destination, f.sources).cost, 2);
  const stacked = homeworldShipmentChoice(view, f.destination, f.sources, 0, event);
  assert.equal(stacked.action, null);
  assert.ok(stacked.blocked);
  const withoutPurchase = { ...view, karamaShipping: null };
  assert.equal(homeworldShipmentChoice(withoutPurchase, f.destination, f.sources).cost, 3);
  const nexus = homeworldShipmentChoice(withoutPurchase, f.destination, f.sources, 0, event);
  assert.equal(nexus.cost, 2);
  assert.ok(nexus.action);
});
