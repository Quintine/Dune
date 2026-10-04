import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeNexusGameForAudit, joinGame, newPlayer,
  viewGame, type Action, type Game,
} from '../game/engine';
import { territory } from '../game/board';
import { type Card } from '../game/cards';
import { validateNexusCards, nexusCardMode } from '../game/nexus-cards';
import { ownedTech } from '../game/tech-tokens';
import { quoteBattleResolution, type ResolutionCombatant } from '../game/battle-resolution-quote';
import { nextStrongholdFactionsNativeStep, type StrongholdFactionsNativeStep } from './fixture-stronghold-factions';
import { nexusInventory, orderNexusSpice } from './fixture-nexus-cards';

export type NexusModuleBattleOptions = {
  initial?: Game;
  family?: 'emperor' | 'retention';
  tech?: boolean;
  strongholds?: boolean;
  advanced?: boolean;
};
export type NexusModuleBattleFixture = {
  initial: Game;
  afterSetup: Game;
  beforeFirstMentat: Game;
  firstMentatStep: StrongholdFactionsNativeStep;
  afterFirstMentat: Game;
  beforeBattle: Game;
  battleStep: StrongholdFactionsNativeStep;
  game: Game;
  owner: string;
  opponent: string;
  observer: string;
  location: string;
  family: 'emperor' | 'retention';
  played: Card;
  unused: Card;
  defense: Card;
  planActions: StrongholdFactionsNativeStep[];
  actions: StrongholdFactionsNativeStep[];
  staging: string[];
};
export const nexusModuleBattlePlayer = (game: Game, actor: string) => {
  const player = game.players.find(p => p.id === actor);
  assert.ok(player, `Missing classic Nexus seat ${actor}`);
  return player;
};
const clean = (game: Game) => !game.phaseOpening && !game.response && !game.decision;

/** Extend the original native continuation only for actual Nexus aftermath.
 * Unsealed private plans remain a human boundary, not bot-invented fixture state. */
export function nextNexusModuleBattleStep(game: Game): StrongholdFactionsNativeStep | null {
  if (!game.phaseOpening && !game.response) {
    const d = game.decision;
    if (d?.kind === 'wormRide')
      return { actor: d.player, action: { type: 'decision', accept: false } };
    if (d?.kind === 'nexusFremenCunningOffer' || d?.kind === 'nexusFremenCunningRide')
      return { actor: d.player, action: { type: 'decision', event: d.event, accept: false } };
    if (d?.kind === 'moritaniRetention' && d.source === 'nexus')
      return { actor: d.player, action: { type: 'decision', event: d.event, keep: null } };
    if (d?.kind === 'nexusChoamInspection')
      return { actor: d.player, action: { type: 'decision', event: d.event, inspect: false } };
    if (d?.kind === 'techToken')
      return { actor: d.player, action: { type: 'decision', token: d.choices[0] } };
  }
  return nextStrongholdFactionsNativeStep(game);
}
function entropy<T>(fn: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    assert.ok(array);
    new Uint8Array(array.buffer, array.byteOffset, array.byteLength).fill(255);
    return array;
  };
  try { return fn(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}
function run(game: Game, step: StrongholdFactionsNativeStep, actions: StrongholdFactionsNativeStep[]): Game {
  actions.push(structuredClone(step));
  return entropy(() => applyAction(game, step.actor, step.action));
}
function advance(game: Game, until: (state: Game) => boolean, actions: StrongholdFactionsNativeStep[]): Game {
  for (let n = 0; n < 1800; n++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const step = nextNexusModuleBattleStep(game);
    assert.ok(step, `Human plan boundary before requested continuation at ${game.turn}/${game.phase}`);
    // Real dials, not a staged Storm position; both printed sites survive.
    if (step.action.type === 'stormDial' && game.turn === 1) step.action.amount = 0;
    game = run(game, step, actions);
  }
  throw Error('Classic Nexus battle continuation did not reach its boundary');
}
function reserveBoard(game: Game): void {
  for (const player of game.players) {
    player.reserves += Object.values(player.forces).reduce((sum, count) => sum + count, 0);
    player.forces = {};
    if (player.elites) {
      player.elites.reserves += Object.values(player.elites.forces).reduce((sum, count) => sum + count, 0);
      player.elites.forces = {};
    }
  }
}
function place(game: Game, actor: string, location: string, count: number): void {
  const player = nexusModuleBattlePlayer(game, actor);
  assert.ok(player.reserves - (player.elites?.reserves ?? 0) >= count);
  player.reserves -= count;
  player.forces[location] = count;
}
function hold(game: Game, actor: string, kind: Card['kind']): Card {
  const index = game.deck.findIndex(card => card.kind === kind);
  assert.ok(index >= 0, `Missing canonical ${kind}`);
  const card = game.deck.splice(index, 1)[0];
  nexusModuleBattlePlayer(game, actor).hand.push(card);
  return card;
}

/** Genuine all-twelve setup, actual turn-two worm, reciprocal observer alliance
 * and applyAction closing Nexus deals. Conserved physical deck order is explicit.
 * Phases, wallets, first-Storm Tech and first END Mentat custody are never staged. */
export function createNexusModuleBattleFixture(options: NexusModuleBattleOptions = {}): NexusModuleBattleFixture {
  const family = options.family ?? 'retention', tech = options.tech ?? true;
  const strongholds = options.strongholds ?? true, advanced = options.advanced ?? true;
  assert.ok(tech || strongholds);
  if (strongholds || family === 'emperor') assert.equal(advanced, true);
  const actions: StrongholdFactionsNativeStep[] = [], staging: string[] = [];
  let game = options.initial ? structuredClone(options.initial)
    : createGame('NEXUSMODULEBATTLE', newPlayer('emperor', 'Emperor', 'emperor'), advanced, []);
  if (!options.initial) {
    joinGame(game, newPlayer('guild', 'Guild', 'guild'));
    joinGame(game, newPlayer('atreides', 'Atreides', 'atreides'));
    joinGame(game, newPlayer('fremen', 'Fremen', 'fremen'));
  }
  assert.deepEqual(game.players.map(p => p.faction).sort(), ['atreides', 'emperor', 'fremen', 'guild']);
  assert.deepEqual(game.expansions, []);
  assert.equal(game.advanced, advanced);
  assert.ok(game.status === 'lobby' || game.status === 'setup' && game.turn === 1 && game.phase === 0 && game.players.every(p => !p.hand.length));
  if (game.status === 'lobby') {
    // Offline audit configuration only; no public Nexus start/toggle is added.
    if (!game.nexusCards) game.nexusCards = { cards: null, phase: null };
    if (!!game.techTokens !== tech) game = run(game, { actor: game.host, action: { type: 'techTokens', enabled: tech } }, actions);
    if (!!game.strongholdCards !== strongholds) game = run(game, { actor: game.host, action: { type: 'strongholdCards', enabled: strongholds } }, actions);
    for (const player of game.players) if (!player.ready) game = run(game, { actor: player.id, action: { type: 'ready' } }, actions);
    game = entropy(() => initializeNexusGameForAudit(game));
  }
  assert.equal(!!game.techTokens, tech);
  assert.equal(!!game.strongholdCards, strongholds);
  const initial = structuredClone(game);
  game = advance(game, state => state.status === 'playing', actions);
  const afterSetup = structuredClone(game);
  const owner = game.players.find(p => p.faction === 'emperor')!.id;
  const opponent = game.players.find(p => p.faction === 'guild')!.id;
  const observer = game.players.find(p => p.faction === 'atreides')!.id;
  const partner = game.players.find(p => p.faction === 'fremen')!.id;
  const location = `arrakeen:${territory('arrakeen').sectors[0]}`;
  validateNexusCards(game.nexusCards!.cards!, game.players);
  game = advance(game, state => state.phase === 1 && clean(state), actions);
  orderNexusSpice(game, ['land', 'land']);
  game = advance(game, state => state.phase === 5 && clean(state), actions);
  reserveBoard(game);
  game = advance(game, state => state.phase === 8 && clean(state), actions);
  place(game, owner, location, 1);
  staging.push('Before real first END Mentat, conserved one ordinary Emperor counter controls Arrakeen; subtype reserves, real banks and first-Storm Tech retained.');
  let beforeFirstMentat!: Game, firstMentatStep!: StrongholdFactionsNativeStep;
  while (game.turn === 1) {
    const step = nextNexusModuleBattleStep(game); assert.ok(step);
    const before = structuredClone(game);
    game = run(game, step, actions);
    if (game.turn === 2) { beforeFirstMentat = before; firstMentatStep = step; }
  }
  const afterFirstMentat = structuredClone(game);
  if (strongholds) assert.equal(game.strongholdCards!.owners.arrakeen, owner);
  game = advance(game, state => state.phase === 1 && clean(state), actions);
  orderNexusSpice(game, ['worm', 'land', 'land']);
  game = advance(game, state => state.nexus === true && !state.spiceWindow, actions);
  game = run(game, { actor: observer, action: { type: 'alliance', target: partner } }, actions);
  game = run(game, { actor: partner, action: { type: 'alliance', target: observer } }, actions);
  game = advance(game, state => state.nexusCards?.phase?.stage === 'drawing', actions);
  const deals = [
    { actor: owner, card: family === 'emperor' ? 'emperor' as const : 'choam' as const },
    { actor: opponent, card: 'moritani' as const },
  ];
  for (const deal of deals) {
    const cards = game.nexusCards!.cards!;
    assert.ok(cards.deck.includes(deal.card));
    cards.deck = [deal.card, ...cards.deck.filter(card => card !== deal.card)];
    game = run(game, { actor: deal.actor, action: {
      type: 'nexusCardChoice', turn: game.turn, card: null, choice: 'draw', ownRedraws: 0,
    } }, actions);
  }
  assert.equal(nexusCardMode(family === 'emperor' ? 'emperor' : 'choam', 'emperor', game.players.map(p => p.faction)), family === 'emperor' ? 'cunning' : 'secretAlly');
  assert.equal(nexusCardMode('moritani', 'guild', game.players.map(p => p.faction)), 'secretAlly');
  staging.push('Conserved all12 Nexus deck order; actual turn-two worm and Atreides/Fremen alliance open original applyAction closing deals for unallied Emperor/Guild.');
  game = advance(game, state => state.phase === 5 && clean(state), actions);
  reserveBoard(game);
  // Return genuine setup hands before selecting canonical controlled battle cards.
  for (const player of game.players) game.deck.push(...player.hand.splice(0));
  place(game, owner, location, 7);
  place(game, opponent, location, 6);
  const played = hold(game, opponent, 'projectile');
  const unused = hold(game, opponent, 'worthless');
  const defense = hold(game, owner, 'shield');
  staging.push('Turn-two movement: conserved seven ordinary Emperor and six Guild board counters; original projectile/worthless/shield cards relocated from physical deck, no bank/owner/phase writes.');
  if (tech) assert.equal(ownedTech(game.techTokens, opponent).length, 1);
  game = advance(game, state => state.phase === 6 && clean(state), actions);
  const beforeBattle = structuredClone(game);
  const battleStep: StrongholdFactionsNativeStep = { actor: game.active!, action: { type: 'chooseBattle', territory: 'arrakeen', target: game.active === owner ? opponent : owner } };
  assert.ok([owner, opponent].includes(battleStep.actor));
  game = run(game, battleStep, actions);
  game = advance(game, state => clean(state) && !!state.battle && (!state.battle.preLeader || state.battle.preLeader.closed) && !state.battle.preparation, actions);
  const best = nexusModuleBattlePlayer(game, owner).leaders.filter(l => !l.dead).sort((a, b) => b.strength - a.strength)[0];
  const weakest = nexusModuleBattlePlayer(game, opponent).leaders.filter(l => !l.dead).sort((a, b) => a.strength - b.strength)[0];
  assert.ok(best && weakest);
  const planActions: StrongholdFactionsNativeStep[] = [
    { actor: owner, action: { type: 'battlePlan', leader: best.id, dial: 6, support: advanced ? 6 : 0, defense: defense.id } },
    { actor: opponent, action: { type: 'battlePlan', leader: weakest.id, dial: 0, support: 0, weapon: played.id } },
  ];
  nexusInventory(game);
  return { initial, afterSetup, beforeFirstMentat, firstMentatStep, afterFirstMentat, beforeBattle, battleStep, game, owner, opponent, observer, location, family, played, unused, defense, planActions, actions, staging };
}
export function revealNexusModuleBattle(fixture: NexusModuleBattleFixture, game = fixture.game, cunning = false): Game {
  if (cunning) {
    const offer = viewGame(game, fixture.owner).nexusSardaukar!.offer!;
    assert.equal(offer.blocked, null);
    game = applyAction(game, fixture.owner, { type: 'nexusSardaukar', event: offer.event });
    game = advance(game, clean, []);
  }
  for (const step of fixture.planActions) {
    const action: Action = { ...step.action };
    if (cunning && step.actor === fixture.owner) action.support = 3;
    game = applyAction(game, step.actor, action);
  }
  assert.ok(game.battle?.revealed);
  return game;
}
/** Quote actual holders, committed plans and physical ordinary/elite pools. */
export function quoteNexusModuleBattle(game: Game) {
  const battle = game.battle; assert.ok(battle?.revealed);
  const side = (actor: string): ResolutionCombatant => {
    const player = nexusModuleBattlePlayer(game, actor), view = viewGame(game, actor).battle!;
    assert.ok(view.ownForces);
    return { id: actor, faction: player.faction, spice: player.spice, hand: player.hand,
      plan: battle.plans[actor], leader: player.leaders.find(l => l.id === battle.plans[actor].leader),
      forces: view.ownForces, stronghold: view.strongholdEffects[actor] };
  };
  return quoteBattleResolution({ advanced: game.advanced, turn: game.turn, territory: battle.territory,
    aggressor: viewGame(game, game.host).battle!.aggressor,
    attacker: side(battle.attacker), defender: side(battle.defender),
    voters: viewGame(game, game.host).battle!.traitorVoters.map(actor => ({ id: actor, beneficiary: actor,
      called: battle.traitorCalls[actor] ?? false, traitors: nexusModuleBattlePlayer(game, actor).traitors })),
    participants: game.players, physicalCards: [...game.deck, ...game.discard, ...game.players.flatMap(p => p.hand)],
    pendingAuditorPresent: !!game.pendingAuditor, pendingRetentionPresent: !!game.moritaniRetention,
    nexusMoritani: true });
}
export function advanceNexusModuleBattle(game: Game, until: (state: Game) => boolean): Game {
  return advance(game, until, []);
}
