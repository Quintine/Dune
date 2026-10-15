import assert from 'node:assert/strict';
import {
  applyAction, createGame, handLimit, initializeSemutaGameForAudit, joinGame, newPlayer,
  viewGame, type Action, type Game,
} from '../game/engine';
import type { Card } from '../game/cards';
import { homeworldShipmentChoice } from '../game/homeworld-shipment-options';
import { quoteStableHomeworldOccupation } from '../game/homeworld-stable-occupation';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { nextRicheseSkillsTechNativeStep } from './fixture-richese-skills-tech';
import { semutaEmperorIncomeCards } from './fixture-semuta-emperor-income';
import {
  moveSemutaEmperorCard, semutaEmperorCardId, semutaEmperorPlayer, passSemutaSpecialDiscards,
} from './fixture-semuta-emperor-share';

export type SemutaHomeworldEmperorIncomeKind = 'emperorIncome' | 'richesePurchaseIncome';
export type SemutaHomeworldEmperorIncomeStep = { actor: string; action: Action };
export type SemutaHomeworldEmperorIncomeFixture = {
  kind: SemutaHomeworldEmperorIncomeKind;
  game: Game;
  setup: Game;
  occupied: Game | null;
  beforePayment: Game;
  sourceActions: SemutaHomeworldEmperorIncomeStep[];
  qualificationActions: SemutaHomeworldEmperorIncomeStep[];
  owner: string;
  holder: string;
  canceler: string;
  buyer: string;
  acquired: string;
  karama: string;
  karamaCard: Card;
  special?: string;
  cancel: Action;
  amount: number;
  nativeIncome: number;
  occupiedAmount: number;
  allocationOwner: string | null;
  allocationAlly: string | null;
  originalCards: string[];
  staging: string[];
};

export function nextSemutaHomeworldEmperorIncomeStep(game: Game): SemutaHomeworldEmperorIncomeStep {
  const pending = game.pendingTreacheryDiscard;
  const reaction = pending?.reaction;
  if (reaction?.stage === 'offer' && pending) return {
    actor: game.players.find(player => !reaction.passed.includes(player.id))!.id,
    action: { type: 'semutaPass', event: pending.batch.event },
  };
  if (game.decision?.kind === 'homeworldShipmentGuild') return {
    actor: game.decision.player,
    action: { type: 'decision', event: game.decision.event, allow: true },
  };
  if (game.decision?.kind === 'choamMarket') return {
    actor: game.decision.player, action: { type: 'decision', done: true },
  };
  return nextRicheseSkillsTechNativeStep(game);
}

/** Subset counters are already included in the twenty physical forces. */
export function semutaHomeworldEmperorForceTotals(game: Game) {
  return game.players.map(player => ({
    id: player.id,
    total: player.reserves + player.tanks + Object.values(player.forces).reduce((sum, n) => sum + n, 0) +
      Object.values(game.homeworlds!.custody!.visitors).reduce((sum, visitors) =>
        sum + (visitors[player.id]?.normal ?? 0) + (visitors[player.id]?.elite ?? 0), 0),
    elite: player.elites ? player.elites.reserves + player.elites.tanks +
      Object.values(player.elites.forces).reduce((sum, n) => sum + n, 0) +
      Object.values(game.homeworlds!.custody!.visitors).reduce((sum, visitors) =>
        sum + (visitors[player.id]?.elite ?? 0), 0) : null,
  }));
}

/** Move an original card to the next native draw, never replace the deck. */
function nextOriginalDraw(game: Game, id: string): void {
  for (const zone of [game.deck, game.discard, game.richeseCache ?? [], game.richeseRemoved ?? [],
    ...game.players.map(player => player.hand)]) {
    const at = zone.findIndex(card => card.id === id);
    if (at < 0) continue;
    game.deck.unshift(zone.splice(at, 1)[0]);
    return;
  }
  throw new Error(`Missing original draw ${id}`);
}

/** Original setup/phase controls and an actual Advanced invasion establish all
 * authority. Only unplayed Spice order and conserved later cards/forces are staged.
 * Emperor Sardaukar remain a subset of reserves on their original Salusa world. */
export function createSemutaHomeworldEmperorIncomeFixture(
  kind: SemutaHomeworldEmperorIncomeKind,
  options: { advanced?: boolean; occupied?: boolean; acquiredKarama?: boolean } = {},
): SemutaHomeworldEmperorIncomeFixture {
  const advanced = options.advanced ?? (kind === 'richesePurchaseIncome' || !!options.occupied);
  assert.ok(kind !== 'richesePurchaseIncome' || advanced);
  assert.ok(!options.occupied || advanced, 'No new Basic occupation epoch interpretation');
  assert.ok(!options.acquiredKarama || kind === 'emperorIncome');
  let game = createGame('SEMUTAHWEMPEROR', newPlayer('r', 'Richese', 'richese'), advanced, ['choam']);
  joinGame(game, newPlayer('e', 'Emperor', 'emperor'));
  joinGame(game, newPlayer('g', 'Guild', 'guild'));
  joinGame(game, newPlayer('a', 'Atreides', 'atreides'));
  game = applyAction(game, 'r', { type: 'homeworlds', enabled: true });
  for (const player of game.players) game = applyAction(game, player.id, { type: 'ready' });
  game = initializeSemutaGameForAudit(game);
  const originalCards = semutaEmperorIncomeCards(game), staging: string[] = [];
  const sourceActions: SemutaHomeworldEmperorIncomeStep[] = [], qualificationActions: SemutaHomeworldEmperorIncomeStep[] = [];
  const act = (step: SemutaHomeworldEmperorIncomeStep, record?: SemutaHomeworldEmperorIncomeStep[]) => {
    record?.push(step);
    game = applyAction(game, step.actor, step.action);
  };
  const clean = () => !game.phaseOpening && !game.response && !game.decision && !game.pendingTreacheryDiscard;
  const reach = (until: () => boolean, record?: SemutaHomeworldEmperorIncomeStep[]) => {
    for (let n = 0; !until() && n < 2600; n++) {
      assert.notEqual(game.status, 'finished', 'Original native actions must reach the paid income source');
      act(nextSemutaHomeworldEmperorIncomeStep(game), record);
    }
    assert.ok(until(), 'Original native actions must reach the requested income boundary');
  };
  const orderUnplayedSpice = (kinds: ('land' | 'worm')[]) => {
    for (const [position, type] of kinds.entries()) {
      const index = game.spiceDeck.findIndex((card, i) => i >= position &&
        (type === 'land' ? 'territory' in card : 'worm' in card));
      assert.ok(index >= position);
      game.spiceDeck.splice(position, 0, game.spiceDeck.splice(index, 1)[0]);
    }
  };
  reach(() => game.status === 'playing');
  const setup = structuredClone(game);
  orderUnplayedSpice(['land', 'land']);
  let occupied: Game | null = null;
  if (options.occupied) {
    reach(() => game.phase === 5 && clean());
    for (const player of game.players) {
      player.reserves += Object.values(player.forces).reduce((sum, n) => sum + n, 0);
      player.forces = {};
      if (player.elites) {
        player.elites.reserves += Object.values(player.elites.forces).reduce((sum, n) => sum + n, 0);
        player.elites.forces = {};
      }
    }
    reach(() => game.turn === 2 && game.phase === 1 && clean());
    orderUnplayedSpice(['worm', 'land', 'land']);
    reach(() => game.nexus && !game.spiceWindow && !game.spiceResolution && clean());
    act({ actor: 'g', action: { type: 'alliance', target: 'a' } }, qualificationActions);
    act({ actor: 'a', action: { type: 'alliance', target: 'g' } }, qualificationActions);
    reach(() => game.phase === 5 && game.active === 'g' && clean());
    const emperor = semutaEmperorPlayer(game, 'e');
    const normal = emperor.reserves - (emperor.elites?.reserves ?? 0);
    emperor.forces['polar_sink:0'] = (emperor.forces['polar_sink:0'] ?? 0) + normal;
    emperor.reserves -= normal;
    const invade = homeworldShipmentChoice(viewGame(game, 'g'), 'homeworld:emperor',
      { 'homeworld:guild': { normal: 1, elite: 0 } });
    assert.ok(invade.action, invade.blocked ?? undefined);
    act({ actor: 'g', action: invade.action }, qualificationActions);
    reach(clean, qualificationActions);
    const authority = quoteStableHomeworldOccupation(game, 'kaitain');
    assert.equal(authority.blocked, null);
    assert.equal(authority.entitlement?.occupier, 'g');
    assert.equal(authority.entitlement?.ally, 'a');
    assert.ok(game.homeworldOccupationHistory!.sources.some(source =>
      source.event === authority.entitlement!.qualification && source.cause !== 'setup'));
    occupied = structuredClone(game);
    orderUnplayedSpice(['land', 'land', 'land', 'land']);
    reach(() => game.turn === 3 && game.phase === 2 && clean());
    staging.push('Original turn2 worm alliance and real one-counter Guild invasion qualify Kaitain; original Salusa Sardaukar remain untouched.');
  } else {
    reach(() => game.phase === 2 && clean());
    const emperor = semutaEmperorPlayer(game, 'e');
    const normal = emperor.reserves - (emperor.elites?.reserves ?? 0);
    assert.ok(normal >= 4);
    emperor.forces['polar_sink:0'] = (emperor.forces['polar_sink:0'] ?? 0) + normal - 4;
    emperor.reserves -= normal - 4;
    // Basic has no separate Salusa: its elite subset also counts on Kaitain.
    // Move those original counters with their typed subset to keep only four.
    if (!advanced && emperor.elites) {
      const elite = emperor.elites.reserves;
      emperor.reserves -= elite;
      emperor.forces['polar_sink:0'] += elite;
      emperor.elites.reserves = 0;
      emperor.elites.forces['polar_sink:0'] = (emperor.elites.forces['polar_sink:0'] ?? 0) + elite;
    }
    staging.push('Conserved later Emperor counters leave four Kaitain natives; Advanced retains its original Salusa subset, while Basic moves that included subset to Polar Sink.');
  }
  // Physical staging follows all earlier original purchases, before this source.
  for (const player of game.players) game.deck.push(...player.hand.splice(0));
  moveSemutaEmperorCard(game, SEMUTA_DRUG_ID, 'r');
  const special = kind === 'richesePurchaseIncome' ? moveSemutaEmperorCard(game,
    semutaEmperorCardId(game, card => card.effect === 'karama'), 'r') : undefined;
  const karama = semutaEmperorCardId(game, card => card.effect === 'karama' && card.id !== special);
  if (options.acquiredKarama) nextOriginalDraw(game, karama);
  else moveSemutaEmperorCard(game, karama, 'a');
  if (kind === 'emperorIncome') moveSemutaEmperorCard(game,
    semutaEmperorCardId(game, card => card.effect === 'karama' && card.id !== karama), 'e');
  const fillHolder = () => {
    const holder = semutaEmperorPlayer(game, 'r');
    while (holder.hand.length < handLimit(holder)) {
      const card = game.deck.find(candidate => candidate.effect !== 'karama');
      assert.ok(card);
      moveSemutaEmperorCard(game, card.id, holder.id);
    }
    assert.equal(holder.hand.length, 4);
  };
  let beforePayment: Game, acquired: string;
  if (kind === 'richesePurchaseIncome') {
    fillHolder();
    reach(() => game.decision?.kind === 'richeseDeclaration' && !game.phaseOpening && !game.response);
    assert.equal(game.decision!.player, 'r');
    beforePayment = structuredClone(game);
    acquired = game.richeseCache![0].id;
    act({ actor: 'r', action: { type: 'card', mode: 'special', card: special!, acquire: acquired } }, sourceActions);
    game = passSemutaSpecialDiscards(game, sourceActions);
  } else {
    acquired = options.acquiredKarama ? karama : game.deck.find(card => card.effect !== 'karama')!.id;
    nextOriginalDraw(game, acquired);
    reach(() => game.phase === 3 && !!game.auction && clean());
    assert.equal(game.auction!.cards[game.auction!.index].id, acquired);
    assert.ok(game.auction!.cards.length >= 2);
    fillHolder();
    for (let n = 0; game.auction!.active !== 'a' && n < 8; n++)
      act({ actor: game.auction!.active, action: { type: 'passBid' } });
    assert.equal(game.auction!.active, 'a');
    beforePayment = structuredClone(game);
    act({ actor: 'a', action: { type: 'bid', amount: 5 } }, sourceActions);
    reach(() => game.response?.kind === kind, sourceActions);
  }
  assert.equal(game.response?.kind, kind);
  assert.equal(game.response!.owner, 'e');
  assert.notEqual(game.response!.source, 'ambassador');
  const amount = kind === 'emperorIncome' ? 5 : 3;
  const payment = viewGame(game, 'e').paymentIncome!;
  assert.equal(payment.gross, amount);
  assert.equal(payment.low, true);
  assert.equal(payment.income, Math.ceil(amount / 2));
  const authority = quoteStableHomeworldOccupation(game, 'kaitain');
  assert.equal(authority.blocked, null);
  assert.equal(authority.entitlement?.occupier ?? null, options.occupied ? 'g' : null);
  const karamaCard = semutaEmperorPlayer(game, 'a').hand.find(card => card.id === karama)!;
  assert.ok(karamaCard);
  assert.deepEqual(semutaEmperorIncomeCards(game), originalCards);
  assert.ok(semutaHomeworldEmperorForceTotals(game).every(row => row.total === 20 &&
    (row.elite === null || row.elite === 5)));
  staging.push('Canonical later cards fill Richese to hand4; foreign printed cancellation and own special activation have distinct original identities.');
  return { kind, game, setup, occupied, beforePayment, sourceActions, qualificationActions,
    owner: 'e', holder: 'r', canceler: 'a', buyer: kind === 'emperorIncome' ? 'a' : 'r',
    acquired, karama, karamaCard, special, cancel: { type: 'card', mode: 'cancel', card: karama },
    amount, nativeIncome: Math.ceil(amount / 2), occupiedAmount: options.occupied ? Math.floor(amount / 2) : 0,
    allocationOwner: authority.entitlement?.occupier ?? null, allocationAlly: authority.entitlement?.ally ?? null,
    originalCards, staging };
}

export function reactSemutaHomeworldEmperorIncome(state: Game, holder: string, claim: boolean): Game {
  const event = state.pendingTreacheryDiscard!.batch.event;
  if (claim) return applyAction(state, holder, { type: 'semutaCommit', event });
  let game = state;
  for (const player of state.players) game = applyAction(game, player.id, { type: 'semutaPass', event });
  return game;
}
