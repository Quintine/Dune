import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializePairedNexusGameForAudit, joinGame, newPlayer,
  viewGame, type Action, type Game,
} from '../game/engine';
import { territory } from '../game/board';
import type { Card } from '../game/cards';
import { pairedNexusModulesProfile } from '../game/nexus-module-profile';
import { validateNexusCards } from '../game/nexus-cards';
import { nextNativeTechFactionsStep } from './fixture-native-tech-factions';
import { orderNexusSpice } from './fixture-nexus-cards';
import type { StrongholdFactionsNativeStep as Step } from './fixture-stronghold-factions';

export type PairedChoamNexusModulesOptions = {
  initial?: Game;
  advanced?: boolean;
  tech?: boolean;
  strongholds?: boolean;
  reserveCap?: number;
};
export type PairedChoamNexusModulesFixture = {
  initial: Game;
  afterSetup: Game;
  afterFirstStorm: Game;
  firstShipment: { before: Game; step: Step; after: Game };
  beforeFirstMentat: Game;
  firstMentatStep: Step;
  afterFirstMentat: Game;
  movementStart: Game;
  game: Game;
  richese: string;
  choam: string;
  guild: string;
  observer: string;
  location: string;
  actions: Step[];
  staging: string[];
};
export const pairedChoamPlayer = (game: Game, actor: string) => {
  const player = game.players.find(p => p.id === actor);
  assert.ok(player, `Missing original paired E2 actor ${actor}`);
  return player;
};
export const pairedChoamClean = (game: Game) => !game.phaseOpening && !game.response && !game.decision;
export function nextPairedChoamStep(game: Game): Step | null {
  if (!game.phaseOpening && !game.response) {
    const d = game.decision;
    if (d?.kind === 'wormRide') return { actor: d.player, action: { type: 'decision', accept: false } };
    if (d?.kind === 'nexusFremenCunningOffer' || d?.kind === 'nexusFremenCunningRide')
      return { actor: d.player, action: { type: 'decision', event: d.event, accept: false } };
    if (d?.kind === 'nexusChoamInspection')
      return { actor: d.player, action: { type: 'decision', event: d.event, inspect: false } };
  }
  return nextNativeTechFactionsStep(game);
}
function run(game: Game, step: Step, actions: Step[]): Game {
  actions.push(structuredClone(step));
  return applyAction(game, step.actor, step.action);
}
export function advancePairedChoam(game: Game, until: (game: Game) => boolean, actions: Step[] = []): Game {
  for (let n = 0; n < 1800; n++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const step = nextPairedChoamStep(game);
    assert.ok(step, `Original paired E2 needs a human battle plan at ${game.turn}/${game.phase}`);
    if (step.action.type === 'stormDial') step.action.amount = game.turn === 1 ? 0 : 1;
    game = run(game, step, actions);
  }
  throw Error('Original paired E2 continuation did not reach its requested boundary');
}
function setupEntropy<T>(fn: () => T): T {
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
/** Continue the supplied authenticated, undealt original setup without changing
 * actors, first deal or deck. Entropy is scoped only to a newly created lobby. */
export function initializePairedChoamModules(options: PairedChoamNexusModulesOptions = {}): Game {
  const tech = options.tech ?? true, strongholds = options.strongholds ?? true;
  const advanced = options.advanced ?? options.initial?.advanced ?? true;
  assert.ok(tech || strongholds);
  if (strongholds) assert.equal(advanced, true);
  let game = options.initial ? structuredClone(options.initial)
    : createGame('PAIREDCHOAMNEXUSMODULES', newPlayer('richese', 'Richese', 'richese'), advanced, ['choam']);
  if (!options.initial) {
    joinGame(game, newPlayer('choam', 'CHOAM', 'choam'));
    joinGame(game, newPlayer('guild', 'Guild', 'guild'));
    joinGame(game, newPlayer('atreides', 'Atreides', 'atreides'));
  }
  assert.deepEqual(game.players.map(p => p.faction).sort(), ['atreides', 'choam', 'guild', 'richese']);
  assert.deepEqual(game.expansions, ['choam']);
  assert.equal(game.advanced, advanced);
  assert.ok(game.status === 'lobby' || game.status === 'setup' && game.turn === 1 && game.phase === 0 && game.players.every(p => !p.hand.length), 'Use the original authenticated lobby or turn-one undealt setup');
  if (game.status === 'lobby') {
    if (!game.nexusCards) game.nexusCards = { cards: null, phase: null };
    if (!!game.techTokens !== tech) game = applyAction(game, game.host, { type: 'techTokens', enabled: tech });
    if (!!game.strongholdCards !== strongholds) game = applyAction(game, game.host, { type: 'strongholdCards', enabled: strongholds });
    for (const p of game.players) if (!p.ready) game = applyAction(game, p.id, { type: 'ready' });
    const initialize = () => initializePairedNexusGameForAudit(game);
    game = options.initial ? initialize() : setupEntropy(initialize);
  }
  assert.ok(pairedNexusModulesProfile(game));
  assert.equal(!!game.techTokens, tech);
  assert.equal(!!game.strongholdCards, strongholds);
  return game;
}
export function reservePairedChoamBoard(game: Game): void {
  for (const p of game.players) {
    p.reserves += Object.values(p.forces).reduce((a, b) => a + b, 0);
    p.forces = {};
    if (p.elites) {
      p.elites.reserves += Object.values(p.elites.forces).reduce((a, b) => a + b, 0);
      p.elites.forces = {};
    }
  }
}
export function placePairedChoam(game: Game, actor: string, key: string, count: number): void {
  const p = pairedChoamPlayer(game, actor);
  assert.ok(count >= 0 && p.reserves - (p.elites?.reserves ?? 0) >= count);
  p.reserves -= count;
  if (count) p.forces[key] = (p.forces[key] ?? 0) + count;
}
export function holdPairedChoamCard(game: Game, actor: string, matches: (card: Card) => boolean): Card {
  const p = pairedChoamPlayer(game, actor), held = p.hand.find(matches);
  if (held) return held;
  const at = game.deck.findIndex(matches);
  assert.ok(at >= 0, 'Required original physical card is unavailable');
  assert.ok(p.hand.length < (p.faction === 'choam' ? 5 : 4));
  const card = game.deck.splice(at, 1)[0];
  p.hand.push(card);
  return card;
}
/** Real native zero-marker shipment establishes previous-token history. Actual
 * first Storm, END Mentat, turn-two worm, reciprocal classic alliance and closing
 * Nexus deals precede the controlled movement program. No bank or custody grants. */
export function createPairedChoamNexusModulesFixture(options: PairedChoamNexusModulesOptions = {}): PairedChoamNexusModulesFixture {
  const actions: Step[] = [], staging: string[] = [];
  let game = initializePairedChoamModules(options);
  const initial = structuredClone(game);
  game = advancePairedChoam(game, g => g.status === 'playing', actions);
  const afterSetup = structuredClone(game);
  const richese = game.players.find(p => p.faction === 'richese')!.id;
  const choam = game.players.find(p => p.faction === 'choam')!.id;
  const guild = game.players.find(p => p.faction === 'guild')!.id;
  const observer = game.players.find(p => p.faction === 'atreides')!.id;
  const location = `habbanya_ridge_sietch:${territory('habbanya_ridge_sietch').sectors[0]}`;
  game = advancePairedChoam(game, g => g.phase === 1 && pairedChoamClean(g), actions);
  const afterFirstStorm = structuredClone(game);
  orderNexusSpice(game, ['land', 'land']);
  game = advancePairedChoam(game, g => g.phase === 5 && g.active === richese && pairedChoamClean(g), actions);
  reservePairedChoamBoard(game);
  const before = structuredClone(game), p = pairedChoamPlayer(game, richese);
  const step: Step = { actor: richese, action: { type: 'ship', noField: p.noField!.tokens.find(t => t.value === 0)!.id, event: p.noFieldEvent, territory: 'habbanya_ridge_sietch', sector: territory('habbanya_ridge_sietch').sectors[0] } };
  game = run(game, step, actions);
  game = advancePairedChoam(game, pairedChoamClean, actions);
  const firstShipment = { before, step, after: structuredClone(game) };
  game = run(game, { actor: richese, action: { type: 'revealNoField', event: pairedChoamPlayer(game, richese).noFieldEvent, token: pairedChoamPlayer(game, richese).noField!.deployed!.tokenId } }, actions);
  game = advancePairedChoam(game, g => g.phase === 8 && pairedChoamClean(g), actions);
  reservePairedChoamBoard(game);
  placePairedChoam(game, richese, location, 1);
  placePairedChoam(game, choam, `arrakeen:${territory('arrakeen').sectors[0]}`, 1);
  staging.push('Before genuine first END Mentat: conserve one Richese Habbanya and one CHOAM Arrakeen counter; preserve actual zero-marker history, wallets and first-Storm Tech.');
  let beforeFirstMentat!: Game, firstMentatStep!: Step;
  while (game.turn === 1) {
    const next = nextPairedChoamStep(game); assert.ok(next);
    const previous = structuredClone(game);
    game = run(game, next, actions);
    if (game.turn === 2) { beforeFirstMentat = previous; firstMentatStep = next; }
  }
  const afterFirstMentat = structuredClone(game);
  game = advancePairedChoam(game, g => g.phase === 1 && pairedChoamClean(g), actions);
  orderNexusSpice(game, ['worm', 'land', 'land']);
  game = advancePairedChoam(game, g => g.nexus === true && !g.spiceWindow, actions);
  game = run(game, { actor: guild, action: { type: 'alliance', target: observer } }, actions);
  game = run(game, { actor: observer, action: { type: 'alliance', target: guild } }, actions);
  game = advancePairedChoam(game, g => g.nexusCards?.phase?.stage === 'drawing', actions);
  for (const [actor, card] of [[richese, 'richese'], [choam, 'choam']] as const) {
    const cards = game.nexusCards!.cards!;
    assert.ok(cards.deck.includes(card));
    cards.deck = [card, ...cards.deck.filter(c => c !== card)];
    game = run(game, { actor, action: { type: 'nexusCardChoice', turn: game.turn, card: null, choice: 'draw', ownRedraws: 0 } }, actions);
  }
  staging.push('Conserve all12 deck order; turn-two worm and reciprocal Guild/Atreides alliance cause actual closing Nexus Cunning deals to the two unallied native E2 seats.');
  game = advancePairedChoam(game, g => g.phase === 5 && pairedChoamClean(g), actions);
  reservePairedChoamBoard(game);
  // Preserve first-deal snapshots; relocate original physical hands only here.
  for (const p of game.players) game.deck.push(...p.hand.splice(0));
  const movementStart = structuredClone(game);
  game = advancePairedChoam(game, g => g.phase === 5 && g.active === richese && pairedChoamClean(g), actions);
  if (options.reserveCap !== undefined) {
    assert.ok(Number.isSafeInteger(options.reserveCap) && options.reserveCap >= 0 && options.reserveCap <= 20);
    placePairedChoam(game, richese, 'polar_sink:0', 20 - options.reserveCap);
    staging.push(`Conserve ${20 - options.reserveCap} Richese counters at Polar Sink, leaving ${options.reserveCap} physical reserves for capped materialization.`);
  }
  validateNexusCards(game.nexusCards!.cards!, game.players);
  return { initial, afterSetup, afterFirstStorm, firstShipment, beforeFirstMentat, firstMentatStep, afterFirstMentat, movementStart, game, richese, choam, guild, observer, location, actions, staging };
}
export function pairedRicheseCunningRequest(f: PairedChoamNexusModulesFixture, game = f.game): Action {
  const p = pairedChoamPlayer(game, f.richese);
  return { type: 'ship', noField: p.noField!.tokens.find(t => t.value === 3)!.id,
    revealedToken: p.noField!.tokens.find(t => t.value === 5)!.id,
    nexus: viewGame(game, f.richese).nexusRicheseCunning!.event, event: p.noFieldEvent,
    territory: 'habbanya_ridge_sietch', sector: territory('habbanya_ridge_sietch').sectors[0], allyPayment: 0 };
}
export function allowPairedChoam(game: Game): Game {
  return advancePairedChoam(game, pairedChoamClean);
}
export function revealPairedRichese(game: Game, actor: string): Game {
  const p = pairedChoamPlayer(game, actor);
  assert.ok(p.noField!.deployed);
  return applyAction(game, actor, { type: 'revealNoField', event: p.noFieldEvent, token: p.noField!.deployed.tokenId });
}
