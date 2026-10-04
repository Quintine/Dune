import assert from 'node:assert/strict';
import { applyAction, createGame, handLimit, joinGame, newPlayer, viewGame,
  type Action, type Game } from '../game/engine';
import { distance, TERRITORIES, territory } from '../game/board';
import { botActions } from '../game/bots';
import type { FactionId } from '../game/catalog';
import type { Card } from '../game/cards';
import type { LeaderSkillId } from '../game/leader-skill-cards';
import { STRONGHOLD_CARDS } from '../game/stronghold-cards';
import { ownedTech, TECH_TOKENS, type TechId } from '../game/tech-tokens';
import { classicNexusSkillsPaymentsInventory, classicNexusSkillsPaymentsPlayer,
  initializeClassicNexusSkillsPaymentsSetup, nextClassicNexusSkillsPaymentsNativeStep,
  type ClassicNexusSkillsPaymentStep } from './fixture-classic-nexus-skills-payments';

export type NexusSkillsModulesPaymentKind = 'emperor-revival' | 'fremen-revival' | 'emperor-purchase' | 'native-shipment';
export type NexusSkillsModulesPaymentStep = ClassicNexusSkillsPaymentStep;
export type NexusSkillsModulesPaymentsOptions = {
  /** Original lobby or turn-one, phase-zero unassigned Skills setup; never redealt. */
  initial?: Game;
  advanced?: boolean;
  tech?: boolean;
  strongholds?: boolean;
  seatIds?: string[];
  ownerFaction?: FactionId;
  kind?: NexusSkillsModulesPaymentKind;
  skill?: LeaderSkillId;
  nativeGuild?: boolean;
  tanks?: number;
  eliteTanks?: number;
  amount?: number;
};
export type NexusSkillsModulesPaymentsFixture = {
  initial: Game;
  afterSetup: Game;
  beforeFirstMentat: Game;
  firstMentatStep: NexusSkillsModulesPaymentStep;
  afterFirstMentat: Game;
  beforeClosingDraw: Game;
  closingDraw: NexusSkillsModulesPaymentStep;
  afterClosingDraw: Game;
  beforePayment: Game;
  game: Game;
  actor: string;
  opponent: string;
  kind: NexusSkillsModulesPaymentKind;
  paymentAction: Action;
  amount: number;
  cost: number;
  token: TechId;
  tokenOwner: string | null;
  tokenCount: number;
  destination?: string;
  actions: NexusSkillsModulesPaymentStep[];
  staging: string[];
};
const clean = (game: Game) => !game.phaseOpening && !game.response && !game.decision && !game.truthtrance;
export const nexusSkillsModulesPaymentsPlayer = classicNexusSkillsPaymentsPlayer;

/** Scalar rolls stabilize physical deck/Storm order; UUID byte arrays stay native. */
function originalRandom<T>(run: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const native = crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array && array.length === 1) array[0] = 0xffffffff;
    else Reflect.apply(native, crypto, [array]);
    return array;
  };
  try { return run(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}
export function nextNexusSkillsModulesPaymentsNativeStep(game: Game): NexusSkillsModulesPaymentStep | null {
  if (clean(game) && game.status === 'finished') return null;
  if (game.truthtrance && !game.phaseOpening && !game.response) {
    for (const player of game.players) {
      const view = viewGame(game, player.id);
      view.players.find(p => p.id === player.id)!.bot = 'Easy';
      const action = botActions(view)[0];
      if (action) return { actor: player.id, action };
    }
    throw Error('The actual Truthtrance must expose its native priority/question/answer action');
  }
  if (!game.phaseOpening && !game.response && game.decision?.kind === 'faceDance')
    return { actor: game.decision.player, action: { type: 'decision', reveal: false } };
  return nextClassicNexusSkillsPaymentsNativeStep(game);
}
export function advanceNexusSkillsModulesPaymentsStep(state: Game, actions?: NexusSkillsModulesPaymentStep[]): Game {
  const next = nextNexusSkillsModulesPaymentsNativeStep(state);
  assert.ok(next, 'The native continuation stopped for a human battle plan');
  actions?.push(structuredClone(next));
  return applyAction(state, next.actor, next.action);
}
export function advanceNexusSkillsModulesPayments(state: Game, predicate: (game: Game) => boolean,
  actions?: NexusSkillsModulesPaymentStep[]): Game {
  let game = state;
  for (let n = 0; n < 1800; n++) {
    if (predicate(game)) return game;
    assert.notEqual(game.status, 'finished');
    game = advanceNexusSkillsModulesPaymentsStep(game, actions);
  }
  throw Error('Original Nexus/Skills/module continuation did not reach its boundary');
}
export function advanceNexusSkillsModulesPaymentsToPhase(state: Game, phase: number,
  actions?: NexusSkillsModulesPaymentStep[]): Game {
  const turn = state.turn;
  return advanceNexusSkillsModulesPayments(state, game => {
    assert.equal(game.turn, turn);
    return game.phase >= phase && clean(game);
  }, actions);
}

export function initializeNexusSkillsModulesPaymentsSetup(options: NexusSkillsModulesPaymentsOptions = {}): Game {
  const kind = options.kind ?? 'emperor-revival';
  const ownerFaction = options.ownerFaction ?? 'atreides';
  let game = options.initial ? structuredClone(options.initial)
    : createGame('NEXUSSKILLSMODULEPAYMENTS', newPlayer(options.seatIds?.[0] ?? 'payer', ownerFaction, ownerFaction),
      options.advanced ?? !!options.strongholds);
  if (!options.initial) {
    const forbidden = kind === 'fremen-revival' ? 'fremen' : 'emperor';
    const count = options.seatIds?.length ?? 3;
    assert.ok(count >= 3 && count <= 6);
    const factions: FactionId[] = options.nativeGuild
      ? ['guild', 'harkonnen', 'atreides', 'beneGesserit', 'fremen', 'emperor']
      : ['harkonnen', 'atreides', 'beneGesserit', 'guild', 'fremen', 'emperor'];
    for (const faction of factions) if (game.players.length < count && faction !== forbidden && faction !== ownerFaction)
      joinGame(game, newPlayer(options.seatIds?.[game.players.length] ?? faction, faction, faction));
    assert.equal(game.players.length, count);
  }
  if (options.advanced !== undefined) assert.equal(game.advanced, options.advanced);
  const tech = options.tech ?? (options.initial ? !!game.techTokens : true);
  const strongholds = options.strongholds ?? !!game.strongholdCards;
  assert.ok(tech || strongholds, 'Select original Tech and/or Advanced Strongholds');
  if (game.status === 'lobby') {
    if (tech && !game.techTokens) game = applyAction(game, game.host, { type: 'techTokens', enabled: true });
    if (strongholds && !game.strongholdCards) game = applyAction(game, game.host, { type: 'strongholdCards', enabled: true });
  }
  assert.equal(!!game.techTokens, tech);
  assert.equal(!!game.strongholdCards, strongholds);
  if (options.nativeGuild) assert.ok(game.players.some(player => player.faction === 'guild'));
  return initializeClassicNexusSkillsPaymentsSetup({ initial: game, ownerFaction,
    kind: kind === 'native-shipment' ? 'emperor-revival' : kind, advanced: options.advanced, skill: options.skill });
}
function reserveBoard(game: Game, staging: string[]): void {
  for (const player of game.players) {
    player.reserves += Object.values(player.forces).reduce((a, b) => a + b, 0);
    player.forces = {};
    if (player.elites) {
      player.elites.reserves += Object.values(player.elites.forces).reduce((a, b) => a + b, 0);
      player.elites.forces = {};
    }
    if (player.advisors) player.advisors = {};
  }
  staging.push('Conserved every original board counter into its own reserves; no wallet, phase, module owner or earned receipt assigned.');
}
function orderUndealtSpice(game: Game, kinds: ('land' | 'worm')[], staging: string[]): void {
  const front: Game['spiceDeck'] = [];
  for (const kind of kinds) {
    const index = game.spiceDeck.findIndex(card => kind === 'land' ? 'territory' in card : 'worm' in card);
    assert.ok(index >= 0, 'Only actual still-undealt physical Spice Cards may be ordered');
    front.push(game.spiceDeck.splice(index, 1)[0]);
  }
  game.spiceDeck.unshift(...front);
  staging.push(`Ordered original undealt Spice Card singletons: ${kinds.join(', ')}; discard custody unchanged.`);
}
/** Relocates an actual original card, retaining its identity and the 33-card inventory. */
export function holdNexusSkillsModulesPaymentsCard(game: Game, actor: string, kind: Card['kind'] | 'karama' | 'truthtrance', staging: string[]): Card {
  const player = nexusSkillsModulesPaymentsPlayer(game, actor);
  const matches = (card: Card) => card.kind === kind || card.effect === kind;
  const held = player.hand.find(matches);
  if (held) return held;
  assert.ok(player.hand.length < handLimit(player));
  const index = game.deck.findIndex(matches);
  const donor = index < 0 ? game.players.find(p => p.id !== actor && p.hand.some(matches)) : undefined;
  assert.ok(index >= 0 || donor, `An original ${kind} card must remain in real deck/hand custody`);
  const card = index >= 0 ? game.deck.splice(index, 1)[0]
    : donor!.hand.splice(donor!.hand.findIndex(matches), 1)[0];
  player.hand.push(card);
  staging.push(`Conserved original ${card.id}: ${donor?.id ?? 'undealt deck'} custody to ${actor}'s hand.`);
  return card;
}

/** Full original setup, first Storm assignment, first END Mentat claim and real
 * unallied closing draw precede the payment. Only physical positioning/order is staged. */
export function createNexusSkillsModulesPaymentsFixture(options: NexusSkillsModulesPaymentsOptions = {}): NexusSkillsModulesPaymentsFixture {
  const initial = initializeNexusSkillsModulesPaymentsSetup(options);
  return originalRandom(() => {
    const kind = options.kind ?? 'emperor-revival';
    const actor = initial.players.find(p => p.faction === (options.ownerFaction ?? 'atreides'))!.id;
    const opponent = initial.players.find(p => p.id !== actor)!.id;
    const actions: NexusSkillsModulesPaymentStep[] = [], staging: string[] = [];
    let game = initial;
    while (game.status === 'setup') {
      let next = nextNexusSkillsModulesPaymentsNativeStep(game); assert.ok(next);
      if (game.setupStage === 'leaderSkills' && next.actor === actor && options.skill) {
        const view = viewGame(game, actor).leaderSkills!;
        assert.ok(view.offer!.cards.includes(options.skill), 'Explicit skill must exist in the saved original offer');
        assert.ok(!view.unavailableSkills?.[options.skill]);
        next = { actor, action: { ...next.action, skill: options.skill } };
      }
      actions.push(structuredClone(next)); game = applyAction(game, next.actor, next.action);
    }
    const afterSetup = structuredClone(game);
    reserveBoard(game, staging);
    if (game.strongholdCards) {
      const player = nexusSkillsModulesPaymentsPlayer(game, actor);
      assert.ok(player.reserves - (player.elites?.reserves ?? 0) >= 1);
      player.reserves--; player.forces['arrakeen:10'] = 1;
      staging.push(`Conserved one ordinary ${actor} reserve counter to Arrakeen before the real first END Mentat claim.`);
    }
    game = advanceNexusSkillsModulesPaymentsToPhase(game, 1, actions);
    orderUndealtSpice(game, ['land', 'land'], staging);
    game = advanceNexusSkillsModulesPaymentsToPhase(game, 8, actions);
    let beforeFirstMentat: Game | undefined, firstMentatStep: NexusSkillsModulesPaymentStep | undefined;
    while (game.turn === 1) {
      const before = structuredClone(game), next = nextNexusSkillsModulesPaymentsNativeStep(game); assert.ok(next);
      game = advanceNexusSkillsModulesPaymentsStep(game, actions);
      if (game.turn === 2) { beforeFirstMentat = before; firstMentatStep = next; }
    }
    assert.ok(beforeFirstMentat && firstMentatStep);
    const afterFirstMentat = structuredClone(game);
    if (game.strongholdCards) assert.equal(game.strongholdCards.owners.arrakeen, actor);
    game = advanceNexusSkillsModulesPaymentsToPhase(game, 1, actions);
    reserveBoard(game, staging);
    orderUndealtSpice(game, ['worm', 'land', 'land'], staging);
    let allied = false;
    for (let n = 0; game.nexusCards?.phase?.stage !== 'drawing' && n < 240; n++) {
      if (game.nexus && !game.spiceWindow && !game.spiceResolution && clean(game) && !allied) {
        const others = game.players.filter(p => p.id !== actor); assert.ok(others.length >= 2);
        for (const [from, to] of [[others[0].id, others[1].id], [others[1].id, others[0].id]]) {
          const action: Action = { type: 'alliance', target: to };
          actions.push({ actor: from, action }); game = applyAction(game, from, action);
        }
        allied = true;
      }
      game = advanceNexusSkillsModulesPaymentsStep(game, actions);
    }
    assert.ok(allied); assert.equal(game.nexusCards?.phase?.stage, 'drawing');
    const card = kind === 'fremen-revival' ? 'fremen' : 'emperor';
    const cards = game.nexusCards!.cards!, index = cards.deck.indexOf(card); assert.ok(index >= 0);
    cards.deck.unshift(cards.deck.splice(index, 1)[0]);
    staging.push(`Ordered original undealt ${card} Nexus singleton before a genuine closing draw; no card grant.`);
    const beforeClosingDraw = structuredClone(game);
    const closingDraw: NexusSkillsModulesPaymentStep = { actor, action: { type: 'nexusCardChoice', turn: game.turn,
      card: cards.hands[actor], choice: 'draw', ownRedraws: 0 } };
    actions.push(closingDraw); game = applyAction(game, actor, closingDraw.action);
    assert.equal(game.nexusCards!.cards!.hands[actor], card);
    const afterClosingDraw = structuredClone(game);
    game = advanceNexusSkillsModulesPayments(game, state => state.nexusCards?.phase?.stage !== 'drawing', actions);
    game = advanceNexusSkillsModulesPaymentsToPhase(game, kind === 'native-shipment' ? 5 : kind === 'emperor-purchase' ? 3 : 4, actions);
    let paymentAction: Action, destination: string | undefined, cost = 0;
    const amount = kind === 'native-shipment' ? options.amount ?? 3 : kind === 'emperor-purchase' ? 1 : 3;
    if (kind === 'emperor-purchase') {
      for (let n = 0; game.decision?.kind !== 'auctionPayment' && n < 160; n++) {
        if (game.auction?.active === actor && !game.auction.bid) {
          const action: Action = { type: 'bid', amount: 2 };
          actions.push({ actor, action }); game = applyAction(game, actor, action);
        } else game = advanceNexusSkillsModulesPaymentsStep(game, actions);
      }
      assert.equal(game.decision?.kind, 'auctionPayment'); assert.equal(game.decision!.player, actor);
      assert.equal(game.auction!.bid, 2); assert.equal(game.auction!.bidder, actor);
      cost = game.auction!.bid;
      paymentAction = { type: 'nexusEmperorPurchase', event: viewGame(game, actor).nexusEmperorSecretAlly!.event };
    } else if (kind === 'native-shipment') {
      game = advanceNexusSkillsModulesPayments(game, state => state.active === actor && clean(state), actions);
      const player = nexusSkillsModulesPaymentsPlayer(game, actor);
      const target = TERRITORIES.find(t => t.type === 'stronghold' && !t.sectors.includes(game.storm)
        && game.players.every(p => Object.keys(p.forces).every(key => !key.startsWith(`${t.id}:`)))
        && (player.faction !== 'fremen' || territory('the_great_flat').sectors.some(from =>
          t.sectors.some(to => distance(`the_great_flat:${from}`, `${t.id}:${to}`) <= 2))));
      assert.ok(target, 'An empty native-legal stronghold destination must exist');
      destination = `${target.id}:${target.sectors[0]}`;
      cost = player.faction === 'fremen' ? 0 : player.faction === 'guild' ? Math.ceil(amount / 2) : amount;
      assert.ok(player.spice >= cost);
      paymentAction = { type: 'ship', territory: target.id, sector: target.sectors[0], amount, smuggler: false };
    } else {
      const player = nexusSkillsModulesPaymentsPlayer(game, actor), tanks = options.tanks ?? 6, elite = options.eliteTanks ?? 0;
      assert.ok(Number.isInteger(tanks) && tanks >= 0 && Number.isInteger(elite) && elite >= 0 && elite <= tanks);
      assert.ok(tanks - elite <= player.reserves - (player.elites?.reserves ?? 0) && elite <= (player.elites?.reserves ?? 0));
      player.reserves -= tanks; player.tanks += tanks;
      if (player.elites) { player.elites.reserves -= elite; player.elites.tanks += elite; }
      staging.push(`Conserved ${actor}: ${tanks} original reserve counters to Tanks, including ${elite} elites; no revival receipt staged.`);
      const view = viewGame(game, actor);
      paymentAction = { type: kind === 'emperor-revival' ? 'nexusEmperorRevive' : 'nexusFremenRevive',
        event: kind === 'emperor-revival' ? view.nexusEmperorSecretAlly!.event : view.nexusFremenRevival!.event, elite: elite ? 1 : 0 };
    }
    nexusSkillsModulesPaymentsInventory(game);
    const token: TechId = kind === 'native-shipment' ? 'heighliners' : kind === 'emperor-purchase' ? 'production' : 'axlotl';
    const tokenOwner = game.techTokens?.[token].owner ?? null;
    return { initial, afterSetup, beforeFirstMentat, firstMentatStep, afterFirstMentat, beforeClosingDraw, closingDraw,
      afterClosingDraw, beforePayment: structuredClone(game), game, actor, opponent, kind, paymentAction, amount, cost,
      token, tokenOwner, tokenCount: tokenOwner ? ownedTech(game.techTokens, tokenOwner).length : 0, destination, actions, staging };
  });
}
/** One original action only: exposes any actual interception/payment response. */
export function payNexusSkillsModulesPaymentsFixture(fixture: NexusSkillsModulesPaymentsFixture, state = fixture.game): Game {
  return applyAction(state, fixture.actor, fixture.paymentAction);
}
export function finishNexusSkillsModulesPaymentsFixture(_fixture: NexusSkillsModulesPaymentsFixture, state: Game,
  actions?: NexusSkillsModulesPaymentStep[]): Game {
  return advanceNexusSkillsModulesPayments(state, game => clean(game) && !game.pendingRevival && !game.pendingShipment, actions);
}
export function nexusSkillsModulesPaymentsInventory(game: Game): void {
  classicNexusSkillsPaymentsInventory(game);
  if (game.techTokens) assert.deepEqual(Object.keys(game.techTokens).sort(), TECH_TOKENS.map(t => t.id).sort());
  if (game.strongholdCards) assert.deepEqual(Object.keys(game.strongholdCards.owners).sort(), STRONGHOLD_CARDS.map(c => c.id).sort());
}
