import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import type { MixedActionExpression } from '../game/mixed-action-question';
import type { OrnithopterMode } from '../game/ornithopter';
import { residualPoisonCandidates } from '../game/residual-poison';
import { richeseCards } from '../game/richese-cards';
import type { TruthFact, TruthQuestion } from '../game/truthtrance';
import { actResidualPoisonCapture } from './fixture-residual-poison-capture';
import { ornithopterHajrMove } from './fixture-ornithopter-hajr';
import { nextRicheseStrongholdsNativeStep } from './fixture-richese-strongholds';
import { truthTurnThumperSpice, truthTurnThumperTraitors } from './fixture-truth-turn-thumper';

export type TruthFlightPoisonEffect = 'ornithopter' | 'residualPoison';
export type TruthFlightPoisonLeaf = { kind: 'cardPlay'; effect: TruthFlightPoisonEffect } |
  { kind: 'payment'; recipient: string; minimum: number };
export type TruthFlightPoisonExpression = MixedActionExpression<TruthFlightPoisonLeaf>;
export type TruthFlightPoisonStep = { actor: string; action: Action };
export const actTruthFlightPoison = actResidualPoisonCapture;
export const truthFlightPoisonPlayer = (game: Game, actor: string) => {
  const player = game.players.find(candidate => candidate.id === actor); assert.ok(player); return player;
};
export const truthFlightPoisonClean = (game: Game) => !game.phaseOpening && !game.response && !game.decision &&
  !game.truthtrance && !game.pendingTreacheryDiscard && !game.pendingNullentropy && !game.pendingShipment && !game.currentAuctionSale;
export const truthFlightPoisonSpice = truthTurnThumperSpice;
export const truthFlightPoisonTraitors = truthTurnThumperTraitors;
/** An active physical flight is the card's real table slot until disposal. */
export function truthFlightPoisonInventory(game: Game) {
  const ids = [...game.deck, ...game.discard, ...(game.richeseCache ?? []), ...(game.richeseRemoved ?? []),
    ...game.players.flatMap(player => player.hand), ...(game.ornithopter ? [game.ornithopter.card] : []),
    ...(game.auction?.cards.slice(game.auction.index + Number(game.currentAuctionSale?.origin === 'normal')) ?? [])]
    .map(card => card.id).sort();
  assert.equal(new Set(ids).size, ids.length, 'Every original Treachery Card has one actual physical slot'); return ids;
}
export const truthFlightPoisonUse = (effect: TruthFlightPoisonEffect): TruthFlightPoisonExpression => ({ kind: 'action', action: { kind: 'cardPlay', effect } });
export const truthFlightPoisonFact = (fact: TruthFact): TruthFlightPoisonExpression => ({ kind: 'fact', fact });
export const truthFlightPoisonPayment = (recipient: string, minimum = 2): TruthFlightPoisonExpression =>
  ({ kind: 'action', action: { kind: 'payment', recipient, minimum } });
export const truthFlightPoisonGroup = (kind: 'and' | 'or', ...terms: TruthFlightPoisonExpression[]): TruthFlightPoisonExpression => ({ kind, terms });

export function nextTruthFlightPoisonNative(game: Game): TruthFlightPoisonStep | null {
  if (game.truthtrance || game.pendingNullentropy) return null;
  if (game.pendingTreacheryDiscard) return nextRicheseStrongholdsNativeStep(game);
  if (truthFlightPoisonClean(game) && game.battle?.preparation?.kind === 'prescience')
    return { actor: game.battle.preparation.owner, action: { type: 'declineBattlePower' } };
  if (!game.response && !game.phaseOpening && game.decision?.kind === 'guildTiming')
    return { actor: game.decision.player, action: { type: 'decision', take: false } };
  return nextRicheseStrongholdsNativeStep(game);
}
export function advanceTruthFlightPoison(game: Game, until: (state: Game) => boolean,
  actions: TruthFlightPoisonStep[] = []): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original flight/Poison source ended before its requested boundary');
    const step = nextTruthFlightPoisonNative(game); assert.ok(step, 'Supply the actual Truth, private selection or native Battle Plan');
    game = actTruthFlightPoison(game, step.actor, step.action, actions);
  }
  throw Error('The original flight/Poison source did not reach its finite boundary');
}
export function settleTruthFlightPoison(game: Game, actions: TruthFlightPoisonStep[] = []): Game {
  return advanceTruthFlightPoison(game, truthFlightPoisonClean, actions);
}
export function finishTruthFlightPoison(game: Game, actions: TruthFlightPoisonStep[] = []): Game {
  const turn = game.turn;
  return advanceTruthFlightPoison(game, state => state.turn === turn + 1, actions);
}

/** Fresh bare R/A/E/G original setup in its actual requested mode. Native
 * cache1 acquisition, funded physical shipment and real battle preparation
 * supply every current role; no Nexus/profile is removed from a played game. */
export function createTruthFlightPoisonFixture(options: { effect?: TruthFlightPoisonEffect; advanced?: boolean } = {}) {
  const effect = options.effect ?? 'ornithopter', advanced = options.advanced ?? false;
  const target = effect === 'ornithopter' ? 'emperor' : 'atreides', asker = 'richese', recipient = asker;
  const canonical = richeseCards().find(card => card.effect === effect); assert.ok(canonical); const card = canonical.id;
  let game = createGame('TRUTHFLIGHTPOISON', newPlayer('richese', 'Richese', 'richese'), advanced, ['choam']);
  for (const faction of ['atreides', 'emperor', 'guild'] as const) joinGame(game, newPlayer(faction, faction, faction));
  const initial = structuredClone(game), actions: TruthFlightPoisonStep[] = [];
  const act = (actor: string, action: Action) => { game = actTruthFlightPoison(game, actor, action, actions); };
  const sourceStep = (state: Game) => {
    if (!state.response && !state.phaseOpening && !state.pendingTreacheryDiscard) {
      if (state.decision?.kind === 'richeseCache' && state.richeseCache?.some(held => held.id === card))
        return { actor: state.decision.player, action: { type: 'decision', event: state.richeseBidding!.event,
          card, method: 'onceAround', direction: 'counterclockwise' } satisfies Action };
      const lot = state.richeseAuction;
      if (truthFlightPoisonClean(state) && lot?.cardId === card && !lot.outcome && lot.active === target && lot.bid === 0)
        return { actor: target, action: { type: 'richeseBid', event: lot.event, amount: 1, allyPayment: 0 } satisfies Action };
    }
    return nextTruthFlightPoisonNative(state);
  };
  const reach = (until: (state: Game) => boolean) => {
    for (let count = 0; count < 1800; count++) {
      if (until(game)) return;
      const step = sourceStep(game); assert.ok(step); act(step.actor, step.action);
    }
    throw Error('The actual cache acquisition/source boundary must be reached finitely');
  };
  for (const player of game.players) act(player.id, { type: 'ready' }); const lobby = structuredClone(game);
  act(game.host, advanced ? { type: 'start', advancedPreview: true } : { type: 'start' });
  const setup = structuredClone(game); assert.equal(game.status, 'setup'); assert.ok(game.players.every(player => player.hand.length === 0));
  const originalCards = truthFlightPoisonInventory(game), originalSpice = truthFlightPoisonSpice(game), originalTraitors = truthFlightPoisonTraitors(game);
  const startingTruthSelection = ['richese', 'guild'].map(actor => {
    const position = game.players.findIndex(player => player.id === actor);
    const from = game.deck.findIndex((held, index) => index >= position && held.effect === 'truthtrance'); assert.ok(from >= position);
    const truth = game.deck[from].id; [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { actor, position, from, card: truth };
  });
  const beforeStartingDeal = structuredClone(game); reach(state => state.status === 'playing'); const afterSetup = structuredClone(game);
  const front: Game['spiceDeck'] = [];
  for (let count = 0; count < (advanced ? 2 : 1); count++) {
    const at = game.spiceDeck.findIndex(held => 'territory' in held && !held.discovery); assert.ok(at >= 0);
    front.push(game.spiceDeck.splice(at, 1)[0]);
  }
  game.spiceDeck.unshift(...front);
  reach(state => state.decision?.kind === 'richeseCache'); const beforePurchase = structuredClone(game), purchaseAt = actions.length;
  reach(state => truthFlightPoisonPlayer(state, target).hand.some(held => held.id === card) && truthFlightPoisonClean(state));
  const acquisition = { before: beforePurchase, steps: structuredClone(actions.slice(purchaseAt)), after: structuredClone(game) };
  assert.equal(truthFlightPoisonPlayer(beforePurchase, target).spice - truthFlightPoisonPlayer(game, target).spice, 1);
  const shipper = effect === 'ornithopter' ? target : asker, place = effect === 'ornithopter' ? 'imperial_basin' : 'arrakeen';
  const sector = effect === 'ornithopter' ? 9 : 10, amount = effect === 'ornithopter' ? 2 : 1;
  reach(state => state.phase === 5 && state.active === shipper && truthFlightPoisonClean(state));
  const beforeShipment = structuredClone(game), shipmentAt = actions.length;
  const shipmentStep: TruthFlightPoisonStep = { actor: shipper, action: { type: 'ship', territory: place, sector, amount, elite: 0, allyPayment: 0 } };
  act(shipper, shipmentStep.action); reach(truthFlightPoisonClean);
  const shipment = { before: beforeShipment, step: shipmentStep, steps: structuredClone(actions.slice(shipmentAt)), after: structuredClone(game) };
  assert.equal(truthFlightPoisonPlayer(beforeShipment, shipper).spice - truthFlightPoisonPlayer(game, shipper).spice, effect === 'ornithopter' ? 4 : 1);
  let choice: TruthFlightPoisonStep | null = null;
  if (effect === 'residualPoison') {
    reach(state => state.phase === 6 && truthFlightPoisonClean(state));
    const actual = viewGame(game, game.active!).battleChoices.find(battle => battle.territory === 'arrakeen'); assert.ok(actual);
    choice = { actor: actual.chooser, action: { type: 'chooseBattle', territory: 'arrakeen', target: actual.chooser === target ? asker : target } };
    act(choice.actor, choice.action);
    reach(state => !!state.battle?.preLeader && !state.battle.preLeader.closed && !state.battle.preparation && truthFlightPoisonClean(state));
    assert.deepEqual(game.battle!.plans, {}); assert.ok(residualPoisonCandidates(truthFlightPoisonPlayer(game, asker).leaders, 'arrakeen').length > 1);
    const quote = viewGame(game, target).residualPoison; assert.ok(quote && !quote.blocked && quote.target === asker);
  }
  assert.ok(truthFlightPoisonClean(game)); assert.equal(!!game.semutaPreview, !advanced);
  assert.ok(!game.nexusCards && !game.homeworlds && !game.leaderSkills && !game.techTokens && !game.strongholdCards);
  assert.deepEqual(truthFlightPoisonInventory(game), originalCards); assert.deepEqual(truthFlightPoisonSpice(game), originalSpice);
  assert.deepEqual(truthFlightPoisonTraitors(game), originalTraitors); assert.equal(game.turnActionPromises?.length ?? 0, 0);
  const truths = startingTruthSelection.map(row => row.card), truthHolders = startingTruthSelection.map(row => row.actor);
  for (const [index, truth] of truths.entries()) assert.ok(truthFlightPoisonPlayer(game, truthHolders[index]).hand.some(held => held.id === truth));
  const spiceFact: TruthFact = { kind: 'spice', compare: 'eq', value: truthFlightPoisonPlayer(game, target).spice };
  const mixed = truthFlightPoisonGroup('and', truthFlightPoisonUse(effect), truthFlightPoisonPayment(recipient));
  const question: TruthQuestion = { kind: 'turnActions', target, turn: game.turn, mixed };
  return { game, source: structuredClone(game), effect, advanced, target, asker, recipient, card, truth: truths[0], truths, truthHolders,
    initial, lobby, setup, beforeStartingDeal, startingTruthSelection, afterSetup, spiceOrder: structuredClone(front), acquisition, shipment, choice,
    origin: effect === 'ornithopter' ? 'imperial_basin:9' : null, poisonTarget: effect === 'residualPoison' ? asker : null,
    event: game.battle?.event ?? null, spiceFact, mixed, question, originalCards, originalSpice, originalTraitors,
    actions, sourceActions: actions, sourceActionCount: actions.length,
    sourceCounts: { selected: actions.length, nativeCacheBids: actions.filter(step => step.actor === target && step.action.type === 'richeseBid' && step.action.amount === 1).length,
      acquisition: acquisition.steps.length, shipment: shipment.steps.length },
    payment: { type: 'bribe', target: recipient, amount: 2 } satisfies Action,
    end: { type: 'endMovement' } satisfies Action,
    sourceDisclosure: 'Genuine public bare Richese/Atreides/Emperor/Guild selected-CHOAM setup in its original Basic or Advanced preview mode. ' +
      'Only two original unopened Richese/Guild Truth deals, original unopened first-turn land Spice positions and scalar lotteries are selected. ' +
      'The holder actually buys its canonical cache card for1. ' + (effect === 'ornithopter'
      ? 'Emperor actually pays4 to ship two ordinary counters to Imperial Basin, retaining5 and its unused ground movement. '
      : 'Richese actually pays1 to ship one original counter into original Atreides10 in Arrakeen; actual chooseBattle and native preparation create the preleader window while Atreides retains9. ') +
      'Basic retains its original Semuta marker and native discard passes. No module, mode, played hand, wallet, army, battle, victim, movement, clock or receipt is installed. Source counts derive from actual arrays.',
  };
}
export type TruthFlightPoisonFixture = ReturnType<typeof createTruthFlightPoisonFixture>;
export function declareTruthFlightPoison(f: TruthFlightPoisonFixture, source = f.game, copy: 0 | 1 = 0, actions: TruthFlightPoisonStep[] = []) {
  const asker = f.truthHolders[copy]; let game = actTruthFlightPoison(source, asker, { type: 'card', card: f.truths[copy] }, actions);
  while (game.truthtrance?.stage === 'priority') {
    const actor = game.players.find(player => !game.truthtrance!.passed.includes(player.id)); assert.ok(actor);
    game = actTruthFlightPoison(game, actor.id, { type: 'truthPass' }, actions);
  }
  assert.equal(game.truthtrance?.stage, 'ask'); return { game, asker, actions };
}
export function askTruthFlightPoison(game: Game, asker: string, question: TruthQuestion, actions: TruthFlightPoisonStep[] = []): Game {
  return actTruthFlightPoison(game, asker, { type: 'truthAsk', question: structuredClone(question) }, actions);
}
export function answerTruthFlightPoison(game: Game, target: string, answer: 'yes' | 'no', actions: TruthFlightPoisonStep[] = []): Game {
  return actTruthFlightPoison(game, target, { type: 'truthAnswer', answer }, actions);
}
export function bindTruthFlightPoison(f: TruthFlightPoisonFixture, answer: 'yes' | 'no' = 'yes', question: TruthQuestion = f.question,
  source = f.game, copy: 0 | 1 = 0, actions: TruthFlightPoisonStep[] = []) {
  const declared = declareTruthFlightPoison(f, source, copy, actions), asked = askTruthFlightPoison(declared.game, declared.asker, question, actions);
  return { game: answerTruthFlightPoison(asked, f.target, answer, actions), declared, asked, actions };
}
export function truthFlightPoisonPromise(game: Game, target = game.turnActionPromises?.[0]?.player ?? game.players[0].id) {
  const row = viewGame(game, target).turnActionPromises.findLast(promise => promise.player === target); assert.ok(row); return row;
}
export function truthFlightPoisonMove(game: Game, f: TruthFlightPoisonFixture, mode?: OrnithopterMode, from = f.origin!): Action {
  assert.equal(f.effect, 'ornithopter');
  return ornithopterHajrMove(game, from, { ...(mode ? { mode } : {}), range: mode === 'range3' ? 3 : 1, elite: 0 });
}
export function truthFlightPoisonAction(game: Game, f: TruthFlightPoisonFixture): Action {
  assert.equal(f.effect, 'residualPoison'); const quote = viewGame(game, f.target).residualPoison;
  assert.ok(quote && !quote.blocked && quote.event && quote.target);
  return { type: 'card', card: quote.card.id, target: quote.target, event: quote.event };
}
export function closeTruthFlightPoisonPreparation(game: Game, actions: TruthFlightPoisonStep[] = []): Game {
  assert.ok(game.battle?.preLeader);
  for (const actor of [game.battle.attacker, game.battle.defender]) {
    if (!game.battle!.preLeader!.ready.includes(actor) && !game.battle!.preLeader!.closed)
      game = actTruthFlightPoison(game, actor, { type: 'battlePreparationReady', event: game.battle!.preLeader!.event }, actions);
  }
  assert.equal(game.battle!.preLeader!.closed, true); return game;
}
export function finishTruthFlightPoisonBattle(f: TruthFlightPoisonFixture, source: Game, actions: TruthFlightPoisonStep[] = []) {
  assert.equal(f.effect, 'residualPoison'); let game = settleTruthFlightPoison(source, actions);
  game = closeTruthFlightPoisonPreparation(game, actions);
  const plans: TruthFlightPoisonStep[] = [];
  for (const actor of [game.battle!.attacker, game.battle!.defender]) {
    if (game.battle!.plans[actor]) continue;
    const candidates = residualPoisonCandidates(truthFlightPoisonPlayer(game, actor).leaders, game.battle!.territory)
      .sort((a, b) => actor === f.target ? b.strength - a.strength : a.strength - b.strength);
    assert.ok(candidates[0]); const step: TruthFlightPoisonStep = { actor, action: { type: 'battlePlan', leader: candidates[0].id, dial: 0, support: 0 } };
    game = actTruthFlightPoison(game, actor, step.action, actions); plans.push(step);
  }
  game = advanceTruthFlightPoison(game, state => !state.battle && truthFlightPoisonClean(state), actions);
  return { game, plans, actions };
}
