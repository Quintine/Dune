import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, normalizeAutomaticGame, viewGame, type Action, type Game } from '../game/engine';
import { baseDeck, type Card } from '../game/cards';
import { validateLeaderSkills } from '../game/leader-skills';
import type { LeaderSkillId } from '../game/leader-skill-cards';
import {
  completedMoritaniSkillsGame,
  assertMoritaniSkillsCustody,
  moritaniSkillsPlayer as player,
  reloadMoritaniSkillsGame as reload,
  rejectMoritaniSkillsAction as reject,
  placeMoritaniSkillsTerror,
  enterMoritaniSkillsTerror,
} from './moritani-skills-fixture';

const act = (g: Game, owner: string, action: Action) => applyAction(reload(g), owner, action);

function conserved(g: Game) {
  assertMoritaniSkillsCustody(g);
  validateLeaderSkills(g.leaderSkills!, g.players);
  const cards = [...g.deck, ...g.discard, ...g.players.flatMap(p => p.hand)].map(c => c.id);
  assert.deepEqual(cards.sort(), baseDeck().map(c => c.id).sort());
  for (const p of g.players)
    assert.equal(p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0), 20);
  const traitors = [...g.traitorReserve!, ...g.players.flatMap(p => p.traitors)];
  assert.equal(traitors.length, 15);
  assert.equal(new Set(traitors).size, 15);
  assert.deepEqual(normalizeAutomaticGame(reload(g)), g);
}

function take(g: Game, owner: string, predicate: (card: Card) => boolean) {
  const index = g.deck.findIndex(predicate);
  assert.ok(index >= 0, 'The staged card must come from the existing physical deck.');
  const [card] = g.deck.splice(index, 1);
  player(g, owner).hand.push(card);
  return card;
}

function allow(g: Game): Game {
  for (let i = 0; g.response && i < 20; i++) {
    const responder = g.players.find(p => !g.response!.passed.includes(p.id));
    assert.ok(responder);
    g = act(g, responder.id, { type: 'passResponse' });
  }
  assert.equal(g.response, null);
  return g;
}

/** The alliance is produced by real Terror placement, shipment, offer and reply. */
function alliedSetup(skill: LeaderSkillId): Game {
  let g = completedMoritaniSkillsGame({ requestedSkill: skill, skillOwner: 'emperor' });
  g = placeMoritaniSkillsTerror(g, 'robbery');
  g = enterMoritaniSkillsTerror(g, 'e');
  g = allow(act(g, 'm', { type: 'decision', alliance: true }));
  g = act(g, 'e', { type: 'decision', accept: true });
  assert.equal(player(g, 'm').ally, 'e');
  assert.equal(player(g, 'e').ally, 'm');
  return g;
}

/** After genuine setup, stage conserved armies/hands, then choose the battle normally. */
function stageBattle(g: Game, owner = 'm', opponent = 'e'): Game {
  for (const p of g.players) {
    g.deck.push(...p.hand);
    p.hand = [];
    p.forces = [owner, opponent].includes(p.id)
      ? { 'wind_pass:14': 5, 'carthag:11': 1 }
      : { 'polar_sink:0': 1 };
    p.reserves = [owner, opponent].includes(p.id) ? 14 : 19;
    p.tanks = 0;
    p.spice = 20;
  }
  Object.assign(g, { phase: 6, storm: 18, order: [owner, opponent, ...g.players.map(p => p.id).filter(id => id !== owner && id !== opponent)],
    active: owner, ready: [], decision: null, response: null, phaseOpening: null, spice: {} });
  // The second unresolved battle prevents automatic Spice Collection from
  // obscuring this battle's own board-spice and income results.
  return g;
}

function openBattle(state: Game, owner = 'm', opponent = 'e', hide = true): Game {
  let g = act(state, owner, { type: 'chooseBattle', territory: 'wind_pass', target: opponent });
  for (let i = 0; i < 20; i++) {
    g = allow(g);
    if (g.decision?.kind === 'leaderSkillVisibility') {
      const d = g.decision;
      g = act(g, d.player, { type: 'leaderSkillVisibility', event: d.event, hide: d.player === owner ? hide : true });
    } else if (g.decision?.kind === 'mentatQuestion' || g.decision?.kind === 'fullPlanOffer') {
      g = act(g, g.decision.player, { type: 'decision', decline: true });
    } else if (g.battle?.preparation) {
      g = act(g, g.battle.preparation.owner, { type: 'declineBattlePower' });
    } else break;
  }
  assert.ok(g.battle);
  assert.equal(g.decision, null);
  assert.ok(!g.battle.preparation);
  return g;
}

function reveal(g: Game, own: Partial<Action> = {}, other: Partial<Action> = {}, owner = 'm', opponent = 'e'): Game {
  g = act(g, owner, { type: 'battlePlan', dial: 4, leader: player(g, owner).leaders[0].id, ...own });
  return act(g, opponent, { type: 'battlePlan', dial: 0, leader: player(g, opponent).leaders[1].id, ...other });
}

function resolve(g: Game, owner = 'm', opponent = 'e'): Game {
  g = act(g, owner, { type: 'traitorCall', call: false });
  return act(g, opponent, { type: 'traitorCall', call: false });
}

void test('Basic Moritani Rihani completes its private peek and actual exchange across saved decisions', () => {
  const setup = completedMoritaniSkillsGame({ requestedSkill: 'rihani-decipherer' });
  let g = resolve(reveal(openBattle(stageBattle(setup))));
  const receipt = g.rihaniHistory!.at(-1)!;
  assert.equal(g.decision?.kind, 'rihani');
  assert.equal(receipt.owner, 'm');
  assert.equal(receipt.peeked.length, 2);
  assert.equal(receipt.drawn.length, 0);
  assert.equal(viewGame(g, 'm').rihani!.history.at(-1)!.peeked.length, 2);
  assert.deepEqual(viewGame(g, 'e').rihani!.history, []);
  assert.deepEqual(viewGame(g, 'a').rihani!.history, []);
  conserved(g);
  reject(g, 'e', { type: 'decision', event: receipt.event, draw: true });
  g = act(g, 'm', { type: 'decision', event: receipt.event, draw: true });
  const drawn = g.rihaniHistory!.at(-1)!;
  assert.equal(drawn.drawn.length, 2);
  g = act(g, 'm', { type: 'decision', event: drawn.event, cards: [drawn.drawn[0], drawn.eligible[0]] });
  assert.equal(player(g, 'm').traitors.length, 1);
  assert.ok(player(g, 'm').traitors.includes(drawn.drawn[0]));
  assert.ok(g.traitorReserve!.includes(drawn.eligible[0]));
  assert.ok(g.traitorReserve!.includes(drawn.drawn[1]));
  assert.equal(g.lastBattleContext?.rihani?.completed, true);
  conserved(g);
  reject(g, 'm', { type: 'decision', event: drawn.event, cards: [drawn.drawn[0], drawn.eligible[0]] });
});

void test('Basic Moritani Sandmaster adds board spice once and Banker spends its separately committed spice', () => {
  for (const skill of ['sandmaster', 'spice-banker'] as const) {
    const staged = stageBattle(completedMoritaniSkillsGame({ requestedSkill: skill }));
    staged.spice = { 'wind_pass:14': 2 };
    let g = openBattle(staged);
    const printed = player(g, 'm').leaders[0].strength;
    g = resolve(reveal(g, skill === 'spice-banker' ? { bankerSpice: 3 } : {}));
    assert.equal(g.lastBattleContext?.winner, 'm');
    assert.equal(g.spice['wind_pass:14'], skill === 'sandmaster' ? 5 : 2);
    assert.equal(player(g, 'm').spice, skill === 'spice-banker' ? 17 : 20);
    assert.equal(player(g, 'm').leaders[0].strength, printed);
    if (skill === 'sandmaster') assert.ok(g.lastBattleContext?.sandmaster);
    else assert.ok(g.log.some(l => l.text.includes('gained 3 battle strength from Spice Banker')));
    conserved(g);
    reject(g, 'e', { type: 'traitorCall', call: false });
  }
});

void test('Basic Moritani Suk saves three actual casualties and completes its saved choice once', () => {
  let g = resolve(reveal(openBattle(stageBattle(completedMoritaniSkillsGame({ requestedSkill: 'suk-graduate' })))));
  const decision = g.decision;
  assert.equal(decision?.kind, 'sukRescue');
  if (decision?.kind !== 'sukRescue') throw new Error('Expected the real Suk rescue choice.');
  assert.equal(player(g, 'm').tanks, 0);
  const choice = decision.options.findIndex(o => o.normal === 3 && o.elite === 0 && o.kept?.kind === 'normal');
  assert.ok(choice >= 0);
  conserved(g);
  reject(g, 'e', { type: 'decision', event: decision.event, choice });
  g = act(g, 'm', { type: 'decision', event: decision.event, choice });
  assert.equal(player(g, 'm').tanks, 1);
  assert.equal(player(g, 'm').reserves, 16);
  assert.equal(player(g, 'm').forces['wind_pass:14'], 2);
  assert.equal(g.lastBattleContext?.sukRescue?.completed, true);
  conserved(g);
  reject(g, 'm', { type: 'decision', event: decision.event, choice });
});

void test('Basic Moritani Smuggler freezes public collection and pays its surviving native disc once', () => {
  const staged = stageBattle(completedMoritaniSkillsGame({ requestedSkill: 'smuggler' }));
  staged.spice = { 'wind_pass:14': 8 };
  let g = reveal(openBattle(staged));
  const strength = player(g, 'm').leaders[0].strength;
  assert.equal(g.battle!.smugglerCollection!.amount, strength);
  assert.equal(player(g, 'm').spice, 20);
  assert.equal(g.spice['wind_pass:14'], 8);
  conserved(g);
  g = resolve(g);
  assert.equal(player(g, 'm').spice, 20 + strength);
  assert.equal(g.spice['wind_pass:14'], 8 - strength);
  assert.equal(g.lastBattleContext?.smugglerCollection?.stage, 'collected');
  conserved(g);
  reject(g, 'e', { type: 'traitorCall', call: false });
});

void test('Moritani ally retention excludes the used Planetologist Special and the actual Diplomat copy', () => {
  for (const skill of ['planetologist', 'diplomat'] as const) {
    const staged = stageBattle(alliedSetup(skill), 'e', 'a');
    const mandatory = take(staged, 'e', c => skill === 'planetologist' ? c.effect === 'atomics' : c.kind === 'worthless');
    const retained = take(staged, 'e', c => skill === 'planetologist' ? c.kind === 'snooper' : c.kind === 'worthless');
    const enemyDefense = take(staged, 'a', c => c.kind === 'snooper');
    const enemyWeapon = skill === 'diplomat' ? take(staged, 'a', c => c.kind === 'poison') : undefined;
    let g = openBattle(staged, 'e', 'a', skill === 'planetologist');
    const ownLeader = player(g, 'e').leaders[skill === 'planetologist' ? 0 : 1].id;
    g = reveal(g, { dial: 0, leader: ownLeader, weapon: mandatory.id, defense: retained.id },
      { dial: 5, weapon: enemyWeapon?.id, defense: enemyDefense.id }, 'e', 'a');
    if (skill === 'diplomat') {
      const d = g.decision;
      assert.equal(d?.kind, 'diplomatDefense');
      if (d?.kind !== 'diplomatDefense') throw new Error('Expected the actual copied-defense choice.');
      g = act(g, 'e', { type: 'decision', event: d.event, card: mandatory.id });
      assert.equal(g.battle!.diplomatDefense!.card, mandatory.id);
      assert.equal(player(g, 'e').hand.find(c => c.id === mandatory.id)!.kind, 'worthless');
    }
    g = resolve(g, 'e', 'a');
    assert.equal(g.lastBattleContext?.winner, 'a');
    // Winner card cleanup precedes the losing ally's separate retention choice.
    if (g.decision?.kind === 'battleCards')
      g = act(g, g.decision.player, { type: 'decision', discard: [] });
    assert.equal(g.decision?.kind, 'moritaniRetention');
    assert.deepEqual(g.moritaniRetention!.eligible, [retained.id]);
    assert.ok(!g.moritaniRetention!.played.includes(mandatory.id));
    assert.equal(g.discard.filter(c => c.id === mandatory.id).length, 1);
    assert.equal(player(g, 'e').leaders.find(l => l.id === ownLeader)!.dead, false);
    conserved(g);
    reject(g, 'e', { type: 'decision', keep: mandatory.id });
    reject(g, 'm', { type: 'decision', keep: retained.id });
    g = allow(act(g, 'e', { type: 'decision', keep: retained.id }));
    assert.ok(player(g, 'e').hand.some(c => c.id === retained.id));
    assert.equal(g.discard.filter(c => c.id === mandatory.id).length, 1);
    assert.equal(g.moritaniRetention, null);
    conserved(g);
    reject(g, 'e', { type: 'decision', keep: retained.id });
  }
});
