import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, handLimit, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { gameDistance, gameTerritories, location, splitLocation, validGameLocation } from '../game/board';
import { strongholdPathBlocked } from '../game/occupancy';
import { discoveryEntryMoveAction, discoveryEntryDeclineAction } from '../game/discovery-entry-options';
import { discoveryFlightMove } from '../game/discovery-flight-options';
import { groundMovementRange, planetologistLeader } from '../game/planetologist-movement';
import { reserveShipmentCost } from '../game/shipment-price';
import { ownedTech } from '../game/tech-tokens';
import {
  advanceClassicDiscoverySkills, classicDiscoverySkillsClean, classicDiscoverySkillsEntryWindow,
  classicDiscoverySkillsShipmentWindow, createClassicDiscoverySkillsFixture, enterClassicDiscoverySkills,
  openClassicDiscoverySkillsBattle, revealClassicDiscoverySkills,
  settleClassicDiscoverySkillsArrival,
} from './fixture-discovery-classic-skills';

/** Exercise the actual owned bot controls, not a separately invented strategy. */
function legalPolicies(game: Game, actor: string): void {
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(game, actor);
    view.players.find(player => player.id === actor)!.bot = difficulty;
    const choices = botActions(view);
    assert.ok(choices.length, `${difficulty} needs an owned legal continuation.`);
    for (const action of choices) assert.doesNotThrow(() => applyAction(structuredClone(game), actor, action));
  }
}
function reject(game: Game, actor: string, action: Action): void {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}
function routeAtDistance(game: Game, owner: string, from: string, distance: number) {
  return gameTerritories(game).flatMap(territory => territory.sectors.map(sector => ({ territory: territory.id, sector })))
    .find(target => target.sector !== game.storm && gameDistance(game, from, location(target.territory, target.sector), key => {
      const source = splitLocation(key);
      return (source.sector !== 0 && source.sector === game.storm) || strongholdPathBlocked(game.players, owner, source.territory, false);
    }) === distance && !strongholdPathBlocked(game.players, owner, target.territory, false));
}

void test('classic trained offers and Discovery enter original Basic/Advanced setup and optional canonical Tech at three through six seats', () => {
  for (const advanced of [false, true]) for (const seats of [2, 3, 4, 5, 6] as const) {
    const fixture = createClassicDiscoverySkillsFixture({ advanced, seats, tech: seats >= 3 });
    assert.equal(fixture.setup.leaderSkills!.deck.length + Object.values(fixture.setup.leaderSkills!.offers)
      .reduce((sum, offer) => sum + offer.cards.length, 0), 14);
    assert.equal(fixture.setup.discoveries!.tokens.length, 8);
    assert.equal(fixture.game.leaderSkills!.assignments.length, seats);
    assert.equal(fixture.game.players.length, seats);
    assert.equal(fixture.game.turn, 1);
    assert.equal(fixture.game.phase, 7);
    if (seats >= 3) assert.equal(Object.values(fixture.game.techTokens!).filter(token => token.owner).length, 3);
  }
});

void test('physical next-turn free entry preserves the real trained posture, wallet, reserves and ordinary movement allowance', () => {
  for (const advanced of [false, true]) {
    const fixture = createClassicDiscoverySkillsFixture({ advanced, tech: true });
    const revealed = revealClassicDiscoverySkills(fixture);
    const old = revealed.players.find(player => player.id === fixture.collector)!;
    assert.equal(old.forces[`${fixture.face}:0`] ?? 0, 0, 'Reveal itself never occupies the nested site.');
    assert.equal(validGameLocation(revealed, fixture.face, 0), true);
    const window = classicDiscoverySkillsEntryWindow(fixture);
    assert.equal(window.turn, 2);
    assert.equal(window.phase, 0);
    const view = viewGame(window, fixture.collector), before = window.players.find(player => player.id === fixture.collector)!;
    assert.equal(planetologistLeader(view, fixture.collector), fixture.leader);
    assert.ok(view.leaderSkills!.assignments.find(assignment => assignment.owner === fixture.collector)!.faceUp);
    legalPolicies(window, fixture.collector);
    const accept = discoveryEntryMoveAction(view, view.discoveryEntry!.sources);
    const decline = discoveryEntryDeclineAction(view);
    assert.ok(accept && decline);
    reject(window, fixture.opponent, accept);
    const declined = applyAction(structuredClone(window), fixture.collector, decline);
    assert.deepEqual(declined.players.find(player => player.id === fixture.collector)!.forces, before.forces);
    const entered = applyAction(window, fixture.collector, accept);
    const after = entered.players.find(player => player.id === fixture.collector)!;
    assert.equal(after.forces[`${fixture.face}:0`], 3);
    assert.equal(after.forces[`${fixture.parent}:${fixture.parentSector}`] ?? 0, 0);
    assert.equal(after.spice, before.spice);
    assert.equal(after.reserves, before.reserves);
    assert.equal(after.moved, before.moved);
    assert.equal(after.shipped, before.shipped);
    assert.equal(planetologistLeader(viewGame(entered, fixture.collector), fixture.collector), fixture.leader);
    const shipping = classicDiscoverySkillsShipmentWindow(entered, fixture.collector);
    const held = shipping.players.find(player => player.id === fixture.collector)!;
    assert.equal(held.forces[`${fixture.face}:0`], 3, 'Original Storm leaves the protected physical nested forces in place.');
    assert.equal(held.tanks, before.tanks);
    assert.equal(held.moved, 0);
  }
});

void test('ordinary nested paid shipment and Planetologist range use original one-price and one-movement producers', () => {
  for (const advanced of [false, true]) {
    const fixture = createClassicDiscoverySkillsFixture({ advanced, tech: true });
    let game = classicDiscoverySkillsShipmentWindow(enterClassicDiscoverySkills(fixture), fixture.collector);
    const owner = structuredClone(game.players.find(player => player.id === fixture.collector)!);
    legalPolicies(game, fixture.collector);
    const site = gameTerritories(game).find(territory => territory.id === fixture.face)!;
    const cost = reserveShipmentCost({ faction: owner.faction, halfRate: true }, site.type, 1);
    assert.equal(cost, 1);
    game = applyAction(game, fixture.collector, { type: 'ship', territory: fixture.face, sector: 0, amount: 1, elite: 0, allyPayment: 0 });
    game = settleClassicDiscoverySkillsArrival(game);
    const shipped = game.players.find(player => player.id === fixture.collector)!;
    assert.equal(shipped.spice, owner.spice - cost);
    assert.equal(shipped.reserves, owner.reserves - 1);
    assert.equal(shipped.forces[`${fixture.face}:0`], 4);
    assert.equal(shipped.moved, 0);
    assert.equal(shipped.shipped, true);
    const target = routeAtDistance(game, fixture.collector, `${fixture.face}:0`, 2);
    assert.ok(target, 'The real nested board needs a two-territory ordinary Planetologist route.');
    assert.equal(groundMovementRange({ faction: shipped.faction, cityOrnithopters: false, selectedElites: 0, nativeBlocked: false }, 'range'), 2);
    const ordinary: Action = { type: 'move', from: `${fixture.face}:0`, amount: 1, elite: 0, ...target };
    reject(game, fixture.collector, ordinary);
    const beforeMove = structuredClone(shipped);
    game = applyAction(game, fixture.collector, { ...ordinary, planetologist: 'range' });
    game = settleClassicDiscoverySkillsArrival(game);
    const moved = game.players.find(player => player.id === fixture.collector)!;
    assert.equal(moved.moved, beforeMove.moved + 1);
    assert.equal(moved.spice, beforeMove.spice);
    assert.equal(moved.reserves, beforeMove.reserves);
    assert.equal(moved.forces[location(target.territory, target.sector)], 1);
    assert.equal(moved.forces[`${fixture.face}:0`], 3);
    reject(game, fixture.collector, { ...ordinary, planetologist: 'range' });
  }
});

void test('carried Discovery Ornithopter offers a fixed-three ordinary replacement, consumes its physical token once and adds no action', () => {
  for (const advanced of [false, true]) {
    const fixture = createClassicDiscoverySkillsFixture({ advanced, face: 'ornithopter', tech: true });
    const acquired = revealClassicDiscoverySkills(fixture);
    assert.equal(acquired.discoveries!.tokens.find(token => token.id === fixture.token)!.status, 'carried');
    assert.ok(viewGame(acquired, fixture.collector).discoveryOrnithopter!.blocked);
    let game = classicDiscoverySkillsShipmentWindow(acquired, fixture.collector);
    const before = structuredClone(game.players.find(player => player.id === fixture.collector)!);
    const from = `${fixture.parent}:${fixture.parentSector}`, target = routeAtDistance(game, fixture.collector, from, 3);
    assert.ok(target, 'The physical parent board needs an original three-territory route.');
    const ordinary: Action = { type: 'move', from, amount: 1, elite: 0, ...target };
    reject(game, fixture.collector, ordinary);
    const quote = discoveryFlightMove(viewGame(game, fixture.collector), ordinary);
    assert.equal(quote.blocked, null);
    assert.ok(quote.action);
    legalPolicies(game, fixture.collector);
    game = applyAction(game, fixture.collector, quote.action);
    game = settleClassicDiscoverySkillsArrival(game);
    const after = game.players.find(player => player.id === fixture.collector)!;
    assert.equal(after.moved, before.moved + 1);
    assert.equal(after.spice, before.spice);
    assert.equal(after.reserves, before.reserves);
    assert.equal(after.forces[location(target.territory, target.sector)], 1);
    assert.equal(game.discoveries!.tokens.find(token => token.id === fixture.token)!.status, 'removed');
    assert.equal(viewGame(game, fixture.collector).discoveryOrnithopter, null);
    reject(game, fixture.collector, quote.action);
    reject(game, fixture.collector, { ...ordinary, planetologist: 'range' });
  }
});

void test('original Harkonnen eight-card capacity overflows through actual Card Stash and only its owner selects the physical discard', () => {
  for (const advanced of [false, true]) {
    const fixture = createClassicDiscoverySkillsFixture({ advanced, collector: 'harkonnen', face: 'treachery-card-stash', amount: 1 });
    const owner = fixture.game.players.find(player => player.id === fixture.collector)!;
    const capacity = handLimit(owner);
    assert.equal(capacity, 8);
    // Explicit conserved physical card position, not an auction receipt or natural-play claim.
    while (owner.hand.length < capacity) {
      const card = fixture.game.deck.shift(); assert.ok(card); owner.hand.push(card);
    }
    fixture.staging.push('Moved original undealt base33 cards into the original Harkonnen eight-card hand to exercise the actual capacity boundary.');
    const wallet = owner.spice, originals = owner.hand.map(card => card.id), drawn = fixture.game.deck[0];
    assert.ok(drawn);
    const pending = revealClassicDiscoverySkills(fixture);
    assert.equal(pending.decision?.kind, 'discoveryDiscard');
    assert.equal(pending.decision?.player, fixture.collector);
    assert.deepEqual(pending.players.find(player => player.id === fixture.collector)!.hand.map(card => card.id), [...originals, drawn.id]);
    assert.equal(pending.players.find(player => player.id === fixture.collector)!.spice, wallet);
    legalPolicies(pending, fixture.collector);
    const action: Action = { type: 'decision', event: pending.discoveryStash!.event, card: drawn.id };
    reject(pending, fixture.opponent, action);
    reject(pending, fixture.collector, { ...action, card: 'not-a-physical-card' });
    const done = settleClassicDiscoverySkillsArrival(applyAction(pending, fixture.collector, action));
    assert.equal(done.players.find(player => player.id === fixture.collector)!.hand.length, capacity);
    assert.equal(done.players.find(player => player.id === fixture.collector)!.spice, wallet);
    assert.equal(done.discard.filter(card => card.id === drawn.id).length, 1);
    assert.equal(done.discoveries!.tokens.find(token => token.id === fixture.token)!.status, 'removed');
    reject(done, fixture.collector, action);
  }
});

void test('real nested battle keeps trained/untrained leader posture, Suk casualties and subsequent winner Tech reward ordering', () => {
  for (const advanced of [false, true]) for (const hide of [false, true]) {
    const fixture = createClassicDiscoverySkillsFixture({ advanced, tech: true, skill: 'suk-graduate', face: 'jacurutu-sietch' });
    let game = openClassicDiscoverySkillsBattle(fixture, hide);
    const winner = game.players.find(player => player.id === fixture.collector)!;
    const loser = game.players.find(player => player.id === fixture.opponent)!;
    const loserTech = ownedTech(game.techTokens, loser.id);
    assert.equal(loserTech.length, 1);
    assert.equal(viewGame(game, winner.id).leaderSkills!.assignments.find(assignment => assignment.owner === winner.id)!.faceUp, !hide);
    const leader = hide ? fixture.leader : winner.leaders.filter(candidate => candidate.id !== fixture.leader && !candidate.dead)
      .sort((a, b) => b.strength - a.strength)[0].id;
    const enemyLeader = loser.leaders.filter(candidate => !candidate.dead &&
      !game.leaderSkills!.assignments.some(assignment => assignment.leader === candidate.id))
      .sort((a, b) => a.strength - b.strength)[0].id;
    const counters = { tanks: winner.tanks, reserves: winner.reserves, forces: winner.forces[`${fixture.face}:0`] };
    game = applyAction(game, winner.id, { type: 'battlePlan', dial: 1, support: advanced ? 1 : 0, leader });
    game = applyAction(game, loser.id, { type: 'battlePlan', dial: 0, support: 0, leader: enemyLeader });
    game = advanceClassicDiscoverySkills(game, state => state.decision?.kind === 'sukRescue' ||
      state.lastBattleContext?.sukRescue?.completed === true);
    if (hide) {
      assert.equal(game.decision?.kind, 'sukRescue');
      if (game.decision?.kind !== 'sukRescue') throw new Error('Original skilled Suk decision missing.');
      assert.equal(game.decision.mode, 'skilled');
      assert.deepEqual(ownedTech(game.techTokens, loser.id), loserTech, 'Tech transfer must wait for actual winner casualties and rescue.');
      legalPolicies(game, winner.id);
      const choice = game.decision.options.findIndex(option => option.normal === 1 && option.elite === 0);
      assert.ok(choice >= 0);
      game = applyAction(game, winner.id, { type: 'decision', event: game.decision.event, choice });
    } else {
      // One ordinary casualty has one legal normal rescue and resolves automatically.
      assert.equal(game.lastBattleContext!.sukRescue!.completed, true);
    }
    game = advanceClassicDiscoverySkills(game, state => !state.pendingSukRescue &&
      state.techTokens![loserTech[0]].owner === winner.id && classicDiscoverySkillsClean(state));
    const rescued = game.players.find(player => player.id === winner.id)!;
    assert.equal(rescued.tanks, counters.tanks);
    assert.equal(rescued.reserves, counters.reserves + Number(!hide));
    assert.equal(rescued.forces[`${fixture.face}:0`], counters.forces - Number(!hide));
    assert.equal(game.lastBattleContext!.sukRescue!.completed, true);
    assert.equal(game.lastBattleContext!.winner, winner.id);
    assert.equal(game.lastBattleContext!.territory, fixture.face);
    assert.equal(viewGame(game, winner.id).leaderSkills!.assignments.find(assignment => assignment.owner === winner.id)!.faceUp, true);
    assert.equal(game.players.find(player => player.id === loser.id)!.tanks, 1);
  }
});

void test('original five-force nested invoice allows the distinct Bureaucrat holder to divert two or decline without changing shipment cost', () => {
  for (const advanced of [false, true]) {
    const fixture = createClassicDiscoverySkillsFixture({ advanced, skill: 'bureaucrat', skillOwner: 'emperor' });
    const revealed = revealClassicDiscoverySkills(fixture);
    const payer = revealed.players.find(player => player.faction === 'harkonnen')!.id;
    const window = classicDiscoverySkillsShipmentWindow(revealed, payer);
    const payerBefore = window.players.find(player => player.id === payer)!, receiverBefore = window.players.find(player => player.id === fixture.collector)!;
    let pending = applyAction(window, payer, { type: 'ship', territory: fixture.face, sector: 0, amount: 5, elite: 0, allyPayment: 0 });
    pending = advanceClassicDiscoverySkills(pending, game => game.decision?.kind === 'bureaucratPayment');
    assert.ok(pending.decision?.kind === 'bureaucratPayment');
    assert.equal(pending.decision!.player, fixture.opponent);
    legalPolicies(pending, fixture.opponent);
    for (const redirect of [false, true]) {
      let game = applyAction(structuredClone(pending), fixture.opponent, { type: 'decision', event: pending.decision!.event, redirect });
      game = settleClassicDiscoverySkillsArrival(game);
      const paid = game.players.find(player => player.id === payer)!, received = game.players.find(player => player.id === fixture.collector)!;
      assert.equal(paid.spice, payerBefore.spice - 5);
      assert.equal(paid.reserves, payerBefore.reserves - 5);
      assert.equal(paid.forces[`${fixture.face}:0`], 5);
      assert.equal(paid.moved, payerBefore.moved);
      assert.equal(paid.shipped, true);
      assert.equal(received.spice, receiverBefore.spice + 5 - (redirect ? 2 : 0));
    }
  }
});
