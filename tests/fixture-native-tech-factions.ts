import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeFactionExpansionsGameForAudit,
  initializeStrongholdFactionsGameForAudit, joinGame, newPlayer, type Game,
} from '../game/engine';
import { MOBILE_LOCATION, territory } from '../game/board';
import type { Card } from '../game/cards';
import type { FactionId } from '../game/catalog';
import { nativeFactionTechProfile } from '../game/faction-module-profile';
import { createTechTokens } from '../game/tech-tokens';
import type { StrongholdFactionsNativeStep } from './fixture-stronghold-factions';
import { nextRicheseStrongholdsNativeStep } from './fixture-richese-strongholds';

export type NativeTechFamily = 'ix-choam' | 'richese' | 'tleilaxu';
export type NativeTechFactionsOptions = {
  initial?: Game;
  family?: NativeTechFamily;
  strongholds?: boolean;
  advanced?: boolean;
  ownerFaction?: 'ixians' | 'choam';
  stone?: boolean;
};
export type NativeTechFactionsFixture = {
  initial: Game;
  afterSetup: Game;
  beforeFirstMentat?: Game;
  firstMentatStep?: StrongholdFactionsNativeStep;
  afterFirstMentat?: Game;
  beforeShipment?: Game;
  shipmentStep?: StrongholdFactionsNativeStep;
  afterShipment?: Game;
  acquisition?: { before: Game; after: Game; steps: StrongholdFactionsNativeStep[] };
  game: Game;
  beforeBattle: Game;
  battleStep: StrongholdFactionsNativeStep;
  planActions: StrongholdFactionsNativeStep[];
  owner: string;
  opponent: string;
  family: NativeTechFamily;
  kind: 'arrakeen' | 'sietch_tabr' | 'habbanya_ridge_sietch';
  location: string;
  actions: StrongholdFactionsNativeStep[];
  staging: string[];
};
export const nativeTechFactionsPlayer = (game: Game, actor: string) => {
  const player = game.players.find(p => p.id === actor);
  assert.ok(player, `Missing native Tech seat ${actor}`);
  return player;
};
const clean = (game: Game) => !game.phaseOpening && !game.response && !game.decision;

export function nextNativeTechFactionsStep(game: Game): StrongholdFactionsNativeStep | null {
  if (!game.phaseOpening && !game.response && game.decision?.kind === 'techToken')
    return { actor: game.decision.player, action: { type: 'decision', token: game.decision.choices[0] } };
  return nextRicheseStrongholdsNativeStep(game);
}
function run(game: Game, step: StrongholdFactionsNativeStep, actions: StrongholdFactionsNativeStep[]): Game {
  actions.push(structuredClone(step));
  return applyAction(game, step.actor, step.action);
}
function advance(game: Game, until: (state: Game) => boolean, actions: StrongholdFactionsNativeStep[]): Game {
  for (let n = 0; n < 1800; n++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const step = nextNativeTechFactionsStep(game);
    assert.ok(step, 'The original battle requires an unsealed human plan');
    // Real first-turn dials leave every printed fixture site outside the next Storm band.
    if (game.turn === 1 && step.action.type === 'stormDial') step.action.amount = 0;
    game = run(game, step, actions);
  }
  throw Error('Native Tech continuation did not reach its requested boundary');
}
function withSetupEntropy<T>(action: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    assert.ok(array);
    new Uint8Array(array.buffer, array.byteOffset, array.byteLength).fill(255);
    return array;
  };
  try { return action(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}

/** Original fresh native setup; no Leader Skills, public-start bypass or redeal.
 * Default initializer entropy is deterministic; supplied undealt setup is continued
 * as saved. Actual wallets and Tech assignments are never staged or repaired. */
export function initializeNativeTechFactionsSetup(options: NativeTechFactionsOptions = {}): Game {
  const family = options.family ?? 'ix-choam';
  const factions: FactionId[] = family === 'ix-choam' ? ['ixians', 'choam', 'guild']
    : family === 'richese' ? ['richese', 'choam', 'guild'] : ['ixians', 'tleilaxu', 'guild'];
  const decks = family === 'ix-choam' ? ['ix', 'choam'] : family === 'richese' ? ['choam'] : ['ix'];
  const strongholds = options.strongholds ?? true;
  let game = options.initial ? structuredClone(options.initial)
    : createGame('NATIVETECHFACTIONS', newPlayer(factions[0], factions[0], factions[0]), options.advanced ?? true, decks);
  if (!options.initial) for (const faction of factions.slice(1)) joinGame(game, newPlayer(faction, faction, faction));
  assert.deepEqual(game.players.map(p => p.faction).sort(), [...factions].sort());
  assert.deepEqual([...game.expansions].sort(), [...decks].sort());
  assert.ok(game.status === 'lobby' || game.status === 'setup' && game.turn === 1 && game.phase === 0 && game.players.every(p => !p.hand.length), 'Use the original fresh undealt native lobby or setup');
  if (options.advanced !== undefined) assert.equal(game.advanced, options.advanced);
  if (strongholds) assert.equal(game.advanced, true);
  if (game.status === 'setup') {
    assert.ok(nativeFactionTechProfile(game), 'Continue only the bounded original native Tech setup without unrelated overlays');
    assert.equal(!!game.strongholdCards, strongholds);
    return game;
  }
  if (!game.techTokens) game = applyAction(game, game.host, { type: 'techTokens', enabled: true });
  assert.deepEqual(game.techTokens, createTechTokens());
  for (const player of game.players) if (!player.ready) game = applyAction(game, player.id, { type: 'ready' });
  const initialize = () => strongholds ? initializeStrongholdFactionsGameForAudit(game) : initializeFactionExpansionsGameForAudit(game);
  return options.initial ? initialize() : withSetupEntropy(initialize);
}
function reserveBoard(game: Game) {
  for (const player of game.players) {
    player.reserves += Object.values(player.forces).reduce((a, b) => a + b, 0);
    player.forces = {};
    if (player.elites) {
      player.elites.reserves += Object.values(player.elites.forces).reduce((a, b) => a + b, 0);
      player.elites.forces = {};
    }
  }
}
function place(game: Game, actor: string, key: string, count: number, elite = 0) {
  const player = nativeTechFactionsPlayer(game, actor);
  assert.ok(player.reserves >= count && (player.elites?.reserves ?? 0) >= elite && count >= elite);
  player.reserves -= count; player.forces[key] = (player.forces[key] ?? 0) + count;
  if (elite) { player.elites!.reserves -= elite; player.elites!.forces[key] = (player.elites!.forces[key] ?? 0) + elite; }
}
function heldCard(game: Game, actor: string, kind: Card['kind'], staging: string[]) {
  const player = nativeTechFactionsPlayer(game, actor), held = player.hand.find(c => c.kind === kind);
  if (held) return held.id;
  const index = game.deck.findIndex(c => c.kind === kind); assert.ok(index >= 0);
  assert.ok(player.hand.length < (player.faction === 'choam' ? 5 : 4));
  const card = game.deck.splice(index, 1)[0]; player.hand.push(card);
  staging.push(`Conserved ${card.id}: remaining native deck → ${actor}'s hand`);
  return card.id;
}

/** Controlled positions conserve native physical counters/cards after genuine
 * setup. Real ship, cache acquisition, final Mentat, plans, payments and aftermath
 * remain applyAction decisions. No wallet, owner, phase or earned receipt assignment. */
export function createNativeTechFactionsFixture(options: NativeTechFactionsOptions = {}): NativeTechFactionsFixture {
  const family = options.family ?? 'ix-choam', strongholds = options.strongholds ?? true;
  const actions: StrongholdFactionsNativeStep[] = [], staging: string[] = [];
  let game = initializeNativeTechFactionsSetup(options);
  const initial = structuredClone(game);
  for (let n = 0; game.status === 'setup' && n < 200; n++) {
    const step = nextNativeTechFactionsStep(game); assert.ok(step);
    // Preserve the native Ix remainder shuffle. Seed only the actual first
    // Face Dancer draw, as in the existing Tleilaxu Stronghold fixture.
    if (family === 'tleilaxu' && game.decision?.kind === 'ixSetup') {
      const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
      const original = crypto.getRandomValues.bind(crypto);
      let remainderCalls = Math.max(0, game.ixSetupCards!.length - 2);
      let faceCalls = game.players.reduce((sum, p) => sum + p.leaders.length, 0) + 1 - new Set(game.players.flatMap(p => p.traitors)).size - 1;
      crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
        assert.ok(array);
        if (remainderCalls > 0) { remainderCalls--; Reflect.apply(original, crypto, [array]); return array; }
        if (faceCalls-- > 0) { new Uint8Array(array.buffer, array.byteOffset, array.byteLength).fill(255); return array; }
        Reflect.apply(original, crypto, [array]); return array;
      };
      try { game = run(game, step, actions); }
      finally {
        if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
        else Reflect.deleteProperty(crypto, 'getRandomValues');
      }
      staging.push('Scoped first-draw entropy: only original native Face Dancer Traitor Deck shuffle; preserve Ix remainder and restore immediately.');
    } else game = run(game, step, actions);
  }
  assert.equal(game.status, 'playing');
  const afterSetup = structuredClone(game);
  const owner = game.players.find(p => p.faction === (family === 'richese' ? 'richese' : family === 'tleilaxu' ? 'ixians' : options.ownerFaction ?? 'ixians'))!.id;
  const opponent = game.players.find(p => p.faction === 'guild')!.id;
  const kind = family === 'richese' ? 'habbanya_ridge_sietch' : family === 'tleilaxu' ? 'sietch_tabr' : 'arrakeen';
  const location = `${kind}:${territory(kind).sectors[0]}`;
  let acquisition: NativeTechFactionsFixture['acquisition'];
  if (family === 'richese') {
    game = advance(game, state => state.decision?.kind === 'richeseCache', actions);
    const before = structuredClone(game), steps: StrongholdFactionsNativeStep[] = [];
    while (!nativeTechFactionsPlayer(game, owner).hand.some(c => c.id === 'richese-stone-burner')) {
      const step = nextNativeTechFactionsStep(game); assert.ok(step);
      steps.push(structuredClone(step)); game = run(game, step, actions);
      assert.ok(steps.length < 100);
    }
    acquisition = { before, steps, after: structuredClone(game) };
  }
  game = advance(game, state => state.phase === 5 && clean(state) && (family !== 'richese' || state.active === owner), actions);
  reserveBoard(game);
  staging.push('After real setup: return existing board counters through their own subtype reserves; keep actual native bank balances and assigned Tech custody.');
  let beforeShipment: Game | undefined, shipmentStep: StrongholdFactionsNativeStep | undefined, afterShipment: Game | undefined;
  if (family === 'richese') {
    const token = nativeTechFactionsPlayer(game, owner).noField!.tokens.find(t => t.value === 5)!;
    beforeShipment = structuredClone(game);
    shipmentStep = { actor: owner, action: { type: 'ship', noField: token.id, event: nativeTechFactionsPlayer(game, owner).noFieldEvent, territory: kind, sector: territory(kind).sectors[0] } };
    game = run(game, shipmentStep, actions);
    game = advance(game, clean, actions); afterShipment = structuredClone(game);
  }
  let beforeFirstMentat: Game | undefined, firstMentatStep: StrongholdFactionsNativeStep | undefined, afterFirstMentat: Game | undefined;
  if (strongholds) {
    game = advance(game, state => state.phase === 8 && clean(state), actions);
    reserveBoard(game);
    if (family !== 'richese') place(game, owner, location, 1);
    const ix = game.players.find(p => p.faction === 'ixians');
    if (ix) place(game, ix.id, MOBILE_LOCATION, 6, 3);
    staging.push('Before actual first END Mentat: native owner controls its printed battle site (Richese by real marker); Ix retains six original HMS counters including three cyborgs. Nobody controls three Strongholds.');
    while (game.turn === 1) {
      const step = nextNativeTechFactionsStep(game); assert.ok(step);
      const before = structuredClone(game); game = run(game, step, actions);
      if (game.turn === 2) { beforeFirstMentat = before; firstMentatStep = step; }
    }
    afterFirstMentat = structuredClone(game);
    assert.equal(game.strongholdCards!.owners[kind], owner);
    game = advance(game, state => state.phase === 5 && clean(state), actions);
    reserveBoard(game);
  }
  if (family === 'richese' && options.stone) {
    const token = nativeTechFactionsPlayer(game, owner).noField!.deployed!.tokenId;
    game = run(game, { actor: owner, action: { type: 'revealNoField', event: nativeTechFactionsPlayer(game, owner).noFieldEvent, token } }, actions);
    reserveBoard(game);
  }
  if (family !== 'richese' || options.stone) place(game, owner, location, 6, nativeTechFactionsPlayer(game, owner).faction === 'ixians' ? 3 : 0);
  place(game, opponent, location, 6);
  if (family === 'tleilaxu') {
    const tleilaxu = game.players.find(p => p.faction === 'tleilaxu')!.id;
    place(game, tleilaxu, `arrakeen:${territory('arrakeen').sectors[0]}`, 3);
  }
  staging.push('Before genuine movement completion: conserved six opposing counters, six winner counters (Ix three suboids/three cyborgs) or actual Richese marker; Tleilaxu has three physical Arrakeen replacement sources. No money or ownership staging.');
  const player = nativeTechFactionsPlayer(game, owner);
  const leader = family === 'tleilaxu'
    ? player.leaders.filter(l => !l.dead && game.players.find(p => p.faction === 'tleilaxu')!.faceDancers!.some(c => c.leader === l.id && !c.revealed)).sort((a, b) => b.strength - a.strength)[0]
    : player.leaders.filter(l => l.strength > 0 && !l.dead).sort((a, b) => b.strength - a.strength)[0];
  assert.ok(leader, 'The original native draw must supply the winner leader');
  const enemyLeader = family === 'tleilaxu' || options.ownerFaction === 'choam'
    ? nativeTechFactionsPlayer(game, opponent).leaders.filter(l => !l.dead).sort((a, b) => a.strength - b.strength)[0]
    : nativeTechFactionsPlayer(game, opponent).leaders.find(l => l.strength === 5 && !l.dead);
  assert.ok(enemyLeader);
  const weapon = family === 'tleilaxu' ? heldCard(game, owner, 'projectile', staging) : options.stone ? 'richese-stone-burner' : null;
  const defense = family === 'tleilaxu' ? heldCard(game, owner, 'shield', staging) : null;
  game = advance(game, state => state.phase === 6 && clean(state), actions);
  const beforeBattle = structuredClone(game), actor = game.active!;
  assert.ok(actor === owner || actor === opponent);
  const battleStep: StrongholdFactionsNativeStep = { actor, action: { type: 'chooseBattle', territory: kind, target: actor === owner ? opponent : owner } };
  game = run(game, battleStep, actions);
  game = advance(game, state => !!state.battle && !state.battle.revealed && !nextNativeTechFactionsStep(state), actions);
  const ix = player.faction === 'ixians';
  const dial = family === 'tleilaxu' ? 2 : family === 'richese' ? options.stone ? 2 : 1 : ix ? game.advanced ? 6 : 4 : 3;
  const support = game.advanced ? family === 'tleilaxu' ? 1 : family === 'richese' ? dial : 3 : 0;
  const enemyDial = options.ownerFaction === 'choam' ? 2 : family === 'richese' ? options.stone ? 2 : 0 : 1.5;
  const planActions: StrongholdFactionsNativeStep[] = [
    { actor: owner, action: { type: 'battlePlan', dial, support, leader: leader.id, weapon, defense } },
    { actor: opponent, action: { type: 'battlePlan', dial: game.advanced ? enemyDial : 1, support: game.advanced ? enemyDial === 2 ? 2 : enemyDial ? 1 : 0 : 0, leader: enemyLeader.id, weapon: null, defense: null } },
  ];
  return { initial, afterSetup, beforeFirstMentat, firstMentatStep, afterFirstMentat, beforeShipment, shipmentStep, afterShipment, acquisition, game, beforeBattle, battleStep, planActions, owner, opponent, family, kind, location, actions, staging };
}
export function revealNativeTechFactionsBattle(fixture: Pick<NativeTechFactionsFixture, 'game' | 'planActions'>): Game {
  let game = structuredClone(fixture.game);
  for (const step of fixture.planActions) {
    game = applyAction(game, step.actor, step.action);
    while (game.response || game.decision?.kind === 'fullPlanOffer') {
      const next = nextNativeTechFactionsStep(game); assert.ok(next);
      game = applyAction(game, next.actor, next.action);
    }
  }
  assert.ok(game.battle?.revealed);
  return game;
}
export function advanceNativeTechFactions(state: Game, until: (game: Game) => boolean): Game {
  return advance(structuredClone(state), until, []);
}
export function finishNativeTechFactionsBattle(state: Game): Game {
  return advanceNativeTechFactions(state, game => !game.battle && !game.decision && !game.response && !game.pendingTreacheryDiscard);
}
export function finishNativeTechFactionsTurn(state: Game): Game {
  return advanceNativeTechFactions(state, game => game.turn > state.turn);
}
