import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame, type Game } from '../game/engine';
import { ecazOccupyRicheseFixture, occupyRicheseSeat, openOccupyRichese,
  finishOccupyRichese, type EcazOccupyRicheseFixture } from './fixture-ecaz-occupy-richese';

type Lead = 'ecaz' | 'ally';
const seat = occupyRicheseSeat;
const at = (game: Game, actor: string, fixture: EcazOccupyRicheseFixture) =>
  seat(game, actor).forces[fixture.location] ?? 0;
const income = (game: Game, actor: string, fixture: EcazOccupyRicheseFixture) =>
  at(game, actor, fixture) > 0 ? 2 : 0;

function conserved(game: Game): void {
  for (const player of game.players) {
    assert.equal(player.reserves + player.tanks + Object.values(player.forces).reduce((sum, n) => sum + n, 0), 20,
      `${player.faction} retains twenty counters with its original physical owner.`);
  }
}

function leader(game: Game, actor: string, strongest: boolean) {
  const available = seat(game, actor).leaders.filter(candidate => !candidate.dead && !candidate.usedAt)
    .sort((a, b) => strongest ? b.strength - a.strength : a.strength - b.strength);
  assert.ok(available[0]);
  return available[0];
}

/** Both plans use native leaders without weapons; native aftermath declines
 * Traitor calls rather than altering the original deal's card custody. */
function settle(fixture: EcazOccupyRicheseFixture, lead: Lead, cancel: boolean, enemyFirst: boolean) {
  const actor = lead === 'ecaz' ? fixture.ecaz : fixture.ally;
  const originalMarker = structuredClone(seat(fixture.game, fixture.richese).noField!);
  assert.ok(originalMarker.deployed, 'The fixture shipped an actual original No-Field token.');
  assert.equal(originalMarker.lastShipped, originalMarker.deployed.tokenId);
  const karama = seat(fixture.game, fixture.opponent).hand.find(card => card.effect === 'karama');
  assert.ok(karama);
  let game = openOccupyRichese(fixture, lead, cancel);
  const before = structuredClone(game);
  const profile = viewGame(game, actor).battle!.ecazOccupy!.profile!;
  assert.ok(profile);
  assert.equal(profile.canceled, cancel);
  assert.equal(profile.payer, actor);
  assert.equal(profile.planOwner, actor);
  assert.equal(profile.forceOwner, cancel ? actor : fixture.ally);
  assert.equal(profile.fixedEcazDial, cancel ? 0 : 3,
    'The original five Ecaz counters contribute their fixed ceiling, independent of the selected lead.');
  assert.deepEqual(seat(game, fixture.richese).noField, originalMarker);
  if (cancel) {
    assert.ok(!seat(game, fixture.opponent).hand.some(card => card.id === karama.id));
    assert.ok(game.discard.some(card => card.id === karama.id),
      'Prevention spends the opposing seat\'s actual original Karama in the native response.');
  }

  const variable = cancel && actor === fixture.richese ? profile.maxDial
    : cancel && fixture.opponent === fixture.richese && lead === 'ecaz' ? 3 : 2;
  const support = variable;
  const enemyPool = viewGame(game, fixture.opponent).battle!.ownForces!.normal;
  const enemyDial = fixture.opponent === fixture.richese ? enemyPool : 0;
  const enemySupport = enemyDial;
  const ownLeader = leader(game, actor, true);
  const enemyLeader = leader(game, fixture.opponent, false);
  const dial = profile.fixedEcazDial + variable;
  assert.ok(dial + ownLeader.strength > enemyDial + enemyLeader.strength,
    'The original native leaders make this controlled battle a normal coalition victory.');
  const ownPlan = { type: 'battlePlan' as const, dial, support, leader: ownLeader.id };
  const enemyPlan = { type: 'battlePlan' as const, dial: enemyDial, support: enemySupport, leader: enemyLeader.id };
  const first = enemyFirst ? fixture.opponent : actor;
  const second = enemyFirst ? actor : fixture.opponent;
  game = applyAction(game, first, enemyFirst ? enemyPlan : ownPlan);
  assert.equal(game.battle!.revealed, false);
  assert.equal(viewGame(game, second).battle!.plans[first], undefined,
    'The first native seal does not expose the other side\'s plan.');
  assert.deepEqual(seat(game, fixture.richese).noField, originalMarker);
  assert.equal(seat(game, fixture.richese).reserves, seat(before, fixture.richese).reserves);
  assert.equal(at(game, fixture.richese, fixture), at(before, fixture.richese, fixture),
    'No prospective counters are placed after only one seal.');
  if (fixture.opponent === fixture.richese) {
    assert.equal(viewGame(game, actor).battle!.opponentForces, null);
    assert.equal(viewGame(game, actor).richeseNoField!.private, null);
  } else if (lead === 'ally') {
    assert.equal(viewGame(game, fixture.opponent).battle!.opponentForces, null);
    assert.equal(viewGame(game, fixture.opponent).battle!.ecazOccupy!.profile, null,
      'A selected Richese plan cannot expose its mixed private maximum before native reveal.');
  }
  conserved(game);

  game = applyAction(game, second, enemyFirst ? ownPlan : enemyPlan);
  assert.equal(game.battle!.revealed, true);
  assert.equal(game.battle!.plans[actor].leader, ownLeader.id);
  assert.equal(game.battle!.plans[fixture.opponent].dial, enemyDial);
  assert.equal(seat(game, fixture.richese).noField!.deployed, null);
  assert.deepEqual(seat(game, fixture.richese).noField!.tokens, originalMarker.tokens);
  assert.equal(seat(game, fixture.richese).noField!.lastShipped, originalMarker.lastShipped);
  assert.equal(at(game, fixture.richese, fixture), at(before, fixture.richese, fixture) + fixture.materialized!,
    'Only the second original seal adds the reserve-capped marker to the existing ordinary army.');
  assert.equal(seat(before, fixture.richese).reserves - seat(game, fixture.richese).reserves, fixture.materialized);
  if (fixture.opponent === fixture.richese) {
    assert.equal(viewGame(game, actor).battle!.opponentForces!.normal, enemyPool,
      'The opposing mixed total becomes public at its original reveal, not before.');
  }
  const revealed = structuredClone(game);
  conserved(revealed);
  game = finishOccupyRichese(game);
  assert.equal(game.battle, null);
  assert.equal(game.lastBattleContext!.result, 'normal');
  assert.equal(game.lastBattleContext!.winner, actor);
  assert.equal(seat(game, actor).leaders.find(candidate => candidate.id === ownLeader.id)!.usedAt, fixture.territory);
  assert.deepEqual(seat(game, fixture.richese).noField, seat(revealed, fixture.richese).noField,
    'Native settlement cannot restore the marker or reset its no-repeat shipment history.');
  assert.equal(seat(before, actor).spice - seat(game, actor).spice, support - income(game, actor, fixture),
    'Only the selected lead funds the variable support; the fixed Ecaz contribution is free.');
  const nonLead = actor === fixture.ecaz ? fixture.ally : fixture.ecaz;
  assert.equal(seat(game, nonLead).spice, seat(before, nonLead).spice + income(game, nonLead, fixture));
  assert.equal(seat(before, fixture.opponent).spice - seat(game, fixture.opponent).spice, enemySupport);
  conserved(game);
  return { game, before, profile, actor };
}

const opposingPools = [
  { marker: 0, richeseReserves: 4, mixedRicheseForces: 2 },
  { marker: 5, richeseReserves: 2, mixedRicheseForces: 2 },
  { marker: 3, richeseReserves: 0, mixedRicheseForces: 2 },
  { marker: 3, richeseReserves: 4, mixedRicheseForces: 1 },
] as const;

for (const lead of ['ecaz', 'ally'] as const) for (const pool of opposingPools)
  void test(`Mixed opposing Richese ${pool.mixedRicheseForces}+No-Field ${pool.marker}, reserves ${pool.richeseReserves}, ${lead} lead settles natively`, () => {
    const fixture = ecazOccupyRicheseFixture({ allyFaction: 'guild', opponentFaction: 'richese', ...pool });
    assert.equal(fixture.game.decision?.kind, 'ecazBattleLead', 'Actual chooseBattle admits the mixed opposing army.');
    conserved(fixture.game);
    const prepared = openOccupyRichese(fixture, lead);
    const actor = lead === 'ecaz' ? fixture.ecaz : fixture.ally;
    const total = pool.mixedRicheseForces + Math.min(pool.marker, pool.richeseReserves);
    assert.equal(viewGame(prepared, fixture.richese).battle!.ownForces!.normal, total);
    assert.equal(viewGame(prepared, actor).battle!.opponentForces, null,
      'Visible ordinary counters do not authorize disclosure of the hidden opposing maximum.');
    assert.equal(viewGame(prepared, actor).battle!.ecazOccupy!.profile!.maxDial, 7,
      'The ordinary Guild ally, not the opposing prospective army, supplies the variable Occupy pool.');
    const { game, before } = settle(fixture, lead, false, pool.marker !== 0);
    assert.equal(at(game, fixture.ecaz, fixture), 2);
    assert.equal(seat(game, fixture.ecaz).tanks - seat(before, fixture.ecaz).tanks, 3);
    assert.equal(at(game, fixture.ally, fixture), 2);
    assert.equal(seat(game, fixture.ally).tanks - seat(before, fixture.ally).tanks, 2);
    assert.equal(at(game, fixture.richese, fixture), 0);
    assert.equal(seat(game, fixture.richese).tanks - seat(before, fixture.richese).tanks, total,
      'Normal defeat destroys both the original ordinary counters and the actual reserve-limited reveal.');
    assert.equal(seat(game, fixture.richese).reserves, pool.richeseReserves - fixture.materialized!);
  });

for (const lead of ['ecaz', 'ally'] as const)
  void test(`Prevented Occupy against mixed opposing Richese leaves only selected ${lead} losses and payment`, () => {
    const fixture = ecazOccupyRicheseFixture({ allyFaction: 'guild', opponentFaction: 'richese',
      marker: 5, richeseReserves: 2, mixedRicheseForces: 2 });
    const { game, before, profile, actor } = settle(fixture, lead, true, true);
    assert.equal(profile.maxDial, lead === 'ecaz' ? 5 : 4);
    assert.equal(profile.forces.normal, lead === 'ecaz' ? 5 : 4);
    const ecazLoss = lead === 'ecaz' ? 3 : 0;
    const guildLoss = lead === 'ally' ? 2 : 0;
    assert.equal(at(game, fixture.ecaz, fixture), 5 - ecazLoss);
    assert.equal(seat(game, fixture.ecaz).tanks - seat(before, fixture.ecaz).tanks, ecazLoss);
    assert.equal(at(game, fixture.ally, fixture), 4 - guildLoss);
    assert.equal(seat(game, fixture.ally).tanks - seat(before, fixture.ally).tanks, guildLoss);
    assert.equal(at(game, fixture.richese, fixture), 0);
    assert.equal(seat(game, fixture.richese).tanks - seat(before, fixture.richese).tanks, 4);
    assert.equal(profile.payer, actor);
  });

for (const lead of ['ecaz', 'ally'] as const) for (const marker of [0, 5] as const)
  void test(`Prevented Occupy with mixed allied Richese No-Field ${marker} preserves selected ${lead}'s own army`, () => {
    const fixture = ecazOccupyRicheseFixture({ allyFaction: 'richese', opponentFaction: 'guild',
      marker, richeseReserves: 2, mixedRicheseForces: 2 });
    const prepared = openOccupyRichese(fixture, lead, true);
    const actor = lead === 'ecaz' ? fixture.ecaz : fixture.ally;
    const total = 2 + Math.min(marker, 2);
    assert.equal(viewGame(prepared, actor).battle!.ownForces!.normal, lead === 'ecaz' ? 5 : total);
    if (lead === 'ecaz') {
      assert.equal(viewGame(prepared, fixture.opponent).battle!.opponentForces!.normal, 5,
        'Prevention restores Ecaz\'s own inspectable army without borrowing any Richese counters.');
    } else {
      assert.equal(viewGame(prepared, fixture.opponent).battle!.ecazOccupy!.profile, null);
      assert.equal(viewGame(prepared, fixture.opponent).battle!.opponentForces, null);
    }
    const { game, before, profile } = settle(fixture, lead, true, lead === 'ecaz');
    assert.equal(profile.maxDial, lead === 'ecaz' ? 5 : total);
    assert.equal(profile.forces.normal, lead === 'ecaz' ? 5 : total);
    const ecazLoss = lead === 'ecaz' ? 2 : 0;
    const richeseLoss = lead === 'ally' ? total : 0;
    assert.equal(at(game, fixture.ecaz, fixture), 5 - ecazLoss);
    assert.equal(seat(game, fixture.ecaz).tanks - seat(before, fixture.ecaz).tanks, ecazLoss);
    assert.equal(at(game, fixture.richese, fixture), total - richeseLoss,
      'An unselected Richese army still reveals natively but loses no counters for Ecaz\'s dial.');
    assert.equal(seat(game, fixture.richese).tanks - seat(before, fixture.richese).tanks, richeseLoss);
    assert.equal(seat(game, fixture.richese).reserves, 2 - Math.min(marker, 2));
    assert.equal(seat(game, fixture.opponent).tanks - seat(before, fixture.opponent).tanks, 8);
  });
