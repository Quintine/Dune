import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { discoveryEntryDeclineAction, discoveryEntryMoveAction } from '../game/discovery-entry-options';
import { greatMakerRideAction } from '../game/great-maker-options';
import { nativeShipmentSources } from '../game/homeworld-options';
import { ownedTech } from '../game/tech-tokens';
import { quoteSpiceCollection } from '../game/board-resolution-quote';
import {
  advanceHomeworldClassicDiscoveryNexus, closeHomeworldClassicDiscoveryNexusAlliance,
  createHomeworldClassicDiscoveryNexusFixture, enterHomeworldClassicDiscoveryNexus,
  homeworldClassicDiscoveryNexusClean, homeworldClassicDiscoveryNexusInventory,
  homeworldClassicDiscoveryNexusPlayer, openHomeworldClassicDiscoveryNexusEncounter,
  voteHomeworldClassicDiscoveryNexus,
} from './fixture-homeworld-classic-discovery-nexus';

const reload = (game: Game): Game => JSON.parse(JSON.stringify(game)) as Game;
function rejected(game: Game, actor: string, action: Action): void {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}
/** Every original difficulty must expose one owned legal continuation and keep
 * the physical counters, cards and native custody conserved. */
function legalPolicies(game: Game, owner: string): void {
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(game, owner);
    view.players.find(player => player.id === owner)!.bot = difficulty;
    const actions = botActions(view);
    assert.ok(actions.length, `${difficulty} needs an owned minimal legal continuation.`);
    const after = applyAction(structuredClone(game), owner, actions[0]);
    homeworldClassicDiscoveryNexusInventory(after);
  }
}
/** Root rulebook physical pp.22–23 and the printed Nexus/Discovery components.
 * Only original create/join/ready/initializer/actions run; the tests select
 * conserved unplayed Spice positions and supply lotteries, never hands,
 * custody, clocks, alliances, casualty frames or outcomes. */
void test('original no-Skills Homeworld/Nexus admits Basic and Advanced classic rosters with undealt native components', () => {
  const compositions = [
    { advanced: false, discovery: false, tech: true, strongholds: false },
    { advanced: false, discovery: true, tech: false, strongholds: false },
    { advanced: true, discovery: true, tech: true, strongholds: true },
    { advanced: true, discovery: false, tech: true, strongholds: true },
  ] as const;
  for (const composition of compositions) for (const seats of [3, 6] as const) {
    const fixture = createHomeworldClassicDiscoveryNexusFixture({ ...composition, seats });
    assert.equal(fixture.game.turn, 2);
    homeworldClassicDiscoveryNexusInventory(fixture.game);
    const worlds = viewGame(fixture.game, fixture.collector).homeworlds!.worlds!;
    for (const player of fixture.game.players)
      assert.ok(worlds.some(world => world.native === player.id),
        `Seat ${player.id} must keep its original native Homeworld.`);
    assert.equal(fixture.afterSetup.status, 'playing');
    if (composition.discovery) {
      assert.equal(fixture.blowAmount, 6);
      assert.equal(fixture.game.decision?.kind, 'discoveryEntry');
      assert.equal(fixture.game.decision!.player, fixture.collector);
      assert.equal(fixture.game.phase, 0);
    } else {
      assert.equal(fixture.game.nexus, false);
    }
  }
});


void test('real source-qualified native shipments fund the blow army and the Collection payment exactly once', () => {
  for (const advanced of [false, true]) {
    const fixture = createHomeworldClassicDiscoveryNexusFixture({ advanced, discovery: true, tech: false });
    assert.equal(fixture.firstStorm.phase, 1);
    assert.equal(fixture.firstStorm.techTokens ?? null, null);
    assert.equal(fixture.afterBlow.spice[fixture.blowKey], fixture.blowAmount,
      'The printed blow must be placed, not storm-lost.');
    assert.equal(fixture.blowAmount, 6);
    for (const shipment of fixture.shipments) {
      const owner = homeworldClassicDiscoveryNexusPlayer(fixture.collection, shipment.actor);
      const key = `${shipment.territory}:${shipment.sector}`;
      assert.equal(owner.forces[key], shipment.amount);
      assert.equal(owner.elites?.forces[key] ?? 0, shipment.elite);
      const home = homeworldClassicDiscoveryNexusPlayer(fixture.afterSetup, shipment.actor);
      assert.equal(owner.reserves, home.reserves - shipment.amount, 'Only real native counters left the reserve.');
      assert.equal(owner.elites?.reserves ?? 0, (home.elites?.reserves ?? 0) - shipment.elite);
      for (const source of Object.keys(shipment.homeworldSources))
        assert.ok(source === `homeworld:${home.faction}` || source === 'homeworld:emperor:salusa',
          'A native shipment may only spend the shipper’s own original Homeworlds.');
    }
    const baseline = Object.fromEntries(fixture.beforeShipment.players.map(player => [player.id, player.spice]));
    const collected = Object.fromEntries(fixture.collection.players.map(player => [player.id, player.spice]));
    const ordinaryIncome = quoteSpiceCollection(fixture.afterSetup).receipts;
    for (const player of fixture.collection.players) {
      const paid = fixture.shipments.filter(row => row.actor === player.id)
        .reduce((sum, row) => sum + row.cost, 0);
      const harvested: number = player.id === fixture.victim ? fixture.blowAmount : 0;
      const income = ordinaryIncome.find(receipt => receipt.player === player.id)!.balance -
        homeworldClassicDiscoveryNexusPlayer(fixture.afterSetup, player.id).spice;
      assert.equal(collected[player.id], baseline[player.id] - paid + harvested + income,
        'Shipment price and printed Collection must settle exactly once.');
    }
    const idle = homeworldClassicDiscoveryNexusPlayer(fixture.collection, fixture.fremen!);
    assert.equal(idle.reserves, homeworldClassicDiscoveryNexusPlayer(fixture.afterSetup, fixture.fremen!).reserves);
    homeworldClassicDiscoveryNexusInventory(fixture.collection);
  }
});

void test('original worm losses resolve before Great Maker votes and a typed Fremen ride without repeating casualties', () => {
  for (const advanced of [false, true]) {
    const fixture = createHomeworldClassicDiscoveryNexusFixture({ advanced, discovery: true,
      tech: advanced, ordinaryWormFirst: advanced });
    const before = homeworldClassicDiscoveryNexusPlayer(fixture.game, fixture.victim);
    assert.equal(before.forces[fixture.wormSource], 2);
    let game = openHomeworldClassicDiscoveryNexusEncounter(fixture, false);
    assert.equal(game.turn, 2);
    assert.equal(game.greatMaker!.stage, 'vote');
    const devoured = homeworldClassicDiscoveryNexusPlayer(game, fixture.victim);
    assert.equal(devoured.forces[fixture.wormSource] ?? 0, 0);
    assert.equal(devoured.tanks, before.tanks + 2);
    assert.equal(devoured.reserves, before.reserves);
    assert.equal(homeworldClassicDiscoveryNexusPlayer(game, fixture.collector)
      .forces[`${fixture.parent}:${fixture.parentSector}`], fixture.amount,
    'The army shipped to the separate parent site must survive the worm.');
    const order = [...game.order];
    for (let index = 0; index < order.length; index++) {
      assert.equal(game.decision?.kind, 'greatMakerVote');
      assert.equal(game.decision!.player, order[index]);
      legalPolicies(game, order[index]);
      // Advanced reaches a real majority; Basic stays a minority, so only the
      // preceding original Shai-Hulud can add the Nexus there.
      const vote: Action = { type: 'decision', event: game.decision!.event,
        yes: advanced ? index < order.length - 1 : index === order.length - 1 };
      rejected(game, order[(index + 1) % order.length], vote);
      game = applyAction(game, order[index], vote);
    }
    assert.equal(game.nexus, advanced, 'A strict majority adds the Nexus; a tie with no preceding worm adds none.');
    assert.equal(game.decision?.kind, 'greatMakerRide');
    assert.equal(game.decision!.player, fixture.fremen);
    const fremen = homeworldClassicDiscoveryNexusPlayer(game, fixture.fremen!);
    const elite = advanced ? 1 : 0;
    assert.ok(fremen.reserves >= 2 && (fremen.elites?.reserves ?? 0) >= elite);
    const view = viewGame(game, fixture.fremen!), destinations = view.greatMaker!.ride!.destinations;
    assert.ok(destinations.every(destination => !destination.territory.startsWith('homeworld:')));
    const target = destinations.find(destination => destination.territory === 'cistern');
    assert.ok(target, 'The revealed nested Cistern is a real Great Maker reserve destination.');
    const ride = greatMakerRideAction(view, target.territory, target.sector, 2, elite);
    assert.ok(ride);
    assert.equal(greatMakerRideAction(view, 'homeworld:fremen', 0, 2, elite), null);
    rejected(game, fixture.fremen!, { ...ride, territory: 'homeworld:fremen', sector: 0 });
    rejected(game, fixture.fremen!, { ...ride, elite: view.greatMaker!.ride!.eliteMax + 1 });
    legalPolicies(game, fixture.fremen!);
    game = applyAction(game, fixture.fremen!, ride);
    const after = homeworldClassicDiscoveryNexusPlayer(game, fixture.fremen!);
    assert.equal(after.forces['cistern:0'], 2);
    assert.equal(after.elites?.forces['cistern:0'] ?? 0, elite);
    assert.equal(after.reserves, fremen.reserves - 2);
    assert.equal(after.elites?.reserves ?? 0, (fremen.elites?.reserves ?? 0) - elite);
    assert.equal(after.spice, fremen.spice);
    assert.equal(after.shipped, fremen.shipped);
    assert.equal(after.moved, fremen.moved);
    assert.equal(game.greatMaker?.stage, 'complete');
    assert.deepEqual(game.wormRides, []);
    homeworldClassicDiscoveryNexusInventory(game);
  }
});

void test('the next-turn parent-board free entry reaches the revealed nested site without shipment, movement or spice', () => {
  for (const advanced of [false, true]) {
    const fixture = createHomeworldClassicDiscoveryNexusFixture({ advanced, discovery: true, tech: false });
    const game = fixture.game, view = viewGame(game, fixture.collector);
    assert.equal(game.turn, 2);
    assert.equal(game.phase, 0);
    assert.equal(game.decision?.kind, 'discoveryEntry');
    assert.equal(game.decision!.player, fixture.collector);
    const sources = view.discoveryEntry!.sources;
    assert.deepEqual(sources, [{ source: `${fixture.parent}:${fixture.parentSector}`,
      normal: fixture.amount - fixture.elite, elite: fixture.elite }]);
    const accept = discoveryEntryMoveAction(view, sources), decline = discoveryEntryDeclineAction(view);
    assert.ok(accept && decline);
    legalPolicies(game, fixture.collector);
    rejected(game, fixture.fremen!, accept);
    rejected(game, fixture.collector, { ...accept, groups: [{ source: 'homeworld:emperor', normal: 1, elite: 0 }] });
    rejected(game, fixture.collector, { ...accept, groups: [{ ...sources[0], normal: 21 }] });
    assert.equal(discoveryEntryMoveAction(view, [{ source: 'homeworld:emperor', normal: 1, elite: 0 }]), null);
    assert.equal(discoveryEntryMoveAction(view, [{ ...sources[0], normal: 21 }]), null);
    assert.equal(nativeShipmentSources(view, 21, 0), null);
    const before = structuredClone(homeworldClassicDiscoveryNexusPlayer(game, fixture.collector));
    const declined = applyAction(reload(game), fixture.collector, decline);
    assert.deepEqual(homeworldClassicDiscoveryNexusPlayer(declined, fixture.collector).forces, before.forces);
    const entered = enterHomeworldClassicDiscoveryNexus(reload(game), fixture.collector);
    const after = homeworldClassicDiscoveryNexusPlayer(entered, fixture.collector);
    assert.equal(after.forces['cistern:0'], fixture.amount);
    assert.equal(after.elites?.forces['cistern:0'] ?? 0, fixture.elite);
    assert.equal(after.forces[`${fixture.parent}:${fixture.parentSector}`] ?? 0, 0);
    assert.equal(after.reserves, before.reserves);
    assert.equal(after.elites?.reserves, before.elites?.reserves);
    assert.equal(after.spice, before.spice);
    assert.equal(after.shipped, before.shipped);
    assert.equal(after.moved, before.moved);
    rejected(entered, fixture.collector, accept);
    homeworldClassicDiscoveryNexusInventory(entered);
  }
});

void test('without Discovery the original worm alone creates the Nexus, and the settled alliance closes one deal', () => {
  for (const advanced of [false, true]) {
    const fixture = createHomeworldClassicDiscoveryNexusFixture({ advanced, discovery: false,
      tech: true, strongholds: advanced });
    assert.equal(fixture.token, null);
    assert.equal(fixture.game.turn, 2);
    assert.equal(fixture.game.nexus, false, 'No Nexus exists before the turn-two worm.');
    const production = fixture.firstStorm.techTokens!.production;
    assert.equal(production.owner, fixture.fremen, 'The first Storm assigns the Fremen’s original Technology.');
    const heighliner = fixture.afterShipments!.techTokens!.heighliners;
    if (heighliner.owner) {
      assert.equal(heighliner.triggeredTurn, 1, 'A real native shipment triggers Heighliners once per phase.');
      assert.equal(heighliner.spice, ownedTech(fixture.afterShipments!.techTokens, heighliner.owner).length);
    }
    const before = homeworldClassicDiscoveryNexusPlayer(fixture.game, fixture.victim);
    assert.equal(before.forces[fixture.wormSource], 2);
    const window = advanceHomeworldClassicDiscoveryNexus(fixture.game,
      state => state.nexus && !state.spiceWindow && !state.spiceResolution &&
        homeworldClassicDiscoveryNexusClean(state), fixture.actions);
    assert.equal(window.nexus, true, 'The original Shai-Hulud creates the Nexus by itself.');
    const devoured = homeworldClassicDiscoveryNexusPlayer(window, fixture.victim);
    assert.equal(devoured.forces[fixture.wormSource] ?? 0, 0);
    assert.equal(devoured.tanks, before.tanks + 2);
    assert.equal(devoured.reserves, before.reserves);
    assert.equal(homeworldClassicDiscoveryNexusPlayer(window, fixture.collector)
      .forces[`${fixture.parent}:${fixture.parentSector}`], fixture.amount);
    const closed = closeHomeworldClassicDiscoveryNexusAlliance(fixture, window);
    assert.equal(closed.drawing.nexusCards!.phase!.stage, 'drawing');
    assert.equal(closed.after.nexusCards!.cards!.hands[fixture.collector], 'ecaz');
    assert.equal(closed.after.nexusCards!.phase!.stage, 'complete');
    assert.equal(closed.after.nexusCards!.cards!.deck.includes('ecaz'), false);
    assert.equal(homeworldClassicDiscoveryNexusPlayer(closed.alliance, fixture.victim).ally, fixture.fremen);
    assert.equal(homeworldClassicDiscoveryNexusPlayer(closed.alliance, fixture.fremen!).ally, fixture.victim);
    rejected(closed.after, fixture.collector, closed.draw);
    homeworldClassicDiscoveryNexusInventory(closed.after);
  }
});

void test('the Advanced second pile and the settled alliance close exactly one original Nexus deal', () => {
  const fixture = createHomeworldClassicDiscoveryNexusFixture({ advanced: true, discovery: true,
    tech: true, strongholds: true, ordinaryWormFirst: true });
  let game = enterHomeworldClassicDiscoveryNexus(fixture.game, fixture.collector);
  game = advanceHomeworldClassicDiscoveryNexus(game, state => state.greatMaker?.stage === 'vote', fixture.actions);
  const order = [...game.order];
  game = voteHomeworldClassicDiscoveryNexus(game, order.map((_, index) => index < 2));
  assert.equal(game.nexus, true);
  game = advanceHomeworldClassicDiscoveryNexus(game, state => state.nexus && !state.spiceWindow &&
    !state.spiceResolution && homeworldClassicDiscoveryNexusClean(state), fixture.actions);
  const closed = closeHomeworldClassicDiscoveryNexusAlliance(fixture, game);
  assert.equal(closed.drawing.turn, 2);
  assert.equal(closed.drawing.nexusCards!.phase!.stage, 'drawing');
  assert.deepEqual(closed.drawing.nexusCards!.phase!.eligible, [fixture.collector]);
  assert.equal(closed.after.nexusCards!.cards!.hands[fixture.collector], 'ecaz');
  assert.equal(closed.after.nexusCards!.cards!.discard.includes('ecaz'), false);
  assert.equal(homeworldClassicDiscoveryNexusPlayer(closed.after, fixture.collector).spice,
    homeworldClassicDiscoveryNexusPlayer(closed.drawing, fixture.collector).spice);
  assert.equal(closed.after.nexusCards!.phase!.stage, 'complete');
  assert.equal(closed.after.strongholdCards!.claimedTurn, 1);
  assert.deepEqual(closed.after.wormRides, []);
  rejected(closed.after, fixture.collector, closed.draw);
  homeworldClassicDiscoveryNexusInventory(closed.after);
});

void test('all four minimal legal policies answer the real free entry, vote, ride and closing draw', () => {
  const fixture = createHomeworldClassicDiscoveryNexusFixture({ advanced: true, discovery: true,
    tech: true, strongholds: true });
  const vote = openHomeworldClassicDiscoveryNexusEncounter(fixture, false);
  const ride = voteHomeworldClassicDiscoveryNexus(reload(vote), [...vote.order].map(() => true));
  const closed = closeHomeworldClassicDiscoveryNexusAlliance(fixture, ride);
  const cases = [
    { game: fixture.game, owner: fixture.collector, type: 'decision' },
    { game: vote, owner: vote.decision!.player, type: 'decision' },
    { game: ride, owner: ride.decision!.player, type: 'decision' },
    { game: closed.drawing, owner: fixture.collector, type: 'nexusCardChoice' },
  ];
  for (const difficulty of DIFFICULTIES) for (const current of cases) {
    const view = viewGame(current.game, current.owner);
    view.players.find(player => player.id === current.owner)!.bot = difficulty;
    const action = botActions(view).find(candidate => candidate.type === current.type);
    assert.ok(action, `${difficulty} must answer the owned ${current.game.decision?.kind ?? 'closing Nexus draw'}.`);
    const after = applyAction(reload(current.game), current.owner, action);
    if (current.game.decision?.kind === 'greatMakerVote')
      assert.equal(after.greatMaker!.votes.length, current.game.greatMaker!.votes.length + 1);
    else if (current.game.decision?.kind === 'greatMakerRide')
      assert.equal(after.greatMaker!.stage, 'complete');
    else if (current.game.decision?.kind === 'discoveryEntry')
      rejected(after, current.owner, action);
    else assert.equal(after.nexusCards!.phase!.stage, 'complete');
    homeworldClassicDiscoveryNexusInventory(after);
  }
});
