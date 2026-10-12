import assert from 'node:assert/strict';
import {
  applyAction, createGame, handLimit, initializeSemutaGameForAudit, joinGame,
  newPlayer, viewGame, type Action, type Game,
} from '../game/engine';
import { TERRITORIES } from '../game/board';
import { botEntryAllowed } from '../game/bot-mobility';
import { reserveShipmentCost } from '../game/shipment-price';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import type { Card } from '../game/cards';
import { nextRicheseSkillsTechNativeStep, type RicheseSkillsTechStep } from './fixture-richese-skills-tech';
import {
  moveSemutaEmperorCard, semutaEmperorCardId, semutaEmperorPlayer,
} from './fixture-semuta-emperor-share';

export type SemutaGuildIncomeOptions = { advanced?: boolean; fullHand?: boolean };
export type SemutaGuildIncomeFixture = {
  game: Game;
  income: Game;
  initial: Game;
  setup: Game;
  afterSetup: Game;
  afterFirstStorm: Game;
  beforeStaging: Game;
  actions: RicheseSkillsTechStep[];
  producerActions: RicheseSkillsTechStep[];
  staging: string[];
  owner: string;
  payer: string;
  holder: string;
  canceller: string;
  karama: Card;
  semuta: string;
  territory: string;
  key: string;
  amount: number;
  cost: number;
  ship: Action;
  cancel: Action;
};
export function semutaGuildIncomeInventory(game: Game): string[] {
  const ids = [...game.deck, ...game.discard, ...(game.richeseCache ?? []),
    ...(game.richeseRemoved ?? []), ...(game.auction?.cards.slice(game.auction.index) ?? []),
    ...game.players.flatMap(player => player.hand)].map(card => card.id).sort();
  assert.equal(new Set(ids).size, ids.length, 'One physical slot per original Treachery identity');
  return ids;
}
export function semutaGuildIncomeCounters(game: Game) {
  return game.players.map(player => ({
    id: player.id,
    total: player.reserves + player.tanks + Object.values(player.forces).reduce((sum, n) => sum + n, 0),
    elite: player.elites ? player.elites.reserves + player.elites.tanks +
      Object.values(player.elites.forces).reduce((sum, n) => sum + n, 0) : 0,
  }));
}
/** Exclude only hands from the already-paid shipment snapshot. Semuta changes
 * custody, never wallets, force pools, shipment flags or Movement ownership. */
export function semutaGuildIncomePosition(game: Game) {
  return {
    status: game.status, turn: game.turn, phase: game.phase, active: game.active,
    order: game.order, ready: game.ready, movementRemaining: game.movementRemaining,
    pendingShipment: game.pendingShipment, guildRateBlocked: game.guildRateBlocked,
    players: game.players.map(player => ({
      id: player.id, faction: player.faction, ally: player.ally, spice: player.spice,
      forces: player.forces, reserves: player.reserves, tanks: player.tanks,
      elites: player.elites, leaders: player.leaders,
      shipped: player.shipped, moved: player.moved, revived: player.revived,
    })),
  };
}
const clean = (game: Game) => !game.phaseOpening && !game.response && !game.decision && !game.pendingTreacheryDiscard;
/** Existing no-spend native setup/phase policy, with neutral passes for any
 * fresh discard encountered on the way. No clock, wallet or turn is staged. */
export function nextSemutaGuildIncomeNativeStep(game: Game): RicheseSkillsTechStep {
  const pending = game.pendingTreacheryDiscard;
  const reaction = pending?.reaction;
  if (reaction?.stage === 'offer' && pending) {
    const actor = game.players.find(player => !reaction.passed.includes(player.id));
    assert.ok(actor);
    return { actor: actor.id, action: { type: 'semutaPass', event: pending.batch.event } };
  }
  return nextRicheseSkillsTechNativeStep(game);
}
/** Fresh Richese/Guild/classic setup, original first Storm and actual first-turn
 * Movement. Only still-unplayed Spice order and conserved later hands change.
 * Original board, leaders, wallets, reserve stocks and native order stay intact. */
export function createSemutaGuildIncomeFixture(options: SemutaGuildIncomeOptions = {}): SemutaGuildIncomeFixture {
  let game = createGame('SEMUTAGUILDINCOME', newPlayer('r', 'Richese', 'richese'), options.advanced ?? false, ['choam']);
  joinGame(game, newPlayer('g', 'Guild', 'guild'));
  joinGame(game, newPlayer('a', 'Atreides', 'atreides'));
  joinGame(game, newPlayer('e', 'Emperor', 'emperor'));
  for (const seat of game.players) game = applyAction(game, seat.id, { type: 'ready' });
  const initial = structuredClone(game), actions: RicheseSkillsTechStep[] = [];
  game = initializeSemutaGameForAudit(game);
  const setup = structuredClone(game), inventory = semutaGuildIncomeInventory(game);
  const reach = (until: () => boolean) => {
    for (let n = 0; !until() && n < 1200; n++) {
      assert.notEqual(game.status, 'finished', 'Original native actions must reach Movement');
      const next = nextSemutaGuildIncomeNativeStep(game);
      actions.push(next);
      game = applyAction(game, next.actor, next.action);
    }
    assert.ok(until(), 'The genuine native phase path must reach its requested boundary');
  };
  reach(() => game.status === 'playing');
  const afterSetup = structuredClone(game);
  const counters = semutaGuildIncomeCounters(game);
  // Prevent an incidental first-turn worm by reordering original unplayed cards.
  for (const position of [0, 1]) {
    const index = game.spiceDeck.findIndex((card, i) => i >= position && 'territory' in card);
    assert.ok(index >= position);
    game.spiceDeck.splice(position, 0, game.spiceDeck.splice(index, 1)[0]);
  }
  reach(() => game.phase === 1 && clean(game));
  const afterFirstStorm = structuredClone(game);
  reach(() => game.phase === 5 && game.active === 'a' && clean(game));
  assert.equal(game.turn, 1);
  const beforeStaging = structuredClone(game), position = semutaGuildIncomePosition(game);
  for (const player of game.players) game.deck.push(...player.hand.splice(0));
  const staging = [
    'Reordered only the first two original unplayed Spice Cards to non-worm blows.',
    'At actual first-turn Atreides Movement, returned original held Treachery Cards to the same deck; no board, reserve, leader or wallet staging.',
  ];
  const karamaId = moveSemutaEmperorCard(game, semutaEmperorCardId(game, card => card.effect === 'karama'), 'e');
  const semuta = moveSemutaEmperorCard(game, SEMUTA_DRUG_ID, 'r');
  const karama = semutaEmperorPlayer(game, 'e').hand.find(card => card.id === karamaId)!;
  staging.push(`Conserved original ${karamaId} to Emperor and canonical ${semuta} to Richese; neither is a replacement card.`);
  if (options.fullHand) {
    const holder = semutaEmperorPlayer(game, 'r');
    while (holder.hand.length < handLimit(holder)) {
      const id = semutaEmperorCardId(game, card => card.id !== semuta && card.id !== karamaId &&
        card.effect !== 'karama' && !holder.hand.some(held => held.id === card.id));
      moveSemutaEmperorCard(game, id, holder.id);
      staging.push(`Conserved original ${id} into Richese's full-hand exchange position.`);
    }
  }
  assert.deepEqual(semutaGuildIncomePosition(game), position);
  assert.deepEqual(semutaGuildIncomeInventory(game), inventory);
  assert.deepEqual(semutaGuildIncomeCounters(game), counters);
  const own = viewGame(game, 'a'), payer = own.players.find(player => player.id === 'a')!;
  // Empty ordinary sand isolates the paid shipment from battle/arrival parents.
  // The consumer's original entry and tariff helpers choose the actual action.
  const destination = TERRITORIES.find(t => t.type === 'sand' && !t.sectors.includes(game.storm) &&
    !game.players.some(player => Object.keys(player.forces).some(key => key.startsWith(`${t.id}:`))) &&
    botEntryAllowed(own, payer, t.id, t.sectors[0], 'ship'));
  assert.ok(destination, 'An original legal empty sand destination must remain');
  const amount = 3, sector = destination.sectors[0];
  const cost = reserveShipmentCost({ faction: payer.faction, halfRate: false }, destination.type, amount);
  assert.ok(payer.reserves >= amount && (payer.spice ?? 0) >= cost);
  const ship: Action = { type: 'ship', territory: destination.id, sector, amount, elite: 0, allyPayment: 0 };
  const producerActions: RicheseSkillsTechStep[] = [{ actor: 'a', action: ship }];
  if (game.advanced) producerActions.push({ actor: 'g', action: { type: 'decision', allow: true } });
  const fixture: Omit<SemutaGuildIncomeFixture, 'income'> = {
    game, initial, setup, afterSetup, afterFirstStorm, beforeStaging, actions, producerActions, staging,
    owner: 'g', payer: 'a', holder: 'r', canceller: 'e', karama, semuta,
    territory: destination.id, key: `${destination.id}:${sector}`, amount, cost, ship,
    cancel: { type: 'card', mode: 'cancel', card: karamaId },
  };
  return { ...fixture, income: shipSemutaGuildIncome(fixture) };
}
/** Issue the real reserve shipment; Advanced's original Guild special-stop
 * decision must explicitly allow it before any payment or force arrival. */
export function shipSemutaGuildIncome(
  fixture: Pick<SemutaGuildIncomeFixture, 'game' | 'payer' | 'owner' | 'ship' | 'cost'>,
): Game {
  let game = applyAction(fixture.game, fixture.payer, fixture.ship);
  if (fixture.game.advanced) {
    assert.equal(game.decision?.kind, 'guildShipment');
    assert.equal(game.decision?.player, fixture.owner);
    assert.deepEqual(semutaGuildIncomePosition(game), semutaGuildIncomePosition({
      ...fixture.game, pendingShipment: game.pendingShipment,
    }));
    game = applyAction(game, fixture.owner, { type: 'decision', allow: true });
  }
  assert.equal(game.response?.kind, 'guildIncome', 'This is paid Guild income, not a rate or shipment-stop cancellation');
  assert.equal(game.response.owner, fixture.owner);
  assert.equal(game.response.amount, fixture.cost);
  assert.equal(semutaEmperorPlayer(game, fixture.payer).shipped, true);
  return game;
}
export function reactSemutaGuildIncome(state: Game, fixture: SemutaGuildIncomeFixture, claim: boolean): Game {
  const event = state.pendingTreacheryDiscard!.batch.event;
  if (claim) return applyAction(state, fixture.holder, { type: 'semutaCommit', event });
  let game = state;
  for (const seat of state.players) game = applyAction(game, seat.id, { type: 'semutaPass', event });
  return game;
}
