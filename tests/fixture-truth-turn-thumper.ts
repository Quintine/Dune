import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { type SpiceCard, treacheryDeck } from '../game/cards';
import { stormSectorAfter } from '../game/disaster-rules';
import type { MixedActionExpression } from '../game/mixed-action-question';
import { traitorDeck } from '../game/traitors';
import type { TruthFact, TruthQuestion } from '../game/truthtrance';
import { windowCardOpportunity } from '../game/window-card-play';
import { beforeIxSpiceDraw, orderIxSpiceCards } from './fixture-ix-spice-cards';
import { nextStrongholdFactionsNativeStep } from './fixture-stronghold-factions';
import { truthTraitorDecisionTraitors } from './fixture-truth-traitor-decision';
import { actTruthTurnAction, truthTurnActionInventory, truthTurnActionPlayer,
  type TruthTurnActionStep } from './fixture-truth-turn-action';
import type { TruthTurnKaramaShipmentLeaf } from './fixture-truth-turn-karama-shipment';

export type TruthTurnThumperLeaf = TruthTurnKaramaShipmentLeaf |
  { kind: 'windowCardPlay'; effect: 'thumper'; source: string };
export type TruthTurnThumperExpression = MixedActionExpression<TruthTurnThumperLeaf>;
export type TruthTurnThumperStep = TruthTurnActionStep;
export const actTruthTurnThumper = actTruthTurnAction;
export const truthTurnThumperPlayer = truthTurnActionPlayer;
export const truthTurnThumperInventory = truthTurnActionInventory;
export const truthTurnThumperTraitors = truthTraitorDecisionTraitors;
export const truthTurnThumperClean = (game: Game) => !game.response && !game.phaseOpening && !game.decision &&
  !game.truthtrance && !game.pendingTreacheryDiscard && !game.pendingRevival && !game.pendingShipment;
export const truthTurnThumperFact = (fact: TruthFact): TruthTurnThumperExpression => ({ kind: 'fact', fact });
export const truthTurnThumperPlay = (source: string): TruthTurnThumperExpression =>
  ({ kind: 'action', action: { kind: 'windowCardPlay', effect: 'thumper', source } });
export const truthTurnThumperPayment = (recipient: string, minimum = 2): TruthTurnThumperExpression =>
  ({ kind: 'action', action: { kind: 'payment', recipient, minimum } });
export const truthTurnThumperMove = (territory = 'polar_sink', minimum = 2): TruthTurnThumperExpression =>
  ({ kind: 'action', action: { kind: 'move', territory, minimum } });
export const truthTurnThumperGroup = (kind: 'and' | 'or', ...terms: TruthTurnThumperExpression[]): TruthTurnThumperExpression =>
  ({ kind, terms });

/** Sandtrout's waiting flag holds its original one physical card. Generated
 * Thumper worms are encounters, and never join the physical Spice inventory. */
export function truthTurnThumperSpice(game: Game) {
  const physical: SpiceCard[] = [...game.spiceDeck, ...game.spiceDiscard.flat(), ...(game.spiceSequence?.skipped ?? [])]
    .filter(card => !('worm' in card && card.thumper));
  if (game.sandtrout) physical.push({ sandtrout: true });
  return physical.map(card => 'territory' in card
    ? JSON.stringify({ territory: card.territory, amount: card.amount, sector: card.sector })
    : 'sandtrout' in card ? 'sandtrout' : 'worm').sort();
}
/** Native Basic dials are zero in the original first Storm, then one each in
 * the later Storm. Its real two-sector traversal misses the earned bodies. */
export function nextTruthTurnThumperNative(game: Game): TruthTurnThumperStep | null {
  if (game.truthtrance) return null;
  if (!game.response && !game.phaseOpening && game.decision &&
    ['wormRide', 'wormPlacement'].includes(game.decision.kind))
    return { actor: game.decision.player, action: { type: 'decision', accept: false } };
  return nextStrongholdFactionsNativeStep(game);
}
export function nextTruthTurnThumper(game: Game): TruthTurnThumperStep | null {
  if (game.truthtrance) return null;
  for (const player of game.players) {
    const guide = viewGame(game, player.id).turnActionGuide;
    if (guide) return { actor: player.id, action: guide.action };
  }
  return nextTruthTurnThumperNative(game);
}
export function advanceTruthTurnThumper(game: Game, until: (state: Game) => boolean,
  actions: TruthTurnThumperStep[] = [], nativeOnly = false): Game {
  for (let count = 0; count < 1900; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The genuine Thumper source ended before its requested native boundary');
    const step = nativeOnly ? nextTruthTurnThumperNative(game) : nextTruthTurnThumper(game);
    assert.ok(step, 'Supply the original Truthtrance question or actual private Battle Plan');
    game = actTruthTurnThumper(game, step.actor, step.action, actions);
  }
  throw Error('The original Thumper chronology did not reach its finite boundary');
}
export function settleTruthTurnThumper(game: Game, actions: TruthTurnThumperStep[] = []): Game {
  return advanceTruthTurnThumper(game, truthTurnThumperClean, actions, true);
}

/** Genuine public selected-Ix H/A/E. H really receives both original Truths,
 * A Baliset and E printed Thumper from the unopened original deal. The later
 * Basic source earns its selected potential casualties by shipment/collection
 * and two actual one-sector later Storm dials; no played state is installed. */
export function createTruthTurnThumperFixture(options: {
  advanced?: boolean; turn?: 1 | 2; waitingSandtrout?: boolean; bodyCount?: 2 | 3;
} = {}) {
  const advanced = options.advanced ?? false, turn = options.turn ?? 1, waitingSandtrout = options.waitingSandtrout ?? false;
  const bodyCount = options.bodyCount ?? 2;
  assert.ok(turn === 1 || !advanced, 'The bounded earned-body second-turn source uses actual Basic second Storm dials');
  assert.ok(!waitingSandtrout || turn === 2, 'Waiting Sandtrout is earned during the original preceding turn');
  const asker = 'harkonnen', observer = 'atreides', target = 'emperor', recipient = asker;
  let game = createGame('TRUTHTURNTHUMPER', newPlayer(asker, 'Harkonnen', 'harkonnen'), advanced, ['ix']);
  joinGame(game, newPlayer(observer, 'Atreides', 'atreides'));
  joinGame(game, newPlayer(target, 'Emperor', 'emperor'));
  const initial = structuredClone(game), actions: TruthTurnThumperStep[] = [];
  const act = (actor: string, action: Action) => { game = actTruthTurnThumper(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceTruthTurnThumper(game, until, actions, true); };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game); act(game.host, advanced ? { type: 'start', advancedPreview: true } : { type: 'start' });
  const setup = structuredClone(game); assert.equal(game.status, 'setup');
  assert.ok(game.players.every(player => player.hand.length === 0));
  const originalCards = truthTurnThumperInventory(game), originalTraitors = truthTurnThumperTraitors(game);
  assert.deepEqual(originalCards, treacheryDeck(['ix']).map(card => card.id).sort());
  assert.deepEqual(originalTraitors, traitorDeck(game.players, true).sort());
  const originalSpice = truthTurnThumperSpice(game);
  const truths = game.deck.filter(card => card.effect === 'truthtrance'); assert.equal(truths.length, 2);
  const thumper = game.deck.find(card => card.effect === 'thumper'), filler = game.deck.find(card => card.name === 'Baliset');
  assert.ok(thumper && filler);
  const deal = [...truths.map(card => card.id), filler.id, thumper.id];
  const dealOrder = deal.map((id, position) => {
    const from = game.deck.findIndex(card => card.id === id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: id };
  });
  const beforeStartingDeal = structuredClone(game); reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game);
  assert.deepEqual(truthTurnThumperPlayer(game, asker).hand.map(card => card.id), truths.map(card => card.id));
  assert.deepEqual(truthTurnThumperPlayer(game, target).hand.map(card => card.id), [thumper.id]);
  reach(state => state.phase === 1 && !!state.phaseOpening);
  const firstOpening = structuredClone(game); let sourceOpening = firstOpening, openingAt = actions.length;
  reach(beforeIxSpiceDraw); const firstBeforeReveal = structuredClone(game), firstRevealAt = actions.length;
  let priorOrder: ReturnType<typeof orderIxSpiceCards> = [];
  let priorShipment: { before: Game; steps: TruthTurnThumperStep[]; after: Game } | null = null;
  let secondStormSteps: TruthTurnThumperStep[] = [];
  const previousTerritory = 'hagga_basin', previousSector = 12, previousLocation = `${previousTerritory}:${previousSector}`;
  let priorBlow: Game['spiceWindow'] = null;
  if (turn === 2) {
    priorOrder = orderIxSpiceCards(game, [...(waitingSandtrout ? ['sandtrout' as const] : []), { territory: previousTerritory }]);
    reach(state => !!state.spiceWindow && truthTurnThumperClean(state)); priorBlow = structuredClone(game.spiceWindow);
    assert.equal(priorBlow?.territory, previousTerritory); assert.equal(priorBlow?.sector, previousSector);
    reach(state => state.phase === 5 && state.active === target && truthTurnThumperClean(state));
    const before = structuredClone(game), from = actions.length;
    act(target, { type: 'ship', territory: previousTerritory, sector: previousSector, amount: bodyCount, elite: 0, allyPayment: 0 });
    reach(truthTurnThumperClean);
    priorShipment = { before, steps: structuredClone(actions.slice(from)), after: structuredClone(game) };
    assert.equal(truthTurnThumperPlayer(before, target).spice - truthTurnThumperPlayer(game, target).spice, bodyCount * 2);
    assert.equal(truthTurnThumperPlayer(game, target).forces[previousLocation], bodyCount);
    act(target, { type: 'endMovement' });
    reach(state => state.turn === 2 && state.phase === 1 && !!state.phaseOpening);
    sourceOpening = structuredClone(game); openingAt = actions.length; reach(beforeIxSpiceDraw);
    secondStormSteps = structuredClone(actions.slice(firstRevealAt).filter(step => step.action.type === 'stormDial'));
    assert.deepEqual(secondStormSteps.map(step => step.action.amount), [1, 1]);
    assert.equal(game.storm, stormSectorAfter(firstBeforeReveal.storm, 2));
    assert.equal(truthTurnThumperPlayer(game, target).forces[previousLocation], bodyCount);
    assert.equal(truthTurnThumperPlayer(game, target).tanks, 0);
    assert.equal(game.sandtrout, waitingSandtrout);
  }
  const sourceOpeningSteps = structuredClone(actions.slice(openingAt));
  const revealOrder = orderIxSpiceCards(game, [{ territory: turn === 2 ? 'broken_land' : previousTerritory },
    ...(advanced ? [{ territory: 'broken_land' }] : [])]);
  const opportunity = windowCardOpportunity(game, 'thumper'); assert.ok(opportunity);
  assert.equal(opportunity.source, `first-spice-reveal:${turn}`); assert.equal(game.turn, turn);
  assert.equal(game.thumperWindowOpen, true); assert.deepEqual(game.ready, []);
  assert.equal(viewGame(game, target).beforeSpiceDraw, true);
  assert.ok(truthTurnThumperPlayer(game, target).hand.some(card => card.id === thumper.id));
  assert.deepEqual(truthTurnThumperInventory(game), originalCards); assert.deepEqual(truthTurnThumperTraitors(game), originalTraitors);
  assert.deepEqual(truthTurnThumperSpice(game), originalSpice);
  const source = opportunity.source, mixed = truthTurnThumperGroup('and', truthTurnThumperPlay(source), truthTurnThumperPayment(recipient));
  const question = { kind: 'turnActions', target, turn: game.turn, mixed } satisfies TruthQuestion;
  const spiceFact: TruthFact = { kind: 'spice', compare: 'eq', value: truthTurnThumperPlayer(game, target).spice };
  return { game, initial, lobby, setup, beforeStartingDeal, afterSetup, firstOpening, sourceOpening,
    sourceOpeningSteps, firstBeforeReveal, asker, target, recipient, observer, advanced, turn, waitingSandtrout, bodyCount,
    truths: truths.map(card => card.id), truth: truths[0].id, card: thumper.id, thumper: thumper.id,
    effect: 'thumper' as const, source, opportunity, mixed, question, spiceFact,
    nativeAction: { type: 'card', card: thumper.id } satisfies Action,
    payment: { type: 'bribe', target: recipient, amount: 2 } satisfies Action,
    priorOrder, priorShipment, priorBlow, secondStormSteps, previousTerritory, previousSector, previousLocation, revealOrder, dealOrder,
    originalCards, originalTraitors, originalSpice, actions, sourceActions: actions, sourceActionCount: actions.length,
    sourceCounts: { selected: actions.length, sourceOpening: sourceOpeningSteps.length,
      priorShipment: priorShipment?.steps.length ?? 0, secondStormDials: secondStormSteps.length },
    sourceDisclosure: 'Actual public selected-Ix Harkonnen/Atreides/Emperor setup and original card inventories, including the original Cheap Hero Traitor. ' +
      'Only the original unopened four-card deal, specified unopened Spice prefixes and scalar lotteries are selected. All native Amal phase-opening passes execute. ' +
      (turn === 2 ? `Actually reveal original Hagga Basin Spice, pay ${bodyCount * 2} spice to ship ${bodyCount} original Emperor reserves there, collect ${bodyCount * 2} spice through the real first turn and submit two real second-turn one-sector Storm dials. The actual two-sector traversal leaves all ${bodyCount} counters alive. ` +
        (waitingSandtrout ? 'Original first-turn Sandtrout really enters its waiting state before that original land blow. ' : '')
        : 'Stop before the actual first-turn first reveal; existing provisional first-turn ignoring of the Thumper encounter remains unchanged. ') +
      'No hand, purse, force, phase, worm, waiting flag, casualty, revealed card, printed play or promise is installed. Action counts derive from actual recorded arrays.',
  };
}
export type TruthTurnThumperFixture = ReturnType<typeof createTruthTurnThumperFixture>;
export function declareTruthTurnThumper(f: TruthTurnThumperFixture, source = f.game, copy: 0 | 1 = 0,
  actions: TruthTurnThumperStep[] = []) {
  let game = actTruthTurnThumper(source, f.asker, { type: 'card', card: f.truths[copy] }, actions);
  while (game.truthtrance?.stage === 'priority') {
    const actor = game.players.find(player => !game.truthtrance!.passed.includes(player.id)); assert.ok(actor);
    game = actTruthTurnThumper(game, actor.id, { type: 'truthPass' }, actions);
  }
  assert.equal(game.truthtrance?.stage, 'ask'); return { game, actions };
}
export function askTruthTurnThumper(game: Game, asker: string, target: string, mixed: TruthTurnThumperExpression,
  actions: TruthTurnThumperStep[] = []): Game {
  return actTruthTurnThumper(game, asker, { type: 'truthAsk', question: {
    kind: 'turnActions', target, turn: game.turn, mixed: structuredClone(mixed),
  } }, actions);
}
export function answerTruthTurnThumper(game: Game, target: string, answer: 'yes' | 'no' | 'unknown',
  actions: TruthTurnThumperStep[] = []): Game {
  return actTruthTurnThumper(game, target, { type: 'truthAnswer', answer }, actions);
}
export function bindTruthTurnThumper(f: TruthTurnThumperFixture, answer: 'yes' | 'no' = 'yes', mixed = f.mixed,
  source = f.game, copy: 0 | 1 = 0, actions: TruthTurnThumperStep[] = []) {
  const declared = declareTruthTurnThumper(f, source, copy, actions), asked = askTruthTurnThumper(declared.game, f.asker, f.target, mixed, actions);
  return { game: answerTruthTurnThumper(asked, f.target, answer, actions), declared, asked, actions };
}
export function truthTurnThumperPromise(game: Game, target = game.turnActionPromises![0].player) {
  const row = viewGame(game, target).turnActionPromises.find(candidate => candidate.player === target); assert.ok(row); return row;
}
export function closeTruthTurnThumper(game: Game, f: TruthTurnThumperFixture, actions: TruthTurnThumperStep[] = []): Game {
  return advanceTruthTurnThumper(game, state => truthTurnThumperClean(state) && !windowCardOpportunity(state, 'thumper', f.source), actions, true);
}
export function finishTruthTurnThumper(game: Game, actions: TruthTurnThumperStep[] = []): Game {
  const turn = game.turn;
  return advanceTruthTurnThumper(game, state => state.turn === turn + 1 && state.phase === 0 && truthTurnThumperClean(state), actions);
}
