import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyAction, createGame, initializeLeaderSkillsGameForAudit, joinGame, newPlayer,
  normalizeAutomaticGame, viewGame, type Action, type Game,
} from '../game/engine';
import { leaders, treacheryDeck, type Card } from '../game/cards';
import { traitorDeck } from '../game/traitors';
import { LEADER_SKILL_CARDS } from '../game/leader-skill-cards';
import { newRevivalRules } from '../game/revival';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  advancedNativePlayer as player, advancedNativeStep, assertAdvancedNativeCustody,
  completedAdvancedNativeSkillsGame, completeAdvancedNativeSkillsSetup,
  initializeAdvancedNativeSkillsSetup, openAdvancedNativeSkillBattle,
  rejectAdvancedNativeAction as reject, stageAdvancedNativeSkillBattle,
  finishAdvancedNativeSkillAftermath,
} from './fixture-advanced-native-skills';

const reload = (game: Game): Game => JSON.parse(JSON.stringify(game)) as Game;
const act = (game: Game, actor: string, action: Action): Game => applyAction(reload(game), actor, action);
const wallets = (game: Game) => Object.fromEntries(game.players.map(p => [p.id, p.spice]));
const trainer = (game: Game, actor: string) => game.leaderSkills!.assignments.find(a => a.owner === actor)!;

function custody(game: Game): void {
  assertAdvancedNativeCustody(game);
  const cards = [...game.deck, ...game.discard, ...game.players.flatMap(p => p.hand),
    ...(game.auction?.cards.slice(game.auction.index) ?? [])].map(c => c.id);
  assert.deepEqual(cards.sort(), treacheryDeck(['ecaz']).map(c => c.id).sort());
  assert.equal(cards.length, 33);
  assert.deepEqual(game.players.flatMap(p => p.leaders.map(l => l.id)).sort(),
    game.players.flatMap(p => leaders(p.faction).map(l => l.id)).sort());
  const traitors = [...game.traitorReserve!, ...game.players.flatMap(p => p.traitors),
    ...(game.moritaniAssassinate?.opportunities.filter(r => r.stage === 'replaced').map(r => r.card!) ?? [])];
  assert.deepEqual(traitors.sort(), traitorDeck(game.players).sort());
  assert.equal(new Set(traitors).size, traitors.length);
}

function take(game: Game, actor: string, matches: (card: Card) => boolean): Card {
  const index = game.deck.findIndex(matches);
  assert.ok(index >= 0, 'Staged card transfers must use the genuine native deck.');
  const card = game.deck.splice(index, 1)[0];
  game.players.find(p => p.id === actor)!.hand.push(card);
  return card;
}

function allow(state: Game): Game {
  let game = state;
  for (let i = 0; game.response && i < 30; i++) game = advancedNativeStep(game);
  assert.equal(game.response, null);
  return game;
}

/** Explicit phase controls after real setup, not a claim of natural phase history.
 * Placement is the original free native action; no wallet or inventory is edited. */
function placeTerror(state: Game, kind: 'assassination' | 'robbery'): Game {
  let game = reload(state);
  Object.assign(game, { phase: 7, active: null, ready: [], decision: null, response: null, phaseOpening: null });
  for (const seat of game.players) game = act(game, seat.id, { type: 'ready' });
  assert.equal(game.decision?.kind, 'moritaniPlacement');
  const owner = player(game, 'moritani').id;
  const token = game.moritaniTerror!.tokens.find(t => t.kind === kind)!;
  const funds = wallets(game);
  game = allow(act(game, owner, { type: 'decision', token: token.id, territory: 'carthag' }));
  assert.equal(game.moritaniTerror!.tokens.find(t => t.id === token.id)!.location, 'carthag');
  assert.deepEqual(wallets(game), funds, 'Native Terror placement is free.');
  custody(game);
  return game;
}

function enterTerror(state: Game, actor: string): Game {
  const game = reload(state);
  Object.assign(game, { phase: 5, storm: 18, active: actor, ready: [], decision: null,
    response: null, phaseOpening: null, movementRemaining: [...game.order] });
  const entrant = game.players.find(p => p.id === actor)!;
  entrant.shipped = false;
  entrant.moved = 0;
  return act(game, actor, { type: 'ship', territory: 'carthag', sector: 11, amount: 1 });
}

function resolve(state: Game, actor: string, target: string): Game {
  let game = act(state, actor, { type: 'traitorCall', call: false });
  game = act(game, target, { type: 'traitorCall', call: false });
  return game;
}

void test('Advanced native setup deals starting cards, full14 skills, traitors and original six-force placement in source order', () => {
  const lobby = createGame('MORISKIL', newPlayer('original-m', 'Moritani', 'moritani'), true, ['ecaz']);
  joinGame(lobby, newPlayer('original-a', 'Atreides', 'atreides'));
  joinGame(lobby, newPlayer('original-e', 'Emperor', 'emperor'));
  const options = { family: 'moritani' as const, requestedSkill: 'warmaster' as const, initial: lobby };
  let game = initializeAdvancedNativeSkillsSetup(options);
  assert.deepEqual(game.players.map(p => p.id), lobby.players.map(p => p.id));
  assert.equal(game.setupStage, 'leaderSkills');
  assert.equal(game.leaderSkills!.deck.length, 8);
  assert.deepEqual(game.players.map(p => p.hand.length), [1, 1, 1]);
  assert.deepEqual(game.players.map(p => p.traitors), [[], [], []]);
  assert.equal(player(game, 'moritani').reserves, 20);
  for (const seat of game.players) {
    const own = viewGame(game, seat.id).leaderSkills!;
    assert.equal(own.offer!.cards.length, 2);
    assert.equal(own.assignments.length, 0);
    assert.equal(own.offer!.event, game.leaderSkills!.offers[seat.id].event);
  }
  for (const seat of game.players) {
    const offer = game.leaderSkills!.offers[seat.id];
    const own = viewGame(game, seat.id).leaderSkills!;
    const skill = offer.cards.find(c => !own.unavailableSkills?.[c])!;
    game = act(game, seat.id, { type: 'leaderSkill', event: offer.event, skill, leader: own.eligibleLeaders[0].id });
  }
  assert.equal(game.setupStage, 'traitors');
  assert.equal(player(game, 'moritani').reserves, 20);
  while (game.status === 'setup' && game.decision?.kind !== 'moritaniSetup') game = advancedNativeStep(game);
  assert.equal(game.decision?.kind, 'moritaniSetup');
  assert.deepEqual(game.players.map(p => p.traitors.length), [1, 1, 1]);
  game = completeAdvancedNativeSkillsSetup(game, options);
  assert.equal(game.phase, 0);
  assert.equal(player(game, 'moritani').reserves, 14);
  assert.equal(Object.values(player(game, 'moritani').forces).reduce((a, b) => a + b, 0), 6);
  assert.equal(game.moritaniAssassinate!.owner, 'original-m');
  custody(game);

  // An admitted original setup must retain its physical offers and native deck.
  const offered = initializeAdvancedNativeSkillsSetup(options);
  const continued = initializeAdvancedNativeSkillsSetup({ ...options, initial: reload(offered), requestedSkill: 'suk-graduate' });
  assert.deepEqual(continued, offered);
});

void test('all fourteen native skills assign genuine Moritani discs and all four policies consume private legal offers', () => {
  for (const card of LEADER_SKILL_CARDS) {
    const game = completedAdvancedNativeSkillsGame({ family: 'moritani', requestedSkill: card.id });
    assert.equal(trainer(game, player(game, 'moritani').id).skill, card.id);
    assert.equal(player(game, 'moritani').leaders.find(l => l.id === trainer(game, player(game, 'moritani').id).leader)!.dead, false);
    custody(game);
  }
  const offered = initializeAdvancedNativeSkillsSetup({ family: 'moritani', requestedSkill: 'warmaster' });
  const actor = player(offered, 'moritani').id;
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(reload(offered), actor);
    view.players.find(p => p.id === actor)!.bot = difficulty;
    const action = botActions(view)[0];
    assert.equal(action?.type, 'leaderSkill', difficulty);
    const selected = act(offered, actor, action);
    assert.ok(offered.leaderSkills!.offers[actor].cards.includes(trainer(selected, actor).skill));
    assert.equal(selected.leaderSkills!.offers[actor], undefined);
    assert.equal(trainer(selected, actor).leader, action.leader);
    assertAdvancedNativeCustody(selected);
  }
});

void test('native Terror kills a real trained disc, returns only its card, and eligible paid own revival offers one private optional draw', () => {
  let game = completedAdvancedNativeSkillsGame({ family: 'moritani', skillOwner: 'emperor', requestedSkill: 'warmaster' });
  const owner = player(game, 'moritani').id, actor = player(game, 'emperor').id;
  const assignment = structuredClone(trainer(game, actor));
  // Controlled leader availability makes the native random victim unambiguous;
  // no trained card, force or wallet is fabricated or removed by this staging.
  for (const leader of player(game, 'emperor').leaders) if (leader.id !== assignment.leader) {
    leader.dead = true; leader.deaths = 1;
  }
  game = placeTerror(game, 'assassination');
  const beforeEntry = reload(game);
  game = enterTerror(game, actor);
  assert.equal(player(game, 'emperor').reserves, player(beforeEntry, 'emperor').reserves - 1);
  assert.equal(player(game, 'emperor').forces['carthag:11'], 1);
  assert.equal(viewGame(game, owner).terrorEntry!.kind, 'assassination');
  assert.equal('kind' in viewGame(game, actor).terrorEntry!, false);
  const others = game.leaderSkills!.assignments.filter(a => a.owner !== actor);
  const funds = wallets(game);
  const strength = player(game, 'emperor').leaders.find(l => l.id === assignment.leader)!.strength;
  game = act(game, owner, { type: 'decision', reveal: true });
  assert.equal(player(game, 'emperor').leaders.find(l => l.id === assignment.leader)!.dead, true);
  assert.equal(game.leaderSkills!.assignments.some(a => a.owner === actor), false);
  assert.deepEqual(game.leaderSkills!.assignments, others);
  assert.equal(game.leaderSkills!.deck.filter(c => c === assignment.skill).length, 1);
  assert.deepEqual(wallets(game), { ...funds, [owner]: funds[owner] + strength });
  custody(game);
  reject(game, owner, { type: 'decision', reveal: true });

  // Explicit conserved Revival phase; retain real post-shipment money and Tanks.
  Object.assign(game, { phase: 4, active: null, ready: [], decision: null, response: null,
    phaseOpening: null, revivalRules: newRevivalRules() });
  const paidBefore = wallets(game);
  const offered = act(game, actor, { type: 'reviveLeader', leader: assignment.leader });
  assert.equal(offered.decision?.kind, 'leaderSkillRevival');
  assert.equal(player(offered, 'emperor').leaders.find(l => l.id === assignment.leader)!.dead, false);
  assert.deepEqual(wallets(offered), { ...paidBefore, [actor]: paidBefore[actor] - strength });
  assert.deepEqual(viewGame(offered, actor).leaderSkills!.offer!.cards, []);
  for (const seat of offered.players.filter(p => p.id !== actor)) assert.equal(viewGame(offered, seat.id).leaderSkills!.offer, null);
  const event = offered.leaderSkills!.offers[actor].event;
  reject(offered, owner, { type: 'leaderSkill', event, mode: 'draw' });
  reject(offered, actor, { type: 'leaderSkill', event: `${event}:stale`, mode: 'draw' });
  const declined = act(offered, actor, { type: 'leaderSkill', event, mode: 'decline' });
  assert.equal(declined.leaderSkills!.assignments.some(a => a.owner === actor), false);
  assert.equal(declined.leaderSkills!.offers[actor], undefined);
  custody(declined);
  const drawn = act(offered, actor, { type: 'leaderSkill', event, mode: 'draw' });
  const own = viewGame(drawn, actor).leaderSkills!;
  assert.equal(own.offer!.cards.length, 2);
  for (const seat of drawn.players.filter(p => p.id !== actor)) assert.equal(viewGame(drawn, seat.id).leaderSkills!.offer, null);
  const skill = own.offer!.cards.find(c => !own.unavailableSkills?.[c])!;
  const chosen = act(drawn, actor, { type: 'leaderSkill', event, skill, leader: assignment.leader });
  assert.deepEqual(trainer(chosen, actor), { owner: actor, leader: assignment.leader, skill });
  assert.deepEqual(wallets(chosen), wallets(offered));
  custody(chosen);
  reject(chosen, actor, { type: 'leaderSkill', event, skill, leader: assignment.leader });
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(reload(offered), actor);
    view.players.find(p => p.id === actor)!.bot = difficulty;
    const next = act(offered, actor, botActions(view)[0]);
    assert.deepEqual(wallets(next), wallets(offered));
    assert.equal(player(next, 'emperor').leaders.find(l => l.id === assignment.leader)!.dead, false);
    assert.ok(next.leaderSkills!.offers[actor]?.cards.length === 2 || next.leaderSkills!.offers[actor] === undefined);
    custody(next);
  }
});

void test('native Suk distinguishes one normal casualty return from the concealed three-force rescue and all four policies keep paid loss custody', () => {
  const setup = completedAdvancedNativeSkillsGame({ family: 'moritani', requestedSkill: 'suk-graduate' });
  const actor = player(setup, 'moritani').id, target = player(setup, 'emperor').id;
  for (const hidden of [false, true]) {
    let game = stageAdvancedNativeSkillBattle(setup, actor, target);
    const funds = wallets(game), reserves = player(game, 'moritani').reserves;
    const leader = player(game, 'moritani').leaders.find(l => hidden
      ? l.id === trainer(game, actor).leader : l.id !== trainer(game, actor).leader && l.strength === 4)!;
    const enemy = player(game, 'emperor').leaders.find(l => l.id !== trainer(game, target).leader)!;
    game = openAdvancedNativeSkillBattle(game, actor, target, hidden);
    game = act(game, actor, { type: 'battlePlan', dial: 5, support: 5, leader: leader.id });
    game = act(game, target, { type: 'battlePlan', dial: 0, support: 0, leader: enemy.id });
    game = finishAdvancedNativeSkillAftermath(resolve(game, actor, target));
    assert.equal(game.lastBattleContext!.winner, actor);
    assert.equal(player(game, 'moritani').spice, funds[actor] - 5);
    assert.equal(player(game, 'emperor').spice, funds[target]);
    if (hidden) {
      assert.equal(game.decision?.kind, 'sukRescue');
      if (game.decision?.kind !== 'sukRescue') throw new Error('Expected the original native rescue decision.');
      const pending = game;
      const choice = game.decision.options.findIndex(o => o.normal === 3 && o.elite === 0 && o.kept?.key === 'wind_pass:14');
      assert.ok(choice >= 0);
      reject(game, target, { type: 'decision', event: game.decision.event, choice });
      game = act(game, actor, { type: 'decision', event: game.decision.event, choice });
      assert.equal(player(game, 'moritani').tanks, 2);
      assert.equal(player(game, 'moritani').forces['wind_pass:14'], 4);
      assert.equal(player(game, 'moritani').reserves, reserves + 2);
      for (const difficulty of DIFFICULTIES) {
        const view = viewGame(reload(pending), actor);
        view.players.find(p => p.id === actor)!.bot = difficulty;
        const rescued = act(pending, actor, botActions(view)[0]);
        assert.equal(rescued.pendingSukRescue, null);
        assert.equal(player(rescued, 'moritani').tanks, 2);
        assert.equal(player(rescued, 'moritani').spice, funds[actor] - 5);
        custody(rescued);
      }
    } else {
      assert.equal(game.pendingSukRescue, null);
      assert.equal(player(game, 'moritani').tanks, 4);
      assert.equal(player(game, 'moritani').forces['wind_pass:14'], 3);
      assert.equal(player(game, 'moritani').reserves, reserves + 1);
    }
    custody(game);
  }
});

void test('native normal +1 and concealed trainer +3 change real winners while paid dials produce physical casualties and mandatory card cleanup', () => {
  const roles = [
    ['warmaster', 'worthless'], ['master-of-assassins', 'poison'], ['swordmaster-of-ginaz', 'projectile'],
    ['killer-medic', 'snooper'], ['prana-bindu-adept', 'shield'],
  ] as const;
  for (const [skill, kind] of roles) for (const hidden of [false, true]) {
    const setup = completedAdvancedNativeSkillsGame({ family: 'moritani', requestedSkill: skill });
    const actor = player(setup, 'moritani').id, target = player(setup, 'emperor').id;
    let game = stageAdvancedNativeSkillBattle(setup, actor, target);
    assert.deepEqual(wallets(game), wallets(setup));
    const role = take(game, actor, c => c.kind === kind);
    const own = player(game, 'moritani');
    const selected = hidden ? own.leaders.find(l => l.id === trainer(game, actor).leader)!
      : own.leaders.find(l => l.id !== trainer(game, actor).leader && l.strength === 4)!;
    const enemy = player(game, 'emperor').leaders.filter(l => l.id !== trainer(game, target).leader && !own.traitors.includes(l.id))
      .sort((a, b) => a.strength - b.strength)[0];
    assert.ok(enemy);
    // Opponent finishes exactly two strength above our unbonused plan: normal
    // +1 loses and trained +3 wins. Dial/support and casualties are physical.
    const lethal = kind === 'poison' || kind === 'projectile';
    const enemyDial = selected.strength + 3 - (lethal ? 0 : enemy.strength);
    assert.ok(enemyDial >= 0 && enemyDial <= 8);
    const funds = wallets(game);
    const normalEnemyRescue = !hidden && trainer(game, target).skill === 'suk-graduate' && enemyDial > 0 ? 1 : 0;
    const enemyReserves = player(game, 'emperor').reserves;
    game = openAdvancedNativeSkillBattle(game, actor, target, hidden);
    if (!hidden) reject(game, actor, { type: 'battlePlan', dial: 1, support: 1, leader: trainer(game, actor).leader, weapon: role.id });
    const slot = kind === 'snooper' || kind === 'shield' ? 'defense' : 'weapon';
    game = act(game, actor, { type: 'battlePlan', dial: 1, support: 1, leader: selected.id, [slot]: role.id });
    game = act(game, target, { type: 'battlePlan', dial: enemyDial, support: enemyDial, leader: enemy.id });
    game = finishAdvancedNativeSkillAftermath(resolve(game, actor, target));
    assert.equal(game.lastBattleContext!.result, 'normal');
    assert.equal(game.lastBattleContext!.winner, hidden ? actor : target, `${skill}/${hidden}`);
    assert.equal(player(game, 'moritani').tanks, hidden ? 1 : 8);
    assert.equal(player(game, 'moritani').forces['wind_pass:14'] ?? 0, hidden ? 7 : 0);
    assert.equal(player(game, 'emperor').tanks, hidden ? 8 : enemyDial - normalEnemyRescue);
    assert.equal(player(game, 'emperor').reserves, enemyReserves + normalEnemyRescue);
    assert.equal(player(game, 'moritani').leaders.find(l => l.id === selected.id)!.dead, false);
    assert.equal(player(game, 'emperor').leaders.find(l => l.id === enemy.id)!.dead, lethal);
    assert.equal(player(game, 'moritani').spice, funds[actor] - 1 + (hidden && lethal ? enemy.strength : 0));
    assert.equal(player(game, 'emperor').spice, funds[target] - enemyDial + (!hidden && lethal ? enemy.strength : 0));
    assert.equal(game.discard.filter(c => c.id === role.id).length, hidden ? 0 : 1);
    assert.equal(player(game, 'moritani').hand.some(c => c.id === role.id), hidden);
    custody(game);
  }
});

void test('original Enemy of My Enemy and ally retention exclude a consumed native Planetologist Special', () => {
  let game = completedAdvancedNativeSkillsGame({ family: 'moritani', skillOwner: 'emperor', requestedSkill: 'planetologist' });
  const m = player(game, 'moritani').id, actor = player(game, 'emperor').id, target = player(game, 'atreides').id;
  game = enterTerror(placeTerror(game, 'robbery'), actor);
  game = allow(act(game, m, { type: 'decision', alliance: true }));
  game = act(game, actor, { type: 'decision', accept: true });
  assert.equal(player(game, 'moritani').ally, actor);
  assert.equal(player(game, 'emperor').ally, m);
  game = stageAdvancedNativeSkillBattle(game, actor, target);
  const mandatory = take(game, actor, c => c.effect === 'atomics');
  const retained = take(game, actor, c => c.kind === 'snooper');
  const enemyDefense = take(game, target, c => c.kind === 'snooper');
  game = openAdvancedNativeSkillBattle(game, actor, target);
  game = act(game, actor, { type: 'battlePlan', dial: 0, support: 0, leader: trainer(game, actor).leader,
    weapon: mandatory.id, defense: retained.id });
  const enemy = player(game, 'atreides').leaders.find(l => l.id !== trainer(game, target).leader)!;
  game = act(game, target, { type: 'battlePlan', dial: 5, support: 5, leader: enemy.id, defense: enemyDefense.id });
  game = resolve(game, actor, target);
  for (let i = 0; game.decision?.kind !== 'moritaniRetention' && (game.response || game.decision || game.pendingTreacheryDiscard) && i < 30; i++) {
    if (game.decision?.kind === 'battleCards') game = act(game, game.decision.player, { type: 'decision', discard: [] });
    else game = advancedNativeStep(game);
  }
  assert.equal(game.lastBattleContext!.winner, target);
  assert.equal(game.decision?.kind, 'moritaniRetention');
  assert.deepEqual(game.moritaniRetention!.eligible, [retained.id]);
  assert.equal(game.discard.filter(c => c.id === mandatory.id).length, 1);
  reject(game, actor, { type: 'decision', keep: mandatory.id });
  reject(game, m, { type: 'decision', keep: retained.id });
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(reload(game), actor);
    view.players.find(p => p.id === actor)!.bot = difficulty;
    const done = allow(act(game, actor, botActions(view)[0]));
    assert.equal(done.moritaniRetention, null);
    assert.equal(done.discard.filter(c => c.id === mandatory.id).length, 1);
    custody(done);
  }
  game = allow(act(game, actor, { type: 'decision', keep: retained.id }));
  assert.equal(game.moritaniRetention, null);
  assert.equal(player(game, 'emperor').hand.some(c => c.id === retained.id), true);
  custody(game);
  assert.deepEqual(normalizeAutomaticGame(reload(game)), game);
});

void test('new native admission preserves public, Harkonnen assassination, foreign family/module and Advanced Atreides Suk boundaries', () => {
  const make = (faction: 'atreides' | 'harkonnen' | 'ixians' | 'ecaz' = 'atreides', expansions: Game['expansions'] = ['ecaz']) => {
    const game = createGame('MORIGATE', newPlayer('original-m', 'Moritani', 'moritani'), true, expansions);
    joinGame(game, newPlayer('original-other', faction, faction));
    return game;
  };
  reject(make(), 'original-m', { type: 'start' });
  for (const game of [make('harkonnen'), make('ixians', ['ecaz', 'ix']), make('ecaz'), make('atreides', ['ecaz', 'choam'])]) {
    game.players.forEach(p => { p.ready = true; });
    const before = reload(game);
    assert.throws(() => initializeLeaderSkillsGameForAudit(game));
    assert.deepEqual(game, before);
  }
  const discoveryLobby = make();
  discoveryLobby.players.forEach(p => { p.ready = true; });
  discoveryLobby.discoveryEnabled = true;
  assert.throws(() => initializeLeaderSkillsGameForAudit(discoveryLobby));
  // Basic Moritani keeps its original Harkonnen-compatible skills profile; it
  // does not acquire the Advanced-only assassination preview.
  const basicLobby = make('harkonnen');
  basicLobby.advanced = false;
  basicLobby.players.forEach(p => { p.ready = true; });
  const basic = completeAdvancedNativeSkillsSetup(initializeLeaderSkillsGameForAudit(basicLobby), { family: 'moritani' });
  assert.equal(basic.advanced, false);
  assert.equal(basic.moritaniAssassinatePreview, undefined);
  assert.equal(player(basic, 'harkonnen').traitors.length, 4);
  assert.equal(trainer(basic, 'original-m').owner, 'original-m');
  custody(basic);
  const options = { family: 'moritani' as const, skillOwner: 'atreides' as const, requestedSkill: 'suk-graduate' as const };
  const offered = initializeAdvancedNativeSkillsSetup(options);
  const actor = player(offered, 'atreides').id, offer = offered.leaderSkills!.offers[actor];
  const own = viewGame(offered, actor).leaderSkills!;
  reject(offered, actor, { type: 'leaderSkill', event: offer.event, skill: 'suk-graduate', leader: own.eligibleLeaders[0].id });
  const complete = completeAdvancedNativeSkillsSetup(offered, options);
  assert.notEqual(trainer(complete, actor).skill, 'suk-graduate');
  assert.ok(complete.leaderSkills!.deck.includes('suk-graduate'));
  custody(complete);
});
