import assert from 'node:assert/strict';
import { applyAction, createGame, initializeSemutaGameForAudit, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import type { Difficulty } from '../game/bot-profiles';
import type { Card } from '../game/cards';

export type SemutaMoritaniStep = { actor: string; action: Action };
export type SemutaMoritaniOptions = { winnerMandatory?: boolean; karamaHolder?: 'r' | 'm' | 'w' | 'l'; semutaHolder?: 'r' | 'l' };
export type SemutaMoritaniFixture = {
  game: Game; semuta: string; weapon: string; defense: string;
  winnerWeapon: string; winnerDefense: string; winnerHero: string | null;
  unrelated: string; karama: string | null; cards: string[];
  loserLeader: string; loserStrength: number; winnerLeader: string;
};
export const semutaMoritaniReload = (game: Game): Game => JSON.parse(JSON.stringify(game));
export function semutaMoritaniPlayer(game: Game, id: string) {
  const player = game.players.find(p => p.id === id); assert.ok(player); return player;
}
export function semutaMoritaniInventory(game: Game) {
  const cards = [...game.deck, ...game.discard, ...(game.richeseCache ?? []), ...game.players.flatMap(p => p.hand)].map(c => c.id).sort();
  assert.equal(new Set(cards).size, cards.length); return cards;
}
export function semutaMoritaniResources(game: Game) {
  return game.players.map(({ id, spice, reserves, tanks, forces, leaders, ally }) => ({
    id, spice, reserves, tanks, forces, leaders, ally,
  }));
}
export function semutaMoritaniAct(game: Game, step: SemutaMoritaniStep, actions?: SemutaMoritaniStep[]) {
  actions?.push(structuredClone(step)); return applyAction(game, step.actor, step.action);
}
export function semutaMoritaniPolicy(game: Game, actor: string, difficulty: Difficulty) {
  const view = viewGame(game, actor), player = view.players.find(p => p.id === actor); assert.ok(player); player.bot = difficulty;
  return botActions(view);
}

/** Genuine Basic Richese/Moritani + classic opponents; no optional modules. */
export function initializeSemutaMoritaniRetentionGame(): Game {
  let game = createGame('SEMUTAMORITANI', newPlayer('r', 'Richese', 'richese'), false, ['choam', 'ecaz']);
  joinGame(game, newPlayer('m', 'Moritani', 'moritani'));
  joinGame(game, newPlayer('w', 'Emperor', 'emperor'));
  joinGame(game, newPlayer('l', 'Guild', 'guild'));
  for (const player of game.players) { player.bot = 'Medium'; player.ready = true; }
  game = initializeSemutaGameForAudit(game);
  for (let step = 0; game.status === 'setup' && step < 160; step++) {
    let next: SemutaMoritaniStep | undefined;
    for (const player of game.players) {
      const action = botActions(viewGame(game, player.id))[0];
      if (action) { next = { actor: player.id, action }; break; }
    }
    assert.ok(next, 'Native original setup must offer a legal continuation.');
    game = semutaMoritaniAct(game, next);
  }
  assert.equal(game.status, 'playing'); assert.equal(game.phase, 0);
  assert.equal(game.advanced, false); assert.deepEqual(game.expansions, ['choam', 'ecaz']);
  assert.ok(game.moritaniTerror); assert.equal(game.moritaniAssassinate == null, true);
  assert.equal(game.techTokens == null, true); assert.equal(game.leaderSkills == null, true);
  assert.equal(game.strongholdCards == null, true); assert.equal(game.homeworlds == null, true);
  assert.equal(game.nexusCards?.cards == null, true); assert.equal(game.ecazTreachery == null, true);
  return game;
}

/** Later reciprocal alliance and conserved physical battle are explicitly staged,
 * not asserted to have arisen naturally in the original setup. */
export function semutaMoritaniRetentionFixture(options: SemutaMoritaniOptions = {}): SemutaMoritaniFixture {
  const game = initializeSemutaMoritaniRetentionGame();
  game.deck.push(...game.players.flatMap(p => p.hand));
  for (const player of game.players) player.hand = [];
  const take = (predicate: (card: Card) => boolean): Card => {
    for (const zone of [game.deck, game.discard, game.richeseCache!]) {
      const index = zone.findIndex(predicate); if (index >= 0) return zone.splice(index, 1)[0];
    }
    throw Error('Missing physical original fixture card.');
  };
  const hold = (owner: string, predicate: (card: Card) => boolean) => {
    const card = take(predicate); semutaMoritaniPlayer(game, owner).hand.push(card);
    return card.id;
  };
  const semuta = hold(options.semutaHolder ?? 'r', c => c.id === SEMUTA_DRUG_ID);
  const weapon = hold('l', c => c.kind === 'projectile'), defense = hold('l', c => c.kind === 'snooper');
  const unrelated = hold('l', c => c.kind === 'worthless');
  const winnerWeapon = hold('w', c => c.kind === 'projectile'), winnerDefense = hold('w', c => c.kind === 'shield');
  const winnerHero = options.winnerMandatory ? hold('w', c => c.kind === 'hero') : null;
  const karama = options.karamaHolder ? hold(options.karamaHolder, c => c.effect === 'karama') : null;
  for (const player of game.players) {
    player.reserves += Object.values(player.forces).reduce((sum, count) => sum + count, 0);
    player.forces = {};
    assert.equal(player.tanks, 0); assert.equal(player.reserves, 20);
  }
  for (const id of ['w', 'l']) {
    const player = semutaMoritaniPlayer(game, id); player.reserves -= 5; player.forces['arrakeen:10'] = 5;
  }
  semutaMoritaniPlayer(game, 'm').ally = 'l'; semutaMoritaniPlayer(game, 'l').ally = 'm';
  Object.assign(game, { turn: 2, phase: 6, storm: 18, active: 'w', order: ['w', 'l', 'm', 'r'],
    ready: [], response: null, decision: null, phaseOpening: null, stormPending: null, movementRemaining: [] });
  const winnerLeader = semutaMoritaniPlayer(game, 'w').leaders.reduce((best, leader) => leader.strength > best.strength ? leader : best).id;
  const loser = semutaMoritaniPlayer(game, 'l').leaders[0];
  return { game, semuta, weapon, defense, winnerWeapon, winnerDefense, winnerHero,
    unrelated, karama, cards: semutaMoritaniInventory(game), winnerLeader,
    loserLeader: loser.id, loserStrength: loser.strength };
}

export function resolveSemutaMoritaniBattle(f: SemutaMoritaniFixture, actions?: SemutaMoritaniStep[]): Game {
  let game = semutaMoritaniAct(f.game, { actor: 'w', action: { type: 'chooseBattle', territory: 'arrakeen', target: 'l' } }, actions);
  for (let step = 0; step < 40; step++) {
    if (game.response) game = semutaMoritaniAct(game, { actor: game.players.find(p => !game.response!.passed.includes(p.id))!.id, action: { type: 'passResponse' } }, actions);
    else if (game.battle?.preparation) game = semutaMoritaniAct(game, { actor: game.battle.preparation.owner, action: { type: 'declineBattlePower' } }, actions);
    else if (game.decision?.kind === 'fullPlanOffer') game = semutaMoritaniAct(game, { actor: game.decision.player, action: { type: 'decision', decline: true } }, actions);
    else break;
  }
  assert.ok(game.battle?.preLeader);
  for (const actor of ['w', 'l']) game = semutaMoritaniAct(game, { actor, action: { type: 'battlePreparationReady', event: game.battle!.preLeader!.event } }, actions);
  game = semutaMoritaniAct(game, { actor: 'w', action: { type: 'battlePlan', dial: 2, support: 0,
    leader: f.winnerHero ?? f.winnerLeader, weapon: f.winnerWeapon, defense: f.winnerDefense } }, actions);
  game = semutaMoritaniAct(game, { actor: 'l', action: { type: 'battlePlan', dial: 0, support: 0,
    leader: f.loserLeader, weapon: f.weapon, defense: f.defense } }, actions);
  for (const actor of ['w', 'l']) game = semutaMoritaniAct(game, { actor, action: { type: 'traitorCall', call: false } }, actions);
  return game;
}
export function passSemutaMoritaniDiscard(game: Game, actions?: SemutaMoritaniStep[]): Game {
  const event = game.pendingTreacheryDiscard!.batch.event;
  assert.equal(game.pendingTreacheryDiscard?.reaction?.stage, 'offer');
  for (const actor of game.players.map(p => p.id)) game = semutaMoritaniAct(game, { actor, action: { type: 'semutaPass', event } }, actions);
  return game;
}
export function claimSemutaMoritaniDiscard(game: Game, card?: string, actions?: SemutaMoritaniStep[]): Game {
  const event = game.pendingTreacheryDiscard!.batch.event;
  game = semutaMoritaniAct(game, { actor: 'r', action: { type: 'semutaCommit', event } }, actions);
  if (game.pendingTreacheryDiscard?.reaction?.stage === 'select') {
    assert.ok(card, 'A multiple fresh-card batch needs an exact committed selection.');
    game = semutaMoritaniAct(game, { actor: 'r', action: { type: 'semutaSelect', event, card } }, actions);
  }
  return game;
}
export function finishSemutaMoritaniWinner(game: Game, discard: string[] = [], actions?: SemutaMoritaniStep[]): Game {
  assert.equal(game.decision?.kind, 'battleCards');
  return semutaMoritaniAct(game, { actor: 'w', action: { type: 'decision', discard } }, actions);
}
export function chooseSemutaMoritaniRetention(game: Game, keep: string | null, actions?: SemutaMoritaniStep[]): Game {
  assert.equal(game.decision?.kind, 'moritaniRetention');
  return semutaMoritaniAct(game, { actor: 'l', action: { type: 'decision', keep } }, actions);
}
export function allowSemutaMoritaniResponse(game: Game, actions?: SemutaMoritaniStep[]): Game {
  for (let step = 0; game.response && step < 40; step++) {
    game = semutaMoritaniAct(game, { actor: game.players.find(p => !game.response!.passed.includes(p.id))!.id, action: { type: 'passResponse' } }, actions);
  }
  assert.equal(game.response, null); return game;
}
