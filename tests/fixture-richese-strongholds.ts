import assert from 'node:assert/strict';
import { applyAction, createGame, initializeStrongholdFactionsGameForAudit, joinGame, newPlayer, viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { territory } from '../game/board';
import type { Card } from '../game/cards';
import type { NoFieldValue } from '../game/richese-no-field';
import type { StrongholdId } from '../game/stronghold-cards';
import { nextStrongholdFactionsNativeStep, type StrongholdFactionsNativeStep } from './fixture-stronghold-factions';

export type RicheseStrongholdsOptions = {
  initial?: Game;
  seatIds?: [string, string, string];
  kind?: 'arrakeen' | 'habbanya_ridge_sietch';
  noFieldValue?: NoFieldValue;
  markerBattle?: boolean;
  reserves?: number;
  stone?: boolean;
  ownerDial?: number;
  opponentDial?: number;
  support?: number;
  opponentSupport?: number;
  traitors?: 'owner' | 'both';
  ownerDefense?: Card['kind'];
  opponentWeapon?: Card['kind'];
};
export type RicheseStrongholdsFixture = {
  initial: Game;
  afterSetup: Game;
  beforeShipment: Game;
  shipmentStep: StrongholdFactionsNativeStep;
  afterShipment: Game;
  beforeFirstMentat: Game;
  firstMentatStep: StrongholdFactionsNativeStep;
  afterFirstMentat: Game;
  beforeReveal: Game;
  revealStep: StrongholdFactionsNativeStep;
  beforeBattle: Game;
  battleStep: StrongholdFactionsNativeStep;
  game: Game;
  richese: string;
  choam: string;
  opponent: string;
  kind: StrongholdId;
  acquisition: { before: Game; steps: StrongholdFactionsNativeStep[]; after: Game } | null;
  planActions: StrongholdFactionsNativeStep[];
  staging: string[];
};
export const richeseStrongholdsPlayer = (game: Game, actor: string) => {
  const player = game.players.find(p => p.id === actor);
  assert.ok(player, `Missing native seat ${actor}`);
  return player;
};
const clean = (game: Game) => !game.phaseOpening && !game.response && !game.decision;

/** Consume only live native windows; ordinary setup choices come from real views. */
export function nextRicheseStrongholdsNativeStep(game: Game): StrongholdFactionsNativeStep | null {
  if (!game.phaseOpening && !game.response && game.decision) {
    const decision = game.decision, actor = decision.player;
    const event = game.richeseBidding?.event;
    if (decision.kind === 'richeseBlackMarket') return { actor, action: { type: 'decision', event, decline: true } };
    if (decision.kind === 'richeseDeclaration') return { actor, action: { type: 'decision', event, position: 'first' } };
    if (decision.kind === 'richeseCache') {
      const card = game.richeseCache?.find(c => c.id === 'richese-stone-burner') ?? game.richeseCache?.[0];
      assert.ok(card);
      return { actor, action: { type: 'decision', event, card: card.id, method: 'onceAround', direction: 'counterclockwise' } };
    }
    if (decision.kind === 'richeseUnbid') return { actor, action: { type: 'decision', event, keep: game.richeseAuction?.cardId === 'richese-stone-burner' } };
    if (decision.kind === 'stoneBurner') return { actor, action: { type: 'decision', event: decision.event, mode: 'ignore' } };
  }
  if (clean(game) && game.richeseAuction && !game.richeseAuction.outcome) {
    assert.ok(game.richeseAuction.active);
    return { actor: game.richeseAuction.active, action: { type: 'richeseBid', event: game.richeseAuction.event, amount: game.richeseAuction.method === 'silent' ? 0 : null } };
  }
  return nextStrongholdFactionsNativeStep(game);
}
function step(game: Game): Game {
  const next = nextRicheseStrongholdsNativeStep(game);
  assert.ok(next, 'A native Richese continuation requires an unsealed human plan');
  return applyAction(game, next.actor, next.action);
}
function advance(game: Game, predicate: (game: Game) => boolean, firstStormDial = 4): Game {
  for (let count = 0; count < 1600; count++) {
    if (predicate(game)) return game;
    assert.equal(game.status, 'playing');
    const next = nextRicheseStrongholdsNativeStep(game); assert.ok(next);
    // Use legal original dials that leave the intended controlled battle outside the next Storm band.
    if (game.turn === 1 && next.action.type === 'stormDial') next.action.amount = firstStormDial;
    game = applyAction(game, next.actor, next.action);
  }
  throw Error('Native Richese continuation did not reach its requested boundary');
}
function initialize(game: Game): Game {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  crypto.getRandomValues = <T extends ArrayBufferView | null>(array: T): T => {
    assert.ok(array);
    new Uint8Array(array.buffer, array.byteOffset, array.byteLength).fill(255);
    return array;
  };
  try { return initializeStrongholdFactionsGameForAudit(game); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}
function reserveBoard(game: Game) {
  for (const player of game.players) {
    player.reserves += Object.values(player.forces).reduce((sum, n) => sum + n, 0);
    player.forces = {};
  }
}
function place(game: Game, actor: string, location: string, amount: number) {
  const player = richeseStrongholdsPlayer(game, actor);
  assert.ok(player.reserves >= amount && amount >= 0);
  player.reserves -= amount;
  if (amount) player.forces[location] = (player.forces[location] ?? 0) + amount;
}
function heldCard(game: Game, actor: string, kind: Card['kind'], staging: string[]) {
  const player = richeseStrongholdsPlayer(game, actor);
  const held = player.hand.find(c => c.kind === kind);
  if (held) return held.id;
  const at = game.deck.findIndex(c => c.kind === kind);
  assert.ok(at >= 0, `Missing canonical native ${kind}`);
  assert.ok(player.hand.length < 4);
  const card = game.deck.splice(at, 1)[0]; player.hand.push(card);
  staging.push(`Conserved ${card.id}: remaining native deck → ${actor}'s hand`);
  return card.id;
}
function traitor(game: Game, actor: string, identity: string, staging: string[]) {
  const player = richeseStrongholdsPlayer(game, actor);
  if (player.traitors.includes(identity)) return;
  const returned = player.traitors[0]; assert.ok(returned);
  const at = game.traitorReserve?.indexOf(identity) ?? -1;
  const donor = game.players.find(p => p.id !== actor && p.traitors.includes(identity));
  assert.ok(at >= 0 || donor);
  if (at >= 0) game.traitorReserve!.splice(at, 1, returned);
  else donor!.traitors[donor!.traitors.indexOf(identity)] = returned;
  player.traitors[0] = identity;
  staging.push(`Conserved native traitor ${identity} exchanged for ${returned}`);
}

/** Real Advanced E2 setup, native cache producer and one-force shipment, followed
 * by actual first END Mentat. Only labeled conserved board/card/bank positions
 * are staged after setup. No phases, owners, markers or cache faces are assigned.
 * An original CLI initializer snapshot is continued without RNG or redealing. */
export function createRicheseStrongholdsFixture(options: RicheseStrongholdsOptions = {}): RicheseStrongholdsFixture {
  const kind = options.kind ?? 'habbanya_ridge_sietch';
  const location = `${kind}:${territory(kind).sectors[0]}`;
  const staging: string[] = [];
  let game: Game;
  if (options.initial) {
    game = structuredClone(options.initial);
    assert.ok(game.status === 'lobby' || game.status === 'setup' && game.turn === 1 && game.phase === 0 && game.players.every(p => p.hand.length === 0), 'Continue only the original fresh undealt CLI setup');
    assert.equal(game.advanced, true);
    assert.deepEqual(game.expansions, ['choam']);
    assert.deepEqual(game.players.map(p => p.faction).sort(), ['choam', 'guild', 'richese']);
  } else {
    const ids = options.seatIds ?? ['richese', 'choam', 'guild'];
    game = createGame('RICHESESTRONGHOLDS', newPlayer(ids[0], 'Richese', 'richese'), true, ['choam']);
    joinGame(game, newPlayer(ids[1], 'CHOAM', 'choam'));
    joinGame(game, newPlayer(ids[2], 'Guild', 'guild'));
  }
  if (game.status === 'lobby') {
    for (const player of game.players) if (!player.ready) game = applyAction(game, player.id, { type: 'ready' });
    game = initialize(game);
  }
  const initial = structuredClone(game);
  for (let count = 0; game.status === 'setup' && count < 200; count++) {
    let next: StrongholdFactionsNativeStep | undefined;
    for (const player of game.players) {
      const view = viewGame(game, player.id); view.players.find(p => p.id === player.id)!.bot = 'Easy';
      const action = botActions(view)[0];
      if (action) { next = { actor: player.id, action }; break; }
    }
    assert.ok(next, `Native Richese setup stalled at ${game.setupStage}`);
    game = applyAction(game, next.actor, next.action);
  }
  assert.equal(game.status, 'playing');
  const afterSetup = structuredClone(game);
  const richese = game.players.find(p => p.faction === 'richese')!.id;
  const choam = game.players.find(p => p.faction === 'choam')!.id;
  const opponent = game.players.find(p => p.faction === 'guild')!.id;
  // Stone comes from the actual unbid-cache acquisition producer, never a hand injection.
  const firstStormDial = Math.min(4, Math.floor((territory(kind).sectors[0] - 7) / 2));
  assert.ok(firstStormDial >= 0);
  game = advance(game, g => g.decision?.kind === 'richeseCache', firstStormDial);
  const acquisitionBefore = structuredClone(game), acquisitionSteps: StrongholdFactionsNativeStep[] = [];
  for (let count = 0; !richeseStrongholdsPlayer(game, richese).hand.some(c => c.id === 'richese-stone-burner') && count < 100; count++) {
    const next = nextRicheseStrongholdsNativeStep(game); assert.ok(next);
    acquisitionSteps.push(next); game = applyAction(game, next.actor, next.action);
  }
  assert.ok(richeseStrongholdsPlayer(game, richese).hand.some(c => c.id === 'richese-stone-burner'));
  const acquisition = { before: acquisitionBefore, steps: acquisitionSteps, after: structuredClone(game) };
  game = advance(game, g => g.phase === 5 && clean(g) && g.active === richese);
  reserveBoard(game);
  for (const player of game.players) player.spice = 20;
  staging.push('After real setup and cache acquisition: return original board counters to their own reserves; stage twenty-spice bank balances for original seats');
  const beforeShipment = structuredClone(game);
  const token = richeseStrongholdsPlayer(game, richese).noField!.tokens.find(t => t.value === (options.noFieldValue ?? 5))!;
  const shipmentStep: StrongholdFactionsNativeStep = { actor: richese, action: { type: 'ship', noField: token.id, event: richeseStrongholdsPlayer(game, richese).noFieldEvent, territory: kind, sector: territory(kind).sectors[0] } };
  game = applyAction(game, shipmentStep.actor, shipmentStep.action);
  game = advance(game, g => !g.response && !g.decision && !g.phaseOpening);
  const afterShipment = structuredClone(game);
  game = advance(game, g => g.phase === 8 && clean(g));
  let beforeFirstMentat: Game | undefined, firstMentatStep: StrongholdFactionsNativeStep | undefined;
  for (let count = 0; game.turn === 1 && count < 100; count++) {
    const next = nextRicheseStrongholdsNativeStep(game); assert.ok(next);
    const before = structuredClone(game); game = applyAction(game, next.actor, next.action);
    if (game.turn === 2) { beforeFirstMentat = before; firstMentatStep = next; }
  }
  assert.ok(beforeFirstMentat && firstMentatStep);
  assert.equal(game.status, 'playing');
  assert.equal(game.strongholdCards!.owners[kind], richese);
  const afterFirstMentat = structuredClone(game);
  game = advance(game, g => g.phase === 5 && clean(g));
  reserveBoard(game);
  const markerBattle = options.markerBattle ?? !options.stone;
  const reserves = options.reserves ?? 20;
  assert.ok(Number.isSafeInteger(reserves) && reserves >= 0 && reserves <= 20);
  place(game, richese, 'polar_sink:0', 20 - reserves);
  place(game, opponent, location, 6);
  for (const player of game.players) player.spice = 20;
  staging.push(`Before native second Movement completion: stage six opposing battle counters, ${20 - reserves} Richese counters in Polar Sink and twenty-spice bank balances; preserve real concealed marker and first-Mentat card ownership`);
  const beforeReveal = structuredClone(game);
  const revealStep: StrongholdFactionsNativeStep = { actor: richese, action: { type: 'revealNoField', event: richeseStrongholdsPlayer(game, richese).noFieldEvent, token: token.id } };
  if (!markerBattle) {
    game = applyAction(game, richese, revealStep.action);
    reserveBoard(game); place(game, richese, location, 6); place(game, opponent, location, 6);
    staging.push('After actual voluntary materialization: conserve six ordinary physical counters per combatant at the printed Stronghold, never a mixed-marker battle');
  }
  const defense = options.ownerDefense ? heldCard(game, richese, options.ownerDefense, staging) : null;
  const enemyWeapon = options.opponentWeapon ? heldCard(game, opponent, options.opponentWeapon, staging) : null;
  const ownLeader = richeseStrongholdsPlayer(game, richese).leaders.find(l => l.strength === 5 && !l.dead)!;
  const otherLeader = richeseStrongholdsPlayer(game, opponent).leaders.find(l => l.strength === 5 && !l.dead)!;
  assert.ok(ownLeader && otherLeader);
  if (options.traitors) {
    traitor(game, richese, otherLeader.id, staging);
    if (options.traitors === 'both') traitor(game, opponent, ownLeader.id, staging);
  }
  game = advance(game, g => g.phase === 6 && clean(g));
  const beforeBattle = structuredClone(game), actor = game.active!;
  assert.ok(actor === richese || actor === opponent);
  const battleStep: StrongholdFactionsNativeStep = { actor, action: { type: 'chooseBattle', territory: kind, target: actor === richese ? opponent : richese } };
  game = applyAction(game, actor, battleStep.action);
  for (let count = 0; count < 120; count++) {
    const next = nextRicheseStrongholdsNativeStep(game);
    if (!next) break;
    game = applyAction(game, next.actor, next.action);
  }
  assert.ok(game.battle && !game.battle.revealed && !game.decision && !game.response);
  const planActions: StrongholdFactionsNativeStep[] = [
    { actor: richese, action: { type: 'battlePlan', dial: options.ownerDial ?? 0, support: options.support ?? 0, leader: ownLeader.id, weapon: options.stone ? 'richese-stone-burner' : null, defense } },
    { actor: opponent, action: { type: 'battlePlan', dial: options.opponentDial ?? 0, support: options.opponentSupport ?? 0, leader: otherLeader.id, weapon: enemyWeapon } },
  ];
  return { initial, afterSetup, beforeShipment, shipmentStep, afterShipment, beforeFirstMentat, firstMentatStep, afterFirstMentat, beforeReveal, revealStep, beforeBattle, battleStep, game, richese, choam, opponent, kind, acquisition, planActions, staging };
}

export function revealRicheseStrongholdsBattle(fixture: RicheseStrongholdsFixture): Game {
  let game = structuredClone(fixture.game);
  for (const plan of fixture.planActions) {
    game = applyAction(game, plan.actor, plan.action);
    while (game.response || game.decision?.kind === 'fullPlanOffer') game = step(game);
  }
  assert.ok(game.battle?.revealed);
  return game;
}
export function finishRicheseStrongholdsBattle(fixture: RicheseStrongholdsFixture, state: Game, callers: string[] = []): Game {
  let game = state;
  for (let count = 0; count < 160; count++) {
    if (!game.battle && !game.decision && !game.response && !game.pendingTreacheryDiscard) return game;
    const next = nextRicheseStrongholdsNativeStep(game); assert.ok(next);
    if (next.action.type === 'traitorCall') next.action.call = callers.includes(next.actor);
    game = applyAction(game, next.actor, next.action);
  }
  throw Error('Native Richese battle suffix did not finish');
}
