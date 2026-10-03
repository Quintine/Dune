import assert from 'node:assert/strict';
import { applyAction, createGame, joinGame, newPlayer, type Action, type Game } from '../game/engine';
import { TERRITORIES, splitLocation } from '../game/board';
import type { Card } from '../game/cards';
import { ownedTech } from '../game/tech-tokens';
import {
  initializeAdvancedNativeSkillsSetup, completeAdvancedNativeSkillsSetup,
  advancedNativePlayer, type AdvancedNativeSkillsOptions,
} from './fixture-advanced-native-skills';
import { nextSkillsTechBattleStep, openSkillsTechBattle } from './fixture-skills-tech-battle';

export type TleilaxuSkillsTechOptions = {
  /** Fresh authenticated, undealt original lobby; preserve its IDs and order. */
  initial?: Game;
  advanced?: boolean;
  winner?: 'guild' | 'ixians';
  skill?: 'suk-graduate' | 'rihani-decipherer';
  winnerDies?: boolean;
};
export type TleilaxuSkillsTechStep = { actor: string; action: Action };
export type TleilaxuSkillsTechFixture = {
  initial: Game;
  afterSetup: Game;
  beforePlans: Game;
  revealed: Game;
  skillChoice: Game | null;
  winnerCards: Game;
  faceDance: Game;
  actions: TleilaxuSkillsTechStep[];
  winner: string;
  tleilaxu: string;
  winnerLeader: string;
  loserLeader: string;
  territory: string;
  location: string;
  sector: number;
  boardSource: string;
  weapon: string;
  defense: string;
  loserCard: string;
  skill: 'suk-graduate' | 'rihani-decipherer';
  winnerDies: boolean;
  ownerPlan: Action;
  opponentPlan: Action;
  faceDanceAction: Action;
};

export const tleilaxuSkillsTechPlayer = (game: Game, id: string) => {
  const player = game.players.find(p => p.id === id);
  assert.ok(player);
  return player;
};
export function tleilaxuSkillsTechForces(game: Game, id: string, territory: string): number {
  return Object.entries(tleilaxuSkillsTechPlayer(game, id).forces)
    .filter(([key]) => splitLocation(key).territory === territory).reduce((sum, [, count]) => sum + count, 0);
}
export function nextTleilaxuSkillsTechStep(game: Game): TleilaxuSkillsTechStep {
  if (game.decision?.kind === 'rihani') {
    assert.equal(game.decision.stage, 'offer');
    return { actor: game.decision.player, action: { type: 'decision', event: game.decision.event, draw: false } };
  }
  if (game.decision?.kind === 'ixSubstitution')
    return { actor: game.decision.player, action: { type: 'decision', decline: true } };
  if (game.decision?.kind === 'sukRescue') {
    const decision = game.decision;
    const maximum = Math.max(...decision.options.map(o => o.normal + o.elite));
    return { actor: decision.player, action: { type: 'decision', event: decision.event,
      choice: decision.options.findIndex(o => o.normal + o.elite === maximum) } };
  }
  return nextSkillsTechBattleStep(game);
}
function step(game: Game, actions?: TleilaxuSkillsTechStep[]): Game {
  const next = nextTleilaxuSkillsTechStep(game);
  actions?.push(next);
  return applyAction(game, next.actor, next.action);
}
/** Original transitions only. Empty Battle is allowed to skip into Collection. */
export function advanceTleilaxuSkillsTechToPhase(state: Game, target: number): Game {
  let game = state;
  for (let i = 0; (game.phase < target || game.phaseOpening || game.response || game.decision)
    && game.turn === state.turn && i < 1000; i++) game = step(game);
  assert.equal(game.turn, state.turn);
  assert.ok(game.phase >= target && !game.phaseOpening && !game.response && !game.decision);
  return game;
}
function setup(options: TleilaxuSkillsTechOptions) {
  const faction = options.winner ?? 'guild';
  let initial = options.initial ? structuredClone(options.initial)
    : createGame('TLEISKILLTECH', newPlayer(faction, faction, faction), options.advanced ?? true, ['ix']);
  if (!options.initial) {
    joinGame(initial, newPlayer('tleilaxu', 'Tleilaxu', 'tleilaxu'));
    joinGame(initial, newPlayer('emperor', 'Emperor', 'emperor'));
  }
  assert.equal(initial.status, 'lobby');
  assert.ok(initial.players.length >= 3 && initial.players.length <= 6);
  assert.equal(new Set(initial.players.map(p => p.faction)).size, initial.players.length);
  assert.deepEqual(initial.expansions, ['ix']);
  if (options.advanced !== undefined) assert.equal(initial.advanced, options.advanced);
  advancedNativePlayer(initial, faction);
  advancedNativePlayer(initial, 'tleilaxu');
  const original = structuredClone(initial);
  if (!initial.techTokens) initial = applyAction(initial, initial.host, { type: 'techTokens', enabled: true });
  const native: AdvancedNativeSkillsOptions = { family: 'tleilaxu', skillOwner: faction,
    requestedSkill: options.skill ?? 'suk-graduate', rules: initial.advanced ? 'advanced' : 'basic', initial };
  const game = completeAdvancedNativeSkillsSetup(initializeAdvancedNativeSkillsSetup(native), native);
  return { initial: original, game };
}
function held(game: Game, id: string, matches: (card: Card) => boolean): string {
  const index = game.deck.findIndex(matches);
  assert.ok(index >= 0, 'An original physical card must remain available.');
  const card = game.deck.splice(index, 1)[0];
  tleilaxuSkillsTechPlayer(game, id).hand.push(card);
  return card.id;
}
/** Conserved physical Face Dancer/Traitor exchange, not a natural draw claim. */
function matchingFaceDancer(game: Game, owner: string, leader: string) {
  const cards = tleilaxuSkillsTechPlayer(game, owner).faceDancers!;
  if (cards.some(card => card.leader === leader && !card.revealed)) return;
  const dancer = cards.find(card => !card.revealed)!;
  assert.ok(dancer);
  const reserveIndex = game.traitorReserve!.indexOf(leader);
  if (reserveIndex >= 0) game.traitorReserve![reserveIndex] = dancer.leader;
  else {
    const holder = game.players.find(p => p.traitors.includes(leader));
    assert.ok(holder, 'Matching original physical Traitor must have a real custodian.');
    holder.traitors[holder.traitors.indexOf(leader)] = dancer.leader;
  }
  dancer.leader = leader;
}

/** Genuine native setup and phase transitions, with explicitly controlled
 * conserved board/cards/Face Dancer custody at Shipment. No wallet, phase,
 * plan, receipt, token owner, or played-game retrofit is assigned. */
export function createTleilaxuSkillsTechFixture(options: TleilaxuSkillsTechOptions = {}): TleilaxuSkillsTechFixture {
  const { initial, game: started } = setup(options);
  const afterSetup = structuredClone(started);
  let game = advanceTleilaxuSkillsTechToPhase(started, 5);
  const winner = advancedNativePlayer(game, options.winner ?? 'guild').id;
  const tleilaxu = advancedNativePlayer(game, 'tleilaxu').id;
  assert.equal(game.techTokens!.axlotl.owner, tleilaxu, 'Original printed native owner is the reward donor.');
  assert.deepEqual(ownedTech(game.techTokens, tleilaxu), ['axlotl']);
  const skill = options.skill ?? 'suk-graduate';
  const winnerDies = options.winnerDies ?? false;
  const winnerLeader = game.leaderSkills!.assignments.find(a => a.owner === winner && a.skill === skill)!.leader;
  const trained = new Set(game.leaderSkills!.assignments.map(a => a.leader));
  const loserLeader = tleilaxuSkillsTechPlayer(game, tleilaxu).leaders
    .filter(l => !l.dead && !trained.has(l.id)).sort((a, b) => a.strength - b.strength)[0].id;
  const sites = TERRITORIES.filter(t => t.type === 'sand' && !t.sectors.includes(game.storm)
    && !Object.keys(game.spice).some(key => splitLocation(key).territory === t.id && game.spice[key] > 0));
  assert.ok(sites.length >= 2);
  const territory = sites[0].id, sector = sites[0].sectors[0], location = `${territory}:${sector}`;
  const boardSource = `${sites[1].id}:${sites[1].sectors[0]}`;
  for (const p of game.players) {
    game.deck.push(...p.hand); p.hand = [];
    p.reserves += Object.values(p.forces).reduce((sum, n) => sum + n, 0); p.forces = {};
    if (p.elites) {
      p.elites.reserves += Object.values(p.elites.forces).reduce((sum, n) => sum + n, 0);
      p.elites.forces = {};
    }
    if (p.advisors) p.advisors = {};
  }
  for (const id of [winner, tleilaxu]) {
    const p = tleilaxuSkillsTechPlayer(game, id);
    assert.ok(p.reserves - (p.elites?.reserves ?? 0) >= 8);
    p.reserves -= 8; p.forces[location] = 8;
  }
  if (tleilaxuSkillsTechPlayer(game, winner).faction === 'ixians') {
    const ix = tleilaxuSkillsTechPlayer(game, winner);
    ix.elites!.reserves -= 2;
    ix.elites!.forces[location] = 2;
  }
  const dancers = tleilaxuSkillsTechPlayer(game, tleilaxu);
  dancers.reserves -= 3; dancers.forces[boardSource] = 3;
  matchingFaceDancer(game, tleilaxu, winnerLeader);
  const weapon = held(game, winner, c => c.kind === 'projectile');
  const defense = held(game, winner, c => c.kind === 'shield');
  const loserCard = held(game, tleilaxu, c => c.kind === (winnerDies ? 'poison' : 'worthless'));
  game = advanceTleilaxuSkillsTechToPhase(game, 6);
  assert.equal(game.phase, 6);
  game = openSkillsTechBattle(game, winner, tleilaxu, territory, true);
  const beforePlans = structuredClone(game);
  const ixWinner = tleilaxuSkillsTechPlayer(game, winner).faction === 'ixians';
  const ownerPlan: Action = { type: 'battlePlan', leader: winnerLeader, dial: game.advanced && ixWinner ? 5 : 4,
    support: game.advanced ? ixWinner ? 1 : 4 : 0, weapon, defense };
  const opponentPlan: Action = { type: 'battlePlan', leader: loserLeader, dial: 0, support: 0, weapon: loserCard };
  game = applyAction(game, winner, ownerPlan);
  game = applyAction(game, tleilaxu, opponentPlan);
  const revealed = structuredClone(game), actions: TleilaxuSkillsTechStep[] = [];
  let skillChoice: Game | null = null, winnerCards: Game | null = null;
  for (let i = 0; game.decision?.kind !== 'faceDance' && i < 200; i++) {
    if (game.decision?.kind === 'sukRescue' || game.decision?.kind === 'rihani') skillChoice = structuredClone(game);
    if (game.decision?.kind === 'battleCards') {
      assert.equal(game.decision.player, winner);
      winnerCards = structuredClone(game);
      const next: TleilaxuSkillsTechStep = { actor: winner, action: { type: 'decision', discard: [defense] } };
      actions.push(next); game = applyAction(game, next.actor, next.action);
    } else game = step(game, actions);
  }
  assert.ok(winnerCards, 'Original winner card cleanup must precede Tech and Face Dance.');
  assert.equal(game.decision?.kind, 'faceDance');
  assert.equal(game.techTokens!.axlotl.owner, winner);
  const faceDanceAction: Action = { type: 'decision', reveal: true, sources: { reserves: 1, [boardSource]: 2 }, sector };
  return { initial, afterSetup, beforePlans, revealed, skillChoice, winnerCards, faceDance: game, actions,
    winner, tleilaxu, winnerLeader, loserLeader, territory, location, sector, boardSource,
    weapon, defense, loserCard, skill, winnerDies, ownerPlan, opponentPlan, faceDanceAction };
}

export type TleilaxuSkillsTechRevivalFixture = {
  game: Game; tleilaxu: string; other: string; nativeTrainer: string; foreignLeader: string;
  ownFreeAction: Action; otherFreeAction: Action; foreignGholaAction: Action;
};
/** Original Revival boundary. Only conserved reserve->Tanks counters and two
 * untrained original discs' dead states are controlled, never funding. The
 * native dead disc makes genuine room in Tleilaxu's five-leader active pool. */
export function createTleilaxuSkillsTechRevivalFixture(options: Pick<TleilaxuSkillsTechOptions, 'initial' | 'advanced'> = {}): TleilaxuSkillsTechRevivalFixture {
  const { game: started } = setup({ ...options, winner: 'guild' });
  const game = advanceTleilaxuSkillsTechToPhase(started, 4);
  const tleilaxu = advancedNativePlayer(game, 'tleilaxu').id;
  const other = advancedNativePlayer(game, 'guild').id;
  for (const id of [tleilaxu, other]) {
    const p = tleilaxuSkillsTechPlayer(game, id);
    assert.ok(p.reserves >= 1); p.reserves--; p.tanks++;
  }
  const trained = new Set(game.leaderSkills!.assignments.map(a => a.leader));
  const foreign = advancedNativePlayer(game, 'emperor').leaders.filter(l => !trained.has(l.id))
    .sort((a, b) => a.strength - b.strength)[0];
  assert.ok(foreign); foreign.dead = true; foreign.deaths++;
  const ownDead = advancedNativePlayer(game, 'tleilaxu').leaders.find(l => !trained.has(l.id));
  assert.ok(ownDead); ownDead.dead = true; ownDead.deaths++;
  const nativeTrainer = game.leaderSkills!.assignments.find(a => a.owner === tleilaxu)!.leader;
  return { game, tleilaxu, other, nativeTrainer, foreignLeader: foreign.id,
    ownFreeAction: { type: 'revive', amount: 1 }, otherFreeAction: { type: 'revive', amount: 1 },
    foreignGholaAction: { type: 'reviveForeignGhola', leader: foreign.id } };
}
export function settleTleilaxuSkillsTechRevival(state: Game): Game {
  let game = state;
  for (let i = 0; (game.response || game.decision || game.pendingRevival) && i < 100; i++) game = step(game);
  assert.ok(!game.response && !game.decision && !game.pendingRevival);
  return game;
}
