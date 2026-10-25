import assert from 'node:assert/strict';
import { createGame, initializeSemutaGameForAudit, joinGame, newPlayer, type Action, type Game } from '../game/engine';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';
import {
  actSemutaCombatCapabilities, nextSemutaCombatCapabilities,
  semutaCombatCapabilitiesPlayer, semutaCombatCapabilitiesInventory, semutaCombatCapabilitiesClean,
  passSemutaCombatCapabilities, claimSemutaCombatCapabilities,
} from './fixture-semuta-combat-capabilities';

export type SemutaSpiritualArrivalStep = { actor: string; action: Action };
export const actSemutaSpiritualArrival = actSemutaCombatCapabilities;
export const semutaSpiritualArrivalPlayer = semutaCombatCapabilitiesPlayer;
export const semutaSpiritualArrivalInventory = semutaCombatCapabilitiesInventory;
export const semutaSpiritualArrivalClean = semutaCombatCapabilitiesClean;
export const passSemutaSpiritualArrival = passSemutaCombatCapabilities;
export const claimSemutaSpiritualArrival = claimSemutaCombatCapabilities;
export const semutaSpiritualArrivalPhysical = (game: Game) => ({
  turn: game.turn, phase: game.phase, storm: game.storm, active: game.active, order: game.order,
  ready: game.ready, movementRemaining: game.movementRemaining, spice: game.spice,
  players: game.players.map(p => ({ id: p.id, spice: p.spice, forces: p.forces, reserves: p.reserves,
    tanks: p.tanks, elites: p.elites, leaders: p.leaders, ally: p.ally, shipped: p.shipped, moved: p.moved })),
});

/** Native quiet controls only. The free packet chooser, distinct shipping
 * counter and mandatory conversion remain explicit source/caller actions. */
export function nextSemutaSpiritualArrival(game: Game): SemutaSpiritualArrivalStep | null {
  if (game.response?.automaticAdvisorFlip) return null;
  if (!game.response && !game.phaseOpening && !game.pendingTreacheryDiscard) {
    if (game.status === 'setup' && game.setupStage === 'prediction')
      return { actor: 'beneGesserit', action: { type: 'predict', faction: 'atreides', turn: 10 } };
    const bg = game.players.find(p => p.faction === 'beneGesserit');
    if (game.status === 'setup' && game.setupStage === 'forces' && bg && !bg.advisorSetup)
      return { actor: bg.id, action: { type: 'advisorSetup', territory: 'arrakeen', sector: 10 } };
    const d = game.decision;
    if (d?.kind === 'advisor' || d?.kind === 'intrusion') return null;
    if (d?.kind === 'advisorBattle') return { actor: d.player, action: { type: 'decision', accept: false } };
  }
  return nextSemutaCombatCapabilities(game);
}
export const nextSemutaSpiritualArrivalStep = nextSemutaSpiritualArrival;
export function advanceSemutaSpiritualArrival(game: Game, until: (state: Game) => boolean,
  actions: SemutaSpiritualArrivalStep[] = []): Game {
  for (let count = 0; count < 2400; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const next = nextSemutaSpiritualArrival(game);
    assert.ok(next, `Supply the real Spiritual choice at ${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = actSemutaSpiritualArrival(game, next.actor, next.action, actions);
  }
  throw Error('The native Spiritual arrival programme did not reach its finite boundary');
}
export function allowSemutaSpiritualArrival(game: Game, actions: SemutaSpiritualArrivalStep[] = []): Game {
  assert.ok(game.response?.automaticAdvisorFlip?.producer === 'spiritualArrival');
  for (let count = 0; game.response?.automaticAdvisorFlip?.producer === 'spiritualArrival' && count < game.players.length; count++) {
    const p = game.players.find(p => !game.response!.passed.includes(p.id)); assert.ok(p);
    game = actSemutaSpiritualArrival(game, p.id, { type: 'passResponse' }, actions);
  }
  assert.notEqual(game.response?.automaticAdvisorFlip?.producer, 'spiritualArrival'); return game;
}
/** Finish only the free arrival and original paid queued entry. Leave the
 * actual Atreides combined turn and later endMovement to the caller. */
export function finishSemutaSpiritualArrival(game: Game, actions: SemutaSpiritualArrivalStep[] = []): Game {
  assert.ok(!game.pendingTreacheryDiscard);
  return advanceSemutaSpiritualArrival(game, state => semutaSpiritualArrivalClean(state) &&
    !state.pendingSpiritualAdvisor && !state.pendingAutomaticAdvisorFlips?.length && !state.pendingArrivalReaction?.length, actions);
}

/** Real paid ordinary Atreides entry and declared BG Polar packet. No played
 * stock, advisor stance, source frame, queue, lock or counter is installed. */
export function createSemutaSpiritualArrivalFixture() {
  const richese = 'richese', holder = 'choam', owner = 'beneGesserit', shipper = 'atreides', spender = 'emperor';
  const territory = 'polar_sink', sector = 0, location = 'polar_sink:0';
  const paidTerritory = 'tueks_sietch', paidSector = 5, paidLocation = 'tueks_sietch:5';
  let game = createGame('SEMUTASPIRITUALARRIVAL', newPlayer(richese, 'Richese', 'richese'), true, ['choam']);
  for (const faction of ['choam', 'beneGesserit', 'atreides', 'emperor'] as const)
    joinGame(game, newPlayer(faction, faction, faction));
  const initial = structuredClone(game), actions: SemutaSpiritualArrivalStep[] = [];
  const act = (actor: string, action: Action) => { game = actSemutaSpiritualArrival(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceSemutaSpiritualArrival(game, until, actions); };
  const transition = (run: () => void) => {
    const before = structuredClone(game), at = actions.length; run();
    return { before, steps: structuredClone(actions.slice(at)), after: structuredClone(game) };
  };
  for (const p of game.players) act(p.id, { type: 'ready' });
  const lobby = structuredClone(game);
  game = withClassicDiscoveryNexusLottery(() => initializeSemutaGameForAudit(game));
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, true); assert.equal(game.semutaPreview, true);
  assert.ok(game.players.every(p => p.hand.length === 0));
  assert.ok(!game.homeworlds && !game.nexusCards && !game.leaderSkills && !game.techTokens &&
    !game.strongholdCards && !game.discoveryEnabled && !game.ecazTreachery);
  const originalInventory = semutaSpiritualArrivalInventory(game); assert.equal(originalInventory.length, 45);
  const printed = game.deck.find(card => card.effect === 'karama'); assert.ok(printed);
  const ordinary = game.deck.filter(card => card.kind === 'projectile' || card.kind === 'poison').slice(0, 4);
  assert.equal(ordinary.length, 4); const selected = [...ordinary, printed];
  const dealOrder = selected.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card.id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { card: card.id, position, from };
  });
  const beforeStartingDeal = structuredClone(game), cost = printed.id;
  const setupChoices = transition(() => { reach(state => state.status === 'playing'); });
  const afterSetup = structuredClone(game);
  assert.deepEqual(game.players.flatMap(p => p.hand.map(card => card.id)), selected.map(card => card.id));
  assert.equal(semutaSpiritualArrivalPlayer(game, owner).forces['arrakeen:10'], 1);
  assert.ok(semutaSpiritualArrivalPlayer(game, owner).advisors?.arrakeen);
  assert.equal(semutaSpiritualArrivalPlayer(game, shipper).forces['arrakeen:10'], 10);
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder = [0, 1].map(position => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery);
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0]; game.spiceDeck.splice(position, 0, card);
    return { position, from, card: structuredClone(card) };
  });
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  let beforeBid: Game | undefined, bid: SemutaSpiritualArrivalStep | undefined, bidAt = -1;
  for (let count = 0; count < 1000 && !semutaSpiritualArrivalPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID); count++) {
    const next = nextSemutaSpiritualArrival(game); assert.ok(next);
    if (next.actor === holder && next.action.type === 'richeseBid' && next.action.amount === 1) {
      beforeBid = structuredClone(game); bid = structuredClone(next); bidAt = actions.length;
    }
    act(next.actor, next.action);
  }
  assert.ok(beforeBid && bid && bidAt >= 0);
  const acquired = structuredClone(game), acquisition = { before: beforeBid, bid,
    steps: structuredClone(actions.slice(bidAt)), after: acquired, price: 1 };
  reach(state => state.turn === 1 && state.phase === 5 && state.active === shipper && semutaSpiritualArrivalClean(state));
  assert.ok(game.players.every(p => (p.forces[location] ?? 0) === 0));
  const shipmentAction: Action = { type: 'ship', territory: paidTerritory, sector: paidSector, amount: 1, elite: 0, allyPayment: 0 };
  const shipment = transition(() => {
    act(shipper, shipmentAction);
    reach(state => !state.response && !state.phaseOpening && state.decision?.kind === 'advisor');
  });
  assert.ok(game.decision?.kind === 'advisor'); assert.equal(game.decision.shipment, shipper);
  assert.equal(game.decision.destination, paidLocation);
  assert.equal(semutaSpiritualArrivalPlayer(shipment.before, shipper).spice - semutaSpiritualArrivalPlayer(game, shipper).spice, 1);
  const chooseAction: Action = { type: 'decision', accept: true, accompany: false, amount: 1 };
  const declaration = transition(() => { act(owner, chooseAction); });
  assert.ok(game.response?.kind === 'advisor' && game.response.spiritualAdvisorSource);
  const shippingResponse = structuredClone(game.response), shippingSource = structuredClone(game.response.spiritualAdvisorSource);
  const shippingFrame = structuredClone(game.pendingSpiritualAdvisor!);
  assert.equal(game.pendingSpiritualAdvisor?.stage, 'shipping');
  assert.equal(semutaSpiritualArrivalPlayer(game, owner).forces[location] ?? 0, 0);
  const placed = transition(() => {
    for (let count = 0; game.response?.kind === 'advisor' && count < game.players.length; count++) {
      const p = game.players.find(p => !game.response!.passed.includes(p.id)); assert.ok(p);
      act(p.id, { type: 'passResponse' });
    }
  });
  assert.ok(game.response?.automaticAdvisorFlip?.producer === 'spiritualArrival');
  const automatic = game.response.automaticAdvisorFlip;
  assert.deepEqual(automatic.spiritual, shippingSource); assert.deepEqual(automatic.forces, { [location]: 1 });
  assert.equal(game.pendingSpiritualAdvisor?.stage, 'arrival');
  assert.equal(semutaSpiritualArrivalPlayer(game, owner).forces[location], 1);
  assert.equal(semutaSpiritualArrivalPlayer(game, owner).reserves, semutaSpiritualArrivalPlayer(declaration.before, owner).reserves - 1);
  assert.equal(semutaSpiritualArrivalPlayer(game, owner).advisors?.[territory]?.lockedTurn, game.turn);
  assert.equal(semutaSpiritualArrivalPlayer(game, owner).advisors?.[territory]?.aloneFlipHold, automatic.event);
  assert.deepEqual(semutaSpiritualArrivalInventory(game), originalInventory);
  return { game, kind: 'advisorFlip' as const, advanced: true as const, richese, holder, owner, shipper, spender,
    cost, karama: cost, semuta: SEMUTA_DRUG_ID, action: { type: 'card', card: cost, mode: 'cancel' } as Action,
    originalResponse: structuredClone(game.response), originalAutomaticSource: structuredClone(automatic),
    originalFrame: structuredClone(game.pendingSpiritualAdvisor!), originalQueue: structuredClone(game.pendingAutomaticAdvisorFlips!),
    originalPaidParent: structuredClone(game.pendingArrivalReaction!), originalPhysical: structuredClone(semutaSpiritualArrivalPhysical(game)),
    originalStance: structuredClone(semutaSpiritualArrivalPlayer(game, owner).advisors!),
    originalLocks: structuredClone(semutaSpiritualArrivalPlayer(game, owner).advisors?.[territory]),
    originalDeck: structuredClone(game.deck), territory, sector, location, paidTerritory, paidSector, paidLocation,
    shipmentAction, chooseAction, shippingResponse, shippingSource, shippingFrame,
    initial, lobby, setup, setupChoices, beforeStartingDeal, afterSetup, dealOrder, deal: selected.map(card => card.id),
    originalInventory, originalSpice, spiceOrder, acquisition, acquired, cache: acquisition, shipment,
    declaration, placed, actions, steps: actions, sourceActionCount: actions.length,
    staging: [
      'Original undealt Advanced R/C/BG/A/E Semuta initializer with CHOAM only and no optional module. Actual prediction/private Traitors/advisorSetup place BG1 beside original A10 at Arrakeen. Only unopened card/Spice positions and native scalar lotteries are selected; C buys cache1 Semuta and E receives printed Karama.',
      'Native BG preparation declines and unused turns end through actual controls. A really pays1 for one ordinary reserve into empty Tuek’s5, committing its force, payment and shipment allowance before the independent Spiritual choice. The original paid arrival queue remains native.',
      'BG actually chooses its free one-counter Polar Sink packet. Every distinct shipping-counter response is really passed. Empty Polar has no residents to match; the engine actually withdraws BG1, places it advisor-side, locks it for this turn and opens mandatory spiritualArrival conversion with the exact new hold.',
      'Stop before the separate printed conversion cost. No reserve, stance, lock, clock, card, source/frame, original arrival or Semuta window is installed; the original paid entry waits while its actual free child completes.',
    ] };
}
export type SemutaSpiritualArrivalFixture = ReturnType<typeof createSemutaSpiritualArrivalFixture>;
