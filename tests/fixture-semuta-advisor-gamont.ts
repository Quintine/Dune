import assert from 'node:assert/strict';
import { createGame, initializeSemutaGameForAudit, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { isAdvisor } from '../game/advisors';
import { strongholdProgress } from '../game/victory-progress';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';
import {
  actSemutaAdvisorMatching, nextSemutaAdvisorMatching, passSemutaAdvisorMatching, claimSemutaAdvisorMatching,
  semutaAdvisorMatchingPlayer, semutaAdvisorMatchingInventory,
} from './fixture-semuta-advisor-matching';

export type SemutaAdvisorGamontStep = { actor: string; action: Action };
export const actSemutaAdvisorGamont = actSemutaAdvisorMatching;
export const passSemutaAdvisorGamont = passSemutaAdvisorMatching;
export const claimSemutaAdvisorGamont = claimSemutaAdvisorMatching;
export const semutaAdvisorGamontPlayer = semutaAdvisorMatchingPlayer;
export const semutaAdvisorGamontInventory = semutaAdvisorMatchingInventory;
export const semutaAdvisorGamontClean = (game: Game) => !game.response && !game.phaseOpening && !game.decision &&
  !game.truthtrance && !game.pendingTreacheryDiscard && !game.pendingAutomaticAdvisorGamont && !game.pendingAutomaticAdvisorFlips?.length;
export const semutaAdvisorGamontPhysical = (game: Game) => game.players.map(p => ({ id: p.id, spice: p.spice,
  forces: p.forces, elites: p.elites, reserves: p.reserves, tanks: p.tanks,
  shipped: p.shipped, moved: p.moved, revived: p.revived, freeForcesRevived: p.freeForcesRevived }));
export const semutaAdvisorGamontStrongholds = (game: Game, id: string) =>
  strongholdProgress(game).progress.find(p => p.player === id)!.strongholds;

/** Native markets close without selling the held fuel. Original final CHOAM
 * confirmation, conversion and every fresh group remain caller-owned. */
export function nextSemutaAdvisorGamont(game: Game): SemutaAdvisorGamontStep | null {
  if (!game.response && !game.phaseOpening && !game.pendingTreacheryDiscard && game.decision?.kind === 'choamMentat') return null;
  return nextSemutaAdvisorMatching(game);
}
export const nextSemutaAdvisorGamontStep = nextSemutaAdvisorGamont;
export function advanceSemutaAdvisorGamont(game: Game, until: (state: Game) => boolean,
  actions: SemutaAdvisorGamontStep[] = []): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const step = nextSemutaAdvisorGamont(game);
    assert.ok(step, `Choose the original Gamont/conversion/final control at ${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = actSemutaAdvisorGamont(game, step.actor, step.action, actions);
  }
  throw Error('The native Semuta/Gamont programme did not reach its finite boundary');
}
export function allowSemutaAdvisorGamont(game: Game, actions: SemutaAdvisorGamontStep[] = []): Game {
  const source = game.response?.automaticAdvisorFlip; assert.ok(source?.producer === 'gamont');
  for (let count = 0; game.response?.automaticAdvisorFlip?.event === source.event && count < game.players.length; count++) {
    const actor = game.players.find(p => !game.response!.passed.includes(p.id)); assert.ok(actor);
    game = actSemutaAdvisorGamont(game, actor.id, { type: 'passResponse' }, actions);
  }
  assert.notEqual(game.response?.automaticAdvisorFlip?.event, source.event); return game;
}
/** Settle this original conversion only. Stop at ordinary Mentat or the
 * restored final chooser, before any actual victory confirmation. */
export function finishSemutaAdvisorGamont(game: Game, actions: SemutaAdvisorGamontStep[] = []): Game {
  assert.equal(game.pendingTreacheryDiscard ?? null, null, 'Choose the original fresh cost first');
  return advanceSemutaAdvisorGamont(game, state => !state.response && !state.phaseOpening &&
    !state.pendingTreacheryDiscard && !state.pendingAutomaticAdvisorGamont && !state.pendingAutomaticAdvisorFlips?.length &&
    (!state.decision || state.decision.kind === 'choamMentat'), actions);
}
/** Explicit original ready/market/final-confirmation actions, after the caller
 * has resolved conversion. No synthetic victory or next turn is assigned. */
export function closeSemutaAdvisorGamont(game: Game, actions: SemutaAdvisorGamontStep[] = []): Game {
  const turn = game.turn;
  for (let count = 0; count < 160; count++) {
    if (game.status === 'finished' || game.turn > turn) return game;
    assert.ok(!game.response && !game.pendingTreacheryDiscard && !game.pendingAutomaticAdvisorGamont &&
      !game.pendingAutomaticAdvisorFlips?.length, 'Resolve the actual conversion/fresh cost before confirming Mentat');
    const step = game.decision?.kind === 'choamMentat' && !game.phaseOpening
      ? { actor: game.decision.player, action: { type: 'decision', done: true } satisfies Action }
      : nextSemutaAdvisorGamont(game);
    assert.ok(step); game = actSemutaAdvisorGamont(game, step.actor, step.action, actions);
  }
  throw Error('The original Gamont Mentat did not reach victory or its next turn');
}

/** Genuine paid Semuta and original Gamont/Karama. A native return and its
 * completed fuel disposal earn the automatic conversion source before cost. */
export function createSemutaAdvisorGamontFixture(options: { final?: boolean } = {}) {
  const final = options.final ?? true, seller = 'richese', holder = 'choam', owner = 'beneGesserit', spender = 'atreides';
  const territory = 'arrakeen', location = 'arrakeen:10';
  let game = createGame('SEMUTAADVISORGAMONT', newPlayer(seller, 'Richese', 'richese'), true, ['choam']);
  for (const faction of ['choam', 'beneGesserit', 'atreides'] as const) joinGame(game, newPlayer(faction, faction, faction));
  const initial = structuredClone(game), actions: SemutaAdvisorGamontStep[] = [];
  const act = (actor: string, action: Action) => { game = actSemutaAdvisorGamont(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceSemutaAdvisorGamont(game, until, actions); };
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
  const originalInventory = semutaAdvisorGamontInventory(game); assert.equal(originalInventory.length, 45);
  const printed = game.deck.find(card => card.effect === 'karama'), gamontCard = game.deck.find(card => card.name === 'Trip to Gamont');
  const ordinary = game.deck.filter(card => card.kind === 'projectile').slice(0, 2); assert.equal(ordinary.length, 2);
  assert.ok(printed && gamontCard);
  const selected = [ordinary[0], gamontCard, ordinary[1], printed], dealOrder = selected.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card.id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: card.id };
  });
  const beforeStartingDeal = structuredClone(game);
  let advisorSetup: { before: Game; steps: SemutaAdvisorGamontStep[]; after: Game } | null = null;
  for (let count = 0; game.status === 'setup' && count < 100; count++) {
    const step = nextSemutaAdvisorGamont(game); assert.ok(step);
    const before = step.action.type === 'advisorSetup' ? structuredClone(game) : null;
    act(step.actor, step.action);
    if (before) advisorSetup = { before, steps: [structuredClone(step)], after: structuredClone(game) };
  }
  assert.equal(game.status, 'playing'); assert.ok(advisorSetup);
  const afterSetup = structuredClone(game), cost = printed.id, gamont = gamontCard.id;
  assert.deepEqual(game.players.flatMap(p => p.hand.map(card => card.id)), selected.map(card => card.id));
  assert.equal(semutaAdvisorGamontPlayer(game, owner).forces[location], 1); assert.equal(isAdvisor(semutaAdvisorGamontPlayer(game, owner), territory), true);
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder: { position: number; from: number; card: Game['spiceDeck'][number] }[] = [];
  for (const [position, face] of ['funeral_plain', 'hagga_basin'].entries()) {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && card.territory === face && !card.discovery);
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0]; game.spiceDeck.splice(position, 0, card);
    spiceOrder.push({ position, from, card: structuredClone(card) });
  }
  let beforeBid: Game | undefined, bid: SemutaAdvisorGamontStep | undefined, bidAt = -1;
  for (let count = 0; count < 900 && !semutaAdvisorGamontPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID); count++) {
    const step = nextSemutaAdvisorGamont(game); assert.ok(step);
    if (step.actor === holder && step.action.type === 'richeseBid' && step.action.amount === 1) {
      beforeBid = structuredClone(game); bid = structuredClone(step); bidAt = actions.length;
    }
    act(step.actor, step.action);
  }
  assert.ok(beforeBid && bid && bidAt >= 0);
  const acquired = structuredClone(game), acquisition = { before: beforeBid, bid,
    steps: structuredClone(actions.slice(bidAt)), after: acquired, price: 1 };
  assert.equal(semutaAdvisorGamontPlayer(beforeBid, holder).spice - semutaAdvisorGamontPlayer(game, holder).spice, 1);
  reach(state => state.phase === 5 && !state.response && !state.phaseOpening && state.decision?.kind === 'advisorBattle');
  const declinedPreparation = transition(() => {
    act(owner, { type: 'decision', accept: false });
    reach(state => state.phase === 5 && state.active === owner && semutaAdvisorGamontClean(state));
  });
  const bgShipment = transition(() => {
    act(owner, { type: 'ship', territory: 'carthag', sector: 11, amount: 2, elite: 0, allyPayment: 0 });
    reach(semutaAdvisorGamontClean);
  });
  assert.equal(semutaAdvisorGamontPlayer(bgShipment.before, owner).spice - semutaAdvisorGamontPlayer(game, owner).spice, 2);
  const bgMovement = transition(() => {
    act(owner, { type: 'move', from: 'carthag:11', territory: 'sietch_tabr', sector: 14, amount: 1, elite: 0 });
    reach(semutaAdvisorGamontClean); act(owner, { type: 'endMovement' });
  });
  reach(state => state.phase === 5 && state.active === spender && semutaAdvisorGamontClean(state));
  const outsiderDeparture = transition(() => {
    act(spender, { type: 'move', from: location, territory: 'imperial_basin', sector: 10, amount: 9, elite: 0 });
    reach(semutaAdvisorGamontClean);
  });
  assert.equal(semutaAdvisorGamontPlayer(game, spender).forces[location], 1);
  reach(state => state.turn === 1 && state.phase === 8 && semutaAdvisorGamontClean(state));
  const ordinaryMentat = structuredClone(game);
  if (final) reach(state => state.phase === 8 && !state.response && !state.phaseOpening && state.decision?.kind === 'choamMentat');
  const beforeGamont = structuredClone(game);
  assert.equal(semutaAdvisorGamontStrongholds(game, owner).length, 2);
  const gamontAction: Action = { type: 'card', mode: 'choam', card: gamont, target: spender, from: location, elite: 0 };
  act(holder, gamontAction);
  const declaredGamont = structuredClone(game), gamontAt = actions.length - 1;
  const fuelDisposals: { before: Game; steps: SemutaAdvisorGamontStep[]; after: Game; event: string }[] = [];
  for (let count = 0; game.response?.automaticAdvisorFlip?.producer !== 'gamont' && count < 70; count++) {
    if (game.pendingTreacheryDiscard) {
      const pending: NonNullable<Game['pendingTreacheryDiscard']> = game.pendingTreacheryDiscard;
      assert.equal(pending.continuation.kind, 'choamGamontDiscard');
      assert.deepEqual(pending.batch.entries.map(entry => ({ card: entry.card.id, by: entry.discardedBy })), [{ card: gamont, by: holder }]);
      assert.equal(viewGame(game, holder).semutaReaction?.canCommit ?? false, false, 'Semuta cannot claim its own holder’s fuel');
      fuelDisposals.push({ ...transition(() => { game = passSemutaAdvisorGamont(game, actions); }), event: pending.batch.event });
    } else {
      assert.equal(game.response?.kind, 'choamWorthless');
      const actor = game.players.find(p => !game.response!.passed.includes(p.id)); assert.ok(actor);
      act(actor.id, { type: 'passResponse' });
    }
  }
  const automatic = game.response?.automaticAdvisorFlip; assert.ok(automatic?.producer === 'gamont');
  assert.ok(game.pendingAutomaticAdvisorGamont && game.pendingAutomaticAdvisorFlips?.length);
  assert.equal(semutaAdvisorGamontPlayer(game, spender).forces[location] ?? 0, 0);
  assert.equal(semutaAdvisorGamontPlayer(game, spender).reserves, semutaAdvisorGamontPlayer(beforeGamont, spender).reserves + 1);
  assert.equal(game.discard.filter(card => card.id === gamont).length, 1);
  assert.ok(semutaAdvisorGamontPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID));
  assert.ok(semutaAdvisorGamontPlayer(game, spender).hand.some(card => card.id === cost));
  assert.equal(game.pendingTreacheryDiscard ?? null, null); assert.equal(game.status, 'playing'); assert.deepEqual(game.winner, []);
  const source = structuredClone(game), originalResponse = structuredClone(game.response!);
  const originalAutomaticSource = structuredClone(automatic), originalParent = structuredClone(game.pendingAutomaticAdvisorGamont);
  const originalQueue = structuredClone(game.pendingAutomaticAdvisorFlips);
  const originalStance = structuredClone(semutaAdvisorGamontPlayer(game, owner).advisors![territory]);
  assert.equal(originalStance.aloneFlipHold, automatic.event);
  const action: Action = { type: 'card', card: cost, mode: 'cancel' };
  const chooser = final ? { kind: 'choamMentat' as const, player: holder } : null;
  const originalContinuation = { chooser, ready: [...game.ready], choamMentatPending: game.choamMentatPending };
  assert.deepEqual(semutaAdvisorGamontInventory(game), originalInventory);
  return { game, source, beforeCost: source, final, advanced: true as const, owner, bg: owner, holder, choam: holder,
    actor: holder, spender, target: spender, atreides: spender, seller, richese: seller, recipient: owner,
    cost, karama: cost, semuta: SEMUTA_DRUG_ID, gamont, card: gamont, action, nativeAction: gamontAction, gamontAction,
    originalResponse, originalAutomaticSource, originalParent, originalQueue, originalStance, originalContinuation,
    effect: structuredClone(originalParent.receipt),
    originalPhysical: structuredClone(semutaAdvisorGamontPhysical(game)), chooser,
    confirmationActor: holder, confirmationAction: { type: 'decision', done: true } satisfies Action,
    territory, location, from: location, to: 'reserves', initial, lobby, setup, initialization, beforeStartingDeal,
    afterSetup, advisorSetup, deal: selected.map(card => card.id), dealOrder, originalInventory, originalSpice, spiceOrder,
    acquisition, acquired, declinedPreparation, bgShipment, bgMovement, outsiderDeparture, ordinaryMentat,
    beforeGamont, declaredGamont, fuelDisposals,
    gamontHistory: { before: beforeGamont, steps: structuredClone(actions.slice(gamontAt)), after: source },
    nearWin: { fighters: ['carthag', 'sietch_tabr'], advisors: [territory], lastOutsider: spender },
    actions, steps: actions, sourceActions: actions, sourceActionCount: actions.length,
    staging: [
      'Original Advanced Semuta initializer on the genuinely ready undealt R/C/BG/A lobby, exact CHOAM/main35/cache10 and no modules. Only unopened original card/Spice positions and scalar lotteries are selected. Atreides really receives printed Karama; CHOAM really receives Gamont and pays cache1 for Semuta.',
      'BG really predicts and places its original advisor beside A10 Arrakeen10, declines native preparation, pays two for two Carthag fighters and uses actual city range to move one to Tabr14. Atreides really moves nine home counters to Basin10, leaving one beside the advisor. Native Collection earns the two genuine fighter-held strongholds.',
      final ? 'Original Mentat readiness and closing market really finish before the native final CHOAM chooser. The held original Gamont is then actually declared and its native Worthless counter allowed.' : 'At actual clean ordinary Mentat, the held original Gamont is really declared and its native Worthless counter allowed.',
      'The actual Gamont fuel leaves CHOAM’s hand once and its disposal completes before the last A counter returns and opens BG’s mandatory conversion. CHOAM’s own Semuta never claims its own fuel; any observed original disposal receives real passes, and no fake reaction window is installed.',
      'Stop before Atreides spends the retained printed Karama. Original returned counter, discarded fuel, automatic queue/parent and alone stance hold are native. No played hand, wallet, force, stance, clock, parent or victory is assigned; final confirmation remains an actual original action.',
    ],
  };
}
export type SemutaAdvisorGamontFixture = ReturnType<typeof createSemutaAdvisorGamontFixture>;
