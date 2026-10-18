import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Game } from '../game/engine';
import { MOBILE_LOCATION } from '../game/board';
import { homeworldForceGroups } from '../game/homeworld-custody';
import { homeworldContext } from '../game/homeworld-game';
import { deployRicheseNoField, projectRicheseNoField } from '../game/richese-no-field';
import {
  createEcazBetrayalModulesFixture, ecazBetrayalModulesPlayer as player,
  resolveEcazBetrayalModules, smokeEcazBetrayalModules,
  type EcazBetrayalModulesFixture,
} from './fixture-ecaz-betrayal-modules';

function queue(game: Game) {
  return { turn: game.turn, phase: game.phase, active: game.active, order: game.order,
    remaining: game.movementRemaining, choices: game.players.map(player => [player.id, player.shipped, player.moved]) };
}
function pool(game: Game, owner: string, location: string) {
  return homeworldForceGroups(homeworldContext(game), game.homeworlds!.custody!)
    .find(group => group.id === location)!.forces[owner];
}
function completion(f: EcazBetrayalModulesFixture, game: Game, cancel: boolean) {
  assert.deepEqual(queue(game), queue(f.game), 'Betrayal neither consumes nor reorders the original Shipment/Movement queue');
  assert.equal(game.nexusEcazBetrayalHistory!.at(-1)!.stage, 'complete');
  assert.equal(game.nexusCards!.cards!.discard.filter(card => card === 'ecaz').length, 1);
  assert.equal(game.discard.filter(card => card.id === f.karama).length, cancel ? 1 : 0);
  assert.equal(player(game, f.ally).forces['arrakeen:10'], player(f.game, f.ally).forces['arrakeen:10'],
    'The actual paid outside group remains in its own territory');
  assert.deepEqual(player(game, 'ecaz').forces, player(f.game, 'ecaz').forces);
  assert.deepEqual(player(game, 'guild').forces, player(f.game, 'guild').forces);
  assert.deepEqual(game.strongholdCards, f.game.strongholdCards,
    'Returning troops does not reassign previously earned Stronghold Cards before Mentat');
}

for (const modules of [false, true]) {
  void test(`original ${modules ? 'selected-family Worlds/all14/phase' : 'Ecaz'} typed Emperor Betrayal allows a native return or actual earned Karama cancellation`, () => {
    const f = createEcazBetrayalModulesFixture({ program: 'typed', advanced: true,
      expansions: modules ? ['ix', 'choam', 'ecaz'] : ['ecaz'], homeworlds: modules,
      skills: modules, tech: modules, strongholds: modules });
    assert.equal(f.game.turn, 3);
    assert.equal(f.game.phase, 5);
    assert.ok(f.game.players.every(player => !player.shipped && player.moved === 0));
    assert.equal(f.acquired.bid.actor, 'ecaz');
    assert.equal(f.acquired.bid.action.amount, 1);
    assert.ok(player(f.game, 'ecaz').hand.some(card => card.id === f.karama));
    assert.equal(f.afterDraw.nexusCards!.cards!.hands.guild, 'ecaz');
    assert.equal(player(f.afterDraw, 'ecaz').ally, 'emperor');
    assert.equal(player(f.afterDraw, 'emperor').ally, 'ecaz');
    assert.equal(player(f.afterDraw, 'guild').ally, null);
    assert.deepEqual(f.row.total, { normal: 1, elite: 2 });
    assert.equal(player(f.game, 'ecaz').forces[f.location], 6, 'The original six-counter Ecaz setup remains in Imperial Basin');
    assert.equal(player(f.game, 'emperor').forces[f.location], 3);
    assert.equal(player(f.game, 'emperor').elites!.forces[f.location], 2);
    const before = player(f.game, 'emperor');
    for (const cancel of [false, true]) {
      const { game, declared } = resolveEcazBetrayalModules(f, cancel);
      assert.equal(declared.response?.kind, 'nexusEcazBetrayal');
      assert.deepEqual(player(declared, 'emperor').forces, before.forces, 'The declared return waits for real counters');
      const after = player(game, 'emperor');
      completion(f, game, cancel);
      assert.equal(after.forces[f.location] ?? 0, cancel ? 3 : 0);
      assert.equal(after.elites!.forces[f.location] ?? 0, cancel ? 2 : 0);
      assert.equal(after.reserves, before.reserves + (cancel ? 0 : 3));
      assert.equal(after.elites!.reserves, before.elites!.reserves + (cancel ? 0 : 2));
      assert.equal(after.tanks, before.tanks);
      assert.equal(after.elites!.tanks, before.elites!.tanks);
      if (modules) {
        const k = 'homeworld:emperor', s = 'homeworld:emperor:salusa';
        assert.deepEqual(pool(game, 'emperor', k), { normal: pool(f.game, 'emperor', k).normal + (cancel ? 0 : 1),
          elite: pool(f.game, 'emperor', k).elite });
        assert.deepEqual(pool(game, 'emperor', s), { normal: pool(f.game, 'emperor', s).normal,
          elite: pool(f.game, 'emperor', s).elite + (cancel ? 0 : 2) });
      }
    }
  });
}

void test('original Richese zero/three/five markers recall face down under Ecaz Betrayal; actual Karama preserves each concealed deployment', () => {
  const rows: unknown[] = [];
  for (const value of [0, 3, 5] as const) {
    const f = createEcazBetrayalModulesFixture({ program: 'richese', marker: value, advanced: true,
      expansions: ['choam', 'ecaz'], homeworlds: true, skills: true, tech: true, strongholds: true });
    const before = player(f.game, 'richese'), marker = structuredClone(before.noField!);
    const shipment = f.shipments.at(-1)!;
    assert.equal(shipment.step.action.noField, f.marker, 'The selected original token arrives through its paid own shipment');
    assert.equal(player(shipment.after, 'richese').noField!.deployed!.tokenId, f.marker);
    assert.equal(player(f.cooccupied, 'richese').noField!.deployed!.tokenId, f.marker);
    assert.ok(f.actions.every(step => step.action.type !== 'offerRicheseNoField'),
      'The continuation declines a separate optional allied shipment, whose acceptance would reveal the existing marker');
    assert.equal(marker.deployed!.tokenId, f.marker);
    assert.equal(marker.tokens.find(token => token.id === f.marker)!.value, value);
    assert.equal(before.forces[f.location] ?? 0, 0, 'The genuine concealed marker has not materialized counters');
    assert.equal(player(f.game, 'ecaz').forces[f.location], 6);
    assert.deepEqual(f.row.total, { normal: 0, elite: 0 });
    assert.equal('concealed' in f.row && f.row.concealed, true);
    assert.ok(!JSON.stringify(f.row).includes(f.marker!), 'Only public concealed presence enters the target row');
    rows.push(structuredClone(f.row));
    for (const cancel of [false, true]) {
      const { game } = resolveEcazBetrayalModules(f, cancel), after = player(game, 'richese');
      completion(f, game, cancel);
      assert.equal(after.reserves, before.reserves, 'A face-down recall neither materializes nor returns hidden counters');
      assert.equal(after.tanks, before.tanks);
      assert.deepEqual(after.forces, before.forces);
      assert.deepEqual(game.homeworlds, f.game.homeworlds, 'A marker-only recall changes no native physical pool');
      if (cancel) assert.deepEqual(after.noField, marker);
      else {
        assert.equal(after.noField!.deployed, null);
        assert.equal(after.noField!.lastShipped, f.marker, 'The original repeat ban survives a hidden return');
        assert.equal(projectRicheseNoField(after.noField!, false).lastUsed, null, 'Recalling face down reveals no denomination');
        assert.throws(() => deployRicheseNoField(after.noField!, marker.deployed!), /same No-Field|twice|row/i);
      }
    }
  }
  assert.deepEqual(rows[1], rows[0]);
  assert.deepEqual(rows[2], rows[0], 'All three original denominations have the same public target projection');
});

void test('original Bene Gesserit advisors return completely from Ecaz cooccupation while an actual outside group and stance remain unchanged', () => {
  const f = createEcazBetrayalModulesFixture({ program: 'advisors', advanced: true,
    expansions: ['ix', 'choam', 'ecaz'], homeworlds: true, skills: true, tech: true, strongholds: true });
  const before = player(f.game, f.ally);
  assert.equal(before.forces[f.location], 2, 'One original setup advisor and one paid advisor shipment share Imperial Basin');
  assert.ok(before.advisors?.[f.target]);
  assert.deepEqual(f.row.total, { normal: 2, elite: 0 });
  for (const cancel of [false, true]) {
    const { game } = resolveEcazBetrayalModules(f, cancel), after = player(game, f.ally);
    completion(f, game, cancel);
    assert.equal(after.reserves, before.reserves + (cancel ? 0 : 2));
    assert.equal(after.forces[f.location] ?? 0, cancel ? 2 : 0);
    assert.equal(after.tanks, before.tanks);
    assert.equal(!!after.advisors?.[f.target], cancel);
    assert.deepEqual(after.advisors?.arrakeen, before.advisors?.arrakeen);
  }
});

void test('actual parent-to-HMS Ecaz movement admits original mixed Ix garrison return without moving the structure or consuming its queue', () => {
  const f = createEcazBetrayalModulesFixture({ program: 'hms', advanced: true,
    expansions: ['ix', 'ecaz'], homeworlds: true, skills: true, tech: true, strongholds: true });
  assert.equal(f.entryMove!.action.type, 'move');
  assert.equal(f.entryMove!.action.from, 'polar_sink:0');
  assert.equal(player(f.game, 'ecaz').forces[MOBILE_LOCATION], 1);
  const before = player(f.game, 'ixians');
  assert.equal(before.forces[MOBILE_LOCATION], 6);
  assert.equal(before.elites!.forces[MOBILE_LOCATION], 3);
  assert.deepEqual(f.row.total, { normal: 3, elite: 3 });
  for (const cancel of [false, true]) {
    const { game } = resolveEcazBetrayalModules(f, cancel), after = player(game, 'ixians');
    completion(f, game, cancel);
    assert.equal(after.forces[MOBILE_LOCATION] ?? 0, cancel ? 6 : 0);
    assert.equal(after.elites!.forces[MOBILE_LOCATION] ?? 0, cancel ? 3 : 0);
    assert.equal(after.reserves, before.reserves + (cancel ? 0 : 6));
    assert.equal(after.elites!.reserves, before.elites!.reserves + (cancel ? 0 : 3));
    assert.equal(after.tanks, before.tanks);
    assert.equal(after.elites!.tanks, before.elites!.tanks);
    assert.deepEqual(game.mobileStronghold, f.game.mobileStronghold);
    assert.equal(player(game, 'ecaz').forces[MOBILE_LOCATION], 1);
  }
});

void test('all four minimal policies propose original Ecaz Betrayal for typed and concealed-only cooccupation', () => {
  for (const program of ['typed', 'richese'] as const) {
    const report = smokeEcazBetrayalModules({ program, marker: 0, advanced: true,
      homeworlds: true, expansions: program === 'richese' ? ['choam', 'ecaz'] : ['ecaz'] });
    assert.equal(report.length, 4);
    assert.ok(report.every(result => result.completed && result.phase === 5 && result.actions > 0));
  }
});
