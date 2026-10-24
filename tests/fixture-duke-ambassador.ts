import assert from 'node:assert/strict';
import { applyAction, createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { AMBASSADOR_EFFECTS, type AmbassadorEffect } from '../game/ecaz-ambassadors';
import { DUKE_VIDAL_ID } from '../game/duke-vidal';
import { nextStrongholdFactionsNativeStep } from './fixture-stronghold-factions';

export type DukeAmbassadorStep = { actor: string; action: Action };
export type DukeAmbassadorTransition = { before: Game; step: DukeAmbassadorStep; after: Game };
export const dukeAmbassadorPlayer = (game: Game, actor = 'ecaz') => {
  const player = game.players.find(player => player.id === actor); assert.ok(player); return player;
};
export const dukeAmbassadorClean = (game: Game) => !game.response && !game.phaseOpening &&
  !game.decision && !game.truthtrance && !game.pendingTreacheryDiscard;

/** Select original scalar lotteries only. UUID and other byte entropy remains
 * native. The optional nine values belong solely to original packet creation. */
function withDukeAmbassadorLottery<T>(run: () => T, packet: readonly number[] = []): T {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const original = crypto.getRandomValues.bind(crypto); let cursor = 0;
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array && array.length === 1)
      array[0] = cursor < packet.length ? packet[cursor++] : 0xffffffff;
    else Reflect.apply(original, crypto, [array]);
    return array;
  };
  try {
    const result = run(); assert.equal(cursor, packet.length, 'The original Ambassador packet consumes its nine selected draws');
    return result;
  } finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}
export function actDukeAmbassador(game: Game, actor: string, action: Action,
  actions: DukeAmbassadorStep[] = []): Game {
  const next = withDukeAmbassadorLottery(() => applyAction(game, actor, action));
  actions.push({ actor, action: structuredClone(action) }); return next;
}

/** The owned programme supplies all Ambassador choices and sealed plans. This
 * driver passes native responses, declines further paid placements and makes
 * original public readiness/end-of-movement choices without optional spending. */
export function nextDukeAmbassadorStep(game: Game): DukeAmbassadorStep | null {
  if (!game.response && !game.phaseOpening && !game.pendingTreacheryDiscard) {
    if (game.decision?.kind === 'ecazAmbassador') return null;
    if (game.decision?.kind === 'ecazPlacement')
      return { actor: game.decision.player, action: { type: 'decision', decline: true } };
    if (game.status === 'setup' && game.setupStage === 'forces' && dukeAmbassadorPlayer(game).reserves === 20)
      return { actor: 'ecaz', action: { type: 'ecazSetup', placements: { 'imperial_basin:9': 6 } } };
  }
  return nextStrongholdFactionsNativeStep(game);
}
export function advanceDukeAmbassador(game: Game, until: (state: Game) => boolean,
  actions: DukeAmbassadorStep[] = []): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original Duke programme ended before its next control');
    const next = nextDukeAmbassadorStep(game);
    assert.ok(next, `Choose the actual Ambassador effect or sealed plan before advancing: ${JSON.stringify({
      turn: game.turn, phase: game.phase, active: game.active, decision: game.decision,
      entry: game.pendingAmbassador ? { stage: game.pendingAmbassador.stage, entrant: game.pendingAmbassador.entrant,
        territory: game.pendingAmbassador.territory, effect: game.pendingAmbassador.effect } : null,
    })}`);
    game = actDukeAmbassador(game, next.actor, next.action, actions);
  }
  throw Error('The original Duke Ambassador programme did not reach its finite boundary');
}

/** Fisher–Yates draws for the original ten-token pool. The native token IDs,
 * zones and cohort are created by initializeStartingForces, never rewritten. */
function originalPacket(copied: boolean) {
  const pool = AMBASSADOR_EFFECTS.filter(effect => effect !== 'ecaz');
  const supply: Exclude<AmbassadorEffect, 'ecaz'>[] = copied
    ? ['beneGesserit', 'atreides', 'choam', 'emperor', 'fremen']
    : ['tleilaxu', 'atreides', 'choam', 'emperor', 'fremen'];
  const desired = [...supply, ...pool.filter(effect => !supply.includes(effect))];
  const current = [...pool], rolls: number[] = [];
  for (let i = current.length - 1; i > 0; i--) {
    const j = current.indexOf(desired[i]); assert.ok(j >= 0 && j <= i);
    rolls.push(Math.floor((j + 0.5) * 0x100000000 / (i + 1)));
    [current[i], current[j]] = [current[j], current[i]];
  }
  assert.deepEqual(current, desired); return { rolls, supply };
}

/** Genuine public Basic E3 source. Two distinct original poison cards kill
 * both leaders in one real Carthag battle. Ecaz is the native attacker and
 * wins the zero-strength tie with dial zero, so none of its forces or native
 * leaders enter the Tanks. Only the separate shared Duke needs revival.
 *
 * Stop BEFORE selecting the newly supported Duke grant. This fixture does not
 * install that selection, a death, a token, a wallet, a turn or an arrival. */
export function createDukeAmbassadorFixture(options: { copied?: boolean } = {}) {
  const copied = options.copied ?? false, packet = originalPacket(copied);
  let game = createGame('DUKEAMBASSADOR', newPlayer('ecaz', 'Ecaz', 'ecaz'), false, ['ecaz']);
  for (const faction of ['harkonnen', 'guild'] as const) joinGame(game, newPlayer(faction, faction, faction));
  const actions: DukeAmbassadorStep[] = [];
  const act = (actor: string, action: Action) => { game = actDukeAmbassador(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceDukeAmbassador(game, until, actions); };
  const transition = (step: DukeAmbassadorStep, until: (state: Game) => boolean): DukeAmbassadorTransition => {
    const before = structuredClone(game); act(step.actor, step.action); reach(until);
    return { before, step: structuredClone(step), after: structuredClone(game) };
  };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game);
  act(game.host, { type: 'start' });
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, false);
  assert.ok(game.players.every(player => player.hand.length === 0));
  const originalTreachery = game.deck.map(card => card.id).sort();
  const poisons = game.deck.filter(card => card.kind === 'poison').slice(0, 2);
  const fillers = game.deck.filter(card => card.kind === 'worthless').slice(0, 2);
  assert.equal(poisons.length, 2); assert.equal(fillers.length, 2);
  const deal = [poisons[0].id, poisons[1].id, fillers[0].id, fillers[1].id];
  const dealOrder = deal.map((id, position) => {
    const from = game.deck.findIndex(card => card.id === id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: id };
  });
  const beforeStartingDeal = structuredClone(game);
  let packetCreation: DukeAmbassadorTransition | null = null;
  for (let count = 0; game.status === 'setup' && count < 80; count++) {
    const next = nextDukeAmbassadorStep(game); assert.ok(next);
    const initializesForces = game.setupStage === 'traitors' && next.action.type === 'traitor' &&
      game.players.filter(player => player.traitorChoices.length > 0).length === 1;
    if (initializesForces) {
      const before = structuredClone(game);
      game = withDukeAmbassadorLottery(() => applyAction(game, next.actor, next.action), packet.rolls);
      actions.push(structuredClone(next));
      packetCreation = { before, step: structuredClone(next), after: structuredClone(game) };
    } else act(next.actor, next.action);
  }
  assert.equal(game.status, 'playing'); assert.ok(packetCreation);
  const afterSetup = structuredClone(game);
  const owner = 'ecaz', opponent = 'harkonnen', entrant = 'guild';
  const ecazToken = game.ecazAmbassadors!.tokens.find(token => token.effect === 'ecaz')!;
  const revivalToken = game.ecazAmbassadors!.tokens.find(token => token.effect === (copied ? 'beneGesserit' : 'tleilaxu'))!;
  assert.equal(ecazToken.zone, 'supply'); assert.equal(revivalToken.zone, 'supply');
  assert.equal(game.ecazAmbassadors!.tokens.find(token => token.effect === 'tleilaxu')!.zone, copied ? 'pool' : 'supply');
  assert.ok(dukeAmbassadorPlayer(game).hand.some(card => card.id === poisons[0].id));
  assert.ok(dukeAmbassadorPlayer(game, opponent).hand.some(card => card.id === poisons[1].id));
  // The original first two unopened land cards replace no live encounter and
  // keep both turns free of a worm/alliance detour. All Spice cards are retained.
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder = [0, 1].map(position => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery);
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0];
    game.spiceDeck.splice(position, 0, card); return { position, from, card: structuredClone(card) };
  });
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  reach(state => state.turn === 1 && state.phase === 4 && !state.response && !state.phaseOpening && state.decision?.kind === 'ecazPlacement');
  const placements = [
    transition({ actor: owner, action: { type: 'decision', token: ecazToken.id, territory: 'arrakeen' } },
      state => !state.response && state.decision?.kind === 'ecazPlacement'),
    transition({ actor: owner, action: { type: 'decision', token: revivalToken.id, territory: 'habbanya_ridge_sietch' } },
      state => !state.response && state.decision?.kind === 'ecazPlacement'),
  ];
  assert.equal(placements[0].after.players.find(player => player.id === owner)!.spice,
    placements[0].before.players.find(player => player.id === owner)!.spice - 1);
  assert.equal(placements[1].after.players.find(player => player.id === owner)!.spice,
    placements[1].before.players.find(player => player.id === owner)!.spice - 2);
  act(owner, { type: 'decision', decline: true });
  reach(state => state.phase === 5 && state.active === owner && dukeAmbassadorClean(state));
  const ownShipment = transition({ actor: owner, action: { type: 'ship', amount: 1, territory: 'carthag', sector: 11 } }, dukeAmbassadorClean);
  reach(state => state.phase === 5 && state.active === opponent && dukeAmbassadorClean(state));
  const acquisitionArrival = transition({ actor: opponent, action: { type: 'ship', amount: 1, territory: 'arrakeen', sector: 10 } },
    state => !state.response && state.pendingAmbassador?.stage === 'offer');
  assert.equal(game.pendingAmbassador!.token, ecazToken.id);
  const acquisition = transition({ actor: owner, action: { type: 'decision', event: game.pendingAmbassador!.event,
    trigger: true, beneficiary: owner, choice: 'duke' } }, dukeAmbassadorClean);
  assert.equal(game.dukeVidal!.controller, owner); assert.equal(game.dukeVidal!.source, 'ecaz');
  assert.equal(game.dukeVidal!.leader.dead, false);
  reach(state => state.phase === 6 && !state.battle && dukeAmbassadorClean(state));
  assert.equal(game.active, owner, 'The original first player circle gives Ecaz this battle choice');
  const beforeBattle = structuredClone(game), battleStep: DukeAmbassadorStep = {
    actor: owner, action: { type: 'chooseBattle', territory: 'carthag', target: opponent },
  };
  act(battleStep.actor, battleStep.action);
  reach(state => !!state.battle && dukeAmbassadorClean(state) && !state.battle.preparation &&
    (!state.battle.preLeader || state.battle.preLeader.closed));
  assert.equal(game.battle!.attacker, owner);
  const enemyLeader = dukeAmbassadorPlayer(game, opponent).leaders.filter(leader => !leader.dead && !leader.usedAt)
    .sort((a, b) => a.strength - b.strength)[0]; assert.ok(enemyLeader);
  const planSteps: DukeAmbassadorStep[] = [
    { actor: owner, action: { type: 'battlePlan', leader: DUKE_VIDAL_ID, dial: 0, support: 0, weapon: poisons[0].id } },
    { actor: opponent, action: { type: 'battlePlan', leader: enemyLeader.id, dial: 0, support: 0, weapon: poisons[1].id } },
  ];
  for (const step of planSteps) {
    act(step.actor, step.action);
    reach(state => !state.response && !state.phaseOpening && !state.decision);
  }
  const revealed = structuredClone(game);
  reach(state => !state.battle && dukeAmbassadorClean(state));
  const afterDeath = structuredClone(game);
  assert.equal(game.dukeVidal!.leader.dead, true); assert.equal(game.dukeVidal!.leader.deaths, 1);
  assert.equal(game.dukeVidal!.controller, null);
  assert.equal(dukeAmbassadorPlayer(game).tanks, 0);
  assert.ok(dukeAmbassadorPlayer(game).leaders.every(leader => !leader.dead));
  assert.equal(dukeAmbassadorPlayer(game).forces['carthag:11'], 1);
  assert.equal(dukeAmbassadorPlayer(game, opponent).leaders.find(leader => leader.id === enemyLeader.id)!.dead, true);
  reach(state => state.turn === 2 && state.phase === 5 && state.active === entrant && dukeAmbassadorClean(state));
  const beforeArrival = structuredClone(game);
  assert.equal(dukeAmbassadorPlayer(game, entrant).shipped, false);
  assert.equal(game.ecazAmbassadors!.tokens.find(token => token.id === revivalToken.id)!.zone, 'placed');
  const arrival = transition({ actor: entrant, action: { type: 'ship', amount: 1,
    territory: 'habbanya_ridge_sietch', sector: 17 } },
  state => !state.response && state.pendingAmbassador?.stage === 'offer');
  const offer = structuredClone(game), event = game.pendingAmbassador!.event;
  assert.equal(game.pendingAmbassador!.token, revivalToken.id);
  const triggerStep: DukeAmbassadorStep = { actor: owner,
    action: { type: 'decision', event, trigger: true, beneficiary: owner, choice: 'effect' } };
  act(triggerStep.actor, triggerStep.action);
  let beforeCopy: Game | null = null, copyStep: DukeAmbassadorStep | null = null;
  if (copied) {
    assert.equal(game.pendingAmbassador?.stage, 'copy'); beforeCopy = structuredClone(game);
    copyStep = { actor: owner, action: { type: 'decision', event, effect: 'tleilaxu' } };
    act(copyStep.actor, copyStep.action);
  }
  assert.equal(game.pendingAmbassador?.stage, 'revival');
  assert.equal(game.pendingAmbassador!.beneficiary, owner); assert.equal(game.pendingAmbassador!.entrant, entrant);
  assert.equal(game.pendingAmbassador!.effect, 'tleilaxu'); assert.equal(game.decision?.player, owner);
  assert.equal(game.active, entrant); assert.equal(game.turn, 2);
  assert.equal(dukeAmbassadorPlayer(game).tanks, 0);
  assert.ok(dukeAmbassadorPlayer(game).leaders.every(leader => !leader.dead));
  assert.deepEqual([...game.deck, ...game.discard, ...game.players.flatMap(player => player.hand)]
    .map(card => card.id).sort(), originalTreachery);
  const currentGrant = structuredClone(game), ownerView = viewGame(game, owner), entrantView = viewGame(game, entrant);
  return { game, lobby, setup, beforeStartingDeal, afterSetup, packetCreation, packet, deal, dealOrder,
    spiceOrder, originalTreachery, placements, ownShipment, acquisitionArrival, acquisition,
    beforeBattle, battleStep, planSteps, revealed, afterDeath, beforeArrival, arrival, offer,
    triggerStep, beforeCopy, copyStep, currentGrant, ownerView, entrantView,
    copied, advanced: false as const, owner, beneficiary: owner, opponent, entrant,
    duke: DUKE_VIDAL_ID, enemyLeader: enemyLeader.id, token: revivalToken.id, acquisitionToken: ecazToken.id,
    event, territory: 'habbanya_ridge_sietch', location: 'habbanya_ridge_sietch:17',
    poison: { ecaz: poisons[0].id, harkonnen: poisons[1].id },
    entrantContinuation: { actor: entrant, action: { type: 'endMovement' } } as DukeAmbassadorStep,
    actions, sourceActionCount: actions.length,
    staging: ['Only four unopened starting-deal positions, two unopened ordinary land Spice positions and original scalar lotteries are selected. Nine explicitly recorded draws select the actual initial Ambassador packet during the final original traitor choice. All other scalar draws retain original Fisher–Yates order; native UUID/byte entropy remains native. Public Basic Ecaz/Harkonnen/Guild setup, paid 1+2 Ambassador placements, paid reserve shipments, actual Ecaz-token Duke acquisition and two sealed poison plans produce the first Duke death. Ecaz wins the 0–0 attacker tie with dial 0 and keeps its physical force, naturally leaving no own force or native-leader revival alternative. Next turn Guild really pays and enters the already placed Tleilaxu or BG token. Stop at the native revival grant before choosing Duke. No dealt hand, army, wallet, clock, death, alliance, token, pending reaction or receipt is installed. Advanced with this Harkonnen roster is outside this source fixture.'] };
}
export type DukeAmbassadorFixture = ReturnType<typeof createDukeAmbassadorFixture>;
