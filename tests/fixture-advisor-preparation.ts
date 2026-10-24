import assert from 'node:assert/strict';
import { applyAction, createGame, joinGame, newPlayer, type Action, type Game } from '../game/engine';
import { nextRicheseStrongholdsNativeStep } from './fixture-richese-strongholds';

export type AdvisorPreparationStep = { actor: string; action: Action };
export type AdvisorPreparationTransition = {
  before: Game; steps: AdvisorPreparationStep[]; after: Game;
};
export const advisorPreparationPlayer = (game: Game, id: string) => {
  const player = game.players.find(player => player.id === id); assert.ok(player); return player;
};
export const advisorPreparationClean = (game: Game) => !game.phaseOpening && !game.response &&
  !game.decision && !game.truthtrance && !game.pendingTreacheryDiscard && !game.pendingRevival;
export const advisorPreparationInventory = (game: Game) => {
  const cards = [...game.deck, ...game.discard, ...game.players.flatMap(player => player.hand),
    ...(game.auction?.cards.slice(game.auction.index + (game.currentAuctionSale ? 1 : 0)) ?? [])];
  const ids = cards.map(card => card.id).sort();
  assert.equal(new Set(ids).size, ids.length, 'Original physical Treachery Cards retain distinct current slots');
  return ids;
};

/** Select original scalar shuffle order only. UUIDs and other byte entropy stay
 * native; no played hand, army, advisor stance, phase or resource is replaced. */
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
export function actAdvisorPreparation(game: Game, actor: string, action: Action,
  actions: AdvisorPreparationStep[] = []): Game {
  const next = originalScalarOrder(() => applyAction(game, actor, action));
  actions.push({ actor, action: structuredClone(action) }); return next;
}
/** Genuine native continuation. The original preparation offer is caller-owned;
 * setup and later accompaniment choices never fabricate a stance. */
export function nextAdvisorPreparationStep(game: Game): AdvisorPreparationStep | null {
  if (!game.phaseOpening && !game.response && !game.pendingTreacheryDiscard) {
    if (game.decision?.kind === 'advisorBattle') return null;
    if (game.status === 'setup' && game.setupStage === 'prediction')
      return { actor: 'beneGesserit', action: { type: 'predict', faction: 'atreides', turn: 10 } };
    if (game.status === 'setup' && game.setupStage === 'forces' &&
        !advisorPreparationPlayer(game, 'beneGesserit').advisorSetup)
      return { actor: 'beneGesserit', action: { type: 'advisorSetup', territory: 'arrakeen', sector: 10 } };
    if (game.decision?.kind === 'advisor' || game.decision?.kind === 'intrusion')
      return { actor: game.decision.player, action: { type: 'decision', accept: false } };
  }
  return nextRicheseStrongholdsNativeStep(game);
}
export function advanceAdvisorPreparation(game: Game, until: (state: Game) => boolean,
  actions: AdvisorPreparationStep[] = []): Game {
  for (let count = 0; count < 1400; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The genuine advisor chronology ended before its requested boundary');
    const next = nextAdvisorPreparationStep(game);
    assert.ok(next, `Choose the original advisor control at ${game.status}/${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = actAdvisorPreparation(game, next.actor, next.action, actions);
  }
  throw Error('The native advisor chronology did not reach its finite boundary');
}
export function passAdvisorPreparationResponses(game: Game,
  actions: AdvisorPreparationStep[] = []): Game {
  for (let count = 0; game.response && count < 60; count++) {
    const actor = game.players.find(player => !game.response!.passed.includes(player.id)); assert.ok(actor);
    game = actAdvisorPreparation(game, actor.id, { type: 'passResponse' }, actions);
  }
  assert.ok(!game.response); return game;
}
export function cloneAdvisorPreparation(game: Game): Game {
  assert.ok(!game.phaseOpening && !game.response && !game.truthtrance && !game.pendingTreacheryDiscard,
    'Clone an original available advisor choice boundary');
  return structuredClone(game);
}

/** Fresh public Advanced setup: prediction, private Traitors, and the actual
 * advisorSetup at occupied Arrakeen. Native first Storm, dual Spice and original
 * later phase controls execute. Stop before any direct preparation or shipment;
 * only original unopened card/Spice positions and scalar shuffles are chosen. */
export function createAdvisorPreparationFixture(options: {
  phase?: 2 | 3 | 4 | 5; declineOffer?: boolean;
} = {}) {
  const phase = options.phase ?? 2, bg = 'beneGesserit', atreides = 'atreides', emperor = 'emperor';
  let game = createGame('ADVISORPREPARATION', newPlayer(bg, 'Bene Gesserit', 'beneGesserit'), true);
  joinGame(game, newPlayer(atreides, 'Atreides', 'atreides'));
  joinGame(game, newPlayer(emperor, 'Emperor', 'emperor'));
  const initial = structuredClone(game), actions: AdvisorPreparationStep[] = [];
  const act = (actor: string, action: Action) => { game = actAdvisorPreparation(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceAdvisorPreparation(game, until, actions); };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game);
  act(game.host, { type: 'start', advancedPreview: true });
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, true);
  assert.ok(!game.homeworlds && !game.nexusCards && !game.leaderSkills && !game.techTokens &&
    !game.strongholdCards && !game.discoveryEnabled && !game.ecazTreachery);
  assert.ok(game.players.every(player => player.hand.length === 0));
  const originalInventory = advisorPreparationInventory(game);
  const ordinary = game.deck.filter(card => ['projectile', 'poison', 'shield', 'snooper'].includes(card.kind)).slice(0, 2);
  const karama = game.deck.find(card => card.effect === 'karama');
  assert.equal(ordinary.length, 2); assert.ok(karama);
  const startingCards = [ordinary[0], ordinary[1], karama];
  const dealOrder = startingCards.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card.id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: card.id };
  });
  const beforeStartingDeal = structuredClone(game);
  let advisorSetup: AdvisorPreparationTransition | null = null;
  for (let count = 0; game.status === 'setup' && count < 100; count++) {
    const next = nextAdvisorPreparationStep(game); assert.ok(next);
    const before = next.action.type === 'advisorSetup' ? structuredClone(game) : null;
    act(next.actor, next.action);
    if (before) advisorSetup = { before, steps: [structuredClone(next)], after: structuredClone(game) };
  }
  assert.equal(game.status, 'playing'); assert.ok(advisorSetup);
  const afterSetup = structuredClone(game);
  assert.deepEqual(game.players.flatMap(player => player.hand.map(card => card.id)), startingCards.map(card => card.id));
  assert.equal(advisorPreparationPlayer(game, bg).forces['arrakeen:10'], 1);
  assert.ok(advisorPreparationPlayer(game, bg).advisors?.arrakeen);
  assert.equal(advisorPreparationPlayer(game, atreides).forces['arrakeen:10'], 10);
  assert.ok(advisorPreparationPlayer(game, emperor).hand.some(card => card.id === karama.id));
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder = [0, 1].map(position => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery);
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0];
    game.spiceDeck.splice(position, 0, card); return { position, from, card: structuredClone(card) };
  });
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  reach(state => state.turn === 1 && state.phase === 2 && advisorPreparationClean(state));
  const afterSpice = structuredClone(game);
  if (phase === 3) reach(state => state.phase === 3 && advisorPreparationClean(state) && !!state.auction);
  if (phase === 4) reach(state => state.phase === 4 && advisorPreparationClean(state));
  let openingOffer: Game | null = null, decline: AdvisorPreparationTransition | null = null;
  if (phase === 5) {
    reach(state => state.phase === 5 && !state.phaseOpening && !state.response && state.decision?.kind === 'advisorBattle');
    openingOffer = structuredClone(game);
    if (options.declineOffer) {
      const before = structuredClone(game), start = actions.length;
      act(bg, { type: 'decision', accept: false });
      reach(state => state.phase === 5 && advisorPreparationClean(state) && !!state.active);
      decline = { before, steps: structuredClone(actions.slice(start)), after: structuredClone(game) };
    }
  }
  assert.equal(game.turn, 1); assert.equal(game.phase, phase);
  assert.equal(advisorPreparationPlayer(game, bg).forces['arrakeen:10'], 1);
  assert.ok(advisorPreparationPlayer(game, bg).advisors?.arrakeen);
  assert.equal(advisorPreparationPlayer(game, atreides).forces['arrakeen:10'], 10);
  assert.ok(game.players.every(player => !player.shipped && player.moved === 0));
  assert.ok(advisorPreparationPlayer(game, emperor).hand.some(card => card.id === karama.id));
  assert.deepEqual(advisorPreparationInventory(game), originalInventory);
  const preparation: Action = { type: 'prepareAdvisors', territory: 'arrakeen' };
  const shipmentAction: Action = { type: 'ship', territory: 'polar_sink', sector: 0, amount: 1, elite: 0, allyPayment: 0 };
  return { game, initial, lobby, setup, beforeStartingDeal, afterSetup, advisorSetup, afterSpice,
    openingOffer, decline, bg, owner: bg, atreides, emperor, observer: emperor, counterOwner: emperor,
    karama: karama.id, phase, territory: 'arrakeen', sector: 10, location: 'arrakeen:10', preparation,
    preparationStep: { actor: bg, action: preparation } satisfies AdvisorPreparationStep,
    declineOffer: { type: 'decision', accept: false } satisfies Action,
    shipmentAction, shipmentStep: game.active ? { actor: game.active, action: shipmentAction } satisfies AdvisorPreparationStep : null,
    endMovement: { type: 'endMovement' } satisfies Action,
    actions, sourceActionCount: actions.length, originalInventory, originalSpice, dealOrder, spiceOrder,
    staging: [
      'Actual public three-seat Advanced Bene Gesserit/Atreides/Emperor ready/start, prediction and private Traitor choices. Starting advisorSetup really puts one BG counter into occupied Arrakeen10, so its native advisor stance remains.',
      'Select only original scalar shuffle order, three original unopened Treachery positions and two original unopened ordinary Spice positions. Emperor is actually dealt its original printed Karama; no later held-card acquisition or hand replacement is staged.',
      'Actually complete native first Storm and both first-turn Spice blows. Requested Charity, first native auction, Revival or initial Shipment controls are reached by their original readiness, peek and auction responses. No force, wallet, played phase, stance, clock or receipt is assigned.',
      options.declineOffer && phase === 5
        ? 'Actually decline the original first Shipment advisorBattle offer, then stop at an active native turn whose shipment and movement remain unused.'
        : 'Stop before the requested preparation or first actual shipment; an original phase5 advisorBattle offer remains caller-owned when requested.',
      'The direct preparation and positive shipment actions are returned without being executed. The separate shipAdvisorPreparation helper submits one real paid positive shipment from the current actor, then declines any native accompaniment through actual controls.',
    ],
  };
}
export type AdvisorPreparationFixture = ReturnType<typeof createAdvisorPreparationFixture>;

/** A native skip/end is separate from this real positive shipment. The caller
 * first resolves preparation and reaches an actual unshipped active turn. */
export function shipAdvisorPreparation(source: Game,
  actions: AdvisorPreparationStep[] = []): AdvisorPreparationTransition {
  assert.equal(source.phase, 5); assert.ok(advisorPreparationClean(source) && source.active);
  const actor = source.active; assert.equal(advisorPreparationPlayer(source, actor).shipped, false);
  const before = structuredClone(source), start = actions.length;
  const action: Action = { type: 'ship', territory: 'polar_sink', sector: 0, amount: 1, elite: 0, allyPayment: 0 };
  let game = actAdvisorPreparation(source, actor, action, actions);
  game = advanceAdvisorPreparation(game, advisorPreparationClean, actions);
  assert.equal(advisorPreparationPlayer(game, actor).forces['polar_sink:0'],
    (advisorPreparationPlayer(before, actor).forces['polar_sink:0'] ?? 0) + 1);
  assert.ok(advisorPreparationPlayer(game, actor).spice < advisorPreparationPlayer(before, actor).spice);
  assert.equal(advisorPreparationPlayer(game, actor).shipped, true);
  return { before, steps: structuredClone(actions.slice(start)), after: game };
}
