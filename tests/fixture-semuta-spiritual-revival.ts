import assert from 'node:assert/strict';
import { createGame, initializeSemutaGameForAudit, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { isAdvisor } from '../game/advisors';
import { homeworldGameIntegrity, homeworldTable } from '../game/homeworld-game';
import { nativeShipmentSources } from '../game/homeworld-options';
import { homeworldRevivalDeploymentChoice } from '../game/homeworld-revival-deployment-options';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';
import {
  actSemutaSpiritualCost, passSemutaSpiritualCost, claimSemutaSpiritualCost, allowSemutaSpiritualCost,
  semutaSpiritualCostPlayer, semutaSpiritualCostInventory,
} from './fixture-semuta-spiritual-cost';
import { nextSemutaAdvisorMatching } from './fixture-semuta-advisor-matching';

export type SemutaSpiritualRevivalStage = 'shipping' | 'matching' | 'arrival';
export type SemutaSpiritualRevivalStep = { actor: string; action: Action };
export const actSemutaSpiritualRevival = actSemutaSpiritualCost;
export const passSemutaSpiritualRevival = passSemutaSpiritualCost;
export const claimSemutaSpiritualRevival = claimSemutaSpiritualCost;
export const allowSemutaSpiritualRevival = allowSemutaSpiritualCost;
export const semutaSpiritualRevivalPlayer = semutaSpiritualCostPlayer;
export const semutaSpiritualRevivalInventory = semutaSpiritualCostInventory;
export const semutaSpiritualRevivalClean = (game: Game) => !game.response && !game.phaseOpening && !game.decision &&
  !game.truthtrance && !game.pendingTreacheryDiscard && !game.pendingRevival &&
  !game.pendingSpiritualAdvisor && !game.pendingArrivalReaction?.length && !game.pendingAutomaticAdvisorFlips?.length;
/** Balances and advisor stance are asserted separately: the retained native
 * free-revival income may settle only after the original SEND completes. */
export const semutaSpiritualRevivalPhysical = (game: Game) => ({ homeworlds: game.homeworlds,
  players: game.players.map(p => ({ id: p.id, forces: p.forces, elites: p.elites, reserves: p.reserves,
    tanks: p.tanks, shipped: p.shipped, moved: p.moved, revived: p.revived,
    freeForcesRevived: p.freeForcesRevived, leaders: p.leaders, ally: p.ally })) });

/** Original setup, exact native Storm controls and ordinary revival choices.
 * SEND, Spiritual choices/counters and fresh groups stay caller-owned. */
export function nextSemutaSpiritualRevival(game: Game): SemutaSpiritualRevivalStep | null {
  if (game.pendingTreacheryDiscard || game.truthtrance || game.pendingSpiritualAdvisor ||
      game.response?.spiritualAdvisorSource || game.response?.automaticAdvisorFlip) return null;
  if (!game.response && !game.phaseOpening) {
    const decision = game.decision;
    if (decision?.kind === 'advisor' || decision?.kind === 'intrusion' || decision?.kind === 'homeworldRevivalDeployment') return null;
    if (decision?.kind === 'revivalStop' || decision?.kind === 'choamFreeRevival')
      return { actor: decision.player, action: { type: 'decision', decline: true } };
    if (game.status === 'setup' && game.setupStage === 'prediction')
      return { actor: 'beneGesserit', action: { type: 'predict', faction: 'tleilaxu', turn: 10 } };
    if (game.status === 'playing' && game.phase === 0 && !decision && game.stormPending === null) {
      const actor = game.stormDialers.find(id => game.stormDials[id] === undefined);
      if (actor) return { actor, action: { type: 'stormDial',
        amount: game.turn === 1 ? actor === game.stormDialers[0] ? 11 : 0 : 1 } };
    }
  }
  return nextSemutaAdvisorMatching(game);
}
export const nextSemutaSpiritualRevivalStep = nextSemutaSpiritualRevival;
export function advanceSemutaSpiritualRevival(game: Game, until: (state: Game) => boolean,
  actions: SemutaSpiritualRevivalStep[] = []): Game {
  for (let count = 0; count < 2400; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const step = nextSemutaSpiritualRevival(game);
    assert.ok(step, `Choose the original SEND/Spiritual/fresh control at ${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = actSemutaSpiritualRevival(game, step.actor, step.action, actions);
  }
  throw Error('The original Semuta/Revival SEND chronology did not reach its finite boundary');
}
/** Keep a restored matching chooser explicit. Otherwise finish the original
 * SEND queue and retained income, without another request or phase action. */
export function finishSemutaSpiritualRevival(game: Game, actions: SemutaSpiritualRevivalStep[] = []): Game {
  assert.equal(game.pendingTreacheryDiscard ?? null, null, 'Choose the original fresh cost first');
  return advanceSemutaSpiritualRevival(game, state =>
    (state.homeworldRevivalReturn?.stage === 'complete' && semutaSpiritualRevivalClean(state)) ||
    (!state.response && !state.phaseOpening && state.decision?.kind === 'advisor' &&
      state.pendingSpiritualAdvisor?.stage === 'offer'), actions);
}

/** Fresh Advanced R/C/BG/A/T, actual cache purchase and ordinary printed
 * Karama, real next-Storm loss, free revival and owned Homeworld SEND. */
export function createSemutaSpiritualRevivalFixture(options: { stage?: SemutaSpiritualRevivalStage } = {}) {
  const stage = options.stage ?? 'shipping', seller = 'richese', holder = 'choam', owner = 'beneGesserit';
  const spender = 'atreides', reviver = 'tleilaxu', destination = 'arrakeen:10';
  const territory = stage === 'shipping' ? 'arrakeen' : 'polar_sink', sector = stage === 'shipping' ? 10 : 0;
  const location = `${territory}:${sector}`, casualtyLocation = 'hagga_basin:13';
  let game = createGame('SEMUTASPIRITUALREVIVAL', newPlayer(seller, 'Richese', 'richese'), true, ['choam', 'ix']);
  for (const faction of [holder, owner, spender, reviver] as const) joinGame(game, newPlayer(faction, faction, faction));
  const initial = structuredClone(game), actions: SemutaSpiritualRevivalStep[] = [];
  const act = (actor: string, action: Action) => { game = actSemutaSpiritualRevival(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceSemutaSpiritualRevival(game, until, actions); };
  const transition = (run: () => void) => {
    const before = structuredClone(game), at = actions.length; run();
    return { before, steps: structuredClone(actions.slice(at)), after: structuredClone(game) };
  };
  const enableHomeworlds = transition(() => { act(game.host, { type: 'homeworlds', enabled: true }); });
  for (const p of game.players) act(p.id, { type: 'ready' });
  const lobby = structuredClone(game);
  game = withClassicDiscoveryNexusLottery(() => initializeSemutaGameForAudit(game));
  const setup = structuredClone(game), initialization = { before: lobby, after: setup,
    entry: 'original-undealt-advanced-semuta-tleilax-homeworld-preview' };
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, true); assert.equal(game.semutaPreview, true);
  assert.equal(game.homeworlds?.custody, null); assert.ok(game.players.every(p => !p.hand.length));
  assert.ok(!game.nexusCards && !game.leaderSkills && !game.techTokens && !game.strongholdCards &&
    !game.discoveryEnabled && !game.ecazTreachery);
  const originalInventory = semutaSpiritualRevivalInventory(game); assert.equal(originalInventory.length, 57);
  const printed = game.deck.find(card => card.effect === 'karama' && !card.id.startsWith('ix-')); assert.ok(printed);
  const ordinary = game.deck.filter(card => ['projectile', 'poison', 'shield', 'snooper'].includes(card.kind) && !card.effect).slice(0, 4);
  assert.equal(ordinary.length, 4);
  const selected = [ordinary[0], ordinary[1], ordinary[2], printed, ordinary[3]], cost = printed.id;
  const dealOrder = selected.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card.id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: card.id };
  });
  const beforeStartingDeal = structuredClone(game);
  let advisorSetup: { before: Game; steps: SemutaSpiritualRevivalStep[]; after: Game } | null = null;
  for (let count = 0; game.status === 'setup' && count < 150; count++) {
    const step = nextSemutaSpiritualRevival(game); assert.ok(step);
    if (step.action.type === 'advisorSetup') step.action = { type: 'advisorSetup',
      territory: stage === 'matching' ? 'polar_sink' : 'arrakeen', sector: stage === 'matching' ? 0 : 10 };
    const before = step.action.type === 'advisorSetup' ? structuredClone(game) : null;
    act(step.actor, step.action);
    if (before) advisorSetup = { before, steps: [structuredClone(step)], after: structuredClone(game) };
  }
  assert.equal(game.status, 'playing'); assert.ok(advisorSetup && game.homeworlds?.custody);
  const afterSetup = structuredClone(game);
  assert.deepEqual(game.players.flatMap(p => p.hand.map(card => card.id)), selected.map(card => card.id));
  const setupTerritory = stage === 'matching' ? 'polar_sink' : 'arrakeen';
  assert.equal(semutaSpiritualRevivalPlayer(game, owner).forces[stage === 'matching' ? 'polar_sink:0' : 'arrakeen:10'], 1);
  assert.equal(isAdvisor(semutaSpiritualRevivalPlayer(game, owner), setupTerritory), stage !== 'matching');
  assert.equal(semutaSpiritualRevivalPlayer(game, reviver).reserves, 20);
  assert.equal(semutaSpiritualRevivalPlayer(game, reviver).faceDancers?.length, 3);
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder: { position: number; from: number; card: Game['spiceDeck'][number] }[] = [];
  for (let position = 0; position < 4; position++) {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery &&
      !['hagga_basin', 'arrakeen', 'polar_sink'].includes(card.territory));
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0]; game.spiceDeck.splice(position, 0, card);
    spiceOrder.push({ position, from, card: structuredClone(card) });
  }
  const firstStorm = transition(() => { reach(state => state.turn === 1 && state.phase === 1); });
  assert.equal(game.storm, 12);
  let beforeBid: Game | undefined, bid: SemutaSpiritualRevivalStep | undefined, bidAt = -1;
  for (let count = 0; count < 900 && !semutaSpiritualRevivalPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID); count++) {
    const step = nextSemutaSpiritualRevival(game); assert.ok(step);
    if (step.actor === holder && step.action.type === 'richeseBid' && step.action.amount === 1) {
      beforeBid = structuredClone(game); bid = structuredClone(step); bidAt = actions.length;
    }
    act(step.actor, step.action);
  }
  assert.ok(beforeBid && bid && bidAt >= 0);
  const acquired = structuredClone(game), acquisition = { before: beforeBid, bid,
    steps: structuredClone(actions.slice(bidAt)), after: acquired, price: 1 };
  assert.equal(semutaSpiritualRevivalPlayer(beforeBid, holder).spice - semutaSpiritualRevivalPlayer(game, holder).spice, 1);
  reach(state => state.turn === 1 && state.phase === 5 && state.active === reviver && semutaSpiritualRevivalClean(state));
  const homeworldSources = nativeShipmentSources(viewGame(game, reviver), 1, 0); assert.ok(homeworldSources);
  const shipmentAction: Action = { type: 'ship', territory: 'hagga_basin', sector: 13,
    amount: 1, elite: 0, allyPayment: 0, homeworldSources };
  const shipment = transition(() => {
    act(reviver, shipmentAction);
    reach(state => !state.response && !state.phaseOpening && state.decision?.kind === 'advisor');
  });
  const firstSpiritualDecline = transition(() => { act(owner, { type: 'decision', accept: false }); });
  assert.equal(semutaSpiritualRevivalPlayer(shipment.before, reviver).spice - semutaSpiritualRevivalPlayer(game, reviver).spice, 2);
  assert.equal(semutaSpiritualRevivalPlayer(game, reviver).forces[casualtyLocation], 1);
  reach(state => state.turn === 2 && state.phase === 0 && !state.response && !state.phaseOpening && state.stormPending === 1);
  const beforeStormMovement = structuredClone(game), stormSource = structuredClone(game.stormMovementSource);
  const stormLoss = transition(() => { reach(state => state.turn === 2 && state.phase === 1); });
  assert.equal(game.storm, 13); assert.equal(semutaSpiritualRevivalPlayer(game, reviver).tanks, 1);
  assert.equal(semutaSpiritualRevivalPlayer(game, reviver).forces[casualtyLocation] ?? 0, 0);
  reach(state => state.turn === 2 && state.phase === 4 && semutaSpiritualRevivalClean(state));
  const beforeRequest = structuredClone(game), revivalAction: Action = { type: 'revive', amount: 1, elite: 0, freeElite: 0 };
  assert.equal(semutaSpiritualRevivalPlayer(game, reviver).reserves, 19);
  assert.equal(homeworldTable(game)!.find(world => world.native === reviver)!.side, 'high');
  const freeRevive = transition(() => {
    act(reviver, revivalAction);
    reach(state => !state.response && !state.phaseOpening && state.decision?.kind === 'homeworldRevivalDeployment');
  });
  const returned = structuredClone(game), choice = homeworldRevivalDeploymentChoice(viewGame(game, reviver), destination);
  assert.equal(choice.blocked, null); assert.ok(choice.action);
  const sendAction = choice.action, send = transition(() => {
    act(reviver, sendAction);
    reach(state => !state.response && !state.phaseOpening && state.decision?.kind === 'advisor');
  });
  assert.ok(game.decision?.kind === 'advisor'); assert.equal(game.decision.revivalEvent, game.homeworldRevivalReturn?.event);
  const beforeDeclaration = structuredClone(game), originalChooser = structuredClone(game.decision);
  const accompany: Action = { type: 'decision', accept: true, accompany: true, amount: 1 };
  const sink: Action = { type: 'decision', accept: true, accompany: false, amount: 1 };
  const decline: Action = { type: 'decision', accept: false }, nativeAction = stage === 'shipping' ? accompany : sink;
  const declaration = transition(() => { act(owner, nativeAction); });
  assert.equal(game.response?.kind, 'advisor'); assert.ok(game.response?.spiritualAdvisorSource);
  const shippingResponse = structuredClone(game.response), shipping = structuredClone(game);
  const shippingAllowance = stage === 'shipping' ? null : transition(() => { game = allowSemutaSpiritualRevival(game, actions); });
  assert.equal(game.pendingSpiritualAdvisor?.stage, stage);
  assert.ok(game.response && game.pendingSpiritualAdvisor && game.homeworldRevivalReturn && game.homeworldRevivalProgress);
  const automatic = game.response.automaticAdvisorFlip;
  if (stage === 'arrival') assert.ok(automatic?.producer === 'spiritualArrival');
  else assert.ok(game.response.spiritualAdvisorSource);
  assert.equal(game.homeworldRevivalReturn.stage, 'arrival'); assert.equal(game.pendingRevival ?? null, null);
  const source = structuredClone(game), originalResponse = structuredClone(game.response), originalFrame = structuredClone(game.pendingSpiritualAdvisor);
  const originalSource = structuredClone(game.response.spiritualAdvisorSource ??
    (automatic?.producer === 'spiritualArrival' ? automatic.spiritual : undefined));
  assert.ok(originalSource);
  const originalReturn = structuredClone(game.homeworldRevivalReturn), originalProgress = structuredClone(game.homeworldRevivalProgress);
  const originalQueue = structuredClone(game.pendingAutomaticAdvisorFlips ?? []), originalArrival = structuredClone(game.pendingArrivalReaction ?? []);
  assert.ok(originalArrival.some(arrival => arrival.entrant === reviver && arrival.revivalArrival?.event === originalReturn.event));
  assert.equal(originalReturn.resumeResponse?.kind, 'revivalIncome'); assert.equal(originalReturn.resumeResponse?.amount, 1);
  assert.ok(semutaSpiritualRevivalPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID));
  assert.ok(semutaSpiritualRevivalPlayer(game, spender).hand.some(card => card.id === cost));
  homeworldGameIntegrity(game); assert.deepEqual(semutaSpiritualRevivalInventory(game), originalInventory);
  return { game, source, beforeCost: source, stage, advanced: true as const, kind: originalResponse.kind,
    owner, bg: owner, recipient: owner, holder, spender, atreides: spender, seller, richese: seller,
    reviver, tleilaxu: reviver, shipper: reviver, incomeOwner: reviver,
    cost, karama: cost, semuta: SEMUTA_DRUG_ID, action: { type: 'card', card: cost, mode: 'cancel' } as Action,
    nativeAction, accompany, sink, decline, replacementAction: stage === 'matching' ? accompany : null,
    originalResponse, originalFrame, originalSource, originalChooser, originalReturn, originalProgress,
    originalWorldParent: originalReturn, originalParent: originalReturn, originalRetainedIncome: structuredClone(originalReturn.resumeResponse),
    originalPendingRevival: structuredClone(game.pendingRevival ?? null), originalDeposit: structuredClone(originalFrame.deposit ?? null),
    originalAutomaticSource: structuredClone(automatic ?? null), originalQueue, originalArrival,
    originalPhysical: structuredClone(semutaSpiritualRevivalPhysical(game)), originalCustody: structuredClone(game.homeworlds!.custody),
    originalBalances: Object.fromEntries(game.players.map(p => [p.id, p.spice])),
    originalStance: structuredClone(semutaSpiritualRevivalPlayer(game, owner).advisors),
    territory, sector, location, destination, casualtyLocation, revivalAction, sendAction,
    initial, enableHomeworlds, lobby, setup, initialization, beforeStartingDeal, afterSetup, advisorSetup,
    deal: selected.map(card => card.id), dealOrder, originalInventory, originalSpice, spiceOrder,
    firstStorm, acquisition, acquired, shipmentAction, shipment, firstSpiritualDecline,
    beforeStormMovement, stormSource, stormLoss, beforeRequest, freeRevive, returned, send,
    beforeDeclaration, declaration, shipping, shippingResponse, shippingAllowance,
    actions, steps: actions, sourceActions: actions, sourceActionCount: actions.length,
    staging: [
      'Actual original Advanced R/C/BG/A/T exact CHOAM+Ix fresh Semuta initializer after the real Homeworlds lobby option. Only unopened original card/Spice positions and scalar lotteries are selected. Atreides really receives printed base Karama, Tleilaxu its original Face Dancers, and CHOAM actually buys cache1 Semuta.',
      'Actual first Storm dials11+0 end at12. Tleilaxu really pays two to ship one original typed native reserve to Hagga13; BG actually declines that earlier Spiritual choice. Actual next original Storm Card1 ends at13 and destroys it. Real native phases reach turn2 Revival with High19/Tanks1; no played stock, wallet, hand, stance, clock, return, casualty or custody is installed.',
      'Tleilaxu actually revives one ordinary force free, earning original High SEND and retained free-revival income1. The owned original deployment quote sends exactly that counter to Arrakeen10. The native return/progress stays at arrival, queued entry carries the original revival event, and pendingRevival is already cleared by its real completion.',
      stage === 'matching'
        ? 'BG’s original setup placed a native fighter in empty Polar. After SEND, BG actually declares fallback1 and passes the original shipping counter; stop before the separate matching placement. Denial restores the original chooser, with actual accompaniment1 into the SEND territory or decline still legal.'
        : stage === 'arrival'
          ? 'BG’s original advisorSetup is beside A10 Arrakeen. After SEND, BG actually declares free Polar1 and passes shipping. The real native reserve withdrawal/deposit opens its independent spiritualArrival alone-conversion counter; stop with the whole return/income parent retained.'
          : 'BG’s original advisorSetup is beside A10 Arrakeen. After SEND, BG actually declares accompaniment1 and stops at shipping before withdrawing any BG reserve. The revived T counter and original return/income remain committed.',
    ],
  };
}
export type SemutaSpiritualRevivalFixture = ReturnType<typeof createSemutaSpiritualRevivalFixture>;
