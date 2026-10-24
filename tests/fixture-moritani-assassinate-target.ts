import assert from 'node:assert/strict';
import { applyAction, captureCandidates, createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { nextRicheseStrongholdsNativeStep } from './fixture-richese-strongholds';

export type AssassinateTargetStep = { actor: string; action: Action };
export type AssassinateTargetTransition = { before: Game; steps: AssassinateTargetStep[]; after: Game };
export const assassinateTargetPlayer = (game: Game, id: string) => {
  const player = game.players.find(player => player.id === id); assert.ok(player); return player;
};
export const assassinateTargetClean = (game: Game) => !game.phaseOpening && !game.response &&
  !game.decision && !game.truthtrance && !game.pendingTreacheryDiscard && !game.pendingRevival;
export const assassinateTargetInventory = (game: Game) => {
  const cards = [...game.deck, ...game.discard, ...game.players.flatMap(player => player.hand),
    ...(game.auction?.cards.slice(game.auction.index + (game.currentAuctionSale ? 1 : 0)) ?? [])];
  const ids = cards.map(card => card.id).sort();
  assert.equal(new Set(ids).size, ids.length, 'Original physical Treachery Cards retain distinct current slots');
  return ids;
};
export const assassinateTargetTraitors = (game: Game) => {
  const cards = [...(game.traitorReserve ?? []), ...game.players.flatMap(player =>
    [...player.traitors, ...player.traitorChoices, ...(player.faceDancers ?? []).map(card => card.leader)]),
  ...(game.moritaniAssassinate?.opportunities.filter(receipt => receipt.stage === 'replaced').map(receipt => receipt.card!) ?? [])];
  assert.equal(new Set(cards).size, cards.length, 'Every original physical Traitor Card has one current slot');
  return cards.sort();
};

/** Original scalar shuffle order; UUIDs and other native byte entropy remain
 * unchanged. Selected values are used only by the actual capture permutation. */
function originalLottery<T>(run: () => T, selected?: readonly number[]): T {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const original = crypto.getRandomValues.bind(crypto); let cursor = 0;
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array && array.length === 1)
      array[0] = selected && cursor < selected.length ? selected[cursor++] : 0xffffffff;
    else Reflect.apply(original, crypto, [array]);
    return array;
  };
  try {
    const result = run();
    if (selected) assert.equal(cursor, selected.length, 'The original capture consumes exactly its selected permutation');
    return result;
  } finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}
export function actAssassinateTarget(game: Game, actor: string, action: Action,
  actions: AssassinateTargetStep[] = []): Game {
  const next = originalLottery(() => applyAction(game, actor, action));
  actions.push({ actor, action: structuredClone(action) }); return next;
}
/** Native windows only; captures, assassination and private plans stay owned
 * caller choices. Optional Terror placement and special Karama are declined. */
export function nextAssassinateTarget(game: Game): AssassinateTargetStep | null {
  if (!game.phaseOpening && !game.response && !game.pendingTreacheryDiscard) {
    const decision = game.decision;
    if (decision?.kind === 'captureOffer' || decision?.kind === 'capturedLeader' ||
        decision?.kind === 'moritaniAssassinate') return null;
    if (game.status === 'setup' && game.setupStage === 'traitors' &&
        assassinateTargetPlayer(game, 'moritani').traitorChoices.length)
      return { actor: 'moritani', action: { type: 'traitor', leader: 'emperor-3' } };
    if (decision?.kind === 'moritaniSetup')
      return { actor: decision.player, action: { type: 'decision', territory: 'imperial_basin', sector: 11 } };
    if (decision?.kind === 'moritaniPlacement')
      return { actor: decision.player, action: { type: 'decision', decline: true } };
    if (decision?.kind === 'moritaniSpecialKarama')
      return { actor: decision.player, action: { type: 'decision', event: game.moritaniSpecialKarama!.source.event, decline: true } };
  }
  return nextRicheseStrongholdsNativeStep(game);
}
export function advanceAssassinateTarget(game: Game, until: (state: Game) => boolean,
  actions: AssassinateTargetStep[] = []): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The genuine assassination-target chronology ended before its owned boundary');
    const next = nextAssassinateTarget(game);
    assert.ok(next, `Choose the actual capture, private plan or assassination at ${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = actAssassinateTarget(game, next.actor, next.action, actions);
  }
  throw Error('The native assassination-target chronology did not reach its finite boundary');
}
export function passAssassinateTarget(game: Game, actions: AssassinateTargetStep[] = []): Game {
  for (let count = 0; game.response && count < 60; count++) {
    const actor = game.players.find(player => !game.response!.passed.includes(player.id)); assert.ok(actor);
    game = actAssassinateTarget(game, actor.id, { type: 'passResponse' }, actions);
  }
  assert.ok(!game.response); return game;
}
function capturePermutation(pool: readonly string[], target: string) {
  const desired = [target, ...pool.filter(id => id !== target)], current = [...pool], rolls: number[] = [];
  assert.equal(current.filter(id => id === target).length, 1);
  for (let index = current.length - 1; index > 0; index--) {
    const from = current.indexOf(desired[index]); assert.ok(from >= 0 && from <= index);
    rolls.push(Math.floor((from + 0.5) * 0x100000000 / (index + 1)));
    [current[index], current[from]] = [current[from], current[index]];
  }
  assert.deepEqual(current, desired); return rolls;
}

/** Genuine original capture, including its own response if a card keeps it
 * open. Select only this real permutation, never candidate bodies or custody. */
function declareCapture(source: Game, target: string, actions: AssassinateTargetStep[]) {
  assert.equal(source.decision?.kind, 'captureOffer');
  const owner = source.decision!.player;
  const pool = captureCandidates(source, 'emperor', 'carthag').map(leader => leader.id);
  const rolls = capturePermutation(pool, target), before = structuredClone(source), start = actions.length;
  let game = source, declared = structuredClone(source);
  originalLottery(() => {
    const step: AssassinateTargetStep = { actor: owner, action: { type: 'decision', accept: true } };
    game = applyAction(game, step.actor, step.action); actions.push(structuredClone(step));
    declared = structuredClone(game);
    for (let count = 0; game.response && count < 60; count++) {
      assert.equal(game.response.kind, 'capture');
      const actor = game.players.find(player => !game.response!.passed.includes(player.id)); assert.ok(actor);
      const pass: AssassinateTargetStep = { actor: actor.id, action: { type: 'passResponse' } };
      game = applyAction(game, pass.actor, pass.action); actions.push(pass);
    }
  }, rolls);
  assert.equal(game.decision?.kind, 'capturedLeader');
  assert.equal(game.decision?.kind === 'capturedLeader' && game.decision.leader, target);
  return { game, declared, transition: { before, steps: structuredClone(actions.slice(start)), after: structuredClone(game) },
    pool, rolls };
}

/** Public Advanced Harkonnen/Emperor/Moritani. Emperor actually divides one
 * paid shipment between Carthag and Mori's real setup position. Harkonnen wins
 * the first original battle, captures Burseg through its native lottery and
 * keeps or executes him. A different living Emperor disc then beats Moritani.
 * Stop at that actual assassination opportunity, before any reveal/decline. */
export function createMoritaniAssassinateTargetFixture(options: { execute?: boolean } = {}) {
  const captor = 'harkonnen', opponent = 'emperor', owner = 'moritani', target = 'emperor-3';
  let game = createGame('MORITANIASSASSINATETARGET', newPlayer(captor, 'Harkonnen', 'harkonnen'), true, ['ecaz']);
  joinGame(game, newPlayer(opponent, 'Emperor', 'emperor'));
  joinGame(game, newPlayer(owner, 'Moritani', 'moritani'));
  const initial = structuredClone(game), actions: AssassinateTargetStep[] = [];
  const act = (actor: string, action: Action) => { game = actAssassinateTarget(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceAssassinateTarget(game, until, actions); };
  const transition = (run: () => void): AssassinateTargetTransition => {
    const before = structuredClone(game), start = actions.length; run();
    return { before, steps: structuredClone(actions.slice(start)), after: structuredClone(game) };
  };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game); act(game.host, { type: 'start', advancedPreview: true });
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, true);
  assert.deepEqual(game.players.map(player => player.faction), [captor, opponent, owner]);
  assert.ok(!game.homeworlds && !game.nexusCards && !game.leaderSkills && !game.techTokens &&
    !game.strongholdCards && !game.discoveryEnabled && !game.ecazTreachery);
  assert.ok(game.players.every(player => player.hand.length === 0));
  assert.ok(assassinateTargetPlayer(game, owner).traitorChoices.includes(target),
    'The identity-order original third-seat Traitor offer really contains Burseg');
  const originalInventory = assassinateTargetInventory(game), originalTraitors = assassinateTargetTraitors(game);
  const ordinary = game.deck.filter(card => ['projectile', 'poison', 'shield', 'snooper'].includes(card.kind)).slice(0, 4);
  assert.equal(ordinary.length, 4);
  const dealOrder = ordinary.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card.id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: card.id };
  });
  const beforeStartingDeal = structuredClone(game);
  reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game);
  assert.deepEqual(game.players.flatMap(player => player.hand.map(card => card.id)), ordinary.map(card => card.id));
  assert.ok(assassinateTargetPlayer(game, owner).traitors.includes(target));
  assert.equal(assassinateTargetPlayer(game, owner).forces['imperial_basin:11'], 6);
  assert.equal(assassinateTargetPlayer(game, captor).forces['carthag:11'], 10);
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder = [0, 1].map(position => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery);
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0];
    game.spiceDeck.splice(position, 0, card); return { position, from, card: structuredClone(card) };
  });
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  reach(state => state.turn === 1 && state.phase === 5 && state.active === opponent && assassinateTargetClean(state));
  const shipment = transition(() => {
    act(opponent, { type: 'ship', territory: 'carthag', sector: 11, amount: 2, elite: 0, allyPayment: 0 });
    reach(assassinateTargetClean);
  });
  assert.equal(assassinateTargetPlayer(shipment.before, opponent).spice - assassinateTargetPlayer(game, opponent).spice, 2);
  const movement = transition(() => {
    act(opponent, { type: 'move', from: 'carthag:11', territory: 'imperial_basin', sector: 11, amount: 1 });
    reach(assassinateTargetClean);
  });
  assert.equal(assassinateTargetPlayer(game, opponent).forces['carthag:11'], 1);
  assert.equal(assassinateTargetPlayer(game, opponent).forces['imperial_basin:11'], 1);
  reach(state => state.phase === 6 && state.active === captor && assassinateTargetClean(state));
  const beforeFirstBattle = structuredClone(game);
  const firstBattleStep: AssassinateTargetStep = { actor: captor,
    action: { type: 'chooseBattle', territory: 'carthag', target: opponent } };
  act(firstBattleStep.actor, firstBattleStep.action);
  reach(state => !!state.battle && assassinateTargetClean(state) && !state.battle.preparation && state.battle.preLeader?.closed !== false);
  const firstPlans: AssassinateTargetStep[] = [
    { actor: captor, action: { type: 'battlePlan', leader: 'harkonnen-0', dial: 0, support: 0, weapon: null, defense: null } },
    { actor: opponent, action: { type: 'battlePlan', leader: 'emperor-4', dial: 0, support: 0, weapon: null, defense: null } },
  ];
  for (const step of firstPlans) act(step.actor, step.action);
  reach(state => !state.response && !state.phaseOpening && state.decision?.kind === 'captureOffer');
  const captureOffer = structuredClone(game), capture = declareCapture(game, target, actions);
  game = capture.game;
  const beforeCaptureChoice = structuredClone(game);
  const captureChoiceStep: AssassinateTargetStep = { actor: captor,
    action: { type: 'decision', mode: options.execute ? 'execute' : 'keep' } };
  const captureChoice = transition(() => {
    act(captureChoiceStep.actor, captureChoiceStep.action);
    reach(state => !state.battle && assassinateTargetClean(state));
  });
  const afterCapture = structuredClone(game), victim = assassinateTargetPlayer(game, opponent).leaders.find(leader => leader.id === target)!;
  assert.ok(victim.concealed);
  assert.equal(victim.dead, !!options.execute);
  assert.equal(victim.capturedBy, options.execute ? undefined : captor);
  assert.equal(victim.deaths, options.execute ? 2 : 0);
  const beforeSecondBattle = structuredClone(game), choice = game.players.flatMap(player =>
    viewGame(game, player.id).battleChoices).find(choice => choice.territory === 'imperial_basin');
  assert.ok(choice);
  const secondBattleStep: AssassinateTargetStep = { actor: choice.chooser,
    action: { type: 'chooseBattle', territory: 'imperial_basin',
      target: choice.attacker === choice.chooser ? choice.defender : choice.attacker } };
  act(secondBattleStep.actor, secondBattleStep.action);
  reach(state => !!state.battle && assassinateTargetClean(state) && !state.battle.preparation && state.battle.preLeader?.closed !== false);
  const secondPlans: AssassinateTargetStep[] = [
    { actor: opponent, action: { type: 'battlePlan', leader: 'emperor-0', dial: 0, support: 0, weapon: null, defense: null } },
    { actor: owner, action: { type: 'battlePlan', leader: 'moritani-4', dial: 0, support: 0, weapon: null, defense: null } },
  ];
  for (const step of secondPlans) act(step.actor, step.action);
  reach(state => !state.response && !state.phaseOpening && state.decision?.kind === 'moritaniAssassinate');
  const receipt = game.moritaniAssassinate!.opportunities.at(-1)!;
  assert.equal(receipt.stage, 'choice'); assert.equal(receipt.faction, 'emperor');
  assert.equal(receipt.opponent, opponent); assert.equal(receipt.opposingLeader, 'emperor-0');
  assert.ok(assassinateTargetPlayer(game, owner).traitors.includes(target));
  assert.deepEqual(assassinateTargetInventory(game), originalInventory);
  assert.deepEqual(assassinateTargetTraitors(game), originalTraitors);
  const reveal: Action = { type: 'decision', event: receipt.event, card: target };
  const decline: Action = { type: 'decision', event: receipt.event, decline: true };
  return { game, initial, lobby, setup, beforeStartingDeal, afterSetup, shipment, movement,
    beforeFirstBattle, firstBattleStep, firstPlans, captureOffer, captureDeclared: capture.declared,
    capture: capture.transition, capturePool: capture.pool, captureRolls: capture.rolls,
    beforeCaptureChoice, captureChoiceStep, captureChoice, afterCapture,
    beforeSecondBattle, secondBattleStep, secondPlans,
    owner, moritani: owner, opponent, emperor: opponent, captor, harkonnen: captor, target,
    winningDisc: 'emperor-0', territory: 'imperial_basin', sector: 11, location: 'imperial_basin:11',
    event: receipt.event, receipt: structuredClone(receipt), execute: !!options.execute,
    potentialBounty: victim.strength, action: reveal,
    reveal, revealStep: { actor: owner, action: reveal } satisfies AssassinateTargetStep,
    decline, actions, sourceActionCount: actions.length, originalInventory, originalTraitors,
    originalSpice, dealOrder, spiceOrder,
    staging: [
      'Actual public native Advanced Harkonnen/Emperor/Moritani ready/start and private setup. Original scalar shuffle order naturally offers emperor-3 in Moritani’s third-seat Traitor packet; Moritani actually chooses it.',
      'Select four original unopened ordinary Treachery positions and two original unopened ordinary Spice positions. Native Moritani setup really places six counters in empty Imperial Basin11. No optional module is selected.',
      'Emperor actually pays two to ship two reserves to Carthag11, then really moves one to Imperial Basin11. Native first Storm, dual Spice, Charity, Bidding, Revival and movement turns execute normally.',
      'Harkonnen actually wins Carthag with Feyd6 against Bashar2, without weapons or leader deaths. Scope only the ensuing native capture permutation to choose unused Burseg3; no candidate body, captive flag, death or concealment is assigned. The original capturedLeader action really keeps or executes that disc.',
      'A different surviving native Emperor disc, Fenring6, really wins Imperial Basin against Moritani’s Vando1. The original printed-Emperor assassination opportunity opens while Moritani still physically holds Burseg’s original Traitor Card.',
      'Stop before the original reveal/decline. Both live-captive and concealed-executed variants use native actions and retain the same printed target identity. No phase, wallet, army, alliance, plan, custody state or assassination receipt is installed.',
    ],
  };
}
export type MoritaniAssassinateTargetFixture = ReturnType<typeof createMoritaniAssassinateTargetFixture>;

/** Call after an explicit reveal or decline. Native casualty/card controls and
 * original Mentat replacement continue once; no custody or replacement is set. */
export function finishMoritaniAssassinateTarget(source: Game, fixture: MoritaniAssassinateTargetFixture,
  actions: AssassinateTargetStep[] = []): Game {
  assert.notEqual(source.decision?.kind, 'moritaniAssassinate', 'Choose the owned reveal or decline before continuing');
  return advanceAssassinateTarget(source, game => game.phase === 8 && !game.battle &&
    !game.response && !game.phaseOpening && !game.pendingTreacheryDiscard &&
    game.moritaniAssassinate!.opportunities.some(receipt => receipt.event === fixture.event &&
      (receipt.stage === 'replaced' || receipt.stage === 'declined')), actions);
}
