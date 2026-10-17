import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, normalizeAutomaticGame, type Action, type Game } from '../game/engine';
import { nativeHomeworldArmy } from './fixture-homeworld-native-e1e2-modules';
import {
  advanceSelectedDeckSkills, assertSelectedDeckSkillsInventory, createSelectedDeckSkillsProgramme,
  createSelectedDeckSkillsRevivalCase, selectedDeckSkillsClean, selectedDeckSkillsPlayer,
  selectedDeckSkillsQuote,
} from './fixture-selected-deck-skills';

const reload = (game: Game): Game => JSON.parse(JSON.stringify(game)) as Game;

void test('bare Basic Ix/CHOAM table deals native setup and continues a paid shipment without independent cards', () => {
  const f = createSelectedDeckSkillsProgramme();
  const owner = f.owner, guild = f.guild;
  assert.equal(f.afterSetup.richeseCache!.length, 10, 'A seated Richese keeps its separate ten-card cache.');
  // The real Ix card draft happens before any module technique.
  assert.equal(f.started.setupStage, 'skillTreachery');
  assert.ok(f.ixOffer && f.ixOffer.after.setupStage === 'leaderSkills');
  assert.equal(f.ixOffer.after.leaderSkills!.assignments.length, 0);
  // Real spice pays for a real shipment into the untouched Guild army.
  const committed = selectedDeckSkillsPlayer(f.shipment.before, guild).forces['tueks_sietch:5'];
  assert.equal(selectedDeckSkillsPlayer(f.shipment.before, owner).spice -
    selectedDeckSkillsPlayer(f.shipment.after, owner).spice, 2);
  assert.equal(selectedDeckSkillsPlayer(f.shipment.after, owner).forces['tueks_sietch:5'], 2);
  assert.equal(selectedDeckSkillsPlayer(f.shipment.after, guild).forces['tueks_sietch:5'], committed);
  // The trained Mentat really changes the battle total.
  const quote = selectedDeckSkillsQuote(f.game);
  assert.equal(quote.winner, owner);
  assert.deepEqual(quote.leaderSkillBonuses.attacker.applied,
    [{ skill: 'mentat', amount: 2, mode: 'skilled' }]);
  assert.equal(quote.leaderSkillBonuses.defender.bonus, 0);
  // The same position continues into the next real phase with real losses.
  const done = advanceSelectedDeckSkills(f.game, g => !g.battle && selectedDeckSkillsClean(g), f.actions);
  assert.equal(done.phase, 7);
  assert.equal(selectedDeckSkillsPlayer(done, owner).forces['tueks_sietch:5'], 2, 'The winner keeps the territory.');
  assert.equal(selectedDeckSkillsPlayer(done, guild).forces['tueks_sietch:5'], undefined);
  assert.equal(selectedDeckSkillsPlayer(done, guild).tanks, selectedDeckSkillsPlayer(f.game, guild).tanks + committed);
  assertSelectedDeckSkillsInventory(done);
});

void test('the same bare table with original Homeworlds ships out of its real native pools', () => {
  const f = createSelectedDeckSkillsProgramme({ homeworlds: true });
  const owner = f.owner, home = `homeworld:${selectedDeckSkillsPlayer(f.shipment.before, owner).faction}`;
  assert.ok(f.afterSetup.homeworlds?.custody);
  const before = nativeHomeworldArmy(f.shipment.before, owner, home);
  const after = nativeHomeworldArmy(f.shipment.after, owner, home);
  assert.equal(before.normal + before.elite - after.normal - after.elite, 2);
  assert.equal(selectedDeckSkillsPlayer(f.shipment.before, owner).spice -
    selectedDeckSkillsPlayer(f.shipment.after, owner).spice, 2);
  assert.equal(selectedDeckSkillsPlayer(f.shipment.after, owner).forces['tueks_sietch:5'], 2);
  assertSelectedDeckSkillsInventory(f.shipment.after);
  const done = advanceSelectedDeckSkills(f.game, g => !g.battle && selectedDeckSkillsClean(g), f.actions);
  assert.equal(done.phase, 7);
  assertSelectedDeckSkillsInventory(done);
});

void test('a base-only table needs only its selected ordinary deck, even when no seat uses that deck', () => {
  const f = createSelectedDeckSkillsProgramme({ factions: ['emperor', 'atreides', 'guild'], expansions: ['ecaz'] });
  assert.equal(selectedDeckSkillsQuote(f.game).winner, f.owner);
  const done = advanceSelectedDeckSkills(f.game, g => !g.battle && selectedDeckSkillsClean(g), f.actions);
  assert.equal(done.phase, 7);
  assertSelectedDeckSkillsInventory(done);
});

void test('a real battle death keeps the native Advanced-only foreign ghola guard on a bare table', () => {
  const basic = createSelectedDeckSkillsRevivalCase({ advanced: false });
  const advanced = createSelectedDeckSkillsRevivalCase({ advanced: true });
  for (const f of [basic, advanced]) {
    assert.equal(f.game.turn, 2);
    assert.equal(f.game.phase, 4);
    assert.equal(f.game.players.flatMap(p => p.leaders).filter(l => l.id === f.dead).length, 1);
    assert.equal(f.game.leaderSkills!.assignments
      .some(a => a.owner === f.tleilaxu && a.leader === f.trainer), false,
    'The poisoned trainer returned its physical technique.');
    assertSelectedDeckSkillsInventory(f.game);
  }
  const action: Action = { type: 'reviveForeignGhola', leader: basic.dead };
  const untouched = reload(basic.game);
  assert.throws(() => applyAction(basic.game, basic.tleilaxu, action), /advanced Tleilaxu/);
  assert.deepEqual(basic.game, untouched, 'A Basic bare table pays nothing and revives nothing.');
  const disc = selectedDeckSkillsPlayer(advanced.game, advanced.guild).leaders.find(l => l.id === advanced.dead)!;
  const cost = Math.ceil(disc.strength / 2), purse = selectedDeckSkillsPlayer(advanced.game, advanced.tleilaxu).spice;
  const revived = applyAction(reload(advanced.game), advanced.tleilaxu, action);
  assert.equal(disc.dead, true, 'The caller-owned input keeps its own physical disc.');
  assert.equal(selectedDeckSkillsPlayer(revived, advanced.guild).leaders.find(l => l.id === advanced.dead)!.dead, false);
  assert.equal(selectedDeckSkillsPlayer(revived, advanced.guild).leaders.find(l => l.id === advanced.dead)!.gholaBy,
    advanced.tleilaxu);
  assert.equal(selectedDeckSkillsPlayer(revived, advanced.tleilaxu).spice, purse - cost);
  assert.ok(!revived.response && !revived.pendingRevival);
  assert.deepEqual(normalizeAutomaticGame(reload(revived)), revived,
    'The Advanced bare selected-deck table keeps the foreign ghola custody authorized.');
  assertSelectedDeckSkillsInventory(revived);
});
