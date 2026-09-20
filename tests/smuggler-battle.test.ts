import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, normalizeAutomaticGame, viewGame, type Game, type Action } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { ecazTreacheryCards } from '../game/ecaz-cards';
import { smugglerBattle, revealSmuggler, finishSmuggler, setOtherSkill } from './fixture-smuggler-battle';

function reject(game: Game, action: Action, id = 'a') {
  const before = JSON.stringify(game);
  assert.throws(() => applyAction(game, id, action));
  assert.equal(JSON.stringify(game), before);
}
function take(game: Game, id: string, kind: string) {
  const index = game.deck.findIndex(card => card.kind === kind);
  assert.ok(index >= 0);
  const [card] = game.deck.splice(index, 1);
  game.players.find(p => p.id === id)!.hand.push(card);
  return card.id;
}
function traitor(game: Game, owner: string, leader: string) {
  const holder = game.players.find(p => p.traitors.includes(leader));
  const target = game.players.find(p => p.id === owner)!;
  if (holder === target) return;
  const previous = target.traitors[0];
  target.traitors[0] = leader;
  if (holder) holder.traitors[holder.traitors.indexOf(leader)] = previous;
  else {
    const index = game.traitorReserve!.indexOf(leader); assert.ok(index >= 0);
    game.traitorReserve![index] = previous;
  }
}
void test('Smuggler freezes the revealed pile without credit then pays a surviving winner or loser in Basic and Advanced', () => {
  for (const advanced of [false, true]) for (const loses of [false, true]) {
    const start = smugglerBattle({ advanced });
    const pending = revealSmuggler(start, { dial: loses ? 0 : 4, enemyDial: loses ? 5 : 0 });
    assert.equal(pending.players[0].spice, 20);
    assert.equal(pending.spice['wind_pass:14'], 8);
    assert.equal(pending.battle!.smugglerCollection!.amount, 6);
    for (const p of pending.players) assert.deepEqual(viewGame(pending, p.id), viewGame(JSON.parse(JSON.stringify(pending)), p.id));
    const result = finishSmuggler(JSON.parse(JSON.stringify(pending)));
    assert.equal(result.lastBattleContext!.winner, loses ? 'd' : 'a');
    assert.equal(result.players[0].spice, 26 - (advanced && !loses ? 4 : 0));
    assert.equal(result.spice['wind_pass:14'], 2);
    assert.equal(result.lastBattleContext!.smugglerCollection!.stage, 'collected');
    if (loses) assert.equal(result.players[0].forces['wind_pass:14'] ?? 0, 0);
    assert.deepEqual(normalizeAutomaticGame(JSON.parse(JSON.stringify(result))), result);
    reject(result, { type: 'traitorCall', call: false }, 'd');
  }
});
void test('Smuggler collection is capped by a short or empty pile and does not require remaining forces', () => {
  for (const amount of [0, 2, 6]) {
    const result = finishSmuggler(revealSmuggler(smugglerBattle({ amount }), { dial: 5 }));
    assert.equal(result.players[0].spice, 20 + amount);
    assert.equal(result.spice['wind_pass:14'], 0);
    assert.equal(result.players[0].forces['wind_pass:14'] ?? 0, 0);
  }
});
void test('weapon deaths, opposing/mutual Traitors and explosion void collection; own Traitor victory still collects', () => {
  for (const outcome of ['weapon', 'explosion', 'own', 'opposing', 'mutual'] as const) {
    const game = smugglerBattle();
    let defense: string | null = null, enemyWeapon: string | null = null;
    if (outcome === 'weapon') enemyWeapon = take(game, 'd', 'projectile');
    if (outcome === 'explosion') { defense = take(game, 'a', 'shield'); enemyWeapon = take(game, 'd', 'lasgun'); }
    if (outcome === 'own' || outcome === 'mutual') traitor(game, 'a', 'guild-1');
    if (outcome === 'opposing' || outcome === 'mutual') traitor(game, 'd', 'emperor-0');
    const done = finishSmuggler(revealSmuggler(game, { defense, enemyWeapon }),
      outcome === 'own' || outcome === 'mutual', outcome === 'opposing' || outcome === 'mutual');
    assert.equal(done.lastBattleContext!.smugglerCollection!.stage, outcome === 'own' ? 'collected' : 'void', outcome);
    assert.equal(done.spice['wind_pass:14'], outcome === 'explosion' ? undefined : outcome === 'own' ? 2 : 8, outcome);
    assert.equal(done.players[0].spice, outcome === 'weapon' ? 26 : outcome === 'own' ? 29 : 20, outcome);
  }
});
void test('capture pays the controlling Harkonnen before the living skilled disc returns to its owner', () => {
  const game = smugglerBattle({ captured: true, hide: false });
  const revealed = revealSmuggler(game);
  assert.equal(revealed.battle!.smugglerCollection!.player, 'a');
  assert.equal(revealed.battle!.smugglerCollection!.leader, 'guild-0');
  const done = finishSmuggler(revealed);
  assert.equal(done.players[0].spice, 25);
  assert.equal(done.players[1].spice, 20);
  assert.equal(done.players[1].leaders[0].capturedBy, undefined);
  assert.equal(done.leaderSkills!.assignments.find(a => a.skill === 'smuggler')!.owner, 'd');
});
void test('a killed captured Smuggler earns nothing and returns its dead disc and skill to their proper custody', () => {
  const game = smugglerBattle({ captured: true, hide: false });
  const enemyWeapon = take(game, 'd', 'projectile');
  const done = finishSmuggler(revealSmuggler(game, { dial: 0, enemyDial: 5, enemyWeapon }));
  assert.equal(done.players[0].spice, 20);
  assert.equal(done.spice['wind_pass:14'], 8);
  assert.equal(done.lastBattleContext!.smugglerCollection!.stage, 'void');
  assert.equal(done.players[1].leaders[0].capturedBy, undefined);
  assert.equal(done.players[1].leaders[0].dead, true);
  assert.ok(done.leaderSkills!.deck.includes('smuggler'));
  assert.equal(done.leaderSkills!.assignments.some(a => a.skill === 'smuggler'), false);
  assert.deepEqual(normalizeAutomaticGame(JSON.parse(JSON.stringify(done))), done);
});
void test('an existing unversioned battle retains its original no-collection continuation', () => {
  const game = smugglerBattle();
  delete game.battle!.smugglerCollectionVersion;
  const pending = revealSmuggler(game);
  assert.equal(pending.battle!.smugglerCollection, undefined);
  const done = finishSmuggler(JSON.parse(JSON.stringify(pending)));
  assert.equal(done.players[0].spice, 20);
  assert.equal(done.spice['wind_pass:14'], 8);
  assert.equal(done.lastBattleContext!.smugglerCollection, undefined);
  assert.deepEqual(normalizeAutomaticGame(JSON.parse(JSON.stringify(done))), done);
});
void test('Smuggler collection precedes a surviving Sandmaster winner and may remove the last existing pile', () => {
  for (const amount of [4, 8]) {
    const game = smugglerBattle({ amount }); setOtherSkill(game, 'sandmaster');
    game.battle!.leaderSkillHidden!.d = true;
    const done = finishSmuggler(revealSmuggler(game, { dial: 0, enemyDial: 5, enemyLeader: 'guild-0' }));
    assert.equal(done.lastBattleContext!.winner, 'd');
    assert.equal(done.spice['wind_pass:14'], amount === 4 ? 0 : 5);
    assert.equal(!!done.lastBattleContext!.sandmaster, amount === 8);
  }
});
void test('changed reveal receipts, spice, plans or skill identity are rejected by reads, actions and restoration', () => {
  const pending = revealSmuggler(smugglerBattle());
  for (const corrupt of [
    (g: Game) => { delete g.battle!.smugglerCollection; },
    (g: Game) => { g.battle!.smugglerCollection!.amount++; },
    (g: Game) => { g.battle!.smugglerCollection!.event = 'another-battle'; },
    (g: Game) => { g.spice['wind_pass:14']++; },
    (g: Game) => { g.battle!.plans.d.dial++; },
    (g: Game) => { delete g.battle!.smugglerCollectionVersion; },
  ]) {
    const bad = structuredClone(pending); corrupt(bad);
    assert.throws(() => viewGame(bad, 'a'));
    assert.throws(() => normalizeAutomaticGame(bad));
    reject(bad, { type: 'traitorCall', call: false });
  }
  assert.equal(viewGame(smugglerBattle(), 'd').battle!.smugglerCollection, null);
  assert.equal('frame' in viewGame(pending, 'd').battle!.smugglerCollection!, false);
});
void test('own modified plans and multiple piles fail before sealing without changing any resources', () => {
  const game = smugglerBattle({ advanced: true, atreides: true });
  game.players[0].battleLosses = 7;
  reject(game, { type: 'battlePlan', leader: 'atreides-0', dial: 0, support: 0, kwisatz: true });
  const multiple = smugglerBattle(); multiple.spice['wind_pass:15'] = 2;
  reject(multiple, { type: 'battlePlan', leader: 'emperor-0', dial: 0 });
  const trainer = smugglerBattle({ captured: true, hide: false });
  setOtherSkill(trainer, 'warmaster', 'a');
  reject(trainer, { type: 'battlePlan', leader: 'guild-0', dial: 0, weapon: trainer.players[0].hand[0].id });
});
void test('the independent Ecaz card variant is gated before a Smuggler plan is sealed', () => {
  const game = smugglerBattle();
  game.ecazTreachery = true;
  game.deck.push(...ecazTreacheryCards());
  // The variant inventory is valid: admission is rejected for its public scope,
  // irrespective of which player secretly holds an expansion card.
  const own = viewGame(game, 'a');
  assert.equal(own.ecazTreachery, true);
  const action = { type: 'battlePlan' as const, leader: 'emperor-0', dial: 0 };
  assert.throws(() => applyAction(game, 'a', action), /other optional modules/);
  reject(game, action);
});
void test('all four actual bot profiles retain a legal unmodified path and finish pending collection', () => {
  for (const difficulty of DIFFICULTIES) {
    let game = smugglerBattle({ advanced: true, atreides: true });
    game.players[0].battleLosses = 7;
    // Only the skilled leader is available here; other living discs fought elsewhere.
    for (const leader of game.players[0].leaders.slice(1)) leader.usedAt = 'arrakeen';
    for (let step = 0; game.battle && step < 20; step++) {
      const candidates = game.players.flatMap(p => {
        const view = viewGame(game, p.id); view.players.find(v => v.id === p.id)!.bot = difficulty;
        return botActions(view).map(action => ({ id: p.id, action }));
      });
      assert.ok(candidates.length, difficulty);
      const { id, action } = candidates[0];
      if (id === 'a' && action.type === 'battlePlan') assert.ok(!action.kwisatz);
      game = applyAction(game, id, action);
      game = JSON.parse(JSON.stringify(game));
    }
    assert.equal(game.battle, null, difficulty);
    assert.ok(game.lastBattleContext!.smugglerCollection, difficulty);
  }
});
