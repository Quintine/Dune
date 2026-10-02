import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { treacheryDeck } from '../game/cards';
import { ecazTreacheryCards } from '../game/ecaz-cards';
import { splitLocation } from '../game/board';
import {
  createEcazOccupySetup, ecazOccupyTerritoryForces, type EcazOccupyFixtureOptions,
} from './fixture-ecaz-occupy';
import {
  ecazOccupyCardsCase, finishOccupyCardsAftermath, occupyCardsPlayer as seat,
  type OccupyCardsCase,
} from './fixture-ecaz-occupy-cards';
import { harassWithdrawGame, takeHarassCard } from './fixture-harass-withdraw';

const forces = (result: OccupyCardsCase, id: string, game = result.game) =>
  ecazOccupyTerritoryForces(game, id, result.fixture.territory);
const reserveChange = (result: OccupyCardsCase, id: string) =>
  seat(result.game, id).reserves - seat(result.before, id).reserves;
const tankChange = (result: OccupyCardsCase, id: string) =>
  seat(result.game, id).tanks - seat(result.before, id).tanks;

function physicalSource(game: Game, count: number): void {
  const source = [...game.deck, ...game.discard, ...(game.ixSetupCards ?? []),
    ...game.players.flatMap(p => p.hand)];
  assert.equal(source.length, count);
  assert.deepEqual(source.map(c => c.id).sort(),
    [...treacheryDeck(game.expansions), ...(game.ecazTreachery ? ecazTreacheryCards() : [])]
      .map(c => c.id).sort(), 'The admitted original family retains its canonical physical faces, including pending Ix offers.');
}
function discardedOnce(result: OccupyCardsCase): void {
  assert.equal(result.game.discard.filter(card => card.id === result.card).length, 1);
  assert.ok(!seat(result.game, result.holder).hand.some(card => card.id === result.card));
}
function collection(state: Game): Game {
  let game = state;
  for (let attempt = 0; attempt < 40 && game.phase === 6; attempt++) {
    const player = game.players.find(p => !game.ready.includes(p.id));
    assert.ok(player, 'The actual Battle phase must offer its native continuation.');
    game = applyAction(game, player.id, { type: 'ready' });
  }
  assert.equal(game.phase, 7, 'The original battle continues to native Spice Collection.');
  return game;
}
function pendingIxSetup(state: Game): Game {
  let game = state;
  for (let attempt = 0; attempt < 100 && game.decision?.kind !== 'ixSetup'; attempt++) {
    assert.equal(game.status, 'setup', 'Stop at the original starting-card offer, never redeal.');
    let next: Game | undefined;
    for (const player of game.players) {
      const view = viewGame(game, player.id);
      view.players.find(p => p.id === player.id)!.bot = 'Easy';
      const action = botActions(view)[0];
      if (action) { next = applyAction(game, player.id, action); break; }
    }
    assert.ok(next, 'Original faction setup must expose an actual native choice.');
    game = next;
  }
  assert.equal(game.decision?.kind, 'ixSetup');
  assert.ok(game.ixSetupCards?.length, 'The physical starting cards are still in the pending offer.');
  return game;
}

const sources: { name: string; count: number; options: EcazOccupyFixtureOptions }[] = [
  { name: 'E3', count: 36, options: { allyFaction: 'guild', opponentFaction: 'emperor', expansions: ['ecaz'] } },
  { name: 'Ix', count: 50, options: { allyFaction: 'ixians', opponentFaction: 'emperor', expansions: ['ecaz', 'ix'] } },
  { name: 'CHOAM', count: 38, options: { allyFaction: 'choam', opponentFaction: 'emperor', expansions: ['ecaz', 'choam'] } },
  { name: 'Ix and CHOAM', count: 50, options: { allyFaction: 'ixians', opponentFaction: 'choam', expansions: ['ecaz', 'ix', 'choam'] } },
];
for (const source of sources) {
  void test(`Independent cards preserve the original ${source.name} physical source through native setup and battle`, () => {
    let initial = createEcazOccupySetup({ ...source.options, ecazTreachery: true });
    physicalSource(initial, source.count);
    if (source.options.allyFaction === 'ixians') initial = pendingIxSetup(initial);
    physicalSource(initial, source.count);
    const result = ecazOccupyCardsCase({ ...source.options, initial,
      card: 'ecaz-reinforcements', variableDial: 0, support: 0 });
    physicalSource(result.fixture.afterSetup, source.count);
    physicalSource(result.game, source.count);
    assert.equal(result.game.lastBattleContext?.winner, result.actor);
    discardedOnce(result);
    collection(result.game);
  });
}

for (const lead of ['ecaz', 'ally'] as const) for (const slot of ['weapon', 'defense'] as const) {
  void test(`Reinforcements in ${slot}, ${lead} lead: own three reserves buy the decisive +2, not ally support or arrivals`, () => {
    const result = ecazOccupyCardsCase({ lead, slot, card: 'ecaz-reinforcements',
      equalLeaders: true, opponentDial: 6 });
    const { fixture, actor, before, game } = result;
    assert.equal(game.lastBattleContext?.winner, actor,
      'Equal leaders: five physical dial strength beats six only with the card’s +2.');
    assert.equal(reserveChange(result, actor), -3);
    assert.equal(tankChange(result, fixture.ecaz), lead === 'ecaz' ? 6 : 3);
    assert.equal(tankChange(result, fixture.ally), lead === 'ally' ? 5 : 2);
    assert.equal(reserveChange(result, lead === 'ecaz' ? fixture.ally : fixture.ecaz), 0);
    assert.equal(forces(result, fixture.ecaz), 2);
    assert.equal(forces(result, fixture.ally), 2);
    assert.equal(seat(before, actor).spice - seat(game, actor).spice, 2,
      'Three free fixed Ecaz fighters and the score modifier incur no additional support.');
    discardedOnce(result);
    collection(game);
  });
  void test(`Harass in ${slot}, ${lead} lead: only actual owner undialed forces return, original fixed loss stays three`, () => {
    const result = ecazOccupyCardsCase({ lead, slot });
    const { fixture, actor, before, game } = result;
    assert.equal(game.lastBattleContext?.winner, actor);
    assert.equal(reserveChange(result, actor), 2);
    assert.equal(reserveChange(result, lead === 'ecaz' ? fixture.ally : fixture.ecaz), 0);
    assert.equal(tankChange(result, fixture.ecaz), 3);
    assert.equal(tankChange(result, fixture.ally), 2);
    assert.equal(forces(result, fixture.ecaz), lead === 'ecaz' ? 0 : 2);
    assert.equal(forces(result, fixture.ally), lead === 'ally' ? 0 : 2);
    assert.equal(seat(before, actor).spice - seat(game, actor).spice, 2,
      'Support remains the selected payer’s variable ally payment, never an Ecaz fixed-pool charge.');
    discardedOnce(result);
    collection(game);
  });
}

for (const lead of ['ecaz', 'ally'] as const) {
  for (const outcome of ['loss', 'soleTraitor', 'opposingTraitor', 'mutualTraitors', 'explosion'] as const) {
    void test(`Harass ${lead} lead, actual ${outcome}: returns precede losses except an opposing successful traitor`, () => {
      const result = ecazOccupyCardsCase({ lead, outcome, slot: 'defense' });
      const { fixture, actor, game } = result;
      const canceledReturn = outcome === 'opposingTraitor' || outcome === 'mutualTraitors';
      assert.equal(reserveChange(result, actor), canceledReturn ? 0 : 2);
      assert.equal(reserveChange(result, actor === fixture.ecaz ? fixture.ally : fixture.ecaz), 0);
      assert.equal(game.lastBattleContext?.result,
        outcome === 'loss' ? 'normal' : outcome === 'soleTraitor' || outcome === 'opposingTraitor' ? 'traitor' : outcome);
      if (outcome === 'soleTraitor') {
        assert.equal(game.lastBattleContext?.winner, actor);
        assert.equal(tankChange(result, fixture.ecaz), 0);
        assert.equal(tankChange(result, fixture.ally), 0);
        assert.equal(forces(result, fixture.ecaz), lead === 'ecaz' ? 3 : 5);
        assert.equal(forces(result, fixture.ally), lead === 'ally' ? 2 : 4);
      } else {
        assert.equal(game.lastBattleContext?.winner,
          outcome === 'loss' || outcome === 'opposingTraitor' ? fixture.opponent : null);
        assert.equal(forces(result, fixture.ecaz), 0);
        assert.equal(forces(result, fixture.ally), 0);
        assert.equal(tankChange(result, fixture.ecaz), !canceledReturn && lead === 'ecaz' ? 3 : 5);
        assert.equal(tankChange(result, fixture.ally), !canceledReturn && lead === 'ally' ? 2 : 4);
      }
      discardedOnce(result);
      collection(game);
    });
    void test(`Reinforcements ${lead} lead, actual ${outcome}: provisional own reserve cost and single disposal survive every reveal`, () => {
      const result = ecazOccupyCardsCase({ lead, outcome, card: 'ecaz-reinforcements', slot: 'defense' });
      const { fixture, actor, game } = result;
      assert.equal(reserveChange(result, actor), -3);
      assert.equal(reserveChange(result, actor === fixture.ecaz ? fixture.ally : fixture.ecaz), 0);
      const preserved = outcome === 'soleTraitor';
      assert.equal(tankChange(result, fixture.ecaz), (preserved ? 0 : 5) + (lead === 'ecaz' ? 3 : 0));
      assert.equal(tankChange(result, fixture.ally), (preserved ? 0 : 4) + (lead === 'ally' ? 3 : 0));
      assert.equal(forces(result, fixture.ecaz), preserved ? 5 : 0);
      assert.equal(forces(result, fixture.ally), preserved ? 4 : 0);
      assert.equal(game.lastBattleContext?.winner,
        preserved ? actor : outcome === 'loss' || outcome === 'opposingTraitor' ? fixture.opponent : null);
      discardedOnce(result);
      collection(game);
    });
  }
  void test(`Karama-canceled Occupy with ${lead} Harass uses only its ordinary native own pool`, () => {
    const result = ecazOccupyCardsCase({ lead, canceled: true });
    const { fixture, actor, game } = result;
    assert.equal(game.lastBattleContext?.winner, actor);
    assert.equal(reserveChange(result, actor), lead === 'ecaz' ? 3 : 2);
    assert.equal(tankChange(result, actor), 2);
    assert.equal(forces(result, actor), 0);
    assert.equal(forces(result, actor === fixture.ecaz ? fixture.ally : fixture.ecaz), lead === 'ecaz' ? 4 : 5);
    discardedOnce(result);
    collection(game);
  });
  for (const slot of ['weapon', 'defense'] as const) {
    void test(`Opposing physical Reinforcements in ${slot} defeats the ${lead} coalition by its own +2`, () => {
      const result = ecazOccupyCardsCase({ lead, slot, holder: 'opponent', card: 'ecaz-reinforcements',
        equalLeaders: true, opponentDial: 4 });
      assert.equal(result.game.lastBattleContext?.winner, result.fixture.opponent);
      assert.equal(reserveChange(result, result.holder), -3);
      assert.equal(tankChange(result, result.holder), 7);
      assert.equal(forces(result, result.holder), 4);
      assert.equal(reserveChange(result, result.actor), 0);
      discardedOnce(result);
      collection(result.game);
    });
    void test(`Opposing Harass in ${slot} withdraws only its six undialed forces against ${lead} Occupy`, () => {
      const result = ecazOccupyCardsCase({ lead, slot, holder: 'opponent', opponentDial: 2 });
      assert.equal(result.game.lastBattleContext?.winner, result.actor);
      assert.equal(reserveChange(result, result.holder), 6);
      assert.equal(tankChange(result, result.holder), 2);
      assert.equal(forces(result, result.fixture.ecaz), 2);
      assert.equal(forces(result, result.fixture.ally), 2);
      discardedOnce(result);
      collection(result.game);
    });
  }
}

void test('Ecaz Harass returns floor(E/2) even when no ally fighters are dialed or paid', () => {
  const result = ecazOccupyCardsCase({ variableDial: 0, support: 0 });
  assert.equal(reserveChange(result, result.fixture.ecaz), 2);
  assert.equal(tankChange(result, result.fixture.ecaz), 3);
  assert.equal(forces(result, result.fixture.ecaz), 0);
  assert.equal(forces(result, result.fixture.ally), 4);
  assert.equal(seat(result.game, result.actor).spice, seat(result.before, result.actor).spice);
  discardedOnce(result);
});

void test('Even Ecaz army keeps its original two mandatory losses after returning its two undialed forces', () => {
  const result = ecazOccupyCardsCase({ ecazForces: 4 });
  assert.equal(result.game.lastBattleContext?.winner, result.actor);
  assert.equal(reserveChange(result, result.fixture.ecaz), 2);
  assert.equal(tankChange(result, result.fixture.ecaz), 2);
  assert.equal(forces(result, result.fixture.ecaz), 0);
  assert.equal(forces(result, result.fixture.ally), 2);
  discardedOnce(result);
});

void test('Selected Ixian Harass returns a chosen typed undialed pool, never the fixed Ecaz fighters', () => {
  const result = ecazOccupyCardsCase({ lead: 'ally', allyFaction: 'ixians', allyForces: 8, allyElite: 2,
    variableDial: 3, support: 0, returnedForces: { normal: 2, elite: 1 },
    losses: { normal: 4, elite: 1 } });
  assert.equal(result.game.lastBattleContext?.winner, result.actor);
  assert.equal(reserveChange(result, result.fixture.ally), 3);
  assert.equal(seat(result.game, result.fixture.ally).elites!.reserves -
    seat(result.before, result.fixture.ally).elites!.reserves, 1);
  assert.equal(tankChange(result, result.fixture.ally), 5);
  assert.equal(seat(result.game, result.fixture.ally).elites!.tanks -
    seat(result.before, result.fixture.ally).elites!.tanks, 1);
  assert.equal(forces(result, result.fixture.ally), 0);
  assert.equal(forces(result, result.fixture.ecaz), 2);
  assert.equal(tankChange(result, result.fixture.ecaz), 3);
  discardedOnce(result);
  collection(result.game);
});

for (const lead of ['ecaz', 'ally'] as const) {
  void test(`Native Ix substitution and selected ${lead} cleanup follow physical Reinforcements`, () => {
    const result = ecazOccupyCardsCase({ lead, allyFaction: 'ixians', allyForces: 8, allyElite: 2,
      card: 'ecaz-reinforcements', variableDial: 4, support: 1,
      losses: { normal: 2, elite: 2 }, substitute: 2, cleanupShield: true });
    const { fixture, actor, before, game } = result;
    assert.equal(game.lastBattleContext?.winner, actor);
    assert.equal(reserveChange(result, actor), -3);
    assert.equal(forces(result, fixture.ecaz), 2);
    assert.equal(forces(result, fixture.ally), 4);
    assert.equal(seat(game, fixture.ally).elites!.forces[fixture.location], 2);
    assert.equal(tankChange(result, fixture.ally), 4 + (lead === 'ally' ? 3 : 0));
    assert.equal(seat(game, fixture.ally).elites!.tanks, seat(before, fixture.ally).elites!.tanks);
    assert.equal(seat(before, actor).spice - seat(game, actor).spice, 1);
    assert.ok(game.discard.some(card => card.id === result.shield));
    const nonLead = actor === fixture.ecaz ? fixture.ally : fixture.ecaz;
    for (const card of seat(before, nonLead).hand)
      assert.ok(seat(game, nonLead).hand.some(held => held.id === card.id));
    discardedOnce(result);
    collection(game);
  });
  void test(`Native CHOAM and ${lead} card payer preserve free fixed strength and actual support income`, () => {
    const result = ecazOccupyCardsCase({ lead, allyFaction: 'choam', card: 'ecaz-reinforcements',
      variableDial: 3, support: 3, opponentDial: 3 });
    const { fixture, actor, before, game } = result;
    assert.equal(game.lastBattleContext?.winner, actor);
    assert.equal(seat(game, fixture.ally).spice - seat(before, fixture.ally).spice,
      lead === 'ally' ? -2 : 2,
      'CHOAM receives only floor halves from actual other payers, never fixed strength or Reinforcements.');
    if (lead === 'ecaz') assert.equal(seat(before, actor).spice - seat(game, actor).spice, 3);
    assert.equal(reserveChange(result, actor), -3);
    assert.equal(forces(result, fixture.ecaz), 2);
    assert.equal(forces(result, fixture.ally), 1);
    discardedOnce(result);
    collection(game);
  });
  void test(`Native CHOAM fixed-only ${lead} Reinforcements creates no support payment or income`, () => {
    const result = ecazOccupyCardsCase({ lead, allyFaction: 'choam', card: 'ecaz-reinforcements',
      variableDial: 0, support: 0 });
    assert.equal(seat(result.game, result.fixture.ally).spice, seat(result.before, result.fixture.ally).spice);
    assert.equal(seat(result.game, result.fixture.ecaz).spice, seat(result.before, result.fixture.ecaz).spice);
    assert.equal(forces(result, result.fixture.ecaz), 2);
    assert.equal(forces(result, result.fixture.ally), 4);
    discardedOnce(result);
  });
  void test(`Actual Face Dance after ${lead} Harass cannot recapture returned own reserves`, () => {
    const result = ecazOccupyCardsCase({ lead, allyFaction: 'guild', opponentFaction: 'emperor',
      roster: ['ecaz', 'guild', 'emperor', 'tleilaxu'], expansions: ['ecaz', 'ix'],
      faceDancerFaction: lead === 'ecaz' ? 'ecaz' : 'guild', stopAtFaceDance: true });
    const { fixture, actor, before } = result;
    const dancer = result.game.players.find(p => p.faction === 'tleilaxu');
    assert.ok(dancer);
    const decision = result.game.decision;
    assert.ok(decision?.kind === 'faceDance');
    assert.equal(decision.winner, actor);
    assert.equal(decision.leader, result.actorLeader);
    assert.equal(reserveChange(result, actor), 2);
    const other = actor === fixture.ecaz ? fixture.ally : fixture.ecaz;
    assert.equal(forces(result, actor), 0);
    assert.equal(forces(result, other), 2);
    assert.throws(() => applyAction(result.game, dancer.id, { type: 'decision', reveal: true,
      sources: { reserves: 3 }, sector: splitLocation(fixture.location).sector }), /more forces/,
    'The two withdrawn forces are outside the surviving coalition replacement limit.');
    let game = applyAction(result.game, dancer.id, { type: 'decision', reveal: true,
      sources: { reserves: 2 }, sector: splitLocation(fixture.location).sector });
    game = finishOccupyCardsAftermath(game);
    assert.equal(seat(game, actor).reserves, seat(before, actor).reserves + 2);
    assert.equal(seat(game, other).reserves, seat(before, other).reserves + 2);
    assert.equal(ecazOccupyTerritoryForces(game, dancer.id, fixture.territory), 2);
    assert.equal(seat(game, actor).leaders.find(l => l.id === result.actorLeader)!.dead, true);
    assert.equal(game.discard.filter(card => card.id === result.card).length, 1);
    collection(game);
  });
}

for (const lead of ['ecaz', 'ally'] as const) {
  void test(`Selected ${lead} Harass winner performs ordinary own-card cleanup after returning forces`, () => {
    const result = ecazOccupyCardsCase({ lead, cleanupShield: true });
    const { fixture, actor, before, game } = result;
    assert.equal(game.lastBattleContext?.winner, actor);
    assert.equal(reserveChange(result, actor), 2);
    assert.ok(game.discard.some(card => card.id === result.shield));
    assert.ok(!seat(game, actor).hand.some(card => card.id === result.shield));
    const other = actor === fixture.ecaz ? fixture.ally : fixture.ecaz;
    for (const card of seat(before, other).hand)
      assert.ok(seat(game, other).hand.some(held => held.id === card.id));
    discardedOnce(result);
    collection(game);
  });
  void test(`Native CHOAM ${lead} Harass pays only variable support after its own withdrawal`, () => {
    const result = ecazOccupyCardsCase({ lead, allyFaction: 'choam',
      variableDial: 3, support: 3, opponentDial: 3 });
    const { fixture, actor, before, game } = result;
    assert.equal(game.lastBattleContext?.winner, actor);
    assert.equal(seat(game, fixture.ally).spice - seat(before, fixture.ally).spice,
      lead === 'ally' ? -2 : 2);
    assert.equal(reserveChange(result, actor), lead === 'ecaz' ? 2 : 1);
    assert.equal(tankChange(result, fixture.ecaz), 3);
    assert.equal(tankChange(result, fixture.ally), 3);
    assert.equal(forces(result, fixture.ecaz), lead === 'ecaz' ? 0 : 2);
    assert.equal(forces(result, fixture.ally), lead === 'ally' ? 0 : 1);
    discardedOnce(result);
    collection(game);
  });
}

void test('selected typed Harass losses survive an opposing mandatory Reinforcements discard without reopening allocation', () => {
  const result = ecazOccupyCardsCase({
    lead: 'ally', allyFaction: 'emperor', opponentFaction: 'guild', allyForces: 6, allyElite: 2,
    variableDial: 3.5, support: 2,
    returnedForces: { normal: 1, elite: 1 },
    losses: { normal: 3, elite: 1 },
    opponentCard: 'ecaz-reinforcements',
  });
  assert.equal(result.game.lastBattleContext?.winner, result.actor);
  assert.equal(forces(result, result.fixture.ally), 0);
  assert.equal(forces(result, result.fixture.ecaz), 2);
  assert.equal(reserveChange(result, result.actor), 2);
  assert.equal(tankChange(result, result.actor), 4);
  assert.ok(result.game.discard.some(card => card.id === 'ecaz-reinforcements'));
  collection(result.game);
});

void test('Basic co-present Ecaz card armies remain unsupported instead of admitting an ordinary single-army outcome', () => {
  for (const card of ['ecaz-harass-withdraw', 'ecaz-reinforcements']) {
    const game = harassWithdrawGame({ advanced: false, factions: ['guild', 'emperor', 'ecaz'] });
    const guild = game.players[0], ecaz = game.players[2];
    // Labelled co-side rule-unit staging on the genuine ordinary variant setup.
    guild.ally = ecaz.id;
    ecaz.ally = guild.id;
    ecaz.forces = { 'arrakeen:10': 2 };
    ecaz.reserves -= 2;
    takeHarassCard(game, guild.id, card);
    assert.throws(() => applyAction(game, guild.id,
      { type: 'battlePlan', dial: 1, leader: 'guild-0', weapon: card }),
    /supported Advanced Occupy battle profile/);
    assert.equal(game.battle?.plans[guild.id], undefined);
  }
});
