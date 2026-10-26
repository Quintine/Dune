import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { choamOpeningIncome } from '../game/charity';
import { treacheryDeck } from '../game/cards';
import { traitorDeck } from '../game/traitors';
import type { TruthQuestion } from '../game/truthtrance';
import { beforeIxSpiceDraw, orderIxSpiceCards } from './fixture-ix-spice-cards';
import { actChoamCharityFunding, nextChoamCharityFundingStep } from './fixture-choam-charity-funding';
import { truthCharityPaymentsFact, truthCharityPaymentsGroup, truthCharityPaymentsPayment,
  truthCharityPaymentsShip, truthCharityPaymentsPromise, type TruthCharityPaymentsKind } from './fixture-truth-charity-payments';
import { truthTurnThumperInventory, truthTurnThumperPlayer, truthTurnThumperSpice,
  truthTurnThumperTraitors, type TruthTurnThumperStep } from './fixture-truth-turn-thumper';

export type TruthChoamIncomeStep = TruthTurnThumperStep;
export type TruthChoamIncomeKind = TruthCharityPaymentsKind;
export const actTruthChoamIncome = actChoamCharityFunding;
export const truthChoamIncomePlayer = truthTurnThumperPlayer;
export const truthChoamIncomeInventory = truthTurnThumperInventory;
export const truthChoamIncomeSpice = truthTurnThumperSpice;
export const truthChoamIncomeTraitors = truthTurnThumperTraitors;
export const truthChoamIncomePromise = truthCharityPaymentsPromise;
export const truthChoamIncomeFact = truthCharityPaymentsFact;
export const truthChoamIncomeGroup = truthCharityPaymentsGroup;
export const truthChoamIncomePayment = truthCharityPaymentsPayment;
export const truthChoamIncomeShip = truthCharityPaymentsShip;
export const truthChoamIncomeClean = (game: Game) => !game.phaseOpening && !game.response && !game.decision &&
  !game.truthtrance && !game.pendingTreacheryDiscard && !game.pendingRevival && !game.pendingShipment;

/** Native setup and original quiet controls. Market opportunities are passed;
 * no sale, ordinary claim or counter decision is manufactured by this driver. */
export function nextTruthChoamIncomeNative(game: Game): TruthChoamIncomeStep | null {
  if (game.truthtrance) return null;
  const bg = game.players.find(player => player.faction === 'beneGesserit');
  if (game.status === 'setup' && game.setupStage === 'prediction' && bg)
    return { actor: bg.id, action: { type: 'predict', faction: 'harkonnen', turn: 10 } };
  if (game.status === 'setup' && game.setupStage === 'forces' && bg && !bg.advisorSetup)
    return { actor: bg.id, action: { type: 'advisorSetup', territory: 'polar_sink', sector: 0 } };
  if (!game.phaseOpening && !game.response && game.decision?.kind === 'advisorBattle')
    return { actor: game.decision.player, action: { type: 'decision', accept: false } };
  return nextChoamCharityFundingStep(game);
}
export function nextTruthChoamIncome(game: Game): TruthChoamIncomeStep | null {
  if (game.truthtrance) return null;
  for (const player of game.players) {
    const view = viewGame(game, player.id), guide = view.turnActionGuide ?? view.bribePromiseGuide;
    if (guide) return { actor: player.id, action: guide.action };
  }
  return nextTruthChoamIncomeNative(game);
}
export function advanceTruthChoamIncome(game: Game, until: (state: Game) => boolean,
  actions: TruthChoamIncomeStep[] = [], nativeOnly = false): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original CHOAM income source ended before its native boundary');
    const step = nativeOnly ? nextTruthChoamIncomeNative(game) : nextTruthChoamIncome(game);
    assert.ok(step, 'Supply the actual Truthtrance question or original private Battle Plan');
    game = actTruthChoamIncome(game, step.actor, step.action, actions);
  }
  throw Error('The genuine CHOAM income chronology did not reach its finite boundary');
}
export function settleTruthChoamIncome(game: Game, actions: TruthChoamIncomeStep[] = []): Game {
  return advanceTruthChoamIncome(game, truthChoamIncomeClean, actions, true);
}
export function reachTruthChoamIncomeResponse(game: Game, actions: TruthChoamIncomeStep[] = []): Game {
  return advanceTruthChoamIncome(game, state => state.phase === 2 && !state.phaseOpening && !state.truthtrance &&
    state.response?.kind === 'choamCharity', actions, true);
}
export function allowTruthChoamIncome(game: Game, actions: TruthChoamIncomeStep[] = []): Game {
  assert.equal(game.response?.kind, 'choamCharity'); const turn = game.turn;
  return advanceTruthChoamIncome(game, state => state.choamCharity?.turn === turn && truthChoamIncomeClean(state), actions, true);
}

/** Public original H/A/CHOAM selected-Ix game. Select H's two unopened Truths
 * and A's printed Karama. The optional BG counter source also selects the
 * second original Karama in CHOAM's native one-card initial deal slot. */
export function createTruthChoamIncomeFixture(options: {
  advanced?: boolean; bg?: boolean; providerKarama?: boolean; stage?: 'beforeIncome' | 'afterIncome';
} = {}) {
  const advanced = options.advanced ?? false, withBG = options.bg ?? false, stage = options.stage ?? 'beforeIncome';
  const providerKarama = options.providerKarama ?? withBG;
  assert.ok(!withBG || advanced, 'The bounded wealthy BG claim source uses its native Advanced rule');
  const asker = 'harkonnen', observer = 'atreides', target = 'choam', recipient = asker, bg = withBG ? 'beneGesserit' : null;
  let game = createGame('TRUTHCHOAMINCOME', newPlayer(asker, 'Harkonnen', 'harkonnen'), advanced, ['ix', 'choam']);
  joinGame(game, newPlayer(observer, 'Atreides', 'atreides')); joinGame(game, newPlayer(target, 'CHOAM', 'choam'));
  if (bg) joinGame(game, newPlayer(bg, 'Bene Gesserit', 'beneGesserit'));
  const initial = structuredClone(game), actions: TruthChoamIncomeStep[] = [];
  const act = (actor: string, action: Action) => { game = actTruthChoamIncome(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceTruthChoamIncome(game, until, actions, true); };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game); act(game.host, advanced ? { type: 'start', advancedPreview: true } : { type: 'start' });
  const setup = structuredClone(game); assert.equal(game.status, 'setup'); assert.ok(game.players.every(player => !player.hand.length));
  if (bg) act(bg, { type: 'predict', faction: 'harkonnen', turn: 10 });
  const originalCards = truthChoamIncomeInventory(game), originalTraitors = truthChoamIncomeTraitors(game), originalSpice = truthChoamIncomeSpice(game);
  assert.deepEqual(originalCards, treacheryDeck(['ix', 'choam']).map(card => card.id).sort());
  assert.deepEqual(originalTraitors, traitorDeck(game.players, true).sort());
  const truths = game.deck.filter(card => card.effect === 'truthtrance'); assert.equal(truths.length, 2);
  const karama = game.deck.find(card => card.effect === 'karama'); assert.ok(karama);
  const providerCard = providerKarama ? game.deck.find(card => card.effect === 'karama' && card.id !== karama.id) : null;
  assert.ok(!providerKarama || providerCard, 'Select only the second physical printed Karama already in the unopened original deck');
  // Native dealStartingTreachery deals H two, A one, then CHOAM one: index3.
  const dealOrder = [...truths.map(card => card.id), karama.id, ...(providerCard ? [providerCard.id] : [])].map((id, position) => {
    const from = game.deck.findIndex(card => card.id === id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]]; return { position, from, card: id };
  });
  const beforeStartingDeal = structuredClone(game); reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game), startCash = truthChoamIncomePlayer(game, target).spice;
  const startingChoamCards = truthChoamIncomePlayer(game, target).hand.map(card => card.id);
  assert.equal(startCash, 2); assert.deepEqual(truthChoamIncomePlayer(game, asker).hand.map(card => card.id), truths.map(card => card.id));
  assert.ok(truthChoamIncomePlayer(game, observer).hand.some(card => card.id === karama.id));
  if (providerCard) assert.deepEqual(startingChoamCards, [providerCard.id]);
  reach(beforeIxSpiceDraw);
  const beforeIncome = structuredClone(game), beforeIncomeActions = structuredClone(actions);
  const spiceOrder = orderIxSpiceCards(game, [{ territory: 'hagga_basin' }, ...(advanced ? [{ territory: 'broken_land' }] : [])]);
  const incomeAmount = choamOpeningIncome(game, truthChoamIncomePlayer(game, target));
  assert.equal(game.choamCharity?.turn === game.turn, false); assert.notEqual(truthChoamIncomePlayer(game, target).charityTurn, game.turn);
  let income: { before: Game; steps: TruthChoamIncomeStep[]; after: Game } | null = null;
  if (stage === 'afterIncome') {
    game = reachTruthChoamIncomeResponse(game, actions); const before = structuredClone(game), from = actions.length;
    game = allowTruthChoamIncome(game, actions); income = { before, steps: structuredClone(actions.slice(from)), after: structuredClone(game) };
    assert.deepEqual(game.choamCharity, { turn: game.turn, canceled: false });
    assert.equal(truthChoamIncomePlayer(game, target).spice, startCash + incomeAmount);
  }
  assert.equal(truthChoamIncomePlayer(game, target).spice, startCash + (stage === 'afterIncome' ? incomeAmount : 0));
  assert.notEqual(truthChoamIncomePlayer(game, target).charityTurn, game.turn);
  assert.deepEqual(truthChoamIncomePlayer(game, target).hand.map(card => card.id), startingChoamCards);
  assert.deepEqual(truthChoamIncomeInventory(game), originalCards); assert.deepEqual(truthChoamIncomeTraitors(game), originalTraitors);
  assert.deepEqual(truthChoamIncomeSpice(game), originalSpice);
  const minimum = startCash + incomeAmount, maximum = minimum + 2;
  const spiceFact = { kind: 'spice', compare: 'eq', value: truthChoamIncomePlayer(game, target).spice } as const;
  const question: TruthQuestion = { kind: 'turnActions', target, turn: game.turn,
    mixed: truthChoamIncomeGroup('and', truthChoamIncomeFact(spiceFact), truthChoamIncomePayment(recipient, minimum)) };
  return { game, initial, lobby, setup, beforeStartingDeal, afterSetup, beforeIncome, beforeIncomeActions,
    asker, target, recipient, observer, bg, advanced, stage, providerKarama, providerCard: providerCard?.id ?? null,
    startCash, incomeAmount, minimum, maximum,
    startingChoamCards, truths: truths.map(card => card.id), truth: truths[0].id, karama: karama.id, question, spiceFact,
    payment: { type: 'bribe', target: recipient, amount: minimum } satisfies Action,
    charity: { type: 'charity' } satisfies Action,
    cancel: { type: 'card', card: karama.id, mode: 'cancel' } satisfies Action,
    dealOrder, spiceOrder, income, originalCards, originalTraitors, originalSpice,
    actions, sourceActions: actions, sourceActionCount: actions.length,
    sourceCounts: { selected: actions.length, beforeIncome: beforeIncomeActions.length, actualIncomeResponse: income?.steps.length ?? 0 },
    sourceDisclosure: 'Genuine public Harkonnen/Atreides/CHOAM selected-Ix/CHOAM setup, with optional original Advanced BG prediction and advisor setup. ' +
      'Only original H Truths, A printed Karama and optionally the second original printed Karama in CHOAM native deal slot3, safe unopened Spice positions and scalar lotteries are selected; BG retains its normal native card. ' +
      'Native first Storm, closing market passes and Amal-opening passes reach original phase1 before the first real reveal. Any allowed opening receipt follows the actual phase2 counter-response passes. ' +
      'Forecast assertions are bounded to current cash, the one original automatic CHOAM opening receipt and one unused ordinary Charity claim. Later held-card market sales, collection, gifts and foreign choices are not forecast or claimed globally impossible. No hand, purse, army, phase, pass list, receipt or claim marker is installed. Counts derive from actual action arrays.',
  };
}
export type TruthChoamIncomeFixture = ReturnType<typeof createTruthChoamIncomeFixture>;
export function truthChoamIncomeQuestion(f: TruthChoamIncomeFixture, kind: TruthChoamIncomeKind,
  minimum = f.minimum, recipient = f.recipient): TruthQuestion {
  if (kind === 'bribe') return { kind, target: f.target, turn: f.game.turn, recipient, minimum };
  if (kind === 'bribeExpression') return { kind, target: f.target, turn: f.game.turn, claim: { kind: 'payment', recipient, minimum } };
  if (kind === 'mixedBribe') return { kind, target: f.target, turn: f.game.turn, mixed: { kind: 'and', terms: [
    { kind: 'fact', fact: f.spiceFact }, { kind: 'action', action: { recipient, minimum } },
  ] } };
  return { kind, target: f.target, turn: f.game.turn,
    mixed: truthChoamIncomeGroup('and', truthChoamIncomeFact(f.spiceFact), truthChoamIncomePayment(recipient, minimum)) };
}
export function declareTruthChoamIncome(f: TruthChoamIncomeFixture, source = f.game, copy: 0 | 1 = 0, actions: TruthChoamIncomeStep[] = []) {
  let game = actTruthChoamIncome(source, f.asker, { type: 'card', card: f.truths[copy] }, actions);
  while (game.truthtrance?.stage === 'priority') {
    const actor = game.players.find(player => !game.truthtrance!.passed.includes(player.id)); assert.ok(actor);
    game = actTruthChoamIncome(game, actor.id, { type: 'truthPass' }, actions);
  }
  assert.equal(game.truthtrance?.stage, 'ask'); return { game, actions };
}
export function askTruthChoamIncome(game: Game, asker: string, question: TruthQuestion, actions: TruthChoamIncomeStep[] = []): Game {
  return actTruthChoamIncome(game, asker, { type: 'truthAsk', question: structuredClone(question) }, actions);
}
export function answerTruthChoamIncome(game: Game, target: string, answer: 'yes' | 'no' | 'unknown', actions: TruthChoamIncomeStep[] = []): Game {
  return actTruthChoamIncome(game, target, { type: 'truthAnswer', answer }, actions);
}
export function bindTruthChoamIncome(f: TruthChoamIncomeFixture, answer: 'yes' | 'no' = 'yes', question: TruthQuestion = f.question,
  source = f.game, copy: 0 | 1 = 0, actions: TruthChoamIncomeStep[] = []) {
  const declared = declareTruthChoamIncome(f, source, copy, actions), asked = askTruthChoamIncome(declared.game, f.asker, question, actions);
  return { game: answerTruthChoamIncome(asked, f.target, answer, actions), declared, asked, actions };
}
