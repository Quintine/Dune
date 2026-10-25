import assert from 'node:assert/strict';
import { applyAction, createGame, initializeSemutaGameForAudit, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { isAdvisor } from '../game/advisors';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { traitorDeck } from '../game/traitors';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';
import { advisorBattleFlipTraitors } from './fixture-advisor-battle-flip';
import {
  actSemutaAdvisorMatching, nextSemutaAdvisorMatching, passSemutaAdvisorMatching, claimSemutaAdvisorMatching,
  semutaAdvisorMatchingPlayer, semutaAdvisorMatchingInventory,
} from './fixture-semuta-advisor-matching';

export type SemutaAdvisorBattleStep = { actor: string; action: Action };
export const actSemutaAdvisorBattle = actSemutaAdvisorMatching;
export const passSemutaAdvisorBattle = passSemutaAdvisorMatching;
export const claimSemutaAdvisorBattle = claimSemutaAdvisorMatching;
export const semutaAdvisorBattlePlayer = semutaAdvisorMatchingPlayer;
export const semutaAdvisorBattleInventory = semutaAdvisorMatchingInventory;
export const semutaAdvisorBattleTraitors = advisorBattleFlipTraitors;
export const semutaAdvisorBattleClean = (game: Game) => !game.response && !game.phaseOpening && !game.decision &&
  !game.truthtrance && !game.pendingTreacheryDiscard;
/** Collection legitimately changes balances after original cleanup; preserve
 * committed physical loss/leader/usage facts separately from those balances. */
export const semutaAdvisorBattlePhysical = (game: Game) => game.players.map(p => ({ id: p.id, forces: p.forces,
  elites: p.elites, reserves: p.reserves, tanks: p.tanks, battleLosses: p.battleLosses, leaders: p.leaders,
  shipped: p.shipped, moved: p.moved, revived: p.revived, freeForcesRevived: p.freeForcesRevived }));

/** Native preparation/readiness only. Private plans/votes, mandatory fresh
 * disposal and the new automatic response are explicit caller choices. */
export function nextSemutaAdvisorBattle(game: Game): SemutaAdvisorBattleStep | null {
  if (game.pendingTreacheryDiscard || game.truthtrance || game.response?.automaticAdvisorFlip) return null;
  if (!game.response && !game.phaseOpening) {
    if (game.decision?.kind === 'battleCards') return null;
    if (game.status === 'setup' && game.setupStage === 'traitors') {
      const player = game.players.find(p => p.traitorChoices.length); assert.ok(player);
      const leader = player.faction === 'atreides' && player.traitorChoices.includes('harkonnen-3')
        ? 'harkonnen-3' : player.traitorChoices[0];
      return { actor: player.id, action: { type: 'traitor', leader } };
    }
    const outcome = game.battle?.outcomeWindow;
    if (!game.decision && outcome && !outcome.closed) {
      const actor = [outcome.attacker, outcome.defender].find(id => !outcome.ready.includes(id)); assert.ok(actor);
      return { actor, action: { type: 'battleOutcomeReady', event: outcome.event } };
    }
    if (game.battle?.revealed && viewGame(game, game.host).battle?.traitorVoters.some(id => game.battle!.traitorCalls[id] === undefined)) return null;
  }
  return nextSemutaAdvisorMatching(game);
}
export const nextSemutaAdvisorBattleStep = nextSemutaAdvisorBattle;
export function advanceSemutaAdvisorBattle(game: Game, until: (state: Game) => boolean,
  actions: SemutaAdvisorBattleStep[] = []): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const step = nextSemutaAdvisorBattle(game);
    assert.ok(step, `Choose the original battle/fresh control at ${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = actSemutaAdvisorBattle(game, step.actor, step.action, actions);
  }
  throw Error('The native Semuta/advisor battle did not reach its finite boundary');
}
export function allowSemutaAdvisorBattle(game: Game, actions: SemutaAdvisorBattleStep[] = []): Game {
  const source = game.response?.automaticAdvisorFlip; assert.ok(source?.producer === 'battleLosses');
  for (let count = 0; game.response?.automaticAdvisorFlip?.event === source.event && count < game.players.length; count++) {
    const actor = game.players.find(p => !game.response!.passed.includes(p.id)); assert.ok(actor);
    game = actSemutaAdvisorBattle(game, actor.id, { type: 'passResponse' }, actions);
  }
  assert.notEqual(game.response?.automaticAdvisorFlip?.event, source.event); return game;
}
/** Keep the genuine optional winner Shield via its actual reply, then finish
 * original cleanup to Collection. No fresh group or conversion is bypassed. */
export function finishSemutaAdvisorBattle(game: Game, actions: SemutaAdvisorBattleStep[] = []): Game {
  for (let count = 0; count < 250; count++) {
    if (!game.battle && game.phase === 7 && semutaAdvisorBattleClean(game)) return game;
    assert.ok(!game.pendingTreacheryDiscard && !game.response?.automaticAdvisorFlip,
      'Resolve the original fresh/conversion choice before native battle cleanup');
    const step = game.decision?.kind === 'battleCards' && !game.response && !game.phaseOpening
      ? { actor: game.decision.player, action: { type: 'decision', discard: [] } satisfies Action }
      : nextSemutaAdvisorBattle(game);
    assert.ok(step); game = actSemutaAdvisorBattle(game, step.actor, step.action, actions);
  }
  throw Error('The original battle cleanup did not reach Collection');
}

/** Only original undealt Fisher-Yates draws, consumed by actual prediction. */
function originalTraitorScalars(original: string[], desired: string[]) {
  assert.deepEqual([...original].sort(), [...desired].sort());
  const current = [...original], scalars: number[] = [];
  for (let i = current.length - 1; i > 0; i--) {
    const j = current.indexOf(desired[i]); assert.ok(j >= 0 && j <= i);
    scalars.push(Math.floor((j + 0.5) * 4294967296 / (i + 1)));
    [current[i], current[j]] = [current[j], current[i]];
  }
  assert.deepEqual(current, desired); return scalars;
}
function predictOriginalTraitors(game: Game, actor: string, action: Action, scalars: number[], actions: SemutaAdvisorBattleStep[]) {
  assert.equal(game.setupStage, 'prediction'); assert.ok(game.players.every(p => !p.traitors.length && !p.traitorChoices.length));
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const native = crypto.getRandomValues.bind(crypto); let cursor = 0;
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array && array.length === 1) {
      assert.ok(cursor < scalars.length); array[0] = scalars[cursor++];
    } else Reflect.apply(native, crypto, [array]);
    return array;
  };
  try {
    const next = applyAction(game, actor, action); assert.equal(cursor, scalars.length);
    actions.push({ actor, action: structuredClone(action) }); return next;
  } finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}

/** Genuine native Advanced losses before the new cancellation. No played
 * force, leader, hand, traitor, battle, stance, clock or pending frame is set. */
export function createSemutaAdvisorBattleFixture(options: { mutualTraitors?: boolean } = {}) {
  const mutualTraitors = options.mutualTraitors ?? false, seller = 'richese', holder = 'choam', owner = 'beneGesserit';
  const atreides = 'atreides', harkonnen = 'harkonnen', spender = seller, territory = 'arrakeen', location = 'arrakeen:10';
  let game = createGame('SEMUTAADVISORBATTLE', newPlayer(seller, 'Richese', 'richese'), true, ['choam']);
  for (const faction of ['choam', 'beneGesserit', 'atreides', 'harkonnen'] as const) joinGame(game, newPlayer(faction, faction, faction));
  const initial = structuredClone(game), actions: SemutaAdvisorBattleStep[] = [];
  const act = (actor: string, action: Action) => { game = actSemutaAdvisorBattle(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceSemutaAdvisorBattle(game, until, actions); };
  const transition = (run: () => void) => {
    const before = structuredClone(game), at = actions.length; run();
    return { before, steps: structuredClone(actions.slice(at)), after: structuredClone(game) };
  };
  for (const p of game.players) act(p.id, { type: 'ready' });
  const lobby = structuredClone(game);
  game = withClassicDiscoveryNexusLottery(() => initializeSemutaGameForAudit(game));
  const setup = structuredClone(game), initialization = { before: lobby, after: setup,
    entry: 'original-undealt-advanced-semuta-preview' };
  assert.equal(game.status, 'setup'); assert.equal(game.setupStage, 'prediction'); assert.equal(game.semutaPreview, true);
  assert.ok(game.players.every(p => !p.hand.length && !p.traitorChoices.length && !p.traitors.length));
  assert.ok(!game.homeworlds && !game.nexusCards && !game.leaderSkills && !game.techTokens &&
    !game.strongholdCards && !game.discoveryEnabled && !game.ecazTreachery);
  const originalInventory = semutaAdvisorBattleInventory(game); assert.equal(originalInventory.length, 45);
  const printed = game.deck.find(card => card.effect === 'karama'), shieldCard = game.deck.find(card => card.kind === 'shield');
  const ordinary = game.deck.filter(card => card.kind === 'projectile').slice(0, 3), extra = game.deck.find(card => card.kind === 'poison');
  assert.ok(printed && shieldCard && extra); assert.equal(ordinary.length, 3);
  const selected = [printed, ordinary[0], ordinary[1], shieldCard, ordinary[2], extra];
  const dealOrder = selected.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card.id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: card.id };
  });
  const originalTraitorOrder = traitorDeck(game.players, game.expansions.includes('ix'));
  const originalTraitors = [...originalTraitorOrder].sort(), traitorOrder = [...originalTraitorOrder];
  if (mutualTraitors) {
    for (const [target, identity] of [[game.players.findIndex(p => p.id === atreides) * 4, 'harkonnen-3'],
      [game.players.findIndex(p => p.id === harkonnen) * 4, 'atreides-0']] as const) {
      const from = traitorOrder.indexOf(identity); assert.ok(from >= 0);
      [traitorOrder[target], traitorOrder[from]] = [traitorOrder[from], traitorOrder[target]];
    }
  }
  const traitorScalars = originalTraitorScalars(originalTraitorOrder, traitorOrder), beforeTraitorDeal = structuredClone(game);
  const traitorDeal = transition(() => { game = predictOriginalTraitors(game, owner,
    { type: 'predict', faction: atreides, turn: 10 }, traitorScalars, actions); });
  const beforeStartingDeal = structuredClone(game);
  let advisorSetup: { before: Game; steps: SemutaAdvisorBattleStep[]; after: Game } | null = null;
  for (let count = 0; game.status === 'setup' && count < 100; count++) {
    const step = nextSemutaAdvisorBattle(game); assert.ok(step);
    const before = step.action.type === 'advisorSetup' ? structuredClone(game) : null;
    act(step.actor, step.action);
    if (before) advisorSetup = { before, steps: [structuredClone(step)], after: structuredClone(game) };
  }
  assert.equal(game.status, 'playing'); assert.ok(advisorSetup);
  const afterSetup = structuredClone(game), cost = printed.id, shield = shieldCard.id;
  assert.deepEqual(game.players.flatMap(p => p.hand.map(card => card.id)), selected.map(card => card.id));
  assert.equal(semutaAdvisorBattlePlayer(game, owner).forces[location], 1);
  assert.equal(isAdvisor(semutaAdvisorBattlePlayer(game, owner), territory), true);
  if (mutualTraitors) {
    assert.ok(semutaAdvisorBattlePlayer(game, atreides).traitors.includes('harkonnen-3'));
    assert.ok(semutaAdvisorBattlePlayer(game, harkonnen).traitors.includes('atreides-0'));
  }
  assert.deepEqual(semutaAdvisorBattleTraitors(game), originalTraitors);
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder: { position: number; from: number; card: Game['spiceDeck'][number] }[] = [];
  for (const [position, face] of ['funeral_plain', 'hagga_basin'].entries()) {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && card.territory === face && !card.discovery);
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0]; game.spiceDeck.splice(position, 0, card);
    spiceOrder.push({ position, from, card: structuredClone(card) });
  }
  let beforeBid: Game | undefined, bid: SemutaAdvisorBattleStep | undefined, bidAt = -1;
  for (let count = 0; count < 900 && !semutaAdvisorBattlePlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID); count++) {
    const step = nextSemutaAdvisorBattle(game); assert.ok(step);
    if (step.actor === holder && step.action.type === 'richeseBid' && step.action.amount === 1) {
      beforeBid = structuredClone(game); bid = structuredClone(step); bidAt = actions.length;
    }
    act(step.actor, step.action);
  }
  assert.ok(beforeBid && bid && bidAt >= 0);
  const acquired = structuredClone(game), acquisition = { before: beforeBid, bid,
    steps: structuredClone(actions.slice(bidAt)), after: acquired, price: 1 };
  assert.equal(semutaAdvisorBattlePlayer(beforeBid, holder).spice - semutaAdvisorBattlePlayer(game, holder).spice, 1);
  reach(state => state.phase === 5 && !state.response && !state.phaseOpening && state.decision?.kind === 'advisorBattle');
  const declinedPreparation = transition(() => {
    act(owner, { type: 'decision', accept: false });
    reach(state => state.phase === 5 && state.active === owner && semutaAdvisorBattleClean(state));
    act(owner, { type: 'endMovement' });
  });
  reach(state => state.phase === 5 && state.active === atreides && semutaAdvisorBattleClean(state));
  const atreidesDeparture = transition(() => {
    act(atreides, { type: 'move', from: location, territory: 'imperial_basin', sector: 10, amount: 9, elite: 0 });
    reach(semutaAdvisorBattleClean); act(atreides, { type: 'endMovement' });
  });
  reach(state => state.phase === 5 && state.active === harkonnen && semutaAdvisorBattleClean(state));
  const harkonnenArrival = transition(() => {
    act(harkonnen, { type: 'move', from: 'carthag:11', territory, sector: 10, amount: 1, elite: 0 });
    reach(semutaAdvisorBattleClean); act(harkonnen, { type: 'endMovement' });
  });
  reach(state => state.phase === 6 && semutaAdvisorBattleClean(state) && !!state.active);
  const beforeBattle = structuredClone(game), choice = game.players.flatMap(p => viewGame(game, p.id).battleChoices)
    .find(choice => choice.territory === territory); assert.ok(choice);
  const battleAction: Action = { type: 'chooseBattle', territory,
    target: choice.attacker === choice.chooser ? choice.defender : choice.attacker };
  act(choice.chooser, battleAction);
  reach(state => !!state.battle && !state.battle.revealed && semutaAdvisorBattleClean(state) &&
    !state.battle.preparation && state.battle.preLeader?.closed !== false);
  const beforePlans = structuredClone(game), planSteps: SemutaAdvisorBattleStep[] = [
    { actor: atreides, action: { type: 'battlePlan', leader: 'atreides-0', dial: 0.5, support: 0, weapon: null, defense: shield } },
    { actor: harkonnen, action: { type: 'battlePlan', leader: 'harkonnen-3', dial: 0, support: 0, weapon: null, defense: null } },
  ];
  for (const step of planSteps) act(step.actor, step.action);
  const reveal = transition(() => { reach(state => state.battle?.revealed === true); }), revealed = structuredClone(game);
  const lossAt = actions.length, voteHistory: { before: Game; step: SemutaAdvisorBattleStep; after: Game }[] = [];
  const disposals: { before: Game; steps: SemutaAdvisorBattleStep[]; after: Game; event: string }[] = [];
  for (let count = 0; game.response?.automaticAdvisorFlip?.producer !== 'battleLosses' && count < 150; count++) {
    if (game.pendingTreacheryDiscard) {
      const pending: NonNullable<Game['pendingTreacheryDiscard']> = game.pendingTreacheryDiscard;
      assert.deepEqual(pending.batch.entries.map(entry => ({ card: entry.card.id, by: entry.discardedBy })), [{ card: shield, by: atreides }]);
      disposals.push({ ...transition(() => { game = passSemutaAdvisorBattle(game, actions); }), event: pending.batch.event });
    } else if (game.battle?.revealed) {
      const actor = viewGame(game, game.host).battle!.traitorVoters.find(id => game.battle!.traitorCalls[id] === undefined);
      if (actor) {
        const before = structuredClone(game), step: SemutaAdvisorBattleStep = { actor, action: { type: 'traitorCall', call: mutualTraitors } };
        act(step.actor, step.action); voteHistory.push({ before, step, after: structuredClone(game) });
      } else {
        const step = nextSemutaAdvisorBattle(game); assert.ok(step); act(step.actor, step.action);
      }
    } else {
      const step = nextSemutaAdvisorBattle(game); assert.ok(step); act(step.actor, step.action);
    }
  }
  const automatic = game.response?.automaticAdvisorFlip; assert.ok(automatic?.producer === 'battleLosses');
  assert.ok(game.pendingAutomaticAdvisorBattle?.resume && game.pendingAutomaticAdvisorFlips?.length && game.lastBattleContext);
  assert.equal(game.battle, null); assert.equal(game.pendingTreacheryDiscard ?? null, null); assert.equal(game.decision ?? null, null);
  assert.equal(semutaAdvisorBattlePlayer(game, atreides).forces[location] ?? 0, 0);
  assert.equal(semutaAdvisorBattlePlayer(game, harkonnen).forces[location] ?? 0, 0);
  assert.equal(semutaAdvisorBattlePlayer(game, owner).forces[location], 1);
  assert.equal(semutaAdvisorBattlePlayer(game, atreides).tanks, 1); assert.equal(semutaAdvisorBattlePlayer(game, harkonnen).tanks, 1);
  assert.equal(game.discard.filter(card => card.id === shield).length, Number(mutualTraitors));
  assert.ok(semutaAdvisorBattlePlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID));
  assert.ok(semutaAdvisorBattlePlayer(game, spender).hand.some(card => card.id === cost));
  const source = structuredClone(game), originalResponse = structuredClone(game.response!);
  const originalAutomaticSource = structuredClone(automatic), originalParent = structuredClone(game.pendingAutomaticAdvisorBattle);
  const originalQueue = structuredClone(game.pendingAutomaticAdvisorFlips), originalBattle = structuredClone(game.lastBattleContext);
  const originalStance = structuredClone(semutaAdvisorBattlePlayer(game, owner).advisors![territory]);
  assert.equal(originalStance.aloneFlipHold, automatic.event);
  const action: Action = { type: 'card', card: cost, mode: 'cancel' };
  assert.deepEqual(semutaAdvisorBattleInventory(game), originalInventory); assert.deepEqual(semutaAdvisorBattleTraitors(game), originalTraitors);
  return { game, source, beforeCost: source, advanced: true as const, mutualTraitors, owner, bg: owner, holder, spender,
    seller, richese: seller, atreides, harkonnen, winner: mutualTraitors ? null : atreides, recipient: owner,
    cost, karama: cost, semuta: SEMUTA_DRUG_ID, shield, action, originalResponse,
    originalAutomaticSource, originalParent, originalQueue, originalStance, originalBattle,
    originalCleanup: structuredClone(originalParent.resume), originalPhysical: structuredClone(semutaAdvisorBattlePhysical(game)),
    originalBalances: Object.fromEntries(game.players.map(p => [p.id, p.spice])),
    originalPlans: structuredClone(revealed.battle!.plans), voteSteps: voteHistory.map(vote => vote.step),
    territory, location, event: game.lastBattleContext.event, initial, lobby, setup, initialization,
    beforeTraitorDeal, traitorDeal, traitorOrder, traitorScalars, beforeStartingDeal, afterSetup, advisorSetup,
    deal: selected.map(card => card.id), dealOrder, originalInventory, originalTraitors, originalSpice, spiceOrder,
    acquisition, acquired, declinedPreparation, atreidesDeparture, harkonnenArrival, beforeBattle, choice, battleAction,
    beforePlans, planSteps, plans: planSteps, reveal, revealed, voteHistory, disposals,
    lossHistory: { before: revealed, steps: structuredClone(actions.slice(lossAt)), after: source },
    actions, steps: actions, sourceActions: actions, sourceActionCount: actions.length,
    staging: [
      'Original Advanced Semuta initializer on the genuinely ready undealt R/C/BG/A/H lobby, exact CHOAM/main35/cache10 and no modules. Only original unopened starting-card/Spice positions and scalar lotteries are selected. Richese really receives printed Karama outside combat; CHOAM really purchases cache1 Semuta. Harkonnen really receives two native ordinary starting cards; Atreides receives original Shield.',
      mutualTraitors ? `Before any Traitor is dealt, the actual prediction action consumes the selected original ${originalTraitors.length}-card permutation from the registered native traitorDeck, including its actual Advanced Auditor handling. Atreides is really offered and chooses Iakin; Harkonnen naturally keeps Thufir in its original four-card packet. Both real revealed-battle votes call those held Traitors.` : `The original ${originalTraitors.length}-card native traitorDeck shuffle keeps identity order, including actual Advanced Auditor handling. Native private choices/kept packets execute; both actual revealed-battle votes decline Traitor calls.`,
      'BG actually places its original advisor beside A10 Arrakeen10 and declines native preparation. Atreides really moves nine to Basin10; Harkonnen really moves one original Carthag counter to Arrakeen, leaving nine at home. Choose the real A1/H1 battle; Thufir5/dial0.5/support0/Shield spends the last unsupported normal against Iakin2/dial0/unarmed.',
      'Actual plan seals, final readiness, revealed votes, casualties and leader effects execute. Only observed earlier mandatory Shield disposal groups receive actual passes, preserving the paid Semuta. Stop at native battleLosses conversion with battle=null and mandatory costs finished, before optional winner cleanup/aftermath.',
      'No played hand, leader, Traitor, force, stance, wallet, battle, clock, receipt or parent is installed. The original normal Shield keeper reply remains real; mutual-Traitor Shield stays mandatorily discarded. Native Collection follows original cleanup once.',
    ],
  };
}
export type SemutaAdvisorBattleFixture = ReturnType<typeof createSemutaAdvisorBattleFixture>;
