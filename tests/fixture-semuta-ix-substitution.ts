import assert from 'node:assert/strict';
import { applyAction, createGame, initializeSemutaGameForAudit, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';

export type SemutaIxStep = { actor: string; action: Action };
export interface SemutaIxFixture {
  game: Game;
  holder: string;
  winner: string;
  loser: string;
  territory: string;
  location: string;
  semuta: string;
  tooth: string;
  shield: string;
  snooper: string;
  cards: string[];
}
export const semutaIxPlayer = (game: Game, id: string) => game.players.find(p => p.id === id)!;
export const semutaIxInventory = (game: Game) => [...game.deck, ...game.discard, ...game.richeseCache!,
  ...game.players.flatMap(p => p.hand)].map(card => card.id).sort();
export function semutaIxPhysical(game: Game) {
  return game.players.map(p => ({ id: p.id, forces: p.forces, reserves: p.reserves, tanks: p.tanks,
    elites: p.elites, battleLosses: p.battleLosses, spice: p.spice }));
}

/** Original native lobby, private Ix card choice, Traitors and actual first Storm/HMS placement. */
export function initializeSemutaIxGame(advanced = false, skills = false): Game {
  let game = createGame('SEMUTAIX', newPlayer('r', 'Richese', 'richese'), advanced, ['choam', 'ix']);
  joinGame(game, newPlayer('i', 'Ixians', 'ixians'));
  joinGame(game, newPlayer('e', 'Emperor', 'emperor'));
  for (const p of game.players) { p.bot = 'Medium'; p.ready = true; }
  game = initializeSemutaGameForAudit(game, skills);
  for (let step = 0; (game.status === 'setup' || game.phase === 1 || !game.mobileStronghold?.location) && step < 160; step++) {
    let next: Game | undefined;
    for (const p of game.players) {
      const action = botActions(viewGame(game, p.id))[0];
      if (action) { next = applyAction(game, p.id, action); break; }
    }
    assert.ok(next, 'Original Ix setup and first Storm require a legal native continuation.');
    game = next;
  }
  assert.equal(game.status, 'playing');
  assert.ok(game.mobileStronghold?.location);
  assert.equal(game.richeseCache!.length, 10);
  assert.equal(semutaIxInventory(game).length, 57, 'Original union-47 deck plus separate Richese ten-card cache.');
  return game;
}

/** Later rule position uses conserved native pieces, not a synthetic Game or replacement players. */
export function semutaIxBattleFixture(advanced = false, skills = false): SemutaIxFixture {
  const game = initializeSemutaIxGame(advanced, skills);
  const cards = semutaIxInventory(game);
  assert.equal(new Set(cards).size, cards.length);
  for (const p of game.players) {
    game.deck.push(...p.hand); p.hand = [];
    p.reserves += p.tanks + Object.values(p.forces).reduce((sum, n) => sum + n, 0);
    p.forces = {}; p.tanks = 0; p.battleLosses = 0;
    if (p.elites) {
      p.elites.reserves += p.elites.tanks + Object.values(p.elites.forces).reduce((sum, n) => sum + n, 0);
      p.elites.forces = {}; p.elites.tanks = 0;
    }
  }
  const take = (id: string) => {
    for (const zone of [game.deck, game.discard, game.richeseCache!]) {
      const index = zone.findIndex(c => c.id === id);
      if (index >= 0) return zone.splice(index, 1)[0];
    }
    throw new Error(`Missing original physical ${id}`);
  };
  const semuta = take(SEMUTA_DRUG_ID);
  const tooth = take(game.deck.find(c => c.kind === 'poisonTooth')!.id);
  const shield = take(game.deck.find(c => c.kind === 'shield')!.id);
  const snooper = take(game.deck.find(c => c.kind === 'snooper')!.id);
  semutaIxPlayer(game, 'r').hand.push(semuta);
  // A real rival-held Karama keeps the native substitution response actionable.
  semutaIxPlayer(game, 'r').hand.push(take(game.deck.find(c => c.effect === 'karama')!.id));
  semutaIxPlayer(game, 'i').hand.push(tooth, shield);
  semutaIxPlayer(game, 'e').hand.push(snooper);
  const location = 'arrakeen:10';
  const ix = semutaIxPlayer(game, 'i');
  assert.equal(ix.reserves, 20); assert.equal(ix.elites!.reserves, 7);
  ix.reserves -= 3; ix.forces[location] = 3;
  ix.elites!.reserves--; ix.elites!.forces[location] = 1;
  const emperor = semutaIxPlayer(game, 'e');
  emperor.reserves -= 5; emperor.forces[location] = 5;
  Object.assign(game, { turn: 2, phase: 6, active: 'i', order: ['i', 'e', 'r'], storm: 18,
    ready: [], response: null, decision: null, phaseOpening: null, movementRemaining: [] });
  assert.deepEqual(semutaIxInventory(game), cards);
  return { game, holder: 'r', winner: 'i', loser: 'e', territory: 'arrakeen', location,
    semuta: semuta.id, tooth: tooth.id, shield: shield.id, snooper: snooper.id, cards };
}

/** Export exact native plan actions for CLI/UI proof; one supported Cyborg is the sole dial-two casualty. */
export function semutaIxPlanSteps(game: Game, f: SemutaIxFixture): SemutaIxStep[] {
  return [
    { actor: f.winner, action: { type: 'battlePlan', dial: 2, support: game.advanced ? 1 : 0,
      leader: semutaIxPlayer(game, f.winner).leaders.find(l => !l.dead)!.id, weapon: f.tooth, defense: f.shield } },
    { actor: f.loser, action: { type: 'battlePlan', dial: 0, support: 0,
      leader: semutaIxPlayer(game, f.loser).leaders.find(l => !l.dead)!.id, defense: f.snooper } },
  ];
}

/** Stops at the LOSER'S physical Snooper discard, before winner casualties or substitution. */
export function semutaIxLoserDiscardFixture(advanced = false): SemutaIxFixture {
  const f = semutaIxBattleFixture(advanced);
  let game = applyAction(f.game, f.winner, { type: 'chooseBattle', territory: f.territory, target: f.loser });
  for (let step = 0; step < 40; step++) {
    if (game.response) {
      const actor = game.players.find(p => !game.response!.passed.includes(p.id))!;
      game = applyAction(game, actor.id, { type: 'passResponse' });
    } else if (game.battle?.preparation)
      game = applyAction(game, game.battle.preparation.owner, { type: 'declineBattlePower' });
    else if (game.decision?.kind === 'fullPlanOffer')
      game = applyAction(game, game.decision.player, { type: 'decision', decline: true });
    else break;
  }
  for (const actor of [f.winner, f.loser])
    game = applyAction(game, actor, { type: 'battlePreparationReady', event: game.battle!.preLeader!.event });
  for (const step of semutaIxPlanSteps(game, f)) game = applyAction(game, step.actor, step.action);
  assert.equal(game.decision?.kind, 'poisonTooth');
  game = applyAction(game, f.winner, { type: 'decision', activate: true });
  for (const actor of [f.winner, f.loser]) game = applyAction(game, actor, { type: 'traitorCall', call: false });
  return { ...f, game };
}

export function semutaIxPassDiscard(game: Game): Game {
  const pending = game.pendingTreacheryDiscard!;
  assert.equal(pending.reaction?.stage, 'offer');
  const event = pending.batch.event;
  for (const p of game.players) game = applyAction(game, p.id, { type: 'semutaPass', event });
  return game;
}
export function semutaIxSubstitutionStep(f: SemutaIxFixture, substitute: boolean): SemutaIxStep {
  return { actor: f.winner, action: substitute
    ? { type: 'decision', sources: { [f.location]: 1 }, recover: { [f.location]: 1 } }
    : { type: 'decision', decline: true } };
}
export function semutaIxAllowResponses(game: Game): Game {
  for (let step = 0; game.response && step < 12; step++) {
    const actor = game.players.find(p => !game.response!.passed.includes(p.id))!;
    game = applyAction(game, actor.id, { type: 'passResponse' });
  }
  assert.equal(game.response, null);
  return game;
}
/** Used Tooth discard is correctly AFTER native substitution, never offered before it. */
export function semutaIxWinnerDiscardFixture(advanced = false, substitute = true): SemutaIxFixture {
  const f = semutaIxLoserDiscardFixture(advanced);
  let game = semutaIxPassDiscard(f.game);
  assert.equal(game.decision?.kind, 'ixSubstitution');
  const step = semutaIxSubstitutionStep(f, substitute);
  game = semutaIxAllowResponses(applyAction(game, step.actor, step.action));
  return { ...f, game };
}
