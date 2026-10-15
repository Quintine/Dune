import assert from 'node:assert/strict';
import {
  applyAction, createGame, handLimit, initializePairedNexusGameForAudit, joinGame, newPlayer,
  type Action, type Game,
} from '../game/engine';
import type { Card } from '../game/cards';
import { quoteEmperorNexusSpecialPurchase } from '../game/nexus-emperor-purchase';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';
import { frontNativeHomeworldSpice } from './fixture-homeworld-native-e1e2-modules';
import {
  nextNexusEmperorSellerStep, nexusEmperorSellerCards, nexusEmperorSellerInventory,
  nexusEmperorSellerPlayer,
} from './fixture-nexus-emperor-seller';

export type NexusEmperorSpecialStep = { actor: string; action: Action };
export type NexusEmperorSpecialTransition = {
  before: Game; step: NexusEmperorSpecialStep; after: Game;
};
export type NexusEmperorSpecialFixture = {
  game: Game; owner: string; event: string; activation: string; acquire: string;
  wallets: Record<string, number>; actions: NexusEmperorSpecialStep[];
  chronology: {
    initial: Game; undealt: Game; afterSetup: Game; firstMentat: NexusEmperorSpecialTransition;
    worm: Game; alliance: Game; draw: NexusEmperorSpecialTransition; afterClosingDraw: Game;
    cacheResolutions: NexusEmperorSpecialTransition[];
    ordinaryPurchases: NexusEmperorSpecialTransition[];
  };
};
export const nexusEmperorSpecialPlayer = nexusEmperorSellerPlayer;
export const nexusEmperorSpecialCards = nexusEmperorSellerCards;
export const nexusEmperorSpecialInventory = nexusEmperorSellerInventory;
export const nexusEmperorSpecialClean = (g: Game): boolean =>
  !g.phaseOpening && !g.response && !g.decision && !g.truthtrance && !g.pendingTreacheryDiscard;

export function stepNexusEmperorSpecial(game: Game, step: NexusEmperorSpecialStep,
  actions?: NexusEmperorSpecialStep[]): Game {
  actions?.push(structuredClone(step));
  return withClassicDiscoveryNexusLottery(() =>
    applyAction(structuredClone(game), step.actor, structuredClone(step.action)));
}

/** Quiet original choices preserve the setup Karama and the privately held Nexus.
 * Cache depletion is nine actual unbid resolutions, never a cache assignment. */
export function nextNexusEmperorSpecialStep(game: Game): NexusEmperorSpecialStep {
  if (!game.phaseOpening && !game.response && game.decision?.kind === 'richeseCache') {
    const card = game.richeseCache!.find(c => c.id === 'richese-stone-burner') ??
      game.richeseCache!.find(c => c.id !== 'richese-karama') ?? game.richeseCache![0];
    assert.ok(card);
    return { actor: game.decision.player, action: { type: 'decision',
      event: game.richeseBidding!.event, card: card.id,
      method: 'onceAround', direction: 'counterclockwise' } };
  }
  if (!game.phaseOpening && !game.response && game.decision?.kind === 'richeseUnbid') {
    const owner = nexusEmperorSpecialPlayer(game, game.decision.player);
    return { actor: owner.id, action: { type: 'decision', event: game.richeseBidding!.event,
      keep: game.richeseAuction!.cardId === 'richese-stone-burner' && owner.hand.length < handLimit(owner) } };
  }
  return nextNexusEmperorSellerStep(game);
}
export function advanceNexusEmperorSpecial(game: Game, until: (game: Game) => boolean,
  actions?: NexusEmperorSpecialStep[]): Game {
  for (let n = 0; n < 2600; n++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    game = stepNexusEmperorSpecial(game, nextNexusEmperorSpecialStep(game), actions);
  }
  throw Error('The original special purchase chronology did not reach its requested boundary');
}

/** Native paired Richese/CHOAM setup, actual first Mentat, other-seat pact and
 * real closing Emperor draw. Only original undealt Treachery/Spice/Nexus order
 * and scoped initializer entropy are selected. No played hand, balance, faction,
 * force, clock, receipt or reaction frame is installed by this producer. */
export function createNexusEmperorSpecialFixture(options: {
  nexusCard?: 'emperor' | 'guild'; fullHand?: boolean; lastCache?: boolean;
  advanced?: boolean; phase?: 2 | 4 | 5;
  sellerIncome?: boolean;
} = {}): NexusEmperorSpecialFixture {
  const owner = 'richese', advanced = options.advanced ?? true;
  const actions: NexusEmperorSpecialStep[] = [];
  const cacheResolutions: NexusEmperorSpecialTransition[] = [];
  const ordinaryPurchases: NexusEmperorSpecialTransition[] = [];
  let game = createGame('NEXUSEMPERORSPECIAL', newPlayer(owner, 'Richese', 'richese'), advanced, ['choam']);
  for (const faction of ['choam', 'harkonnen', 'fremen'] as const)
    joinGame(game, newPlayer(faction, faction, faction));
  game.nexusCards = { cards: null, phase: null };
  const initial = structuredClone(game);
  for (const player of game.players)
    game = stepNexusEmperorSpecial(game, { actor: player.id, action: { type: 'ready' } }, actions);
  game = withClassicDiscoveryNexusLottery(() => initializePairedNexusGameForAudit(game));
  assert.equal(game.status, 'setup');
  assert.ok(game.players.every(player => !player.hand.length));
  const front: Card[] = [];
  // Original setup order deals Richese first and Harkonnen two physical cards.
  for (const effect of ['karama', 'worthless', 'worthless', 'worthless', 'worthless']) {
    const index = game.deck.findIndex(card => effect === 'worthless' ? card.kind === effect : card.effect === effect);
    assert.ok(index >= 0); front.push(game.deck.splice(index, 1)[0]);
  }
  game.deck.unshift(...front);
  const undealt = structuredClone(game);
  game = advanceNexusEmperorSpecial(game, state => state.status === 'playing', actions);
  const afterSetup = structuredClone(game);
  const activation = nexusEmperorSpecialPlayer(game, owner).hand.find(c => c.effect === 'karama')!.id;
  assert.equal(nexusEmperorSpecialPlayer(game, owner).hand.length, 1);

  function runOriginal(step: NexusEmperorSpecialStep): NexusEmperorSpecialTransition {
    const before = structuredClone(game);
    game = stepNexusEmperorSpecial(game, step, actions);
    const transition = { before, step: structuredClone(step), after: structuredClone(game) };
    if ((before.richeseCache?.length ?? 0) === (game.richeseCache?.length ?? 0) + 1)
      cacheResolutions.push(transition);
    if (before.auction && nexusEmperorSpecialPlayer(game, owner).hand.length >
      nexusEmperorSpecialPlayer(before, owner).hand.length) ordinaryPurchases.push(transition);
    return transition;
  }
  function advanceOriginal(until: (state: Game) => boolean): void {
    for (let n = 0; n < 2600; n++) {
      if (until(game)) return;
      assert.notEqual(game.status, 'finished');
      runOriginal(nextNexusEmperorSpecialStep(game));
    }
    throw Error('Original native cache chronology did not reach its requested boundary');
  }

  advanceOriginal(state => state.phase === 1 && nexusEmperorSpecialClean(state));
  frontNativeHomeworldSpice(game, card => 'territory' in card && card.territory === 'hagga_basin', 0);
  if (advanced) frontNativeHomeworldSpice(game, card => 'territory' in card && card.territory === 'broken_land', 1);
  let firstMentat: NexusEmperorSpecialTransition | undefined;
  while (game.turn === 1) {
    let step = nextNexusEmperorSpecialStep(game);
    // Two actual one-spice ordinary wins complete the full native hand after
    // the first unbid cache card is kept. No card transfer or wallet staging.
    if (options.fullHand && nexusEmperorSpecialClean(game) && game.phase === 3 && game.auction &&
      game.auction.active === owner && !game.auction.bid &&
      nexusEmperorSpecialPlayer(game, owner).hand.length < handLimit(nexusEmperorSpecialPlayer(game, owner)))
      step = { actor: owner, action: { type: 'bid', amount: 1 } };
    if (options.sellerIncome && nexusEmperorSpecialClean(game) &&
      game.richeseAuction?.source === 'cache' && game.richeseAuction.active === 'harkonnen' &&
      !game.richeseAuction.outcome && game.richeseAuction.bid === 0)
      step = { actor: 'harkonnen', action: { type: 'richeseBid', event: game.richeseAuction.event, amount: 1 } };
    const transition = runOriginal(step);
    if (transition.after.turn === 2) firstMentat = transition;
  }
  assert.ok(firstMentat);
  assert.equal(firstMentat.before.phase, 8);
  if (options.fullHand) {
    assert.equal(ordinaryPurchases.length, 2);
    assert.equal(nexusEmperorSpecialPlayer(game, owner).hand.length, handLimit(nexusEmperorSpecialPlayer(game, owner)));
  }
  advanceOriginal(state => state.turn === 2 && state.phase === 1 && nexusEmperorSpecialClean(state) &&
    !state.spiceSequence && !state.spiceResolution && !state.spiceWindow && !state.nexus && !state.ready.length);
  frontNativeHomeworldSpice(game, card => 'worm' in card && !card.greatMaker && !card.suppressed && !card.thumper, 0);
  frontNativeHomeworldSpice(game, card => 'territory' in card && card.territory === 'rock_outcroppings', 1);
  if (advanced) frontNativeHomeworldSpice(game, card => 'territory' in card && card.territory === 'oh_gap', 2);
  advanceOriginal(state => !!state.nexus && !state.spiceWindow && !state.spiceResolution && nexusEmperorSpecialClean(state));
  const worm = structuredClone(game);
  for (const [actor, target] of [['choam', 'fremen'], ['fremen', 'choam']])
    runOriginal({ actor, action: { type: 'alliance', target } });
  const alliance = structuredClone(game);
  advanceOriginal(state => state.nexusCards?.phase?.stage === 'drawing' && nexusEmperorSpecialClean(state));
  assert.ok(game.nexusCards!.phase!.eligible.includes(owner));
  const cards = game.nexusCards!.cards!, at = cards.deck.indexOf(options.nexusCard ?? 'emperor');
  assert.ok(at >= 0); cards.deck.unshift(cards.deck.splice(at, 1)[0]);
  const draw = runOriginal({ actor: owner, action: { type: 'nexusCardChoice', turn: game.turn,
    card: cards.hands[owner], choice: 'draw', ownRedraws: 0 } });
  advanceOriginal(state => state.phase === 2 && nexusEmperorSpecialClean(state));
  const afterClosingDraw = structuredClone(game);
  assert.equal(nexusEmperorSpecialPlayer(game, owner).ally, null);
  assert.equal(game.nexusCards!.cards!.hands[owner], options.nexusCard ?? 'emperor');
  if (options.lastCache) {
    advanceOriginal(state => state.richeseCache?.length === 1 && state.phase === 4 && nexusEmperorSpecialClean(state));
    assert.equal(cacheResolutions.length, 9);
    assert.equal(game.richeseCache![0].id, 'richese-karama');
  }
  const phase = options.phase ?? (options.lastCache ? 4 : 2);
  advanceOriginal(state => state.phase === phase && nexusEmperorSpecialClean(state));
  assert.ok(nexusEmperorSpecialPlayer(game, owner).hand.some(c => c.id === activation));
  assert.equal(!!nexusEmperorSpecialPlayer(game, owner).specialKaramaUsed, false);
  assert.ok(nexusEmperorSpecialPlayer(game, owner).spice >= 3);
  const acquire = game.richeseCache!.find(c => c.id === 'richese-karama')!.id;
  const event = quoteEmperorNexusSpecialPurchase(game, owner).event;
  nexusEmperorSpecialInventory(game);
  return { game, owner, event, activation, acquire, actions,
    wallets: Object.fromEntries(game.players.map(player => [player.id, player.spice])),
    chronology: { initial, undealt, afterSetup, firstMentat, worm, alliance, draw, afterClosingDraw,
      cacheResolutions, ordinaryPurchases } };
}
