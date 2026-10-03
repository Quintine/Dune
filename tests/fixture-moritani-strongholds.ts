import assert from 'node:assert/strict';
import { applyAction, createGame, initializeStrongholdFactionsGameForAudit, joinGame, newPlayer, viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import type { Difficulty } from '../game/bot-profiles';
import { territory } from '../game/board';
import type { Card } from '../game/cards';
import type { StrongholdId } from '../game/stronghold-cards';
import { nextStrongholdFactionsNativeStep, type StrongholdFactionsNativeStep } from './fixture-stronghold-factions';

export type MoritaniStrongholdsOptions = {
  initial?: Game;
  kind?: 'tueks_sietch' | 'sietch_tabr' | 'carthag';
  holder?: 'moritani' | 'guild';
  normalCall?: boolean;
};
export type MoritaniStrongholdsFixture = {
  initial: Game; afterSetup: Game; beforePlacement: Game; afterPlacement: Game;
  beforeFirstMentat: Game; firstMentatStep: StrongholdFactionsNativeStep; afterFirstMentat: Game;
  beforeBattle: Game; game: Game; revealed: Game; pending: Game;
  moritani: string; opponent: string; holder: string; kind: StrongholdId;
  target: string; moritaniLeader: string; opponentLeader: string;
  moritaniCards: string[]; opponentCards: string[];
  battleAction: StrongholdFactionsNativeStep; planActions: StrongholdFactionsNativeStep[];
  sourceActions: StrongholdFactionsNativeStep[]; staging: string[];
};
export const moritaniStrongholdsPlayer = (game: Game, id: string) => {
  const player = game.players.find(p => p.id === id); assert.ok(player, `Missing original seat ${id}`); return player;
};
export function moritaniStrongholdsPolicy(game: Game, actor: string, difficulty: Difficulty = 'Easy') {
  const view = viewGame(game, actor); view.players.find(p => p.id === actor)!.bot = difficulty;
  return botActions(view);
}
/** Use original owner-projected decisions; no invented Terror charge, card claim,
 * assassination opportunity or hand/leader-skill overlay. */
export function nextMoritaniStrongholdsStep(game: Game): StrongholdFactionsNativeStep | null {
  if (game.decision && ['moritaniSetup', 'moritaniPlacement', 'moritaniTerror', 'moritaniRetention', 'moritaniAssassinate'].includes(game.decision.kind)) {
    const actor = game.decision.player, action = moritaniStrongholdsPolicy(game, actor)[0]; assert.ok(action);
    return { actor, action };
  }
  return nextStrongholdFactionsNativeStep(game);
}
function run(game: Game, action: StrongholdFactionsNativeStep, actions: StrongholdFactionsNativeStep[]) {
  actions.push(structuredClone(action)); return applyAction(game, action.actor, action.action);
}
export function advanceMoritaniStrongholds(game: Game, until: (state: Game) => boolean, actions: StrongholdFactionsNativeStep[] = []): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const next = nextMoritaniStrongholdsStep(game); assert.ok(next, 'A real sealed Battle Plan is required');
    game = run(game, next, actions);
  }
  throw Error('Original native Moritani Stronghold continuation did not reach its boundary');
}
const clean = (game: Game) => !game.phaseOpening && !game.response && !game.decision;
const key = (kind: StrongholdId) => `${kind}:${territory(kind).sectors[0]}`;
function reserveBoard(game: Game) {
  for (const player of game.players) {
    player.reserves += Object.values(player.forces).reduce((sum, n) => sum + n, 0); player.forces = {};
    if (player.elites) {
      player.elites.reserves += Object.values(player.elites.forces).reduce((sum, n) => sum + n, 0); player.elites.forces = {};
    }
    if (player.advisors) player.advisors = {};
  }
}
function place(game: Game, id: string, kind: StrongholdId, count: number) {
  const player = moritaniStrongholdsPlayer(game, id); assert.ok(player.reserves >= count);
  player.reserves -= count; player.forces[key(kind)] = count;
}
function heldCard(game: Game, id: string, kind: Card['kind'], staging: string[], excluded: string[] = []) {
  const player = moritaniStrongholdsPlayer(game, id);
  const held = player.hand.find(c => c.kind === kind && !excluded.includes(c.id)); if (held) return held.id;
  const index = game.deck.findIndex(c => c.kind === kind && !excluded.includes(c.id)); assert.ok(index >= 0);
  assert.ok(player.hand.length < 4);
  const card = game.deck.splice(index, 1)[0]; player.hand.push(card);
  staging.push(`Conserved ${card.id}: remaining exact native ecaz deck → ${id}'s hand`); return card.id;
}
export function holdMoritaniStrongholdsTraitor(game: Game, owner: string, identity: string, staging: string[] = []) {
  const player = moritaniStrongholdsPlayer(game, owner), old = player.traitors[0]; assert.ok(old);
  if (old === identity) return;
  const donor = game.players.find(p => p.id !== owner && p.traitors.includes(identity));
  if (donor) donor.traitors[donor.traitors.indexOf(identity)] = old;
  else {
    const index = game.traitorReserve!.indexOf(identity); assert.ok(index >= 0);
    game.traitorReserve![index] = old;
  }
  player.traitors[0] = identity;
  staging.push(`Conserved physical traitor ${identity}: native ${donor?.id ?? 'reserve'} custody exchanged for ${old}`);
}
/** Deterministic battle positions only AFTER real setup and actual Mentat claim.
 * No assignment to phases, turn, storm, owners, plans or native pending state. */
export function stageMoritaniStrongholdsBattle(game: Game, moritani: string, opponent: string, kind: StrongholdId, staging: string[] = []) {
  assert.equal(game.phase, 5); assert.ok(clean(game));
  reserveBoard(game); place(game, moritani, kind, 6); place(game, opponent, kind, 6);
  // Explicitly isolate battle/assassination bank legs from board Collection.
  game.spice = {};
  staging.push('Before genuine movement completion: conserved six original counters per combatant and empty board deposits; preserve original native wallets and actual prior Mentat card holders.');
  return game;
}
function reveal(game: Game, plans: StrongholdFactionsNativeStep[], actions: StrongholdFactionsNativeStep[]) {
  for (const plan of plans) {
    game = run(game, plan, actions);
    while (game.response || game.decision?.kind === 'fullPlanOffer') {
      const next = nextMoritaniStrongholdsStep(game); assert.ok(next); game = run(game, next, actions);
    }
  }
  assert.ok(game.battle?.revealed); return game;
}
export function resolveMoritaniStrongholdsBattle(game: Game, moritani: string, normalCall = false, actions: StrongholdFactionsNativeStep[] = []) {
  for (let count = 0; count < 160; count++) {
    if (game.decision?.kind === 'moritaniAssassinate' || !game.battle && !game.decision && !game.response && !game.pendingTreacheryDiscard) return game;
    const next = nextMoritaniStrongholdsStep(game); assert.ok(next);
    if (next.action.type === 'traitorCall') next.action.call = normalCall && next.actor === moritani;
    game = run(game, next, actions);
  }
  throw Error('Original Moritani battle suffix did not finish');
}
export function createMoritaniStrongholdsFixture(options: MoritaniStrongholdsOptions = {}): MoritaniStrongholdsFixture {
  const actions: StrongholdFactionsNativeStep[] = [], staging: string[] = [];
  const kind = options.kind ?? 'tueks_sietch';
  let game: Game;
  if (options.initial) {
    game = structuredClone(options.initial);
    assert.ok(game.status === 'lobby' || game.status === 'setup' && game.turn === 1 && game.phase === 0 && game.players.every(p => p.hand.length === 0));
    assert.equal(game.advanced, true); assert.deepEqual(game.expansions, ['ecaz']);
  } else {
    game = createGame('MORITANISTRONGHOLDS', newPlayer('moritani', 'Moritani', 'moritani'), true, ['ecaz']);
    joinGame(game, newPlayer('guild', 'Guild', 'guild')); joinGame(game, newPlayer('emperor', 'Emperor', 'emperor'));
  }
  assert.equal(game.players.filter(p => p.faction === 'moritani').length, 1);
  assert.ok(game.players.some(p => p.faction === 'guild'));
  assert.ok(game.players.every(p => ['moritani', 'atreides', 'bene_gesserit', 'emperor', 'fremen', 'guild'].includes(p.faction)));
  if (game.status === 'lobby') {
    for (const player of game.players) if (!player.ready) game = run(game, { actor: player.id, action: { type: 'ready' } }, actions);
    game = initializeStrongholdFactionsGameForAudit(game);
  }
  const initial = structuredClone(game);
  assert.ok(game.moritaniAssassinate, 'Fresh eligible E3 profile initializes the original assassination state');
  assert.equal(game.strongholdCards!.claimedTurn, 0);
  assert.ok(Object.values(game.strongholdCards!.owners).every(owner => owner === null));
  for (let count = 0; game.status === 'setup' && count < 200; count++) {
    const next = nextMoritaniStrongholdsStep(game); assert.ok(next); game = run(game, next, actions);
  }
  assert.equal(game.status, 'playing');
  const afterSetup = structuredClone(game);
  const moritani = game.players.find(p => p.faction === 'moritani')!.id;
  const opponent = game.players.find(p => p.faction === 'guild')!.id;
  const holder = options.holder === 'guild' ? opponent : moritani;
  for (let count = 0; !(game.phase === 8 && game.decision?.kind === 'moritaniPlacement') && count < 1800; count++) {
    const next = nextMoritaniStrongholdsStep(game); assert.ok(next);
    // Real first Storm dials keep the printed battle sector outside every
    // possible native turn-two storm advance; the storm field is never assigned.
    if (next.action.type === 'stormDial' && game.turn === 1) next.action.amount = kind === 'tueks_sietch' ? 4 : 0;
    game = run(game, next, actions);
  }
  assert.equal(game.decision?.kind, 'moritaniPlacement');
  const beforePlacement = structuredClone(game);
  // Real native placement; choose a different stronghold so subsequent conserved
  // battle staging neither fabricates an entry nor invokes an unrelated token.
  const token = game.moritaniTerror!.tokens.find(t => t.status === 'available')!; assert.ok(token);
  game = run(game, { actor: moritani, action: { type: 'decision', token: token.id, territory: 'arrakeen' } }, actions);
  game = advanceMoritaniStrongholds(game, state => state.phase === 8 && clean(state), actions);
  const afterPlacement = structuredClone(game);
  reserveBoard(game); place(game, holder, kind, 1);
  const other = kind === 'carthag' ? 'sietch_tabr' : 'carthag'; place(game, holder === moritani ? opponent : moritani, other, 1);
  staging.push('Before actual first END Mentat: conserve original counters through reserves, one controlled Stronghold per combatant, no three-hold victory or assigned custody.');
  let beforeFirstMentat: Game | undefined, firstMentatStep: StrongholdFactionsNativeStep | undefined;
  for (let count = 0; game.turn === 1 && count < 200; count++) {
    const next = nextMoritaniStrongholdsStep(game); assert.ok(next);
    const before = structuredClone(game); game = run(game, next, actions);
    if (game.turn === 2) { beforeFirstMentat = before; firstMentatStep = next; }
  }
  assert.ok(beforeFirstMentat && firstMentatStep); assert.equal(game.turn, 2);
  assert.equal(game.strongholdCards!.owners[kind], holder);
  const afterFirstMentat = structuredClone(game);
  game = advanceMoritaniStrongholds(game, state => state.phase === 5 && clean(state), actions);
  stageMoritaniStrongholdsBattle(game, moritani, opponent, kind, staging);
  const m = moritaniStrongholdsPlayer(game, moritani), guild = moritaniStrongholdsPlayer(game, opponent);
  const ownLeader = m.leaders.filter(l => !l.dead).sort((a, b) => a.strength - b.strength)[0];
  const enemyLeader = guild.leaders.filter(l => !l.dead).sort((a, b) => b.strength - a.strength)[0];
  assert.ok(ownLeader && enemyLeader);
  const target = guild.leaders.find(l => !l.dead && l.id !== enemyLeader.id)!; assert.ok(target);
  holdMoritaniStrongholdsTraitor(game, moritani, options.normalCall ? enemyLeader.id : target.id, staging);
  const moritaniCards: string[] = [], opponentCards: string[] = [];
  if (kind === 'carthag') {
    moritaniCards.push(heldCard(game, moritani, 'shield', staging));
    opponentCards.push(heldCard(game, opponent, 'poison', staging));
  } else if (kind === 'tueks_sietch') {
    moritaniCards.push(heldCard(game, moritani, 'worthless', staging));
    moritaniCards.push(heldCard(game, moritani, 'worthless', staging, moritaniCards));
    opponentCards.push(heldCard(game, opponent, 'worthless', staging));
  }
  game = advanceMoritaniStrongholds(game, state => state.phase === 6 && clean(state), actions);
  const beforeBattle = structuredClone(game), actor = game.active!; assert.ok([moritani, opponent].includes(actor));
  const battleAction: StrongholdFactionsNativeStep = { actor, action: { type: 'chooseBattle', territory: kind, target: actor === moritani ? opponent : moritani } };
  game = run(game, battleAction, actions);
  game = advanceMoritaniStrongholds(game, state => !!state.battle && !state.battle.revealed && !nextMoritaniStrongholdsStep(state), actions);
  const planActions: StrongholdFactionsNativeStep[] = [
    { actor: moritani, action: { type: 'battlePlan', leader: ownLeader.id, dial: 1, support: 1, weapon: kind === 'tueks_sietch' ? moritaniCards[0] : null, defense: kind === 'tueks_sietch' ? moritaniCards[1] : kind === 'carthag' ? moritaniCards[0] : null } },
    { actor: opponent, action: { type: 'battlePlan', leader: enemyLeader.id, dial: 3, support: 3, weapon: opponentCards[0] ?? null, defense: null } },
  ];
  const prepared = structuredClone(game), revealed = reveal(game, planActions, actions);
  const pending = resolveMoritaniStrongholdsBattle(structuredClone(revealed), moritani, options.normalCall, actions);
  return { initial, afterSetup, beforePlacement, afterPlacement, beforeFirstMentat, firstMentatStep, afterFirstMentat, beforeBattle, game: prepared, revealed, pending,
    moritani, opponent, holder, kind, target: target.id, moritaniLeader: ownLeader.id, opponentLeader: enemyLeader.id, moritaniCards, opponentCards, battleAction, planActions, sourceActions: actions, staging };
}
