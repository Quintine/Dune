import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { treacheryDeck } from '../game/cards';
import type { MixedActionExpression } from '../game/mixed-action-question';
import { traitorDeck } from '../game/traitors';
import type { TruthFact, TruthQuestion } from '../game/truthtrance';
import { windowCardOpportunity } from '../game/window-card-play';
import { beforeIxSpiceDraw, orderIxSpiceCards } from './fixture-ix-spice-cards';
import { actTruthTurnThumper, nextTruthTurnThumperNative, truthTurnThumperInventory,
  truthTurnThumperPlayer, truthTurnThumperSpice, truthTurnThumperTraitors,
  type TruthTurnThumperLeaf, type TruthTurnThumperStep } from './fixture-truth-turn-thumper';

export type TruthTurnAmalLeaf = TruthTurnThumperLeaf | { kind: 'windowCardPlay'; effect: 'amal'; source: string };
export type TruthTurnAmalExpression = MixedActionExpression<TruthTurnAmalLeaf>;
export type TruthTurnAmalStep = TruthTurnThumperStep;
export const actTruthTurnAmal = actTruthTurnThumper;
export const truthTurnAmalPlayer = truthTurnThumperPlayer;
export const truthTurnAmalInventory = truthTurnThumperInventory;
export const truthTurnAmalTraitors = truthTurnThumperTraitors;
export const truthTurnAmalSpice = truthTurnThumperSpice;
/** Quiet original opening remains available; only temporary interactions stop. */
export const truthTurnAmalQuiet = (game: Game) => !game.response && !game.decision && !game.truthtrance &&
  !game.pendingTreacheryDiscard && !game.pendingRevival && !game.pendingShipment;
export const truthTurnAmalClean = (game: Game) => truthTurnAmalQuiet(game) && !game.phaseOpening;
export const truthTurnAmalFact = (fact: TruthFact): TruthTurnAmalExpression => ({ kind: 'fact', fact });
export const truthTurnAmalPlay = (source: string): TruthTurnAmalExpression =>
  ({ kind: 'action', action: { kind: 'windowCardPlay', effect: 'amal', source } });
export const truthTurnAmalPayment = (recipient: string, minimum = 5): TruthTurnAmalExpression =>
  ({ kind: 'action', action: { kind: 'payment', recipient, minimum } });
export const truthTurnAmalGroup = (kind: 'and' | 'or', ...terms: TruthTurnAmalExpression[]): TruthTurnAmalExpression => ({ kind, terms });
export const nextTruthTurnAmalNative = nextTruthTurnThumperNative;
export function nextTruthTurnAmal(game: Game): TruthTurnAmalStep | null {
  if (game.truthtrance) return null;
  for (const player of game.players) {
    const guide = viewGame(game, player.id).turnActionGuide;
    if (guide) return { actor: player.id, action: guide.action };
  }
  return nextTruthTurnAmalNative(game);
}
export function advanceTruthTurnAmal(game: Game, until: (state: Game) => boolean,
  actions: TruthTurnAmalStep[] = [], nativeOnly = false): Game {
  for (let count = 0; count < 1900; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original Amal source ended before its native boundary');
    const step = nativeOnly ? nextTruthTurnAmalNative(game) : nextTruthTurnAmal(game);
    assert.ok(step, 'Supply the actual Truthtrance question or private Battle Plan');
    game = actTruthTurnAmal(game, step.actor, step.action, actions);
  }
  throw Error('The genuine Amal chronology did not reach its finite boundary');
}
export function settleTruthTurnAmal(game: Game, actions: TruthTurnAmalStep[] = []): Game {
  return advanceTruthTurnAmal(game, truthTurnAmalQuiet, actions, true);
}

/** Original public selected-Ix H/A/E. Only the actual unopened deal and safe
 * unopened Spice prefix are selected. Every requested opening is opened by
 * real setup, dials, passes, readiness and original movement endings. */
export function createTruthTurnAmalFixture(options: { phase?: 0 | 1 | 8; advanced?: boolean; incoming?: 0 | 4 } = {}) {
  const phase = options.phase ?? 0, advanced = options.advanced ?? false, incoming = options.incoming ?? 0;
  assert.ok(!incoming || phase === 8, 'The real incoming bribe is earned in the preceding phase7');
  const asker = 'harkonnen', observer = 'atreides', target = 'emperor', recipient = asker;
  let game = createGame('TRUTHTURNAMAL', newPlayer(asker, 'Harkonnen', 'harkonnen'), advanced, ['ix']);
  joinGame(game, newPlayer(observer, 'Atreides', 'atreides')); joinGame(game, newPlayer(target, 'Emperor', 'emperor'));
  const initial = structuredClone(game), actions: TruthTurnAmalStep[] = [];
  const act = (actor: string, action: Action) => { game = actTruthTurnAmal(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceTruthTurnAmal(game, until, actions, true); };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game); act(game.host, advanced ? { type: 'start', advancedPreview: true } : { type: 'start' });
  const setup = structuredClone(game); assert.equal(game.status, 'setup');
  assert.ok(game.players.every(player => player.hand.length === 0));
  const originalCards = truthTurnAmalInventory(game), originalTraitors = truthTurnAmalTraitors(game), originalSpice = truthTurnAmalSpice(game);
  assert.deepEqual(originalCards, treacheryDeck(['ix']).map(card => card.id).sort());
  assert.deepEqual(originalTraitors, traitorDeck(game.players, true).sort());
  const truths = game.deck.filter(card => card.effect === 'truthtrance'); assert.equal(truths.length, 2);
  const amal = game.deck.find(card => card.effect === 'amal'), filler = game.deck.find(card => card.name === 'Baliset'); assert.ok(amal && filler);
  const deal = [...truths.map(card => card.id), filler.id, amal.id];
  const dealOrder = deal.map((id, position) => {
    const from = game.deck.findIndex(card => card.id === id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]]; return { position, from, card: id };
  });
  const beforeStartingDeal = structuredClone(game); reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game); assert.equal(game.phase, 0); assert.ok(game.phaseOpening);
  let spiceOrder: ReturnType<typeof orderIxSpiceCards> = [];
  let collection: { before: Game; steps: TruthTurnAmalStep[]; after: Game } | null = null;
  let incomingReceipt: { before: Game; steps: TruthTurnAmalStep[]; after: Game } | null = null;
  if (phase === 1) reach(state => state.phase === 1 && !!state.phaseOpening && truthTurnAmalQuiet(state));
  if (phase === 8) {
    reach(beforeIxSpiceDraw);
    spiceOrder = orderIxSpiceCards(game, [{ territory: 'hagga_basin' }, ...(advanced ? [{ territory: 'broken_land' }] : [])]);
    reach(state => state.phase === 7 && !!state.phaseOpening && truthTurnAmalQuiet(state));
    const beforeCollection = structuredClone(game), collectAt = actions.length;
    reach(state => state.phase === 7 && truthTurnAmalClean(state));
    collection = { before: beforeCollection, steps: structuredClone(actions.slice(collectAt)), after: structuredClone(game) };
    if (incoming) {
      const before = structuredClone(game), from = actions.length;
      act(asker, { type: 'bribe', target, amount: incoming });
      incomingReceipt = { before, steps: structuredClone(actions.slice(from)), after: structuredClone(game) };
      assert.equal(truthTurnAmalPlayer(game, target).bribes, incoming);
    }
    reach(state => state.phase === 8 && !!state.phaseOpening && truthTurnAmalQuiet(state));
  }
  assert.equal(game.turn, 1); assert.equal(game.phase, phase); assert.ok(game.phaseOpening);
  assert.deepEqual(game.phaseOpening.passed, []); assert.equal(truthTurnAmalPlayer(game, target).spice, 10);
  assert.equal(truthTurnAmalPlayer(game, target).bribes, incoming);
  assert.deepEqual(truthTurnAmalPlayer(game, asker).hand.map(card => card.id), truths.map(card => card.id));
  assert.deepEqual(truthTurnAmalPlayer(game, target).hand.map(card => card.id), [amal.id]);
  assert.deepEqual(truthTurnAmalInventory(game), originalCards); assert.deepEqual(truthTurnAmalTraitors(game), originalTraitors);
  assert.deepEqual(truthTurnAmalSpice(game), originalSpice);
  const opportunity = windowCardOpportunity(game, 'amal'); assert.ok(opportunity);
  const source = opportunity.source; assert.equal(source, `phase-opening:1:${phase}`);
  const mixed = truthTurnAmalGroup('and', truthTurnAmalPlay(source), truthTurnAmalPayment(recipient));
  const question = { kind: 'turnActions', target, turn: game.turn, mixed } satisfies TruthQuestion;
  const spiceFact: TruthFact = { kind: 'spice', compare: 'eq', value: truthTurnAmalPlayer(game, target).spice };
  return { game, initial, lobby, setup, beforeStartingDeal, afterSetup, asker, target, recipient, observer,
    phase, advanced, incoming, collection, incomingReceipt, truths: truths.map(card => card.id), truth: truths[0].id,
    card: amal.id, amal: amal.id, effect: 'amal' as const, source, opportunity, mixed, question, spiceFact,
    nativeAction: { type: 'card', card: amal.id } satisfies Action,
    payment: { type: 'bribe', target: recipient, amount: 5 } satisfies Action,
    dealOrder, spiceOrder, originalCards, originalTraitors, originalSpice,
    actions, sourceActions: actions, sourceActionCount: actions.length,
    sourceCounts: { selected: actions.length, originalSetup: actions.findLastIndex(step => step.action.type === 'traitor') + 1,
      actualCollection: collection?.steps.length ?? 0, actualIncomingPayment: incomingReceipt?.steps.length ?? 0 },
    sourceDisclosure: 'Actual public Harkonnen/Atreides/Emperor selected-Ix setup: H receives both original Truthtrances, A Baliset and E original Amal through the unopened native deal. ' +
      `Only original unopened deal/Spice positions and scalar lotteries are selected. Real setup and original native controls open turn1 phase${phase}; other original openings are passed without Amal. ` +
      (phase === 8 ? advanced
        ? 'Original Harkonnen Carthag and Atreides Arrakeen each actually earn their Advanced two-spice city income during Collection; Emperor has no city income. '
        : 'Actual Basic Collection gives no automatic city income, and no original army occupies the selected Spice blow. '
        : '') +
      (incoming ? 'H actually pays E four spice during quiet phase7; that known receipt stays queued through the original Mentat opening until actual initialization. ' : '') +
      'Early-opening funding examples use owned current resources; absolute post-halving limits use the original Mentat opening after Charity and Bidding. ' +
      'Owner cash is the original ten before the requested opening. No hand, wallet, ready/pass list, phase, turn, body, income, halving or promise is installed. All counts derive from actual action arrays.',
  };
}
export type TruthTurnAmalFixture = ReturnType<typeof createTruthTurnAmalFixture>;
export function declareTruthTurnAmal(f: TruthTurnAmalFixture, source = f.game, copy: 0 | 1 = 0, actions: TruthTurnAmalStep[] = []) {
  let game = actTruthTurnAmal(source, f.asker, { type: 'card', card: f.truths[copy] }, actions);
  while (game.truthtrance?.stage === 'priority') {
    const actor = game.players.find(player => !game.truthtrance!.passed.includes(player.id)); assert.ok(actor);
    game = actTruthTurnAmal(game, actor.id, { type: 'truthPass' }, actions);
  }
  assert.equal(game.truthtrance?.stage, 'ask'); return { game, actions };
}
export function askTruthTurnAmal(game: Game, asker: string, target: string, mixed: TruthTurnAmalExpression, actions: TruthTurnAmalStep[] = []): Game {
  return actTruthTurnAmal(game, asker, { type: 'truthAsk', question: { kind: 'turnActions', target, turn: game.turn, mixed: structuredClone(mixed) } }, actions);
}
export function answerTruthTurnAmal(game: Game, target: string, answer: 'yes' | 'no' | 'unknown', actions: TruthTurnAmalStep[] = []): Game {
  return actTruthTurnAmal(game, target, { type: 'truthAnswer', answer }, actions);
}
export function bindTruthTurnAmal(f: TruthTurnAmalFixture, answer: 'yes' | 'no' = 'yes', mixed = f.mixed,
  source = f.game, copy: 0 | 1 = 0, actions: TruthTurnAmalStep[] = []) {
  const declared = declareTruthTurnAmal(f, source, copy, actions), asked = askTruthTurnAmal(declared.game, f.asker, f.target, mixed, actions);
  return { game: answerTruthTurnAmal(asked, f.target, answer, actions), declared, asked, actions };
}
export function truthTurnAmalPromise(game: Game, target = game.turnActionPromises![0].player) {
  const row = viewGame(game, target).turnActionPromises.find(candidate => candidate.player === target); assert.ok(row); return row;
}
export function closeTruthTurnAmal(game: Game, f: Pick<TruthTurnAmalFixture, 'source'>, actions: TruthTurnAmalStep[] = []): Game {
  return advanceTruthTurnAmal(game, state => truthTurnAmalQuiet(state) && !windowCardOpportunity(state, 'amal', f.source), actions, true);
}
export function finishTruthTurnAmal(game: Game, actions: TruthTurnAmalStep[] = []): Game {
  const turn = game.turn;
  return advanceTruthTurnAmal(game, state => state.turn === turn + 1 && state.phase === 0 && !!state.phaseOpening && truthTurnAmalQuiet(state), actions);
}
