import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Game } from '../game/engine';
import { treacheryDeck } from '../game/cards';
import { ecazTreacheryCards } from '../game/ecaz-cards';
import { richeseCards } from '../game/richese-cards';
import { NEXUS_FACTIONS } from '../game/nexus-cards';
import { LEADER_SKILL_CARDS } from '../game/leader-skill-cards';
import { DIFFICULTIES } from '../game/bot-profiles';
import { botActions } from '../game/bots';
import {
  actAtomicsModules, atomicsModulesPlayer as player, createAtomicsAftermathSneakContinuation,
  createNoFieldAtomicsModulesFixture, createPairedAtomicsModulesFixture,
  finishAtomicsModulesReveal, openLaterAtomicsModulesNexus,
} from './fixture-moritani-atomics-modules';

function stocks(game: Game): void {
  const cards = [...game.deck, ...game.discard, ...game.players.flatMap(player => player.hand),
    ...(game.richeseCache ?? []), ...(game.richeseRemoved ?? []),
    ...(game.auction?.cards.slice(game.auction.index + Number(!!game.currentAuctionSale)) ?? [])];
  assert.deepEqual(cards.map(card => card.id).sort(), [...treacheryDeck(game.expansions), ...ecazTreacheryCards(),
    ...(game.players.some(player => player.faction === 'richese') ? richeseCards() : [])].map(card => card.id).sort());
  const nexus = game.nexusCards!.cards!;
  assert.deepEqual([...nexus.deck, ...nexus.discard, ...Object.values(nexus.hands).filter(card => card !== null)].sort(), [...NEXUS_FACTIONS].sort());
  if (game.leaderSkills) assert.deepEqual([...game.leaderSkills.deck,
    ...Object.values(game.leaderSkills.offers).flatMap(offer => offer.cards),
    ...game.leaderSkills.assignments.map(assignment => assignment.skill)].sort(), LEADER_SKILL_CARDS.map(card => card.id).sort());
}
function handLimit(game: Game, actor: string): number {
  return viewGame(game, actor).players.find(player => player.id === actor)!.handLimit;
}
function reducedExactlyOnce(before: Game, after: Game, targets: readonly string[]): void {
  for (const target of targets) {
    const original = player(before, target).hand.map(card => card.id);
    assert.equal(original.length, 4, 'The paid bank bids filled the original hand');
    assert.equal(player(after, target).hand.length, 3);
    assert.equal(handLimit(after, target), 3);
    assert.equal(player(after, target).atomicsHandLimitPenalty, true);
    assert.equal(after.discard.filter(card => original.includes(card.id)).length -
      before.discard.filter(card => original.includes(card.id)).length, 1);
  }
  for (const other of before.players.filter(player => !targets.includes(player.id)))
    assert.deepEqual(player(after, other.id).hand, other.hand);
}

for (const modules of [false, true]) void test(`${modules ? 'Advanced selected all14/World/phase' : 'Basic selected'} actual Richese marker Atomics materializes capped native reserves before casualties and retains the original Guild invoice`, () => {
  const fixture = createNoFieldAtomicsModulesFixture({ advanced: modules, skills: modules, homeworlds: modules,
    tech: modules, strongholds: modules, expansions: modules ? ['ecaz', 'ix', 'choam'] : ['ecaz', 'choam'] });
  assert.equal(fixture.purchases.filter(bid => bid.step.actor === 'moritani').length, 3);
  assert.equal(fixture.purchases.filter(bid => bid.step.actor === 'guild').length, 3);
  assert.equal(fixture.draw.after.nexusCards!.cards!.hands.richese, 'tleilaxu');
  assert.equal(player(fixture.game, 'richese').noField!.deployed!.tokenId, fixture.noField);
  assert.equal(player(fixture.game, 'richese').forces['carthag:11'] ?? 0, 0);
  assert.equal(player(fixture.game, 'richese').reserves, 20);
  assert.equal(player(fixture.game, 'richese').spice, player(fixture.beforeEntry, 'richese').spice - 1);
  assert.equal(player(fixture.game, 'guild').spice, player(fixture.beforeEntry, 'guild').spice + 1);
  const invoice = fixture.game.nexusGuildBetrayalHistory!.at(-1)!;
  assert.equal(invoice.invoice.shipper, 'richese');
  assert.equal(invoice.invoice.price, 1);
  assert.equal(invoice.invoice.originalReceiver, 'guild');
  assert.ok(fixture.actions.some(step => step.actor === 'richese' && step.action.type === 'guildBetrayalPass' && step.action.event === invoice.invoice.event));
  const ownForces = structuredClone(player(fixture.game, 'moritani').forces);
  const receiptCount = fixture.game.nexusGuildBetrayalHistory!.length;
  const finished = finishAtomicsModulesReveal(fixture.game, fixture.actions), game = finished.game;
  assert.deepEqual(finished.seen, ['atomics']);
  assert.equal(player(game, 'richese').noField!.deployed, null);
  assert.equal(player(game, 'richese').noField!.lastShipped, fixture.noField);
  assert.equal(player(game, 'richese').reserves, 17);
  assert.equal(player(game, 'richese').tanks, player(fixture.game, 'richese').tanks + 3);
  assert.equal(player(game, 'richese').forces['carthag:11'] ?? 0, 0);
  assert.deepEqual(player(game, 'moritani').forces, ownForces, 'Atomics affects its actual territory, not the separate original Moritani start');
  assert.deepEqual(game.moritaniAtomics, { territory: 'carthag', turn: finished.beforeActivation.turn, moritaniId: 'moritani',
    allyAtActivation: 'guild', alliancePolicy: 'activation-targets' });
  assert.equal(game.moritaniTerror!.tokens.find(token => token.id === fixture.atomics)!.status, 'removed');
  reducedExactlyOnce(finished.beforeActivation, game, ['moritani', 'guild']);
  assert.equal(game.nexusGuildBetrayalHistory!.length, receiptCount);
  assert.equal(player(game, 'richese').spice, player(fixture.game, 'richese').spice);
  assert.equal(player(game, 'guild').spice, player(fixture.game, 'guild').spice);
  assert.equal(player(game, 'richese').shipped, true);
  assert.equal(game.active, 'richese');
  assert.equal(game.nexusCards!.cards!.hands.richese, 'tleilaxu');
  if (modules) {
    const world = viewGame(game, 'richese').homeworlds!.worlds!.find(world => world.id === 'homeworld:richese'); assert.ok(world);
    assert.deepEqual(world.forces.richese, { normal: 17, elite: 0 });
  }
  assert.throws(() => applyAction(game, 'moritani', { type: 'decision', reveal: true }));
  stocks(game);
});

void test('paired native Ecaz Atomics consumes its original arrival queue once and destroys ordinary counters, Sardaukar and actual spiritual advisors', () => {
  const fixture = createPairedAtomicsModulesFixture({ skills: true, homeworlds: true, tech: true, strongholds: true });
  assert.ok(fixture.firstShipment);
  assert.equal(fixture.firstShipment.step.actor, 'guild');
  assert.ok(fixture.actions.some(step => step.actor === 'beneGesserit' && step.action.type === 'decision' && step.action.accept === true));
  const queue = structuredClone(fixture.game.pendingArrivalOverlap!); assert.ok(queue);
  assert.equal(queue.entrant, 'emperor');
  assert.equal(queue.territory, 'carthag');
  assert.equal(player(fixture.game, 'emperor').forces['carthag:11'], 3);
  assert.equal(player(fixture.game, 'emperor').elites!.forces['carthag:11'], 2);
  assert.equal(player(fixture.game, 'guild').forces['carthag:11'], 1);
  const advisors = player(fixture.game, 'beneGesserit').forces['carthag:11']; assert.ok(advisors >= 1);
  assert.ok(player(fixture.game, 'beneGesserit').advisors?.carthag);
  const invoice = fixture.game.nexusGuildBetrayalHistory!.at(-1)!;
  assert.equal(invoice.invoice.shipper, 'emperor');
  assert.equal(invoice.invoice.price, 3);
  assert.ok(fixture.actions.some(step => step.actor === 'emperor' && step.action.type === 'guildBetrayalPass' && step.action.event === invoice.invoice.event));
  const finished = finishAtomicsModulesReveal(fixture.game, fixture.actions), game = finished.game;
  assert.equal(finished.seen[0], queue.first === 'terror' ? 'atomics' : 'ambassador');
  assert.equal(finished.seen.filter(entry => entry === 'atomics').length, 1);
  assert.ok(finished.seen.filter(entry => entry === 'ambassador').length <= 1);
  if (queue.first === 'ambassador') assert.deepEqual(finished.seen, ['ambassador', 'atomics']);
  assert.ok(!game.pendingArrivalOverlap && !game.pendingAmbassador && !game.pendingTerrorEntry);
  assert.equal(player(game, 'emperor').tanks, player(fixture.game, 'emperor').tanks + 3);
  assert.equal(player(game, 'emperor').elites!.tanks, player(fixture.game, 'emperor').elites!.tanks + 2);
  assert.equal(player(game, 'guild').tanks, player(fixture.game, 'guild').tanks + 1);
  assert.equal(player(game, 'beneGesserit').tanks, player(fixture.game, 'beneGesserit').tanks + advisors);
  for (const actor of ['emperor', 'guild', 'beneGesserit']) assert.equal(player(game, actor).forces['carthag:11'] ?? 0, 0);
  assert.equal(player(game, 'beneGesserit').advisors?.carthag, undefined);
  assert.equal(game.moritaniAtomics!.allyAtActivation, 'ecaz');
  reducedExactlyOnce(finished.beforeActivation, game, ['moritani', 'ecaz']);
  assert.equal(handLimit(game, 'guild'), 4);
  assert.equal(game.nexusGuildBetrayalHistory!.length, fixture.game.nexusGuildBetrayalHistory!.length);
  assert.equal(player(game, 'emperor').spice, player(fixture.game, 'emperor').spice);
  assert.equal(player(game, 'guild').spice, player(fixture.game, 'guild').spice);
  stocks(game);
});

void test('module Atomics keeps its original hand targets after an actual later worm changes Moritani’s alliance', () => {
  const fixture = createNoFieldAtomicsModulesFixture();
  const detonation = finishAtomicsModulesReveal(fixture.game).game;
  const aftermath = structuredClone(detonation.moritaniAtomics), discard = detonation.discard.map(card => card.id);
  let game = openLaterAtomicsModulesNexus(detonation);
  game = actAtomicsModules(game, 'moritani', { type: 'alliance', target: null });
  game = actAtomicsModules(game, 'moritani', { type: 'alliance', target: 'emperor' });
  game = actAtomicsModules(game, 'emperor', { type: 'alliance', target: 'moritani' });
  assert.equal(player(game, 'guild').ally, null);
  assert.equal(player(game, 'moritani').ally, 'emperor');
  assert.equal(handLimit(game, 'moritani'), 3);
  assert.equal(handLimit(game, 'guild'), 3);
  assert.equal(handLimit(game, 'emperor'), 4);
  assert.deepEqual(game.moritaniAtomics, aftermath);
  assert.deepEqual(game.discard.map(card => card.id), discard);
  assert.equal(player(game, 'richese').tanks, player(detonation, 'richese').tanks);
});

for (const modules of [false, true]) void test(`${modules ? 'Advanced all14/World/phase' : 'Basic'} Aftermath rejects a genuine new shipment while original adjacent movement and the later placed Sneak Attack remain available`, () => {
  const fixture = createNoFieldAtomicsModulesFixture({ advanced: modules, skills: modules, homeworlds: modules,
    tech: modules, strongholds: modules, expansions: modules ? ['ecaz', 'ix', 'choam'] : ['ecaz', 'choam'] });
  const detonation = finishAtomicsModulesReveal(fixture.game).game;
  const continued = createAtomicsAftermathSneakContinuation(detonation);
  assert.equal(player(continued.beforeShipment, 'emperor').shipped, false);
  assert.throws(() => applyAction(continued.beforeShipment, 'emperor', continued.blockedShipment), /Atomics Aftermath/);
  assert.equal(player(continued.beforeMove, 'emperor').forces['imperial_basin:11'], 1);
  assert.equal(continued.movement.action.type, 'move');
  assert.equal(continued.beforeSneak.pendingTerrorEntry!.stage, 'sneakAttack');
  assert.equal(player(continued.game, 'emperor').forces['carthag:11'], 1);
  assert.equal(player(continued.game, 'moritani').forces['carthag:11'], 1);
  assert.equal(player(continued.game, 'moritani').reserves, player(continued.beforeSneak, 'moritani').reserves - 1);
  assert.equal(continued.game.moritaniTerror!.tokens.find(token => token.id === continued.token)!.status, 'removed');
  assert.deepEqual(continued.game.moritaniAtomics, detonation.moritaniAtomics);
  assert.equal(player(continued.game, 'richese').tanks, player(detonation, 'richese').tanks);
  assert.ok(!continued.game.pendingTerrorEntry);
  if (modules) {
    const world = (state: Game) => {
      const home = viewGame(state, 'moritani').homeworlds!.worlds!.find(world => world.id === 'homeworld:moritani'); assert.ok(home);
      return home.forces.moritani;
    };
    assert.deepEqual(world(continued.game), { normal: world(continued.beforeSneak).normal - 1, elite: 0 },
      'Sneak Attack withdraws its actual ordinary counter from the original Grumman pool');
    for (const difficulty of DIFFICULTIES) {
      const view = viewGame(continued.beforeSneak, 'moritani');
      view.players.find(player => player.id === 'moritani')!.bot = difficulty;
      const action = botActions(view)[0];
      assert.ok(action, `${difficulty} must expose a legal owned Sneak Attack control`);
      assert.doesNotThrow(() => applyAction(continued.beforeSneak, 'moritani', action),
        `${difficulty} uses the actual native World withdrawal without policy calibration`);
    }
  }
  stocks(continued.game);
});
