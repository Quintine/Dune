import assert from 'node:assert/strict';
import { applyAction, createGame, initializeSemutaGameForAudit, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { isAuditorLeader } from '../game/cards';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';

export type SemutaBattleKaramaKind = 'capture' | 'choamAudit' | 'choamBattleIncome';
export const reloadBattleKarama = (game: Game): Game => JSON.parse(JSON.stringify(game));
export const battleKaramaPlayer = (game: Game, id: string) => game.players.find(p => p.id === id)!;

function take(game: Game, id: string) {
  for (const zone of [game.deck, game.discard, game.richeseCache!, ...game.players.map(p => p.hand)]) {
    const index = zone.findIndex(card => card.id === id || card.effect === id);
    if (index >= 0) return zone.splice(index, 1)[0];
  }
  throw new Error(`Missing physical ${id}`);
}

export function battleKaramaInventory(game: Game) {
  const ids = [...game.deck, ...game.discard, ...game.richeseCache!, ...game.players.flatMap(p => p.hand)]
    .map(card => card.id).sort();
  assert.equal(new Set(ids).size, ids.length);
  return ids;
}

export function passBattleKaramaOffer(game: Game): Game {
  const event = game.pendingTreacheryDiscard!.batch.event;
  for (const seat of game.players) game = applyAction(game, seat.id, { type: 'semutaPass', event });
  return game;
}

export function battleKaramaCostAction(card: string): Action {
  return { type: 'card', mode: 'cancel', card };
}

export function settleBattleKaramaCost(game: Game, claim: boolean): Game {
  return claim
    ? applyAction(game, 'r', { type: 'semutaCommit', event: game.pendingTreacheryDiscard!.batch.event })
    : passBattleKaramaOffer(game);
}

// Complete any remaining original income window and native CHOAM market.
export function finishBattleKarama(game: Game): Game {
  for (let step = 0; step < 12 && game.response?.kind === 'choamBattleIncome'; step++) {
    const seat = game.players.find(p => !game.response!.passed.includes(p.id))!;
    game = applyAction(game, seat.id, { type: 'passResponse' });
  }
  if (game.decision?.kind === 'choamMarket')
    game = applyAction(game, game.decision.player, { type: 'decision', done: true });
  assert.equal(game.phase, 7);
  return game;
}

export function semutaBattleKaramaFixture(kind: SemutaBattleKaramaKind) {
  const capture = kind === 'capture';
  let game = createGame('SEMUTABK', newPlayer('r', 'Richese', 'richese'), true,
    capture ? ['choam'] : ['choam', 'ix']);
  joinGame(game, newPlayer('a', 'Atreides', 'atreides'));
  joinGame(game, newPlayer('e', capture ? 'Harkonnen' : 'CHOAM', capture ? 'harkonnen' : 'choam'));
  for (const seat of game.players) { seat.bot = 'Medium'; seat.ready = true; }
  game = initializeSemutaGameForAudit(game);
  for (let step = 0; game.status === 'setup' && step < 80; step++) {
    let next: Game | undefined;
    for (const seat of game.players) {
      const action = botActions(viewGame(game, seat.id))[0];
      if (action) { next = applyAction(game, seat.id, action); break; }
    }
    assert.ok(next, 'native setup must provide a legal choice');
    game = next;
  }
  assert.equal(game.status, 'playing');

  // Only later physical staging changes: every printed card and force remains conserved.
  game.deck.push(...game.players.flatMap(p => p.hand));
  for (const seat of game.players) {
    Object.assign(seat, { hand: [], spice: 10, forces: {}, reserves: 20, tanks: 0 });
  }
  const semuta = take(game, SEMUTA_DRUG_ID), karama = take(game, 'karama'), privateCard = take(game, 'hajr');
  const weapon = take(game, game.deck.find(card => card.kind === 'projectile')!.id);
  const defense = take(game, game.deck.find(card => card.kind === 'snooper')!.id);
  const winner = capture ? 'e' : 'a', loser = capture ? 'a' : 'e';
  battleKaramaPlayer(game, 'r').hand.push(semuta);
  battleKaramaPlayer(game, 'a').hand.push(karama, privateCard);
  battleKaramaPlayer(game, winner).hand.push(weapon);
  battleKaramaPlayer(game, loser).hand.push(defense);
  for (const id of ['a', 'e'])
    Object.assign(battleKaramaPlayer(game, id), { forces: { 'arrakeen:10': 5 }, reserves: 15 });
  Object.assign(game, { turn: 2, phase: 6, active: winner, order: [winner, loser, 'r'],
    storm: 18, response: null, decision: null, phaseOpening: null, stormPending: null,
    movementRemaining: [], ready: [] });
  const staged = reloadBattleKarama(game), inventory = battleKaramaInventory(game);
  const winnerLeader = battleKaramaPlayer(game, winner).leaders[0];
  const loserLeader = kind === 'choamAudit'
    ? battleKaramaPlayer(game, loser).leaders.find(isAuditorLeader)!
    : battleKaramaPlayer(game, loser).leaders[0];
  assert.equal(winnerLeader.strength, capture ? 6 : 5);
  assert.equal(loserLeader.strength, capture ? 5 : kind === 'choamAudit' ? 2 : 4);

  game = applyAction(game, winner, { type: 'chooseBattle', territory: 'arrakeen', target: loser });
  for (let step = 0; step < 40; step++) {
    if (game.response) {
      const seat = game.players.find(p => !game.response!.passed.includes(p.id))!;
      game = applyAction(game, seat.id, { type: 'passResponse' });
    } else if (game.battle?.preparation)
      game = applyAction(game, game.battle.preparation.owner, { type: 'declineBattlePower' });
    else if (game.decision?.kind === 'fullPlanOffer')
      game = applyAction(game, game.decision.player, { type: 'decision', decline: true });
    else break;
  }
  for (const id of [winner, loser])
    game = applyAction(game, id, { type: 'battlePreparationReady', event: game.battle!.preLeader!.event });
  game = applyAction(game, winner, { type: 'battlePlan', dial: 2, support: 2,
    leader: winnerLeader.id, weapon: weapon.id });
  game = applyAction(game, loser, { type: 'battlePlan', dial: 0, support: 0,
    leader: loserLeader.id, defense: defense.id });
  for (const id of [winner, loser]) game = applyAction(game, id, { type: 'traitorCall', call: false });
  assert.equal(game.pendingTreacheryDiscard?.reaction?.stage, 'offer');
  const earlierEvents = [game.pendingTreacheryDiscard!.batch.event];
  game = passBattleKaramaOffer(game);
  assert.equal(game.decision?.kind, 'battleCards');
  game = applyAction(game, winner, { type: 'decision', discard: [weapon.id] });
  assert.equal(game.pendingTreacheryDiscard?.reaction?.stage, 'offer');
  earlierEvents.push(game.pendingTreacheryDiscard!.batch.event);
  game = passBattleKaramaOffer(game);
  assert.equal(battleKaramaPlayer(game, 'r').hand[0].id, semuta.id);
  if (kind === 'choamAudit') {
    // Original force income precedes Auditor; allow it before opening the audit.
    for (let step = 0; game.response?.kind === 'choamBattleIncome' && step < 12; step++) {
      const seat = game.players.find(p => !game.response!.passed.includes(p.id))!;
      game = applyAction(game, seat.id, { type: 'passResponse' });
    }
  }
  const nativeOffer = reloadBattleKarama(game);
  if (capture) {
    assert.equal(game.decision?.kind, 'captureOffer');
    game = applyAction(game, 'e', { type: 'decision', accept: true });
  } else if (kind === 'choamAudit') {
    assert.equal(game.decision?.kind, 'choamAudit');
    game = applyAction(game, 'e', { type: 'decision', event: game.pendingAuditor!.event, audit: true });
  }
  assert.equal(game.response?.kind, kind);
  return { kind, staged, nativeOffer, originalResponse: reloadBattleKarama(game), game,
    spender: 'a', holder: 'r', winner, loser, karama: karama.id, semuta: semuta.id,
    privateCard: privateCard.id, weapon: weapon.id, defense: defense.id,
    winnerLeader: winnerLeader.id, loserLeader: loserLeader.id, bounty: loserLeader.strength,
    earlierEvents, inventory, cancel: battleKaramaCostAction(karama.id) };
}
