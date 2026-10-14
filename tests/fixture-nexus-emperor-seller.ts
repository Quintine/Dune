import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializePairedNexusGameForAudit, initializeRicheseBetrayalGameForAudit, joinGame, newPlayer,
  type Action, type Game, type Player,
} from '../game/engine';
import type { Card } from '../game/cards';
import { treacheryDeck } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import { validateNexusCards } from '../game/nexus-cards';
import { nextPairedChoamStep } from './fixture-paired-choam-nexus-modules';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';
import { frontNativeHomeworldSpice } from './fixture-homeworld-native-e1e2-modules';

export type NexusEmperorSellerStep = { actor: string; action: Action };
export type NexusEmperorSellerTransition = { before: Game; step: NexusEmperorSellerStep; after: Game };
export type NexusEmperorSellerFixture = {
  game: Game; event: string; winner: string; seller: string; source: 'cache' | 'blackMarket';
  card: Card; price: number; round: string; lot: string;
  wallets: Record<string, number>; originalCards: string[]; actions: NexusEmperorSellerStep[];
  chronology: {
    initial: Game; undealt: Game; afterSetup: Game; firstMentat: NexusEmperorSellerTransition;
    worm: Game; alliance: Game; draw: NexusEmperorSellerTransition; afterClosingDraw: Game;
    beforeOffer: Game; beforeWinnerBid: Game; beforeFinalBid: Game;
  };
};
export function nexusEmperorSellerPlayer(game: Game, id: string): Player {
  const player = game.players.find(candidate => candidate.id === id);
  assert.ok(player, `Missing original seller-lot seat ${id}`);
  return player;
}
const clean = (game: Game) => !game.phaseOpening && !game.response && !game.decision &&
  !game.truthtrance && !game.pendingTreacheryDiscard;
export function stepNexusEmperorSeller(game: Game, step: NexusEmperorSellerStep,
  actions?: NexusEmperorSellerStep[]): Game {
  actions?.push(structuredClone(step));
  return withClassicDiscoveryNexusLottery(() => applyAction(game, step.actor, step.action));
}
/** Consume only original owner-labelled choices; never manufacture a private plan. */
export function nextNexusEmperorSellerStep(game: Game): NexusEmperorSellerStep {
  if (clean(game) && game.nexusCards?.phase?.stage === 'drawing') {
    const actor = game.nexusCards.phase.eligible.find(id => !game.nexusCards!.phase!.done.includes(id));
    assert.ok(actor);
    return { actor, action: { type: 'nexusCardChoice', turn: game.turn,
      card: game.nexusCards.cards!.hands[actor], choice: 'keep', ownRedraws: 0 } };
  }
  if (!game.phaseOpening && !game.response && game.decision?.kind === 'nexusEmperorSellerPurchase')
    return { actor: game.decision.player,
      action: { type: 'nexusEmperorSellerPurchase', event: game.decision.event, use: false } };
  const next = nextPairedChoamStep(game);
  assert.ok(next, 'The original seller chronology requires a real human battle plan');
  return next;
}
export function advanceNexusEmperorSeller(game: Game, until: (game: Game) => boolean,
  actions?: NexusEmperorSellerStep[]): Game {
  for (let n = 0; n < 2000; n++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    game = stepNexusEmperorSeller(game, nextNexusEmperorSellerStep(game), actions);
  }
  throw Error('The original seller chronology did not reach its requested boundary');
}
/** Original physical zones, excluding historical ordinary-auction aliases. */
export function nexusEmperorSellerCards(game: Game): string[] {
  return [...game.deck, ...game.discard, ...game.players.flatMap(player => player.hand),
    ...(game.richeseCache ?? []), ...(game.richeseRemoved ?? []),
    ...(game.auction?.cards.slice(game.auction.index + Number(!!game.currentAuctionSale &&
      game.currentAuctionSale.origin === 'normal')) ?? [])].map(card => card.id).sort();
}
export function nexusEmperorSellerInventory(game: Game): void {
  validateNexusCards(game.nexusCards!.cards!, game.players);
  assert.deepEqual(nexusEmperorSellerCards(game),
    [...treacheryDeck(['choam']), ...richeseCards()].map(card => card.id).sort());
  for (const player of game.players) {
    assert.equal(player.reserves + player.tanks + Object.values(player.forces).reduce((sum, n) => sum + n, 0), 20);
    if (player.elites) assert.equal(player.elites.reserves + player.elites.tanks +
      Object.values(player.elites.forces).reduce((sum, n) => sum + n, 0), 3);
  }
}

/** Native Basic/Advanced paired Richese/CHOAM with classic seats. Starting cards,
 * first turn, later worm/alliance/closing Nexus draw and winning bid are actual
 * source actions. Only undealt singleton order/scoped scalar entropy is selected;
 * hands, balances, counters, alliances, clocks and receipts are never assigned. */
export function createNexusEmperorSellerFixture(options: {
  advanced?: boolean; source?: 'cache' | 'blackMarket'; winnerFaction?: 'harkonnen' | 'richese';
  nexusCard?: 'emperor' | 'guild'; truthtrance?: boolean;
  betrayal?: 'pass' | 'bank' | 'before';
} = {}): NexusEmperorSellerFixture {
  const source = options.source ?? 'cache', advanced = options.advanced ?? source === 'blackMarket';
  const winner = options.winnerFaction ?? 'harkonnen', seller = 'richese', price = 2;
  assert.ok(source !== 'blackMarket' || advanced, 'Original Black Market is Advanced only');
  assert.ok(source !== 'blackMarket' || winner !== seller, 'Original Black Market excludes seller self-purchase');
  const actions: NexusEmperorSellerStep[] = [];
  let game = createGame('NEXUSEMPERORSELLER', newPlayer(seller, 'Richese', 'richese'), advanced, ['choam']);
  for (const faction of ['choam', 'harkonnen', 'fremen'] as const)
    joinGame(game, newPlayer(faction, faction, faction));
  if (options.betrayal) joinGame(game, newPlayer('guild', 'Guild', 'guild'));
  game.nexusCards = { cards: null, phase: null };
  const initial = structuredClone(game);
  for (const player of game.players)
    game = stepNexusEmperorSeller(game, { actor: player.id, action: { type: 'ready' } }, actions);
  game = withClassicDiscoveryNexusLottery(() => options.betrayal
    ? initializeRicheseBetrayalGameForAudit(game) : initializePairedNexusGameForAudit(game));
  assert.equal(game.status, 'setup');
  assert.ok(game.players.every(player => player.hand.length === 0));
  const prefix: Card[] = [];
  // A real setup-dealt Karama retains native source/bonus cancellation windows;
  // the quiet driver passes them rather than fabricating a response frame.
  for (const effect of ['worthless', options.truthtrance ? 'truthtrance' : 'worthless', 'worthless', 'worthless', 'karama']) {
    const index = game.deck.findIndex(card => effect === 'worthless' ? card.kind === effect : card.effect === effect);
    assert.ok(index >= 0);
    prefix.push(game.deck.splice(index, 1)[0]);
  }
  game.deck.unshift(...prefix);
  const undealt = structuredClone(game);
  game = advanceNexusEmperorSeller(game, state => state.status === 'playing', actions);
  const afterSetup = structuredClone(game);
  assert.equal(nexusEmperorSellerPlayer(game, 'harkonnen').hand.length, 2);
  assert.equal(nexusEmperorSellerPlayer(game, seller).hand.length, 1);
  game = advanceNexusEmperorSeller(game, state => state.phase === 1 && clean(state), actions);
  frontNativeHomeworldSpice(game, card => 'territory' in card && card.territory === 'hagga_basin', 0);
  if (advanced) frontNativeHomeworldSpice(game, card => 'territory' in card && card.territory === 'broken_land', 1);
  let firstMentat: NexusEmperorSellerTransition | undefined;
  while (game.turn === 1) {
    const before = structuredClone(game), step = nextNexusEmperorSellerStep(game);
    game = stepNexusEmperorSeller(game, step, actions);
    if (game.turn === 2) firstMentat = { before, step, after: structuredClone(game) };
  }
  assert.ok(firstMentat);
  assert.equal(firstMentat.before.phase, 8);
  game = advanceNexusEmperorSeller(game, state => state.turn === 2 && state.phase === 1 && clean(state) &&
    !state.spiceSequence && !state.spiceResolution && !state.spiceWindow && !state.nexus && !state.ready.length, actions);
  frontNativeHomeworldSpice(game, card => 'worm' in card && !card.greatMaker && !card.suppressed && !card.thumper, 0);
  frontNativeHomeworldSpice(game, card => 'territory' in card && card.territory === 'rock_outcroppings', 1);
  if (advanced) frontNativeHomeworldSpice(game, card => 'territory' in card && card.territory === 'oh_gap', 2);
  game = advanceNexusEmperorSeller(game, state => !!state.nexus && !state.spiceWindow && !state.spiceResolution && clean(state), actions);
  const worm = structuredClone(game);
  for (const [actor, target] of [['choam', 'fremen'], ['fremen', 'choam']])
    game = stepNexusEmperorSeller(game, { actor, action: { type: 'alliance', target } }, actions);
  const alliance = structuredClone(game);
  game = advanceNexusEmperorSeller(game, state => state.nexusCards?.phase?.stage === 'drawing' && clean(state), actions);
  assert.ok(game.nexusCards!.phase!.eligible.includes(winner));
  const cards = game.nexusCards!.cards!, index = cards.deck.indexOf(options.nexusCard ?? 'emperor');
  assert.ok(index >= 0);
  cards.deck.unshift(cards.deck.splice(index, 1)[0]);
  const drawBefore = structuredClone(game), drawStep: NexusEmperorSellerStep = { actor: winner,
    action: { type: 'nexusCardChoice', turn: game.turn, card: cards.hands[winner], choice: 'draw', ownRedraws: 0 } };
  game = stepNexusEmperorSeller(game, drawStep, actions);
  const draw = { before: drawBefore, step: drawStep, after: structuredClone(game) };
  if (options.betrayal) {
    const remaining = game.nexusCards!.cards!, richese = remaining.deck.indexOf('richese');
    assert.ok(richese >= 0);
    remaining.deck.unshift(remaining.deck.splice(richese, 1)[0]);
    game = stepNexusEmperorSeller(game, { actor: 'guild', action: { type: 'nexusCardChoice',
      turn: game.turn, card: remaining.hands.guild, choice: 'draw', ownRedraws: 0 } }, actions);
  }
  game = advanceNexusEmperorSeller(game, state => state.phase === 2 && clean(state), actions);
  const afterClosingDraw = structuredClone(game);
  assert.equal(nexusEmperorSellerPlayer(game, winner).ally, null);
  assert.ok(!game.players.some(player => player.faction === 'emperor'));
  game = advanceNexusEmperorSeller(game, state => !state.phaseOpening && !state.response &&
    state.decision?.kind === (source === 'cache' ? 'richeseCache' : 'richeseBlackMarket'), actions);
  const beforeOffer = structuredClone(game);
  const card = structuredClone(source === 'cache' ? game.richeseCache![0] : nexusEmperorSellerPlayer(game, seller).hand[0]);
  const round = game.richeseBidding!.event;
  game = stepNexusEmperorSeller(game, { actor: seller,
    action: { type: 'decision', event: round, card: card.id, method: 'silent' } }, actions);
  game = advanceNexusEmperorSeller(game, state => !state.phaseOpening && !state.response && !state.decision, actions);
  const lot = game.richeseAuction!.event;
  let beforeFinalBid = structuredClone(game);
  let beforeWinnerBid: Game | undefined;
  while (!game.richeseAuction!.outcome) {
    const auction = game.richeseAuction!;
    const actor = auction.order.find(id => auction.eligible.includes(id) && !Object.hasOwn(auction.sealed, id));
    assert.ok(actor);
    beforeFinalBid = structuredClone(game);
    if (actor === winner) beforeWinnerBid = structuredClone(game);
    game = stepNexusEmperorSeller(game, { actor,
      action: { type: 'richeseBid', event: lot, amount: actor === winner ? price : 0 } }, actions);
  }
  assert.ok(beforeWinnerBid);
  if (options.betrayal && options.betrayal !== 'before') {
    while (game.pendingRicheseBetrayal) {
      const receipt = game.pendingRicheseBetrayal.receipt;
      const actor = receipt.required.find(id => !receipt.passed.includes(id));
      assert.ok(actor);
      game = stepNexusEmperorSeller(game, { actor, action: {
        type: actor === 'guild' && options.betrayal === 'bank' ? 'richeseBetrayalUse' : 'richeseBetrayalPass',
        event: receipt.event,
      } }, actions);
    }
  }
  if (options.betrayal === 'before') assert.ok(game.pendingRicheseBetrayal);
  else {
    assert.equal(game.decision?.kind, 'nexusEmperorSellerPurchase');
    assert.equal(game.decision.player, winner);
  }
  assert.equal(game.richeseAuction!.cardId, card.id);
  assert.deepEqual(game.richeseAuction!.outcome, { kind: 'sold', winner, amount: price });
  assert.ok(nexusEmperorSellerPlayer(game, winner).spice >= price);
  assert.equal(nexusEmperorSellerPlayer(game, winner).hand.some(held => held.id === card.id), false);
  const wallets = Object.fromEntries(game.players.map(player => [player.id, player.spice]));
  const originalCards = nexusEmperorSellerCards(game);
  nexusEmperorSellerInventory(game);
  return { game, event: game.decision?.kind === 'nexusEmperorSellerPurchase' ? game.decision.event :
    game.pendingRicheseBetrayal!.receipt.event, winner, seller, source, card, price, round, lot,
    wallets, originalCards, actions, chronology: { initial, undealt, afterSetup, firstMentat,
      worm, alliance, draw, afterClosingDraw, beforeOffer, beforeWinnerBid, beforeFinalBid } };
}
