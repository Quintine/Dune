import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { gameTerritories, validGameLocation } from '../game/board';
import { discoveryEntryDeclineAction, discoveryEntryMoveAction } from '../game/discovery-entry-options';
import { greatMakerRideAction } from '../game/great-maker-options';
import { nativeShipmentSources } from '../game/homeworld-options';
import { homeworldShipmentChoice } from '../game/homeworld-shipment-options';
import { quoteSpiceCollection } from '../game/board-resolution-quote';
import {
  advanceHomeworldClassicDiscovery, createHomeworldClassicDiscoveryFixture,
  enterHomeworldClassicDiscovery, homeworldClassicDiscoveryClean,
  homeworldClassicDiscoveryEntryWindow, homeworldClassicDiscoveryInventory,
  homeworldClassicDiscoveryPlayer, homeworldClassicDiscoveryShipmentWindow,
  homeworldClassicGreatMakerVoteWindow, settleHomeworldClassicDiscoveryArrival,
} from './fixture-homeworld-classic-discovery';

/** Source: authorized root UNOFFICIAL_Revised_Dune_Rulebook_v.2.3_web.pdf,
 * physical p.22 Homeworlds (not territories; normal battle modifications;
 * Emperor's split shipment), physical p.23 Discovery Tokens/Great Maker
 * (7 cards/8 tokens; ordinary worm; storm-order majority; native reserve ride;
 * parent-board-only next-turn free entry; normal paid shipment at 1/force).
 * These programmes select original unplayed Spice positions/token lottery,
 * not held cards, fake casualties, free-entry frames or source receipts. */
function legalPolicies(game: Game, actor: string): void {
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(game, actor);
    view.players.find(player => player.id === actor)!.bot = difficulty;
    const actions = botActions(view);
    assert.ok(actions.length, `${difficulty} needs an owned minimal legal continuation.`);
    const done = applyAction(structuredClone(game), actor, actions[0]);
    homeworldClassicDiscoveryInventory(done);
  }
}
function reject(game: Game, actor: string, action: Action): void {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}

void test('original Homeworld/Discovery setup admits Basic/Advanced two through six base seats with all physical cards and typed forces', () => {
  for (const advanced of [false, true]) for (const seats of [2, 3, 4, 5, 6] as const) {
    const fixture = createHomeworldClassicDiscoveryFixture({ advanced, seats });
    assert.equal(fixture.game.players.length, seats);
    assert.equal(fixture.game.turn, 1); assert.equal(fixture.game.phase, 7);
    homeworldClassicDiscoveryInventory(fixture.setup);
    homeworldClassicDiscoveryInventory(fixture.afterSetup);
    homeworldClassicDiscoveryInventory(fixture.game);
  }
});

void test('Great Maker devours the actual previous blow army before storm-order voting, with majority and tie outcomes and typed native ride', () => {
  for (const advanced of [false, true]) for (const majority of [false, true]) {
    const fixture = createHomeworldClassicDiscoveryFixture({ advanced, shipForMaker: true });
    // Explicit later conserved position, not a shipment/history receipt: keep
    // native board counters beside the actually shipped Emperor army to exercise
    // the printed ordinary-worm Fremen survival before the reserve-only ride.
    const nativePosition = homeworldClassicDiscoveryPlayer(fixture.game, fixture.fremen);
    const parentKey = `${fixture.wormTerritory}:${fixture.wormSector}`, positionedElite = advanced ? 1 : 0;
    assert.ok(nativePosition.reserves - (nativePosition.elites?.reserves ?? 0) >= 2 - positionedElite);
    nativePosition.reserves -= 2;
    nativePosition.forces[parentKey] = (nativePosition.forces[parentKey] ?? 0) + 2;
    if (positionedElite) {
      nativePosition.elites!.reserves -= positionedElite;
      nativePosition.elites!.forces[parentKey] = (nativePosition.elites!.forces[parentKey] ?? 0) + positionedElite;
    }
    fixture.staging.push(`Conserved two original Fremen native-reserve counters (${positionedElite} elite) into the previous blow sector after turn-one Collection opened; no casualty, shipment or history fabricated.`);
    const nativeBeforeWorm = structuredClone(nativePosition);
    homeworldClassicDiscoveryInventory(fixture.game);
    const originalArmy = homeworldClassicDiscoveryPlayer(fixture.game, fixture.collector);
    let game = homeworldClassicGreatMakerVoteWindow(fixture);
    assert.equal(game.turn, 2); assert.equal(game.phase, 1);
    assert.equal(game.greatMaker!.territory, fixture.wormTerritory);
    const devoured = homeworldClassicDiscoveryPlayer(game, fixture.collector);
    assert.equal(devoured.forces[parentKey] ?? 0, 0);
    assert.equal(devoured.tanks, originalArmy.tanks + fixture.amount);
    assert.equal(devoured.elites?.tanks ?? 0, (originalArmy.elites?.tanks ?? 0) + fixture.elite);
    assert.equal(devoured.reserves, originalArmy.reserves);
    assert.equal(game.discoveries!.tokens.find(token => token.id === fixture.token)!.revealedTurn, null);
    const order = [...game.order];
    for (let index = 0; index < order.length; index++) {
      assert.equal(game.decision?.kind, 'greatMakerVote'); assert.equal(game.decision!.player, order[index]);
      legalPolicies(game, order[index]);
      const vote: Action = { type: 'decision', event: game.decision!.event, yes: index < (majority ? 3 : 2) };
      reject(game, order[(index + 1) % order.length], vote);
      game = applyAction(game, order[index], vote);
    }
    const survived = homeworldClassicDiscoveryPlayer(game, fixture.fremen);
    assert.equal(survived.forces[parentKey], nativeBeforeWorm.forces[parentKey]);
    assert.equal(survived.elites?.forces[parentKey] ?? 0, nativeBeforeWorm.elites?.forces[parentKey] ?? 0);
    assert.equal(survived.tanks, nativeBeforeWorm.tanks);
    assert.equal(survived.reserves, nativeBeforeWorm.reserves);
    assert.equal(game.nexus, majority, 'Two of four is not a majority; three is.');
    assert.equal(game.decision?.kind, 'greatMakerRide'); assert.equal(game.decision!.player, fixture.fremen);
    legalPolicies(game, fixture.fremen);
    const before = structuredClone(homeworldClassicDiscoveryPlayer(game, fixture.fremen));
    const view = viewGame(game, fixture.fremen), destinations = view.greatMaker!.ride!.destinations;
    assert.ok(destinations.every(destination => !destination.territory.startsWith('homeworld:')));
    const target = destinations.find(destination => destination.territory === 'polar_sink')!; assert.ok(target);
    const elite = advanced ? 1 : 0, action = greatMakerRideAction(view, target.territory, target.sector, 2, elite);
    assert.ok(action);
    assert.equal(greatMakerRideAction(view, 'homeworld:fremen', 0, 2, elite), null);
    reject(game, fixture.fremen, { ...action, territory: 'homeworld:fremen', sector: 0 });
    reject(game, fixture.fremen, { ...action, territory: fixture.parent, sector: game.storm });
    reject(game, fixture.fremen, { ...action, elite: 4 });
    game = applyAction(game, fixture.fremen, action);
    const after = homeworldClassicDiscoveryPlayer(game, fixture.fremen);
    assert.equal(after.reserves, before.reserves - 2);
    assert.equal(after.elites?.reserves ?? 0, (before.elites?.reserves ?? 0) - elite);
    assert.equal(after.forces[`${target.territory}:${target.sector}`], (before.forces[`${target.territory}:${target.sector}`] ?? 0) + 2);
    assert.equal(after.elites?.forces[`${target.territory}:${target.sector}`] ?? 0,
      (before.elites?.forces[`${target.territory}:${target.sector}`] ?? 0) + elite);
    assert.equal(after.spice, before.spice); assert.equal(after.moved, before.moved); assert.equal(after.shipped, before.shipped);
    const home = viewGame(game, fixture.fremen).homeworlds!.worlds!.find(world => world.native === fixture.fremen)!;
    assert.equal(home.forces[fixture.fremen].normal + home.forces[fixture.fremen].elite, after.reserves);
    assert.equal(home.forces[fixture.fremen].elite, after.elites?.reserves ?? 0);
    homeworldClassicDiscoveryInventory(game);
  }
});

void test('actual next-turn free entry moves only the parent board ordinary/elite groups and leaves native pools, spice and normal allowances untouched', () => {
  for (const advanced of [false, true]) {
    const fixture = createHomeworldClassicDiscoveryFixture({ advanced });
    const game = homeworldClassicDiscoveryEntryWindow(fixture), view = viewGame(game, fixture.collector);
    assert.equal(game.turn, 2); assert.equal(game.phase, 0);
    assert.equal(homeworldClassicDiscoveryPlayer(game, fixture.collector).forces[`${fixture.face}:0`] ?? 0, 0);
    const sources = view.discoveryEntry!.sources;
    assert.deepEqual(sources, [{ source: `${fixture.parent}:${fixture.parentSector}`, normal: fixture.amount - fixture.elite, elite: fixture.elite }]);
    legalPolicies(game, fixture.collector);
    const accept = discoveryEntryMoveAction(view, sources), decline = discoveryEntryDeclineAction(view); assert.ok(accept && decline);
    const before = structuredClone(homeworldClassicDiscoveryPlayer(game, fixture.collector)), custody = structuredClone(game.homeworlds!.custody);
    const declined = applyAction(structuredClone(game), fixture.collector, decline);
    assert.deepEqual(homeworldClassicDiscoveryPlayer(declined, fixture.collector).forces, before.forces);
    for (const source of ['homeworld:emperor', 'homeworld:emperor:salusa', `${fixture.face}:0`, 'arrakeen:10']) {
      const groups = [{ source, normal: 1, elite: 0 }];
      assert.equal(discoveryEntryMoveAction(view, groups), null);
      reject(game, fixture.collector, { ...accept, groups });
    }
    reject(game, fixture.fremen, accept);
    reject(game, fixture.collector, { ...accept, groups: [{ ...sources[0], normal: 21 }] });
    const entered = applyAction(game, fixture.collector, accept), after = homeworldClassicDiscoveryPlayer(entered, fixture.collector);
    assert.equal(after.forces[`${fixture.face}:0`], fixture.amount);
    assert.equal(after.elites?.forces[`${fixture.face}:0`] ?? 0, fixture.elite);
    assert.equal(after.forces[`${fixture.parent}:${fixture.parentSector}`] ?? 0, 0);
    assert.deepEqual(entered.homeworlds!.custody, custody);
    assert.equal(after.reserves, before.reserves); assert.equal(after.elites?.reserves, before.elites?.reserves);
    assert.equal(after.spice, before.spice); assert.equal(after.shipped, before.shipped); assert.equal(after.moved, before.moved);
    assert.ok(gameTerritories(entered).every(territory => !territory.id.startsWith('homeworld:')));
    assert.ok(entered.discoveries!.tokens.every(token => !token.territory?.startsWith('homeworld:')));
    homeworldClassicDiscoveryInventory(entered);
  }
});

void test('normal revealed nested shipment uses the original tariff and explicit Emperor Kaitain/Salusa custody; concealed sites and invalid source allocations fail', () => {
  for (const advanced of [false, true]) {
    const fixture = createHomeworldClassicDiscoveryFixture({ advanced, prepareImperialSplit: true });
    const concealed = homeworldClassicDiscoveryShipmentWindow(fixture.game, fixture.collector);
    const hiddenShip: Action = { type: 'ship', territory: fixture.face, sector: 0, amount: 2, elite: 0,
      allyPayment: 0, homeworldSources: nativeShipmentSources(viewGame(concealed, fixture.collector), 2, 0) };
    assert.equal(validGameLocation(concealed, fixture.face, 0), false);
    reject(concealed, fixture.collector, hiddenShip);
    let game = homeworldClassicDiscoveryShipmentWindow(enterHomeworldClassicDiscovery(fixture), fixture.collector);
    const view = viewGame(game, fixture.collector), before = structuredClone(homeworldClassicDiscoveryPlayer(game, fixture.collector));
    const homes = structuredClone(view.homeworlds!.worlds!), salusa = game.homeworlds!.custody!.salusa && { ...game.homeworlds!.custody!.salusa };
    const sources = advanced ? { 'homeworld:emperor': { normal: 1, elite: 0 }, 'homeworld:emperor:salusa': { normal: 1, elite: 0 } }
      : { 'homeworld:emperor': { normal: 2, elite: 0 } };
    const action: Action = { type: 'ship', territory: fixture.face, sector: 0, amount: 2, elite: 0, allyPayment: 0, homeworldSources: sources };
    legalPolicies(game, fixture.collector);
    reject(game, fixture.collector, { ...action, territory: 'shrine' });
    reject(game, fixture.collector, { ...action, sector: 1 });
    reject(game, fixture.collector, { ...action, homeworldSources: { 'homeworld:fremen': { normal: 2, elite: 0 } } });
    reject(game, fixture.collector, { ...action, homeworldSources: { 'homeworld:emperor': { normal: 1, elite: 0 } } });
    reject(game, fixture.collector, { ...action, homeworldSources: { [`${fixture.face}:0`]: { normal: 2, elite: 0 } } });
    game = settleHomeworldClassicDiscoveryArrival(applyAction(game, fixture.collector, action));
    const after = homeworldClassicDiscoveryPlayer(game, fixture.collector);
    assert.equal(after.spice, before.spice - 2, 'Printed nested tariff is one spice per shipped force.');
    assert.equal(after.reserves, before.reserves - 2); assert.equal(after.elites?.reserves, before.elites?.reserves);
    assert.equal(after.forces[`${fixture.face}:0`], before.forces[`${fixture.face}:0`] + 2);
    assert.equal(after.elites?.forces[`${fixture.face}:0`], before.elites?.forces[`${fixture.face}:0`]);
    assert.equal(after.shipped, true); assert.equal(after.moved, before.moved);
    const nextHomes = viewGame(game, fixture.collector).homeworlds!.worlds!;
    for (const home of homes.filter(home => home.native === fixture.collector)) {
      const next = nextHomes.find(candidate => candidate.id === home.id)!;
      assert.equal(next.forces[fixture.collector].normal, home.forces[fixture.collector].normal - (sources[home.id as keyof typeof sources]?.normal ?? 0));
      assert.equal(next.forces[fixture.collector].elite, home.forces[fixture.collector].elite);
    }
    if (advanced) assert.equal(game.homeworlds!.custody!.salusa!.normal, salusa!.normal - 1);
    homeworldClassicDiscoveryInventory(game);
  }
});

void test('original native-home invasion remains a separate normal battle with native strength, native-only traitor calls and no Jacurutu reward', () => {
  for (const advanced of [false, true]) {
    const fixture = createHomeworldClassicDiscoveryFixture({ advanced, face: 'jacurutu-sietch' });
    let game = homeworldClassicDiscoveryShipmentWindow(enterHomeworldClassicDiscovery(fixture), fixture.collector);
    const home = viewGame(game, fixture.collector).homeworlds!.worlds!.find(world => world.native === fixture.fremen)!;
    const choice = homeworldShipmentChoice(viewGame(game, fixture.collector), home.id,
      { 'homeworld:emperor': { normal: 1, elite: 0 } });
    assert.ok(choice.action); assert.equal(choice.cost, 1);
    game = applyAction(game, fixture.collector, choice.action);
    game = advanceHomeworldClassicDiscovery(game, state => state.phase === 6 && !!state.active && homeworldClassicDiscoveryClean(state));
    const actor = game.active!; assert.ok(actor === fixture.collector || actor === fixture.fremen);
    game = applyAction(game, actor, { type: 'chooseBattle', territory: home.id,
      target: actor === fixture.collector ? fixture.fremen : fixture.collector });
    game = advanceHomeworldClassicDiscovery(game, state => !!state.battle && homeworldClassicDiscoveryClean(state) && !state.battle.preparation);
    const view = viewGame(game, fixture.collector), nativeBefore = structuredClone(homeworldClassicDiscoveryPlayer(game, fixture.fremen));
    assert.equal(view.battle!.native, fixture.fremen); assert.equal(view.battle!.nativeBattleStrength, home.nativeBattleStrength);
    assert.deepEqual(view.battle!.traitorVoters, [fixture.fremen]);
    const discoveryBefore = structuredClone(game.discoveries), boardBefore = game.players.map(player => ({ id: player.id, forces: { ...player.forces } }));
    const collection = quoteSpiceCollection(game).receipts.find(receipt => receipt.player === fixture.fremen)!.balance - nativeBefore.spice;
    const invader = homeworldClassicDiscoveryPlayer(game, fixture.collector), native = homeworldClassicDiscoveryPlayer(game, fixture.fremen);
    const weak = [...invader.leaders].filter(leader => !leader.dead).sort((a, b) => a.strength - b.strength)[0];
    const strong = [...native.leaders].filter(leader => !leader.dead).sort((a, b) => b.strength - a.strength)[0];
    legalPolicies(game, fixture.collector);
    game = applyAction(game, fixture.collector, { type: 'battlePlan', dial: 0, support: 0, leader: weak.id });
    legalPolicies(game, fixture.fremen);
    game = applyAction(game, fixture.fremen, { type: 'battlePlan', dial: 0, support: 0, leader: strong.id });
    reject(game, fixture.collector, { type: 'traitorCall', call: true });
    game = applyAction(game, fixture.fremen, { type: 'traitorCall', call: false });
    game = advanceHomeworldClassicDiscovery(game, state => !state.battle && !state.homeworldBattleLoss && homeworldClassicDiscoveryClean(state));
    assert.equal(game.lastBattleContext!.territory, home.id); assert.equal(game.lastBattleContext!.winner, fixture.fremen);
    assert.equal(homeworldClassicDiscoveryPlayer(game, fixture.collector).tanks, invader.tanks + 1);
    const nativeAfter = homeworldClassicDiscoveryPlayer(game, fixture.fremen);
    assert.equal(nativeAfter.reserves, nativeBefore.reserves); assert.equal(nativeAfter.tanks, nativeBefore.tanks);
    assert.equal(nativeAfter.spice, nativeBefore.spice + (game.phase === 7 ? collection : 0), 'One undialed invading loss earns no Jacurutu reward on a Homeworld.');
    assert.deepEqual(game.discoveries, discoveryBefore);
    assert.deepEqual(game.players.map(player => ({ id: player.id, forces: player.forces })), boardBefore);
    homeworldClassicDiscoveryInventory(game);
  }
});
