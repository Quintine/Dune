import assert from 'node:assert/strict';
import { applyAction, createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { spiceDeck, treacheryDeck, type SpiceCard } from '../game/cards';
import { nextStrongholdFactionsNativeStep } from './fixture-stronghold-factions';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';

export type IxSpiceStep = { actor: string; action: Action };
export const ixSpicePlayer = (game: Game, actor = 'atreides') => {
  const player = game.players.find(player => player.id === actor); assert.ok(player); return player;
};
export const ixSpiceClean = (game: Game) => !game.response && !game.phaseOpening &&
  !game.decision && !game.truthtrance && !game.pendingTreacheryDiscard;
export const beforeIxSpiceDraw = (game: Game) => game.status === 'playing' && game.phase === 1 &&
  ixSpiceClean(game) && !game.spiceSequence && !game.spiceResolution && !game.spiceWindow && !game.nexus;
export function actIxSpice(game: Game, actor: string, action: Action, actions: IxSpiceStep[] = []): Game {
  const next = withClassicDiscoveryNexusLottery(() => applyAction(game, actor, action));
  actions.push({ actor, action: structuredClone(action) }); return next;
}
/** Original controls, without strategic card use or a scored movement policy.
 * The real Fremen setup puts its printed ten ordinary forces in Sietch Tabr;
 * Advanced starred counters remain in the original reserve pool. */
export function nextIxSpiceStep(game: Game): IxSpiceStep | null {
  if (game.status === 'setup' && game.setupStage === 'forces' && ixSpicePlayer(game, 'fremen').reserves === 20 &&
    !game.response && !game.decision && !game.phaseOpening)
    return { actor: 'fremen', action: { type: 'fremenSetup', placements: { 'sietch_tabr:14': 10 } } };
  if (!game.response && !game.phaseOpening && !game.pendingTreacheryDiscard) {
    const decision = game.decision;
    if (decision?.kind === 'wormRide' || decision?.kind === 'wormPlacement')
      return { actor: decision.player, action: { type: 'decision', accept: false } };
    if (decision?.kind === 'wormProtection')
      return { actor: decision.player, action: { type: 'decision', accept: true } };
  }
  return nextStrongholdFactionsNativeStep(game);
}
export function advanceIxSpice(game: Game, until: (state: Game) => boolean, actions: IxSpiceStep[] = []): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original Ix Spice programme ended before its next control');
    const step = nextIxSpiceStep(game); assert.ok(step, 'The original native control requires its actual owner');
    game = actIxSpice(game, step.actor, step.action, actions);
  }
  throw Error('The original Ix Spice programme did not reach its finite boundary');
}

export type IxSpicePick = 'land' | 'worm' | 'sandtrout' | { territory: string };
/** Explicit unopened-deck lottery selection, not a draw/effect or source grant.
 * Every chosen card already occupies the remaining original Spice deck. The
 * helper preserves all physical cards and changes only its requested prefix. */
export function orderIxSpiceCards(game: Game, picks: readonly IxSpicePick[]) {
  assert.ok(beforeIxSpiceDraw(game), 'Order only the unopened deck before its first actual Spice Blow draw');
  const original = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const selected: { position: number; from: number; card: SpiceCard }[] = [];
  for (const [position, pick] of picks.entries()) {
    const from = game.spiceDeck.findIndex((card, index) => index >= position &&
      (typeof pick === 'object' ? 'territory' in card && card.territory === pick.territory
        : pick === 'land' ? 'territory' in card && !card.discovery
          : pick === 'worm' ? 'worm' in card && !card.greatMaker && !card.suppressed && !card.thumper
            : 'sandtrout' in card));
    assert.ok(from >= position, 'The requested encounter must remain in the unopened original Spice deck');
    const card = game.spiceDeck.splice(from, 1)[0];
    game.spiceDeck.splice(position, 0, card);
    selected.push({ position, from, card: structuredClone(card) });
  }
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), original);
  return selected;
}

/** Public original selected-Ix setup, not a Basic game reflagged Advanced or
 * a hand/force scenario. Original unopened deal positions select the physical
 * Thumper, both distinct Harvesters and Harkonnen's Karama. Native setup and
 * all original Ix phase-opening confirmations actually execute. */
export function createIxSpiceFixture(options: { advanced?: boolean; turn?: 1 | 2 } = {}) {
  const advanced = options.advanced ?? false, turn = options.turn ?? 1;
  let game = createGame('IXSPICECARDS', newPlayer('atreides', 'Atreides', 'atreides'), advanced, ['ix']);
  for (const faction of ['harkonnen', 'fremen'] as const) joinGame(game, newPlayer(faction, faction, faction));
  const actions: IxSpiceStep[] = [];
  const act = (actor: string, action: Action) => { game = actIxSpice(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceIxSpice(game, until, actions); };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game);
  act(game.host, advanced ? { type: 'start', advancedPreview: true } : { type: 'start' });
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup');
  assert.ok(game.players.every(player => player.hand.length === 0));
  assert.equal(game.deck.length, 47);
  assert.equal(game.spiceDeck.length, 22);
  const thumper = game.deck.find(card => card.effect === 'thumper');
  const harvesters = game.deck.filter(card => card.effect === 'harvester');
  const karama = game.deck.find(card => card.effect === 'karama');
  assert.ok(thumper && karama && harvesters.length === 2);
  const nativeHarvester = harvesters.find(card => !card.id.startsWith('ix-'));
  const ixHarvester = harvesters.find(card => card.id === 'ix-harvester');
  assert.ok(nativeHarvester && ixHarvester);
  const startingDeal = [thumper.id, nativeHarvester.id, karama.id, ixHarvester.id];
  for (const [position, id] of startingDeal.entries()) {
    const from = game.deck.findIndex(card => card.id === id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
  }
  const beforeStartingDeal = structuredClone(game);
  reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game);
  assert.ok(ixSpicePlayer(game).hand.some(card => card.id === thumper.id));
  assert.ok(ixSpicePlayer(game, 'harkonnen').hand.some(card => card.id === nativeHarvester.id));
  assert.ok(ixSpicePlayer(game, 'harkonnen').hand.some(card => card.id === karama.id));
  assert.ok(ixSpicePlayer(game, 'fremen').hand.some(card => card.id === ixHarvester.id));
  const originalTreachery = treacheryDeck(['ix']).map(card => card.id).sort();
  assert.equal(originalTreachery.length, 47);
  assert.equal(spiceDeck(true).length, 22);
  reach(state => state.phase === 1 && !!state.phaseOpening);
  const firstOpening = structuredClone(game);
  reach(beforeIxSpiceDraw);
  const firstBlow = structuredClone(game);
  let firstTurnSpiceOrder: ReturnType<typeof orderIxSpiceCards> = [], secondOpening: Game | null = null;
  if (turn === 2) {
    firstTurnSpiceOrder = orderIxSpiceCards(game, Array.from({ length: advanced ? 2 : 1 }, () => 'land' as const));
    reach(state => state.turn === 2 && state.phase === 1 && !!state.phaseOpening);
    secondOpening = structuredClone(game);
    reach(state => state.turn === 2 && beforeIxSpiceDraw(state));
  }
  assert.equal(game.turn, turn);
  assert.deepEqual(game.ready, []);
  assert.equal(viewGame(game, 'atreides').beforeSpiceDraw, true);
  assert.deepEqual([...game.deck, ...game.discard, ...game.players.flatMap(player => player.hand)]
    .map(card => card.id).sort(), originalTreachery);
  for (const [actor, id] of [
    ['atreides', thumper.id], ['harkonnen', nativeHarvester.id], ['harkonnen', karama.id], ['fremen', ixHarvester.id],
  ]) assert.ok(ixSpicePlayer(game, actor).hand.some(card => card.id === id), 'Actual intervening actions retain the original card');
  return { game, lobby, setup, beforeStartingDeal, afterSetup, firstOpening, firstBlow, secondOpening,
    firstTurnSpiceOrder, advanced, turn, startingDeal, thumper: thumper.id,
    harvesters: { harkonnen: nativeHarvester.id, fremen: ixHarvester.id }, karama: karama.id,
    thumperHolder: 'atreides', counterHolder: 'harkonnen', originalTreachery,
    sourceActionCount: actions.length, actions,
    staging: ['Only four unopened original starting-deal positions and scalar lotteries are selected. Turn2 additionally selects only the unopened first-turn ordinary land Spice positions. Public original Basic/Advanced Ix-deck setup actually deals all physical cards; explicit native Fremen setup, phase openings, readiness, passed bank lots and ended movement turns produce the saved boundary. No dealt hand, army, wallet, phase, turn, Nexus or effect flag is installed. This fixture establishes the original pre-draw source; independent engine/runtime callers assert the explicit provisional policies documented in docs/IX_PROTOTYPE.md.'] };
}
export type IxSpiceFixture = ReturnType<typeof createIxSpiceFixture>;

export type IxSpiceProgramme = 'first-thumper' | 'normal-thumper' | 'first-trout-worm' |
  'double-harvester' | 'waiting-thumper' | 'replacement-worm';
/** Actual original controls implement each selected source interpretation.
 * Effect assertions live in the independent engine cases/runtime caller. */
export function runIxSpiceProgramme(mode: IxSpiceProgramme, advanced = false) {
  const source = createIxSpiceFixture({ advanced, turn: mode === 'normal-thumper' ? 2 : 1 });
  let game = structuredClone(source.game);
  const actions: IxSpiceStep[] = [], orders: ReturnType<typeof orderIxSpiceCards>[] = [];
  const act = (actor: string, action: Action) => { game = actIxSpice(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceIxSpice(game, until, actions); };
  const waiting = mode === 'waiting-thumper' || mode === 'replacement-worm';
  let waitingSource: Game | null = null;
  if (waiting) {
    orders.push(orderIxSpiceCards(game, ['sandtrout', 'land', ...(advanced ? ['land' as const] : [])]));
    reach(state => !!state.spiceWindow);
    waitingSource = structuredClone(game);
    reach(state => state.turn === 2 && beforeIxSpiceDraw(state));
  }
  const picks: IxSpicePick[] = mode === 'first-trout-worm' ? ['sandtrout', 'worm', 'land']
    : mode === 'replacement-worm' ? ['worm', 'land'] : ['land'];
  if (advanced) picks.push('land');
  const prefix = orderIxSpiceCards(game, picks); orders.push(prefix);
  const before = structuredClone(game), usesThumper = ['first-thumper', 'normal-thumper', 'waiting-thumper', 'replacement-worm'].includes(mode);
  if (usesThumper) act(source.thumperHolder, { type: 'card', card: source.thumper });
  reach(state => !!state.spiceWindow && ixSpiceClean(state));
  const revealed = structuredClone(game);
  let firstHarvester: Game | null = null, passed: Game | null = null, secondHarvester: Game | null = null;
  if (mode === 'double-harvester' || mode === 'waiting-thumper') {
    act('harkonnen', { type: 'card', card: source.harvesters.harkonnen });
    firstHarvester = structuredClone(game);
    act('atreides', { type: 'ready' }); passed = structuredClone(game);
    act('fremen', { type: 'card', card: source.harvesters.fremen });
    secondHarvester = structuredClone(game);
  }
  reach(state => state.phase === 2 && ixSpiceClean(state));
  return { mode, advanced, source, game, actions, orders, prefix, before, revealed,
    waitingSource, firstHarvester, passed, secondHarvester, usesThumper };
}
