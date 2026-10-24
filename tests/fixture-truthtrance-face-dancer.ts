import assert from 'node:assert/strict';
import { applyAction, createGame, joinGame, newPlayer, type Action, type Game } from '../game/engine';
import { CHEAP_HERO_TRAITOR } from '../game/traitors';
import { nextRicheseStrongholdsNativeStep } from './fixture-richese-strongholds';

export type TruthFaceDancerStep = { actor: string; action: Action };
export type TruthFaceDancerTransition = { before: Game; steps: TruthFaceDancerStep[]; after: Game };
type TruthFaceDancerSource = {
  respondent: string; target: string; originalInventory: string[]; originalTraitors: string[];
};
export const truthFaceDancerPlayer = (game: Game, id: string) => {
  const player = game.players.find(player => player.id === id); assert.ok(player); return player;
};
export const truthFaceDancerClean = (game: Game) => !game.phaseOpening && !game.response &&
  !game.decision && !game.truthtrance && !game.pendingTreacheryDiscard && !game.pendingRevival;
export const truthFaceDancerInventory = (game: Game) => {
  const cards = [...game.deck, ...game.discard, ...game.players.flatMap(player => player.hand),
    ...(game.auction?.cards.slice(game.auction.index + (game.currentAuctionSale ? 1 : 0)) ?? [])];
  const ids = cards.map(card => card.id).sort();
  assert.equal(new Set(ids).size, ids.length, 'Original physical Treachery Cards retain distinct current slots');
  return ids;
};
export const truthFaceDancerTraitors = (game: Game) => {
  const ids = [...(game.traitorReserve ?? []), ...game.players.flatMap(player =>
    [...player.traitors, ...player.traitorChoices, ...(player.faceDancers ?? []).map(card => card.leader)])];
  assert.equal(new Set(ids).size, ids.length, 'Each original physical Traitor/Face Dancer card has one current slot');
  return ids.sort();
};

/** Original scalar shuffle choices only. UUIDs and every other native byte
 * entropy source stay unchanged; no live hand or Face Dancer status is set. */
function originalScalarOrder<T>(run: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const original = crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array && array.length === 1) array[0] = 0xffffffff;
    else Reflect.apply(original, crypto, [array]);
    return array;
  };
  try { return run(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}
export function actTruthFaceDancer(game: Game, actor: string, action: Action,
  actions: TruthFaceDancerStep[] = []): Game {
  const next = originalScalarOrder(() => applyAction(game, actor, action));
  actions.push({ actor, action: structuredClone(action) }); return next;
}
/** Native phase/setup/response controls only. The original question remains
 * caller-owned, and no optional Face Dancer replacement is silently selected. */
export function nextTruthFaceDancer(game: Game): TruthFaceDancerStep | null {
  if (game.truthtrance) return null;
  return nextRicheseStrongholdsNativeStep(game);
}
export function advanceTruthFaceDancer(game: Game, until: (state: Game) => boolean,
  actions: TruthFaceDancerStep[] = []): Game {
  for (let count = 0; count < 1400; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The genuine Face Dancer question chronology ended before its requested boundary');
    const next = nextTruthFaceDancer(game);
    assert.ok(next, `Choose the original question or private plan at ${game.turn}/${game.phase}/${game.truthtrance?.stage ?? game.decision?.kind}`);
    game = actTruthFaceDancer(game, next.actor, next.action, actions);
  }
  throw Error('The native Face Dancer question chronology did not reach its finite boundary');
}
export function passTruthFaceDancerResponses(game: Game, actions: TruthFaceDancerStep[] = []): Game {
  for (let count = 0; game.response && count < 60; count++) {
    const actor = game.players.find(player => !game.response!.passed.includes(player.id)); assert.ok(actor);
    game = actTruthFaceDancer(game, actor.id, { type: 'passResponse' }, actions);
  }
  assert.ok(!game.response); return game;
}
export function passTruthFaceDancerPriority(game: Game, actions: TruthFaceDancerStep[] = []): Game {
  for (let count = 0; game.truthtrance?.stage === 'priority' && count < 60; count++) {
    const actor = game.players.find(player => !game.truthtrance!.passed.includes(player.id)); assert.ok(actor);
    game = actTruthFaceDancer(game, actor.id, { type: 'truthPass' }, actions);
  }
  assert.equal(game.truthtrance?.stage, 'ask'); return game;
}

/** Public three-seat E1 Basic/Advanced setup, actual private Traitor choices,
 * original native Face Dancer deal and first Storm/Spice. Stop at clean Charity
 * with the original starting Truthtrance still physically held by Atreides. */
export function createTruthtranceFaceDancerFixture(options: { advanced?: boolean; replaced?: boolean } = {}) {
  const advanced = options.advanced ?? false, respondent = 'tleilaxu', asker = 'atreides', observer = 'emperor';
  let game = createGame('TRUTHTRANCEFACEDANCER', newPlayer(respondent, 'Tleilaxu', 'tleilaxu'), advanced, ['ix']);
  joinGame(game, newPlayer(asker, 'Atreides', 'atreides'));
  joinGame(game, newPlayer(observer, 'Emperor', 'emperor'));
  const initial = structuredClone(game), actions: TruthFaceDancerStep[] = [];
  const act = (actor: string, action: Action) => { game = actTruthFaceDancer(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceTruthFaceDancer(game, until, actions); };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game); act(game.host, advanced ? { type: 'start', advancedPreview: true } : { type: 'start' });
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, advanced);
  assert.ok(!game.homeworlds && !game.nexusCards && !game.leaderSkills && !game.techTokens &&
    !game.strongholdCards && !game.discoveryEnabled && !game.ecazTreachery);
  assert.ok(game.players.every(player => player.hand.length === 0));
  assert.ok(!truthFaceDancerPlayer(game, respondent).faceDancers);
  const originalInventory = truthFaceDancerInventory(game), originalTraitors = truthFaceDancerTraitors(game);
  const truth = game.deck.find(card => card.effect === 'truthtrance'); assert.ok(truth);
  const ordinary = game.deck.filter(card => ['projectile', 'poison', 'shield', 'snooper'].includes(card.kind)).slice(0, 2);
  assert.equal(ordinary.length, 2);
  const selected = [ordinary[0], truth, ordinary[1]];
  const dealOrder = selected.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card.id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: card.id };
  });
  const beforeStartingDeal = structuredClone(game);
  let faceDancerDeal: TruthFaceDancerTransition | null = null;
  for (let count = 0; game.status === 'setup' && count < 100; count++) {
    const next = nextTruthFaceDancer(game); assert.ok(next);
    const before = structuredClone(game), hadDancers = !!truthFaceDancerPlayer(game, respondent).faceDancers;
    act(next.actor, next.action);
    if (!hadDancers && truthFaceDancerPlayer(game, respondent).faceDancers)
      faceDancerDeal = { before, steps: [structuredClone(next)], after: structuredClone(game) };
  }
  assert.equal(game.status, 'playing'); assert.ok(faceDancerDeal);
  const afterSetup = structuredClone(game);
  assert.deepEqual(game.players.flatMap(player => player.hand.map(card => card.id)), selected.map(card => card.id));
  assert.deepEqual(truthFaceDancerPlayer(game, respondent).traitors, []);
  const cards = structuredClone(truthFaceDancerPlayer(game, respondent).faceDancers!);
  assert.equal(cards.length, 3); assert.ok(cards.every(card => !card.revealed));
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder = [0, 1].map(position => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery);
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0];
    game.spiceDeck.splice(position, 0, card); return { position, from, card: structuredClone(card) };
  });
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  reach(state => state.turn === 1 && state.phase === 2 && truthFaceDancerClean(state));
  assert.ok(truthFaceDancerPlayer(game, asker).hand.some(card => card.id === truth.id));
  assert.deepEqual(truthFaceDancerPlayer(game, respondent).faceDancers, cards);
  assert.deepEqual(truthFaceDancerInventory(game), originalInventory);
  assert.deepEqual(truthFaceDancerTraitors(game), originalTraitors);
  const heldIDs = cards.map(card => card.leader), canonical = [...game.players.flatMap(player => player.leaders.map(leader => leader.id)), CHEAP_HERO_TRAITOR];
  const notHeld = canonical.find(leader => !heldIDs.includes(leader)); assert.ok(notHeld);
  const target = heldIDs[0], fact = { kind: 'faceDancer', leader: target };
  const declaration: Action = { type: 'card', card: truth.id };
  const questionAction: Action = { type: 'truthAsk', question: { kind: 'fact', target: respondent, fact } };
  const fixture = { game, source: structuredClone(game), initial, lobby, setup, beforeStartingDeal, afterSetup, faceDancerDeal,
    owner: asker, asker, respondent, observer, truth: truth.id, card: truth.id, cards, held: target, heldIDs,
    notHeld, unheld: notHeld, canonical, hero: CHEAP_HERO_TRAITOR,
    cheapHero: CHEAP_HERO_TRAITOR, cheapHeroHeld: heldIDs.includes(CHEAP_HERO_TRAITOR), target,
    fact, declaration, questionAction, action: questionAction, advanced,
    actions, sourceActionCount: actions.length, inventory: originalInventory,
    originalInventory, originalTraitors, originalSpice, dealOrder, spiceOrder,
    staging: [
      'Actual public native Tleilaxu/Atreides/Emperor ready/start and private Traitor choices. Advanced uses the original explicit preview action; no played Basic state is converted.',
      'Select only original scalar shuffle order and three original unopened Treachery positions. Atreides is physically dealt its original starting Truthtrance. Tleilaxu receives its original three Face Dancer cards through actual finishSetup after the other seats choose their Traitors; no Face Dancer card/status or played hand is assigned.',
      'Order two original unopened ordinary Spice positions and actually complete first Storm and native Spice controls to clean Charity. Basic uses one blow and Advanced uses both; neither original question card nor Face Dancer has been used.',
      'Stop before declaration/question. Held, canonical not-held and Cheap Hero identities are read from original current custody. No army, wallet, phase, forecast, revealed flag, answer, receipt or ownership is installed.',
    ],
  };
  const prefixActionCount = actions.length;
  const replacement = options.replaced ? replaceTruthtranceFaceDancer(game, fixture, actions) : null;
  const current = replacement?.game ?? game;
  const currentCards = replacement?.cardsAfter ?? cards;
  const currentTarget = replacement?.new ?? target;
  const currentFact = { kind: 'faceDancer', leader: currentTarget };
  const currentQuestion: Action = { type: 'truthAsk', question: { kind: 'fact', target: respondent, fact: currentFact } };
  return { ...fixture, game: current, beforeQuestion: structuredClone(current),
    cards: currentCards, held: currentTarget, heldIDs: currentCards.map(card => card.leader),
    target: currentTarget, fact: currentFact, questionAction: currentQuestion, action: currentQuestion,
    unheld: replacement?.old ?? notHeld, notHeld: replacement?.old ?? notHeld,
    cheapHeroHeld: currentCards.some(card => card.leader === CHEAP_HERO_TRAITOR),
    replaced: !!options.replaced, replacement,
    old: replacement?.old ?? null, new: replacement?.new ?? null,
    beforeReplacement: replacement?.before ?? null, afterReplacement: replacement?.after ?? null,
    prefixActionCount, sourceActionCount: actions.length,
    staging: [...fixture.staging, ...(replacement ? [
      'Before using the original starting Truthtrance, actually advance to first Mentat and use native replaceFaceDancer plus its original response. The old/new identities are actual current custody; no card/status or replacement receipt is assigned.',
    ] : [])],
  };
}
export type TruthtranceFaceDancerFixture = ReturnType<typeof createTruthtranceFaceDancerFixture>;

/** Declare the actual held card and finish only its real storm-order priority. */
export function openTruthFaceDancer(source: Game, fixture: TruthtranceFaceDancerFixture,
  actions: TruthFaceDancerStep[] = []): Game {
  assert.ok(truthFaceDancerClean(source));
  let game = actTruthFaceDancer(source, fixture.asker, fixture.declaration, actions);
  game = passTruthFaceDancerPriority(game, actions);
  assert.equal(game.truthtrance?.queue[0].player, fixture.asker); return game;
}
export const openTruthtranceFaceDancer = openTruthFaceDancer;
export function askTruthFaceDancer(source: Game, fixture: TruthtranceFaceDancerFixture,
  leader = fixture.target, actions: TruthFaceDancerStep[] = []): Game {
  const game = source.truthtrance?.stage === 'ask' ? source : openTruthFaceDancer(source, fixture, actions);
  return actTruthFaceDancer(game, fixture.asker, { type: 'truthAsk', question: {
    kind: 'fact', target: fixture.respondent, fact: { kind: 'faceDancer', leader },
  } }, actions);
}
/** A definite actual response disposes of this card once and resumes its parent. */
export function answerTruthFaceDancer(source: Game, fixture: TruthtranceFaceDancerFixture,
  answer: 'yes' | 'no', actions: TruthFaceDancerStep[] = []): Game {
  let game = actTruthFaceDancer(source, fixture.respondent, { type: 'truthAnswer', answer }, actions);
  game = advanceTruthFaceDancer(game, truthFaceDancerClean, actions);
  assert.ok(!game.truthtrance); return game;
}
export function finishTruthtranceFaceDancer(source: Game, actions: TruthFaceDancerStep[] = []): Game {
  return advanceTruthFaceDancer(source, truthFaceDancerClean, actions);
}

/** Optional short native lifecycle branch: leave the original Truthtrance held,
 * reach actual first Mentat and replace one unrevealed Face Dancer normally.
 * The returned old/new cards are facts of that real transfer, not assignments. */
export function replaceTruthtranceFaceDancer(source: Game, fixture: TruthFaceDancerSource,
  actions: TruthFaceDancerStep[] = []) {
  let game = advanceTruthFaceDancer(source, state => state.turn === 1 && state.phase === 8 && truthFaceDancerClean(state), actions);
  const before = structuredClone(game), start = actions.length, old = fixture.target;
  const cardsBefore = structuredClone(truthFaceDancerPlayer(game, fixture.respondent).faceDancers!);
  const slot = cardsBefore.findIndex(card => card.leader === old && !card.revealed); assert.ok(slot >= 0);
  const step: TruthFaceDancerStep = { actor: fixture.respondent, action: { type: 'replaceFaceDancer', leader: old } };
  game = actTruthFaceDancer(game, step.actor, step.action, actions);
  game = passTruthFaceDancerResponses(game, actions);
  const cardsAfter = structuredClone(truthFaceDancerPlayer(game, fixture.respondent).faceDancers!);
  const drawn = cardsAfter[slot].leader;
  assert.equal(truthFaceDancerPlayer(game, fixture.respondent).faceDancerReplacedTurn, 1);
  assert.equal(cardsAfter[slot].revealed, false); assert.notEqual(drawn, old);
  assert.deepEqual(truthFaceDancerInventory(game), fixture.originalInventory);
  assert.deepEqual(truthFaceDancerTraitors(game), fixture.originalTraitors);
  return { game, before, step, after: structuredClone(game), old, new: drawn, drawn, cardsBefore, cardsAfter,
    beforeActionCount: start, steps: structuredClone(actions.slice(start)), sourceActionCount: actions.length };
}
export const replaceTruthFaceDancer = replaceTruthtranceFaceDancer;
