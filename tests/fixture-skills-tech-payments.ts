import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeSpiceBankerIncomeGameForAudit,
  joinGame, newPlayer, viewGame, type Action, type Game,
} from '../game/engine';
import { TERRITORIES } from '../game/board';
import { LEADER_SKILL_CARDS, type LeaderSkillId } from '../game/leader-skill-cards';
import { forceRevivalQuote } from '../game/revival';
import type { TechId } from '../game/tech-tokens';
import { nextSpiceBankerIncomeNativeStep } from './fixture-spice-banker-income';

export type SkillsTechPaymentsOptions = {
  /** Fresh authenticated undealt classic lobby; original seat IDs/order survive. */
  initial?: Game;
  advanced?: boolean;
  kind?: 'force-revival' | 'shipment' | 'guild-shipment';
  withGuild?: boolean;
  /** Real counters revived or shipped, including the free Smuggler counter. */
  amount?: number;
  /** Ordinary full price when false; the default shipment explicitly opts in. */
  smuggler?: boolean;
};
export type SkillsTechPaymentsStep = { actor: string; action: Action };
export type SkillsTechPaymentsFixture = {
  game: Game;
  beforePayment: Game;
  setup: Game;
  actions: SkillsTechPaymentsStep[];
  actor: string;
  payer: string;
  owner: string;
  smugglerOwner: string;
  paymentAction: Action;
  amount: number;
  cost: number;
  token: TechId;
  tokenOwner: string;
  destination?: string;
};

/** Control only the initial all14 shuffle so native two-card offers contain
 * Banker/Smuggler. All later skill, card, Traitor and token shuffles stay native. */
function withPaymentSkillOffers<T>(game: Game, initialize: () => T): T {
  const cards: LeaderSkillId[] = LEADER_SKILL_CARDS.map(card => card.id);
  const selected: LeaderSkillId[] = game.players.map(player => player.faction === 'atreides' ? 'spice-banker'
    : player.faction === 'harkonnen' ? 'smuggler' : player.faction === 'emperor' ? 'warmaster'
      : player.faction === 'guild' ? 'swordmaster-of-ginaz' : player.faction === 'fremen' ? 'killer-medic'
        : 'prana-bindu-adept');
  // Fill each original two-card offer without introducing another payment or
  // optional question ability into the continuation policy.
  const desired: LeaderSkillId[] = [];
  const remaining = cards.filter(card => !selected.includes(card));
  for (const skill of selected) desired.push(skill, remaining.shift()!);
  desired.push(...remaining);
  const working = [...cards];
  const rolls: number[] = [];
  for (let i = working.length - 1; i > 0; i--) {
    const j = working.indexOf(desired[i]);
    assert.ok(j >= 0 && j <= i);
    rolls.push(Math.floor(((j + 0.5) / (i + 1)) * 0x100000000));
    [working[i], working[j]] = [working[j], working[i]];
  }
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const original = crypto.getRandomValues.bind(crypto);
  type RandomInput = Parameters<typeof original>[0];
  let index = 0;
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (index < rolls.length) {
      assert.ok(array instanceof Uint32Array && array.length === 1);
      array[0] = rolls[index++];
    } else original(array as RandomInput);
    return array;
  };
  try { return initialize(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}

export function nextSkillsTechPaymentsNativeStep(game: Game): SkillsTechPaymentsStep | null {
  return nextSpiceBankerIncomeNativeStep(game);
}
function step(game: Game, actions?: SkillsTechPaymentsStep[]): Game {
  const next = nextSkillsTechPaymentsNativeStep(game);
  assert.ok(next);
  actions?.push(next);
  return applyAction(game, next.actor, next.action);
}

export function initializeSkillsTechPaymentsSetup(options: SkillsTechPaymentsOptions = {}): Game {
  let game = options.initial ? structuredClone(options.initial)
    : createGame('SKILLTECH', newPlayer('banker', 'Banker', 'atreides'), options.advanced ?? false);
  assert.equal(game.status, 'lobby', 'Continue only a fresh undealt authenticated lobby.');
  assert.equal(game.expansions.length, 0);
  if (!options.initial) {
    joinGame(game, newPlayer('smuggler', 'Smuggler', 'harkonnen'));
    joinGame(game, newPlayer('payer', 'Payer', 'emperor'));
    if (options.withGuild || options.kind === 'guild-shipment') joinGame(game, newPlayer('guild', 'Guild', 'guild'));
  }
  assert.ok(game.players.some(player => player.faction === 'atreides'));
  assert.ok(game.players.some(player => player.faction === 'harkonnen'));
  assert.ok(game.players.some(player => player.faction === 'emperor'));
  if (options.advanced !== undefined) assert.equal(game.advanced, options.advanced);
  if (options.withGuild || options.kind === 'guild-shipment') assert.ok(game.players.some(player => player.faction === 'guild'));
  // The normal host lobby control creates canonical UNUSED tokens. Original
  // setup/first Storm alone assign ownership; never retrofit a played game.
  if (!game.techTokens) game = applyAction(game, game.host, { type: 'techTokens', enabled: true });
  for (const player of game.players) if (!player.ready) game = applyAction(game, player.id, { type: 'ready' });
  return withPaymentSkillOffers(game, () => initializeSpiceBankerIncomeGameForAudit(game));
}

export function completeSkillsTechPaymentsSetup(state: Game, actions?: SkillsTechPaymentsStep[]): Game {
  let game = state;
  for (let i = 0; game.status === 'setup' && i < 200; i++) {
    if (game.setupStage === 'leaderSkills') {
      const actor = Object.keys(game.leaderSkills!.offers)[0];
      const offer = game.leaderSkills!.offers[actor];
      const player = game.players.find(seat => seat.id === actor)!;
      const view = viewGame(game, actor).leaderSkills!;
      const skill = player.faction === 'atreides' ? 'spice-banker'
        : player.faction === 'harkonnen' ? 'smuggler' : offer.cards[0];
      assert.ok(offer.cards.includes(skill));
      assert.ok(view.eligibleLeaders[0]);
      const action: Action = { type: 'leaderSkill', event: offer.event, skill, leader: view.eligibleLeaders[0].id };
      actions?.push({ actor, action });
      game = applyAction(game, actor, action);
    } else game = step(game, actions);
  }
  assert.equal(game.status, 'playing');
  return game;
}

/** First clean native boundary at/after target; empty Battle may auto-skip. Never assign turn or phase. */
export function advanceSkillsTechPaymentsToPhase(state: Game, target: number, actions?: SkillsTechPaymentsStep[]): Game {
  let game = state;
  const turn = game.turn;
  for (let i = 0; (game.phase < target || game.phaseOpening || game.response || game.decision)
    && game.status === 'playing' && game.turn === turn && i < 1000; i++) game = step(game, actions);
  assert.equal(game.turn, turn);
  assert.ok(game.phase >= target);
  assert.ok(!game.phaseOpening && !game.response && !game.decision);
  return game;
}

/** Empty native stronghold avoids incidental sand spice collection and combat;
 * no board occupancy or token ownership is staged for shipment. */
export function skillsTechPaymentsEmptyDestination(game: Game): { territory: string; sector: number } {
  const destination = TERRITORIES.find(territory => territory.type === 'stronghold'
    && !territory.sectors.includes(game.storm)
    && game.players.every(player => Object.entries(player.forces)
      .every(([key, amount]) => !amount || !key.startsWith(`${territory.id}:`))));
  assert.ok(destination);
  return { territory: destination.id, sector: destination.sectors[0] };
}

/** Stops BEFORE the native payment/companion action, preserving the original
 * available wallets and IDs for an authenticated human payment smoke. The only
 * controlled position is labelled conserved Emperor reserve->Tanks casualties. */
export function createSkillsTechPaymentsFixture(options: SkillsTechPaymentsOptions = {}): SkillsTechPaymentsFixture {
  const actions: SkillsTechPaymentsStep[] = [];
  const setup = initializeSkillsTechPaymentsSetup(options);
  let game = completeSkillsTechPaymentsSetup(setup, actions);
  const kind = options.kind ?? 'force-revival';
  const owner = game.players.find(player => player.faction === 'atreides')!.id;
  const smugglerOwner = game.players.find(player => player.faction === 'harkonnen')!.id;
  const actor = kind === 'force-revival' ? game.players.find(player => player.faction === 'emperor')!.id
    : kind === 'guild-shipment' ? game.players.find(player => player.faction === 'guild')!.id : smugglerOwner;
  game = advanceSkillsTechPaymentsToPhase(game, kind === 'force-revival' ? 4 : 5, actions);
  let amount: number;
  let cost: number;
  let paymentAction: Action;
  let destination: string | undefined;
  if (kind === 'force-revival') {
    amount = options.amount ?? 3;
    const payer = game.players.find(player => player.id === actor)!;
    assert.ok(payer.reserves >= amount);
    // Explicit conserved casualty unit position, not fabricated native money.
    payer.reserves -= amount;
    payer.tanks += amount;
    cost = forceRevivalQuote(game, payer, amount).cost;
    paymentAction = { type: 'revive', amount };
  } else {
    for (let i = 0; game.active !== actor && i < 20; i++) game = step(game, actions);
    assert.equal(game.active, actor);
    const target = skillsTechPaymentsEmptyDestination(game);
    destination = `${target.territory}:${target.sector}`;
    amount = options.amount ?? (kind === 'guild-shipment' ? 8 : 5);
    const smuggler = kind === 'shipment' && options.smuggler !== false;
    cost = kind === 'guild-shipment' ? Math.ceil(amount / 2) : amount - (smuggler ? 1 : 0);
    paymentAction = { type: 'ship', ...target, amount, ...(smuggler ? { smuggler: true } : {}) };
  }
  const token = kind === 'force-revival' ? 'axlotl' : 'heighliners';
  const tokenOwner = game.techTokens![token].owner;
  assert.ok(tokenOwner, 'Ownership must have been assigned by the original first Storm.');
  return { game, beforePayment: structuredClone(game), setup, actions, actor, payer: actor,
    owner, smugglerOwner, paymentAction, amount, cost, token, tokenOwner, destination };
}

export function paySkillsTechPaymentsFixture(fixture: SkillsTechPaymentsFixture): Game {
  let game = applyAction(fixture.game, fixture.actor, fixture.paymentAction);
  for (let i = 0; (game.response || game.decision || game.pendingRevival || game.pendingShipment) && i < 200; i++) game = step(game);
  assert.ok(!game.response && !game.decision && !game.pendingRevival && !game.pendingShipment);
  return game;
}
