import assert from 'node:assert/strict';
import {
  applyAction, createGame, handLimit, initializeHomeworldOccupationGameForAudit,
  initializeSemutaGameForAudit, joinGame, newPlayer, viewGame,
  type Action, type Game,
} from '../game/engine';
import { treacheryDeck, type Card } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { highKaitainDiscardsAvailable } from '../game/homeworld-card-economy';
import { biddingEndDiscardChoice } from '../game/bidding-end-options';
import { biddingPhysicalIds } from './fixture-homeworld-occupied-bidding';
import { nextRicheseSkillsTechNativeStep, type RicheseSkillsTechStep } from './fixture-richese-skills-tech';
import { moveSemutaEmperorCard, semutaEmperorCardId, semutaEmperorPlayer } from './fixture-semuta-emperor-share';

export type SemutaKaitainOptions = {
  initial?: Game;
  advanced?: boolean;
  count?: 1 | 2;
  fullHolder?: boolean;
  ownerReady?: boolean;
  choamReady?: boolean;
  /** Before-cutover proof uses the original native Homeworld entry, without Semuta. */
  nativeOnly?: boolean;
};
export type SemutaKaitainFixture = {
  game: Game;
  paid: Game;
  initial: Game;
  setup: Game;
  owner: string;
  holder: string;
  choam: string;
  semuta: string;
  cards: Card[];
  cardIds: string[];
  action: Action;
  event: string;
  actions: RicheseSkillsTechStep[];
  staging: string[];
  stock: string[];
};


/** Genuine original setup/first Storm/original auctions establish closing Bidding.
 * Only later physical hand positions and unplayed original Spice order are staged.
 * Kaitain population, wallets, ownership, readiness and every clock stay native. */
export function createSemutaKaitainFixture(options: SemutaKaitainOptions = {}): SemutaKaitainFixture {
  let game = options.initial ? structuredClone(options.initial)
    : createGame('SEMUTAKAITAIN', newPlayer('r', 'Richese', 'richese'), options.advanced ?? false, ['choam']);
  if (!options.initial) {
    joinGame(game, newPlayer('e', 'Emperor', 'emperor'));
    joinGame(game, newPlayer('c', 'CHOAM', 'choam'));
    joinGame(game, newPlayer('a', 'Atreides', 'atreides'));
  }
  assert.equal(game.status, 'lobby');
  assert.deepEqual(game.expansions, ['choam']);
  if (options.advanced !== undefined) assert.equal(game.advanced, options.advanced);
  const holder = game.players.find(p => p.faction === 'richese')!.id;
  const owner = game.players.find(p => p.faction === 'emperor')!.id;
  const choam = game.players.find(p => p.faction === 'choam')!.id;
  const actions: RicheseSkillsTechStep[] = [], staging: string[] = [];
  const act = (actor: string, action: Action) => {
    actions.push({ actor, action });
    game = applyAction(game, actor, action);
  };
  if (!game.homeworlds) act(game.host, { type: 'homeworlds', enabled: true });
  for (const p of game.players) if (!p.ready) act(p.id, { type: 'ready' });
  const initial = structuredClone(game);
  game = options.nativeOnly ? initializeHomeworldOccupationGameForAudit(game)
    : initializeSemutaGameForAudit(game);
  const stock = biddingPhysicalIds(game);
  assert.deepEqual(stock, [...treacheryDeck(['choam']), ...richeseCards()].map(card => card.id).sort(),
    'The original native initializer supplies the canonical stock exactly once');
  const reach = (until: () => boolean) => {
    for (let step = 0; !until() && step < 1200; step++) {
      assert.notEqual(game.status, 'finished', 'Native setup and Bidding must reach Kaitain');
      let next: RicheseSkillsTechStep;
      const pending = game.pendingTreacheryDiscard;
      const reaction = pending?.reaction;
      if (reaction?.stage === 'offer' && pending) {
        next = { actor: game.players.find(p => !reaction.passed.includes(p.id))!.id,
          action: { type: 'semutaPass', event: pending.batch.event } };
      } else if (game.decision?.kind === 'choamMarket') {
        // Decline the real post-Storm market, preserving original cards and wallets.
        next = { actor: game.decision.player, action: { type: 'decision', done: true } };
      } else next = nextRicheseSkillsTechNativeStep(game);
      act(next.actor, next.action);
    }
    assert.ok(until(), 'Original actions must reach the requested Kaitain boundary');
  };
  reach(() => game.status === 'playing');
  const setup = structuredClone(game);
  // Two original non-worm blows avoid an unrelated alliance opportunity.
  const blows = game.spiceDeck.filter(card => 'territory' in card).slice(0, 2);
  assert.equal(blows.length, 2);
  for (const [position, card] of blows.entries()) {
    const at = game.spiceDeck.indexOf(card);
    game.spiceDeck.splice(position, 0, game.spiceDeck.splice(at, 1)[0]);
  }
  staging.push('Reorder two still-unplayed original non-worm Spice Cards; no replacement deck.');
  reach(() => !!game.biddingEnd && !game.decision && !game.response && !game.pendingTreacheryDiscard);
  assert.equal(game.turn, 1);
  assert.equal(game.phase, 3);
  assert.equal(highKaitainDiscardsAvailable(game, owner), true, 'Original Emperor reserves qualify high Kaitain');
  assert.equal(semutaEmperorPlayer(game, owner).spice, 10, 'No native auction bid was paid');
  assert.deepEqual(biddingPhysicalIds(game), stock);

  // Conserved later hands; no card is created or treated as played/acquired by an auction.
  for (const id of [owner, holder]) game.deck.push(...semutaEmperorPlayer(game, id).hand.splice(0));
  const semuta = moveSemutaEmperorCard(game, SEMUTA_DRUG_ID, holder);
  const first = moveSemutaEmperorCard(game, semutaEmperorCardId(game, card => card.effect === 'karama'), owner);
  const cardIds = [first];
  if ((options.count ?? 2) === 2) cardIds.push(moveSemutaEmperorCard(game,
    semutaEmperorCardId(game, card => card.kind === 'poisonTooth'), owner));
  // An unselected native card keeps the owner's optional finish genuinely available.
  moveSemutaEmperorCard(game, semutaEmperorCardId(game,
    card => card.kind === 'shield' && !cardIds.includes(card.id)), owner);
  if (options.fullHolder) {
    while (semutaEmperorPlayer(game, holder).hand.length < handLimit(semutaEmperorPlayer(game, holder))) {
      const card = game.deck[0];
      assert.ok(card);
      moveSemutaEmperorCard(game, card.id, holder);
    }
    assert.equal(semutaEmperorPlayer(game, holder).hand.length, 4);
  }
  staging.push(`Conserved original ${semuta} to Richese; ${cardIds.join(', ')} and one retained Shield to Emperor${options.fullHolder ? '; three original undealt cards fill Richese to four' : ''}.`);
  assert.deepEqual(biddingPhysicalIds(game), stock);
  const event = game.biddingEnd!.event;
  if (options.ownerReady) act(owner, { type: 'biddingEnd', event, mode: 'ready' });
  if (options.choamReady) act(choam, { type: 'biddingEnd', event, mode: 'ready' });
  const choice = biddingEndDiscardChoice(viewGame(game, owner), cardIds);
  assert.equal(choice.blocked, null);
  assert.ok(choice.action);
  const cards = cardIds.map(id => structuredClone(semutaEmperorPlayer(game, owner).hand.find(card => card.id === id)!));
  const before = structuredClone(game);
  act(owner, choice.action);
  return { game: before, paid: game, initial, setup, owner, holder, choam, semuta,
    cards, cardIds, action: choice.action, event, actions, staging, stock };
}

/** The actual event requires commitment before private multi-card selection. */
export function reactSemutaKaitain(state: Game, fixture: SemutaKaitainFixture, claim: boolean, selected = fixture.cardIds[0]): Game {
  let game = state;
  const event = game.pendingTreacheryDiscard!.batch.event;
  if (!claim) {
    for (const player of game.players) game = applyAction(game, player.id, { type: 'semutaPass', event });
    return game;
  }
  game = applyAction(game, fixture.holder, { type: 'semutaCommit', event });
  if (game.pendingTreacheryDiscard?.reaction?.stage === 'select')
    game = applyAction(game, fixture.holder, { type: 'semutaSelect', event, card: selected });
  return game;
}
