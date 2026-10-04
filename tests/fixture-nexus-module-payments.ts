import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeNexusGameForAudit, joinGame, newPlayer,
  viewGame, type Action, type Game,
} from '../game/engine';
import { territory } from '../game/board';
import type { FactionId } from '../game/catalog';
import { quoteNexusGuildSecretShipment } from '../game/nexus-guild-secret-ally';
import { quoteNexusRicheseShipment } from '../game/nexus-richese';
import { ownedTech, type TechId } from '../game/tech-tokens';
import { classicNexusModulesProfile } from '../game/nexus-module-profile';
import { nextSpiceBankerIncomeNativeStep } from './fixture-spice-banker-income';
import { nexusInventory, orderNexusSpice } from './fixture-nexus-cards';
import { skillsTechPaymentsEmptyDestination } from './fixture-skills-tech-payments';

export type NexusModulePaymentKind = 'guild-shipment' | 'richese-shipment' | 'emperor-revival' | 'fremen-revival' | 'emperor-purchase';
export type NexusModulePaymentStep = { actor: string; action: Action };
export type NexusModulePaymentsOptions = {
  initial?: Game;
  kind?: NexusModulePaymentKind;
  advanced?: boolean;
  tech?: boolean;
  strongholds?: boolean;
  ownerFaction?: 'atreides' | 'harkonnen' | 'emperor' | 'fremen' | 'guild';
  nativeGuild?: boolean;
  tanks?: number;
  eliteTanks?: number;
};
export type NexusModulePaymentsFixture = {
  game: Game;
  beforePayment: Game;
  setup: Game;
  actions: NexusModulePaymentStep[];
  staging: string[];
  actor: string;
  kind: NexusModulePaymentKind;
  paymentAction: Action;
  amount: number;
  cost: number;
  token: TechId;
  tokenOwner: string | null;
  tokenCount: number;
  destination?: string;
};

/** Use the existing original continuation policy, never a fixture phase jump. */
export function nextNexusModulePaymentsNativeStep(game: Game): NexusModulePaymentStep | null {
  if (game.nexusCards?.phase?.stage === 'drawing' && !game.response && !game.decision) {
    const phase = game.nexusCards.phase;
    const actor = phase.eligible.find(id => !phase.done.includes(id));
    if (actor) return { actor, action: { type: 'nexusCardChoice', turn: game.turn,
      card: game.nexusCards.cards!.hands[actor], choice: 'keep', ownRedraws: 0 } };
  }
  return nextSpiceBankerIncomeNativeStep(game);
}
function step(game: Game, actions?: NexusModulePaymentStep[]): Game {
  const next = nextNexusModulePaymentsNativeStep(game);
  assert.ok(next, 'The original Nexus payment continuation needs an action.');
  actions?.push(structuredClone(next));
  return applyAction(game, next.actor, next.action);
}
const clean = (game: Game) => !game.phaseOpening && !game.response && !game.decision;

export function advanceNexusModulePaymentsToPhase(state: Game, phase: number,
  actions?: NexusModulePaymentStep[]): Game {
  let game = state;
  const turn = game.turn;
  for (let n = 0; (game.phase < phase || !clean(game)) && n < 1200; n++) {
    assert.equal(game.turn, turn);
    game = step(game, actions);
  }
  assert.equal(game.turn, turn);
  assert.ok(game.phase >= phase && clean(game));
  return game;
}

function deterministic<T>(run: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    assert.ok(array);
    new Uint8Array(array.buffer, array.byteOffset, array.byteLength).fill(255);
    return array;
  };
  try { return run(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}
function reserveBoard(game: Game, staging: string[]) {
  for (const player of game.players) {
    const count = Object.values(player.forces).reduce((a, b) => a + b, 0);
    player.reserves += count;
    player.forces = {};
    if (player.elites) {
      player.elites.reserves += Object.values(player.elites.forces).reduce((a, b) => a + b, 0);
      player.elites.forces = {};
    }
    if (player.advisors) player.advisors = {};
    if (count) staging.push(`Conserved ${player.id}: ${count} board counters to reserves.`);
  }
}

/** Fresh classic lobby and original setup/Storm/first-Mentat ownership. No
 * manufactured wallet, phase, Tech owner, Stronghold owner or earned receipt. */
export function initializeNexusModulePaymentsSetup(options: NexusModulePaymentsOptions = {}): Game {
  const kind = options.kind ?? 'guild-shipment';
  const ownerFaction = options.ownerFaction ?? (kind === 'fremen-revival' ? 'emperor' : 'atreides');
  let game = options.initial ? structuredClone(options.initial)
    : createGame('NEXUSMODULEPAYMENTS', newPlayer('payer', 'Payer', ownerFaction),
      options.advanced ?? !!options.strongholds);
  if (game.status === 'setup') {
    assert.equal(game.turn, 1); assert.equal(game.phase, 0);
    assert.ok(game.players.every(p => p.hand.length === 0));
    assert.ok(classicNexusModulesProfile(game));
    assert.equal(!!game.techTokens, options.tech !== false);
    assert.equal(!!game.strongholdCards, !!options.strongholds);
    if (options.advanced !== undefined) assert.equal(game.advanced, options.advanced);
    assert.ok(game.players.some(p => p.faction === ownerFaction));
    return game;
  }
  assert.equal(game.status, 'lobby', 'Use the fresh authenticated undealt lobby.');
  if (!options.initial) {
    const forbidden = kind === 'guild-shipment' ? 'guild' : kind === 'fremen-revival' ? 'fremen'
      : kind.startsWith('emperor-') ? 'emperor' : 'richese';
    const candidates: FactionId[] = options.nativeGuild ? ['guild', 'harkonnen', 'atreides', 'emperor']
      : ['harkonnen', 'atreides', 'emperor', 'guild'];
    for (const faction of candidates) if (game.players.length < 3 && faction !== forbidden && faction !== ownerFaction)
      joinGame(game, newPlayer(faction, faction, faction));
  }
  assert.ok(game.players.some(p => p.faction === ownerFaction));
  if (options.advanced !== undefined) assert.equal(game.advanced, options.advanced);
  if (options.tech !== false && !game.techTokens)
    game = applyAction(game, game.host, { type: 'techTokens', enabled: true });
  if (options.strongholds && !game.strongholdCards)
    game = applyAction(game, game.host, { type: 'strongholdCards', enabled: true });
  if (!game.nexusCards) game.nexusCards = { cards: null, phase: null };
  for (const player of game.players) if (!player.ready)
    game = applyAction(game, player.id, { type: 'ready' });
  return deterministic(() => initializeNexusGameForAudit(game));
}

/** Native second-turn Nexus supplies the singleton through an actual draw.
 * Only conserved board/card ordering and reserve-to-Tanks casualties are staged.
 * Stops before the real human payment/spend; initial preserves authenticated IDs. */
export function createNexusModulePaymentsFixture(options: NexusModulePaymentsOptions = {}): NexusModulePaymentsFixture {
  return deterministic(() => {
    const actions: NexusModulePaymentStep[] = [], staging: string[] = [];
    const kind = options.kind ?? 'guild-shipment';
    const ownerFaction = options.ownerFaction ?? (kind === 'fremen-revival' ? 'emperor' : 'atreides');
    const setup = initializeNexusModulePaymentsSetup(options);
    let game = setup;
    for (let n = 0; game.status === 'setup' && n < 200; n++) game = step(game, actions);
    assert.equal(game.status, 'playing');
    const actor = game.players.find(p => p.faction === ownerFaction)!.id;
    reserveBoard(game, staging);
    if (options.strongholds) {
      const player = game.players.find(p => p.id === actor)!;
      player.reserves--;
      player.forces['arrakeen:10'] = 1;
      staging.push(`Conserved ${actor}: one reserve counter to Arrakeen before genuine first Mentat claim.`);
    }
    // A real full first turn precedes a real second-turn worm/Nexus. First-turn
    // land-only ordering avoids ignored drawn worms, without adding spice cards.
    let firstOrdered = false;
    for (let n = 0; !(game.turn === 2 && game.phase === 1 && clean(game)) && n < 1400; n++) {
      if (game.turn === 1 && game.phase === 1 && !firstOrdered) {
        orderNexusSpice(game, ['land', 'land']); firstOrdered = true;
      }
      game = step(game, actions);
    }
    assert.equal(game.turn, 2);
    assert.equal(game.phase, 1);
    if (options.strongholds) assert.equal(game.strongholdCards!.owners.arrakeen, actor);
    reserveBoard(game, staging);
    orderNexusSpice(game, ['worm', 'land', 'land']);
    let allied = false;
    for (let n = 0; game.nexusCards?.phase?.stage !== 'drawing' && n < 200; n++) {
      if (game.nexus && !game.spiceWindow && !game.spiceResolution && clean(game) && !allied) {
        const others = game.players.filter(p => p.id !== actor);
        assert.ok(others.length >= 2);
        for (const [from, to] of [[others[0].id, others[1].id], [others[1].id, others[0].id]]) {
          const action: Action = { type: 'alliance', target: to };
          actions.push({ actor: from, action });
          game = applyAction(game, from, action);
        }
        allied = true;
      }
      game = step(game, actions);
    }
    assert.ok(allied, 'The real Nexus negotiations must precede the singleton draw.');
    assert.equal(game.nexusCards?.phase?.stage, 'drawing');
    const card: FactionId = kind === 'guild-shipment' ? 'guild' : kind === 'richese-shipment' ? 'richese'
      : kind.startsWith('emperor-') ? 'emperor' : 'fremen';
    const cards = game.nexusCards!.cards!;
    assert.ok(cards.deck.includes(card));
    cards.deck = [card, ...cards.deck.filter(c => c !== card)];
    const draw: NexusModulePaymentStep = { actor, action: { type: 'nexusCardChoice', turn: game.turn,
      card: cards.hands[actor], choice: 'draw', ownRedraws: 0 } };
    actions.push(draw);
    game = applyAction(game, actor, draw.action);
    assert.equal(game.nexusCards!.cards!.hands[actor], card);
    while (game.nexusCards?.phase?.stage === 'drawing') game = step(game, actions);
    const shipment = kind.endsWith('shipment');
    const purchase = kind === 'emperor-purchase';
    game = advanceNexusModulePaymentsToPhase(game, shipment ? 5 : purchase ? 3 : 4, actions);
    let paymentAction: Action, cost = 0, destination: string | undefined;
    const amount = shipment ? 5 : purchase ? 1 : 3;
    if (purchase) {
      for (let n = 0; game.decision?.kind !== 'auctionPayment' && n < 100; n++) {
        if (game.auction?.active === actor && !game.auction.bid) {
          const action: Action = { type: 'bid', amount: 2 };
          actions.push({ actor, action });
          game = applyAction(game, actor, action);
        } else game = step(game, actions);
      }
      assert.equal(game.phase, 3);
      assert.equal(game.decision?.kind, 'auctionPayment');
      assert.equal(game.decision!.player, actor);
      assert.equal(game.auction!.bidder, actor);
      assert.equal(game.auction!.bid, 2);
      assert.equal(game.auction!.allyPayment ?? 0, 0);
      cost = game.auction!.bid;
      paymentAction = { type: 'nexusEmperorPurchase', event: viewGame(game, actor).nexusEmperorSecretAlly!.event };
    } else if (shipment) {
      for (let n = 0; game.active !== actor && n < 30; n++) game = step(game, actions);
      assert.equal(game.active, actor);
      const target = skillsTechPaymentsEmptyDestination(game);
      destination = `${target.territory}:${target.sector}`;
      const player = game.players.find(p => p.id === actor)!;
      cost = kind === 'guild-shipment' ? quoteNexusGuildSecretShipment(territory(target.territory).type, amount).cost
        : quoteNexusRicheseShipment({ faction: player.faction, halfRate: player.faction === 'guild' },
          territory(target.territory).type, amount).cost;
      const view = viewGame(game, actor);
      const event = kind === 'guild-shipment' ? view.nexusGuildSecretAlly!.event : view.nexusRichese!.event;
      paymentAction = { type: 'ship', ...target, amount, nexus: event };
    } else {
      const player = game.players.find(p => p.id === actor)!;
      const tanks = options.tanks ?? 6, elite = options.eliteTanks ?? 0;
      assert.ok(tanks <= player.reserves && elite <= (player.elites?.reserves ?? 0));
      player.reserves -= tanks; player.tanks += tanks;
      if (player.elites) { player.elites.reserves -= elite; player.elites.tanks += elite; }
      staging.push(`Conserved ${actor}: ${tanks} reserves to Tanks, including ${elite} actual elites.`);
      const view = viewGame(game, actor);
      const event = kind === 'emperor-revival' ? view.nexusEmperorSecretAlly!.event : view.nexusFremenRevival!.event;
      paymentAction = { type: kind === 'emperor-revival' ? 'nexusEmperorRevive' : 'nexusFremenRevive',
        event, elite: elite ? 1 : 0 };
    }
    nexusInventory(game);
    const token: TechId = shipment ? 'heighliners' : purchase ? 'production' : 'axlotl';
    const tokenOwner = game.techTokens?.[token].owner ?? null;
    const tokenCount = tokenOwner ? ownedTech(game.techTokens, tokenOwner).length : 0;
    return { game, beforePayment: structuredClone(game), setup, actions, staging, actor, kind,
      paymentAction, amount, cost, token, tokenOwner, tokenCount, destination };
  });
}

export function payNexusModulePaymentsFixture(fixture: NexusModulePaymentsFixture): Game {
  let game = applyAction(fixture.game, fixture.actor, fixture.paymentAction);
  for (let n = 0; (!clean(game) || game.pendingShipment || game.pendingRevival) && n < 200; n++)
    game = step(game);
  assert.ok(clean(game) && !game.pendingShipment && !game.pendingRevival);
  return game;
}
