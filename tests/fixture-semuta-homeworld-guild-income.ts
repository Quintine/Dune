import assert from 'node:assert/strict';
import {
  applyAction, createGame, handLimit, initializeSemutaGameForAudit, joinGame,
  newPlayer, viewGame, type Action, type Game,
} from '../game/engine';
import { TERRITORIES } from '../game/board';
import { botEntryAllowed } from '../game/bot-mobility';
import { nativeShipmentSources } from '../game/homeworld-options';
import { homeworldShipmentChoice } from '../game/homeworld-shipment-options';
import { reserveShipmentCost } from '../game/shipment-price';
import { quoteHomeworldPaymentIncome } from '../game/homeworld-payment-income';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import type { Card } from '../game/cards';
import { nextSemutaGuildIncomeNativeStep, semutaGuildIncomeInventory } from './fixture-semuta-guild-income';
import {
  moveSemutaEmperorCard, semutaEmperorCardId, semutaEmperorPlayer,
} from './fixture-semuta-emperor-share';
import type { RicheseSkillsTechStep } from './fixture-richese-skills-tech';

export type SemutaHomeworldGuildOptions = { advanced?: boolean; occupied?: boolean; fullHand?: boolean };
export type SemutaHomeworldGuildFixture = {
  game: Game;
  income: Game;
  setup: Game;
  beforeStaging: Game;
  beforeInvasion: Game | null;
  occupied: Game | null;
  actions: RicheseSkillsTechStep[];
  occupationActions: RicheseSkillsTechStep[];
  producerActions: RicheseSkillsTechStep[];
  staging: string[];
  owner: string;
  payer: string;
  holder: string;
  canceller: string;
  karama: Card;
  semuta: string;
  ship: Action;
  cancel: Action;
  amount: number;
  cost: number;
  key: string;
  nativeIncome: number;
  occupiedReceiver: string | null;
  allocation: { actor: string; ownAmount: number } | null;
};

/** Elites are subsets of native reserves/Arrakis forces, not extra counters.
 * Foreign Homeworld visitors are outside their owner's native reserve count. */
export function semutaHomeworldGuildCounters(game: Game) {
  return game.players.map(player => ({ id: player.id, total: player.reserves + player.tanks +
    Object.values(player.forces).reduce((sum, amount) => sum + amount, 0) +
    Object.values(game.homeworlds!.custody!.visitors).reduce((sum, visitors) =>
      sum + (visitors[player.id]?.normal ?? 0) + (visitors[player.id]?.elite ?? 0), 0),
  }));
}

/** Hands/discard and cancellation continuation are excluded; original paid
 * mechanics, native controls and occupation authority must remain unchanged. */
export function semutaHomeworldGuildPosition(game: Game) {
  return {
    turn: game.turn, phase: game.phase, active: game.active, order: game.order,
    movementRemaining: game.movementRemaining, pendingShipment: game.pendingShipment,
    homeworlds: game.homeworlds, history: game.homeworldOccupationHistory,
    players: game.players.map(player => ({ id: player.id, faction: player.faction,
      ally: player.ally, spice: player.spice, reserves: player.reserves, tanks: player.tanks,
      forces: player.forces, elites: player.elites, shipped: player.shipped, moved: player.moved,
    })),
  };
}

/** Original fresh Homeworld entry, setup/Storm/auctions/Movement. Only conserved
 * later physical positions and still-unplayed Spice order isolate the source.
 * Occupied Junction is ALWAYS established by the real native invasion action. */
export function createSemutaHomeworldGuildIncomeFixture(
  options: SemutaHomeworldGuildOptions = {},
): SemutaHomeworldGuildFixture {
  const advanced = options.advanced ?? false, occupiedSource = options.occupied ?? false;
  assert.ok(!occupiedSource || advanced, 'This fixture never manufactures a Basic occupation epoch');
  let game = createGame('SEMUTAHOMEWORLDGUILD', newPlayer('r', 'Richese', 'richese'), advanced, ['choam']);
  joinGame(game, newPlayer('g', 'Guild', 'guild'));
  joinGame(game, newPlayer('a', 'Atreides', 'atreides'));
  joinGame(game, newPlayer('e', 'Emperor', 'emperor'));
  game = applyAction(game, 'r', { type: 'homeworlds', enabled: true });
  for (const player of game.players) game = applyAction(game, player.id, { type: 'ready' });
  game = initializeSemutaGameForAudit(game);
  const stock = semutaGuildIncomeInventory(game);
  const actions: RicheseSkillsTechStep[] = [], occupationActions: RicheseSkillsTechStep[] = [];
  const staging: string[] = [];
  const act = (step: RicheseSkillsTechStep, invasion = false) => {
    actions.push(step);
    if (invasion) occupationActions.push(step);
    game = applyAction(game, step.actor, step.action);
  };
  const clean = () => !game.phaseOpening && !game.response && !game.decision && !game.pendingTreacheryDiscard;
  const reach = (until: () => boolean) => {
    for (let n = 0; !until() && n < 2400; n++) {
      assert.notEqual(game.status, 'finished', 'Original native phases must reach the paid source');
      const decision = game.decision;
      const step = decision?.kind === 'homeworldShipmentGuild'
        ? { actor: decision.player, action: { type: 'decision', event: decision.event, allow: true } as Action }
        : nextSemutaGuildIncomeNativeStep(game);
      act(step, decision?.kind === 'homeworldShipmentGuild');
    }
    assert.ok(until(), 'Original native phase driver must reach the requested boundary');
  };
  const nonWormBlows = (count: number) => {
    for (let position = 0; position < count; position++) {
      const index = game.spiceDeck.findIndex((card, i) => i >= position && 'territory' in card);
      assert.ok(index >= position);
      game.spiceDeck.splice(position, 0, game.spiceDeck.splice(index, 1)[0]);
    }
  };
  reach(() => game.status === 'playing');
  const setup = structuredClone(game);
  nonWormBlows(4);
  reach(() => game.phase === 5 && clean());
  // Later physical Arrakis counters return to their original native pools.
  // Emperor's elite subset follows its counters; Salusa custody is untouched.
  for (const player of game.players) {
    player.reserves += Object.values(player.forces).reduce((sum, amount) => sum + amount, 0);
    player.forces = {};
    if (player.elites) {
      player.elites.reserves += Object.values(player.elites.forces).reduce((sum, amount) => sum + amount, 0);
      player.elites.forces = {};
    }
  }
  const guild = semutaEmperorPlayer(game, 'g'), retained = occupiedSource ? 0 : 4;
  guild.forces['polar_sink:0'] = guild.reserves - retained;
  guild.reserves = retained;
  staging.push(`Conserved later Arrakis forces into their native reserves, then moved Guild's original counters to Polar Sink leaving ${retained} at Junction; no wallet, visitor or occupation history is assigned.`);
  let beforeInvasion: Game | null = null, occupied: Game | null = null;
  if (occupiedSource) {
    reach(() => game.phase === 5 && game.active === 'r' && clean());
    beforeInvasion = structuredClone(game);
    const invasion = homeworldShipmentChoice(viewGame(game, 'r'), 'homeworld:guild',
      { 'homeworld:richese': { normal: 1, elite: 0 } });
    assert.ok(invasion.action, invasion.blocked ?? undefined);
    act({ actor: 'r', action: invasion.action }, true);
    reach(clean);
    assert.equal(game.homeworlds!.custody!.visitors['homeworld:guild']?.r?.normal, 1);
    assert.ok(game.homeworldOccupationHistory!.qualifications.some(row =>
      row.world === 'homeworld:guild' && row.player === 'r' && row.cause === 'sole'));
    occupied = structuredClone(game);
    reach(() => game.turn === 2 && game.phase === 5 && game.active === 'a' && clean());
  } else reach(() => game.phase === 5 && game.active === 'a' && clean());
  const beforeStaging = structuredClone(game), position = semutaHomeworldGuildPosition(game);
  for (const player of game.players) game.deck.push(...player.hand.splice(0));
  const karamaId = moveSemutaEmperorCard(game, semutaEmperorCardId(game,
    card => card.kind === 'special' && card.effect === 'karama'), 'e');
  const semuta = moveSemutaEmperorCard(game, SEMUTA_DRUG_ID, 'r');
  const karama = semutaEmperorPlayer(game, 'e').hand.find(card => card.id === karamaId)!;
  if (options.fullHand) {
    const holder = semutaEmperorPlayer(game, 'r');
    while (holder.hand.length < handLimit(holder)) {
      const id = semutaEmperorCardId(game, card => card.id !== semuta && card.id !== karamaId &&
        card.effect !== 'karama' && !holder.hand.some(held => held.id === card.id));
      moveSemutaEmperorCard(game, id, holder.id);
    }
    assert.equal(holder.hand.length, 4);
  }
  staging.push(`Conserved original ${semuta} in Richese's ${options.fullHand ? 'four-card' : 'one-card'} hand and distinct printed ${karamaId} in Emperor's hand after native auctions.`);
  assert.deepEqual(semutaHomeworldGuildPosition(game), position);
  assert.deepEqual(semutaGuildIncomeInventory(game), stock);
  assert.ok(semutaHomeworldGuildCounters(game).every(row => row.total === 20));
  const own = viewGame(game, 'a'), payer = own.players.find(player => player.id === 'a')!;
  const destination = TERRITORIES.find(t => t.type === 'stronghold' && !t.sectors.includes(game.storm) &&
    !game.players.some(player => Object.keys(player.forces).some(key => key.startsWith(`${t.id}:`))) &&
    botEntryAllowed(own, payer, t.id, t.sectors[0], 'ship'));
  assert.ok(destination, 'An original legal empty stronghold must remain for an odd five-spice shipment');
  const amount = 5, cost = reserveShipmentCost({ faction: payer.faction, halfRate: false }, destination.type, amount);
  assert.equal(cost, 5);
  const homeworldSources = nativeShipmentSources(own, amount, 0);
  assert.deepEqual(homeworldSources, { 'homeworld:atreides': { normal: amount, elite: 0 } });
  assert.ok(payer.reserves >= amount && (payer.spice ?? 0) >= cost);
  const nativeIncome = quoteHomeworldPaymentIncome(game, 'g', 'shipment', cost).income;
  assert.equal(nativeIncome, 3);
  const ship: Action = { type: 'ship', territory: destination.id, sector: destination.sectors[0],
    amount, elite: 0, allyPayment: 0, homeworldSources };
  const producerActions: RicheseSkillsTechStep[] = [{ actor: 'a', action: ship }];
  let income = applyAction(game, 'a', ship);
  if (advanced) {
    assert.equal(income.decision?.kind, 'guildShipment');
    const allow: RicheseSkillsTechStep = { actor: 'g', action: { type: 'decision', allow: true } };
    producerActions.push(allow);
    income = applyAction(income, allow.actor, allow.action);
  }
  assert.equal(income.response?.kind, 'guildIncome');
  assert.equal(income.response.owner, 'g');
  assert.equal(income.response.amount, cost);
  return { game, income, setup, beforeStaging, beforeInvasion, occupied, actions, occupationActions,
    producerActions, staging, owner: 'g', payer: 'a', holder: 'r', canceller: 'e', karama, semuta,
    ship, cancel: { type: 'card', mode: 'cancel', card: karamaId }, amount, cost,
    key: `${destination.id}:${destination.sectors[0]}`, nativeIncome,
    occupiedReceiver: occupiedSource ? 'r' : null,
    allocation: occupiedSource ? { actor: 'r', ownAmount: 2 } : null };
}
