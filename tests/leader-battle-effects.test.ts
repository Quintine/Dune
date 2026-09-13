import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, normalizeAutomaticGame, viewGame, type Game, type Action } from '../game/engine';
import { leaderSkillBattle, resolveLeaderSkillBattle } from './leader-skill-battle-fixture';
import { leaderSkillStrongholdCount } from '../game/leader-skill-battle-board';
import { leaderSkillBattleBonus, bureaucratBattlePenalty } from '../game/leader-skill-combat';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { validateLeaderSkills } from '../game/leader-skills';
import { rihaniVictorySkill } from '../game/rihani-decipherer';

function reject(g: Game, id: string, action: Action) {
  const before = JSON.stringify(g); assert.throws(() => applyAction(g, id, action)); assert.equal(JSON.stringify(g), before);
}
function conserved(g: Game) {
  validateLeaderSkills(g.leaderSkills!, g.players);
  for (const p of g.players) assert.equal(p.reserves + p.tanks + Object.values(p.forces).reduce((a,b) => a+b, 0), 20);
  assert.equal(new Set([...(g.traitorReserve ?? []), ...g.players.flatMap((p) => p.traitors)]).size, g.players.length * 5);
}

void test('Mentat adds only surviving selected disc strength and Bureaucrat reduces the opposing total', () => {
  for (const captured of [false, true]) {
    const assignments = [{ skill: 'mentat' as const, leader: 'm', faceUp: captured, captured }];
    assert.equal(leaderSkillBattleBonus({ assignments, selectedLeader: { id: 'm', kind: 'disc' }, weapon: undefined, defense: undefined, skilledLeaderSurvives: true }).bonus, 2);
    assert.equal(leaderSkillBattleBonus({ assignments, selectedLeader: { id: 'm', kind: 'disc' }, weapon: undefined, defense: undefined, skilledLeaderSurvives: false }).bonus, 0);
    assert.equal(leaderSkillBattleBonus({ assignments, selectedLeader: { id: 'other', kind: 'disc' }, weapon: undefined, defense: undefined, skilledLeaderSurvives: true }).bonus, 0);
  }
  const bureau = [{ skill: 'bureaucrat' as const, leader: 'b', faceUp: false, captured: false }];
  assert.equal(bureaucratBattlePenalty(bureau, 'b', true, 3), 3);
  assert.equal(bureaucratBattlePenalty(bureau, 'b', false, 3), 0);
  assert.throws(() => bureaucratBattlePenalty(bureau, 'b', true, undefined));
  const mentat = resolveLeaderSkillBattle(leaderSkillBattle({ skill: 'mentat' }));
  assert.ok(mentat.log.some((l) => l.text.includes('gained 2 battle strength from Mentat')));
  conserved(mentat);
  const game = leaderSkillBattle({ skill: 'bureaucrat' });
  game.players[1].forces['tueks_sietch:4'] = 1; game.players[1].reserves--;
  const resolved = resolveLeaderSkillBattle(game);
  assert.ok(resolved.log.some((l) => l.text.includes('battle total fell by 2')));
  conserved(resolved);
  const killed = resolveLeaderSkillBattle(leaderSkillBattle({ skill: 'bureaucrat', weaponKills: true }));
  assert.ok(!killed.log.some((l) => l.text.includes('battle total fell')));
});

void test('Bureaucrat counts distinct occupation and excludes advisors and unoccupied virtual control', () => {
  const player = { faction: 'beneGesserit' as const, forces: { 'arrakeen:10': 2, 'carthag:11': 1, 'tueks_sietch:4': 1 }, advisors: { carthag: { lockedTurn: 1 } } };
  assert.equal(leaderSkillStrongholdCount({}, player), 2);
  assert.equal(leaderSkillStrongholdCount({}, { ...player, forces: {} }), 0);
});

void test('Sandmaster adds board spice once after a surviving victory even when every dialed force dies', () => {
  const game = leaderSkillBattle({ skill: 'sandmaster', territory: 'wind_pass', sector: 14, dial: 5 });
  game.spice = { 'wind_pass:14': 2 };
  const done = resolveLeaderSkillBattle(game);
  assert.equal(done.spice['wind_pass:14'], 5);
  assert.equal(done.players[0].spice, 20);
  assert.equal(done.players[0].forces['wind_pass:14'] ?? 0, 0);
  assert.deepEqual(normalizeAutomaticGame(JSON.parse(JSON.stringify(done))), done);
  reject(done, 'd', { type: 'traitorCall', call: false });
  for (const options of [{ hide: false }, { weaponKills: true }]) {
    const other = leaderSkillBattle({ skill: 'sandmaster', territory: 'wind_pass', sector: 14, ...options });
    other.spice = { 'wind_pass:14': 2 };
    assert.equal(resolveLeaderSkillBattle(other).spice['wind_pass:14'], 2);
  }
  const empty = resolveLeaderSkillBattle(leaderSkillBattle({ skill: 'sandmaster' }));
  assert.equal(empty.lastBattleContext?.sandmaster, undefined);
  const ambiguous = leaderSkillBattle({ skill: 'sandmaster', territory: 'wind_pass', sector: 14 });
  ambiguous.spice = { 'wind_pass:14': 2, 'wind_pass:15': 3 };
  reject(ambiguous, 'd', { type: 'traitorCall', call: false });
});

void test('native Rihani has a compulsory private peek then commits its separate optional draw before seeing cards', () => {
  const pending = resolveLeaderSkillBattle(leaderSkillBattle({ skill: 'rihani-decipherer' }));
  const receipt = pending.rihaniHistory![0], beforeHand = [...pending.players[0].traitors];
  assert.equal(receipt.peeked.length, 2); assert.equal(receipt.drawn.length, 0);
  assert.equal(pending.decision?.kind, 'rihani');
  const own = viewGame(pending, 'a'), other = viewGame(pending, 'd');
  assert.equal(own.rihani!.history[0].peeked.length, 2);
  assert.deepEqual(other.rihani!.history, []);
  assert.equal('drawn' in other.rihani!.pending!, false);
  assert.equal('rihaniHistory' in other, false);
  assert.deepEqual(normalizeAutomaticGame(JSON.parse(JSON.stringify(pending))), pending);
  reject(pending, 'd', { type: 'decision', event: receipt.event, draw: true });
  reject(pending, 'a', { type: 'decision', event: 'stale', draw: true });
  const decline = applyAction(pending, 'a', { type: 'decision', event: receipt.event, draw: false });
  assert.deepEqual(decline.players[0].traitors, beforeHand);
  assert.equal(decline.decision?.kind, 'battleCards');
  const drawn = applyAction(pending, 'a', { type: 'decision', event: receipt.event, draw: true });
  assert.equal(drawn.players[0].traitors.length, beforeHand.length + 2);
  assert.equal(drawn.rihaniHistory![0].drawn.length, 2);
  reject(drawn, 'a', { type: 'decision', event: receipt.event, draw: false });
  const r = drawn.rihaniHistory![0];
  reject(drawn, 'a', { type: 'decision', event: r.event, cards: [r.eligible[0], r.drawn[0]] });
  const done = applyAction(JSON.parse(JSON.stringify(drawn)), 'a', { type: 'decision', event: r.event, cards: [r.drawn[0], r.eligible[0]] });
  assert.equal(done.players[0].traitors.length, beforeHand.length);
  assert.ok(done.players[0].traitors.includes(r.drawn[0]));
  assert.ok(done.traitorReserve!.includes(r.eligible[0]));
  assert.ok(done.traitorReserve!.includes(r.drawn[1]));
  assert.ok(!done.players[0].revealedTraitors?.includes(r.eligible[0]), 'exchange disclosure is not a traitor call');
  assert.equal(done.lastBattleContext?.rihani?.completed, true);
  reject(done, 'a', { type: 'decision', event: r.event, cards: [r.drawn[0], r.eligible[0]] });
  for (const complete of [decline, done]) {
    const bad = structuredClone(complete); bad.traitorReserve!.reverse();
    assert.throws(() => viewGame(bad, 'a'));
    assert.throws(() => normalizeAutomaticGame(bad));
    reject(bad, 'a', { type: 'decision', cards: [] });
  }
  for (const state of [pending, decline, drawn, done]) conserved(state);
});

void test('Rihani normal, bluff, killed, used-traitor and captured bands keep their distinct eligibility', () => {
  const trainer = [{ skill: 'rihani-decipherer' as const, leader: 'r', faceUp: true, captured: false }];
  assert.equal(rihaniVictorySkill(trainer, 'r', false), null);
  assert.equal(rihaniVictorySkill(trainer, 'other', false)?.normal, true);
  const normal = resolveLeaderSkillBattle(leaderSkillBattle({ skill: 'rihani-decipherer', hide: false }));
  assert.equal(normal.rihaniHistory![0].peeked.length, 2);
  assert.equal(normal.rihaniHistory![0].stage, 'complete');
  for (const options of [{ bluff: true }, { weaponKills: true }]) {
    const noSkill = resolveLeaderSkillBattle(leaderSkillBattle({ skill: 'rihani-decipherer', ...options }));
    assert.equal(noSkill.rihaniHistory, undefined);
  }
  const used = leaderSkillBattle({ skill: 'rihani-decipherer' });
  used.players[0].revealedTraitors = [...used.players[0].traitors];
  const noExchange = resolveLeaderSkillBattle(used);
  assert.equal(noExchange.rihaniHistory![0].stage, 'complete');
  assert.equal(noExchange.rihaniHistory![0].peeked.length, 2);
  const captive = resolveLeaderSkillBattle(leaderSkillBattle({ skill: 'rihani-decipherer', captured: true }));
  assert.equal(captive.rihaniHistory![0].peeked.length, 0);
  assert.equal(captive.rihaniHistory![0].stage, 'offer');
  assert.equal(captive.players[1].leaders[0].capturedBy, undefined);
  conserved(captive);
});

void test('Rihani rejects changed physical custody, detached assignment or missing choice without mutation', () => {
  const good = resolveLeaderSkillBattle(leaderSkillBattle({ skill: 'rihani-decipherer' }));
  for (const corrupt of [
    (g: Game) => { g.rihaniHistory = []; },
    (g: Game) => { g.rihaniHistory![0].peeked.reverse(); },
    (g: Game) => { g.traitorReserve!.reverse(); },
    (g: Game) => { g.decision = null; },
    (g: Game) => { g.lastBattleContext!.rihani = undefined; },
    (g: Game) => { const a = g.leaderSkills!.assignments.find((a) => a.skill === 'rihani-decipherer')!; [a.skill, g.leaderSkills!.deck[0]] = [g.leaderSkills!.deck[0], a.skill]; },
  ]) {
    const bad = structuredClone(good); corrupt(bad); const before = JSON.stringify(bad);
    assert.throws(() => viewGame(bad, 'a')); assert.throws(() => normalizeAutomaticGame(bad));
    reject(bad, 'a', { type: 'advanceBots' }); assert.equal(JSON.stringify(bad), before);
  }
});

void test('all four Rihani bots draw and complete the owned exchange through saved public/private views', () => {
  const pending = resolveLeaderSkillBattle(leaderSkillBattle({ skill: 'rihani-decipherer' }));
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(pending, 'a'); view.players[0].bot = difficulty;
    const drawn = applyAction(pending, 'a', botActions(view)[0]);
    const returnView = viewGame(JSON.parse(JSON.stringify(drawn)), 'a'); returnView.players[0].bot = difficulty;
    const done = applyAction(drawn, 'a', botActions(returnView)[0]);
    assert.equal(done.rihaniHistory![0].stage, 'complete', difficulty); conserved(done);
  }
});

void test('native Suk casualty rescue completes before a returned captive grants its frozen Rihani exchange', () => {
  const done = resolveLeaderSkillBattle(leaderSkillBattle({ skill: 'rihani-decipherer', captured: true, capturedNativeSkill: 'suk-graduate', hide: false }));
  assert.equal(done.players[0].reserves, 16);
  assert.equal(done.players[0].tanks, 3);
  assert.equal(done.decision?.kind, 'rihani');
  assert.equal(done.rihaniHistory![0].peeked.length, 0);
  assert.equal(done.players[1].leaders[0].capturedBy, undefined);
  assert.deepEqual(normalizeAutomaticGame(JSON.parse(JSON.stringify(done))), done);
  conserved(done);
});

void test('a Rihani traitor victory inspects normally but cannot exchange the card just used to win', () => {
  let game = leaderSkillBattle({ skill: 'rihani-decipherer' });
  const target = game.battle!.plans.d.leader!, old = game.players[0].traitors[0];
  if (target !== old) {
    const source = [game.traitorReserve!, game.players[1].traitors].find((cards) => cards.includes(target))!;
    source[source.indexOf(target)] = old; game.players[0].traitors[0] = target;
  }
  delete game.battle!.traitorCalls.a;
  game = applyAction(game, 'a', { type: 'traitorCall', call: true });
  const done = resolveLeaderSkillBattle(game);
  assert.equal(done.lastBattleContext?.result, 'traitor');
  assert.deepEqual(done.players[0].revealedTraitors, [target]);
  assert.equal(done.rihaniHistory![0].peeked.length, 2);
  assert.deepEqual(done.rihaniHistory![0].eligible, []);
  assert.equal(done.rihaniHistory![0].stage, 'complete');
  conserved(done);
});
