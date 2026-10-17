import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { HARASS_WITHDRAW_CARD } from '../game/harass-withdraw';
import { REINFORCEMENTS_CARD } from '../game/reinforcements';
import { ownedTech } from '../game/tech-tokens';
import { homeworldContext } from '../game/homeworld-game';
import { homeworldForceGroups } from '../game/homeworld-custody';
import {
  advanceMoritaniIndependentSkills,
  assertMoritaniIndependentSkillsCustody,
  chooseMoritaniIndependentSkillsAssassination,
  createMoritaniIndependentSkillsFixture,
  finishMoritaniIndependentSkillsBattle,
  moritaniIndependentSkillsClean,
  moritaniIndependentSkillsPlayer,
  quoteMoritaniIndependentSkillsBattle,
  resolveMoritaniIndependentSkillsBattle,
  stepMoritaniIndependentSkills,
  type MoritaniIndependentSkillsFixture,
} from './fixture-moritani-independent-skills';

const player = moritaniIndependentSkillsPlayer;
const reject = (game: Game, actor: string, action: Action) => {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
};
const owned = (fixture: MoritaniIndependentSkillsFixture, game: Game, identity: string) =>
  player(game, fixture.opponent).leaders.find((leader) => leader.id === identity)!;
const choiceOf = (game: Game, viewer: string) =>
  viewGame(game, viewer).moritaniAssassinate!.pending!;
const pool = (game: Game, actor: string) =>
  homeworldForceGroups(homeworldContext(game), game.homeworlds!.custody!)
    .find((home) => home.native === actor)!.forces[actor];

void test('Advanced standalone Moritani keeps the printed Assassinate power through the real lobby, the real loss and one held unused Traitor', () => {
  const f = createMoritaniIndependentSkillsFixture({ rules: 'advanced', cards: true, skills: true });
  const moritani = player(f.afterSetup, f.moritani), guild = player(f.afterSetup, f.opponent);
  // The producer is the ordinary fresh roster, never the separate audit profile.
  assert.equal(f.afterSetup.moritaniAssassinatePreview, true);
  assert.equal(f.afterSetup.moritaniAssassinate!.owner, f.moritani);
  assert.deepEqual(f.afterSetup.moritaniAssassinate!.opportunities, []);
  assert.equal(f.afterSetup.moritaniAssassinate!.normalTraitorCall, false);
  assert.deepEqual(f.afterSetup.moritaniAssassinateCallEvents, []);
  assert.deepEqual(f.afterSetup.expansions, ['ecaz']);
  assert.equal(f.afterSetup.ecazTreachery, true);
  assert.equal(f.afterSetup.leaderSkills!.assignments.length, 3);
  assert.equal(moritani.spice, 12);
  assert.equal(moritani.reserves, 14);
  assert.equal(moritani.tanks, 0);
  assert.deepEqual(moritani.forces, { [f.first]: 6 });
  assert.equal(guild.reserves, 15);
  assert.deepEqual(guild.forces, { 'tueks_sietch:5': 5 });
  assertMoritaniIndependentSkillsCustody(f.afterSetup);

  // The real revealed battle: Moritani's own physical Reinforcements/Harass loss.
  const battle = f.revealed.battle!;
  assert.equal(battle.territory, f.territory);
  assert.equal(battle.plans[f.moritani].weapon, REINFORCEMENTS_CARD);
  assert.equal(battle.plans[f.moritani].defense, HARASS_WITHDRAW_CARD);
  assert.equal(battle.plans[f.moritani].leader, f.loserLeader);
  assert.equal(battle.plans[f.opponent].leader, f.winnerLeader);
  assert.equal(f.returnsContext!.locations[f.first].normal, 4);
  assert.equal(f.returnsContext!.locations[f.second].normal, 2);
  assert.deepEqual(f.returns, { [f.first]: { normal: 2, elite: 0 } });
  assert.equal(f.pending.lastBattleContext!.winner, f.opponent);
  assert.equal(f.pending.lastBattleContext!.result, 'normal');
  assert.equal(f.pending.lastBattleContext!.territory, f.territory);

  // Real fee, real casualties and real returns, before the owner's choice.
  const held = player(f.pending, f.moritani), rival = player(f.pending, f.opponent);
  assert.equal(held.spice, 12);
  assert.equal(held.reserves, 13);
  assert.equal(held.tanks, 7);
  assert.deepEqual(held.forces, {});
  assert.equal(rival.spice, 5);
  assert.equal(rival.reserves, 15);
  assert.equal(rival.tanks, 2);
  assert.deepEqual(rival.forces, { [f.second]: 3 });
  assert.deepEqual(held.traitors, [f.traitorTarget]);
  assert.equal(owned(f, f.pending, f.traitorTarget).dead, false);
  assert.equal(owned(f, f.pending, f.winnerLeader).dead, false);

  // The owner's real, private choice: one conserved unused Traitor identity.
  assert.equal(f.pending.decision?.kind, 'moritaniAssassinate');
  assert.equal(f.pending.decision?.player, f.moritani);
  const decision = f.pending.decision;
  if (decision?.kind !== 'moritaniAssassinate') throw new Error('Expected the original Assassinate choice.');
  const event = decision.event;
  const choice = choiceOf(f.pending, f.moritani);
  assert.equal(choice.opponent, f.opponent);
  assert.equal(choice.territory, f.territory);
  assert.equal(choice.blocked, null);
  assert.deepEqual(choice.cards, [{ card: f.traitorTarget,
    name: owned(f, f.pending, f.traitorTarget).name,
    bounty: owned(f, f.pending, f.traitorTarget).strength, dead: false }]);
  assert.equal(choice.cards.some((card) => card.card === f.winnerLeader), false);
  assert.deepEqual(choiceOf(f.pending, f.opponent).cards, []);
  assert.deepEqual(choiceOf(f.pending, f.third).cards, []);
  reject(f.pending, f.opponent, { type: 'decision', event, card: f.traitorTarget });
  reject(f.pending, f.moritani, { type: 'decision', event: 'stale', card: f.traitorTarget });
  reject(f.pending, f.moritani, { type: 'decision', event, card: f.winnerLeader });
  reject(f.pending, f.moritani, { type: 'decision', event, card: 'guild-2' });
  reject(f.pending, f.moritani, { type: 'decision', event, decline: true, card: f.traitorTarget });

  const spent = chooseMoritaniIndependentSkillsAssassination(f.pending, f.traitorTarget);
  const receipt = spent.moritaniAssassinate!.opportunities.at(-1)!;
  const target = owned(f, spent, f.traitorTarget);
  assert.equal(target.dead, true);
  assert.equal(target.deaths, 1);
  assert.equal(target.usedAt, undefined);
  assert.equal(receipt.stage, 'revealed');
  assert.equal(receipt.card, f.traitorTarget);
  assert.equal(receipt.opposingLeader, f.winnerLeader);
  assert.equal(receipt.bounty, owned(f, f.pending, f.traitorTarget).strength);
  assert.equal(receipt.replacement, null);
  assert.equal(player(spent, f.moritani).spice, 12 + receipt.bounty);
  assert.equal(player(spent, f.opponent).spice, 5);
  // Ordered leader-skill custody: the dead leader's card returns once.
  assert.equal(spent.leaderSkills!.deck.filter((id) => id === 'killer-medic').length, 1);
  assert.deepEqual(spent.leaderSkills!.assignments, [
    { owner: f.moritani, leader: 'moritani-0', skill: f.chosen.moritani },
    { owner: f.third, leader: 'emperor-0', skill: f.chosen.emperor },
  ]);
  assert.deepEqual(player(spent, f.moritani).traitors, [f.traitorTarget]);
  // The original winner-card cleanup is preserved, not erased by the choice.
  assert.equal(spent.decision?.kind, 'battleCards');
  assert.equal(spent.decision?.player, f.opponent);
  assert.equal(player(spent, f.opponent).hand.some((card) => card.id === f.cards.winnerWeapon), true);
  assert.equal(spent.discard.filter((card) => card.id === REINFORCEMENTS_CARD).length, 1);
  assert.equal(spent.discard.filter((card) => card.id === HARASS_WITHDRAW_CARD).length, 1);
  assert.equal(spent.discard.filter((card) => card.id === f.cards.winnerWeapon).length, 0);
  assertMoritaniIndependentSkillsCustody(spent);

  const settled = finishMoritaniIndependentSkillsBattle(spent, { winnerDiscard: 'played' });
  assert.equal(player(settled, f.opponent).hand.some((card) => card.id === f.cards.winnerWeapon), false);
  assert.equal(settled.discard.filter((card) => card.id === f.cards.winnerWeapon).length, 1);
  const replacement = settled.moritaniAssassinate!.opportunities.at(-1)!;
  assert.equal(replacement.stage, 'replaced');
  assert.ok(replacement.replacement && replacement.replacement !== f.traitorTarget);
  assert.deepEqual(player(settled, f.moritani).traitors, [replacement.replacement]);
  assert.equal(settled.traitorReserve!.includes(replacement.replacement!), false);
  assert.equal(settled.players.flatMap((seat) => seat.traitors).includes(f.traitorTarget), false);
  assert.equal(player(settled, f.moritani).spice, 12 + replacement.bounty);
  assert.equal(settled.leaderSkills!.deck.filter((id) => id === 'killer-medic').length, 1);
  assert.equal(settled.traitorReserve!.length, f.pending.traitorReserve!.length - 1);
  assert.equal(settled.phase, 8);
  assert.equal(viewGame(settled, f.opponent).moritaniAssassinate!.history.at(-1)!.card, f.traitorTarget);
  assert.equal('replacement' in viewGame(settled, f.opponent).moritaniAssassinate!.history.at(-1)!, false);
  assertMoritaniIndependentSkillsCustody(settled);

  // Real quote of the revealed plans, including the committed specials.
  const quote = quoteMoritaniIndependentSkillsBattle(f);
  assert.equal(quote.result, 'normal');
  assert.equal(quote.winner, f.opponent);
  assert.deepEqual(quote.reinforcements, [{ player: f.moritani, card: REINFORCEMENTS_CARD,
    normal: 3, elite: 0 }]);
  assert.equal(quote.harassWithdraw!.length, 1);
  assert.equal(quote.harassWithdraw![0].player, f.moritani);
  assert.deepEqual(quote.harassWithdraw![0].returned, { normal: 2, elite: 0 });
  assert.deepEqual(quote.harassWithdraw![0].remaining, {
    normal: 4, normalFixedHalf: false, elite: 0, eliteStrength: 2, freeSupport: false });
  assert.deepEqual(quote.harassWithdraw![0].locations, { [f.first]: { normal: 2, elite: 0 } });
});

void test('Advanced standalone Moritani keeps the printed power without Leader Skills, and a real decline changes nothing', () => {
  const f = createMoritaniIndependentSkillsFixture({ rules: 'advanced', cards: true });
  assert.equal(f.afterSetup.leaderSkills, undefined);
  assert.equal(f.afterSetup.moritaniAssassinatePreview, true);
  assert.equal(f.pending.decision?.kind, 'moritaniAssassinate');
  const choice = choiceOf(f.pending, f.moritani);
  assert.deepEqual(choice.cards.map((card) => card.card), [f.traitorTarget]);
  assert.equal(choice.cards[0].bounty, owned(f, f.pending, f.traitorTarget).strength);
  const spent = chooseMoritaniIndependentSkillsAssassination(f.pending, f.traitorTarget);
  const target = owned(f, spent, f.traitorTarget);
  assert.equal(target.dead, true);
  assert.equal(player(spent, f.moritani).spice, 12 + spent.moritaniAssassinate!.opportunities.at(-1)!.bounty);
  const settled = finishMoritaniIndependentSkillsBattle(spent, { winnerDiscard: 'played' });
  assert.equal(settled.moritaniAssassinate!.opportunities.at(-1)!.stage, 'replaced');
  assert.equal(settled.leaderSkills, undefined);
  assert.equal(settled.discard.filter((card) => card.id === f.cards.winnerWeapon).length, 1);
  assertMoritaniIndependentSkillsCustody(settled);

  // A second identical lobby: declining is a real, state-preserving choice.
  const declined = createMoritaniIndependentSkillsFixture({ rules: 'advanced', cards: true });
  const before = structuredClone(declined.pending);
  const after = chooseMoritaniIndependentSkillsAssassination(declined.pending, null);
  const kept = owned(declined, after, declined.traitorTarget);
  assert.equal(kept.dead, false);
  assert.equal(kept.deaths, 0);
  assert.equal(after.moritaniAssassinate!.opportunities.at(-1)!.stage, 'declined');
  assert.equal(player(after, declined.moritani).spice, player(before, declined.moritani).spice);
  assert.deepEqual(player(after, declined.moritani).traitors, [declined.traitorTarget]);
  assert.deepEqual(player(after, declined.moritani).leaders, player(before, declined.moritani).leaders);
  const ended = finishMoritaniIndependentSkillsBattle(after, { winnerDiscard: 'played' });
  assert.deepEqual(ended.moritaniAssassinate!.opportunities, after.moritaniAssassinate!.opportunities);
  assert.equal(ended.traitorReserve!.length, declined.pending.traitorReserve!.length);
  assert.equal(viewGame(ended, declined.moritani).moritaniAssassinate!.history.length, 0);
  assertMoritaniIndependentSkillsCustody(ended);
});

void test('a no-card no-Skills normal start still produces the Advanced assassination, including the native Harkonnen roster', () => {
  const f = createMoritaniIndependentSkillsFixture({ rules: 'advanced', cards: false, opponent: 'harkonnen' });
  const harkonnen = player(f.afterSetup, f.opponent);
  // The plain 33-card classic inventory: no independent card is staged or played.
  assert.equal(f.afterSetup.ecazTreachery, undefined);
  assert.equal(f.cards.reinforcements, null);
  assert.equal(f.cards.harass, null);
  const cards = [...f.afterSetup.deck, ...f.afterSetup.discard,
    ...f.afterSetup.players.flatMap((seat) => seat.hand)];
  assert.equal(cards.length, 33);
  assert.equal(f.returns, null);
  // The Harkonnen native roster: four dealt Traitor Cards and a real capture.
  assert.equal(harkonnen.traitors.length, 4);
  assert.equal(f.pending.decision?.kind, 'moritaniAssassinate');
  const assassination = chooseMoritaniIndependentSkillsAssassination(f.pending, f.traitorTarget);
  assert.equal(owned(f, assassination, f.traitorTarget).dead, true);
  assert.equal(assassination.moritaniAssassinate!.opportunities.at(-1)!.bounty,
    owned(f, f.pending, f.traitorTarget).strength);
  const offer = resolveMoritaniIndependentSkillsBattle(f, assassination, { capture: { accept: true, captured: 'keep' } });
  const settled = finishMoritaniIndependentSkillsBattle(offer,
    { winnerDiscard: 'played', capture: { accept: true, captured: 'keep' } });
  const captives = settled.players.flatMap((seat) => seat.leaders)
    .filter((leader) => leader.capturedBy === f.opponent);
  assert.equal(captives.length, 1);
  assert.equal(captives[0].faction, 'moritani');
  assert.equal(captives[0].dead, false);
  assert.equal(settled.moritaniAssassinate!.opportunities.at(-1)!.stage, 'replaced');
  assert.equal(player(settled, f.moritani).tanks, 6);
  assert.equal(settled.discard.filter((card) => card.id === f.cards.winnerWeapon).length, 1);
  assertMoritaniIndependentSkillsCustody(settled);
});

void test('Basic independent Moritani resolves the same real Reinforcements/Harass loss without the Advanced assassination', () => {
  const f = createMoritaniIndependentSkillsFixture({ rules: 'basic', cards: true, skills: true });
  assert.equal(f.afterSetup.moritaniAssassinate, undefined);
  assert.equal(f.afterSetup.moritaniAssassinatePreview, undefined);
  assert.equal(f.afterSetup.leaderSkills!.assignments.length, 3);
  const battle = f.revealed.battle!;
  assert.equal(battle.plans[f.moritani].weapon, REINFORCEMENTS_CARD);
  assert.equal(battle.plans[f.moritani].defense, HARASS_WITHDRAW_CARD);
  assert.deepEqual(f.returns, { [f.first]: { normal: 4, elite: 0 } });
  assert.ok(moritaniIndependentSkillsClean(f.pending));
  assert.equal(f.pending.phase, 7);
  assert.equal(f.pending.lastBattleContext!.result, 'normal');
  assert.equal(f.pending.lastBattleContext!.winner, f.opponent);
  assert.equal(f.pending.moritaniAssassinate, undefined);
  const held = player(f.pending, f.moritani), rival = player(f.pending, f.opponent);
  assert.equal(held.spice, 12);
  assert.equal(held.reserves, 15);
  assert.equal(held.tanks, 5);
  assert.deepEqual(held.forces, {});
  assert.deepEqual(held.traitors, [f.traitorTarget]);
  assert.equal(rival.tanks, 1);
  assert.deepEqual(rival.forces, { [f.second]: 4 });
  assert.equal(owned(f, f.pending, f.traitorTarget).dead, false);
  assert.equal(owned(f, f.pending, f.winnerLeader).dead, false);
  assert.equal(f.pending.discard.filter((card) => card.id === REINFORCEMENTS_CARD).length, 1);
  assert.equal(f.pending.discard.filter((card) => card.id === HARASS_WITHDRAW_CARD).length, 1);
  assert.equal(f.pending.discard.filter((card) => card.id === f.cards.winnerWeapon).length, 1);
  const settings = structuredClone(f.pending.leaderSkills);
  const settled = finishMoritaniIndependentSkillsBattle(f.pending);
  assert.deepEqual(settled.leaderSkills, settings);
  assert.deepEqual(player(settled, f.moritani).traitors, [f.traitorTarget]);
  assertMoritaniIndependentSkillsCustody(settled);

  const plain = createMoritaniIndependentSkillsFixture({ rules: 'basic', cards: false, opponent: 'harkonnen' });
  assert.equal(plain.afterSetup.moritaniAssassinate, undefined);
  assert.equal(plain.pending.phase, 7);
  assert.equal(plain.pending.moritaniAssassinate, undefined);
  assert.deepEqual(player(plain.pending, plain.moritani).traitors, [plain.traitorTarget]);
  assert.equal(player(plain.pending, plain.moritani).tanks, 6);
  assert.equal(owned(plain, plain.pending, plain.traitorTarget).dead, false);
  assertMoritaniIndependentSkillsCustody(plain.pending);

  const variant = createMoritaniIndependentSkillsFixture({ rules: 'basic', cards: true });
  assert.equal(variant.afterSetup.moritaniAssassinate, undefined);
  assert.equal(variant.afterSetup.ecazTreachery, true);
  assert.equal(variant.pending.phase, 7);
  assert.equal(variant.pending.moritaniAssassinate, undefined);
  assert.equal(variant.pending.lastBattleContext!.winner, variant.opponent);
  assert.deepEqual(player(variant.pending, variant.moritani).traitors, [variant.traitorTarget]);
  assert.equal(owned(variant, variant.pending, variant.traitorTarget).dead, false);
  assert.equal(variant.pending.discard.filter((card) => card.id === REINFORCEMENTS_CARD).length, 1);
  assert.equal(variant.pending.discard.filter((card) => card.id === HARASS_WITHDRAW_CARD).length, 1);
  assertMoritaniIndependentSkillsCustody(variant.pending);
});

void test('a real normal Traitor call forfeits the printed power for the game and the used faction is never offered twice', () => {
  const called = createMoritaniIndependentSkillsFixture({ rules: 'advanced', cards: true, traitor: 'winner' });
  assert.equal(called.heldTraitor, called.winnerLeader);
  assert.deepEqual(choiceOf(called.pending, called.moritani).cards, []);
  const played = resolveMoritaniIndependentSkillsBattle(called, called.revealed,
    { traitorCalls: [called.moritani], winnerDiscard: 'played' });
  assert.equal(played.lastBattleContext!.result, 'traitor');
  assert.equal(played.lastBattleContext!.winner, called.moritani);
  assert.equal(played.moritaniAssassinate!.normalTraitorCall, true);
  assert.deepEqual(played.moritaniAssassinate!.opportunities, []);
  assert.equal(played.moritaniAssassinateCallEvents!.includes(played.lastBattleContext!.event), true);
  assert.equal(player(played, called.moritani).spice, 12 + owned(called, played, called.winnerLeader).strength);
  assert.deepEqual(player(played, called.moritani).revealedTraitors, [called.winnerLeader]);
  assert.ok((viewGame(played, called.moritani).moritaniAssassinate!.blocked ?? '').includes('forfeited'));
  assert.equal(played.decision?.kind, undefined);
  assertMoritaniIndependentSkillsCustody(played);

  // The original once-per-faction rule survives a second real battle.
  const f = createMoritaniIndependentSkillsFixture({ rules: 'advanced', cards: true });
  const spent = chooseMoritaniIndependentSkillsAssassination(f.pending, f.traitorTarget);
  let game = finishMoritaniIndependentSkillsBattle(spent, { winnerDiscard: 'played' });
  assert.equal(game.turn, 1);
  const actions: { actor: string; action: Action }[] = [];
  game = advanceMoritaniIndependentSkills(game,
    (state) => state.phase === 5 && state.active === f.moritani && moritaniIndependentSkillsClean(state), actions);
  assert.equal(player(game, f.moritani).spice, 15);
  game = stepMoritaniIndependentSkills(game,
    { actor: f.moritani, action: { type: 'ship', territory: f.territory, sector: Number(f.second.split(':')[1]),
      amount: 4, elite: 0, allyPayment: 0 } });
  game = advanceMoritaniIndependentSkills(game,
    (state) => state.phase === 5 && state.active === f.moritani && moritaniIndependentSkillsClean(state) && !state.pendingShipment,
    actions);
  assert.deepEqual(player(game, f.moritani).forces, { [f.second]: 4 });
  game = stepMoritaniIndependentSkills(game, { actor: f.moritani, action: { type: 'endMovement' } });
  game = advanceMoritaniIndependentSkills(game,
    (state) => state.phase === 6 && !state.battle && moritaniIndependentSkillsClean(state), actions);
  const offered = viewGame(game, game.active!).battleChoices.find((entry) => entry.territory === f.territory);
  assert.ok(offered);
  game = stepMoritaniIndependentSkills(game, { actor: offered!.chooser, action: { type: 'chooseBattle',
    territory: f.territory, target: offered!.attacker === offered!.chooser ? offered!.defender : offered!.attacker } });
  game = advanceMoritaniIndependentSkills(game,
    (state) => !!state.battle && !state.battle.revealed && moritaniIndependentSkillsClean(state), actions);
  game = stepMoritaniIndependentSkills(game, { actor: f.moritani, action: {
    type: 'battlePlan', dial: 2, support: 0, leader: f.loserLeader } });
  game = stepMoritaniIndependentSkills(game, { actor: f.opponent, action: {
    type: 'battlePlan', dial: 0, support: 0, leader: f.winnerLeader } });
  const second = resolveMoritaniIndependentSkillsBattle(f, game, { winnerDiscard: 'played' });
  assert.equal(second.lastBattleContext!.result, 'normal');
  assert.equal(second.lastBattleContext!.winner, f.opponent);
  assert.equal(second.moritaniAssassinate!.opportunities.length, 1);
  assert.equal(second.moritaniAssassinate!.opportunities[0].stage, 'replaced');
  assert.notEqual(second.decision?.kind, 'moritaniAssassinate');
  assert.equal(viewGame(second, f.moritani).moritaniAssassinate!.pending, null);
  assert.equal(viewGame(second, f.moritani).moritaniAssassinate!.history.length, 1);
  assert.equal(player(second, f.moritani).spice, 7);
  assert.equal(owned(f, second, f.traitorTarget).dead, true);
  assertMoritaniIndependentSkillsCustody(second);
});


void test('Advanced paired Skills/cards with original Tech/Strongholds return selected sectors, then assassinate one unused native Ecaz disc before Mentat replacement', () => {
  const f = createMoritaniIndependentSkillsFixture({
    paired: true, rules: 'advanced', skills: true, cards: true, tech: true, strongholds: true,
  });
  const loyal = f.afterSetup.ecazLoyalty!.card!;
  assert.notEqual(f.traitorTarget, loyal);
  assert.notEqual(f.traitorTarget, f.winnerLeader);
  assert.notEqual(f.traitorTarget, 'duke-vidal');
  assert.equal(owned(f, f.pending, f.traitorTarget).usedAt, undefined);
  assert.equal(f.afterEntry.players.find((seat) => seat.id === f.opponent)!.forces[f.second], 6);
  assert.deepEqual(player(f.pending, f.moritani).traitors, [f.traitorTarget]);
  assertMoritaniIndependentSkillsCustody(f.afterSetup);

  // Pick the other real sector, not the fixture's default allocation. The fee
  // consumes three of Moritani's own reserves before two undialed forces return.
  const returns = { [f.second]: { normal: 2, elite: 0 } };
  const offered = advanceMoritaniIndependentSkills(f.revealed,
    (game) => game.decision?.kind === 'harassWithdraw');
  const decision = offered.decision;
  if (decision?.kind !== 'harassWithdraw') throw new Error('Expected the real sector-return choice.');
  const returned = stepMoritaniIndependentSkills(offered, { actor: decision.player,
    action: { type: 'decision', event: decision.event, returns } });
  const pending = resolveMoritaniIndependentSkillsBattle(f, returned);
  const quote = quoteMoritaniIndependentSkillsBattle({ ...f, returns });
  assert.equal(quote.result, 'normal');
  assert.equal(quote.winner, f.opponent);
  assert.deepEqual(quote.scores, { attacker: 5, defender: 8 });
  assert.deepEqual(quote.harassWithdraw![0].locations, returns);
  assert.equal(quote.payments.find((payment) => payment.player === f.opponent)!.ownPayment, 4);
  assert.equal(player(pending, f.opponent).spice, player(f.afterSetup, f.opponent).spice - 4);
  assert.deepEqual(player(pending, f.opponent).forces, { [f.second]: 2 });
  assert.equal(player(pending, f.moritani).reserves, player(f.afterSetup, f.moritani).reserves - 3 + 2);
  assert.equal(player(pending, f.moritani).tanks, 7);
  assert.deepEqual(player(pending, f.moritani).forces, {});
  assert.equal(pending.lastBattleContext!.winner, f.opponent);
  assert.deepEqual(choiceOf(pending, f.moritani).cards.map((card) => card.card), [f.traitorTarget]);

  const skillBefore = pending.leaderSkills!;
  const targetSkill = skillBefore.assignments.find((entry) => entry.leader === f.traitorTarget)!;
  const spent = chooseMoritaniIndependentSkillsAssassination(pending, f.traitorTarget);
  const target = owned(f, spent, f.traitorTarget);
  const receipt = spent.moritaniAssassinate!.opportunities[0];
  assert.equal(target.dead, true);
  assert.equal(target.deaths, 1);
  assert.equal(target.usedAt, undefined);
  assert.equal(owned(f, spent, f.winnerLeader).dead, false);
  assert.equal(receipt.opposingLeader, f.winnerLeader);
  assert.equal(receipt.bounty, target.strength);
  assert.equal(receipt.bounty, 4);
  assert.equal(player(spent, f.moritani).spice, player(pending, f.moritani).spice + target.strength);
  assert.deepEqual(spent.leaderSkills!.assignments,
    skillBefore.assignments.filter((entry) => entry !== targetSkill));
  assert.deepEqual(spent.leaderSkills!.deck, [...skillBefore.deck, targetSkill.skill]);
  assert.equal(spent.decision?.kind, 'battleCards');
  assert.equal(spent.decision?.player, f.opponent);
  assert.equal(spent.discard.some((card) => card.id === f.cards.winnerWeapon), false);
  assertMoritaniIndependentSkillsCustody(spent);

  const beforeMentat = finishMoritaniIndependentSkillsBattle(spent, { winnerDiscard: 'played' },
    (game) => game.phase === 7 && moritaniIndependentSkillsClean(game));
  assert.equal(beforeMentat.discard.filter((card) => card.id === f.cards.winnerWeapon).length, 1);
  const lostTokens = ownedTech(f.game.techTokens, f.moritani);
  assert.equal(lostTokens.length, 1, 'the actual losing Moritani army entered with one original token');
  assert.equal(beforeMentat.techTokens![lostTokens[0]].owner, f.opponent,
    'Assassinate preserves the original winner cleanup and its automatic single-token transfer');
  assert.equal(beforeMentat.strongholdCards!.claimedTurn, 0,
    'no Stronghold Card is fabricated before the first genuine Mentat acquisition');
  assert.equal(beforeMentat.moritaniAssassinate!.opportunities[0].stage, 'revealed');
  assert.deepEqual(player(beforeMentat, f.moritani).traitors, [f.traitorTarget]);
  const settled = finishMoritaniIndependentSkillsBattle(beforeMentat);
  const replacement = settled.moritaniAssassinate!.opportunities[0];
  assert.equal(settled.moritaniAssassinate!.opportunities.length, 1);
  assert.equal(replacement.stage, 'replaced');
  assert.ok(replacement.replacement && replacement.replacement !== f.traitorTarget);
  assert.notEqual(replacement.replacement, loyal);
  assert.deepEqual(player(settled, f.moritani).traitors, [replacement.replacement]);
  assert.equal(settled.traitorReserve!.length, pending.traitorReserve!.length - 1);
  assert.equal(settled.players.flatMap((seat) => seat.traitors).includes(f.traitorTarget), false);
  assert.equal(settled.leaderSkills!.deck.filter((skill) => skill === targetSkill.skill).length, 1);
  assert.deepEqual(settled.ecazLoyalty, f.afterSetup.ecazLoyalty);
  assertMoritaniIndependentSkillsCustody(settled);
});

void test('Basic paired Skills/cards loss leaves the unused trained Ecaz disc and held Traitor intact through Mentat', () => {
  const f = createMoritaniIndependentSkillsFixture({ paired: true, rules: 'basic', skills: true, cards: true });
  assert.equal(f.pending.lastBattleContext!.winner, f.opponent);
  assert.equal(f.pending.lastBattleContext!.result, 'normal');
  assert.equal(f.pending.phase, 7);
  assert.ok(moritaniIndependentSkillsClean(f.pending));
  assert.equal(f.pending.moritaniAssassinate, undefined);
  assert.deepEqual(f.returns, { [f.first]: { normal: 4, elite: 0 } });
  assert.equal(player(f.pending, f.moritani).reserves, player(f.afterSetup, f.moritani).reserves - 3 + 4);
  assert.equal(player(f.pending, f.moritani).tanks, 5);
  const settled = finishMoritaniIndependentSkillsBattle(f.pending);
  assert.equal(owned(f, settled, f.traitorTarget).dead, false);
  assert.equal(owned(f, settled, f.traitorTarget).usedAt, undefined);
  assert.deepEqual(settled.leaderSkills, f.pending.leaderSkills);
  assert.deepEqual(player(settled, f.moritani).traitors, [f.traitorTarget]);
  assert.equal(settled.discard.filter((card) => card.id === f.cards.winnerWeapon).length, 1);
  assertMoritaniIndependentSkillsCustody(settled);
});

void test('paired Advanced Skills with original phase modules pays the printed Ecaz bounty and winner Tech without independent cards', () => {
  const f = createMoritaniIndependentSkillsFixture({ paired: true, rules: 'advanced', skills: true,
    tech: true, strongholds: true });
  assert.equal(f.pending.lastBattleContext!.winner, f.opponent);
  assert.equal(f.returns, null);
  assert.equal(f.cards.reinforcements, null);
  assert.equal(f.cards.harass, null);
  assert.equal(player(f.pending, f.moritani).reserves, player(f.afterSetup, f.moritani).reserves);
  assert.equal(player(f.pending, f.moritani).tanks, 6);
  const physical = [...f.pending.deck, ...f.pending.discard, ...f.pending.players.flatMap((seat) => seat.hand)];
  assert.equal(physical.length, 33);
  assert.equal(physical.some((card) => card.id === REINFORCEMENTS_CARD || card.id === HARASS_WITHDRAW_CARD), false);
  const defeatedTokens = Object.entries(f.pending.techTokens!).filter(([, token]) =>
    token.owner === f.moritani).map(([id]) => id);
  const spent = chooseMoritaniIndependentSkillsAssassination(f.pending, f.traitorTarget);
  assert.equal(owned(f, spent, f.traitorTarget).dead, true);
  assert.equal(spent.moritaniAssassinate!.opportunities[0].bounty, 4);
  assert.equal(player(spent, f.moritani).spice, player(f.pending, f.moritani).spice + 4);
  assert.equal(spent.leaderSkills!.assignments.some((entry) => entry.leader === f.traitorTarget), false);
  assertMoritaniIndependentSkillsCustody(spent);
  const settled = finishMoritaniIndependentSkillsBattle(spent, { winnerDiscard: 'played' });
  assert.equal(settled.phase, 8, 'plain paired Skills keeps the original phase envelope without a card-module dependency');
  assert.equal(settled.discard.filter(card => card.id === f.cards.winnerWeapon).length, 1);
  assert.equal(settled.moritaniAssassinate!.opportunities.length, 1);
  assert.equal(settled.moritaniAssassinate!.opportunities[0].stage, 'replaced');
  assert.equal(settled.traitorReserve!.length, f.pending.traitorReserve!.length - 1);
  assert.equal(Object.entries(settled.techTokens!).filter(([id, token]) =>
    defeatedTokens.includes(id) && token.owner === f.opponent).length, 1);
  assertMoritaniIndependentSkillsCustody(settled);
});

void test('Advanced native World cards pay their real normal source fee and assassinate a different unused trained disc before one Mentat replacement', () => {
  let initial = createGame('WORLDASSASSINATE', newPlayer('native-owner', 'Moritani', 'moritani'), true, ['ecaz']);
  joinGame(initial, newPlayer('native-rival', 'Guild', 'guild'));
  joinGame(initial, newPlayer('native-court', 'Emperor', 'emperor'));
  for (const action of [
    { type: 'homeworlds', enabled: true },
    { type: 'moduleOption', module: 'leaderSkills', enabled: true },
    { type: 'moduleOption', module: 'ecazTreachery', enabled: true },
    { type: 'techTokens', enabled: true },
    { type: 'strongholdCards', enabled: true },
  ] as const) initial = applyAction(initial, initial.host, action);
  const f = createMoritaniIndependentSkillsFixture({ initial });
  const shipment = f.shipment!;
  assert.deepEqual(pool(shipment.after, f.opponent),
    { normal: pool(shipment.before, f.opponent).normal - 1, elite: 0 });
  assert.equal(player(shipment.after, f.opponent).spice, player(shipment.before, f.opponent).spice - 1);
  assert.equal(player(f.afterEntry, f.opponent).forces[f.second], 6);
  const plan = f.plans.find((step) => step.actor === f.moritani)!;
  if (plan.action.type !== 'battlePlan') throw new Error('Expected the real Moritani plan.');
  reject(f.game, f.moritani, { ...plan.action,
    reinforcementsSources: { 'homeworld:guild': { normal: 3, elite: 0 } } });
  reject(f.game, f.moritani, { ...plan.action,
    reinforcementsSources: { 'homeworld:moritani': { normal: 2, elite: 0 } } });
  assert.equal(f.pending.lastBattleContext!.winner, f.opponent);
  assert.equal(f.pending.lastBattleContext!.result, 'normal');
  assert.deepEqual(pool(f.pending, f.moritani),
    { normal: pool(f.revealed, f.moritani).normal - 3 + 2, elite: 0 });
  assert.equal(player(f.pending, f.moritani).tanks, 7);
  assert.deepEqual(player(f.pending, f.moritani).forces, {});
  assert.deepEqual(player(f.pending, f.opponent).forces, { [f.second]: 4 });
  assert.deepEqual(f.returns, { [f.first]: { normal: 2, elite: 0 } });
  const assignment = f.pending.leaderSkills!.assignments.find((entry) => entry.leader === f.traitorTarget)!;
  assert.ok(assignment);
  assert.notEqual(f.traitorTarget, f.winnerLeader);
  assert.equal(owned(f, f.pending, f.traitorTarget).usedAt, undefined);
  const spent = chooseMoritaniIndependentSkillsAssassination(f.pending, f.traitorTarget);
  const target = owned(f, spent, f.traitorTarget);
  assert.equal(target.dead, true);
  assert.equal(target.deaths, 1);
  assert.equal(target.usedAt, undefined);
  assert.equal(owned(f, spent, f.winnerLeader).dead, false);
  assert.deepEqual(spent.leaderSkills!.deck, [...f.pending.leaderSkills!.deck, assignment.skill]);
  assert.equal(spent.leaderSkills!.assignments.some((entry) => entry.leader === target.id), false);
  assert.equal(player(spent, f.moritani).spice, player(f.pending, f.moritani).spice + target.strength);
  assert.deepEqual(player(spent, f.moritani).traitors, [f.traitorTarget]);
  const beforeMentat = finishMoritaniIndependentSkillsBattle(spent, { winnerDiscard: 'played' },
    (game) => game.phase === 7 && moritaniIndependentSkillsClean(game));
  assert.equal(beforeMentat.moritaniAssassinate!.opportunities[0].stage, 'revealed');
  const settled = finishMoritaniIndependentSkillsBattle(beforeMentat);
  const receipt = settled.moritaniAssassinate!.opportunities[0];
  assert.equal(receipt.stage, 'replaced');
  assert.equal(receipt.bounty, target.strength);
  assert.ok(receipt.replacement && receipt.replacement !== f.traitorTarget);
  assert.deepEqual(player(settled, f.moritani).traitors, [receipt.replacement]);
  assert.equal(settled.traitorReserve!.length, f.pending.traitorReserve!.length - 1);
  assert.equal(settled.leaderSkills!.deck.filter((skill) => skill === assignment.skill).length, 1);
  assert.deepEqual(pool(settled, f.moritani), pool(f.pending, f.moritani));
  assertMoritaniIndependentSkillsCustody(settled);
});

void test('paired native Worlds keep Ecaz Loyalty and the shared Duke outside an unused trained-target assassination', () => {
  const f = createMoritaniIndependentSkillsFixture({ paired: true, homeworlds: true,
    rules: 'advanced', skills: true, cards: true, tech: true, strongholds: true });
  const loyalty = f.afterSetup.ecazLoyalty!;
  assert.notEqual(f.traitorTarget, loyalty.card);
  assert.notEqual(f.traitorTarget, f.winnerLeader);
  assert.notEqual(f.traitorTarget, 'duke-vidal');
  assert.equal(f.pending.leaderSkills!.assignments.some((entry) => entry.leader === 'duke-vidal'), false);
  assert.deepEqual(pool(f.shipment!.after, f.opponent),
    { normal: pool(f.shipment!.before, f.opponent).normal - 1, elite: 0 });
  assert.equal(player(f.shipment!.after, f.opponent).spice,
    player(f.shipment!.before, f.opponent).spice - 2);
  assert.equal(player(f.afterEntry, f.opponent).forces[f.second], 7);
  assert.deepEqual(player(f.pending, f.opponent).forces, { [f.second]: 3 });
  assert.equal(player(f.pending, f.opponent).spice, player(f.game, f.opponent).spice - 4,
    'support uses the real prebattle wallet after original optional phase income');
  const assignment = f.pending.leaderSkills!.assignments.find((entry) => entry.leader === f.traitorTarget)!;
  const spent = chooseMoritaniIndependentSkillsAssassination(f.pending, f.traitorTarget);
  assert.equal(owned(f, spent, f.traitorTarget).usedAt, undefined);
  assert.equal(owned(f, spent, f.traitorTarget).dead, true);
  assert.equal(owned(f, spent, f.winnerLeader).dead, false);
  assert.equal(spent.moritaniAssassinate!.opportunities[0].bounty, 4);
  assert.equal(player(spent, f.moritani).spice, player(f.pending, f.moritani).spice + 4);
  assert.deepEqual(spent.leaderSkills!.deck, [...f.pending.leaderSkills!.deck, assignment.skill]);
  const settled = finishMoritaniIndependentSkillsBattle(spent, { winnerDiscard: 'played' });
  const receipt = settled.moritaniAssassinate!.opportunities[0];
  assert.equal(receipt.stage, 'replaced');
  assert.notEqual(receipt.replacement, loyalty.card);
  assert.equal(settled.traitorReserve!.length, f.pending.traitorReserve!.length - 1);
  assert.equal(settled.leaderSkills!.deck.filter((skill) => skill === assignment.skill).length, 1);
  assert.deepEqual(settled.ecazLoyalty, loyalty);
  assert.deepEqual(settled.dukeVidal, f.afterSetup.dukeVidal);
  assertMoritaniIndependentSkillsCustody(settled);
});

void test('Basic native Worlds return the typed Harass survivors but cannot assassinate the unused trained Ecaz target', () => {
  const f = createMoritaniIndependentSkillsFixture({ paired: true, homeworlds: true,
    rules: 'basic', skills: true, cards: true });
  assert.equal(f.pending.lastBattleContext!.winner, f.opponent);
  assert.equal(f.pending.lastBattleContext!.result, 'normal');
  assert.deepEqual(f.returns, { [f.first]: { normal: 4, elite: 0 } });
  assert.deepEqual(pool(f.pending, f.moritani),
    { normal: pool(f.revealed, f.moritani).normal - 3 + 4, elite: 0 });
  assert.equal(player(f.pending, f.moritani).tanks, 5);
  assert.deepEqual(player(f.pending, f.moritani).forces, {});
  assert.deepEqual(player(f.pending, f.opponent).forces, { [f.second]: 3 });
  assert.equal(f.pending.moritaniAssassinate, undefined);
  reject(f.pending, f.moritani, { type: 'decision', card: f.traitorTarget });
  const settled = finishMoritaniIndependentSkillsBattle(f.pending);
  assert.equal(owned(f, settled, f.traitorTarget).dead, false);
  assert.equal(owned(f, settled, f.traitorTarget).usedAt, undefined);
  assert.deepEqual(settled.leaderSkills, f.pending.leaderSkills);
  assert.deepEqual(player(settled, f.moritani).traitors, [f.traitorTarget]);
  assert.deepEqual(pool(settled, f.moritani), pool(f.pending, f.moritani));
  assertMoritaniIndependentSkillsCustody(settled);
});
