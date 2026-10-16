import assert from 'node:assert/strict';
import {
  applyAction, viewGame, type Action, type Game, type Player,
} from '../game/engine';
import type { FactionId } from '../game/catalog';
import { ownedTech } from '../game/tech-tokens';
import { RECRUITS_CARD_ID } from '../game/recruits';
import type { Card } from '../game/cards';
import {
  advanceIndependentCardModules, createIndependentCardModulesFixture,
  nextIndependentCardModulesStep, type IndependentCardModulesStep,
} from './fixture-independent-card-modules';

export type RecruitsModulesStep = IndependentCardModulesStep;
export type RecruitsModulesRoster = 'classic' | 'ix-native';
export type RecruitsModulesOptions = {
  /** Original Advanced rules; the independent profile still refuses other overlays. */
  advanced?: boolean;
  /** Original Advanced Stronghold Cards; requires Advanced. */
  strongholds?: boolean;
  /** Clean classic roster, or the native Ixian three-seat pool with its own token. */
  roster?: RecruitsModulesRoster;
};
export type RecruitsModulesFixture = {
  initial: Game;
  afterSetup: Game;
  afterBattle: Game;
  /** Quiet turn-two Revival before any Recruits activation, with the card held. */
  game: Game;
  /** After the actual Recruits activation and before any revival. */
  beforeRevival: Game;
  /** After the holder's real revival; Axlotl income is accrued but unpaid. */
  afterRevival: Game;
  /** After the opponent's real revival in the same phase; income must not repeat. */
  afterSecondRevival: Game;
  /** Turn-two Shipment after the original Revival phase settled its tokens. */
  afterPhaseEnd: Game;
  /** Actual Axlotl custodian chosen by the original first Storm. */
  owner: string;
  opponent: string;
  location: { territory: string; sector: number };
  /** Ordinary rate/limit before the activation, measured on the real clone. */
  base: { freeRate: number; limit: number };
  /** Rate/limit the actual activation produced. */
  doubled: { freeRate: number; limit: number };
  tanks: { reviver: number; opponent: number };
  amount: number;
  /** Tokens the custodian actually owns when the free revival accrues income. */
  accrual: number;
  playAction: Action;
  revivalAction: Action;
  secondRevivalAction: Action;
  battle: {
    attacker: string; defender: string; territory: string;
    reviverPlan: RecruitsModulesStep; opponentPlan: RecruitsModulesStep;
  };
  steps: RecruitsModulesStep[];
  staging: string[];
};

const CLASSIC_ROSTER: FactionId[] = ['emperor', 'atreides', 'guild'];
const IX_NATIVE_ROSTER: FactionId[] = ['ixians', 'atreides', 'guild'];
/** The printed native stronghold positions that start occupied on the board. */
const NATIVE_STRONGHOLD: Readonly<Record<string, { territory: string; sector: number }>> = {
  atreides: { territory: 'arrakeen', sector: 10 },
  guild: { territory: 'tueks_sietch', sector: 5 },
};

export const recruitsModulesPlayer = (game: Game, id: string): Player => {
  const player = game.players.find(candidate => candidate.id === id);
  assert.ok(player, `Missing original ${id} seat`);
  return player;
};
export const recruitsModulesClean = (game: Game): boolean =>
  !game.phaseOpening && !game.response && !game.decision && !game.pendingRevival;
const boardCount = (player: Player): number =>
  Object.values(player.forces).reduce((sum, n) => sum + n, 0);
const eliteCount = (player: Player): number =>
  player.elites
    ? player.elites.reserves + player.elites.tanks +
      Object.values(player.elites.forces).reduce((sum, n) => sum + n, 0)
    : 0;

/** Reuse the shared original native continuation unchanged. */
export function advanceRecruitsModules(
  game: Game, until: (state: Game) => boolean, steps: RecruitsModulesStep[] = [],
): Game {
  return advanceIndependentCardModules(game, until, steps);
}

/** Physically conserve one existing face between original zones; no minted copy. */
function conserveCard(game: Game, actor: string, id: string, staging: string[]): Card {
  const player = recruitsModulesPlayer(game, actor);
  if (player.hand.some(card => card.id === id)) return player.hand.find(card => card.id === id)!;
  const zones: { label: string; cards: Card[] }[] = [
    { label: 'remaining original deck', cards: game.deck },
    { label: 'original discard', cards: game.discard },
    ...game.players.filter(other => other.id !== actor)
      .map(other => ({ label: `${other.id}'s hand`, cards: other.hand })),
  ];
  const source = zones.find(zone => zone.cards.some(card => card.id === id));
  assert.ok(source, `Original physical ${id} is missing from every retained zone`);
  const limit = player.faction === 'harkonnen' ? 8 : player.faction === 'choam' ? 5 : 4;
  if (player.hand.length >= limit) {
    const index = player.hand.findIndex(card => card.id !== id);
    assert.ok(index >= 0, `${actor} must have a non-Recruits card to return`);
    const [returned] = player.hand.splice(index, 1);
    game.deck.push(returned);
    staging.push(`Physical staging: ${returned.id}, ${actor}'s hand → remaining original deck (printed hand limit).`);
  }
  const [card] = source.cards.splice(source.cards.findIndex(candidate => candidate.id === id), 1);
  player.hand.push(card);
  staging.push(`Physical staging: conserved ${id}, ${source.label} → ${actor}'s hand; no purchase, deal or replacement face.`);
  return card;
}

/** Original counters, tokens and Treachery faces stay conserved against the baseline. */
export function assertRecruitsModulesInventory(game: Game, baseline: Game): void {
  for (const expected of baseline.players) {
    const player = recruitsModulesPlayer(game, expected.id);
    assert.equal(player.reserves + player.tanks + boardCount(player),
      expected.reserves + expected.tanks + boardCount(expected),
      `${player.id} must retain its physical normal counters`);
    assert.equal(eliteCount(player), eliteCount(expected),
      `${player.id} must retain its physical special counters`);
  }
  const physical = (state: Game) => allCardZones(state).map(card => card.id).sort();
  assert.deepEqual(physical(game), physical(baseline),
    'Every original Treachery face must retain exactly its one physical zone');
  assert.equal(allCardZones(game).filter(card => card.id === RECRUITS_CARD_ID).length, 1,
    'The independent Recruits face must stay a single physical card');
  for (const [id, token] of Object.entries(game.techTokens ?? {}))
    assert.ok(token.owner === null || game.players.some(player => player.id === token.owner),
      `${id} must keep seated token custody`);
}
/** Every original Treachery face that is still held: hands, deck, discard and unsold auction. */
function allCardZones(state: Game): Card[] {
  return [
    ...state.deck,
    ...state.discard,
    ...state.players.flatMap(player => player.hand),
    ...(state.auction?.cards.slice(state.auction.index) ?? []),
  ];
}

/**
 * Genuine independent Recruits + original Tech programme. The original first
 * Storm decides Axlotl custody; that custodian commits real counters in a won
 * battle during the same turn, putting its actual dialed casualties in the
 * Tanks. Next turn's real Revival plays the physical Recruits and returns them.
 * Advanced Strongholds and the native Ixian pool are selected through the
 * shared setup factory; no wallet, owner, phase, receipt or history is assigned.
 */
export function createRecruitsModulesFixture(
  options: RecruitsModulesOptions = {},
): RecruitsModulesFixture {
  const roster = options.roster ?? 'classic';
  const advanced = options.advanced ?? false;
  const strongholds = options.strongholds ?? false;
  assert.ok(!strongholds || advanced, 'Original Stronghold Cards require Advanced');
  const source = createIndependentCardModulesFixture({
    advanced, strongholds, tech: true,
    factions: roster === 'classic' ? [...CLASSIC_ROSTER] : [...IX_NATIVE_ROSTER],
    expansions: roster === 'classic' ? [] : ['ix'],
  });
  const steps: RecruitsModulesStep[] = source.steps;
  const staging: string[] = [];
  const initial = source.initial;
  const afterSetup = structuredClone(source.game);
  let game = source.game;
  const act = (actor: string, action: Action) => {
    steps.push({ actor, action: structuredClone(action) });
    game = applyAction(game, actor, action);
  };
  const advance = (until: (state: Game) => boolean) => {
    for (let count = 0; count < 1800; count++) {
      if (until(game)) return;
      assert.notEqual(game.status, 'finished', 'The original programme ended before its requested boundary');
      const step = nextIndependentCardModulesStep(game);
      assert.ok(step, 'The fixture must supply the actual human Battle Plans before continuing');
      act(step.actor, step.action);
    }
    throw Error('The original independent-card programme did not reach its requested boundary');
  };
  // Fix only original first-Storm randomness; the engine still assigns custody.
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  crypto.getRandomValues = <T extends ArrayBufferView | null>(array: T): T => {
    assert.ok(array);
    new Uint8Array(array.buffer, array.byteOffset, array.byteLength).fill(255);
    return array;
  };
  try { advance(state => state.turn === 1 && state.phase === 1 && recruitsModulesClean(state)); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
  const owner = game.techTokens?.axlotl.owner;
  assert.ok(owner, 'The original first Storm must decide Axlotl custody');
  conserveCard(game, owner, RECRUITS_CARD_ID, staging);
  staging.push(`Conserved the physical Recruits after setup: ${owner} is the actual Axlotl custodian the original first Storm selected.`);
  const reviver = recruitsModulesPlayer(game, owner);
  const others = game.players.filter(player => player.id !== owner).map(player => player.id);
  const ownStronghold = NATIVE_STRONGHOLD[reviver.faction];
  // Only real board positions with at least four printed counters can absorb the
  // winner's dialed losses; everyone else must ship an attacking force instead.
  const defends = !!ownStronghold && boardCount(reviver) >= 4;
  const target = defends
    ? reviver.faction
    : (others.some(id => NATIVE_STRONGHOLD[recruitsModulesPlayer(game, id).faction]?.territory === 'tueks_sietch')
      ? 'guild' : 'atreides');
  const opponent = defends
    ? (roster === 'ix-native'
      ? others.find(id => recruitsModulesPlayer(game, id).faction === 'ixians')!
      : others.find(id => !!NATIVE_STRONGHOLD[recruitsModulesPlayer(game, id).faction])!)
    : others.find(id => recruitsModulesPlayer(game, id).faction === target)!;
  const location = NATIVE_STRONGHOLD[target];
  assert.ok(location, 'The selected battle needs an original stronghold position');
  const base = viewGame(game, owner).revival;
  const baseFreeRate = base.freeRemaining;
  const baseLimit = base.limit;
  const doubledFreeRate = Math.min(baseFreeRate * 2, 7);
  const wallet = reviver.spice;
  let amount = 0;
  for (let candidate = Math.min(6, defends ? boardCount(reviver) : 6); candidate >= 4; candidate--) {
    const paid = Math.max(0, candidate - doubledFreeRate);
    // The attacker also pays the original one-spice stronghold transport per force.
    if (wallet >= (defends ? 0 : candidate) + 2 * paid + 1) { amount = candidate; break; }
  }
  assert.ok(amount >= 4,
    `The actual ${owner} wallet and board must support a four-force revival beyond the ordinary limit`);
  const aggressor = defends ? opponent : owner;
  advance(state => state.turn === 1 && state.phase === 5 && state.active === aggressor && recruitsModulesClean(state));
  act(aggressor, {
    type: 'ship', territory: location.territory, sector: location.sector,
    amount: defends ? 1 : amount, elite: 0,
  });
  advance(state => state.phase === 6 && recruitsModulesClean(state));
  const choice = viewGame(game, aggressor).battleChoices
    .find(candidate => candidate.territory === location.territory);
  assert.ok(choice, 'The actual shipment must open a real battle in that stronghold');
  assert.deepEqual([choice.attacker, choice.defender].sort(), [owner, opponent].sort(),
    'Only the actual Axlotl custodian and its chosen opponent may be in this battle');
  act(choice.chooser, { type: 'chooseBattle', territory: location.territory,
    target: choice.attacker === choice.chooser ? choice.defender : choice.attacker });
  advance(state => !!state.battle && !state.battle.revealed && !state.battle.preparation &&
    (!state.battle.preLeader || state.battle.preLeader.closed) && recruitsModulesClean(state));
  const available = (id: string) => recruitsModulesPlayer(game, id).leaders
    .filter(leader => !leader.dead && (!leader.usedAt || leader.usedAt === location.territory));
  const strongest = available(owner).sort((a, b) => b.strength - a.strength || a.id.localeCompare(b.id))[0];
  const weakest = available(opponent).sort((a, b) => a.strength - b.strength || a.id.localeCompare(b.id))[0];
  assert.ok(strongest && weakest, 'Both real combatants need an available leader');
  // Typed original pools count the dial in half-strength steps; the winner's
  // losses still equal the committed physical counters it actually dialed.
  const typedDial = advanced || reviver.faction === 'ixians' ? amount / 2 : amount;
  const reviverPlan: RecruitsModulesStep = { actor: owner,
    action: { type: 'battlePlan', dial: typedDial, support: 0, leader: strongest.id } };
  const opponentPlan: RecruitsModulesStep = { actor: opponent,
    action: { type: 'battlePlan', dial: 0, support: 0, leader: weakest.id } };
  act(reviverPlan.actor, reviverPlan.action);
  act(opponentPlan.actor, opponentPlan.action);
  advance(state => !state.battle && !state.decision && state.phase >= 7 && recruitsModulesClean(state));
  const afterBattle = structuredClone(game);
  const tanks = { reviver: recruitsModulesPlayer(game, owner).tanks,
    opponent: recruitsModulesPlayer(game, opponent).tanks };
  assert.equal(tanks.reviver, amount, 'The real battle must send exactly the committed counters to the Tanks');
  assert.ok(tanks.opponent >= 1, 'The actual losing force must reach the Tanks');
  // Next turn's real Revival phase; the original first-Storm and battle history
  // are untouched, so the token assignment the collision produced is real.
  advance(state => state.turn === 2 && state.phase === 4 && recruitsModulesClean(state));
  const gameAtRevival = structuredClone(game);
  const accrual = game.techTokens ? ownedTech(game.techTokens, owner).length : 0;
  assert.ok(accrual >= 1, 'The actual Axlotl custodian must own its physical tokens');
  const playAction: Action = { type: 'card', card: RECRUITS_CARD_ID };
  act(owner, playAction);
  const beforeRevival = structuredClone(game);
  assert.equal(beforeRevival.recruits?.player, owner, 'The physical Recruits activation must be recorded');
  const revivalAction: Action = { type: 'revive', amount, elite: 0 };
  act(owner, revivalAction);
  const afterRevival = structuredClone(game);
  const secondRevivalAction: Action = { type: 'revive', amount: 1, elite: 0 };
  act(opponent, secondRevivalAction);
  const afterSecondRevival = structuredClone(game);
  assert.equal(game.techTokens?.axlotl.spice, accrual,
    'The accrued income must still be held by the token immediately before the phase ends');
  advance(state => state.phase === 5 && recruitsModulesClean(state));
  const afterPhaseEnd = structuredClone(game);
  assertRecruitsModulesInventory(gameAtRevival, afterSetup);
  assertRecruitsModulesInventory(afterBattle, afterSetup);
  assertRecruitsModulesInventory(afterRevival, afterSetup);
  assertRecruitsModulesInventory(afterSecondRevival, afterSetup);
  assertRecruitsModulesInventory(afterPhaseEnd, afterSetup);
  return {
    initial, afterSetup, afterBattle, game: gameAtRevival, beforeRevival, afterRevival,
    afterSecondRevival, afterPhaseEnd, owner, opponent, location,
    base: { freeRate: baseFreeRate, limit: baseLimit },
    doubled: { freeRate: doubledFreeRate, limit: 7 },
    tanks, amount, accrual, playAction, revivalAction, secondRevivalAction,
    battle: {
      attacker: choice.attacker, defender: choice.defender,
      territory: location.territory, reviverPlan, opponentPlan,
    },
    steps, staging,
  };
}
