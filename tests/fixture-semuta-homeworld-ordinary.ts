import assert from 'node:assert/strict';
import {
  applyAction, viewGame, type Action, type Game,
} from '../game/engine';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { createSemutaHomeworldGuildIncomeFixture } from './fixture-semuta-homeworld-guild-income';
import {
  moveSemutaEmperorCard, semutaEmperorCardId, semutaEmperorPlayer,
} from './fixture-semuta-emperor-share';

export type SemutaHomeworldOrdinaryFixture = {
  game: Game; source: Game; holder: string; owner: string; semuta: string;
  hajr: string; action: Action;
};

/** Genuine original Homeworld occupation state already at an active Movement
 * owner. Only conserved later physical cards isolate this ordinary play; the
 * occupation epoch, custody, wallets and clocks stay native. */
export function createSemutaHomeworldOrdinaryFixture(): SemutaHomeworldOrdinaryFixture {
  const income = createSemutaHomeworldGuildIncomeFixture({ advanced: false });
  const game = income.game;
  assert.equal(game.phase, 5);
  assert.equal(game.active, 'a');
  const holder = income.holder, owner = income.canceller;
  assert.equal(semutaEmperorPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID), true);
  const hajr = moveSemutaEmperorCard(game,
    semutaEmperorCardId(game, card => card.effect === 'hajr'), 'a');
  assert.ok(semutaEmperorPlayer(game, 'a').hand.some(card => card.id === hajr));
  return { game, source: income.game, holder, owner, semuta: SEMUTA_DRUG_ID, hajr,
    action: { type: 'card', card: hajr } };
}

export type SemutaHomeworldTruthtranceFixture = {
  game: Game; holder: string; asker: string; questioned: string;
  truthtrance: string; answer: Action;
};

/** Genuine original Homeworld occupation state; a real Truthtrance declaration,
 * storm priority pass and definite fact answer produce the consumed card. The
 * Truthtrance and the answering Shield are conserved physical cards. */
export function createSemutaHomeworldTruthtranceFixture(): SemutaHomeworldTruthtranceFixture {
  const income = createSemutaHomeworldGuildIncomeFixture({ advanced: false });
  let game = income.game;
  assert.equal(game.phase, 5);
  assert.equal(game.active, 'a');
  const holder = income.holder, asker = 'a', questioned = income.owner;
  const truthtrance = moveSemutaEmperorCard(game,
    semutaEmperorCardId(game, card => card.effect === 'truthtrance'), asker);
  const shieldIndex = game.deck.findIndex(card => card.name === 'Shield');
  assert.ok(shieldIndex >= 0, 'A real Shield must remain in the original deck');
  semutaEmperorPlayer(game, questioned).hand.push(game.deck.splice(shieldIndex, 1)[0]);
  game = applyAction(game, asker, { type: 'card', card: truthtrance, cards: [] });
  while (game.truthtrance?.stage === 'priority') {
    const actor = game.players.find(player => !game.truthtrance!.passed.includes(player.id))!;
    game = applyAction(game, actor.id, { type: 'truthPass' });
  }
  assert.equal(game.truthtrance?.stage, 'ask');
  game = applyAction(game, game.truthtrance!.queue[0].player, {
    type: 'truthAsk',
    question: { kind: 'fact', target: questioned, fact: { kind: 'hand', name: 'Shield' } },
  });
  assert.equal(viewGame(game, questioned).truthAnswer, 'yes');
  return { game, holder, asker, questioned, truthtrance,
    answer: { type: 'truthAnswer', answer: 'yes' } };
}

export function reactSemutaHomeworldTruthtrance(
  state: Game, fixture: SemutaHomeworldTruthtranceFixture, claim: boolean,
): Game {
  const event = state.pendingTreacheryDiscard!.batch.event;
  if (claim) return applyAction(state, fixture.holder, { type: 'semutaCommit', event });
  let game = state;
  for (const player of state.players)
    game = applyAction(game, player.id, { type: 'semutaPass', event });
  return game;
}

export type SemutaHomeworldDistransFixture = {
  game: Game; holder: string; owner: string; distrans: string; given: string;
  recipient: string; action: Action;
};

/** Genuine original Homeworld occupation state; the Distrans transfer and its
 * given card are conserved physical cards, not minted, and the recipient is a
 * real seat. No clock, wallet or occupation value is assigned. */
export function createSemutaHomeworldDistransFixture(): SemutaHomeworldDistransFixture {
  const income = createSemutaHomeworldGuildIncomeFixture({ advanced: false });
  const game = income.game;
  assert.equal(game.phase, 5);
  assert.equal(game.active, 'a');
  const holder = income.holder, owner = 'a', recipient = 'e';
  const distrans = moveSemutaEmperorCard(game,
    semutaEmperorCardId(game, card => card.effect === 'distrans'), owner);
  const given = moveSemutaEmperorCard(game, semutaEmperorCardId(game, card =>
    card.effect !== 'distrans' && card.kind !== 'special' && card.effect !== 'karama' &&
    card.effect !== 'nullentropyBox'), owner);
  return { game, holder, owner, distrans, given, recipient,
    action: { type: 'card', card: distrans, target: recipient, give: given } };
}

export function reactSemutaHomeworldDistrans(
  state: Game, fixture: SemutaHomeworldDistransFixture, claim: boolean,
): Game {
  const event = state.pendingTreacheryDiscard!.batch.event;
  if (claim) return applyAction(state, fixture.holder, { type: 'semutaCommit', event });
  let game = state;
  for (const player of state.players)
    game = applyAction(game, player.id, { type: 'semutaPass', event });
  return game;
}

export type SemutaHomeworldBoxFixture = {
  game: Game; source: Game; holder: string; box: string; owner: string;
  action: Action; cost: number;
};

/** Genuine original Homeworld occupation state; a real paid Nullentropy Box
 * search runs through the engine's own singleton completion. The searched card
 * and its candidate discard are conserved physical cards, not minted. */
export function createSemutaHomeworldBoxFixture(): SemutaHomeworldBoxFixture {
  const income = createSemutaHomeworldGuildIncomeFixture({ advanced: false });
  const game = income.game;
  assert.equal(game.phase, 5);
  assert.equal(game.active, 'a');
  const holder = income.holder, owner = 'a';
  assert.equal(semutaEmperorPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID), true);
  if (!game.discard.some(card => card.effect !== 'nullentropyBox')) {
    const id = semutaEmperorCardId(game, card => card.effect !== 'nullentropyBox' &&
      card.kind !== 'special' && card.effect !== 'karama');
    moveSemutaEmperorCard(game, id, owner);
    game.discard.push(semutaEmperorPlayer(game, owner).hand.pop()!);
  }
  const box = moveSemutaEmperorCard(game,
    semutaEmperorCardId(game, card => card.effect === 'nullentropyBox'), owner);
  const atreides = semutaEmperorPlayer(game, owner);
  assert.ok(atreides.hand.some(card => card.id === box));
  const action: Action = { type: 'card', card: box };
  return { game, source: income.game, holder, box, owner, action, cost: 2 };
}

export function reactSemutaHomeworldBox(
  state: Game, fixture: SemutaHomeworldBoxFixture, claim: boolean,
): Game {
  const event = state.pendingTreacheryDiscard!.batch.event;
  if (claim) return applyAction(state, fixture.holder, { type: 'semutaCommit', event });
  let game = state;
  for (const player of state.players)
    game = applyAction(game, player.id, { type: 'semutaPass', event });
  return game;
}

export function reactSemutaHomeworldOrdinary(
  state: Game, fixture: SemutaHomeworldOrdinaryFixture, claim: boolean,
): Game {
  const event = state.pendingTreacheryDiscard!.batch.event;
  if (claim) return applyAction(state, fixture.holder, { type: 'semutaCommit', event });
  let game = state;
  for (const player of state.players)
    game = applyAction(game, player.id, { type: 'semutaPass', event });
  return game;
}

/** Homeworld authority that an ordinary card play must not disturb. */
export function semutaHomeworldOrdinaryState(game: Game) {
  return {
    homeworlds: game.homeworlds,
    history: game.homeworldOccupationHistory,
    percentages: game.homeworldOccupiedPercentageLedger,
    players: game.players.map(player => ({
      id: player.id, faction: player.faction, ally: player.ally, spice: player.spice,
      reserves: player.reserves, tanks: player.tanks, forces: player.forces,
      elites: player.elites, shipped: player.shipped, moved: player.moved,
    })),
  };
}
