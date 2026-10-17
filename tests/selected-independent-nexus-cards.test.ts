import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Game } from '../game/engine';
import { treacheryDeck } from '../game/cards';
import { ecazTreacheryCards } from '../game/ecaz-cards';
import { richeseCards } from '../game/richese-cards';
import { LEADER_SKILL_CARDS } from '../game/leader-skill-cards';
import { NEXUS_FACTIONS } from '../game/nexus-cards';
import { RECRUITS_CARD_ID } from '../game/recruits';
import { REINFORCEMENTS_CARD } from '../game/reinforcements';
import { HARASS_WITHDRAW_CARD } from '../game/harass-withdraw';
import { createIndependentCardModulesFixture, type IndependentCardModulesOptions } from './fixture-independent-card-modules';
import {
  actSelectedIndependentNexus, advanceSelectedIndependentNexus, createSelectedIndependentNexusBattleFixture,
  createSelectedIndependentNexusCacheFixture, createSelectedIndependentNexusCardsFixture,
  revealSelectedIndependentNexusPlans, selectedIndependentChoamFuelAction,
  selectedIndependentNexusClean as clean, selectedIndependentNexusPlayer as player,
} from './fixture-selected-independent-nexus-cards';

/** Component quantities only; no historical-save or seat assurance programme. */
function selectedStocks(game: Game): void {
  const actual = [...game.deck, ...game.discard, ...game.players.flatMap(player => player.hand),
    ...(game.ixSetupCards ?? []), ...(game.richeseCache ?? []), ...(game.richeseRemoved ?? []),
    ...(game.auction?.cards.slice(game.auction.index + Number(!!game.currentAuctionSale)) ?? [])];
  const expected = [...treacheryDeck(game.expansions), ...ecazTreacheryCards(),
    ...(game.players.some(player => player.faction === 'richese') ? richeseCards() : [])];
  assert.deepEqual(actual.map(card => card.id).sort(), expected.map(card => card.id).sort());
  const cards = game.nexusCards!.cards!;
  assert.deepEqual([...cards.deck, ...cards.discard, ...Object.values(cards.hands).filter(card => card !== null)].sort(), [...NEXUS_FACTIONS].sort());
  if (game.leaderSkills) assert.deepEqual([...game.leaderSkills.deck,
    ...Object.values(game.leaderSkills.offers).flatMap(offer => offer.cards),
    ...game.leaderSkills.assignments.map(assignment => assignment.skill)].sort(), LEADER_SKILL_CARDS.map(card => card.id).sort());
}

const configurations: Array<IndependentCardModulesOptions & { factions: NonNullable<IndependentCardModulesOptions['factions']> }> = [
  { expansions: ['ix'], factions: ['atreides', 'guild'], skills: true, tech: false },
  { expansions: ['choam'], factions: ['harkonnen', 'emperor', 'guild'], homeworlds: true, tech: true },
  { expansions: ['ix', 'choam'], factions: ['richese', 'choam', 'guild', 'atreides'], advanced: true, skills: true, homeworlds: true, tech: true, strongholds: true },
  { expansions: ['ix'], factions: ['ixians', 'tleilaxu', 'atreides', 'emperor', 'guild'], advanced: true, skills: true, homeworlds: true, tech: true, strongholds: true },
  { expansions: ['ix', 'choam'], factions: ['ixians', 'tleilaxu', 'richese', 'choam', 'harkonnen', 'guild'], advanced: true, skills: true, homeworlds: true, tech: true, strongholds: true },
];
for (const configuration of configurations) void test(`fresh ${configuration.expansions!.join('+')} independent/Nexus ${configuration.factions.length}-seat native setup keeps selected components and original reaction stamps`, () => {
  const fixture = createIndependentCardModulesFixture({ ...configuration, independent: true, nexus: true });
  const game = fixture.game;
  assert.deepEqual(game.expansions, configuration.expansions);
  assert.equal(game.ecazTreachery, true);
  assert.equal(game.status, 'playing');
  assert.equal(game.nexusCards!.cards!.deck.length, 12);
  assert.ok(Object.values(game.nexusCards!.cards!.hands).every(card => card === null));
  assert.equal(game.nexusCards!.phase, null);
  assert.equal(!!game.nexusIxianReplacementPreview, !configuration.factions.includes('ixians'));
  assert.equal(!!game.nexusIxianBetrayalPreview, configuration.factions.includes('ixians'));
  assert.equal(!!game.nexusHarkonnenBetrayalPreview, configuration.factions.includes('harkonnen'));
  assert.equal(!!game.guildBetrayalPreview, configuration.factions.includes('guild'));
  if (configuration.homeworlds) assert.ok(game.homeworlds!.custody);
  if (configuration.skills) assert.equal(game.leaderSkills!.assignments.length, configuration.factions.length);
  if (configuration.strongholds) assert.ok(Object.values(game.strongholdCards!.owners).every(owner => owner === null));
  selectedStocks(game);
});

void test('native CHOAM Cunning consumes a genuinely auctioned independent Recruits as Kulon fuel without playing Recruits', () => {
  const fixture = createSelectedIndependentNexusCardsFixture({ advanced: true, skills: true, tech: true, strongholds: true });
  assert.ok(player(fixture.afterPurchases, 'choam').hand.some(card => card.id === RECRUITS_CARD_ID));
  assert.ok(fixture.actions.some(step => step.actor === 'choam' && step.action.type === 'bid' && step.action.amount === 1));
  assert.equal(fixture.draws.find(draw => draw.step.actor === 'choam')!.after.nexusCards!.cards!.hands.choam, 'choam');
  let game = advanceSelectedIndependentNexus(fixture.game, state => state.phase === 5 && state.active === 'choam' && clean(state));
  assert.equal(game.recruits ?? null, null);
  const action = selectedIndependentChoamFuelAction(game), spice = player(game, 'choam').spice;
  game = actSelectedIndependentNexus(game, 'choam', action);
  assert.equal(game.nexusCards!.cards!.hands.choam, null);
  if (game.response) {
    assert.equal(game.response.kind, 'choamWorthless');
    assert.ok(player(game, 'choam').hand.some(card => card.id === RECRUITS_CARD_ID));
  } else assert.equal(game.nexusChoamLast!.stage, 'complete',
    'Without an eligible native counter, automatic completion needs no fabricated response');
  game = advanceSelectedIndependentNexus(game, clean);
  assert.equal(game.nexusChoamLast!.stage, 'complete');
  assert.equal(game.choamMovement!.bonus, 1);
  assert.equal(game.recruits ?? null, null, 'CHOAM conversion never runs the independent card’s printed Revival effect');
  assert.equal(game.discard.filter(card => card.id === RECRUITS_CARD_ID).length, 1);
  assert.equal(game.nexusCards!.cards!.discard.filter(card => card === 'choam').length, 1);
  assert.equal(player(game, 'choam').spice, spice);
  assert.throws(() => applyAction(game, 'choam', action));
  selectedStocks(game);
});

for (const advanced of [false, true]) void test(`${advanced ? 'Advanced all14/phase' : 'Basic'} native Richese two-marker Cunning materializes before independent Reinforcements pays its physical fee`, () => {
  const fixture = createSelectedIndependentNexusBattleFixture({ advanced, skills: advanced, tech: advanced, strongholds: advanced });
  assert.equal(player(fixture.afterFirstReveal, 'richese').reserves, 20);
  assert.equal(player(fixture.afterPair, 'richese').reserves, 15);
  assert.equal(player(fixture.afterPair, 'richese').forces[fixture.location], 5);
  assert.ok(player(fixture.afterPair, 'richese').noField!.deployed);
  assert.equal(fixture.afterPair.nexusCards!.cards!.hands.richese, null);
  assert.equal(fixture.afterPair.nexusRicheseCunningLast!.stage, 'shipped');
  const shipment = fixture.afterPair.nexusGuildBetrayalHistory!.at(-1)!;
  assert.equal(shipment.invoice.source, 'reserve');
  assert.equal(shipment.invoice.shipper, 'richese');
  assert.equal(shipment.invoice.turn, 2);
  assert.equal(shipment.invoice.price, 1);
  assert.equal(shipment.invoice.originalReceiver, 'guild');
  assert.equal(shipment.recipient, null);
  assert.ok(fixture.actions.some(step => step.actor === 'choam' && step.action.type === 'guildBetrayalPass' && step.action.event === shipment.invoice.event),
    'Cunning settles its genuine signed Guild fee acknowledgement before force custody changes');
  const preview = viewGame(fixture.game, 'richese').battle!.reinforcements!;
  assert.equal(preview.blocked, null);
  assert.deepEqual(preview.noField, { materializes: 3, reservesAfterReveal: 12 });
  assert.equal(preview.normal, 3);
  let game = revealSelectedIndependentNexusPlans(fixture.game, fixture.plans);
  assert.equal(player(game, 'richese').noField!.deployed, null);
  assert.equal(player(game, 'richese').forces[fixture.location], 8);
  assert.equal(player(game, 'richese').reserves, 12);
  const tanks = player(game, 'richese').tanks;
  game = advanceSelectedIndependentNexus(game, state => !state.battle && clean(state));
  assert.equal(game.lastBattleContext!.winner, 'richese');
  assert.equal(game.lastBattleContext!.result, 'normal');
  assert.equal(player(game, 'richese').reserves, 9, 'Three genuine uncommitted reserves pay the card after its own concealed army appears');
  assert.equal(player(game, 'richese').tanks, tanks + 5, 'Three reserve-fee counters plus two actual dial casualties');
  assert.equal(player(game, 'richese').forces[fixture.location], 6);
  assert.equal(game.discard.filter(card => card.id === REINFORCEMENTS_CARD).length, 1);
  assert.equal(game.nexusCards!.cards!.discard.filter(card => card === 'richese').length, 1);
  selectedStocks(game);
});

void test('an actual paid ten-force shipment leaves too few reserves for Reinforcements after the retained Cunning pair, while the plain plan remains legal', () => {
  const fixture = createSelectedIndependentNexusBattleFixture({ drainReserves: true });
  assert.equal(player(fixture.afterFirstReveal, 'richese').reserves, 20);
  assert.deepEqual(player(fixture.afterFirstReveal, 'richese').noField!.tokens.map(token => token.value).sort((a, b) => a - b), [0, 3, 5]);
  const funding = fixture.reserveFunding, shipment = fixture.reserveShipment;
  assert.ok(funding && shipment);
  assert.equal(funding.step.action.type, 'bribe');
  assert.equal(player(funding.after, 'choam').spice, player(funding.before, 'choam').spice - 9);
  assert.equal(player(funding.after, 'richese').bribes, player(funding.before, 'richese').bribes + 9);
  assert.equal(shipment.step.action.type, 'ship');
  assert.equal(player(shipment.after, 'richese').spice, player(shipment.before, 'richese').spice - 10);
  assert.equal(player(shipment.after, 'richese').reserves, 10);
  assert.equal(player(shipment.after, 'richese').forces['habbanya_ridge_sietch:17'], 10);
  assert.equal(shipment.after.nexusCards!.cards!.hands.richese, 'richese');
  assert.equal(fixture.beforePair.turn, 3);
  assert.equal(player(fixture.afterPair, 'richese').reserves, 5);
  const preview = viewGame(fixture.game, 'richese').battle!.reinforcements!;
  assert.deepEqual(preview.noField, { materializes: 3, reservesAfterReveal: 2 });
  assert.match(preview.blocked!, /three.*reserves.*after materialization/i);
  assert.throws(() => applyAction(fixture.game, 'richese', fixture.plans[0].action), /at least three own forces in reserves/i);
  assert.ok(player(fixture.game, 'richese').hand.some(card => card.id === REINFORCEMENTS_CARD));
  assert.deepEqual(fixture.game.battle!.plans, {});
  const plans = fixture.plans.map(plan => plan.actor === 'richese' ? { ...plan, action: { ...plan.action, defense: null } } : plan);
  let game = revealSelectedIndependentNexusPlans(fixture.game, plans);
  assert.equal(player(game, 'richese').reserves, 2);
  assert.equal(player(game, 'richese').forces[fixture.location], 8);
  game = advanceSelectedIndependentNexus(game, state => !state.battle && clean(state));
  assert.equal(game.lastBattleContext!.winner, 'richese');
  assert.ok(player(game, 'richese').hand.some(card => card.id === REINFORCEMENTS_CARD));
  assert.equal(game.discard.filter(card => card.id === REINFORCEMENTS_CARD).length, 0);
  selectedStocks(game);
});

void test('actual Richese cache purchase opens absent-Ix replacement and draws an original independent Harass without charging twice', () => {
  const fixture = createSelectedIndependentNexusCacheFixture({ advanced: true, skills: true, tech: true, strongholds: true });
  assert.equal(fixture.game.nexusCards!.cards!.hands.choam, 'ixians');
  assert.equal(fixture.game.players.some(player => player.faction === 'ixians'), false);
  assert.equal(player(fixture.game, 'choam').spice, player(fixture.beforePurchase, 'choam').spice - fixture.price);
  assert.ok(player(fixture.game, 'choam').hand.some(card => card.id === fixture.card.id));
  const paid = player(fixture.game, 'choam').spice, seller = player(fixture.game, 'richese').spice;
  let game = actSelectedIndependentNexus(fixture.game, 'choam', fixture.useAction);
  game = advanceSelectedIndependentNexus(game, state => !state.pendingNexusIxianReplacement && !state.currentAuctionSale && clean(state));
  assert.equal(player(game, 'choam').spice, paid);
  assert.equal(player(game, 'richese').spice, seller + fixture.price);
  assert.ok(player(game, 'choam').hand.some(card => card.id === HARASS_WITHDRAW_CARD));
  assert.equal(fixture.replacement.id, HARASS_WITHDRAW_CARD);
  assert.equal(player(game, 'choam').hand.some(card => card.id === fixture.card.id), false);
  assert.equal(game.discard.filter(card => card.id === fixture.card.id).length, 1);
  assert.equal(game.nexusCards!.cards!.discard.filter(card => card === 'ixians').length, 1);
  assert.equal(game.nexusCards!.cards!.hands.choam, null);
  assert.equal(game.richeseCache!.some(card => card.id === fixture.card.id), false);
  selectedStocks(game);
});
