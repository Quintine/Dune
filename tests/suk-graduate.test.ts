import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, normalizeAutomaticGame, viewGame, type Action, type Game } from '../game/engine';
import { sukGraduateSkill, sukRescueOptions, quoteSukRescue } from '../game/suk-graduate';
import { validateLeaderSkills } from '../game/leader-skills';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { advancedAtreidesSukOffer, sukBattle, resolveSuk } from './suk-graduate-fixture';

function conserved(game: Game) {
  for (const player of game.players) {
    assert.equal(Object.values(player.forces).reduce((a, b) => a + b, 0) + player.reserves + player.tanks, 20);
    if (player.elites) assert.equal(Object.values(player.elites.forces).reduce((a, b) => a + b, 0) + player.elites.reserves + player.elites.tanks, 5);
  }
  validateLeaderSkills(game.leaderSkills!, game.players);
}
function unchanged(game: Game, player: string, action: Action) {
  const before = JSON.stringify(game);
  assert.throws(() => applyAction(game, player, action));
  assert.equal(JSON.stringify(game), before);
}
function chooseRescue(game: Game, count: number, keepElite = false): Game {
  const d = game.decision;
  assert.equal(d?.kind, 'sukRescue');
  if (d?.kind !== 'sukRescue') throw new Error('Missing rescue');
  const choice = d.options.findIndex((o) => o.normal + o.elite === count && (!keepElite || o.kept?.kind === 'elite'));
  assert.ok(choice >= 0);
  return applyAction(game, 'a', { type: 'decision', event: d.event, choice });
}

void test('Suk entitlement distinguishes public, selected, bluff, killed and captured leaders', () => {
  const assignment = { skill: 'suk-graduate' as const, leader: 'skilled', faceUp: true, captured: false };
  assert.equal(sukGraduateSkill([assignment], { id: 'other', dead: false }, false)?.mode, 'normal');
  assert.equal(sukGraduateSkill([{ ...assignment, faceUp: false }], { id: 'other', dead: false }, true), null);
  assert.equal(sukGraduateSkill([{ ...assignment, faceUp: false }], { id: 'skilled', dead: false }, false), null);
  assert.equal(sukGraduateSkill([{ ...assignment, captured: true }], { id: 'other', dead: false }, true), null);
  assert.equal(sukGraduateSkill([{ ...assignment, captured: true }], { id: 'skilled', dead: false }, true)?.mode, 'skilled');
});

void test('new Advanced Atreides setup and revival keep the physical Suk offer private but reject its assignment immutably', () => {
  const game = advancedAtreidesSukOffer();
  const ownerView = viewGame(game, 'a');
  const otherView = viewGame(game, 'd');
  const offer = ownerView.leaderSkills!.offer!;
  assert.equal(offer.cards.length, 2);
  assert.ok(offer.cards.includes('suk-graduate'));
  assert.match(
    ownerView.leaderSkills!.unavailableSkills?.['suk-graduate'] ?? '',
    /Kwisatz Haderach loss-count ruling is pending/,
  );
  assert.equal(otherView.leaderSkills?.unavailableSkills, undefined);

  const available = offer.cards.find((skill) => skill !== 'suk-graduate')!;

  const blockedAction: Action = {
    type: 'leaderSkill', event: offer.event, skill: 'suk-graduate', leader: 'atreides-0',
  };
  const before = JSON.stringify(game);
  assert.throws(() => applyAction(game, 'a', blockedAction), /Suk Graduate is unavailable/);
  assert.equal(JSON.stringify(game), before);
  validateLeaderSkills(game.leaderSkills!, game.players);

  const assigned = applyAction(game, 'a', { ...blockedAction, skill: available });
  assert.equal(assigned.leaderSkills!.assignments.find((a) => a.owner === 'a')?.skill, available);
  assert.ok(assigned.leaderSkills!.deck.includes('suk-graduate'));
  validateLeaderSkills(assigned.leaderSkills!, assigned.players);

  const revival = structuredClone(game);
  revival.status = 'playing';
  revival.setupStage = undefined;
  revival.leaderSkills!.offers.a.leader = 'atreides-0';
  revival.decision = { kind: 'leaderSkillRevival', player: 'a', event: offer.event };
  const revivalBefore = JSON.stringify(revival);
  assert.throws(() => applyAction(revival, 'a', blockedAction), /Suk Graduate is unavailable/);
  assert.equal(JSON.stringify(revival), revivalBefore);
  validateLeaderSkills(revival.leaderSkills!, revival.players);
});

void test('all four Advanced Atreides bots choose the available other skill', () => {
  for (const difficulty of DIFFICULTIES) {
    const game = advancedAtreidesSukOffer();
    const view = viewGame(game, 'a');
    view.players.find((player) => player.id === 'a')!.bot = difficulty;
    const offer = view.leaderSkills!.offer!;
    const available = offer.cards.find((skill) => skill !== 'suk-graduate')!;
    const action = botActions(view)[0];
    assert.equal(action?.type, 'leaderSkill', difficulty);
    assert.equal(action?.skill, available, difficulty);
    const assigned = applyAction(game, 'a', action);
    assert.equal(assigned.leaderSkills!.assignments.find((a) => a.owner === 'a')?.skill, available);
    validateLeaderSkills(assigned.leaderSkills!, assigned.players);
  }
});

void test('Suk redirects only selected physical casualties and keeps the original sector', () => {
  const pool = [{ key: 'wind_pass:14', normal: 2, elite: 1 }, { key: 'wind_pass:15', normal: 1, elite: 1 }];
  const losses = { normal: 2, elite: 2, paidNormal: 2, paidElite: 2 };
  const skill = { leader: 'skilled', mode: 'skilled' as const };
  const options = sukRescueOptions(skill, pool, losses);
  assert.ok(options.some((o) => o.normal + o.elite === 0));
  assert.ok(options.every((o) => o.normal + o.elite <= 3));
  assert.ok(options.every((o) => o.kept?.key !== 'wind_pass:15' || o.kept.kind === 'elite'));
  for (const option of options) {
    const q = quoteSukRescue(skill, pool, losses, option);
    assert.equal(q.removed.reduce((n, g) => n + g.normal + g.elite, 0), 4 - (option.kept ? 1 : 0));
    assert.equal(q.reserves.normal + q.reserves.elite + q.tanks.normal + q.tanks.elite + (option.kept ? 1 : 0), 4);
  }
  const normal = sukRescueOptions({ ...skill, mode: 'normal' }, pool, losses);
  assert.equal(normal.length, 2);
  assert.ok(normal.every((o) => o.normal + o.elite === 1 && !o.kept));
  assert.throws(() => quoteSukRescue(skill, pool, losses, { normal: 4, elite: 0, kept: { key: 'wind_pass:14', kind: 'normal' } }));
});

void test('Basic normal rescue is automatic; concealed bluff grants no rescue', () => {
  const normal = resolveSuk(sukBattle({ hide: false }));
  assert.equal(normal.pendingSukRescue, null);
  assert.equal(normal.players[0].tanks, 3);
  assert.equal(normal.players[0].reserves, 16);
  assert.equal(normal.players[0].forces['arrakeen:10'], 1);
  conserved(normal);
  const bluff = resolveSuk(sukBattle({ bluff: true }));
  assert.equal(bluff.pendingSukRescue, undefined);
  assert.equal(bluff.players[0].tanks, 4);
  assert.equal(bluff.players[0].reserves, 15);
  conserved(bluff);
});

void test('skilled rescue saves up to three without stacking, and survives JSON with strict ownership', () => {
  const pending = resolveSuk(sukBattle());
  assert.equal(pending.decision?.kind, 'sukRescue');
  assert.equal(pending.players[0].tanks, 0, 'raw casualties remain pending');
  assert.equal(pending.players[0].forces['arrakeen:10'], 5);
  const restored = JSON.parse(JSON.stringify(pending)) as Game;
  assert.deepEqual(normalizeAutomaticGame(restored), restored);
  assert.deepEqual(viewGame(restored, 'a').decision, viewGame(pending, 'a').decision);
  unchanged(restored, 'd', { type: 'decision', event: restored.pendingSukRescue!.event, choice: 1 });
  unchanged(restored, 'a', { type: 'decision', event: 'stale', choice: 1 });
  unchanged(restored, 'a', { type: 'decision', event: restored.pendingSukRescue!.event, choice: 100 });
  const done = chooseRescue(restored, 3);
  assert.equal(done.players[0].tanks, 1);
  assert.equal(done.players[0].reserves, 17);
  assert.equal(done.players[0].forces['arrakeen:10'], 2);
  assert.equal(done.players[0].spice, 20);
  assert.equal(done.lastBattleContext?.sukRescue?.completed, true);
  assert.equal(done.pendingSukRescue, null);
  conserved(done);
  unchanged(done, 'a', { type: 'decision', event: restored.pendingSukRescue!.event, choice: 3 });
  const declined = chooseRescue(pending, 0);
  assert.equal(declined.players[0].tanks, 4);
  assert.equal(declined.players[0].reserves, 15);
  assert.equal(declined.players[0].forces['arrakeen:10'], 1);
  conserved(declined);
});

void test('corrupt Suk receipt, force pool, options or missing continuation fail without mutation', () => {
  const good = resolveSuk(sukBattle());
  for (const corrupt of [
    (g: Game) => { g.pendingSukRescue = null; },
    (g: Game) => { g.players[0].reserves++; },
    (g: Game) => { g.pendingSukRescue!.skill.mode = 'normal'; },
    (g: Game) => { g.pendingSukRescue!.losses!.normal--; },
    (g: Game) => { if (g.decision?.kind === 'sukRescue') g.decision.options.pop(); },
    (g: Game) => { g.decision = null; },
    (g: Game) => {
      const assignment = g.leaderSkills!.assignments.find((a) => a.skill === 'suk-graduate')!;
      assignment.skill = g.leaderSkills!.deck[0];
      g.leaderSkills!.deck[0] = 'suk-graduate';
    },
  ]) {
    const bad = structuredClone(good); corrupt(bad);
    const before = JSON.stringify(bad);
    assert.throws(() => viewGame(bad, 'a'));
    assert.throws(() => normalizeAutomaticGame(bad));
    unchanged(bad, 'a', { type: 'advanceBots' });
    assert.equal(JSON.stringify(bad), before);
  }
});

void test('a stale dead face-up trainer cannot rescue casualties or appear as an active skill', () => {
  const game = sukBattle({ hide: false });
  game.players[0].leaders[0].dead = true;
  const before = JSON.stringify(game);
  assert.throws(() => viewGame(game, 'a'), /dead or missing leader/);
  assert.throws(() => normalizeAutomaticGame(game), /dead or missing leader/);
  unchanged(game, 'd', { type: 'traitorCall', call: false });
  assert.equal(JSON.stringify(game), before);
});

void test('Advanced rescue preserves paid support, elite identity and all four legal AI paths', () => {
  let pending = resolveSuk(sukBattle({ advanced: true, elite: true }));
  if (pending.decision?.kind === 'battleLosses') {
    const choice = pending.decision.options.findIndex((o) => o.elite > 0 && o.normal > 0);
    assert.ok(choice >= 0);
    pending = applyAction(pending, 'a', { type: 'decision', choice });
  }
  assert.equal(pending.decision?.kind, 'sukRescue');
  const done = chooseRescue(pending, 3, true);
  assert.equal(done.players[0].spice, 17, 'support remains paid for raw dial');
  assert.equal(done.players[0].tanks, 0);
  assert.equal(done.players[0].elites?.forces['arrakeen:10'], 2);
  assert.equal(done.players[0].elites?.reserves, 3);
  conserved(done);
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(pending, 'a');
    view.players.find((p) => p.id === 'a')!.bot = difficulty;
    const actions = botActions(view);
    assert.ok(actions.length, difficulty);
    const result = applyAction(pending, 'a', actions[0]);
    assert.equal(result.pendingSukRescue, null);
    assert.equal(result.players[0].tanks, 0);
    conserved(result);
  }
});

void test('used captive returns with its skill before the captor resolves the frozen lower-band rescue', () => {
  const pending = resolveSuk(sukBattle({ captured: true }));
  assert.equal(pending.decision?.kind, 'sukRescue');
  assert.equal(pending.pendingSukRescue?.skill.mode, 'skilled');
  assert.equal(pending.players[1].leaders[0].capturedBy, undefined);
  assert.equal(pending.leaderSkills!.assignments.find((a) => a.skill === 'suk-graduate')?.owner, 'd');
  const done = chooseRescue(JSON.parse(JSON.stringify(pending)) as Game, 3);
  assert.equal(done.players[0].tanks, 1);
  assert.equal(done.players[0].reserves, 17);
  conserved(done);
});

void test('a killed skilled winner gets no rescue, but a separate face-up trainer still rescues', () => {
  const killed = resolveSuk(sukBattle({ weaponKills: true }));
  assert.equal(killed.lastBattleContext?.winner, 'a');
  assert.equal(killed.players[0].leaders[0].dead, true);
  assert.equal(killed.pendingSukRescue, undefined);
  assert.equal(killed.players[0].tanks, 4);
  conserved(killed);
  const otherKilled = resolveSuk(sukBattle({ hide: false, weaponKills: true }));
  assert.equal(otherKilled.players[0].leaders[1].dead, true);
  assert.equal(otherKilled.players[0].leaders[0].dead, false);
  assert.equal(otherKilled.players[0].tanks, 3);
  assert.equal(otherKilled.players[0].reserves, 16);
  conserved(otherKilled);
});

void test('zero dial and a traitor victory have no Suk loss or optional window', () => {
  const zero = resolveSuk(sukBattle({ dial: 0 }));
  assert.equal(zero.pendingSukRescue, undefined);
  assert.equal(zero.players[0].tanks, 0);
  const state = sukBattle();
  state.battle!.traitorCalls.a = undefined as unknown as boolean;
  state.players[0].traitors = [state.battle!.plans.d.leader!];
  const called = applyAction(state, 'a', { type: 'traitorCall', call: true });
  const win = resolveSuk(called);
  assert.equal(win.lastBattleContext?.result, 'traitor');
  assert.equal(win.pendingSukRescue, undefined);
  assert.equal(win.players[0].tanks, 0);
  conserved(win);
});

void test('Advanced normal rescue offers the actual casualty types and returns the chosen elite to reserves', () => {
  let game = resolveSuk(sukBattle({ hide: false, advanced: true, elite: true }));
  if (game.decision?.kind === 'battleLosses') {
    const choice = game.decision.options.findIndex((o) => o.normal === 2 && o.elite === 1);
    assert.ok(choice >= 0);
    game = applyAction(game, 'a', { type: 'decision', choice });
  }
  const decision = game.decision;
  assert.equal(decision?.kind, 'sukRescue');
  if (decision?.kind !== 'sukRescue') throw new Error('Missing rescue');
  assert.equal(decision.mode, 'normal');
  assert.ok(decision.options.every((o) => o.normal + o.elite === 1 && !o.kept));
  const choice = decision.options.findIndex((o) => o.elite === 1);
  game = applyAction(game, 'a', { type: 'decision', event: decision.event, choice });
  assert.equal(game.players[0].elites?.reserves, 4);
  assert.equal(game.players[0].elites?.tanks, 0);
  assert.equal(game.players[0].elites?.forces['arrakeen:10'], 1);
  assert.equal(game.players[0].tanks, 2);
  conserved(game);
});

void test('Advanced Atreides pending ruling rejects before the final traitor vote; Basic rescue remains playable', () => {
  const blocked = sukBattle({ advanced: true, atreides: true });
  const before = JSON.stringify(blocked);
  assert.throws(() => resolveSuk(blocked), /Kwisatz Haderach loss-count ruling/);
  assert.equal(JSON.stringify(blocked), before);
  const basic = resolveSuk(sukBattle({ atreides: true }));
  assert.equal(basic.decision?.kind, 'sukRescue');
  conserved(chooseRescue(basic, 3));
});
