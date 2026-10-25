import assert from 'node:assert/strict';
import { createGame, initializeSemutaGameForAudit, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { advisorMatchingKey, validateAdvisorMatching } from '../game/advisor-matching';
import { isAdvisor } from '../game/advisors';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';
import {
  actSemutaDisasterWorm, passSemutaDisasterWorm, claimSemutaDisasterWorm,
  semutaDisasterWormPlayer, semutaDisasterWormInventory,
} from './fixture-semuta-disaster-worm';
import { nextSemutaRicheseCacheKarama } from './fixture-semuta-richese-cache-karama';

export type SemutaAdvisorMatchingDirection = 'fightersToAdvisors' | 'advisorsToFighters';
export type SemutaAdvisorMatchingStep = { actor: string; action: Action };
export const actSemutaAdvisorMatching = actSemutaDisasterWorm;
export const passSemutaAdvisorMatching = passSemutaDisasterWorm;
export const claimSemutaAdvisorMatching = claimSemutaDisasterWorm;
export const semutaAdvisorMatchingPlayer = semutaDisasterWormPlayer;
export const semutaAdvisorMatchingInventory = semutaDisasterWormInventory;
export const semutaAdvisorMatchingClean = (game: Game) => !game.response && !game.phaseOpening && !game.decision &&
  !game.truthtrance && !game.pendingTreacheryDiscard && !game.pendingAdvisorMatching && !game.pendingRevival;
export const semutaAdvisorMatchingPhysical = (game: Game) => game.players.map(p => ({ id: p.id, spice: p.spice,
  forces: p.forces, advisors: p.advisors, elites: p.elites, reserves: p.reserves, tanks: p.tanks,
  shipped: p.shipped, moved: p.moved, ally: p.ally }));

/** Decline the original preparation and other optional stances through actual
 * choices. Matching/automatic counters and fresh groups stay caller-owned. */
export function nextSemutaAdvisorMatching(game: Game): SemutaAdvisorMatchingStep | null {
  if (game.pendingTreacheryDiscard || game.truthtrance || game.response?.kind === 'advisorFlip') return null;
  if (!game.phaseOpening && !game.response) {
    if (game.status === 'setup' && game.setupStage === 'prediction')
      return { actor: 'beneGesserit', action: { type: 'predict', faction: 'atreides', turn: 10 } };
    const bg = game.players.find(p => p.faction === 'beneGesserit');
    if (game.status === 'setup' && game.setupStage === 'forces' && bg && !bg.advisorSetup &&
        viewGame(game, bg.id).setupPending.includes(bg.id))
      return { actor: bg.id, action: { type: 'advisorSetup', territory: 'arrakeen', sector: 10 } };
    if (game.decision?.kind === 'advisorBattle' || game.decision?.kind === 'advisor' || game.decision?.kind === 'intrusion')
      return { actor: game.decision.player, action: { type: 'decision', accept: false } };
  }
  return nextSemutaRicheseCacheKarama(game);
}
export const nextSemutaAdvisorMatchingStep = nextSemutaAdvisorMatching;
export function advanceSemutaAdvisorMatching(game: Game, until: (state: Game) => boolean,
  actions: SemutaAdvisorMatchingStep[] = []): Game {
  for (let count = 0; count < 1700; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const step = nextSemutaAdvisorMatching(game);
    assert.ok(step, `Choose the native matching/fresh response at ${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = actSemutaAdvisorMatching(game, step.actor, step.action, actions);
  }
  throw Error('The original advisor-matching source did not reach its finite boundary');
}
export function allowSemutaAdvisorMatching(game: Game, actions: SemutaAdvisorMatchingStep[] = []): Game {
  const event = game.response?.advisorMatchingSource?.event; assert.ok(event);
  for (let count = 0; game.response?.advisorMatchingSource?.event === event && count < game.players.length; count++) {
    const actor = game.players.find(p => !game.response!.passed.includes(p.id)); assert.ok(actor);
    game = actSemutaAdvisorMatching(game, actor.id, { type: 'passResponse' }, actions);
  }
  assert.notEqual(game.response?.advisorMatchingSource?.event, event); return game;
}
/** Complete only the original allowed/canceled move's native suffix and stop
 * at BG's same movement boundary. No new declaration or turn end is chosen. */
export function finishSemutaAdvisorMatching(game: Game, actions: SemutaAdvisorMatchingStep[] = []): Game {
  assert.equal(game.pendingTreacheryDiscard ?? null, null, 'Choose the original fresh cost first');
  return advanceSemutaAdvisorMatching(game, semutaAdvisorMatchingClean, actions);
}

/** Original Advanced R/C/BG/A/E setup, actual cache1 purchase and paid separate
 * fighter group. Both directions earn their real uncommitted matching source. */
export function createSemutaAdvisorMatchingFixture(options: { direction?: SemutaAdvisorMatchingDirection } = {}) {
  const direction = options.direction ?? 'fightersToAdvisors', seller = 'richese', holder = 'choam';
  const owner = 'beneGesserit', atreides = 'atreides', spender = 'emperor';
  let game = createGame('SEMUTAADVISORMATCHING', newPlayer(seller, 'Richese', 'richese'), true, ['choam']);
  for (const faction of ['choam', 'beneGesserit', 'atreides', 'emperor'] as const) joinGame(game, newPlayer(faction, faction, faction));
  const initial = structuredClone(game), actions: SemutaAdvisorMatchingStep[] = [];
  const act = (actor: string, action: Action) => { game = actSemutaAdvisorMatching(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceSemutaAdvisorMatching(game, until, actions); };
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
  assert.ok(game.players.every(p => p.hand.length === 0));
  assert.ok(!game.homeworlds && !game.nexusCards && !game.leaderSkills && !game.techTokens &&
    !game.strongholdCards && !game.discoveryEnabled && !game.ecazTreachery);
  const originalInventory = semutaAdvisorMatchingInventory(game); assert.equal(originalInventory.length, 45);
  const printed = game.deck.find(card => card.effect === 'karama'), shield = game.deck.find(card => card.kind === 'shield');
  const ordinary = game.deck.filter(card => card.kind === 'projectile').slice(0, 3); assert.equal(ordinary.length, 3);
  assert.ok(printed && shield);
  const selected = [ordinary[0], ordinary[1], shield, ordinary[2], printed], dealOrder = selected.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card.id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: card.id };
  });
  const beforeStartingDeal = structuredClone(game);
  let advisorSetup: { before: Game; steps: SemutaAdvisorMatchingStep[]; after: Game } | null = null;
  for (let count = 0; game.status === 'setup' && count < 100; count++) {
    const step = nextSemutaAdvisorMatching(game); assert.ok(step);
    const before = step.action.type === 'advisorSetup' ? structuredClone(game) : null;
    act(step.actor, step.action);
    if (before) advisorSetup = { before, steps: [structuredClone(step)], after: structuredClone(game) };
  }
  assert.equal(game.status, 'playing'); assert.ok(advisorSetup);
  const afterSetup = structuredClone(game), cost = printed.id;
  assert.deepEqual(game.players.flatMap(p => p.hand.map(card => card.id)), selected.map(card => card.id));
  assert.equal(semutaAdvisorMatchingPlayer(game, owner).forces['arrakeen:10'], 1);
  assert.equal(isAdvisor(semutaAdvisorMatchingPlayer(game, owner), 'arrakeen'), true);
  assert.equal(semutaAdvisorMatchingPlayer(game, atreides).forces['arrakeen:10'], 10);
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder: { position: number; from: number; card: Game['spiceDeck'][number] }[] = [];
  for (const [position, face] of ['funeral_plain', 'hagga_basin'].entries()) {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && card.territory === face && !card.discovery);
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0]; game.spiceDeck.splice(position, 0, card);
    spiceOrder.push({ position, from, card: structuredClone(card) });
  }
  let beforeBid: Game | undefined, bid: SemutaAdvisorMatchingStep | undefined, bidAt = -1;
  for (let count = 0; count < 900 && !semutaAdvisorMatchingPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID); count++) {
    const step = nextSemutaAdvisorMatching(game); assert.ok(step);
    if (step.actor === holder && step.action.type === 'richeseBid' && step.action.amount === 1) {
      beforeBid = structuredClone(game); bid = structuredClone(step); bidAt = actions.length;
    }
    act(step.actor, step.action);
  }
  assert.ok(beforeBid && bid && bidAt >= 0);
  const acquired = structuredClone(game), acquisition = { before: beforeBid, bid,
    steps: structuredClone(actions.slice(bidAt)), after: acquired, price: 1 };
  assert.equal(semutaAdvisorMatchingPlayer(beforeBid, holder).spice - semutaAdvisorMatchingPlayer(game, holder).spice, 1);
  reach(state => state.phase === 5 && !state.response && !state.phaseOpening && state.decision?.kind === 'advisorBattle');
  const declinedPreparation = transition(() => {
    act(owner, { type: 'decision', accept: false });
    reach(state => state.phase === 5 && state.active === owner && semutaAdvisorMatchingClean(state));
  });
  const shipment = transition(() => {
    act(owner, { type: 'ship', territory: 'imperial_basin', sector: 9, amount: 1, elite: 0, allyPayment: 0 });
    reach(semutaAdvisorMatchingClean);
  });
  assert.equal(semutaAdvisorMatchingPlayer(shipment.before, owner).spice - semutaAdvisorMatchingPlayer(game, owner).spice, 2);
  const beforeDeclaration = structuredClone(game), bg = semutaAdvisorMatchingPlayer(game, owner);
  assert.equal(bg.forces['arrakeen:10'], 1); assert.equal(bg.forces['imperial_basin:9'], 1);
  assert.equal(isAdvisor(bg, 'arrakeen'), true); assert.equal(isAdvisor(bg, 'imperial_basin'), false);
  assert.equal(bg.shipped, true); assert.equal(bg.moved, 0); assert.equal(bg.reserves, 18);
  const origin = direction === 'fightersToAdvisors' ? 'imperial_basin' : 'arrakeen';
  const destination = direction === 'fightersToAdvisors' ? 'arrakeen' : 'imperial_basin';
  const sourceLocation = direction === 'fightersToAdvisors' ? 'imperial_basin:9' : 'arrakeen:10';
  const destinationLocation = direction === 'fightersToAdvisors' ? 'arrakeen:10' : 'imperial_basin:9';
  const nativeAction: Action = { type: 'move', from: sourceLocation, amount: 1, elite: 0,
    territory: destination, sector: direction === 'fightersToAdvisors' ? 10 : 9 };
  const declaration = transition(() => { act(owner, nativeAction); });
  assert.ok(game.response?.advisorMatchingSource && game.pendingAdvisorMatching);
  assert.equal(game.response.kind, 'advisorFlip'); assert.equal(game.response.owner, owner);
  const originalResponse = structuredClone(game.response), originalPending = structuredClone(game.pendingAdvisorMatching);
  assert.equal(originalPending.intent.kind, 'movement');
  if (originalPending.intent.kind !== 'movement') throw Error('Expected the original ordinary ground-movement order');
  const receipt = structuredClone(game.response.advisorMatchingSource), originalOrder = structuredClone(originalPending.intent.order);
  validateAdvisorMatching(game, receipt); assert.deepEqual(originalPending.receipt, receipt);
  assert.deepEqual(semutaAdvisorMatchingPhysical(game), semutaAdvisorMatchingPhysical(beforeDeclaration));
  const action: Action = { type: 'card', card: cost, mode: 'cancel' };
  const replacementAction: Action = { type: 'move', from: 'imperial_basin:9', amount: 1, elite: 0,
    territory: 'imperial_basin', sector: 10 };
  const source = structuredClone(game), denialKey = advisorMatchingKey(receipt);
  assert.deepEqual(semutaAdvisorMatchingInventory(game), originalInventory);
  return { game, source, beforeCost: source, advanced: true as const, kind: 'advisorMatching' as const, direction,
    owner, bg: owner, holder, spender, emperor: spender, atreides, seller, richese: seller, recipient: owner,
    cost, karama: cost, semuta: SEMUTA_DRUG_ID, action, nativeAction, actor: owner,
    replacementActor: owner, replacementAction, ordinaryAction: replacementAction,
    originalResponse, originalPending, pending: originalPending, receipt, originalOrder, order: originalOrder, denialKey,
    originalDenied: [...(game.advisorMatchingDenied ?? [])], originalPhysical: structuredClone(semutaAdvisorMatchingPhysical(game)),
    origin, destination, sourceLocation, destinationLocation, from: sourceLocation, to: destinationLocation,
    initial, lobby, setup, initialization, beforeStartingDeal, afterSetup, advisorSetup,
    deal: selected.map(card => card.id), dealOrder, originalInventory, originalSpice, spiceOrder,
    acquisition, acquired, declinedPreparation, shipment, beforeDeclaration, declaration,
    actions, steps: actions, sourceActions: actions, sourceActionCount: actions.length,
    staging: [
      'Original Advanced Semuta initializer on the genuinely ready undealt R/C/BG/A/E lobby, exact CHOAM/main35/cache10 and no modules. Only original unopened starting-card/Spice positions and scalar lotteries are selected. Emperor really receives printed Karama; CHOAM really pays cache1 for Semuta.',
      'BG actually predicts, then actually places its native advisor at Arrakeen10 beside Atreides’ original ten. Real first Storm, both Spice blows, Charity, auctions and Revival execute; original advisor preparation is actually declined.',
      'During its actual first turn BG really pays two for one original reserve into empty Basin9 as fighter. Its original Arrakeen advisor remains. The owned ordinary one-counter ground move really declares the selected opposite-stance arrival and earns the native advisorMatchingSource before any transfer, payment or movement use.',
      'Stop before Emperor spends its originally dealt printed Karama. No hand, force, stance, wallet, clock, allowance, denial key, response or uncommitted order is installed. A canceled source can use the genuinely earned Basin fighter’s same-type sector9→10 reposition as its actual alternate move; no denied conversion is forced.',
    ],
  };
}
export type SemutaAdvisorMatchingFixture = ReturnType<typeof createSemutaAdvisorMatchingFixture>;
