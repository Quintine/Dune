import assert from 'node:assert/strict';
import { viewGame, type Action, type Game } from '../game/engine';
import type { MixedActionExpression } from '../game/mixed-action-question';
import type { TruthFact, TruthQuestion } from '../game/truthtrance';
import { semutaBattleKaramaFixture } from './fixture-semuta-battle-karama';
import { nextRicheseStrongholdsNativeStep } from './fixture-richese-strongholds';
import {
  actTruthTransferOrderPlay, createTruthSemutaPrebidFixture, nextTruthTransferOrderPlayNative,
  truthTransferOrderPlayInventory, truthTransferOrderPlayPlayer, truthTransferOrderPlaySpice,
  truthTransferOrderPlayTraitors,
} from './fixture-truth-transfer-order-play';

export type TruthSemutaPlayLeaf = { kind: 'cardPlay'; effect: 'semutaDrug' } |
  { kind: 'payment'; recipient: string; minimum: number };
export type TruthSemutaPlayExpression = MixedActionExpression<TruthSemutaPlayLeaf>;
export type TruthSemutaPlayStep = { actor: string; action: Action };
export const actTruthSemutaPlay = actTruthTransferOrderPlay;
export const truthSemutaPlayPlayer = truthTransferOrderPlayPlayer;
export const truthSemutaPlayInventory = truthTransferOrderPlayInventory;
export const truthSemutaPlaySpice = truthTransferOrderPlaySpice;
export const truthSemutaPlayTraitors = truthTransferOrderPlayTraitors;
export const truthSemutaPlayClean = (game: Game) => !game.phaseOpening && !game.response && !game.decision &&
  !game.truthtrance && !game.pendingTreacheryDiscard && !game.pendingNullentropy && !game.pendingShipment && !game.currentAuctionSale;
export const truthSemutaPlayUse = (): TruthSemutaPlayExpression => ({ kind: 'action', action: { kind: 'cardPlay', effect: 'semutaDrug' } });
export const truthSemutaPlayFact = (fact: TruthFact): TruthSemutaPlayExpression => ({ kind: 'fact', fact });
export const truthSemutaPlayPayment = (recipient: string, minimum = 1): TruthSemutaPlayExpression =>
  ({ kind: 'action', action: { kind: 'payment', recipient, minimum } });
export const truthSemutaPlayGroup = (kind: 'and' | 'or', ...terms: TruthSemutaPlayExpression[]): TruthSemutaPlayExpression => ({ kind, terms });

export type TruthSemutaPlaySource = {
  game: Game; source: Game; sourceKind: 'nativeSingleton' | 'controlledMulti'; nativeAcquisition: boolean;
  target: string; asker: string; recipient: string; truths: string[]; truthHolders: string[]; truth: string;
  semuta: string; card: string; effect: 'semutaDrug'; spiceFact: TruthFact; mixed: TruthSemutaPlayExpression; question: TruthQuestion;
  setup: Game; originalCards: string[]; originalSpice: string[]; originalTraitors: string[];
  actions: TruthSemutaPlayStep[]; sourceActions: TruthSemutaPlayStep[]; sourceActionCount: number;
  sourceCounts: Record<string, number | null>; sourceDisclosure: string;
};

/** Native neutral controls never volunteer the promised Semuta action. The
 * caller explicitly uses its guide, passes a permitted offer or selects. */
export function nextTruthSemutaPlayNative(game: Game): TruthSemutaPlayStep | null {
  if (game.truthtrance || game.pendingNullentropy || game.pendingTreacheryDiscard?.reaction?.stage === 'select') return null;
  return game.players.some(player => player.id === 'g') ? nextTruthTransferOrderPlayNative(game) : nextRicheseStrongholdsNativeStep(game);
}
export function advanceTruthSemutaPlay(game: Game, until: (state: Game) => boolean, actions: TruthSemutaPlayStep[] = []): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const step = nextTruthSemutaPlayNative(game); assert.ok(step, 'Supply the actual Truth answer or committed private Semuta choice');
    game = actTruthSemutaPlay(game, step.actor, step.action, actions);
  }
  throw Error('The finite native Semuta continuation did not reach its boundary');
}
export function passTruthSemutaOffer(game: Game, actions: TruthSemutaPlayStep[] = []): Game {
  const pending = game.pendingTreacheryDiscard; assert.ok(pending && pending.reaction?.stage === 'offer');
  const event = pending.batch.event;
  return advanceTruthSemutaPlay(game, state => state.pendingTreacheryDiscard?.batch.event !== event, actions);
}
export function settleTruthSemutaPlay(game: Game, actions: TruthSemutaPlayStep[] = []): Game {
  return advanceTruthSemutaPlay(game, truthSemutaPlayClean, actions);
}
export function finishTruthSemutaPlay(game: Game, actions: TruthSemutaPlayStep[] = []): Game {
  const turn = game.turn;
  return advanceTruthSemutaPlay(game, state => state.turn === turn + 1, actions);
}

/** Actual turn1 Distrans use and turn2 cache Semuta1 acquisition. A later
 * physical Truth answer supplies its original foreign singleton discard. */
export function createTruthSemutaPlayFixture(options: { firstBid?: boolean } = {}) {
  const base = createTruthSemutaPrebidFixture(options), game = structuredClone(base.game), actions = structuredClone(base.actions);
  const effect = 'semutaDrug' as const, mixed = truthSemutaPlayGroup('and', truthSemutaPlayUse(),
    truthSemutaPlayPayment(base.recipient, viewGame(game, base.target).bribeOptions.available));
  const question: TruthQuestion = { kind: 'turnActions', target: base.target, turn: game.turn, mixed };
  const source = { ...base, game, source: structuredClone(game), sourceKind: 'nativeSingleton' as const, nativeAcquisition: true,
    effect, card: base.semuta, mixed, question, base,
    actions, sourceActions: actions, sourceActionCount: actions.length,
    sourceDisclosure: base.sourceDisclosure + ' This adapter asks only about a future completed printed Semuta use after the actual answer. ' +
      'Committing a multi-card search alone is not completion; no selected-card predicate or hypothetical future discard is added. ' +
      'The current declared foreign Truth supplies the genuine fresh singleton. All source counts derive from actual arrays.',
  };
  return source satisfies TruthSemutaPlaySource;
}

/** Explicit unit supplement: inherit the existing bare Advanced conserved
 * battle setup, then conserve only original hands before the real question.
 * Acquisition is NOT native evidence. No fresh batch/event is installed. */
export function createTruthSemutaMultiFixture() {
  const inherited = semutaBattleKaramaFixture('capture'), game = structuredClone(inherited.staged);
  const originalCards = truthSemutaPlayInventory(game), originalSpice = truthSemutaPlaySpice(game), originalTraitors = truthSemutaPlayTraitors(game);
  const target = inherited.holder, asker = inherited.winner, recipient = asker, opponent = inherited.loser;
  for (const actor of [asker, opponent]) game.deck.push(...truthSemutaPlayPlayer(game, actor).hand.splice(0));
  const move = (id: string, holder: string) => {
    for (const zone of [game.deck, game.discard, ...(game.richeseCache ? [game.richeseCache] : []), ...game.players.map(player => player.hand)]) {
      const at = zone.findIndex(card => card.id === id);
      if (at >= 0) { truthSemutaPlayPlayer(game, holder).hand.push(zone.splice(at, 1)[0]); return id; }
    }
    throw Error('Conserve the original physical card for this explicitly controlled supplement');
  };
  const truths = game.deck.filter(card => card.effect === 'truthtrance').map(card => card.id); assert.equal(truths.length, 2);
  move(truths[0], asker); move(truths[1], opponent);
  const weapons = game.deck.filter(card => card.kind === 'projectile').slice(0, 2).map(card => card.id);
  const defenses = game.deck.filter(card => card.kind === 'shield').slice(0, 2).map(card => card.id);
  assert.equal(weapons.length, 2); assert.equal(defenses.length, 2);
  const winnerCards = [move(weapons[0], asker), move(defenses[0], asker)], loserCards = [move(weapons[1], opponent), move(defenses[1], opponent)];
  assert.ok(!game.battle && !game.pendingTreacheryDiscard && truthSemutaPlayClean(game));
  assert.ok(truthSemutaPlayPlayer(game, target).hand.some(card => card.id === inherited.semuta));
  assert.ok(!game.homeworlds && !game.nexusCards && !game.leaderSkills && !game.techTokens && !game.strongholdCards);
  assert.deepEqual(truthSemutaPlayInventory(game), originalCards);
  const spiceFact: TruthFact = { kind: 'spice', compare: 'eq', value: truthSemutaPlayPlayer(game, target).spice };
  const mixed = truthSemutaPlayGroup('or', truthSemutaPlayUse(), truthSemutaPlayPayment(recipient));
  const question: TruthQuestion = { kind: 'turnActions', target, turn: game.turn, mixed };
  const actions: TruthSemutaPlayStep[] = [];
  const source = { game, source: structuredClone(game), sourceKind: 'controlledMulti' as const, nativeAcquisition: false,
    target, asker, recipient, truth: truths[0], truths, truthHolders: [asker, opponent], semuta: inherited.semuta,
    card: inherited.semuta, effect: 'semutaDrug' as const, spiceFact, mixed, question,
    setup: structuredClone(inherited.staged), originalCards, originalSpice, originalTraitors,
    actions, sourceActions: actions, sourceActionCount: actions.length,
    sourceCounts: { selected: actions.length, inheritedRecordedActions: null },
    producer: { actor: game.active!, opponent, territory: 'arrakeen', winner: asker, loser: opponent, winnerCards, loserCards },
    sourceDisclosure: 'CONTROLLED CONSERVED UNIT SUPPLEMENT, not native acquisition/history evidence. ' +
      'Inherit semutaBattleKaramaFixture(capture).staged, whose hands, wallets, armies, phase and turn were explicitly positioned by that older unit fixture. ' +
      'Conserve its original hands into separate projectile/Shield pairs and two original foreign Truths. ' +
      'The actual Truth declaration/answer, permitted first-offer passes, chooseBattle, plans, Traitor declines and original outcome acknowledgements later generate a genuine two-card loser-disposal event. ' +
      'No live battle, fresh discard batch, event, selection, receipt or promise is installed. The inherited fixture records no action array; its action count is explicitly unavailable. Only new actual controls are counted.',
  };
  return source satisfies TruthSemutaPlaySource;
}
export type TruthSemutaMultiFixture = ReturnType<typeof createTruthSemutaMultiFixture>;

export function declareTruthSemutaPlay(f: TruthSemutaPlaySource, source = f.game, copy: 0 | 1 = 0, actions: TruthSemutaPlayStep[] = []) {
  const asker = f.truthHolders[copy]; let game = actTruthSemutaPlay(source, asker, { type: 'card', card: f.truths[copy] }, actions);
  while (game.truthtrance?.stage === 'priority') {
    const actor = game.players.find(player => !game.truthtrance!.passed.includes(player.id)); assert.ok(actor);
    game = actTruthSemutaPlay(game, actor.id, { type: 'truthPass' }, actions);
  }
  assert.equal(game.truthtrance?.stage, 'ask'); return { game, asker, actions };
}
export function askTruthSemutaPlay(game: Game, asker: string, question: TruthQuestion, actions: TruthSemutaPlayStep[] = []): Game {
  return actTruthSemutaPlay(game, asker, { type: 'truthAsk', question: structuredClone(question) }, actions);
}
export function answerTruthSemutaPlay(game: Game, target: string, answer: 'yes' | 'no', actions: TruthSemutaPlayStep[] = []): Game {
  return actTruthSemutaPlay(game, target, { type: 'truthAnswer', answer }, actions);
}
export function bindTruthSemutaPlay(f: TruthSemutaPlaySource, answer: 'yes' | 'no' = 'yes', question: TruthQuestion = f.question,
  source = f.game, copy: 0 | 1 = 0, actions: TruthSemutaPlayStep[] = []) {
  const declared = declareTruthSemutaPlay(f, source, copy, actions), asked = askTruthSemutaPlay(declared.game, declared.asker, question, actions);
  return { game: answerTruthSemutaPlay(asked, f.target, answer, actions), declared, asked, actions };
}
export function truthSemutaPlayPromise(game: Game, target = game.turnActionPromises?.[0]?.player ?? game.players[0].id) {
  const row = viewGame(game, target).turnActionPromises.findLast(promise => promise.player === target); assert.ok(row); return row;
}
export function openTruthSemutaMultiBatch(f: TruthSemutaMultiFixture, source: Game, actions: TruthSemutaPlayStep[] = []): Game {
  let game = source;
  if (game.pendingTreacheryDiscard) game = passTruthSemutaOffer(game, actions);
  assert.ok(truthSemutaPlayClean(game));
  game = actTruthSemutaPlay(game, f.producer.actor, { type: 'chooseBattle', territory: f.producer.territory,
    target: f.producer.actor === f.producer.winner ? f.producer.loser : f.producer.winner }, actions);
  game = advanceTruthSemutaPlay(game, state => !!state.battle && !state.battle.preparation && state.battle.preLeader?.closed !== false && truthSemutaPlayClean(state), actions);
  const strongest = truthSemutaPlayPlayer(game, f.producer.winner).leaders.filter(leader => !leader.dead && !leader.usedAt).sort((a, b) => b.strength - a.strength)[0];
  const weakest = truthSemutaPlayPlayer(game, f.producer.loser).leaders.filter(leader => !leader.dead && !leader.usedAt).sort((a, b) => a.strength - b.strength)[0];
  assert.ok(strongest && weakest && strongest.strength + 1 > weakest.strength);
  game = actTruthSemutaPlay(game, f.producer.winner, { type: 'battlePlan', dial: 1, support: 1, leader: strongest.id,
    weapon: f.producer.winnerCards[0], defense: f.producer.winnerCards[1] }, actions);
  game = actTruthSemutaPlay(game, f.producer.loser, { type: 'battlePlan', dial: 0, support: 0, leader: weakest.id,
    weapon: f.producer.loserCards[0], defense: f.producer.loserCards[1] }, actions);
  game = advanceTruthSemutaPlay(game, state => !!state.pendingTreacheryDiscard && state.pendingTreacheryDiscard.batch.entries.length >= 2, actions);
  assert.deepEqual(game.pendingTreacheryDiscard!.batch.entries.map(entry => entry.card.id).sort(), [...f.producer.loserCards].sort());
  assert.equal(game.pendingTreacheryDiscard!.reaction?.stage, 'offer'); return game;
}
export function commitTruthSemutaPlay(game: Game, target: string, actions: TruthSemutaPlayStep[] = []): Game {
  const offer = game.pendingTreacheryDiscard; assert.ok(offer && offer.reaction?.stage === 'offer');
  return actTruthSemutaPlay(game, target, { type: 'semutaCommit', event: offer.batch.event }, actions);
}
export function selectTruthSemutaPlay(game: Game, target: string, selected: string, actions: TruthSemutaPlayStep[] = []): Game {
  const offer = game.pendingTreacheryDiscard; assert.ok(offer && offer.reaction?.stage === 'select');
  return actTruthSemutaPlay(game, target, { type: 'semutaSelect', event: offer.batch.event, card: selected }, actions);
}

/** One actual recovery producer, rather than installed recovered custody.
 * Basic Guild retains its original3 after free Semuta use, then spends the
 * next original Box cache1 and printed search2 before choosing Semuta. */
export function recoverTruthSemutaWithNativeBox(f: TruthSemutaPlaySource, source: Game, actions: TruthSemutaPlayStep[] = []) {
  assert.equal(f.sourceKind, 'nativeSingleton'); assert.equal(source.advanced, false);
  assert.equal(source.discard.filter(card => card.id === f.semuta).length, 1);
  let game = source; const turn = game.turn;
  game = advanceTruthSemutaPlay(game, state => state.turn === turn + 1 && !state.phaseOpening && !state.response &&
    state.decision?.kind === 'richeseCache', actions);
  const beforePurchase = structuredClone(game), box = game.richeseCache?.find(card => card.effect === 'nullentropyBox'); assert.ok(box);
  const from = actions.length;
  game = actTruthSemutaPlay(game, game.decision!.player, { type: 'decision', event: game.richeseBidding!.event,
    card: box.id, method: 'onceAround', direction: 'counterclockwise' }, actions);
  for (let count = 0; count < 200 && !(truthSemutaPlayPlayer(game, f.target).hand.some(card => card.id === box.id) &&
    truthSemutaPlayClean(game) && !game.richeseAuction && !!game.auction && game.auction.bid === 0 && game.auction.passed.length === 0); count++) {
    const lot = game.richeseAuction;
    const step = truthSemutaPlayClean(game) && lot?.cardId === box.id && !lot.outcome && lot.active === f.target && lot.bid === 0
      ? { actor: f.target, action: { type: 'richeseBid', event: lot.event, amount: 1, allyPayment: 0 } satisfies Action }
      : nextTruthSemutaPlayNative(game);
    assert.ok(step); game = actTruthSemutaPlay(game, step.actor, step.action, actions);
  }
  assert.ok(truthSemutaPlayPlayer(game, f.target).hand.some(card => card.id === box.id));
  assert.equal(truthSemutaPlayPlayer(beforePurchase, f.target).spice - truthSemutaPlayPlayer(game, f.target).spice, 1);
  const purchase = { before: beforePurchase, steps: structuredClone(actions.slice(from)), after: structuredClone(game) };
  const beforeRecovery = structuredClone(game);
  game = actTruthSemutaPlay(game, f.target, { type: 'card', card: box.id }, actions); const paid = structuredClone(game);
  if (game.pendingNullentropy) {
    const search = viewGame(game, f.target).nullentropy?.search; assert.ok(search && search.cards.some(card => card.id === f.semuta));
    game = actTruthSemutaPlay(game, f.target, { type: 'decision', event: search.event, card: f.semuta }, actions);
  }
  game = settleTruthSemutaPlay(game, actions);
  assert.ok(truthSemutaPlayPlayer(game, f.target).hand.some(card => card.id === f.semuta));
  assert.equal(truthSemutaPlayPlayer(beforeRecovery, f.target).spice - truthSemutaPlayPlayer(game, f.target).spice, 2);
  assert.deepEqual(truthSemutaPlayInventory(game), f.originalCards);
  return { game, box: box.id, purchase, beforeRecovery, paid, afterRecovery: structuredClone(game), actions };
}
