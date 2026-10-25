import assert from 'node:assert/strict';
import { createGame, initializeSemutaGameForAudit, joinGame, newPlayer, type Action, type Game } from '../game/engine';
import { isAdvisor } from '../game/advisors';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';
import {
  actSemutaAdvisorMatching, nextSemutaAdvisorMatching, passSemutaAdvisorMatching, claimSemutaAdvisorMatching,
  semutaAdvisorMatchingPlayer, semutaAdvisorMatchingInventory,
} from './fixture-semuta-advisor-matching';

export type SemutaSpiritualCostStage = 'shipping' | 'matching';
export type SemutaSpiritualCostStep = { actor: string; action: Action };
export const actSemutaSpiritualCost = actSemutaAdvisorMatching;
export const passSemutaSpiritualCost = passSemutaAdvisorMatching;
export const claimSemutaSpiritualCost = claimSemutaAdvisorMatching;
export const semutaSpiritualCostPlayer = semutaAdvisorMatchingPlayer;
export const semutaSpiritualCostInventory = semutaAdvisorMatchingInventory;
export const semutaSpiritualCostClean = (game: Game) => !game.response && !game.phaseOpening && !game.decision &&
  !game.truthtrance && !game.pendingTreacheryDiscard && !game.pendingSpiritualAdvisor && !game.pendingArrivalReaction?.length;
export const semutaSpiritualCostPhysical = (game: Game) => game.players.map(p => ({ id: p.id, spice: p.spice,
  forces: p.forces, elites: p.elites, reserves: p.reserves, tanks: p.tanks, advisors: p.advisors,
  shipped: p.shipped, moved: p.moved, revived: p.revived, freeForcesRevived: p.freeForcesRevived }));

/** Original Spiritual chooser, shipping/matching responses and fresh costs
 * remain explicit choices. No native opportunity is silently declined. */
export function nextSemutaSpiritualCost(game: Game): SemutaSpiritualCostStep | null {
  if (game.pendingTreacheryDiscard || game.truthtrance || game.pendingSpiritualAdvisor ||
      game.response?.spiritualAdvisorSource || game.response?.automaticAdvisorFlip) return null;
  if (!game.response && !game.phaseOpening &&
      (game.decision?.kind === 'advisor' || game.decision?.kind === 'intrusion')) return null;
  return nextSemutaAdvisorMatching(game);
}
export const nextSemutaSpiritualCostStep = nextSemutaSpiritualCost;
export function advanceSemutaSpiritualCost(game: Game, until: (state: Game) => boolean,
  actions: SemutaSpiritualCostStep[] = []): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const step = nextSemutaSpiritualCost(game);
    assert.ok(step, `Choose the original Spiritual/fresh control at ${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = actSemutaSpiritualCost(game, step.actor, step.action, actions);
  }
  throw Error('The native Semuta/Spiritual programme did not reach its finite boundary');
}
function responseStage(game: Game) {
  const response = game.response;
  if (response?.spiritualAdvisorSource) return JSON.stringify([response.kind, response.spiritualAdvisorSource]);
  if (response?.automaticAdvisorFlip?.producer === 'spiritualArrival') return JSON.stringify(response.automaticAdvisorFlip);
  return null;
}
/** Explicitly allow just this original layer; a later matching or automatic
 * conversion stays owned until another explicit call. */
export function allowSemutaSpiritualCost(game: Game, actions: SemutaSpiritualCostStep[] = []): Game {
  const stage = responseStage(game); assert.ok(stage);
  for (let count = 0; responseStage(game) === stage && count < game.players.length; count++) {
    const response: NonNullable<Game['response']> = game.response!;
    const actor = game.players.find(p => !response.passed.includes(p.id)); assert.ok(actor);
    game = actSemutaSpiritualCost(game, actor.id, { type: 'passResponse' }, actions);
  }
  assert.notEqual(responseStage(game), stage); return game;
}
/** Stop at the restored matching chooser, or at the same active foreign turn
 * after this original arrival queue has drained. No turn end is invented. */
export function finishSemutaSpiritualCost(game: Game, actions: SemutaSpiritualCostStep[] = []): Game {
  assert.equal(game.pendingTreacheryDiscard ?? null, null, 'Choose the exact fresh cost first');
  return advanceSemutaSpiritualCost(game, state => semutaSpiritualCostClean(state) ||
    (!state.response && !state.phaseOpening && state.decision?.kind === 'advisor' &&
      state.pendingSpiritualAdvisor?.stage === 'offer'), actions);
}

/** Genuine fresh Advanced R/C/BG/A/E. Only unopened physical card/Spice
 * positions and original setup lotteries are selected. */
export function createSemutaSpiritualCostFixture(options: { stage?: SemutaSpiritualCostStage } = {}) {
  const stage = options.stage ?? 'shipping', seller = 'richese', holder = 'choam', owner = 'beneGesserit';
  const shipper = 'atreides', spender = 'emperor';
  const setupTerritory = stage === 'shipping' ? 'arrakeen' : 'polar_sink', setupSector = stage === 'shipping' ? 10 : 0;
  const territory = stage === 'shipping' ? 'arrakeen' : 'polar_sink', sector = stage === 'shipping' ? 10 : 0;
  const location = `${territory}:${sector}`, foreignDestination = stage === 'shipping' ? 'arrakeen' : 'tueks_sietch';
  const foreignSector = stage === 'shipping' ? 10 : 5, foreignLocation = `${foreignDestination}:${foreignSector}`;
  let game = createGame('SEMUTASPIRITUALCOST', newPlayer(seller, 'Richese', 'richese'), true, ['choam']);
  for (const faction of ['choam', 'beneGesserit', 'atreides', 'emperor'] as const) joinGame(game, newPlayer(faction, faction, faction));
  const initial = structuredClone(game), actions: SemutaSpiritualCostStep[] = [];
  const act = (actor: string, action: Action) => { game = actSemutaSpiritualCost(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceSemutaSpiritualCost(game, until, actions); };
  const transition = (run: () => void) => {
    const before = structuredClone(game), at = actions.length; run();
    return { before, steps: structuredClone(actions.slice(at)), after: structuredClone(game) };
  };
  for (const p of game.players) act(p.id, { type: 'ready' });
  const lobby = structuredClone(game);
  game = withClassicDiscoveryNexusLottery(() => initializeSemutaGameForAudit(game));
  const setup = structuredClone(game), initialization = { before: lobby, after: setup,
    entry: 'original-undealt-advanced-semuta-preview' };
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, true); assert.equal(game.semutaPreview, true);
  assert.ok(game.players.every(p => !p.hand.length));
  assert.ok(!game.homeworlds && !game.nexusCards && !game.leaderSkills && !game.techTokens &&
    !game.strongholdCards && !game.discoveryEnabled && !game.ecazTreachery);
  const originalInventory = semutaSpiritualCostInventory(game); assert.equal(originalInventory.length, 45);
  const printed = game.deck.find(card => card.effect === 'karama'); assert.ok(printed);
  const ordinary = game.deck.filter(card => ['projectile', 'poison', 'shield', 'snooper'].includes(card.kind)).slice(0, 4);
  assert.equal(ordinary.length, 4);
  const selected = [...ordinary, printed], dealOrder = selected.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card.id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: card.id };
  });
  const beforeStartingDeal = structuredClone(game);
  let advisorSetup: { before: Game; steps: SemutaSpiritualCostStep[]; after: Game } | null = null;
  for (let count = 0; game.status === 'setup' && count < 100; count++) {
    const step = nextSemutaSpiritualCost(game); assert.ok(step);
    if (step.action.type === 'advisorSetup') step.action = { type: 'advisorSetup', territory: setupTerritory, sector: setupSector };
    const before = step.action.type === 'advisorSetup' ? structuredClone(game) : null;
    act(step.actor, step.action);
    if (before) advisorSetup = { before, steps: [structuredClone(step)], after: structuredClone(game) };
  }
  assert.equal(game.status, 'playing'); assert.ok(advisorSetup);
  const afterSetup = structuredClone(game), cost = printed.id;
  assert.deepEqual(game.players.flatMap(p => p.hand.map(card => card.id)), selected.map(card => card.id));
  assert.equal(semutaSpiritualCostPlayer(game, owner).forces[location], 1);
  assert.equal(isAdvisor(semutaSpiritualCostPlayer(game, owner), territory), stage === 'shipping');
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder: { position: number; from: number; card: Game['spiceDeck'][number] }[] = [];
  for (const [position, face] of ['funeral_plain', 'hagga_basin'].entries()) {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && card.territory === face && !card.discovery);
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0]; game.spiceDeck.splice(position, 0, card);
    spiceOrder.push({ position, from, card: structuredClone(card) });
  }
  let beforeBid: Game | undefined, bid: SemutaSpiritualCostStep | undefined, bidAt = -1;
  for (let count = 0; count < 900 && !semutaSpiritualCostPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID); count++) {
    const step = nextSemutaSpiritualCost(game); assert.ok(step);
    if (step.actor === holder && step.action.type === 'richeseBid' && step.action.amount === 1) {
      beforeBid = structuredClone(game); bid = structuredClone(step); bidAt = actions.length;
    }
    act(step.actor, step.action);
  }
  assert.ok(beforeBid && bid && bidAt >= 0);
  const acquired = structuredClone(game), acquisition = { before: beforeBid, bid,
    steps: structuredClone(actions.slice(bidAt)), after: acquired, price: 1 };
  assert.equal(semutaSpiritualCostPlayer(beforeBid, holder).spice - semutaSpiritualCostPlayer(game, holder).spice, 1);
  const bgTurn = transition(() => {
    reach(state => state.phase === 5 && state.active === owner && semutaSpiritualCostClean(state));
    act(owner, { type: 'endMovement' });
    reach(state => state.phase === 5 && state.active === shipper && semutaSpiritualCostClean(state));
  });
  const paidShipmentAction: Action = { type: 'ship', territory: foreignDestination, sector: foreignSector,
    amount: 1, elite: 0, allyPayment: 0 };
  const paidParent = transition(() => {
    act(shipper, paidShipmentAction);
    reach(state => !state.response && !state.phaseOpening && state.decision?.kind === 'advisor');
  });
  assert.equal(semutaSpiritualCostPlayer(paidParent.before, shipper).spice - semutaSpiritualCostPlayer(game, shipper).spice, 1);
  assert.equal(semutaSpiritualCostPlayer(game, shipper).forces[foreignLocation], stage === 'shipping' ? 11 : 1);
  assert.ok(game.decision?.kind === 'advisor'); assert.equal(game.decision.player, owner);
  assert.equal(game.decision.shipment, shipper); assert.equal(game.decision.destination, foreignLocation);
  const beforeDeclaration = structuredClone(game), originalChooser = structuredClone(game.decision);
  const accompany: Action = { type: 'decision', accept: true, accompany: true, amount: 1 };
  const sink: Action = { type: 'decision', accept: true, accompany: false, amount: 1 };
  const decline: Action = { type: 'decision', accept: false }, nativeAction = stage === 'shipping' ? accompany : sink;
  const declaration = transition(() => { act(owner, nativeAction); });
  assert.equal(game.response?.kind, 'advisor'); assert.ok(game.response?.spiritualAdvisorSource);
  assert.equal(game.pendingSpiritualAdvisor?.stage, 'shipping');
  const shipping = structuredClone(game);
  const shippingAllowance = stage === 'matching'
    ? transition(() => { game = allowSemutaSpiritualCost(game, actions); }) : null;
  assert.equal(game.response?.kind, stage === 'shipping' ? 'advisor' : 'advisorFlip');
  assert.equal(game.pendingSpiritualAdvisor?.stage, stage); assert.ok(game.response?.spiritualAdvisorSource && game.pendingSpiritualAdvisor);
  assert.deepEqual(semutaSpiritualCostPhysical(game), semutaSpiritualCostPhysical(beforeDeclaration));
  assert.ok(semutaSpiritualCostPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID));
  assert.ok(semutaSpiritualCostPlayer(game, spender).hand.some(card => card.id === cost));
  const source = structuredClone(game), originalResponse = structuredClone(game.response);
  const originalFrame = structuredClone(game.pendingSpiritualAdvisor), originalSource = structuredClone(game.response.spiritualAdvisorSource);
  const originalParent = structuredClone(game.pendingArrivalReaction ?? null), originalArrival = structuredClone(originalParent?.find(arrival => arrival.entrant === shipper));
  assert.ok(originalParent?.length && originalArrival, 'Keep the actual paid foreign arrival queued behind the Spiritual choice');
  const action: Action = { type: 'card', card: cost, mode: 'cancel' };
  assert.deepEqual(semutaSpiritualCostInventory(game), originalInventory);
  return { game, source, beforeCost: source, stage, kind: originalResponse.kind, advanced: true as const,
    owner, bg: owner, recipient: owner, holder, spender, seller, richese: seller, shipper, atreides: shipper, emperor: spender,
    cost, karama: cost, semuta: SEMUTA_DRUG_ID, action, nativeAction, accompany, sink, decline,
    replacementAction: stage === 'matching' ? accompany : null, territory, sector, location,
    foreignDestination, foreignSector, foreignLocation, paidShipmentAction, paidParent, foreignCost: 1,
    originalResponse, originalFrame, originalSource, originalChooser, originalParent, originalArrival,
    originalPhysical: structuredClone(semutaSpiritualCostPhysical(game)),
    initial, lobby, setup, initialization, beforeStartingDeal, afterSetup, advisorSetup,
    deal: selected.map(card => card.id), dealOrder, originalInventory, originalSpice, spiceOrder,
    acquisition, acquired, bgTurn, beforeDeclaration, declaration, shipping, shippingAllowance,
    actions, steps: actions, sourceActions: actions, sourceActionCount: actions.length,
    staging: [
      'Original Advanced Semuta initializer on the ready undealt R/C/BG/A/E lobby, exact CHOAM/main35/cache10 and no optional modules. Only unopened original starting-card/Spice positions and original scalar lotteries are selected. Emperor actually receives the printed Karama; CHOAM really purchases cache1 Semuta for one.',
      stage === 'shipping'
        ? 'BG actually places its original advisor at Arrakeen10 beside native A10, declines preparation and ends movement. Atreides really pays one to ship one reserve there, then BG really declares accompaniment. Stop at the original shipping response before BG withdraws a reserve.'
        : 'BG actually places its original counter in empty Polar0, which native setup makes a fighter, then ends its real movement turn. Atreides really pays one to ship one reserve to empty Tueks5. BG really declares the Polar fallback and passes its original shipping counter; stop at the separate native matching response before withdrawal or placement.',
      'The paid foreign shipment, payment, shipped flag and queued arrival are original completed effects. No played hand, force, stance, wallet, clock, receipt or parent is installed. Shipping prevention ends the free packet; matching prevention restores the original chooser and blocks this exact Polar packet. Its real Tueks accompaniment or decline remains available; without Homeworlds no two-counter replacement is claimed.',
    ],
  };
}
export type SemutaSpiritualCostFixture = ReturnType<typeof createSemutaSpiritualCostFixture>;
