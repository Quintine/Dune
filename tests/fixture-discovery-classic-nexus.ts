import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeNexusGameForAudit, joinGame, newPlayer,
  viewGame, type Action, type Game, type Player,
} from '../game/engine';
import type { FactionId } from '../game/catalog';
import { DISCOVERY_CARD_PLACEMENTS, DISCOVERY_TOKEN_BY_ID, type DiscoveryTokenFace } from '../game/discoveries';
import { discoveryEntryMoveAction } from '../game/discovery-entry-options';
import { classicDiscoveryNexusProfile } from '../game/discovery-module-profile';
import { nextNexusSkillsModulesPaymentsNativeStep } from './fixture-nexus-skills-modules-payments';

export type ClassicDiscoveryNexusStep = { actor: string; action: Action };
export type ClassicDiscoveryNexusOptions = {
  /** Authenticated fresh lobby or its undealt original staged setup; never a played save. */
  initial?: Game;
  gameId?: string;
  seatIds?: string[];
  seats?: 2 | 3 | 4 | 5 | 6;
  advanced?: boolean;
  tech?: boolean;
  strongholds?: boolean;
  /** Actual ordinary worm immediately before the Great Maker, not a Nexus flag assignment. */
  ordinaryWormFirst?: boolean;
  /** Actual ten-spice Emperor shipment to an empty desert makes next-turn charity relevant. */
  techCharity?: boolean;
};
export type ClassicDiscoveryNexusMentat = {
  before: Game; step: ClassicDiscoveryNexusStep; after: Game;
};
export type ClassicDiscoveryNexusFixture = {
  initial: Game; setup: Game; collection: Game; game: Game;
  firstMentat: ClassicDiscoveryNexusMentat;
  collector: string; opponent: string; fremen: string | null;
  token: string; parent: string; parentSector: number; wormSource: string;
  actions: ClassicDiscoveryNexusStep[]; staging: string[];
};
export const classicDiscoveryNexusClean = (game: Game): boolean =>
  !game.phaseOpening && !game.response && !game.decision && !game.truthtrance && !game.pendingTreacheryDiscard;
export function classicDiscoveryNexusPlayer(game: Game, id: string): Player {
  const player = game.players.find(candidate => candidate.id === id);
  assert.ok(player, `Missing original classic seat ${id}`);
  return player;
}

/** Explicit scalar lottery position: preserve the original shuffled arrays.
 * This also selects original Storm Card 1 first, rather than assigning a clock
 * or storm distance. UUID/byte-array entropy remains native. */
export function withClassicDiscoveryNexusLottery<T>(operation: () => T): T {
  const native = crypto.getRandomValues.bind(crypto);
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array && array.length === 1) array[0] = 0xffffffff;
    else Reflect.apply(native, crypto, [array]);
    return array;
  };
  try { return operation(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}

/** No optional spending, shipment, movement, card play, alliance or sealed
 * Battle Plan is invented by this driver. Every step belongs to a live owner.
 * Shared original controls retain priority over the optional Discovery choices. */
export function nextClassicDiscoveryNexusStep(game: Game): ClassicDiscoveryNexusStep | null {
  if (!game.phaseOpening && !game.response && !game.pendingTreacheryDiscard) {
    const decision = game.decision;
    if (decision?.kind === 'discoveryEntry' || decision?.kind === 'greatMakerRide')
      return { actor: decision.player, action: { type: 'decision', event: decision.event, accept: false } };
    if (decision?.kind === 'greatMakerVote')
      return { actor: decision.player, action: { type: 'decision', event: decision.event, yes: false } };
    if (decision?.kind === 'wormRide' || decision?.kind === 'wormPlacement')
      return { actor: decision.player, action: { type: 'decision', accept: false } };
    if (decision?.kind === 'wormProtection')
      return { actor: decision.player, action: { type: 'decision', accept: true } };
    if (decision?.kind === 'advisor' || decision?.kind === 'intrusion')
      return { actor: decision.player, action: { type: 'decision', accept: false } };
    if (decision?.kind === 'discoveryDiscard') {
      const card = classicDiscoveryNexusPlayer(game, decision.player).hand[0];
      assert.ok(card);
      return { actor: decision.player, action: { type: 'decision', event: decision.event, card: card.id } };
    }
  }
  return nextNexusSkillsModulesPaymentsNativeStep(game);
}
export function applyClassicDiscoveryNexusStep(game: Game, step: ClassicDiscoveryNexusStep,
  actions?: ClassicDiscoveryNexusStep[]): Game {
  actions?.push(structuredClone(step));
  return withClassicDiscoveryNexusLottery(() => applyAction(game, step.actor, step.action));
}
export function advanceClassicDiscoveryNexus(game: Game, until: (game: Game) => boolean,
  actions?: ClassicDiscoveryNexusStep[]): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original lifecycle ended before its requested continuation.');
    const step = nextClassicDiscoveryNexusStep(game);
    assert.ok(step, 'The original continuation needs a human sealed Battle Plan.');
    game = applyClassicDiscoveryNexusStep(game, step, actions);
  }
  throw new Error('The original Nexus/Discovery lifecycle did not reach its owned continuation.');
}

/** Physical supply-token lottery only; never writes a token location or face. */
export function withClassicDiscoveryNexusToken<T>(game: Game, face: DiscoveryTokenFace, operation: () => T): T {
  const eligible = game.discoveries!.tokens.filter(token => token.status === 'supply' && token.type === DISCOVERY_TOKEN_BY_ID[face].type);
  const index = eligible.findIndex(token => token.face === face);
  assert.ok(index >= 0, 'The requested physical token must remain in its original supply.');
  const native = crypto.getRandomValues.bind(crypto);
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array && array.length === 1)
      array[0] = Math.floor((index + 0.5) / eligible.length * 0x100000000);
    else Reflect.apply(native, crypto, [array]);
    return array;
  };
  try { return operation(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}
function orderSpice(game: Game, options: ClassicDiscoveryNexusOptions): void {
  const take = (matches: (card: Game['spiceDeck'][number]) => boolean) => {
    const index = game.spiceDeck.findIndex(matches);
    assert.ok(index >= 0, 'Each selected physical Spice Card must still be undealt.');
    return game.spiceDeck.splice(index, 1)[0];
  };
  const front = [take(card => 'territory' in card && card.discovery === 'discovery-hagga-basin')];
  if (game.advanced) front.push(take(card => 'territory' in card && !card.discovery && card.territory === 'broken_land'));
  if (options.ordinaryWormFirst) front.push(take(card => 'worm' in card && !card.greatMaker));
  front.push(take(card => 'worm' in card && !!card.greatMaker));
  front.push(take(card => 'territory' in card && card.discovery === 'discovery-sihaya-ridge'));
  if (game.advanced) front.push(take(card => 'territory' in card && !card.discovery && card.territory === 'rock_outcroppings'));
  game.spiceDeck.unshift(...front);
}
export function revealClassicDiscoveryNexus(game: Game, owner: string, token: string,
  actions?: ClassicDiscoveryNexusStep[]): Game {
  if (viewGame(game, owner).discoveries!.canInspect.some(id => id === token))
    game = applyClassicDiscoveryNexusStep(game, { actor: owner, action: { type: 'discovery', token, reveal: false } }, actions);
  return applyClassicDiscoveryNexusStep(game, { actor: owner, action: { type: 'discovery', token, reveal: true } }, actions);
}
export function finishClassicDiscoveryNexusMentat(game: Game, actions?: ClassicDiscoveryNexusStep[]): ClassicDiscoveryNexusMentat {
  const turn = game.turn;
  game = advanceClassicDiscoveryNexus(game, state => state.phase === 8 && classicDiscoveryNexusClean(state), actions);
  for (let count = 0; count < 100; count++) {
    const before = structuredClone(game), step = nextClassicDiscoveryNexusStep(game);
    assert.ok(step);
    game = applyClassicDiscoveryNexusStep(game, step, actions);
    if (game.turn !== turn || game.status === 'finished') return { before, step, after: game };
  }
  throw new Error('The original Mentat controls failed to close the turn.');
}
export function enterClassicDiscoveryNexus(game: Game, owner: string, amount = 1,
  actions?: ClassicDiscoveryNexusStep[]): Game {
  assert.ok(game.decision?.kind === 'discoveryEntry');
  assert.equal(game.decision.player, owner);
  const view = viewGame(game, owner), source = view.discoveryEntry!.sources.find(source => source.normal >= amount);
  assert.ok(source, 'Select physically available ordinary source counters.');
  const action = discoveryEntryMoveAction(view, [{ source: source.source, normal: amount, elite: 0 }]);
  assert.ok(action);
  return applyClassicDiscoveryNexusStep(game, { actor: owner, action }, actions);
}

/** Original base33/all12 Nexus + seven Spice Cards/eight Discovery tokens.
 * All clocks, wallets, board counters and pending frames arise from native
 * staged setup and actions. Only undealt cards and supply/Storm lotteries are
 * positioned explicitly. The returned human window is before turn-two Storm. */
export function createClassicDiscoveryNexusFixture(options: ClassicDiscoveryNexusOptions = {}): ClassicDiscoveryNexusFixture {
  let game: Game;
  if (options.initial) game = structuredClone(options.initial);
  else {
    const factions: FactionId[] = ['guild', 'emperor', 'fremen', 'atreides', 'harkonnen', 'beneGesserit'];
    const count = options.seats ?? options.seatIds?.length ?? 3;
    assert.ok(count >= 2 && count <= 6);
    if (options.seatIds) assert.equal(options.seatIds.length, count);
    const ids = options.seatIds ?? factions;
    game = createGame(options.gameId ?? 'CLASSICDISCOVERYNEXUS', newPlayer(ids[0], 'Guild', 'guild'), options.advanced ?? false);
    for (let seat = 1; seat < count; seat++) joinGame(game, newPlayer(ids[seat], factions[seat], factions[seat]));
  }
  assert.deepEqual(game.expansions, []);
  assert.ok(!game.homeworlds && !game.leaderSkills && !game.ecazTreachery && !game.spiceBankerIncomePreview);
  assert.ok(game.status === 'lobby' || (game.status === 'setup' && game.turn === 1 && game.phase === 0 &&
    ['prediction', 'traitors'].includes(game.setupStage!) && game.players.every(player => !player.hand.length && !player.traitors.length)));
  if (options.advanced !== undefined) assert.equal(game.advanced, options.advanced);
  const collector = game.players.find(player => player.faction === 'guild')?.id;
  const opponent = game.players.find(player => player.faction === 'emperor')?.id;
  assert.ok(collector && opponent, 'This original human recipe needs its Guild collector and Emperor source army.');
  const actions: ClassicDiscoveryNexusStep[] = [];
  if (game.status === 'lobby') {
    if (options.tech && !game.techTokens) game = applyAction(game, game.host, { type: 'techTokens', enabled: true });
    if (options.strongholds && !game.strongholdCards) game = applyAction(game, game.host, { type: 'strongholdCards', enabled: true });
    game.discoveryEnabled = true;
    game.nexusCards ??= { cards: null, phase: null };
    for (const player of game.players) if (!player.ready) game = applyAction(game, player.id, { type: 'ready' });
  }
  const initial = structuredClone(game);
  if (game.status === 'lobby') game = withClassicDiscoveryNexusLottery(() => initializeNexusGameForAudit(game));
  assert.ok(game.discoveryEnabled && game.discoveries && game.nexusCards?.cards);
  assert.ok(classicDiscoveryNexusProfile(game));
  const setup = structuredClone(game);
  game = advanceClassicDiscoveryNexus(game, state => state.status === 'playing', actions);
  orderSpice(game, options);
  game = advanceClassicDiscoveryNexus(game, state => state.phase === 1 && classicDiscoveryNexusClean(state), actions);
  // Token selection must surround the real Spice Blow action, not the generic
  // scalar-lottery wrapper that would otherwise own that same random draw.
  for (let count = 0; !game.discoveries!.tokens.some(token => token.face === 'cistern' && token.status === 'placed') && count < 100; count++) {
    const step = nextClassicDiscoveryNexusStep(game); assert.ok(step);
    actions.push(structuredClone(step));
    game = withClassicDiscoveryNexusToken(game, 'cistern', () => applyAction(game, step.actor, step.action));
  }
  assert.ok(game.discoveries!.tokens.some(token => token.face === 'cistern' && token.status === 'placed'));
  const placement = DISCOVERY_CARD_PLACEMENTS['discovery-hagga-basin'];
  const shipped = new Set<string>();
  game = advanceClassicDiscoveryNexus(game, state => state.phase === 5 && classicDiscoveryNexusClean(state), actions);
  for (let count = 0; game.phase === 5 && count < 200; count++) {
    if (classicDiscoveryNexusClean(game) && game.active && !shipped.has(game.active) && [collector, opponent].includes(game.active)) {
      const actor = game.active;
      const action: Action = actor === collector
        ? { type: 'ship', territory: placement.territory, sector: placement.sector, amount: 3, elite: 0, allyPayment: 0 }
        : { type: 'ship', territory: options.techCharity ? 'rock_outcroppings' : 'hagga_basin', sector: options.techCharity ? 13 : 12,
          amount: options.techCharity ? 5 : 3, elite: 0, allyPayment: 0 };
      game = applyClassicDiscoveryNexusStep(game, { actor, action }, actions);
      shipped.add(actor);
    } else {
      const step = nextClassicDiscoveryNexusStep(game); assert.ok(step);
      game = applyClassicDiscoveryNexusStep(game, step, actions);
    }
  }
  assert.equal(shipped.size, 2);
  game = advanceClassicDiscoveryNexus(game, state => state.phase === 7 && classicDiscoveryNexusClean(state), actions);
  const token = game.discoveries!.tokens.find(token => token.face === 'cistern')!;
  const collection = structuredClone(game);
  game = revealClassicDiscoveryNexus(game, collector, token.id, actions);
  const firstMentat = finishClassicDiscoveryNexusMentat(game, actions);
  game = firstMentat.after;
  assert.equal(game.turn, 2);
  assert.ok(game.decision?.kind === 'discoveryEntry');
  assert.equal(game.decision.player, collector);
  return { initial, setup, collection, firstMentat, game, collector, opponent,
    fremen: game.players.find(player => player.faction === 'fremen')?.id ?? null,
    token: token.id, parent: placement.territory, parentSector: placement.sector, wormSource: 'hagga_basin:12', actions,
    staging: ['Conserved undealt Spice positions: turn-one Hagga Basin Discovery, optional Advanced Broken Land; turn-two optional ordinary Shai-Hulud, Great Maker, Sihaya Ridge Discovery, optional Advanced Rock Outcroppings.',
      'Selected original Cistern supply-token lottery; original scalar shuffle/Storm lottery positions. No phases, wallets, armies or pending frames assigned.',
      options.techCharity ? 'Native Emperor five-force/ten-spice Rock Outcroppings shipment supplies actual later charity.' : 'Native Emperor three-force Hagga Basin shipment supplies actual Great Maker worm casualties.'] };
}

/** Continue into the real encounter without silently voting, riding or entering. */
export function openClassicDiscoveryNexusEncounter(fixture: ClassicDiscoveryNexusFixture, enter = true): Game {
  assert.ok(fixture.game.decision?.kind === 'discoveryEntry');
  const game = enter ? enterClassicDiscoveryNexus(fixture.game, fixture.collector) : applyClassicDiscoveryNexusStep(fixture.game,
    { actor: fixture.collector, action: { type: 'decision', event: fixture.game.decision!.event, accept: false } });
  return advanceClassicDiscoveryNexus(game, state => state.greatMaker?.stage === 'vote');
}
export function voteClassicDiscoveryNexus(game: Game, votes: readonly boolean[], actions?: ClassicDiscoveryNexusStep[]): Game {
  for (const yes of votes) {
    assert.ok(game.decision?.kind === 'greatMakerVote');
    game = applyClassicDiscoveryNexusStep(game, { actor: game.decision.player,
      action: { type: 'decision', event: game.decision.event, yes } }, actions);
  }
  return game;
}
export function openClassicDiscoveryNexusAlliance(game: Game): Game {
  return advanceClassicDiscoveryNexus(game, state => state.nexus && !state.spiceWindow && !state.spiceResolution && classicDiscoveryNexusClean(state));
}
export function formClassicDiscoveryNexusAlliance(game: Game, first: string, second: string): Game {
  game = applyClassicDiscoveryNexusStep(game, { actor: first, action: { type: 'alliance', target: second } });
  return applyClassicDiscoveryNexusStep(game, { actor: second, action: { type: 'alliance', target: first } });
}
