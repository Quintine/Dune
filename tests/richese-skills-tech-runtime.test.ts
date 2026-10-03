import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { quoteSpiceCollection } from '../game/board-resolution-quote';
import { ownedTech, TECH_TOKENS } from '../game/tech-tokens';
import { assertAdvancedNativeCustody } from './fixture-advanced-native-skills';
import {
  advanceRicheseSkillsTechToPhase, createRicheseSkillsTechFixture, finishRicheseSkillsTechBattle,
  nextRicheseSkillsTechNativeStep, openRicheseSkillsTechBattle, payRicheseSkillsTechShipment,
  richeseSkillsTechPlayer as player, type RicheseSkillsTechFixture,
} from './fixture-richese-skills-tech';

function reject(game: Game, actor: string, action: Action): void {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}
function cards(game: Game): string[] {
  return [...game.deck, ...game.discard, ...game.players.flatMap(p => p.hand),
    ...(game.richeseCache ?? []), ...(game.richeseRemoved ?? [])].map(c => c.id).sort();
}
function wallets(game: Game): Record<string, number> {
  return Object.fromEntries(game.players.map(p => [p.id, p.spice]));
}
function changedTokens(before: Game, after: Game): string[] {
  return TECH_TOKENS.filter(t => before.techTokens![t.id].owner !== after.techTokens![t.id].owner).map(t => t.id);
}
function reveal(fixture: RicheseSkillsTechFixture, hide = true): Game {
  let game = openRicheseSkillsTechBattle(fixture, hide);
  game = applyAction(game, fixture.owner, fixture.ownerPlan);
  return applyAction(game, fixture.opponent, fixture.opponentPlan);
}
function calls(state: Game, callers: string[] = []): Game {
  let game = state;
  for (let n = 0; game.battle?.revealed && !game.decision && !game.response && n < 20; n++) {
    const next = nextRicheseSkillsTechNativeStep(game);
    if (next.action.type !== 'traitorCall') break;
    next.action.call = callers.includes(next.actor);
    game = applyAction(game, next.actor, next.action);
  }
  return game;
}
function reward(fixture: RicheseSkillsTechFixture, state: Game): Game {
  const token = ownedTech(fixture.game.techTokens, fixture.opponent)[0];
  assert.ok(token, 'Original three-seat first Storm gives the defeated seat one physical token.');
  assert.deepEqual(changedTokens(fixture.game, state), [], 'Physical rescue/cleanup must precede token reward.');
  const settled = finishRicheseSkillsTechBattle(state);
  assert.deepEqual(changedTokens(fixture.game, settled), [token]);
  assert.equal(settled.techTokens![token].owner, fixture.owner);
  assert.equal(settled.pendingTech, null);
  assert.deepEqual(cards(settled), cards(fixture.game));
  assertAdvancedNativeCustody(settled);
  return settled;
}

for (const advanced of [false, true]) for (const marker of [0, 3, 5] as const) {
  void test(`${advanced ? 'Advanced' : 'Basic'} native Richese ${marker} marker reveals only after both plans, caps real Suk casualties, then rewards the original loser token`, () => {
    const fixture = createRicheseSkillsTechFixture({ advanced, marker, ...(marker === 5 ? { reserves: 3 } : {}) });
    const beforeShipment = fixture.beforeShipment!, shipped = fixture.afterShipment!;
    assert.equal(player(shipped, fixture.owner).spice, player(beforeShipment, fixture.owner).spice - 1);
    assert.equal(player(shipped, fixture.owner).reserves, player(beforeShipment, fixture.owner).reserves);
    let game = openRicheseSkillsTechBattle(fixture);
    const pool = marker === 5 ? 3 : marker;
    reject(game, fixture.owner, { ...fixture.ownerPlan, dial: pool + 1, support: advanced ? pool + 1 : 0 });
    game = applyAction(game, fixture.owner, fixture.ownerPlan);
    assert.ok(player(game, fixture.owner).noField!.deployed);
    assert.equal(player(game, fixture.owner).forces[fixture.key] ?? 0, 0);
    assert.equal(viewGame(game, fixture.opponent).richeseNoField!.private, null);
    game = applyAction(game, fixture.opponent, fixture.opponentPlan);
    assert.equal(player(game, fixture.owner).noField!.deployed, null);
    assert.equal(player(game, fixture.owner).forces[fixture.key] ?? 0, pool);
    assert.equal(player(game, fixture.owner).reserves, (marker === 5 ? 3 : 20) - pool);
    const before = player(fixture.game, fixture.owner).spice;
    game = finishRicheseSkillsTechBattle(calls(game), 'skill');
    assert.equal(game.lastBattleContext!.winner, fixture.owner);
    assert.equal(player(game, fixture.owner).spice, before - (advanced ? pool : 0));
    assert.equal(player(game, fixture.opponent).tanks, 6);
    const losingCard = String(fixture.opponentPlan.weapon);
    assert.equal(game.discard.filter(c => c.id === losingCard).length, 1);
    if (pool) {
      const d = game.decision;
      assert.ok(d?.kind === 'sukRescue');
      assert.equal(d.mode, 'skilled');
      assert.equal(player(game, fixture.owner).tanks, 0, 'Do not pre-apply declared casualties before real rescue.');
      const choice = d.options.findIndex(o => o.normal === pool && o.elite === 0 && o.kept?.key === fixture.key);
      assert.ok(choice >= 0);
      reject(game, fixture.opponent, { type: 'decision', event: d.event, choice });
      reject(game, fixture.owner, { type: 'decision', event: `${d.event}-stale`, choice });
      game = applyAction(game, fixture.owner, { type: 'decision', event: d.event, choice });
      assert.equal(player(game, fixture.owner).forces[fixture.key], 1);
      assert.equal(player(game, fixture.owner).reserves, (marker === 5 ? 3 : 20) - 1);
      assert.equal(player(game, fixture.owner).tanks, 0);
      assert.equal(game.lastBattleContext!.sukRescue!.completed, true);
    } else {
      assert.equal(player(game, fixture.owner).reserves, 20);
      assert.equal(player(game, fixture.owner).tanks, 0);
      assert.equal(player(game, fixture.owner).forces[fixture.key] ?? 0, 0);
    }
    reward(fixture, game);
  });
}

for (const advanced of [false, true]) void test(`${advanced ? 'Advanced' : 'Basic'} normal Suk saves one actual three-marker casualty, never all declared losses`, () => {
  const fixture = createRicheseSkillsTechFixture({ advanced, marker: 3, band: 'normal' });
  let game = finishRicheseSkillsTechBattle(calls(reveal(fixture, false)), 'cleanup');
  assert.equal(game.lastBattleContext!.winner, fixture.owner);
  assert.equal(player(game, fixture.owner).forces[fixture.key] ?? 0, 0);
  assert.equal(player(game, fixture.owner).tanks, 2);
  assert.equal(player(game, fixture.owner).reserves, 18);
  game = reward(fixture, game);
  assert.equal(player(game, fixture.opponent).tanks, 6);
});

for (const advanced of [false, true]) for (const marker of [0, 3, 5] as const) {
  void test(`${advanced ? 'Advanced' : 'Basic'} Smuggler adds one real companion to No-Field ${marker} without changing its one-marker fee or earning Banker`, () => {
    const fixture = createRicheseSkillsTechFixture({ advanced, kind: 'shipment', marker });
    const before = fixture.game, paid = payRicheseSkillsTechShipment(fixture);
    const own = player(paid, fixture.owner);
    assert.equal(own.spice, player(before, fixture.owner).spice - 1);
    assert.equal(own.reserves, player(before, fixture.owner).reserves - 1);
    assert.equal(own.forces[fixture.key], 1);
    assert.equal(own.noField!.deployed!.tokenId, String(fixture.shipmentAction!.noField));
    assert.equal(paid.techTokens!.heighliners.spice, 1);
    assert.deepEqual(viewGame(paid, fixture.banker).spiceBankerIncome!.deferred, []);
    assert.deepEqual(cards(paid), cards(before));
    assertAdvancedNativeCustody(paid);
  });
}

void test('a real qualifying revival earns Banker independently; No-Field companion triggers Heighliners and each collects at its original final leg exactly once', () => {
  const fixture = createRicheseSkillsTechFixture({ kind: 'shipment', bankerPayment: true });
  const before = fixture.game;
  assert.deepEqual(viewGame(before, fixture.banker).spiceBankerIncome!.deferred, [{ owner: fixture.banker, amount: 1 }]);
  const grants = before.spiceBankerIncome!.sources.filter(row => row.grant);
  assert.deepEqual(grants.map(row => row.source.bankLegs), [[{ payer: fixture.opponent, amount: 4 }]]);
  const paid = payRicheseSkillsTechShipment(fixture);
  assert.equal(player(paid, fixture.owner).spice, player(before, fixture.owner).spice - 1);
  assert.deepEqual(paid.spiceBankerIncome!.sources.filter(row => row.grant), grants);
  const sources = structuredClone(paid.spiceBankerIncome!.sources);
  const expected = Object.fromEntries(quoteSpiceCollection(paid).receipts.map(r => [r.player, r.balance]));
  const techOwner = paid.techTokens!.heighliners.owner!;
  expected[techOwner] += 1;
  const collection = advanceRicheseSkillsTechToPhase(paid, 7);
  assert.equal(collection.phase, 7, 'Empty Battle may correctly auto-skip from Movement to Collection.');
  assert.deepEqual(wallets(collection), expected);
  assert.equal(collection.techTokens!.heighliners.spice, 0);
  assert.deepEqual(viewGame(collection, fixture.banker).spiceBankerIncome!.deferred, [{ owner: fixture.banker, amount: 1 }]);
  const mentat = advanceRicheseSkillsTechToPhase(collection, 8);
  expected[fixture.banker] += 1;
  assert.deepEqual(wallets(mentat), expected);
  assert.deepEqual(viewGame(mentat, fixture.banker).spiceBankerIncome!.deferred, []);
  assert.deepEqual(mentat.spiceBankerIncome!.sources, sources, 'Neither Tech income nor Banker collection creates another bank-payment source.');
  const next = nextRicheseSkillsTechNativeStep(mentat), continued = applyAction(mentat, next.actor, next.action);
  assert.deepEqual(wallets(continued), expected);
  assert.deepEqual(continued.spiceBankerIncome!.collections, mentat.spiceBankerIncome!.collections);
  assertAdvancedNativeCustody(continued);
});

void test('original mixed own-marker battle guard survives Skills + Tech; only native voluntary reveal before Battle permits physical combat', () => {
  const fixture = createRicheseSkillsTechFixture({ kind: 'shipment', marker: 5 });
  let paid = payRicheseSkillsTechShipment(fixture);
  const enemy = player(paid, fixture.opponent);
  enemy.reserves -= 6; enemy.forces[fixture.key] = 6; // Explicit conserved opponent position, not a played shipment claim.
  const battle = advanceRicheseSkillsTechToPhase(paid, 6);
  const actor = battle.active!, target = actor === fixture.owner ? fixture.opponent : fixture.owner;
  reject(battle, actor, { type: 'chooseBattle', territory: fixture.territory, target });
  const own = player(paid, fixture.owner), token = own.noField!.deployed!.tokenId;
  reject(battle, fixture.owner, { type: 'revealNoField', token, event: own.noFieldEvent });
  paid = applyAction(paid, fixture.owner, { type: 'revealNoField', token, event: own.noFieldEvent });
  assert.equal(player(paid, fixture.owner).forces[fixture.key], 6);
  assert.equal(player(paid, fixture.owner).reserves, 14);
  assert.equal(player(paid, fixture.owner).noField!.deployed, null);
  const ready = advanceRicheseSkillsTechToPhase(paid, 6);
  const opened = openRicheseSkillsTechBattle({ ...fixture, game: ready });
  assert.equal(viewGame(opened, fixture.owner).battle!.ownForces!.normal, 6);
  assertAdvancedNativeCustody(opened);
});

for (const mode of ['kill', 'ignore'] as const) void test(`cache-acquired Stone ${mode} uses real undialed forces and cleanup before awarding the actual winner an original loser-owned Tech Token`, () => {
  const fixture = createRicheseSkillsTechFixture({ kind: 'stone' });
  assert.ok(fixture.acquisition.before.richeseCache!.some(c => c.id === 'richese-stone-burner'));
  assert.equal(fixture.acquisition.after.richeseCache!.some(c => c.id === 'richese-stone-burner'), false);
  for (const p of fixture.acquisition.before.players) assert.equal(player(fixture.acquisition.after, p.id).spice, p.spice);
  let game = reveal(fixture);
  assert.ok(game.decision?.kind === 'stoneBurner');
  game = applyAction(game, fixture.owner, { type: 'decision', event: game.decision.event, mode });
  const paidBefore = player(fixture.game, fixture.owner).spice;
  game = finishRicheseSkillsTechBattle(calls(game), 'skill');
  assert.equal(game.lastBattleContext!.winner, fixture.owner, 'Eight minus two undialed counters beats four minus one, independent of leaders.');
  for (const [actor, plan] of [[fixture.owner, fixture.ownerPlan], [fixture.opponent, fixture.opponentPlan]] as const) {
    assert.equal(player(game, actor).leaders.find(l => l.id === plan.leader)!.dead, mode === 'kill');
  }
  const bounty = mode === 'kill' ? [fixture.ownerPlan, fixture.opponentPlan].reduce((sum, plan, i) =>
    sum + player(fixture.game, i === 0 ? fixture.owner : fixture.opponent).leaders.find(l => l.id === plan.leader)!.strength, 0) : 0;
  assert.equal(player(game, fixture.owner).spice, paidBefore - 2 + bounty);
  if (mode === 'ignore') {
    const d = game.decision;
    assert.ok(d?.kind === 'sukRescue', 'Surviving hidden Suk trainer rescues actual Stone dialed casualties.');
    const choice = d.options.findIndex(o => o.normal === 2 && o.elite === 0 && o.kept?.key === fixture.key);
    assert.ok(choice >= 0);
    game = applyAction(game, fixture.owner, { type: 'decision', event: d.event, choice });
    assert.equal(player(game, fixture.owner).forces[fixture.key], 7);
    assert.equal(player(game, fixture.owner).tanks, 0);
    assert.equal(player(game, fixture.owner).reserves, 13);
    assert.equal(game.lastBattleContext!.sukRescue!.completed, true);
  } else {
    assert.equal(game.lastBattleContext!.sukRescue, undefined, 'Killed skilled trainer cannot rescue.');
    assert.equal(player(game, fixture.owner).forces[fixture.key], 6);
    assert.equal(player(game, fixture.owner).tanks, 2);
  }
  assert.equal(player(game, fixture.opponent).tanks, 4);
  const collection = quoteSpiceCollection(game).receipts.find(r => r.player === fixture.owner)!;
  const settled = reward(fixture, game);
  assert.ok(player(settled, fixture.owner).hand.some(c => c.id === 'richese-stone-burner'));
  assert.equal(player(settled, fixture.owner).spice, paidBefore - 2 + bounty + collection.collected + collection.strongholds,
    'Only real Stone support/bounty and independently quoted native Collection affect the wallet.');
});

for (const precedence of ['double-traitor', 'explosion'] as const) void test(`${precedence} takes precedence over actual cached Stone and gives no winner, no rescue and no Tech reward`, () => {
  const fixture = createRicheseSkillsTechFixture({ kind: 'stone', precedence });
  let game = reveal(fixture);
  assert.ok(game.decision?.kind === 'stoneBurner');
  game = applyAction(game, fixture.owner, { type: 'decision', event: game.decision.event, mode: 'kill' });
  game = finishRicheseSkillsTechBattle(calls(game, precedence === 'double-traitor' ? [fixture.owner, fixture.opponent] : []));
  assert.equal(game.lastBattleContext!.winner, null);
  assert.deepEqual(changedTokens(fixture.game, game), []);
  assert.equal(player(game, fixture.owner).tanks, 8);
  assert.equal(player(game, fixture.opponent).tanks, 4);
  assert.equal(game.discard.filter(c => c.id === 'richese-stone-burner').length, 1);
  assert.deepEqual(cards(game), cards(fixture.game));
  assertAdvancedNativeCustody(game);
});

void test('all four own-seat policies legally commit real capped marker plans, resolve skilled Suk and choose both-mode Stone controls without inventing token custody', () => {
  const marker = createRicheseSkillsTechFixture({ marker: 5, reserves: 3 });
  const stone = createRicheseSkillsTechFixture({ kind: 'stone' });
  const pending = finishRicheseSkillsTechBattle(calls(reveal(marker)), 'skill');
  assert.ok(pending.decision?.kind === 'sukRescue');
  const choice = reveal(stone);
  assert.ok(choice.decision?.kind === 'stoneBurner');
  for (const difficulty of DIFFICULTIES) {
    const plans = openRicheseSkillsTechBattle(marker);
    const view = viewGame(plans, marker.owner); view.players.find(p => p.id === marker.owner)!.bot = difficulty;
    const plan = botActions(view).find(a => a.type === 'battlePlan'); assert.ok(plan);
    assert.ok(Number(plan.dial) <= 3 && Number(plan.support ?? 0) <= player(plans, marker.owner).spice);
    const sealed = applyAction(plans, marker.owner, plan);
    assert.ok(player(sealed, marker.owner).noField!.deployed);
    assert.deepEqual(changedTokens(marker.game, sealed), []);
    const rescueView = viewGame(pending, marker.owner); rescueView.players.find(p => p.id === marker.owner)!.bot = difficulty;
    const rescue = botActions(rescueView)[0]; assert.ok(rescue?.type === 'decision');
    const rescued = applyAction(pending, marker.owner, rescue);
    assert.equal(player(rescued, marker.owner).forces[marker.key], 1);
    reward(marker, rescued);
    const stoneView = viewGame(choice, stone.owner); stoneView.players.find(p => p.id === stone.owner)!.bot = difficulty;
    const mode = botActions(stoneView)[0]; assert.ok(mode.mode === 'kill' || mode.mode === 'ignore');
    const chosen = applyAction(choice, stone.owner, mode);
    assert.equal(chosen.battle!.stoneBurner![stone.owner], mode.mode);
    const settled = finishRicheseSkillsTechBattle(calls(chosen));
    assert.equal(settled.lastBattleContext!.winner, stone.owner);
    assert.equal(ownedTech(settled.techTokens, stone.owner).length, 2);
    assertAdvancedNativeCustody(settled);
  }
});

void test('fresh authenticated original ready lobby retains IDs and seat order through actual marker payment, battle and original reward', () => {
  const initial = createGame('AUTHRICH', newPlayer('human-enemy', 'Human Emperor', 'emperor'), true, ['choam']);
  joinGame(initial, newPlayer('human-richese', 'Human Richese', 'richese'));
  joinGame(initial, newPlayer('human-banker', 'Human Banker', 'atreides'));
  const original = structuredClone(initial), identities = initial.players.map(p => ({ id: p.id, name: p.name, faction: p.faction }));
  const fixture = createRicheseSkillsTechFixture({ initial, marker: 3 });
  assert.deepEqual(initial, original);
  assert.equal(fixture.owner, 'human-richese');
  const completed = finishRicheseSkillsTechBattle(calls(reveal(fixture)));
  assert.equal(completed.lastBattleContext!.winner, fixture.owner);
  assert.deepEqual(completed.players.map(p => ({ id: p.id, name: p.name, faction: p.faction })), identities);
  assert.equal(ownedTech(completed.techTokens, fixture.owner).length, 2);
  assertAdvancedNativeCustody(completed);
});

void test('native Atreides dial and whole-plan prescience cannot disclose an own concealed Richese marker merely because Skills and Tech coexist', () => {
  const fixture = createRicheseSkillsTechFixture({ marker: 5, opponent: 'atreides' });
  let game = structuredClone(fixture.game);
  // Explicit conserved physical Karama custody; no invented offer or preparation.
  const at = game.deck.findIndex(c => c.effect === 'karama'); assert.ok(at >= 0);
  const karama = game.deck.splice(at, 1)[0]; player(game, fixture.opponent).hand.push(karama);
  const actor = game.active!;
  game = applyAction(game, actor, { type: 'chooseBattle', territory: fixture.territory,
    target: actor === fixture.owner ? fixture.opponent : fixture.owner });
  for (let n = 0; game.battle?.preparation?.kind !== 'prescience' && n < 100; n++) {
    const next = nextRicheseSkillsTechNativeStep(game); game = applyAction(game, next.actor, next.action);
  }
  assert.equal(game.battle!.preparation!.kind, 'prescience');
  reject(game, fixture.opponent, { type: 'prescience', field: 'dial' });
  game = applyAction(game, fixture.opponent, { type: 'declineBattlePower' });
  for (let n = 0; game.decision?.kind !== 'fullPlanOffer' && n < 100; n++) {
    const next = nextRicheseSkillsTechNativeStep(game); game = applyAction(game, next.actor, next.action);
  }
  assert.equal(game.decision?.kind, 'fullPlanOffer');
  reject(game, fixture.opponent, { type: 'card', mode: 'special', card: karama.id, target: fixture.owner });
  assert.ok(player(game, fixture.owner).noField!.deployed);
  assert.ok(player(game, fixture.opponent).hand.some(c => c.id === karama.id));
  assert.deepEqual(changedTokens(fixture.game, game), []);
  assertAdvancedNativeCustody(game);
});
