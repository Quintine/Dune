import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeSemutaGameForAudit, joinGame, newPlayer,
  type Action, type Game,
} from '../game/engine';
import type { Card } from '../game/cards';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { nextRicheseSkillsTechNativeStep } from './fixture-richese-skills-tech';
import {
  moveSemutaEmperorCard, semutaEmperorCardId, semutaEmperorPlayer,
} from './fixture-semuta-emperor-share';

export type SemutaEmperorIncomeKind = 'emperorIncome' | 'richesePurchaseIncome';
export type SemutaEmperorIncomeFixture = {
  game: Game;
  beforePayment: Game;
  sourceActions: { actor: string; action: Action }[];
  owner: string;
  holder: string;
  buyer: string;
  canceler: string;
  karama: string;
  karamaCard: Card;
  acquired: string;
  special?: string;
  amount: number;
  kind: SemutaEmperorIncomeKind;
  cancel: Action;
  originalCards: string[];
  staging: string[];
};

/** Original ownership zones only; the paid auction prefix is a reference, not another card. */
export function semutaEmperorIncomeCards(game: Game): string[] {
  return [
    ...game.deck, ...game.discard, ...(game.richeseCache ?? []), ...(game.richeseRemoved ?? []),
    ...game.players.flatMap(player => player.hand),
    ...(game.auction?.cards.slice(game.auction.index + Number(!!game.currentAuctionSale)) ?? []),
  ].map(card => card.id).sort();
}

export function nextSemutaEmperorIncomeStep(game: Game): { actor: string; action: Action } {
  const pending = game.pendingTreacheryDiscard;
  const reaction = pending?.reaction;
  if (reaction?.stage === 'offer' && pending) {
    const actor = game.players.find(player => !reaction.passed.includes(player.id))!.id;
    return { actor, action: { type: 'semutaPass', event: pending.batch.event } };
  }
  return nextRicheseSkillsTechNativeStep(game);
}

function reach(state: Game, until: (game: Game) => boolean): Game {
  let game = state;
  for (let n = 0; !until(game) && n < 1400; n++) {
    assert.notEqual(game.status, 'finished', 'Native actions must reach the original income source');
    const next = nextSemutaEmperorIncomeStep(game);
    game = applyAction(game, next.actor, next.action);
  }
  assert.ok(until(game), 'Native actions must reach the requested source boundary');
  return game;
}

/** Move an original physical card to the next native draw, without replacing the deck. */
function nextOriginalDraw(game: Game, id: string): void {
  for (const zone of [game.deck, game.discard, game.richeseCache ?? [],
    game.richeseRemoved ?? [], ...game.players.map(player => player.hand)]) {
    const index = zone.findIndex(card => card.id === id);
    if (index < 0) continue;
    const card = zone.splice(index, 1)[0];
    game.deck.unshift(card);
    return;
  }
  throw new Error(`Missing original draw ${id}`);
}

function fillHolder(game: Game): void {
  const holder = semutaEmperorPlayer(game, 'r');
  while (holder.hand.length < 4) {
    const card = game.deck.find(candidate => candidate.effect !== 'karama');
    assert.ok(card);
    moveSemutaEmperorCard(game, card.id, holder.id);
  }
  assert.equal(holder.hand.length, 4);
}

/** Fresh original setup and first-turn phase actions. Only unplayed Spice order and
 * conserved later physical cards are staged; no clocks, wallets, allies or stocks are minted.
 * Purchase is made inside the genuine Richese declaration, so its original owner must return.
 * The auction optionally buys the very printed Karama that the winner then spends on income. */
export function createSemutaEmperorIncomeFixture(
  kind: SemutaEmperorIncomeKind,
  options: { acquiredKarama?: boolean } = {},
): SemutaEmperorIncomeFixture {
  const advanced = kind === 'richesePurchaseIncome';
  let game = createGame('SEMUTAINCOME', newPlayer('r', 'Richese', 'richese'), advanced, ['choam']);
  joinGame(game, newPlayer('e', 'Emperor', 'emperor'));
  joinGame(game, newPlayer('a', 'Atreides', 'atreides'));
  for (const player of game.players) game = applyAction(game, player.id, { type: 'ready' });
  game = initializeSemutaGameForAudit(game);
  const originalCards = semutaEmperorIncomeCards(game);
  const staging: string[] = [];
  game = reach(game, state => state.status === 'playing');
  // Control only the two still-unplayed original first-turn blows.
  for (let position = 0; position < 2; position++) {
    const index = game.spiceDeck.findIndex((card, i) => i >= position && 'territory' in card);
    assert.ok(index >= position);
    game.spiceDeck.splice(position, 0, game.spiceDeck.splice(index, 1)[0]);
  }
  staging.push('Two unplayed original non-worm Spice Cards precede native first-turn Charity/Bidding.');
  game = reach(game, state => state.phase === 2 && !state.phaseOpening && !state.response && !state.decision);
  moveSemutaEmperorCard(game, SEMUTA_DRUG_ID, 'r');
  let special: string | undefined;
  if (advanced) {
    special = moveSemutaEmperorCard(game,
      semutaEmperorCardId(game, card => card.effect === 'karama'), 'r');
  }
  const karama = semutaEmperorCardId(game,
    card => card.effect === 'karama' && card.id !== special);
  if (options.acquiredKarama) nextOriginalDraw(game, karama);
  else moveSemutaEmperorCard(game, karama, 'a');
  staging.push('Original Semuta moves from cache to Richese; original printed Karama custody is conserved.');
  if (!advanced) {
    const inspectionCounter = semutaEmperorCardId(game,
      card => card.effect === 'karama' && card.id !== karama);
    moveSemutaEmperorCard(game, inspectionCounter, 'e');
    staging.push('The other original printed Karama is held by Emperor, qualifying the next Atreides inspection response.');
  }
  const sourceActions: { actor: string; action: Action }[] = [];
  let beforePayment: Game;
  let acquired: string;
  if (advanced) {
    fillHolder(game);
    staging.push('Original later deck cards fill Richese to its four-card limit, including its separate activation.');
    game = reach(game, state => state.decision?.kind === 'richeseDeclaration' && !state.response && !state.phaseOpening);
    assert.equal(game.decision!.player, 'r');
    beforePayment = structuredClone(game);
    acquired = game.richeseCache![0].id;
    const purchase: Action = { type: 'card', mode: 'special', card: special!, acquire: acquired };
    sourceActions.push({ actor: 'r', action: purchase });
    game = applyAction(game, 'r', purchase);
  } else {
    if (!options.acquiredKarama) {
      const first = game.deck.find(card => card.effect !== 'karama');
      assert.ok(first);
      acquired = first.id;
      nextOriginalDraw(game, acquired);
    } else acquired = karama;
    staging.push(`Original ${acquired} is moved to the next native ordinary-pool draw, not a replacement deck.`);
    game = reach(game, state => !!state.auction && state.phase === 3 &&
      !state.phaseOpening && !state.response && !state.decision);
    assert.equal(game.auction!.cards[game.auction!.index].id, acquired);
    assert.ok(game.auction!.cards.length >= 2, 'The native ordinary pool must have a successor lot');
    fillHolder(game);
    staging.push('Conserved later deck cards bring Semuta holder to hand4 after the original pool is drawn.');
    for (let n = 0; game.auction!.active !== 'a' && n < 6; n++)
      game = applyAction(game, game.auction!.active, { type: 'passBid' });
    assert.equal(game.auction!.active, 'a');
    beforePayment = structuredClone(game);
    sourceActions.push({ actor: 'a', action: { type: 'bid', amount: 1 } });
    game = applyAction(game, 'a', sourceActions[0].action);
    for (let n = 0; !game.response && n < 8; n++) {
      const next = nextSemutaEmperorIncomeStep(game);
      sourceActions.push(next);
      game = applyAction(game, next.actor, next.action);
    }
  }
  assert.equal(game.response?.kind, kind);
  assert.equal(game.response!.owner, 'e');
  assert.notEqual(game.response!.source, 'ambassador');
  assert.equal(game.turn, 1);
  assert.equal(game.phase, 3);
  assert.deepEqual(semutaEmperorIncomeCards(game), originalCards);
  const karamaCard = semutaEmperorPlayer(game, 'a').hand.find(card => card.id === karama)!;
  assert.ok(karamaCard);
  if (special) assert.notEqual(special, karama);
  return {
    game, beforePayment, sourceActions, owner: 'e', holder: 'r', buyer: advanced ? 'r' : 'a', canceler: 'a',
    karama, karamaCard, acquired, special, amount: advanced ? 3 : 1, kind,
    cancel: { type: 'card', mode: 'cancel', card: karama }, originalCards, staging,
  };
}

export function reactSemutaEmperorIncome(
  state: Game, fixture: SemutaEmperorIncomeFixture, claim: boolean,
): Game {
  const event = state.pendingTreacheryDiscard!.batch.event;
  if (claim) return applyAction(state, fixture.holder, { type: 'semutaCommit', event });
  let game = state;
  for (const player of state.players)
    game = applyAction(game, player.id, { type: 'semutaPass', event });
  return game;
}
