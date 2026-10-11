import assert from 'node:assert/strict';
import {
  applyAction, createGame, handLimit, initializeSemutaGameForAudit, joinGame,
  newPlayer, viewGame, type Action, type Game, type Player,
} from '../game/engine';
import type { Card } from '../game/cards';
import { botSemutaActions } from '../game/bot-semuta';
import { validateNexusCards } from '../game/nexus-cards';
import { nexusChoamTradeAction } from '../game/nexus-choam-trade-options';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { nextRicheseSkillsTechNativeStep } from './fixture-richese-skills-tech';

export type SemutaNexusTradeStep = { actor: string; action: Action };
export type SemutaNexusTradeOptions = {
  /** Fresh undealt Richese/Atreides/Emperor/Guild lobby; retain authenticated IDs. */
  initial?: Game;
  advanced?: boolean;
  tech?: boolean;
  strongholds?: boolean;
  skills?: boolean;
  fullHand?: boolean;
};
export type SemutaNexusTradeFixture = {
  game: Game;
  initial: Game;
  afterSetup: Game;
  afterFirstStorm: Game;
  beforeAlliance: Game;
  beforeDraw: Game;
  afterDraw: Game;
  actions: SemutaNexusTradeStep[];
  staging: string[];
  holder: string;
  trader: string;
  allies: [string, string];
  cost: Card;
  spare: Card;
  semuta: string;
  action: Action;
};
export function semutaNexusTradePlayer(game: Game, id: string): Player {
  const player = game.players.find(p => p.id === id);
  assert.ok(player, `Missing original ${id} seat`);
  return player;
}
export function semutaNexusTradeInventory(game: Game): string[] {
  const ids = [...game.deck, ...game.discard, ...(game.richeseCache ?? []),
    ...(game.richeseRemoved ?? []), ...(game.auction?.cards.slice(game.auction.index) ?? []),
    ...game.players.flatMap(p => p.hand)].map(c => c.id).sort();
  assert.equal(new Set(ids).size, ids.length, 'One physical slot per original Treachery Card');
  validateNexusCards(game.nexusCards!.cards!, game.players);
  return ids;
}
const clean = (game: Game) => !game.phaseOpening && !game.response && !game.decision;

/** Existing no-spend native phase policy, with the actual closing Nexus choice
 * and neutral Semuta acknowledgements. No clock, receipt or payment is staged. */
export function nextSemutaNexusTradeNativeStep(game: Game): SemutaNexusTradeStep {
  if (game.pendingTreacheryDiscard?.reaction) {
    for (const player of game.players) {
      const action = botSemutaActions(viewGame(game, player.id))[0];
      if (action) return { actor: player.id, action };
    }
    throw Error('No legal original Semuta acknowledgement remains');
  }
  if (clean(game) && game.nexusCards?.phase?.stage === 'drawing') {
    const actor = game.nexusCards.phase.eligible.find(id => !game.nexusCards!.phase!.done.includes(id));
    assert.ok(actor);
    return { actor, action: { type: 'nexusCardChoice', turn: game.turn,
      card: game.nexusCards.cards!.hands[actor], choice: 'keep', ownRedraws: 0 } };
  }
  if (clean(game) && game.status === 'setup' && game.setupStage === 'leaderSkills') {
    const actor = Object.keys(game.leaderSkills!.offers)[0];
    const offer = game.leaderSkills!.offers[actor], own = viewGame(game, actor).leaderSkills!;
    const skill = offer.cards.find(id => !own.unavailableSkills?.[id]);
    assert.ok(skill && own.eligibleLeaders[0], 'Train an actual original offer on an eligible living disc');
    return { actor, action: { type: 'leaderSkill', event: offer.event, skill, leader: own.eligibleLeaders[0].id } };
  }
  return nextRicheseSkillsTechNativeStep(game);
}
export function advanceSemutaNexusTrade(
  state: Game, until: (game: Game) => boolean, actions: SemutaNexusTradeStep[] = [],
): Game {
  let game = state;
  for (let n = 0; n < 1800; n++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'Original phase path must remain playable');
    const next = nextSemutaNexusTradeNativeStep(game);
    actions.push(next);
    game = applyAction(game, next.actor, next.action);
  }
  throw Error('Native Semuta/Nexus path did not reach the requested boundary');
}
function orderUndealtSpice(game: Game, kinds: ('land' | 'worm')[], staging: string[]): void {
  const remainder = [...game.spiceDeck];
  const front = kinds.map(kind => {
    const index = remainder.findIndex(c => kind === 'land' ? 'territory' in c : 'worm' in c);
    assert.ok(index >= 0, `Original undealt ${kind} must remain available`);
    return remainder.splice(index, 1)[0];
  });
  game.spiceDeck = [...front, ...remainder];
  staging.push(`Conserved undealt Spice order: ${kinds.join(', ')}; discard history unchanged.`);
}
function reserveBoard(game: Game, staging: string[]): void {
  for (const player of game.players) {
    player.reserves += Object.values(player.forces).reduce((sum, amount) => sum + amount, 0);
    player.forces = {};
    if (player.elites) {
      player.elites.reserves += Object.values(player.elites.forces).reduce((sum, amount) => sum + amount, 0);
      player.elites.forces = {};
    }
  }
  staging.push('After native setup/first Storm, original board counters return to their own reserves; no battle, wallet or clock is invented.');
}
/** Only an already-drawn holder can swap identity with another original slot. */
export function swapSemutaNexusTradeIdentity(game: Game, owner: string, desired: Player['faction']): void {
  const cards = game.nexusCards!.cards!;
  validateNexusCards(cards, game.players);
  const previous = cards.hands[owner];
  assert.ok(previous, 'The owner must earn a real qualifying Nexus draw first');
  if (previous === desired) return;
  const donor = Object.keys(cards.hands).find(id => cards.hands[id] === desired);
  if (donor) cards.hands[donor] = previous;
  else {
    const zone = cards.deck.includes(desired) ? cards.deck : cards.discard;
    const index = zone.indexOf(desired);
    assert.ok(index >= 0, 'Requested Nexus identity must have its original physical slot');
    zone[index] = previous;
  }
  cards.hands[owner] = desired;
  validateNexusCards(cards, game.players);
}
function holdOriginal(game: Game, owner: string, matches: (card: Card) => boolean, staging: string[]): Card {
  const player = semutaNexusTradePlayer(game, owner);
  const held = player.hand.find(matches);
  if (held) return held;
  assert.ok(player.hand.length < handLimit(player));
  const zones: [string, Card[]][] = [['deck', game.deck], ['discard', game.discard],
    ['Richese cache', game.richeseCache!], ...game.players.filter(p => p.id !== owner)
      .map(p => [p.id, p.hand] as [string, Card[]])];
  for (const [name, zone] of zones) {
    const index = zone.findIndex(matches);
    if (index < 0) continue;
    const card = zone.splice(index, 1)[0];
    player.hand.push(card);
    staging.push(`Conserved physical ${card.id}: ${name} → ${owner}'s hand.`);
    return card;
  }
  throw Error('Required original physical Treachery Card is unavailable');
}

/** Real fresh native setup, first Storm, first Mentat, second-turn worm, reciprocal
 * alliance and end-Spice draw. Later controlled positions use existing physical
 * slots only. No starting Nexus hand, fabricated phase/payment or cloned stock. */
export function createSemutaNexusTradeFixture(options: SemutaNexusTradeOptions = {}): SemutaNexusTradeFixture {
  let game = options.initial ? structuredClone(options.initial)
    : createGame('SEMUTANEXUSTRADE', newPlayer('r', 'Richese', 'richese'), options.advanced ?? false, ['choam']);
  if (!options.initial) {
    joinGame(game, newPlayer('a', 'Atreides', 'atreides'));
    joinGame(game, newPlayer('e', 'Emperor', 'emperor'));
    joinGame(game, newPlayer('g', 'Guild', 'guild'));
  }
  assert.equal(game.status, 'lobby');
  assert.deepEqual(game.expansions, ['choam']);
  assert.equal(game.players.length, 4);
  if (options.advanced !== undefined) assert.equal(game.advanced, options.advanced);
  const id = (faction: Player['faction']) => {
    const player = game.players.find(p => p.faction === faction); assert.ok(player); return player.id;
  };
  const holder = id('richese'), trader = id('atreides'), allies: [string, string] = [id('emperor'), id('guild')];
  assert.ok(game.nexusCards == null || (game.nexusCards.cards === null && game.nexusCards.phase === null));
  // The original development-only lobby selection has no player-action switch.
  // Both physical packet and phase remain undealt until the original initializer.
  game.nexusCards ??= { cards: null, phase: null };
  if (options.tech !== undefined) game = applyAction(game, game.host, { type: 'techTokens', enabled: options.tech });
  if (options.strongholds !== undefined) game = applyAction(game, game.host, { type: 'strongholdCards', enabled: options.strongholds });
  for (const player of game.players) if (!player.ready) game = applyAction(game, player.id, { type: 'ready' });
  const initial = structuredClone(game), actions: SemutaNexusTradeStep[] = [], staging: string[] = [];
  game = initializeSemutaGameForAudit(game, options.skills ?? false);
  game = advanceSemutaNexusTrade(game, state => state.status === 'playing', actions);
  const afterSetup = structuredClone(game);
  assert.ok(Object.values(game.nexusCards!.cards!.hands).every(card => card === null), 'Nexus has no starting hand');
  const inventory = semutaNexusTradeInventory(game);
  game = advanceSemutaNexusTrade(game, state => state.phase === 1 && clean(state), actions);
  const afterFirstStorm = structuredClone(game);
  orderUndealtSpice(game, ['land', 'land'], staging);
  game = advanceSemutaNexusTrade(game, state => state.phase === 5 && clean(state), actions);
  reserveBoard(game, staging);
  game = advanceSemutaNexusTrade(game, state => state.turn === 2 && state.phase === 1 && clean(state), actions);
  orderUndealtSpice(game, ['worm', 'land', 'land'], staging);
  game = advanceSemutaNexusTrade(game, state => state.nexus && !state.spiceWindow && clean(state), actions);
  const beforeAlliance = structuredClone(game);
  for (const [actor, target] of [allies, [allies[1], allies[0]]] as [string, string][]) {
    const next: SemutaNexusTradeStep = { actor, action: { type: 'alliance', target } };
    actions.push(next); game = applyAction(game, actor, next.action);
  }
  game = advanceSemutaNexusTrade(game, state => state.nexusCards?.phase?.stage === 'drawing', actions);
  const beforeDraw = structuredClone(game);
  const draw: SemutaNexusTradeStep = { actor: trader, action: {
    type: 'nexusCardChoice', turn: game.turn, card: game.nexusCards!.cards!.hands[trader], choice: 'draw', ownRedraws: 0,
  } };
  actions.push(draw); game = applyAction(game, draw.actor, draw.action);
  const afterDraw = structuredClone(game);
  swapSemutaNexusTradeIdentity(game, trader, 'choam');
  staging.push('Only after actual qualifying closing draw, exchange its existing Nexus identity with the original CHOAM slot.');
  game = advanceSemutaNexusTrade(game, state => state.phase === 7 && clean(state), actions);
  // This is explicit later hand-position staging, not a new deal or acquisition rule.
  for (const actor of [holder, trader]) {
    const player = semutaNexusTradePlayer(game, actor);
    game.deck.push(...player.hand); player.hand = [];
  }
  staging.push('At real second-turn Collection, return holder/trader original hand cards to the original deck before conserved cost/Semuta staging.');
  const cost = holdOriginal(game, trader, card => card.kind === 'worthless', staging);
  const spare = holdOriginal(game, trader, card => card.kind === 'worthless' && card.id !== cost.id, staging);
  const semuta = holdOriginal(game, holder, card => card.id === SEMUTA_DRUG_ID, staging).id;
  if (options.fullHand) {
    const player = semutaNexusTradePlayer(game, holder);
    while (player.hand.length < handLimit(player))
      holdOriginal(game, holder, card => !player.hand.some(held => held.id === card.id) && card.kind !== 'worthless', staging);
  }
  assert.deepEqual(semutaNexusTradeInventory(game), inventory);
  const action = nexusChoamTradeAction(viewGame(game, trader), cost.id);
  assert.ok(action, 'Original CHOAM Secret Ally must quote the actual held Worthless at real Collection');
  return { game, initial, afterSetup, afterFirstStorm, beforeAlliance, beforeDraw, afterDraw,
    actions, staging, holder, trader, allies, cost, spare, semuta, action };
}
export function passSemutaNexusTrade(state: Game): Game {
  let game = state;
  const event = game.pendingTreacheryDiscard!.batch.event;
  for (const player of game.players) game = applyAction(game, player.id, { type: 'semutaPass', event });
  return game;
}
export function claimSemutaNexusTrade(state: Game, fixture: SemutaNexusTradeFixture): Game {
  const event = state.pendingTreacheryDiscard!.batch.event;
  return applyAction(state, fixture.holder, { type: 'semutaCommit', event });
}
export function finishSemutaNexusTradeCollection(state: Game): Game {
  assert.equal(state.pendingTreacheryDiscard, null);
  assert.equal(state.phase, 7);
  return advanceSemutaNexusTrade(state, game => game.phase === 8 && clean(game));
}
