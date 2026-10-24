import assert from 'node:assert/strict';
import { applyAction, createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import {
  actAdvisorPreparation, advisorPreparationClean, advisorPreparationInventory,
  advisorPreparationPlayer, nextAdvisorPreparationStep,
} from './fixture-advisor-preparation';

export type AdvisorBattleFlipStep = { actor: string; action: Action };
export type AdvisorBattleFlipTransition = { before: Game; steps: AdvisorBattleFlipStep[]; after: Game };
export const actAdvisorBattleFlip = actAdvisorPreparation;
export const advisorBattleFlipClean = advisorPreparationClean;
export const advisorBattleFlipInventory = advisorPreparationInventory;
export const advisorBattleFlipPlayer = advisorPreparationPlayer;
export const advisorBattleFlipTraitors = (game: Game) => {
  const identities = [...(game.traitorReserve ?? []), ...game.players.flatMap(player =>
    [...player.traitors, ...player.traitorChoices])];
  assert.equal(new Set(identities).size, identities.length, 'Each original physical Traitor has one current slot');
  return identities.sort();
};

/** Native continuation preserves both caller-owned conversion and winner-card
 * choices. No new advisor counter or optional winner discard is passed here. */
export function nextAdvisorBattleFlip(game: Game): AdvisorBattleFlipStep | null {
  if (game.response?.automaticAdvisorFlip) return null;
  if (!game.phaseOpening && !game.response && !game.pendingTreacheryDiscard) {
    if (game.decision?.kind === 'battleCards') return null;
    if (game.decision?.kind === 'advisorBattle')
      return { actor: game.decision.player, action: { type: 'decision', accept: false } };
    if (game.status === 'setup' && game.setupStage === 'traitors') {
      const player = game.players.find(candidate => candidate.traitorChoices.length); assert.ok(player);
      const leader = player.faction === 'atreides' && player.traitorChoices.includes('harkonnen-3')
        ? 'harkonnen-3' : player.traitorChoices[0];
      return { actor: player.id, action: { type: 'traitor', leader } };
    }
  }
  return nextAdvisorPreparationStep(game);
}
export function advanceAdvisorBattleFlip(game: Game, until: (state: Game) => boolean,
  steps: AdvisorBattleFlipStep[] = []): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The genuine battle chronology ended before its requested boundary');
    const next = nextAdvisorBattleFlip(game);
    assert.ok(next, `Choose the original private plan, conversion or winner cards at ${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = actAdvisorBattleFlip(game, next.actor, next.action, steps);
  }
  throw Error('The native advisor battle source did not reach its finite boundary');
}
/** Pass ordinary original responses only; the mandatory conversion stays owned. */
export function passAdvisorBattleFlip(game: Game, steps: AdvisorBattleFlipStep[] = []): Game {
  for (let count = 0; game.response && !game.response.automaticAdvisorFlip && count < 60; count++) {
    const actor = game.players.find(player => !game.response!.passed.includes(player.id)); assert.ok(actor);
    game = actAdvisorBattleFlip(game, actor.id, { type: 'passResponse' }, steps);
  }
  assert.ok(!game.response || game.response.automaticAdvisorFlip); return game;
}

/** Compute only original Fisher-Yates scalar draws, before any Traitor is
 * dealt. The actual native prediction action performs the resulting shuffle. */
function traitorPermutation(original: string[], desired: string[]) {
  assert.deepEqual([...original].sort(), [...desired].sort());
  const current = [...original], scalars: number[] = [];
  for (let index = current.length - 1; index > 0; index--) {
    const from = current.indexOf(desired[index]); assert.ok(from >= 0 && from <= index);
    scalars.push(Math.floor((from + 0.5) * 4294967296 / (index + 1)));
    [current[index], current[from]] = [current[from], current[index]];
  }
  assert.deepEqual(current, desired); return scalars;
}
function predictWithOriginalTraitors(game: Game, actor: string, action: Action,
  scalars: number[], steps: AdvisorBattleFlipStep[]): Game {
  assert.equal(game.status, 'setup'); assert.equal(game.setupStage, 'prediction');
  assert.ok(game.players.every(player => !player.traitors.length && !player.traitorChoices.length));
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const original = crypto.getRandomValues.bind(crypto); let cursor = 0;
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array && array.length === 1) {
      assert.ok(cursor < scalars.length, 'Only the original Traitor shuffle consumes selected prediction entropy');
      array[0] = scalars[cursor++];
    } else Reflect.apply(original, crypto, [array]);
    return array;
  };
  try {
    const next = applyAction(game, actor, action);
    assert.equal(cursor, scalars.length, 'The actual original Traitor shuffle uses its complete selected permutation');
    steps.push({ actor, action: structuredClone(action) }); return next;
  } finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}

/** Actual public Advanced BG/Atreides/Harkonnen base33. Atreides leaves one
 * counter beside the original advisor; Harkonnen moves one native counter in.
 * Stop immediately after choosing that real battle, before preparation/plans. */
export function createAdvisorBattleFlipFixture(options: { mutualTraitors?: boolean; explosion?: boolean } = {}) {
  const bg = 'beneGesserit', atreides = 'atreides', harkonnen = 'harkonnen';
  const mutualTraitors = options.mutualTraitors ?? false;
  const explosion = options.explosion ?? false;
  assert.ok(!mutualTraitors || !explosion, 'Select one original battle outcome');
  let game = createGame('ADVISORBATTLEFLIP', newPlayer(bg, 'Bene Gesserit', 'beneGesserit'), true);
  joinGame(game, newPlayer(atreides, 'Atreides', 'atreides'));
  joinGame(game, newPlayer(harkonnen, 'Harkonnen', 'harkonnen'));
  const initial = structuredClone(game), steps: AdvisorBattleFlipStep[] = [];
  const act = (actor: string, action: Action) => { game = actAdvisorBattleFlip(game, actor, action, steps); };
  const reach = (until: (state: Game) => boolean) => { game = advanceAdvisorBattleFlip(game, until, steps); };
  const transition = (run: () => void): AdvisorBattleFlipTransition => {
    const before = structuredClone(game), start = steps.length; run();
    return { before, steps: structuredClone(steps.slice(start)), after: structuredClone(game) };
  };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game); act(game.host, { type: 'start', advancedPreview: true });
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, true); assert.equal(game.setupStage, 'prediction');
  assert.deepEqual(game.expansions, []);
  assert.ok(!game.homeworlds && !game.nexusCards && !game.leaderSkills && !game.techTokens &&
    !game.strongholdCards && !game.discoveryEnabled && !game.ecazTreachery);
  assert.ok(game.players.every(player => !player.hand.length && !player.traitorChoices.length));
  const originalInventory = advisorBattleFlipInventory(game); assert.equal(originalInventory.length, 33);
  const karama = game.deck.find(card => card.effect === 'karama');
  const shield = game.deck.find(card => card.kind === 'shield');
  const ordinary = game.deck.find(card => card.kind === 'projectile');
  const extra = game.deck.find(card => card.kind === (explosion ? 'lasgun' : 'poison')); assert.ok(karama && shield && ordinary && extra);
  const selected = [ordinary, shield, karama, extra];
  const dealOrder = selected.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card.id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: card.id };
  });
  const beforeTraitorDeal = structuredClone(game);
  const originalTraitors = game.players.flatMap(player => player.leaders.map(leader => leader.id)).sort();
  const traitorOrder = game.players.flatMap(player => player.leaders.map(leader => leader.id));
  if (mutualTraitors) {
    const iakin = traitorOrder.indexOf('harkonnen-3'), thufir = traitorOrder.indexOf('atreides-0');
    assert.ok(iakin >= 0 && thufir >= 0);
    [traitorOrder[4], traitorOrder[iakin]] = [traitorOrder[iakin], traitorOrder[4]];
    [traitorOrder[8], traitorOrder[thufir]] = [traitorOrder[thufir], traitorOrder[8]];
  }
  const traitorScalars = traitorPermutation(game.players.flatMap(player => player.leaders.map(leader => leader.id)), traitorOrder);
  const traitorDeal = transition(() => {
    game = predictWithOriginalTraitors(game, bg, { type: 'predict', faction: 'atreides', turn: 10 }, traitorScalars, steps);
  });
  const beforeStartingDeal = structuredClone(game);
  let advisorSetup: AdvisorBattleFlipTransition | null = null;
  for (let count = 0; game.status === 'setup' && count < 100; count++) {
    const next = nextAdvisorBattleFlip(game); assert.ok(next);
    const before = next.action.type === 'advisorSetup' ? structuredClone(game) : null;
    act(next.actor, next.action);
    if (before) advisorSetup = { before, steps: [structuredClone(next)], after: structuredClone(game) };
  }
  assert.equal(game.status, 'playing'); assert.ok(advisorSetup);
  const afterSetup = structuredClone(game);
  assert.deepEqual(game.players.flatMap(player => player.hand.map(card => card.id)), selected.map(card => card.id));
  assert.equal(advisorBattleFlipPlayer(game, bg).forces['arrakeen:10'], 1);
  assert.ok(advisorBattleFlipPlayer(game, bg).advisors?.arrakeen);
  assert.equal(advisorBattleFlipPlayer(game, atreides).forces['arrakeen:10'], 10);
  assert.equal(advisorBattleFlipPlayer(game, harkonnen).forces['carthag:11'], 10);
  if (mutualTraitors) {
    assert.ok(advisorBattleFlipPlayer(game, atreides).traitors.includes('harkonnen-3'));
    assert.ok(advisorBattleFlipPlayer(game, harkonnen).traitors.includes('atreides-0'));
  }
  assert.deepEqual(advisorBattleFlipTraitors(game), originalTraitors);
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder = [0, 1].map(position => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery);
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0];
    game.spiceDeck.splice(position, 0, card); return { position, from, card: structuredClone(card) };
  });
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  reach(state => state.turn === 1 && state.phase === 5 && !state.phaseOpening && !state.response && state.decision?.kind === 'advisorBattle');
  const openingOffer = structuredClone(game);
  const declinedPreparation = transition(() => {
    act(bg, { type: 'decision', accept: false });
    reach(state => state.phase === 5 && state.active === bg && advisorBattleFlipClean(state));
  });
  act(bg, { type: 'endMovement' });
  reach(state => state.phase === 5 && state.active === atreides && advisorBattleFlipClean(state));
  const atreidesDeparture = transition(() => {
    act(atreides, { type: 'move', from: 'arrakeen:10', territory: 'imperial_basin', sector: 10, amount: 9 });
    reach(advisorBattleFlipClean);
  });
  act(atreides, { type: 'endMovement' });
  reach(state => state.phase === 5 && state.active === harkonnen && advisorBattleFlipClean(state));
  const harkonnenArrival = transition(() => {
    act(harkonnen, { type: 'move', from: 'carthag:11', territory: 'arrakeen', sector: 10, amount: 1 });
    reach(advisorBattleFlipClean);
  });
  reach(state => state.phase === 6 && advisorBattleFlipClean(state) && !!state.active);
  const beforeBattle = structuredClone(game);
  const choice = game.players.flatMap(player => viewGame(game, player.id).battleChoices)
    .find(candidate => candidate.territory === 'arrakeen'); assert.ok(choice);
  const battleStep: AdvisorBattleFlipStep = { actor: choice.chooser, action: {
    type: 'chooseBattle', territory: 'arrakeen',
    target: choice.attacker === choice.chooser ? choice.defender : choice.attacker,
  } };
  act(battleStep.actor, battleStep.action);
  const beforePreparation = structuredClone(game);
  assert.ok(game.battle && !game.battle.revealed && !Object.keys(game.battle.plans).length);
  assert.equal(advisorBattleFlipPlayer(game, atreides).forces['arrakeen:10'], 1);
  assert.equal(advisorBattleFlipPlayer(game, atreides).forces['imperial_basin:10'], 9);
  assert.equal(advisorBattleFlipPlayer(game, harkonnen).forces['arrakeen:10'], 1);
  assert.equal(advisorBattleFlipPlayer(game, harkonnen).forces['carthag:11'], 9);
  assert.ok(advisorBattleFlipPlayer(game, bg).advisors?.arrakeen);
  assert.ok(advisorBattleFlipPlayer(game, harkonnen).hand.some(card => card.id === karama.id));
  assert.deepEqual(advisorBattleFlipInventory(game), originalInventory);
  assert.deepEqual(advisorBattleFlipTraitors(game), originalTraitors);
  const atreidesPlan: Action = { type: 'battlePlan', leader: 'atreides-0', dial: 1, support: 1, weapon: null, defense: shield.id };
  const harkonnenPlan: Action = { type: 'battlePlan', leader: 'harkonnen-3', dial: 0, support: 0, weapon: explosion ? extra.id : null, defense: null };
  const plans: AdvisorBattleFlipStep[] = [
    { actor: atreides, action: atreidesPlan }, { actor: harkonnen, action: harkonnenPlan },
  ];
  return { game, source: structuredClone(game), initial, lobby, setup, beforeTraitorDeal, traitorDeal,
    beforeStartingDeal, afterSetup, advisorSetup, openingOffer, declinedPreparation,
    atreidesDeparture, holderDeparture: atreidesDeparture, harkonnenArrival,
    beforeBattle, battleStep, beforePreparation,
    bg, owner: bg, atreides, winner: atreides, harkonnen, holder: harkonnen, observer: harkonnen,
    karama: karama.id, card: karama.id, shield: shield.id, ordinary: ordinary.id, extra: extra.id,
    territory: 'arrakeen', sector: 10, location: 'arrakeen:10', event: game.battle.event,
    mutualTraitors, explosion, atreidesPlan, harkonnenPlan, ownPlan: atreidesPlan, opponentPlan: harkonnenPlan, plans, planSteps: plans,
    steps, actions: steps, sourceActionCount: steps.length,
    originalInventory, originalTraitors, traitorOrder, traitorScalars, originalSpice, dealOrder, spiceOrder,
    staging: [
      'Actual public Advanced Bene Gesserit/Atreides/Harkonnen ready/startPreview with original base33 and no optional modules. Native prediction, private Traitor choices and advisorSetup place the original BG advisor beside Atreides’ ten Arrakeen10 counters.',
      `Select only original scalar shuffle draws, four unopened Treachery positions and two unopened ordinary Spice positions. BG receives an ordinary weapon, Atreides Shield, and Harkonnen its actual two starting cards: Karama and ${explosion ? 'Lasgun' : 'an ordinary poison weapon'}. No hand is installed.`,
      mutualTraitors
        ? 'During the actual prediction action, before any original Traitor is dealt, select the original 15-card Fisher-Yates permutation so Atreides is offered and actually chooses Iakin, while Harkonnen naturally keeps Thufir in its original four-card packet.'
        : 'The original Traitor shuffle preserves identity order; BG and Atreides make actual private choices and Harkonnen keeps its actual four-card packet. Battle continuation declines all original Traitor calls.',
      'Actually complete safe first Storm, both Spice blows, Charity, normal Bidding and Revival. Decline the original preparation offer and end BG movement. Atreides actually moves nine Arrakeen counters to Basin10, leaving one with the peaceful advisor; Harkonnen uses actual city range to move one original Carthag11 counter to Arrakeen10, leaving nine at home.',
      `Choose the actual one-versus-one Arrakeen battle, then stop before preparation and either sealed plan. Returned plans use original living Thufir5 plus dial1/support1 and the real Shield against original living Iakin2/dial0/support0 with ${explosion ? 'the original Lasgun' : 'no cards'}. The held original Harkonnen Karama remains unspent.`,
      'No played phase, army, wallet, Tanks, hand, leader status, stance, prevention, plan, casualty or receipt is installed. Battle resolution, mandatory advisor conversion and optional winner card cleanup remain actual caller-owned continuations.',
    ],
  };
}
export type AdvisorBattleFlipFixture = ReturnType<typeof createAdvisorBattleFlipFixture>;

/** Perform actual preparation, original plans and the original Traitor votes.
 * Stop before the new conversion response, the real Shield winner choice, or
 * the completed native no-winner boundary on a pre-feature runtime. */
export function commitAdvisorBattleFlip(source: Game, fixture: AdvisorBattleFlipFixture,
  steps: AdvisorBattleFlipStep[] = []) {
  const before = structuredClone(source), start = steps.length;
  let game = source;
  for (let count = 0; count < 240; count++) {
    if (game.response?.automaticAdvisorFlip || game.decision?.kind === 'battleCards' || !game.battle) {
      assert.ok(advisorBattleFlipPlayer(game, fixture.holder).hand.some(card => card.id === fixture.karama));
      assert.deepEqual(advisorBattleFlipInventory(game), fixture.originalInventory);
      return { game, before, after: structuredClone(game), steps: structuredClone(steps.slice(start)),
        context: structuredClone(game.lastBattleContext), pendingDiscard: structuredClone(game.pendingTreacheryDiscard) };
    }
    if (advisorBattleFlipClean(game) && !game.battle.revealed && !game.battle.preparation &&
        game.battle.preLeader?.closed !== false) {
      const plan = fixture.plans.find(step => !game.battle!.plans[step.actor]); assert.ok(plan);
      game = actAdvisorBattleFlip(game, plan.actor, plan.action, steps); continue;
    }
    if (advisorBattleFlipClean(game) && game.battle.revealed) {
      const actor = viewGame(game, game.host).battle!.traitorVoters
        .find(id => game.battle!.traitorCalls[id] === undefined);
      if (actor) {
        game = actAdvisorBattleFlip(game, actor, { type: 'traitorCall', call: fixture.mutualTraitors }, steps);
        continue;
      }
    }
    const next = nextAdvisorBattleFlip(game); assert.ok(next, 'Choose the original native battle control');
    game = actAdvisorBattleFlip(game, next.actor, next.action, steps);
  }
  throw Error('The actual advisor battle did not reach its committed loss boundary');
}

/** Call after explicitly resolving the conversion. Keep the real optional
 * winner Shield, allow mandatory discard/aftermath, and reach Collection or
 * Mentat through native controls. This never answers a conversion response. */
export function finishAdvisorBattleFlip(source: Game, steps: AdvisorBattleFlipStep[] = []): Game {
  let game = source;
  for (let count = 0; count < 300; count++) {
    if (!game.battle && game.phase >= 7 && advisorBattleFlipClean(game)) return game;
    assert.ok(!game.response?.automaticAdvisorFlip, 'Resolve the original advisor-conversion choice before finishing');
    if (game.decision?.kind === 'battleCards' && !game.response && !game.phaseOpening) {
      game = actAdvisorBattleFlip(game, game.decision.player, { type: 'decision', discard: [] }, steps); continue;
    }
    const next = nextAdvisorBattleFlip(game); assert.ok(next, 'Complete the original owned battle before Collection');
    game = actAdvisorBattleFlip(game, next.actor, next.action, steps);
  }
  throw Error('The original advisor battle continuation did not reach Collection');
}
