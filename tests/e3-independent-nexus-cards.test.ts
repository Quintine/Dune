import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Game } from '../game/engine';
import { treacheryDeck } from '../game/cards';
import { ecazTreacheryCards } from '../game/ecaz-cards';
import { NEXUS_FACTIONS } from '../game/nexus-cards';
import { LEADER_SKILL_CARDS } from '../game/leader-skill-cards';
import { REINFORCEMENTS_CARD } from '../game/reinforcements';
import { RECRUITS_CARD_ID, recruitsPlayAction } from '../game/recruits';
import {
  actE3IndependentNexusCard, advanceE3IndependentNexusCards, chooseE3IndependentAssassinate,
  createE3IndependentNexusCardBattle, e3IndependentNexusCardPlayer as player,
  e3IndependentNexusCardsClean as clean, revealE3IndependentNexusCardPlans,
  type E3IndependentNexusCardOptions,
} from './fixture-e3-independent-nexus-cards';

/** Printed selected stocks only; final save/seat assurance is a later gate. */
function originalStocks(game: Game): void {
  assert.deepEqual([...game.deck, ...game.discard, ...game.players.flatMap(player => player.hand),
    ...(game.auction?.cards.slice(game.auction.index + Number(!!game.currentAuctionSale)) ?? [])].map(card => card.id).sort(),
  [...treacheryDeck(game.expansions), ...ecazTreacheryCards()].map(card => card.id).sort());
  const cards = game.nexusCards!.cards!;
  assert.deepEqual([...cards.deck, ...cards.discard, ...Object.values(cards.hands).filter(card => card !== null)].sort(), [...NEXUS_FACTIONS].sort());
  if (game.leaderSkills) assert.deepEqual([...game.leaderSkills.deck,
    ...Object.values(game.leaderSkills.offers).flatMap(offer => offer.cards),
    ...game.leaderSkills.assignments.map(assignment => assignment.skill)].sort(), LEADER_SKILL_CARDS.map(card => card.id).sort());
}
function originalLoss(game: Game): void {
  assert.equal(game.lastBattleContext!.territory, 'pasty_mesa');
  assert.equal(game.lastBattleContext!.winner, 'guild');
  assert.equal(game.lastBattleContext!.result, 'normal');
  assert.equal(player(game, 'moritani').reserves, 11);
  assert.equal(player(game, 'moritani').tanks, 9, 'The real reserve fee and the six original committed counters reached the Tanks');
  assert.deepEqual(player(game, 'moritani').forces, {});
  assert.equal(game.discard.filter(card => card.id === REINFORCEMENTS_CARD).length, 1);
  assert.ok(player(game, 'moritani').hand.some(card => card.id === RECRUITS_CARD_ID));
  assert.equal(game.nexusCards!.cards!.hands.moritani, 'tleilaxu');
}
function reviveOriginalE3Loss(game: Game): Game {
  game = advanceE3IndependentNexusCards(game, state => state.turn === 3 && state.phase === 4 && clean(state));
  const spice = player(game, 'moritani').spice;
  assert.equal(player(game, 'moritani').tanks, 9);
  const play = recruitsPlayAction(viewGame(game, 'moritani').recruitsPreview); assert.ok(play);
  game = actE3IndependentNexusCard(game, 'moritani', play);
  assert.equal(viewGame(game, 'moritani').revival.freeRemaining, 4);
  assert.equal(viewGame(game, 'moritani').revival.limit, 7);
  game = actE3IndependentNexusCard(game, 'moritani', { type: 'revive', amount: 4, elite: 0 });
  game = advanceE3IndependentNexusCards(game, clean);
  assert.equal(player(game, 'moritani').reserves, 15);
  assert.equal(player(game, 'moritani').tanks, 5);
  assert.equal(player(game, 'moritani').revived, 4);
  assert.equal(player(game, 'moritani').freeForcesRevived, 4);
  assert.equal(player(game, 'moritani').spice, spice);
  assert.equal(game.discard.filter(card => card.id === RECRUITS_CARD_ID).length, 1);
  assert.equal(game.nexusCards!.cards!.hands.moritani, 'tleilaxu', 'Ordinary Recruits returns do not spend a held Secret Ally');
  if (game.homeworlds) {
    const world = viewGame(game, 'moritani').homeworlds!.worlds!.find(world => world.id === 'homeworld:moritani'); assert.ok(world);
    assert.deepEqual(world.forces.moritani, { normal: 15, elite: 0 });
  }
  originalStocks(game);
  return advanceE3IndependentNexusCards(game, state => state.phase === 5 && clean(state));
}

const advancedCases: Array<E3IndependentNexusCardOptions & { label: string }> = [
  { label: 'original E3' },
  { label: 'all14/World/phase', skills: true, homeworlds: true, tech: true, strongholds: true },
  { label: 'selected E3+Ix+CHOAM all14/World/phase', expansions: ['ecaz', 'ix', 'choam'], skills: true, homeworlds: true, tech: true, strongholds: true },
];
for (const sample of advancedCases) void test(`Advanced ${sample.label} native Moritani loss spends genuine Reinforcements, assassinates its original unused Traitor and revives real casualties with Recruits`, () => {
  const fixture = createE3IndependentNexusCardBattle({ ...sample, advanced: true });
  assert.equal(fixture.afterSetup.ecazTreachery, true);
  assert.equal(fixture.afterSetup.moritaniAssassinatePreview, true);
  assert.equal(fixture.afterSetup.moritaniAssassinate!.owner, 'moritani');
  assert.equal(fixture.afterSetup.moritaniAssassinate!.normalTraitorCall, false);
  assert.deepEqual(fixture.afterSetup.moritaniAssassinate!.opportunities, []);
  assert.deepEqual(player(fixture.afterSetup, 'moritani').traitors, [fixture.target]);
  assert.deepEqual(player(fixture.afterSetup, 'moritani').forces, { 'pasty_mesa:5': 6 });
  assert.ok(fixture.actions.some(step => step.actor === 'moritani' && step.action.type === 'traitor' && step.action.leader === fixture.target));
  assert.equal(fixture.actions.filter(step => step.actor === 'moritani' && step.action.type === 'bid' && step.action.amount === 1).length, 2);
  assert.ok(player(fixture.afterPurchases, 'moritani').hand.some(card => card.id === REINFORCEMENTS_CARD));
  assert.ok(player(fixture.afterPurchases, 'moritani').hand.some(card => card.id === RECRUITS_CARD_ID));
  assert.equal(fixture.draw.before.nexusCards!.cards!.hands.moritani, null);
  assert.equal(fixture.draw.after.nexusCards!.cards!.hands.moritani, 'tleilaxu');
  assert.equal(player(fixture.draw.after, 'guild').ally, 'emperor');
  assert.equal(player(fixture.draw.after, 'emperor').ally, 'guild');
  assert.equal(player(fixture.beforeMove, 'guild').forces['tueks_sietch:5'], 5);
  assert.equal(fixture.move.action.type, 'move');
  assert.equal(fixture.game.battle!.plans.moritani, undefined);
  assert.equal(viewGame(fixture.game, 'moritani').battle!.reinforcements!.blocked, null);
  originalStocks(fixture.game);

  let game = revealE3IndependentNexusCardPlans(fixture.game, fixture.plans);
  assert.equal(game.battle!.plans.moritani.weapon, REINFORCEMENTS_CARD);
  assert.equal(game.battle!.plans.moritani.leader, 'moritani-4');
  assert.equal(game.battle!.plans.guild.leader, 'guild-0');
  game = advanceE3IndependentNexusCards(game, state => !state.phaseOpening && !state.response && state.decision?.kind === 'moritaniAssassinate');
  originalLoss(game);
  const choice = viewGame(game, 'moritani').moritaniAssassinate!.pending!;
  assert.equal(choice.blocked, null);
  assert.equal(choice.opponent, 'guild');
  assert.ok(choice.cards.some(card => card.card === fixture.target));
  assert.equal(choice.cards.some(card => card.card === 'guild-0'), false, 'The committed winning disc stays outside the unused-Traitor choice');
  const beforeSpice = player(game, 'moritani').spice, target = player(game, 'guild').leaders.find(leader => leader.id === fixture.target)!;
  const bounty = target.strength;
  assert.equal(target.dead, false);
  if (sample.skills) assert.ok(game.leaderSkills!.assignments.some(assignment => assignment.owner === 'guild' && assignment.leader === fixture.target));
  assert.ok(game.decision?.kind === 'moritaniAssassinate');
  const event = game.decision.event;
  assert.throws(() => applyAction(game, 'guild', { type: 'decision', event, card: fixture.target }));
  game = chooseE3IndependentAssassinate(game, fixture.target);
  assert.equal(player(game, 'guild').leaders.find(leader => leader.id === fixture.target)!.dead, true);
  assert.equal(player(game, 'guild').leaders.find(leader => leader.id === 'guild-0')!.dead, false);
  assert.equal(player(game, 'moritani').spice, beforeSpice + bounty);
  assert.equal(game.moritaniAssassinate!.opportunities.at(-1)!.card, fixture.target);
  assert.equal(game.moritaniAssassinate!.opportunities.at(-1)!.opposingLeader, 'guild-0');
  assert.equal(game.moritaniAssassinate!.opportunities.at(-1)!.stage, 'revealed');
  if (sample.skills) {
    assert.equal(game.leaderSkills!.assignments.some(assignment => assignment.leader === fixture.target), false);
    assert.equal(game.leaderSkills!.deck.filter(skill => skill === 'killer-medic').length, 1);
  }
  game = reviveOriginalE3Loss(game);
  const receipt = game.moritaniAssassinate!.opportunities.at(-1)!;
  assert.equal(receipt.stage, 'replaced');
  assert.ok(receipt.replacement && receipt.replacement !== fixture.target);
  assert.equal(player(game, 'moritani').traitors.includes(fixture.target), false);
  assert.ok(player(game, 'moritani').traitors.includes(receipt.replacement));
  assert.equal(game.moritaniAssassinate!.normalTraitorCall, false);
  assert.equal(game.turn, 3);
  originalStocks(game);
});

void test('Basic all14/World Moritani with independent cards and genuine Nexus draw keeps Assassinate absent while Recruits returns its actual battle losses', () => {
  const fixture = createE3IndependentNexusCardBattle({ advanced: false, skills: true, homeworlds: true, tech: true });
  assert.ok(!fixture.afterSetup.moritaniAssassinatePreview && !fixture.afterSetup.moritaniAssassinate);
  assert.equal(fixture.afterSetup.leaderSkills!.assignments.length, 3);
  assert.equal(fixture.draw.after.nexusCards!.cards!.hands.moritani, 'tleilaxu');
  let game = revealE3IndependentNexusCardPlans(fixture.game, fixture.plans);
  game = advanceE3IndependentNexusCards(game, state => !state.battle && clean(state));
  originalLoss(game);
  assert.ok(!game.moritaniAssassinate);
  assert.equal(player(game, 'guild').leaders.find(leader => leader.id === fixture.target)!.dead, false);
  assert.deepEqual(player(game, 'moritani').traitors, [fixture.target]);
  game = reviveOriginalE3Loss(game);
  assert.equal(game.turn, 3);
  assert.ok(!game.moritaniAssassinate);
});
