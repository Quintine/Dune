import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Game } from '../game/engine';
import { treacheryDeck } from '../game/cards';
import { ecazTreacheryCards } from '../game/ecaz-cards';
import { LEADER_SKILL_CARDS } from '../game/leader-skill-cards';
import { NEXUS_FACTIONS } from '../game/nexus-cards';
import { createTechTokens } from '../game/tech-tokens';
import { createStrongholdCards } from '../game/stronghold-cards';
import { combatArmy } from '../game/combat-location';
import { RECRUITS_CARD_ID, recruitsPlayAction } from '../game/recruits';
import { HARASS_WITHDRAW_CARD } from '../game/harass-withdraw';
import { createClassicIndependentNexusFixture, type ClassicIndependentNexusOptions } from './fixture-classic-independent-nexus';
import {
  actWorldIndependentCard, advanceWorldIndependentCards, createWorldIndependentHarassFixture,
  createWorldIndependentRecruitsFixture, revealWorldIndependentHarass,
  worldIndependentCardPlayer as player, worldIndependentCardsClean,
} from './fixture-nexus-world-independent-cards';

function stock(game: Game): void {
  assert.deepEqual([...game.deck, ...game.discard, ...game.players.flatMap(player => player.hand),
    ...(game.auction?.cards.slice(game.auction.index) ?? [])].map(card => card.id).sort(),
  [...treacheryDeck([]), ...ecazTreacheryCards()].map(card => card.id).sort());
  const nexus = game.nexusCards!.cards!;
  assert.deepEqual([...nexus.deck, ...nexus.discard, ...Object.values(nexus.hands).filter(card => card !== null)].sort(),
    [...NEXUS_FACTIONS].sort());
  if (game.leaderSkills) assert.deepEqual([...game.leaderSkills.deck,
    ...game.leaderSkills.assignments.map(assignment => assignment.skill),
    ...Object.values(game.leaderSkills.offers).flatMap(offer => offer.cards)].sort(),
  LEADER_SKILL_CARDS.map(card => card.id).sort());
}
function worldPool(game: Game, actor: string, location: string) {
  const world = viewGame(game, actor).homeworlds!.worlds!.find(world => world.id === location); assert.ok(world);
  return { ...(world.forces[actor] ?? { normal: 0, elite: 0 }) };
}

const setupSamples: Array<ClassicIndependentNexusOptions & { roster: NonNullable<ClassicIndependentNexusOptions['roster']> }> = [
  { roster: ['emperor', 'guild'] },
  { roster: ['emperor', 'guild', 'atreides'], tech: true },
  { roster: ['emperor', 'fremen', 'atreides', 'guild'], advanced: true, skills: true, tech: true, strongholds: true },
  { roster: ['emperor', 'fremen', 'atreides', 'guild', 'harkonnen', 'beneGesserit'], advanced: true, skills: true, tech: true, strongholds: true },
];
for (const sample of setupSamples) {
  void test(`${sample.advanced ? 'Advanced all14/phase' : 'Basic'} ${sample.roster.length}-seat native start selects independent36, World custody and Nexus12 without early claims`, () => {
    const fixture = createClassicIndependentNexusFixture({ ...sample, independent: true, homeworlds: true });
    const { lobby, setup, game } = fixture;
    assert.deepEqual(lobby.expansions, []);
    assert.equal(lobby.lobbyOptions?.ecazTreachery, true);
    assert.deepEqual(lobby.homeworlds, { custody: null });
    assert.deepEqual(lobby.nexusCards, { cards: null, phase: null });
    assert.equal(lobby.leaderSkills?.deck.length ?? 0, 0, 'No skill is manufactured before the selected native setup');
    if (sample.tech) assert.deepEqual(lobby.techTokens, createTechTokens());
    if (sample.strongholds) assert.deepEqual(lobby.strongholdCards, createStrongholdCards());
    assert.equal(setup.status, 'setup');
    assert.equal(game.status, 'playing');
    assert.ok(game.homeworlds!.custody);
    assert.equal(game.nexusCards!.cards!.deck.length, 12);
    assert.ok(Object.values(game.nexusCards!.cards!.hands).every(card => card === null));
    assert.equal(game.nexusCards!.phase, null);
    if (sample.skills) {
      assert.equal(game.leaderSkills!.assignments.length, sample.roster.length);
      assert.deepEqual(game.leaderSkills!.offers, {});
    } else assert.ok(!game.leaderSkills);
    if (sample.strongholds) assert.deepEqual(game.strongholdCards, createStrongholdCards());
    assert.ok(fixture.actions.some(step => step.action.type === 'start'));
    assert.ok(fixture.actions.some(step => step.action.type === 'moduleOption' && step.action.module === 'ecazTreachery'));
    stock(game);
  });
}

for (const advanced of [false, true]) {
  void test(`${advanced ? 'Advanced all14/phase' : 'Basic'} genuine Recruits deals recheck the native Fremen population on each return`, () => {
    const fixture = createWorldIndependentRecruitsFixture({ advanced, skills: advanced, tech: advanced, strongholds: advanced });
    const initial = fixture.game, spice = player(initial, 'fremen').spice;
    assert.equal(initial.turn, 2);
    assert.equal(initial.phase, 4);
    assert.equal(player(initial, 'fremen').tanks, 18, 'Actual zero-dial first-turn defeat supplied the counters');
    assert.equal(player(initial, 'fremen').reserves, 2);
    assert.deepEqual(worldPool(initial, 'fremen', 'homeworld:fremen'), { normal: 2, elite: 0 });
    const action = recruitsPlayAction(viewGame(initial, 'emperor').recruitsPreview); assert.ok(action);
    assert.deepEqual(action, { type: 'card', card: RECRUITS_CARD_ID });
    const played = actWorldIndependentCard(initial, 'emperor', action);
    const before = viewGame(played, 'fremen');
    assert.equal(before.revival.homeworldBonus, 1);
    assert.equal(before.recruitsPreview!.rates.find(rate => rate.player === 'fremen')!.freeRate, 7);
    assert.throws(() => applyAction(played, 'fremen', { type: 'revive', amount: 8, elite: 0 }));
    const together = actWorldIndependentCard(played, 'fremen', { type: 'revive', amount: 7, elite: 0 });
    assert.deepEqual(worldPool(together, 'fremen', 'homeworld:fremen'), { normal: 9, elite: 0 });
    assert.equal(player(together, 'fremen').freeForcesRevived, 7);
    assert.equal(player(together, 'fremen').spice, spice);
    assert.equal(player(together, 'fremen').tanks, 11);

    let separate = actWorldIndependentCard(played, 'fremen', { type: 'revive', amount: 1, elite: 0 });
    assert.deepEqual(worldPool(separate, 'fremen', 'homeworld:fremen'), { normal: 3, elite: 0 });
    const changed = viewGame(separate, 'fremen');
    assert.equal(changed.revival.homeworldBonus, 0);
    assert.equal(changed.revival.freeRemaining, 5);
    assert.equal(changed.recruitsPreview!.rates.find(rate => rate.player === 'fremen')!.freeRate, 6);
    assert.throws(() => applyAction(separate, 'fremen', { type: 'revive', amount: 6, elite: 0 }));
    separate = actWorldIndependentCard(separate, 'fremen', { type: 'revive', amount: 5, elite: 0 });
    assert.deepEqual(worldPool(separate, 'fremen', 'homeworld:fremen'), { normal: 8, elite: 0 });
    assert.equal(player(separate, 'fremen').freeForcesRevived, 6);
    assert.equal(player(separate, 'fremen').spice, spice);
    assert.equal(viewGame(separate, 'fremen').revival.forcesRemaining, 0);
    assert.throws(() => applyAction(separate, 'fremen', { type: 'revive', amount: 1, elite: 0 }));
    assert.equal(separate.discard.filter(card => card.id === RECRUITS_CARD_ID).length, 1);
    separate = advanceWorldIndependentCards(separate, state => state.phase === 5 && worldIndependentCardsClean(state));
    assert.equal(separate.turn, 2);
    stock(separate);
  });

  void test(`${advanced ? 'Advanced all14/phase' : 'Basic'} genuinely dealt Harass returns typed foreign World visitors through native destinations`, () => {
    const fixture = createWorldIndependentHarassFixture({ advanced, skills: advanced, tech: advanced, strongholds: advanced });
    assert.equal(fixture.shipmentStep.action.type, 'homeworldShip');
    assert.deepEqual(combatArmy(fixture.afterShipment, fixture.visitor, fixture.location), { normal: 3, elite: 4 });
    let game = revealWorldIndependentHarass(fixture.game, fixture.plans);
    assert.equal(game.decision?.kind, 'harassWithdraw');
    const allocation = viewGame(game, fixture.owner).battle!.harassAllocation!;
    assert.deepEqual(allocation.context.locations, { [fixture.location]: { normal: 3, elite: 4 } });
    const before = player(game, fixture.owner), kaitain = worldPool(game, fixture.owner, 'homeworld:emperor');
    const salusa = advanced ? worldPool(game, fixture.owner, 'homeworld:emperor:salusa') : null;
    assert.ok(game.decision && 'event' in game.decision);
    game = actWorldIndependentCard(game, fixture.owner, { type: 'decision', event: game.decision.event, returns: fixture.returns });
    assert.deepEqual(viewGame(game, fixture.owner).battle!.traitorVoters, [fixture.native]);
    game = advanceWorldIndependentCards(game, state => !state.battle && !state.homeworldBattleLoss && worldIndependentCardsClean(state));
    const after = player(game, fixture.owner);
    assert.equal(game.lastBattleContext!.territory, fixture.location);
    assert.equal(game.lastBattleContext!.result, 'normal');
    assert.equal(game.lastBattleContext!.winner, fixture.native);
    assert.equal(after.reserves, before.reserves + 5);
    assert.equal(after.elites!.reserves, before.elites!.reserves + 3);
    assert.equal(after.tanks, before.tanks + 2);
    assert.equal(after.elites!.tanks, before.elites!.tanks + 1);
    assert.deepEqual(combatArmy(game, fixture.owner, fixture.location), { normal: 0, elite: 0 });
    assert.deepEqual(worldPool(game, fixture.owner, 'homeworld:emperor'), {
      normal: kaitain.normal + 2, elite: kaitain.elite + (advanced ? 0 : 3),
    });
    if (salusa) assert.deepEqual(worldPool(game, fixture.owner, 'homeworld:emperor:salusa'), {
      normal: salusa.normal, elite: salusa.elite + 3,
    });
    assert.equal(game.discard.filter(card => card.id === HARASS_WITHDRAW_CARD).length, 1);
    game = advanceWorldIndependentCards(game, state => state.phase === 7 && worldIndependentCardsClean(state));
    stock(game);
  });

  void test(`${advanced ? 'Advanced all14/phase' : 'Basic'} native own World still forbids the genuinely dealt Harass`, () => {
    const fixture = createWorldIndependentHarassFixture({ advanced, native: true, skills: advanced, tech: advanced, strongholds: advanced });
    assert.equal(fixture.native, fixture.owner);
    assert.match(viewGame(fixture.game, fixture.owner).battle!.harassWithdraw!.blocked!, /own.*Homeworld/i);
    assert.throws(() => applyAction(fixture.game, fixture.owner, fixture.plans[0].action), /own.*Homeworld/i);
    assert.ok(player(fixture.game, fixture.owner).hand.some(card => card.id === HARASS_WITHDRAW_CARD));
    assert.deepEqual(fixture.game.battle!.plans, {});
    const plans = fixture.plans.map(plan => plan.actor === fixture.owner
      ? { ...plan, action: { ...plan.action, defense: null } } : plan);
    let game = revealWorldIndependentHarass(fixture.game, plans);
    assert.deepEqual(viewGame(game, fixture.owner).battle!.traitorVoters, [fixture.owner]);
    game = advanceWorldIndependentCards(game, state => !state.battle && !state.homeworldBattleLoss && worldIndependentCardsClean(state));
    assert.equal(game.lastBattleContext!.territory, fixture.location);
    assert.equal(game.lastBattleContext!.result, 'normal');
    assert.ok(player(game, fixture.owner).hand.some(card => card.id === HARASS_WITHDRAW_CARD));
    assert.equal(game.discard.filter(card => card.id === HARASS_WITHDRAW_CARD).length, 0);
    stock(game);
  });
}
