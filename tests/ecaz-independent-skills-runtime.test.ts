import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, type Game } from '../game/engine';
import { treacheryDeck } from '../game/cards';
import { ecazTreacheryCards } from '../game/ecaz-cards';
import { HARASS_WITHDRAW_CARD } from '../game/harass-withdraw';
import { REINFORCEMENTS_CARD } from '../game/reinforcements';
import { ownedTech } from '../game/tech-tokens';
import { homeworldContext } from '../game/homeworld-game';
import { homeworldForceGroups } from '../game/homeworld-custody';
import { DUKE_VIDAL_ID } from '../game/duke-vidal';
import {
  assertEcazIndependentSkillsCustody,
  createEcazIndependentSkillsFixture, ecazIndependentSkillsPlayer as player,
  quoteEcazIndependentSkillsBattle, settleEcazIndependentSkillsBattle,
  type EcazIndependentSkillsFixture,
} from './fixture-ecaz-independent-skills';

const at = (game: Game, id: string, key: string) => player(game, id).forces[key] ?? 0;
const change = (before: number, after: number) => after - before;
const cards = (game: Game) => [...game.deck, ...game.discard, ...(game.ixSetupCards ?? []),
  ...(game.auction?.cards.slice(game.auction.index) ?? []), ...game.players.flatMap(seat => seat.hand)];
/** The admitted physical source is the selected original families exactly once. */
function physicalSource(game: Game, count: number): void {
  const source = cards(game);
  assert.equal(source.length, count);
  assert.deepEqual(source.map(card => card.id).sort(), [...treacheryDeck(game.expansions),
    ...(game.ecazTreachery ? ecazTreacheryCards() : [])].map(card => card.id).sort());
}

/** Both native starting armies stay physical outside the genuinely shipped battle. */
function pairedArmies(f: EcazIndependentSkillsFixture, end: Game): void {
  for (const game of [f.afterSetup, f.game, end]) {
    assert.equal(at(game, f.ecaz, 'imperial_basin:9'), 6);
    assert.equal(at(game, f.ally, 'polar_sink:0'), 6);
  }
  assert.equal(at(f.game, f.ally, f.location), 4);
  assert.equal(player(f.game, f.ally).reserves, player(f.afterSetup, f.ally).reserves - 4,
    'Moritani ships four of its own reserves, not its original six or Imperial elites');
}

function disposedLeadCards(f: EcazIndependentSkillsFixture, end: Game): void {
  assert.equal(end.lastBattleContext?.winnerDiscards?.completed, true);
  assert.deepEqual(end.lastBattleContext?.winnerDiscards?.cards.slice().sort(), f.cardIds.slice().sort());
  for (const id of f.cardIds) {
    assert.equal(player(end, f.cardUser).hand.some(card => card.id === id), false);
    assert.equal(end.discard.filter(card => card.id === id).length, 1);
  }
}

for (const advanced of [false, true]) {
  void test(`original independent cards with all14 ${advanced ? 'Advanced' : 'Basic Tech'} reach the printed lead choice, and the trained Ecaz Suk rescues only its own committed losses`, () => {
    const f = createEcazIndependentSkillsFixture({ advanced, lead: 'ecaz', tech: !advanced });
    physicalSource(f.initial, 36);
    physicalSource(f.game, 36);
    assert.equal(f.beforeLead.decision?.kind, 'ecazBattleLead');
    assert.deepEqual(f.beforeLead.decision?.kind === 'ecazBattleLead' ? f.beforeLead.decision.choices
      : [], [f.ecaz, f.ally]);
    assert.equal(player(f.beforeLead, f.ecaz).ally, f.ally);
    assert.equal(player(f.beforeLead, f.ally).ally, f.ecaz);
    assert.equal(f.trainer, 'ecaz-0');
    assert.equal(f.game.leaderSkills!.assignments.find(a => a.owner === f.ecaz)!.skill, 'suk-graduate');
    assert.equal(f.game.phase, 6);
    // Both printed cards occupy either slot but stay in the lead's own plan.
    const plan = f.plans[0].action;
    assert.ok(plan.type === 'battlePlan');
    assert.equal(plan.weapon, REINFORCEMENTS_CARD);
    assert.equal(plan.defense, HARASS_WITHDRAW_CARD);
    assert.equal(f.fixedEcazDial, 2, 'ceil(E/2) of Ecaz’s four committed counters is free');
    assert.equal(f.planDial, f.fixedEcazDial + 2, 'the plan dial adds the ally’s two variable counters');
    const quote = quoteEcazIndependentSkillsBattle(f);
    assert.deepEqual(quote.reinforcements,
      [{ player: f.ecaz, card: REINFORCEMENTS_CARD, normal: 3, elite: 0 }]);
    assert.deepEqual(quote.harassWithdraw![0].returned, { normal: 2, elite: 0 });
    assert.equal(quote.harassWithdraw![0].remaining.normal, 2);
    assert.equal(quote.harassWithdraw![0].remaining.elite, 0);
    assert.equal(quote.harassWithdraw![0].remaining.freeSupport, true,
      'the mandatory fixed Ecaz counters are fully supported by the coalition plan');
    assert.deepEqual(quote.harassWithdraw![0].locations, { [f.location]: { normal: 2, elite: 0 } });
    assert.deepEqual(quote.fixedLosses, [{ owner: f.ecaz, normal: 2, elite: 0 }]);
    assert.equal(quote.casualties?.owner, f.ally);
    assert.deepEqual(quote.sukGraduate, { leader: 'ecaz-0', mode: 'skilled' });
    assert.ok(quote.scores);
    assert.equal(quote.scores[quote.winner === f.game.battle!.attacker ? 'attacker' : 'defender'],
      player(f.game, f.ecaz).leaders.find(leader => leader.id === 'ecaz-0')!.strength +
      f.planDial + 2, 'the card’s +2 stays a separate score modifier');
    // The real rescue offer is the skilled band of Ecaz's own committed losses.
    const rescue = settleEcazIndependentSkillsBattle(f, { stop: 'rescue' });
    assert.equal(rescue.decision?.kind, 'sukRescue');
    if (rescue.decision?.kind !== 'sukRescue') throw Error('Expected the original Suk rescue window');
    assert.equal(rescue.decision.mode, 'skilled');
    assert.equal(rescue.decision.player, f.ecaz);
    assert.deepEqual(rescue.decision.options.filter(option => option.kept),
      [{ normal: 1, elite: 0, kept: { key: f.location, kind: 'normal' } },
        { normal: 2, elite: 0, kept: { key: f.location, kind: 'normal' } }]);
    const end = settleEcazIndependentSkillsBattle(f, { state: rescue });
    assert.equal(end.phase, 7, 'the original battle continues to native Spice Collection');
    assert.equal(end.lastBattleContext?.winner, f.ecaz);
    assert.equal(end.lastBattleContext?.result, 'normal');
    assert.equal(end.lastBattleContext?.sukRescue?.completed, true);
    assert.equal(end.pendingSukRescue, null);
    // Ecaz: three fee counters in the Tanks, two returned undialed, one rescued
    // counter kept in the sector and one back in reserves.
    assert.equal(change(player(f.game, f.ecaz).reserves, player(end, f.ecaz).reserves), 0);
    assert.equal(change(player(f.game, f.ecaz).tanks, player(end, f.ecaz).tanks), 3);
    assert.equal(at(f.game, f.ecaz, f.location), 4);
    assert.equal(at(end, f.ecaz, f.location), 1);
    assert.equal(at(end, f.ecaz, 'imperial_basin:9'), at(f.game, f.ecaz, 'imperial_basin:9'));
    // The ally's own variable army is lossy and never rescued by Ecaz's skill.
    assert.equal(change(player(f.game, f.ally).reserves, player(end, f.ally).reserves), 0);
    assert.equal(change(player(f.game, f.ally).tanks, player(end, f.ally).tanks), 2);
    assert.equal(at(end, f.ally, f.location), 2);
    // The defeated defender loses its whole army and never touches the fee.
    assert.equal(change(player(f.game, f.opponent).tanks, player(end, f.opponent).tanks), 2);
    assert.equal(at(end, f.opponent, f.location), 0);
    assert.equal(change(player(f.game, f.opponent).reserves, player(end, f.opponent).reserves), 0);
    if (!advanced) {
      const tokens = ownedTech(f.game.techTokens, f.opponent);
      assert.equal(tokens.length, 1, 'the actual defeated Guild carries one original token');
      assert.equal(end.techTokens![tokens[0]].owner, f.ecaz,
        'original winner Tech cleanup credits the selected Ecaz plan, after its own card fee and rescue');
      disposedLeadCards(f, end);
    }
    assertEcazIndependentSkillsCustody(end);
  });
}

for (const card of ['reinforcements', 'harass'] as const) {
  void test(`${card === 'reinforcements' ? 'Reinforcements alone pays three own reserves before the rescue' : 'Harass & Withdraw alone returns only the card user’s undialed counters'}, never the fixed Ecaz contribution`, () => {
    const f = createEcazIndependentSkillsFixture({ cards: [card] });
    physicalSource(f.game, 36);
    const quote = quoteEcazIndependentSkillsBattle(f);
    if (card === 'reinforcements') {
      assert.deepEqual(quote.reinforcements,
        [{ player: f.ecaz, card: REINFORCEMENTS_CARD, normal: 3, elite: 0 }]);
      assert.equal(quote.harassWithdraw, undefined);
    } else {
      assert.equal(quote.reinforcements, undefined);
      assert.deepEqual(quote.harassWithdraw![0].returned, { normal: 2, elite: 0 });
      assert.equal(quote.harassWithdraw![0].remaining.freeSupport, true);
    }
    const end = settleEcazIndependentSkillsBattle(f);
    assert.equal(end.phase, 7);
    assert.equal(end.lastBattleContext?.winner, f.ecaz);
    assert.equal(change(player(f.game, f.ecaz).tanks, player(end, f.ecaz).tanks),
      card === 'reinforcements' ? 3 : 0, 'only the Reinforcements fee reaches the Tanks');
    assert.equal(change(player(f.game, f.ecaz).reserves, player(end, f.ecaz).reserves),
      card === 'reinforcements' ? -2 : 3);
    assert.equal(at(end, f.ecaz, f.location), card === 'reinforcements' ? 3 : 1);
    assert.equal(change(player(f.game, f.ally).tanks, player(end, f.ally).tanks), 2);
    assert.equal(at(end, f.ally, f.location), 2);
    assertEcazIndependentSkillsCustody(end);
  });
}

void test('an ally-led coalition spends the ally’s own fee and army and never rescues Ecaz’s fixed commitment', () => {
  const f = createEcazIndependentSkillsFixture({ lead: 'ally' });
  physicalSource(f.game, 36);
  assert.equal(f.plans[0].actor, f.ally);
  const quote = quoteEcazIndependentSkillsBattle(f);
  assert.deepEqual(quote.reinforcements,
    [{ player: f.ally, card: REINFORCEMENTS_CARD, normal: 3, elite: 0 }],
    'the card user pays the printed reserve cost, not the coalition partner');
  assert.deepEqual(quote.harassWithdraw![0].returned, { normal: 0, elite: 2 });
  assert.deepEqual(quote.harassWithdraw![0].locations, { [f.location]: { normal: 0, elite: 2 } });
  assert.deepEqual(quote.fixedLosses, [{ owner: f.ecaz, normal: 2, elite: 0 }]);
  assert.equal(quote.sukGraduate, undefined, 'the trained Ecaz disc is not the winning plan’s leader');
  const end = settleEcazIndependentSkillsBattle(f);
  assert.equal(end.phase, 7);
  assert.equal(end.lastBattleContext?.winner, f.ally);
  assert.equal(end.lastBattleContext?.sukRescue, undefined);
  assert.equal(f.trainer, 'ecaz-0');
  assert.equal(player(end, f.ecaz).leaders.find(leader => leader.id === f.trainer)!.dead, false);
  // Ecaz's fixed commitment dies unrescued while its own card custody is untouched.
  assert.equal(change(player(f.game, f.ecaz).reserves, player(end, f.ecaz).reserves), 0);
  assert.equal(change(player(f.game, f.ecaz).tanks, player(end, f.ecaz).tanks), 2);
  assert.equal(at(f.game, f.ecaz, f.location), 4);
  assert.equal(at(end, f.ecaz, f.location), 2);
  // The ally pays three reserve fee counters plus its own two commitment losses.
  assert.equal(change(player(f.game, f.ally).reserves, player(end, f.ally).reserves), -1);
  assert.equal(change(player(f.game, f.ally).tanks, player(end, f.ally).tanks), 5);
  assert.equal(at(end, f.ally, f.location), 0);
  assert.equal(change(player(f.game, f.opponent).tanks, player(end, f.opponent).tanks), 2);
  assertEcazIndependentSkillsCustody(end);
});

void test('a revealed skill keeps the skilled leader out of the plan and rescues exactly one committed counter with no kept counter', () => {
  const f = createEcazIndependentSkillsFixture({ hide: false });
  physicalSource(f.game, 36);
  const plan = f.plans[0];
  assert.ok(plan.action.type === 'battlePlan' && plan.action.leader !== f.trainer,
    'the face-up skilled leader cannot be in the battle plan');
  const quote = quoteEcazIndependentSkillsBattle(f);
  assert.deepEqual(quote.sukGraduate, { leader: 'ecaz-0', mode: 'normal' });
  const end = settleEcazIndependentSkillsBattle(f);
  assert.equal(end.phase, 7);
  assert.equal(end.pendingSukRescue, null, 'the single normal-band option settles automatically');
  assert.equal(end.lastBattleContext?.sukRescue?.completed, true);
  // Three fee counters plus the one unrescued committed counter reach the Tanks;
  // the normal band never keeps a counter in the battle sector.
  assert.equal(change(player(f.game, f.ecaz).tanks, player(end, f.ecaz).tanks), 4);
  assert.equal(change(player(f.game, f.ecaz).reserves, player(end, f.ecaz).reserves), 0);
  assert.equal(at(end, f.ecaz, f.location), 0);
  assert.equal(change(player(f.game, f.ally).tanks, player(end, f.ally).tanks), 2);
  assertEcazIndependentSkillsCustody(end);
});

void test('an opposing successful Traitor cancels Harass but preserves the card-user reserve fee', () => {
  const f = createEcazIndependentSkillsFixture({ traitor: true, advanced: true });
  assert.equal(f.traitor, f.trainer);
  assert.ok(player(f.game, f.opponent).traitors.includes(f.traitor!));
  const end = settleEcazIndependentSkillsBattle(f);
  assert.equal(end.phase, 7);
  assert.equal(end.lastBattleContext?.result, 'traitor');
  assert.equal(end.lastBattleContext?.winner, f.opponent);
  assert.equal(end.lastBattleContext?.sukRescue, undefined);
  assert.equal(change(player(f.game, f.ecaz).reserves, player(end, f.ecaz).reserves), -3);
  assert.equal(change(player(f.game, f.ecaz).tanks, player(end, f.ecaz).tanks), 7);
  assert.equal(at(end, f.ecaz, f.location), 0);
  assert.equal(change(player(f.game, f.ally).tanks, player(end, f.ally).tanks), 4);
  assert.equal(at(end, f.ally, f.location), 0);
  assert.equal(at(end, f.opponent, f.location), 2);
  assertEcazIndependentSkillsCustody(end);
});

for (const advanced of [false, true]) {
  void test(`the printed ${advanced ? 'Advanced' : 'Basic'} Occupy needs no Skills: the no-Skills independent control settles the same real coalition with both cards`, () => {
    const f = createEcazIndependentSkillsFixture({ advanced, skills: false });
    assert.equal(f.trainer, null);
    assert.equal(f.game.leaderSkills, undefined);
    physicalSource(f.game, 36);
    assert.equal(f.beforeLead.decision?.kind, 'ecazBattleLead');
    const quote = quoteEcazIndependentSkillsBattle(f);
    assert.deepEqual(quote.reinforcements,
      [{ player: f.ecaz, card: REINFORCEMENTS_CARD, normal: 3, elite: 0 }]);
    assert.deepEqual(quote.harassWithdraw![0].returned, { normal: 2, elite: 0 });
    assert.equal(quote.sukGraduate, undefined);
    const end = settleEcazIndependentSkillsBattle(f);
    assert.equal(end.phase, 7);
    assert.equal(end.lastBattleContext?.winner, f.ecaz);
    assert.equal(end.lastBattleContext?.sukRescue, undefined);
    // Fee first, then the return, then the mandatory commitment losses.
    assert.equal(change(player(f.game, f.ecaz).tanks, player(end, f.ecaz).tanks), 5);
    assert.equal(change(player(f.game, f.ecaz).reserves, player(end, f.ecaz).reserves), -1);
    assert.equal(at(end, f.ecaz, f.location), 0);
    assert.equal(change(player(f.game, f.ally).tanks, player(end, f.ally).tanks), 2);
    assert.equal(at(end, f.ally, f.location), 2);
    assert.equal(change(player(f.game, f.opponent).tanks, player(end, f.opponent).tanks), 2);
    assertEcazIndependentSkillsCustody(end);
  });
}

for (const advanced of [false, true]) {
  void test(`the real no-card, no-Skills ${advanced ? 'Advanced' : 'Basic'} coalition still exposes its lead choice and settles to Collection`, () => {
    const f = createEcazIndependentSkillsFixture({ advanced, skills: false, independent: false, cards: [] });
    assert.equal(f.initial.ecazTreachery, undefined);
    assert.equal(f.game.leaderSkills, undefined);
    assert.deepEqual(f.cardIds, []);
    physicalSource(f.initial, 33);
    physicalSource(f.game, 33);
    assert.equal(f.beforeLead.decision?.kind, 'ecazBattleLead');
    const end = settleEcazIndependentSkillsBattle(f);
    assert.equal(end.phase, 7);
    assert.equal(end.lastBattleContext?.winner, f.ecaz);
    assert.equal(end.lastBattleContext?.result, 'normal');
    assert.equal(change(player(f.game, f.ecaz).tanks, player(end, f.ecaz).tanks), 2);
    assert.equal(change(player(f.game, f.ecaz).reserves, player(end, f.ecaz).reserves), 0);
    assert.equal(at(end, f.ecaz, f.location), 2);
    assert.equal(change(player(f.game, f.ally).tanks, player(end, f.ally).tanks), 2);
    assert.equal(at(end, f.ally, f.location), 2);
    assert.equal(change(player(f.game, f.opponent).tanks, player(end, f.opponent).tanks), 2);
    assert.equal(at(end, f.opponent, f.location), 0);
    assertEcazIndependentSkillsCustody(end);
  });
}


for (const advanced of [false, true]) {
  void test(`native paired no-card all14 ${advanced ? 'Advanced Moritani lead keeps Ecaz losses separate' : 'Basic Ecaz lead rescues its fixed commitment'} through coalition cleanup`, () => {
    const f = createEcazIndependentSkillsFixture({
      paired: true, advanced, independent: false, cards: [], lead: advanced ? 'ally' : 'ecaz',
    });
    physicalSource(f.initial, 33);
    physicalSource(f.game, 33);
    const quote = quoteEcazIndependentSkillsBattle(f);
    assert.deepEqual(quote.fixedLosses, [{ owner: f.ecaz, normal: 2, elite: 0 }]);
    assert.equal(quote.casualties?.owner, f.ally);
    assert.equal(quote.reinforcements, undefined);
    assert.equal(quote.harassWithdraw, undefined);
    const end = settleEcazIndependentSkillsBattle(f);
    assert.equal(end.phase, 7);
    assert.equal(end.lastBattleContext?.winner, f.cardUser);
    assert.equal(end.lastBattleContext?.result, 'normal');
    assert.equal(end.lastBattleContext?.sukRescue?.completed, advanced ? undefined : true);
    assert.equal(change(player(f.game, f.ecaz).tanks, player(end, f.ecaz).tanks), advanced ? 2 : 0);
    assert.equal(change(player(f.game, f.ecaz).reserves, player(end, f.ecaz).reserves), advanced ? 0 : 1);
    assert.equal(at(end, f.ecaz, f.location), advanced ? 2 : 3);
    assert.equal(change(player(f.game, f.ally).tanks, player(end, f.ally).tanks), 2);
    assert.equal(change(player(f.game, f.ally).reserves, player(end, f.ally).reserves), 0);
    assert.equal(at(end, f.ally, f.location), 2);
    assert.equal(change(player(f.game, f.opponent).tanks, player(end, f.opponent).tanks), 2);
    assert.equal(at(end, f.opponent, f.location), 0);
    pairedArmies(f, end);
    assertEcazIndependentSkillsCustody(end);
  });
}

void test('native paired Ecaz lead pays its own fee, returns its undialed fixed army and rescues only its committed losses', () => {
  const f = createEcazIndependentSkillsFixture({ paired: true });
  physicalSource(f.initial, 36);
  const quote = quoteEcazIndependentSkillsBattle(f);
  assert.deepEqual(quote.reinforcements,
    [{ player: f.ecaz, card: REINFORCEMENTS_CARD, normal: 3, elite: 0 }]);
  assert.deepEqual(quote.harassWithdraw![0].returned, { normal: 2, elite: 0 });
  assert.deepEqual(quote.harassWithdraw![0].locations, { [f.location]: { normal: 2, elite: 0 } });
  assert.equal(quote.casualties?.owner, f.ally);
  const rescue = settleEcazIndependentSkillsBattle(f, { stop: 'rescue' });
  assert.ok(rescue.decision?.kind === 'sukRescue');
  assert.equal(rescue.decision.player, f.ecaz);
  assert.equal(rescue.decision.mode, 'skilled');
  assert.deepEqual(rescue.decision.options.filter(option => option.kept),
    [{ normal: 1, elite: 0, kept: { key: f.location, kind: 'normal' } },
      { normal: 2, elite: 0, kept: { key: f.location, kind: 'normal' } }]);
  // Fee is already in Ecaz's Tanks; its undialed pair is already home. Neither
  // the fee nor Moritani's two casualties enter this actual rescue offer.
  assert.equal(change(player(f.game, f.ecaz).tanks, player(rescue, f.ecaz).tanks), 3);
  assert.equal(change(player(f.game, f.ecaz).reserves, player(rescue, f.ecaz).reserves), -1);
  assert.equal(at(rescue, f.ecaz, f.location), 2, 'only the committed pair awaits the rescue choice');
  assert.equal(change(player(f.game, f.ally).tanks, player(rescue, f.ally).tanks), 2);
  const end = settleEcazIndependentSkillsBattle(f, { state: rescue });
  assert.equal(end.phase, 7);
  assert.equal(end.lastBattleContext?.winner, f.ecaz);
  assert.equal(end.lastBattleContext?.sukRescue?.completed, true);
  assert.equal(change(player(f.game, f.ecaz).tanks, player(end, f.ecaz).tanks), 3);
  assert.equal(change(player(f.game, f.ecaz).reserves, player(end, f.ecaz).reserves), 0);
  assert.equal(at(end, f.ecaz, f.location), 1);
  assert.equal(change(player(f.game, f.ally).tanks, player(end, f.ally).tanks), 2);
  assert.equal(change(player(f.game, f.ally).reserves, player(end, f.ally).reserves), 0);
  assert.equal(at(end, f.ally, f.location), 2);
  assert.equal(change(player(f.game, f.opponent).tanks, player(end, f.opponent).tanks), 2);
  disposedLeadCards(f, end);
  pairedArmies(f, end);
  physicalSource(end, 36);
  assertEcazIndependentSkillsCustody(end);
});

void test('native paired Basic Tech Moritani lead pays and withdraws its normal variable army without merging Ecaz fixed losses', () => {
  const f = createEcazIndependentSkillsFixture({ paired: true, advanced: false, lead: 'ally', tech: true });
  const quote = quoteEcazIndependentSkillsBattle(f);
  assert.deepEqual(quote.reinforcements,
    [{ player: f.ally, card: REINFORCEMENTS_CARD, normal: 3, elite: 0 }]);
  assert.deepEqual(quote.harassWithdraw![0].returned, { normal: 2, elite: 0 });
  assert.deepEqual(quote.harassWithdraw![0].locations, { [f.location]: { normal: 2, elite: 0 } });
  assert.deepEqual(quote.fixedLosses, [{ owner: f.ecaz, normal: 2, elite: 0 }]);
  assert.equal(quote.sukGraduate, undefined);
  const end = settleEcazIndependentSkillsBattle(f);
  assert.equal(end.phase, 7);
  assert.equal(end.lastBattleContext?.winner, f.ally);
  assert.equal(end.lastBattleContext?.sukRescue, undefined);
  assert.equal(change(player(f.game, f.ally).reserves, player(end, f.ally).reserves), -1);
  assert.equal(change(player(f.game, f.ally).tanks, player(end, f.ally).tanks), 5);
  assert.equal(at(end, f.ally, f.location), 0);
  assert.equal(change(player(f.game, f.ecaz).reserves, player(end, f.ecaz).reserves), 0);
  assert.equal(change(player(f.game, f.ecaz).tanks, player(end, f.ecaz).tanks), 2);
  assert.equal(at(end, f.ecaz, f.location), 2);
  assert.equal(player(end, f.ecaz).leaders.find(leader => leader.id === f.trainer)!.dead, false);
  assert.equal(change(player(f.game, f.opponent).tanks, player(end, f.opponent).tanks), 2);
  const tokens = ownedTech(f.game.techTokens, f.opponent);
  assert.equal(tokens.length, 1);
  assert.equal(end.techTokens![tokens[0]].owner, f.ally,
    'the selected Moritani winner, not its Ecaz coalition partner, inherits the defeated Guild token');
  disposedLeadCards(f, end);
  pairedArmies(f, end);
  physicalSource(end, 36);
  assertEcazIndependentSkillsCustody(end);
});

for (const lead of ['ecaz', 'ally'] as const) {
  void test(`earned Arrakeen supports only its Ecaz holder's selected plan: paired ${lead === 'ecaz' ? 'holder' : 'Moritani'} lead keeps card fees, losses and Tech separate`, () => {
    const f = createEcazIndependentSkillsFixture({ paired: true, tech: true, strongholds: true, lead });
    const claim = f.afterFirstMentat!;
    assert.equal(claim.strongholdCards!.claimedTurn, 1);
    assert.equal(claim.strongholdCards!.owners.arrakeen, f.ecaz);
    assert.equal(at(claim, f.ecaz, f.location), 4);
    assert.equal(f.actions.filter(step => step.actor === f.ecaz && step.action.type === 'ship').length, 1,
      'the same four paid turn-one counters remain through the claim and real worm alliance');
    const quote = quoteEcazIndependentSkillsBattle(f);
    const payment = quote.payments.find(payment => payment.player === f.cardUser)!;
    assert.equal(payment.bankSupport, lead === 'ecaz' ? 2 : 0);
    assert.equal(payment.ownPayment, lead === 'ecaz' ? 0 : 2,
      'Moritani does not inherit the Ecaz-held card when Ecaz selects its ally to lead');
    assert.deepEqual(quote.reinforcements,
      [{ player: f.cardUser, card: REINFORCEMENTS_CARD, normal: 3, elite: 0 }]);
    assert.deepEqual(quote.harassWithdraw![0].returned, { normal: 2, elite: 0 });
    assert.deepEqual(quote.fixedLosses, [{ owner: f.ecaz, normal: 2, elite: 0 }]);
    assert.equal(quote.casualties?.owner, f.ally);
    const paid = settleEcazIndependentSkillsBattle(f, { stop: 'rescue' });
    assert.equal(player(paid, f.cardUser).spice, player(f.game, f.cardUser).spice - payment.ownPayment,
      'support settles before the Ecaz rescue and the separate Collection income');
    const end = settleEcazIndependentSkillsBattle(f, { state: paid });
    assert.equal(end.phase, 7);
    assert.equal(end.lastBattleContext?.winner, f.cardUser);
    assert.equal(change(player(f.game, f.ecaz).tanks, player(end, f.ecaz).tanks), lead === 'ecaz' ? 3 : 2);
    assert.equal(change(player(f.game, f.ally).tanks, player(end, f.ally).tanks), lead === 'ecaz' ? 2 : 5);
    assert.equal(end.lastBattleContext?.sukRescue?.completed, lead === 'ecaz' ? true : undefined);
    const lostTokens = ownedTech(f.game.techTokens, f.opponent);
    assert.equal(lostTokens.length, 1);
    assert.equal(end.techTokens![lostTokens[0]].owner, f.cardUser);
    disposedLeadCards(f, end);
    pairedArmies(f, end);
    physicalSource(end, 36);
    assert.deepEqual(end.ecazLoyalty, f.afterSetup.ecazLoyalty);
    assertEcazIndependentSkillsCustody(end);
  });
}

void test('native World coalition pays Ecaz’s source-labelled fee before committed-only Suk rescue and settles earned Arrakeen and Tech', () => {
  const f = createEcazIndependentSkillsFixture({
    homeworlds: true, paired: true, tech: true, strongholds: true,
  });
  const native = (game: Game) => homeworldForceGroups(homeworldContext(game), game.homeworlds!.custody!)
    .find(home => home.native === f.ecaz)!.forces[f.ecaz];
  const plan = f.plans[0];
  assert.deepEqual(plan.action.reinforcementsSources,
    { 'homeworld:ecaz': { normal: 3, elite: 0 } });
  const before = structuredClone(f.beforePlans);
  assert.throws(() => applyAction(f.beforePlans, f.ecaz, {
    ...plan.action, reinforcementsSources: { 'homeworld:moritani': { normal: 3, elite: 0 } },
  }), 'A coalition partner’s native World cannot fund the Ecaz card user’s fee');
  assert.deepEqual(f.beforePlans, before);
  const shipment = f.actions.find(step => step.actor === f.ecaz && step.action.type === 'ship')!;
  assert.deepEqual(shipment.action.homeworldSources,
    { 'homeworld:ecaz': { normal: 4, elite: 0 } });
  assert.equal(native(f.afterFirstMentat!).normal, native(f.afterSetup).normal - 4,
    'The four real paid native counters hold Arrakeen through END Mentat');
  assert.equal(f.afterFirstMentat!.strongholdCards!.owners.arrakeen, f.ecaz);
  const quote = quoteEcazIndependentSkillsBattle(f);
  const payment = quote.payments.find(item => item.player === f.ecaz)!;
  assert.equal(payment.bankSupport, 2);
  assert.equal(payment.ownPayment, 0, 'The earned Arrakeen card actually supports the selected lead');
  assert.deepEqual(quote.harassWithdraw![0].returned, { normal: 2, elite: 0 });
  const rescue = settleEcazIndependentSkillsBattle(f, { stop: 'rescue' });
  assert.ok(rescue.decision?.kind === 'sukRescue');
  assert.equal(rescue.decision.player, f.ecaz);
  assert.deepEqual(rescue.decision.options.filter(option => option.kept),
    [{ normal: 1, elite: 0, kept: { key: f.location, kind: 'normal' } },
      { normal: 2, elite: 0, kept: { key: f.location, kind: 'normal' } }]);
  assert.equal(player(rescue, f.ecaz).tanks - player(f.game, f.ecaz).tanks, 3,
    'The source-labelled fee is already in Tanks and never joins the two committed rescue losses');
  assert.equal(native(rescue).normal, native(f.game).normal - 1,
    'Three native fee counters leave before the two undialed counters return to the same World');
  assert.equal(player(rescue, f.ally).tanks - player(f.game, f.ally).tanks, 2,
    'Moritani’s variable army losses cannot enter Ecaz’s rescue');
  assert.equal(player(rescue, f.ecaz).spice, player(f.game, f.ecaz).spice,
    'Held-card bank support settles before Collection, without charging Ecaz');
  const end = settleEcazIndependentSkillsBattle(f, { state: rescue });
  assert.equal(end.phase, 7);
  assert.equal(end.lastBattleContext?.winner, f.ecaz);
  assert.equal(end.lastBattleContext?.sukRescue?.completed, true);
  assert.deepEqual(end.lastBattleContext?.sukRescue?.physical, {
    player: f.ecaz, territory: f.territory, source: 'arrakis',
    saved: { normal: 2, elite: 0 }, kept: { key: f.location, kind: 'normal' },
    destinations: { 'homeworld:ecaz': { normal: 1, elite: 0 } }, tanks: { normal: 0, elite: 0 },
  });
  assert.equal(native(end).normal, native(f.game).normal);
  assert.equal(at(end, f.ecaz, f.location), 1);
  assert.equal(player(end, f.ecaz).tanks - player(f.game, f.ecaz).tanks, 3);
  const enemyTokens = ownedTech(f.game.techTokens, f.opponent);
  assert.equal(enemyTokens.length, 1);
  assert.equal(end.techTokens![enemyTokens[0]].owner, f.ecaz);
  disposedLeadCards(f, end);
  pairedArmies(f, end);
  physicalSource(end, 36);
  assertEcazIndependentSkillsCustody(end);
});

void test('paired plain World all14 keeps the native Moritani lead and separate Ecaz fixed army through battle continuation', () => {
  const f = createEcazIndependentSkillsFixture({
    homeworlds: true, paired: true, independent: false, cards: [], lead: 'ally',
  });
  assert.equal(f.beforeLead.decision?.kind, 'ecazBattleLead');
  assert.equal(f.plans[0].actor, f.ally);
  assert.equal(player(f.beforeLead, f.ecaz).ally, f.ally);
  const quote = quoteEcazIndependentSkillsBattle(f);
  assert.deepEqual(quote.fixedLosses, [{ owner: f.ecaz, normal: 2, elite: 0 }]);
  assert.equal(quote.casualties?.owner, f.ally);
  assert.equal(quote.sukGraduate, undefined,
    'Ecaz’s native skill cannot rescue its fixed army while Moritani leads');
  assert.ok(f.game.leaderSkills!.assignments.every(assignment => assignment.leader !== DUKE_VIDAL_ID));
  const end = settleEcazIndependentSkillsBattle(f);
  assert.equal(end.phase, 7);
  assert.equal(end.lastBattleContext?.winner, f.ally);
  assert.equal(end.lastBattleContext?.sukRescue, undefined);
  for (const actor of [f.ecaz, f.ally]) {
    assert.equal(player(end, actor).tanks - player(f.game, actor).tanks, 2);
    assert.equal(player(end, actor).reserves, player(f.game, actor).reserves);
    assert.equal(at(end, actor, f.location), 2);
  }
  pairedArmies(f, end);
  physicalSource(end, 33);
  assertEcazIndependentSkillsCustody(end);
});

void test('no-Skills World independent cards retain the native Emperor-led coalition and typed Sardaukar withdrawal', () => {
  const f = createEcazIndependentSkillsFixture({ homeworlds: true, skills: false, lead: 'ally' });
  assert.equal(f.beforeLead.decision?.kind, 'ecazBattleLead');
  assert.equal(f.plans[0].actor, f.ally);
  const sources = f.game.battle!.plans[f.cardUser].reinforcementsSources!;
  assert.ok(Object.keys(sources).every(world => world === 'homeworld:emperor' || world === 'homeworld:emperor:salusa'));
  assert.equal(Object.values(sources).reduce((sum, forces) => sum + forces.normal, 0), 3);
  const quote = quoteEcazIndependentSkillsBattle(f);
  assert.deepEqual(quote.harassWithdraw![0].returned, { normal: 0, elite: 2 });
  assert.deepEqual(quote.harassWithdraw![0].locations, { [f.location]: { normal: 0, elite: 2 } });
  assert.equal(quote.sukGraduate, undefined);
  const end = settleEcazIndependentSkillsBattle(f);
  assert.equal(end.phase, 7);
  assert.equal(end.lastBattleContext?.winner, f.ally);
  assert.equal(end.lastBattleContext?.sukRescue, undefined);
  assert.equal(player(end, f.ally).reserves - player(f.game, f.ally).reserves, -1);
  assert.equal(player(end, f.ally).tanks - player(f.game, f.ally).tanks, 5,
    'Three own native fee counters and two variable commitment losses remain distinct from Ecaz');
  assert.equal(player(end, f.ally).elites!.reserves - player(f.game, f.ally).elites!.reserves, 2);
  assert.equal(player(end, f.ally).elites!.tanks, player(f.game, f.ally).elites!.tanks);
  assert.equal(player(end, f.ecaz).tanks - player(f.game, f.ecaz).tanks, 2);
  assert.equal(at(end, f.ecaz, f.location), 2);
  disposedLeadCards(f, end);
  physicalSource(end, 36);
  assertEcazIndependentSkillsCustody(end);
});
