import assert from 'node:assert/strict';
import { applyAction, createGame, initializeNexusGameForAudit, joinGame, newPlayer, viewGame,
  type Action, type Game, type Player } from '../game/engine';
import type { FactionId } from '../game/catalog';
import type { Card } from '../game/cards';
import { validateDiscoveryState } from '../game/discoveries';
import { classicDiscoveryNexusProfile } from '../game/discovery-module-profile';
import { traitorDeck } from '../game/traitors';
import { ownedTech, type TechId } from '../game/tech-tokens';
import { nexusInventory } from './fixture-nexus-cards';
import { holdNexusSkillsModulesPaymentsCard, nextNexusSkillsModulesPaymentsNativeStep } from './fixture-nexus-skills-modules-payments';

export type DiscoveryClassicNexusEffectKind = 'emperor-revival' | 'fremen-revival' | 'guild-shipment';
export type DiscoveryClassicNexusEffectStep = { actor: string; action: Action };
export type DiscoveryClassicNexusEffectsOptions = {
  /** Authenticated original lobby or turn-one uncompleted native setup; never redealt. */
  initial?: Game;
  seatIds?: string[];
  advanced?: boolean;
  tech?: boolean;
  strongholds?: boolean;
  kind?: DiscoveryClassicNexusEffectKind;
  ownerFaction?: FactionId;
  tanks?: number;
  eliteTanks?: number;
};
export type DiscoveryClassicNexusEffectsFixture = {
  initial: Game;
  afterSetup: Game;
  beforeReveal: Game;
  afterReveal: Game;
  beforeEntry: Game;
  afterEntry: Game;
  beforeClosingDraw: Game;
  closingDraw: DiscoveryClassicNexusEffectStep;
  afterClosingDraw: Game;
  game: Game;
  actor: string;
  opponent: string;
  kind: DiscoveryClassicNexusEffectKind;
  paymentAction: Action;
  token: string;
  source: string;
  tokenOwner: string | null;
  tokenCount: number;
  industry: TechId;
  actions: DiscoveryClassicNexusEffectStep[];
  staging: string[];
};
export type DiscoveryClassicNexusNestedBattle = {
  beforeBattle: Game;
  game: Game;
  actor: string;
  opponent: string;
  weapon: Card;
  losingLeader: string;
  plans: DiscoveryClassicNexusEffectStep[];
};
const clean = (game: Game) => !game.phaseOpening && !game.response && !game.decision && !game.truthtrance;
export function discoveryClassicNexusEffectsPlayer(game: Game, id: string): Player {
  const player = game.players.find(player => player.id === id);
  assert.ok(player, `Missing original authenticated seat ${id}`);
  return player;
}
/** Labelled scalar lottery: native UUID byte-array generation is not replaced. */
function originalLottery<T>(run: () => T, scalar = 0xffffffff): T {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const native = crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array && array.length === 1) array[0] = scalar;
    else Reflect.apply(native, crypto, [array]);
    return array;
  };
  try { return run(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}
export function nextDiscoveryClassicNexusEffectsStep(game: Game): DiscoveryClassicNexusEffectStep | null {
  if (!game.phaseOpening && !game.response) {
    const decision = game.decision;
    if (decision?.kind === 'discoveryEntry' || decision?.kind === 'greatMakerRide' || decision?.kind === 'nexusFremenCunningOffer' || decision?.kind === 'nexusFremenCunningRide')
      return { actor: decision.player, action: { type: 'decision', event: decision.event, accept: false } };
    if (decision?.kind === 'greatMakerVote')
      return { actor: decision.player, action: { type: 'decision', event: decision.event, yes: false } };
    if (decision?.kind === 'wormRide') return { actor: decision.player, action: { type: 'decision', accept: false } };
    if (decision?.kind === 'wormProtection') return { actor: decision.player, action: { type: 'decision', accept: true } };
  }
  return nextNexusSkillsModulesPaymentsNativeStep(game);
}
export function advanceDiscoveryClassicNexusEffectsStep(game: Game, actions?: DiscoveryClassicNexusEffectStep[]): Game {
  const next = nextDiscoveryClassicNexusEffectsStep(game);
  assert.ok(next, 'Original continuation stopped for a human private battle plan');
  actions?.push(structuredClone(next));
  return applyAction(game, next.actor, next.action);
}
export function advanceDiscoveryClassicNexusEffects(state: Game, predicate: (game: Game) => boolean,
  actions?: DiscoveryClassicNexusEffectStep[]): Game {
  let game = state;
  for (let n = 0; n < 1800; n++) {
    if (predicate(game)) return game;
    assert.notEqual(game.status, 'finished');
    game = advanceDiscoveryClassicNexusEffectsStep(game, actions);
  }
  throw Error('Original Discovery/Nexus continuation did not reach its boundary');
}
export function advanceDiscoveryClassicNexusEffectsToPhase(state: Game, phase: number,
  actions?: DiscoveryClassicNexusEffectStep[]): Game {
  const turn = state.turn;
  return advanceDiscoveryClassicNexusEffects(state, game => {
    assert.equal(game.turn, turn);
    return game.phase >= phase && clean(game);
  }, actions);
}
export function discoveryClassicNexusEffectsInventory(game: Game): void {
  nexusInventory(game);
  validateDiscoveryState(game.discoveries!);
  assert.deepEqual([...(game.traitorReserve ?? []), ...game.players.flatMap(player =>
    [...player.traitors, ...player.traitorChoices])].sort(), traitorDeck(game.players, false).sort());
  for (const player of game.players) if (player.elites) {
    assert.equal(player.elites.reserves + player.elites.tanks + Object.values(player.elites.forces).reduce((a, b) => a + b, 0),
      player.faction === 'fremen' ? 3 : 5);
    assert.ok(player.elites.reserves <= player.reserves && player.elites.tanks <= player.tanks);
    for (const [key, amount] of Object.entries(player.elites.forces)) assert.ok(amount <= (player.forces[key] ?? 0));
  }
}
export function initializeDiscoveryClassicNexusEffectsSetup(options: DiscoveryClassicNexusEffectsOptions = {}): Game {
  const kind = options.kind ?? 'emperor-revival', faction = options.ownerFaction ?? 'atreides';
  const forbidden = kind === 'guild-shipment' ? 'guild' : kind === 'fremen-revival' ? 'fremen' : 'emperor';
  let game = options.initial ? structuredClone(options.initial)
    : createGame('DISCOVERYCLASSICNEXUSEFFECTS', newPlayer(options.seatIds?.[0] ?? 'owner', faction, faction),
      options.advanced ?? !!options.strongholds);
  if (!options.initial) {
    const count = options.seatIds?.length ?? 3;
    assert.ok(count >= 3 && count <= 5);
    for (const candidate of ['harkonnen', 'guild', 'fremen', 'atreides', 'beneGesserit', 'emperor'] as const)
      if (game.players.length < count && candidate !== forbidden && candidate !== faction)
        joinGame(game, newPlayer(options.seatIds?.[game.players.length] ?? candidate, candidate, candidate));
    assert.equal(game.players.length, count);
  }
  assert.ok(game.players.some(player => player.faction === faction));
  assert.ok(!game.players.some(player => player.faction === forbidden));
  if (options.advanced !== undefined) assert.equal(game.advanced, options.advanced);
  const tech = options.tech ?? !!game.techTokens, strongholds = options.strongholds ?? !!game.strongholdCards;
  if (game.status === 'setup') {
    assert.equal(game.turn, 1); assert.equal(game.phase, 0);
    assert.equal(!!game.techTokens, tech); assert.equal(!!game.strongholdCards, strongholds);
    assert.ok(classicDiscoveryNexusProfile(game));
    discoveryClassicNexusEffectsInventory(game);
    return game;
  }
  assert.equal(game.status, 'lobby');
  if (tech && !game.techTokens) game = applyAction(game, game.host, { type: 'techTokens', enabled: true });
  if (strongholds && !game.strongholdCards) game = applyAction(game, game.host, { type: 'strongholdCards', enabled: true });
  assert.equal(!!game.techTokens, tech); assert.equal(!!game.strongholdCards, strongholds);
  game.discoveryEnabled = true;
  game.nexusCards ??= { cards: null, phase: null };
  assert.ok(classicDiscoveryNexusProfile(game));
  for (const player of game.players) if (!player.ready) game = applyAction(game, player.id, { type: 'ready' });
  return originalLottery(() => initializeNexusGameForAudit(game));
}
function reserveBoard(game: Game, staging: string[]): void {
  for (const player of game.players) {
    player.reserves += Object.values(player.forces).reduce((a, b) => a + b, 0); player.forces = {};
    if (player.elites) {
      player.elites.reserves += Object.values(player.elites.forces).reduce((a, b) => a + b, 0); player.elites.forces = {};
    }
    if (player.advisors) player.advisors = {};
  }
  staging.push('Conserved all original on-board counters into their own reserves; no clock, wallet, receipt or module ownership assigned.');
}
function placeOrdinary(game: Game, actor: string, key: string, amount: number, staging: string[]): void {
  const player = discoveryClassicNexusEffectsPlayer(game, actor);
  assert.ok(player.reserves - (player.elites?.reserves ?? 0) >= amount);
  player.reserves -= amount; player.forces[key] = (player.forces[key] ?? 0) + amount;
  staging.push(`Conserved ${amount} original ordinary ${actor} reserve counters to ${key}.`);
}
function orderSpice(game: Game, selectors: ('discovery' | 'land' | 'worm')[], staging: string[]): void {
  const front: Game['spiceDeck'] = [];
  for (const selector of selectors) {
    const index = game.spiceDeck.findIndex(card => selector === 'worm' ? 'worm' in card
      : 'territory' in card && (selector === 'discovery' ? card.discovery === 'discovery-hagga-basin'
        : !card.discovery && card.territory !== 'gara_kulon'));
    assert.ok(index >= 0, 'Only original undealt physical Spice singletons may be selected');
    front.push(game.spiceDeck.splice(index, 1)[0]);
  }
  game.spiceDeck.unshift(...front);
  staging.push(`Ordered conserved original undealt Spice Cards: ${selectors.join(', ')}; original discard untouched.`);
}
/** Original setup, actual printed Discovery blow/lottery, Collection reveal,
 * next-turn entry and end-Spice-Blow Nexus/alliance draw all precede the effect. */
export function createDiscoveryClassicNexusEffectsFixture(options: DiscoveryClassicNexusEffectsOptions = {}): DiscoveryClassicNexusEffectsFixture {
  const initial = initializeDiscoveryClassicNexusEffectsSetup(options);
  return originalLottery(() => {
    const kind = options.kind ?? 'emperor-revival', actor = initial.players.find(player => player.faction === (options.ownerFaction ?? 'atreides'))!.id;
    const opponent = initial.players.find(player => player.id !== actor && player.faction !== 'beneGesserit')!.id;
    const actions: DiscoveryClassicNexusEffectStep[] = [], staging = ['Scalar lottery fixed at the last legal index; UUID bytes remain native. Physical Hiereg lottery selects the original Shrine token; not an untouched random sample.'];
    let game = advanceDiscoveryClassicNexusEffects(initial, game => game.status === 'playing', actions);
    const afterSetup = structuredClone(game);
    reserveBoard(game, staging);
    // The actual first Storm producers assign original Tech owners.
    game = advanceDiscoveryClassicNexusEffectsToPhase(game, 1, actions);
    orderSpice(game, ['discovery', 'land'], staging);
    const pool = game.discoveries!.tokens.filter(token => token.type === 'hiereg' && token.status === 'supply');
    const lotteryIndex = pool.findIndex(token => token.face === 'shrine'); assert.ok(lotteryIndex >= 0);
    staging.push(`Actual printed Discovery blow lottery selects index ${lotteryIndex} of ${pool.length} original supply Hiereg tokens; original token IDs/order remain unchanged.`);
    game = originalLottery(() => advanceDiscoveryClassicNexusEffects(game,
      state => state.discoveries!.tokens.some(token => token.face === 'shrine' && token.status === 'placed'), actions),
    Math.floor((lotteryIndex + 0.5) * 0x100000000 / pool.length));
    game = advanceDiscoveryClassicNexusEffectsToPhase(game, 5, actions);
    const shrine = game.discoveries!.tokens.find(token => token.face === 'shrine')!;
    assert.equal(shrine.status, 'placed');
    assert.equal(shrine.revealedTurn, null);
    const source = `${shrine.territory}:${shrine.sector}`, revealer = kind === 'guild-shipment' ? opponent : actor;
    assert.notEqual(shrine.sector, game.storm);
    placeOrdinary(game, revealer, source, 2, staging);
    if (game.strongholdCards) placeOrdinary(game, actor, 'arrakeen:10', 1, staging);
    game = advanceDiscoveryClassicNexusEffectsToPhase(game, 7, actions);
    if (viewGame(game, revealer).discoveries!.canInspect.includes(shrine.id)) {
      const action: Action = { type: 'discovery', token: shrine.id, reveal: false };
      actions.push({ actor: revealer, action }); game = applyAction(game, revealer, action);
    }
    const beforeReveal = structuredClone(game), reveal: Action = { type: 'discovery', token: shrine.id, reveal: true };
    assert.ok(viewGame(game, revealer).discoveries!.canReveal.includes(shrine.id));
    actions.push({ actor: revealer, action: reveal }); game = applyAction(game, revealer, reveal);
    const afterReveal = structuredClone(game);
    game = advanceDiscoveryClassicNexusEffects(game, game => game.decision?.kind === 'discoveryEntry', actions);
    assert.ok(game.decision?.kind === 'discoveryEntry');
    assert.equal(game.turn, 2); assert.equal(game.decision!.player, revealer);
    const beforeEntry = structuredClone(game), entry: Action = { type: 'decision', event: game.decision!.event,
      accept: true, groups: viewGame(game, revealer).discoveryEntry!.sources };
    actions.push({ actor: revealer, action: entry }); game = applyAction(game, revealer, entry);
    const afterEntry = structuredClone(game);
    assert.equal(discoveryClassicNexusEffectsPlayer(game, revealer).forces['shrine:0'], 2);
    game = advanceDiscoveryClassicNexusEffectsToPhase(game, 1, actions);
    orderSpice(game, ['worm', 'land', 'land'], staging);
    let allied = false;
    for (let n = 0; game.nexusCards?.phase?.stage !== 'drawing' && n < 240; n++) {
      if (game.nexus && !game.spiceWindow && !game.spiceResolution && clean(game) && !allied) {
        const others = game.players.filter(player => player.id !== actor);
        for (const [from, to] of [[others[0].id, others[1].id], [others[1].id, others[0].id]]) {
          const action: Action = { type: 'alliance', target: to };
          actions.push({ actor: from, action }); game = applyAction(game, from, action);
        }
        allied = true;
      }
      game = advanceDiscoveryClassicNexusEffectsStep(game, actions);
    }
    assert.ok(allied); assert.equal(game.nexusCards?.phase?.stage, 'drawing');
    const selected = kind === 'guild-shipment' ? 'guild' : kind === 'fremen-revival' ? 'fremen' : 'emperor';
    const cards = game.nexusCards!.cards!, index = cards.deck.indexOf(selected); assert.ok(index >= 0);
    cards.deck.unshift(cards.deck.splice(index, 1)[0]);
    staging.push(`Ordered the original undealt ${selected} Nexus singleton before its actual end-Spice-Blow draw.`);
    const beforeClosingDraw = structuredClone(game), closingDraw: DiscoveryClassicNexusEffectStep = { actor,
      action: { type: 'nexusCardChoice', turn: game.turn, card: cards.hands[actor], choice: 'draw', ownRedraws: 0 } };
    actions.push(closingDraw); game = applyAction(game, actor, closingDraw.action);
    const afterClosingDraw = structuredClone(game);
    assert.equal(game.nexusCards!.cards!.hands[actor], selected);
    game = advanceDiscoveryClassicNexusEffects(game, game => game.nexusCards?.phase?.stage !== 'drawing', actions);
    game = advanceDiscoveryClassicNexusEffectsToPhase(game, kind === 'guild-shipment' ? 5 : 4, actions);
    let paymentAction: Action;
    if (kind === 'guild-shipment') {
      game = advanceDiscoveryClassicNexusEffects(game, game => game.active === actor && clean(game), actions);
      paymentAction = { type: 'ship', territory: 'shrine', sector: 0, amount: 3, elite: 0,
        nexus: viewGame(game, actor).nexusGuildSecretAlly!.event };
    } else {
      const player = discoveryClassicNexusEffectsPlayer(game, actor), tanks = options.tanks ?? 6, elite = options.eliteTanks ?? 0;
      assert.ok(Number.isInteger(tanks) && tanks >= 0 && Number.isInteger(elite) && elite >= 0 && elite <= tanks);
      assert.ok(tanks - elite <= player.reserves - (player.elites?.reserves ?? 0) && elite <= (player.elites?.reserves ?? 0));
      player.reserves -= tanks; player.tanks += tanks;
      if (player.elites) { player.elites.reserves -= elite; player.elites.tanks += elite; }
      staging.push(`Conserved ${tanks} original ${actor} reserve counters to Tanks, including ${elite} elites; no return or quota receipt assigned.`);
      const view = viewGame(game, actor);
      paymentAction = { type: kind === 'emperor-revival' ? 'nexusEmperorRevive' : 'nexusFremenRevive',
        event: kind === 'emperor-revival' ? view.nexusEmperorSecretAlly!.event : view.nexusFremenRevival!.event, elite: elite ? 1 : 0 };
    }
    discoveryClassicNexusEffectsInventory(game);
    const industry: TechId = kind === 'guild-shipment' ? 'heighliners' : 'axlotl', tokenOwner = game.techTokens?.[industry].owner ?? null;
    return { initial, afterSetup, beforeReveal, afterReveal, beforeEntry, afterEntry, beforeClosingDraw, closingDraw,
      afterClosingDraw, game, actor, opponent, kind, paymentAction, token: shrine.id, source, industry, tokenOwner,
      tokenCount: tokenOwner ? ownedTech(game.techTokens, tokenOwner).length : 0, actions, staging };
  });
}
export function payDiscoveryClassicNexusEffectsFixture(fixture: DiscoveryClassicNexusEffectsFixture, game = fixture.game): Game {
  return applyAction(game, fixture.actor, fixture.paymentAction);
}
export function finishDiscoveryClassicNexusEffectsInteraction(state: Game, actions?: DiscoveryClassicNexusEffectStep[]): Game {
  return advanceDiscoveryClassicNexusEffects(state, game => clean(game) && !game.pendingTreacheryDiscard && !game.pendingKarama, actions);
}
/** Paid nested arrival is retained, then the ordinary battle producer seals real
 * physical cards/plans. No battle result, ownership or reward is fabricated. */
export function openDiscoveryClassicNexusNestedBattle(fixture: DiscoveryClassicNexusEffectsFixture, state: Game): DiscoveryClassicNexusNestedBattle {
  assert.equal(fixture.kind, 'guild-shipment');
  let game = finishDiscoveryClassicNexusEffectsInteraction(state, fixture.actions);
  for (const player of game.players) { game.deck.push(...player.hand); player.hand = []; }
  fixture.staging.push('Conserved all original held Treachery Cards into the undealt deck before selecting the nested battle cards.');
  const weapon = holdNexusSkillsModulesPaymentsCard(game, fixture.actor, 'projectile', fixture.staging);
  const owner = discoveryClassicNexusEffectsPlayer(game, fixture.actor), opponent = discoveryClassicNexusEffectsPlayer(game, fixture.opponent);
  const leader = owner.leaders.filter(leader => !leader.dead && !leader.usedAt).sort((a, b) => b.strength - a.strength)[0];
  const losingLeader = opponent.leaders.filter(leader => !leader.dead && !leader.usedAt).sort((a, b) => a.strength - b.strength)[0];
  assert.ok(leader && losingLeader);
  game = advanceDiscoveryClassicNexusEffectsToPhase(game, 6, fixture.actions);
  assert.ok(game.active === owner.id || game.active === opponent.id);
  const beforeBattle = structuredClone(game), choose: Action = { type: 'chooseBattle', territory: 'shrine', target: game.active === owner.id ? opponent.id : owner.id };
  fixture.actions.push({ actor: game.active!, action: choose }); game = applyAction(game, game.active!, choose);
  game = advanceDiscoveryClassicNexusEffects(game, game => !!game.battle && clean(game) && !game.battle.preparation && game.battle.preLeader?.closed !== false, fixture.actions);
  const plans: DiscoveryClassicNexusEffectStep[] = [
    { actor: owner.id, action: { type: 'battlePlan', leader: leader.id, dial: 0, support: 0, weapon: weapon.id } },
    { actor: opponent.id, action: { type: 'battlePlan', leader: losingLeader.id, dial: 0, support: 0 } },
  ];
  return { beforeBattle, game, actor: owner.id, opponent: opponent.id, weapon, losingLeader: losingLeader.id, plans };
}
export function finishDiscoveryClassicNexusNestedBattle(battle: DiscoveryClassicNexusNestedBattle): Game {
  let game = battle.game;
  for (const step of battle.plans) game = applyAction(game, step.actor, step.action);
  return advanceDiscoveryClassicNexusEffects(game, game => !game.battle && clean(game) && !game.pendingTreacheryDiscard);
}
