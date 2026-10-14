import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeNexusGameForAudit, joinGame, newPlayer,
  type Action, type Game, type Player,
} from '../game/engine';
import { treacheryDeck } from '../game/cards';
import { validateNexusCards } from '../game/nexus-cards';
import { nextStrongholdFactionsNativeStep } from './fixture-stronghold-factions';

export type NexusEmperorPaymentStep = { actor: string; action: Action };
export type NexusEmperorPaymentTransition = { before: Game; step: NexusEmperorPaymentStep; after: Game };
export type NexusEmperorPaymentFixture = {
  game: Game;
  owner: string;
  winner: string;
  emperor: string;
  neutral: string;
  event: string;
  price: number;
  acquired: string;
  karama: string;
  originalCards: string[];
  actions: NexusEmperorPaymentStep[];
  staging: string[];
  chronology: {
    initial: Game;
    afterSetup: Game;
    firstMentat: NexusEmperorPaymentTransition;
    worm: Game;
    alliance: Game;
    draw: NexusEmperorPaymentTransition;
    afterClosingDraw: Game;
    beforeFunding: Game;
    beforeBid: Game;
  };
  wallets: { winner: number; emperorBeforeAid: number; emperor: number; matchingAid: number };
};

export function nexusEmperorPaymentPlayer(game: Game, id: string): Player {
  const player = game.players.find(candidate => candidate.id === id);
  assert.ok(player, `Missing original Emperor-payment seat ${id}`);
  return player;
}
const clean = (game: Game) => !game.phaseOpening && !game.response && !game.decision &&
  !game.truthtrance && !game.pendingTreacheryDiscard;

/** Fix only scalar native randomness. UUIDs and all other native entropy remain real. */
function scalarEntropy<T>(operation: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const native = crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array && array.length === 1) array[0] = 0xffffffff;
    else Reflect.apply(native, crypto, [array]);
    return array;
  };
  try { return operation(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}
export function stepNexusEmperorPayment(game: Game, step: NexusEmperorPaymentStep,
  actions?: NexusEmperorPaymentStep[]): Game {
  actions?.push(structuredClone(step));
  return scalarEntropy(() => applyAction(game, step.actor, step.action));
}
export function nextNexusEmperorPaymentStep(game: Game): NexusEmperorPaymentStep {
  if (clean(game) && game.nexusCards?.phase?.stage === 'drawing') {
    const actor = game.nexusCards.phase.eligible.find(id => !game.nexusCards!.phase!.done.includes(id));
    assert.ok(actor);
    return { actor, action: { type: 'nexusCardChoice', turn: game.turn,
      card: game.nexusCards.cards!.hands[actor], choice: 'keep', ownRedraws: 0 } };
  }
  if (!game.phaseOpening && !game.response && game.decision?.kind === 'nexusEmperorPayment')
    return { actor: game.decision.player,
      action: { type: 'nexusEmperorPayment', event: game.decision.event, use: false } };
  const next = nextStrongholdFactionsNativeStep(game);
  assert.ok(next, 'The genuine Emperor-payment chronology must not require a manufactured battle plan');
  return next;
}
export function advanceNexusEmperorPayment(game: Game, until: (game: Game) => boolean,
  actions?: NexusEmperorPaymentStep[]): Game {
  for (let n = 0; n < 1800; n++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    game = stepNexusEmperorPayment(game, nextNexusEmperorPaymentStep(game), actions);
  }
  throw new Error('The original Emperor-payment chronology did not reach its requested boundary');
}

/** Physical ownership zones only: paid auction prefixes are references, not duplicates. */
export function nexusEmperorPaymentCards(game: Game): string[] {
  return [...game.deck, ...game.discard, ...game.players.flatMap(player => player.hand),
    ...(game.auction?.cards.slice(game.auction.index + Number(!!game.currentAuctionSale)) ?? [])]
    .map(card => card.id).sort();
}
export function nexusEmperorPaymentInventory(game: Game): void {
  validateNexusCards(game.nexusCards!.cards!, game.players);
  assert.deepEqual(nexusEmperorPaymentCards(game), treacheryDeck().map(card => card.id).sort());
  for (const player of game.players) {
    assert.equal(player.reserves + player.tanks + Object.values(player.forces).reduce((sum, count) => sum + count, 0), 20);
    if (player.elites) assert.equal(player.elites.reserves + player.elites.tanks +
      Object.values(player.elites.forces).reduce((sum, count) => sum + count, 0), 5);
  }
}
function frontOriginalSpice(game: Game, kinds: ('land' | 'worm')[]): void {
  const prefix = kinds.map(kind => {
    const index = game.spiceDeck.findIndex(card => kind === 'land' ? 'territory' in card : 'worm' in card);
    assert.ok(index >= 0);
    return game.spiceDeck.splice(index, 1)[0];
  });
  game.spiceDeck.unshift(...prefix);
}

/** Genuine four-seat Basic/Advanced native history. Only still-undealt physical
 * singleton order is controlled; no hand, wallet, army, phase, alliance or receipt
 * is assigned. The original first turn ends before the later real worm/alliance. */
export function createNexusEmperorPaymentFixture(options: {
  advanced?: boolean; prepaidAid?: number; neutralHolder?: boolean; truthtrance?: boolean;
} = {}): NexusEmperorPaymentFixture {
  const owner = 'atreides', emperor = 'emperor', winner = 'guild', neutral = 'harkonnen';
  const price = 2, matchingAid = options.prepaidAid ?? 0;
  assert.ok(Number.isInteger(matchingAid) && matchingAid >= 0 && matchingAid <= price);
  const actions: NexusEmperorPaymentStep[] = [], staging: string[] = [];
  let game = createGame('NEXUSEMPERORPAYMENT', newPlayer(owner, 'Atreides', 'atreides'), options.advanced ?? false);
  joinGame(game, newPlayer(emperor, 'Emperor', 'emperor'));
  joinGame(game, newPlayer(winner, 'Guild', 'guild'));
  joinGame(game, newPlayer(neutral, 'Harkonnen', 'harkonnen'));
  game.nexusCards = { cards: null, phase: null };
  for (const player of game.players) game = stepNexusEmperorPayment(game, { actor: player.id, action: { type: 'ready' } }, actions);
  game = scalarEntropy(() => initializeNexusGameForAudit(game));
  assert.equal(game.status, 'setup');
  assert.ok(game.players.every(player => player.hand.length === 0));
  // Both printed Karama cards are actually dealt by the original starting-card
  // routine: one keeps Guild's ordinary payment choice, one can cancel income.
  const prefix = [];
  for (const kind of ['worthless', 'worthless', 'karama', 'karama', options.truthtrance ? 'truthtrance' : 'worthless']) {
    const index = game.deck.findIndex(card => kind === 'worthless' ? card.kind === kind : card.effect === kind);
    assert.ok(index >= 0);
    prefix.push(game.deck.splice(index, 1)[0]);
  }
  game.deck.unshift(...prefix);
  staging.push('Ordered five original undealt starting Treachery singletons before their native setup deal.');
  const initial = structuredClone(game);
  game = advanceNexusEmperorPayment(game, state => state.status === 'playing', actions);
  const afterSetup = structuredClone(game);
  const karama = nexusEmperorPaymentPlayer(game, neutral).hand.find(card => card.effect === 'karama')!.id;
  assert.ok(nexusEmperorPaymentPlayer(game, winner).hand.some(card => card.effect === 'karama'));
  game = advanceNexusEmperorPayment(game, state => state.phase === 1 && clean(state), actions);
  frontOriginalSpice(game, ['land', 'land']);
  staging.push('Ordered original undealt non-worm first-turn Spice Cards; no first-turn Nexus manufactured.');
  let firstMentat: NexusEmperorPaymentTransition | undefined;
  while (game.turn === 1) {
    const before = structuredClone(game), step = nextNexusEmperorPaymentStep(game);
    game = stepNexusEmperorPayment(game, step, actions);
    if (game.turn === 2) firstMentat = { before, step, after: structuredClone(game) };
  }
  assert.ok(firstMentat);
  game = advanceNexusEmperorPayment(game, state => state.turn === 2 && state.phase === 1 && clean(state), actions);
  frontOriginalSpice(game, ['worm', 'land', 'land']);
  staging.push('Ordered original still-undealt turn-two worm and subsequent land singletons.');
  game = advanceNexusEmperorPayment(game, state => !!state.nexus && !state.spiceWindow &&
    !state.spiceResolution && clean(state), actions);
  const worm = structuredClone(game);
  for (const [actor, target] of [[emperor, winner], [winner, emperor]])
    game = stepNexusEmperorPayment(game, { actor, action: { type: 'alliance', target } }, actions);
  assert.equal(nexusEmperorPaymentPlayer(game, emperor).ally, winner);
  assert.equal(nexusEmperorPaymentPlayer(game, winner).ally, emperor);
  const alliance = structuredClone(game);
  game = advanceNexusEmperorPayment(game, state => state.nexusCards?.phase?.stage === 'drawing' && clean(state), actions);
  const cards = game.nexusCards!.cards!;
  const index = cards.deck.indexOf('emperor'); assert.ok(index >= 0);
  cards.deck.unshift(cards.deck.splice(index, 1)[0]);
  staging.push('Ordered original undealt Emperor Nexus singleton immediately before its real closing draw.');
  const beforeDraw = structuredClone(game);
  const drawStep: NexusEmperorPaymentStep = { actor: owner, action: { type: 'nexusCardChoice',
    turn: game.turn, card: null, choice: 'draw', ownRedraws: 0 } };
  game = stepNexusEmperorPayment(game, drawStep, actions);
  assert.equal(game.nexusCards!.cards!.hands[owner], 'emperor');
  const draw = { before: beforeDraw, step: drawStep, after: structuredClone(game) };
  if (options.neutralHolder ?? true) {
    const irrelevant = game.nexusCards!.cards!.deck.indexOf('fremen'); assert.ok(irrelevant >= 0);
    game.nexusCards!.cards!.deck.unshift(game.nexusCards!.cards!.deck.splice(irrelevant, 1)[0]);
    staging.push('Ordered original undealt irrelevant Fremen Nexus singleton for the other unallied closing draw.');
    game = stepNexusEmperorPayment(game, { actor: neutral, action: { type: 'nexusCardChoice',
      turn: game.turn, card: null, choice: 'draw', ownRedraws: 0 } }, actions);
  } else game = stepNexusEmperorPayment(game, { actor: neutral, action: { type: 'nexusCardChoice',
    turn: game.turn, card: null, choice: 'keep', ownRedraws: 0 } }, actions);
  const afterClosingDraw = structuredClone(game);
  game = advanceNexusEmperorPayment(game, state => state.phase === 3 && !!state.auction && clean(state), actions);
  assert.equal(game.turn, 2);
  assert.ok(game.order.indexOf(neutral) < game.order.indexOf(owner), 'The real later storm order provides a neutral responder before Use');
  const beforeFunding = structuredClone(game);
  const emperorBeforeAid = nexusEmperorPaymentPlayer(game, emperor).spice;
  if (matchingAid) game = stepNexusEmperorPayment(game, { actor: emperor,
    action: { type: 'pledgeAid', amount: matchingAid } }, actions);
  while (game.auction!.active !== winner)
    game = stepNexusEmperorPayment(game, { actor: game.auction!.active, action: { type: 'passBid' } }, actions);
  const beforeBid = structuredClone(game), acquired = game.auction!.cards[game.auction!.index].id;
  game = stepNexusEmperorPayment(game, { actor: winner, action: { type: 'bid', amount: price, allyPayment: matchingAid } }, actions);
  game = advanceNexusEmperorPayment(game, state => state.decision?.kind === 'nexusEmperorPayment', actions);
  assert.equal(game.auction!.bid, price); assert.equal(game.auction!.bidder, winner);
  assert.equal(game.auction!.cards[game.auction!.index].id, acquired);
  assert.equal(nexusEmperorPaymentPlayer(game, winner).hand.some(card => card.id === acquired), false);
  const decision = game.decision;
  assert.ok(decision?.kind === 'nexusEmperorPayment');
  nexusEmperorPaymentInventory(game);
  return { game, owner, emperor, winner, neutral, event: decision.event, price, acquired, karama,
    originalCards: nexusEmperorPaymentCards(game), actions, staging,
    chronology: { initial, afterSetup, firstMentat, worm, alliance, draw, afterClosingDraw, beforeFunding, beforeBid },
    wallets: { winner: nexusEmperorPaymentPlayer(game, winner).spice, emperorBeforeAid,
      emperor: nexusEmperorPaymentPlayer(game, emperor).spice, matchingAid } };
}
