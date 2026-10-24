import assert from 'node:assert/strict';
import { applyAction, createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { AMBASSADOR_EFFECTS, type AmbassadorEffect } from '../game/ecaz-ambassadors';
import { DUKE_VIDAL_ID } from '../game/duke-vidal';
import {
  actDukeAmbassador, dukeAmbassadorClean, dukeAmbassadorPlayer, nextDukeAmbassadorStep,
  type DukeAmbassadorStep, type DukeAmbassadorTransition,
} from './fixture-duke-ambassador';

export type AmbassadorRevivalIncomeStep = DukeAmbassadorStep;
export type AmbassadorRevivalIncomeTransition = DukeAmbassadorTransition;
export const ambassadorRevivalIncomePlayer = dukeAmbassadorPlayer;
export const ambassadorRevivalIncomeClean = dukeAmbassadorClean;
export const actAmbassadorRevivalIncome = actDukeAmbassador;

/** The native Tleilaxu has its ordinary opportunity to decline a Face Dance.
 * All other controls reuse the original Duke programme's no-spending driver. */
export function nextAmbassadorRevivalIncomeStep(game: Game): AmbassadorRevivalIncomeStep | null {
  if (!game.phaseOpening && !game.response && !game.pendingTreacheryDiscard && game.decision?.kind === 'faceDance')
    return { actor: game.decision.player, action: { type: 'decision', reveal: false } };
  return nextDukeAmbassadorStep(game);
}
export function advanceAmbassadorRevivalIncome(game: Game, until: (state: Game) => boolean,
  actions: AmbassadorRevivalIncomeStep[] = []): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original Ambassador income source ended before its next control');
    const step = nextAmbassadorRevivalIncomeStep(game);
    assert.ok(step, 'Choose the actual Ambassador effect or sealed plan before advancing');
    game = actAmbassadorRevivalIncome(game, step.actor, step.action, actions);
  }
  throw Error('The original Ambassador income source did not reach its finite boundary');
}

/** Select only the original packet's nine Fisher–Yates draws when the final
 * native traitor choice initializes starting forces. No live token is moved. */
function originalIncomePacket(copied: boolean) {
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
  assert.deepEqual(current, desired); return { supply, rolls };
}
function withOriginalIncomePacket<T>(rolls: readonly number[], run: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const original = crypto.getRandomValues.bind(crypto); let cursor = 0;
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array && array.length === 1)
      array[0] = cursor < rolls.length ? rolls[cursor++] : 0xffffffff;
    else Reflect.apply(original, crypto, [array]);
    return array;
  };
  try {
    const result = run(); assert.equal(cursor, rolls.length); return result;
  } finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}

/** Public Basic Ecaz/Harkonnen/Tleilaxu/Guild with the original selected E3+Ix
 * decks. Original poison plans kill the acquired shared Duke in a real battle;
 * the zero-dial attacker tie leaves Ecaz no force or native-leader alternative.
 * Guild's original dealt Karama stays held for a later genuine income response.
 * Stop at the free revival grant, before choosing a return or earning income. */
export function createAmbassadorRevivalIncomeFixture(options: { copied?: boolean } = {}) {
  const copied = options.copied ?? false, packet = originalIncomePacket(copied);
  const owner = 'ecaz', opponent = 'harkonnen', tleilaxu = 'tleilaxu', entrant = 'guild';
  let game = createGame('AMBASSADORREVIVALINCOME', newPlayer(owner, 'Ecaz', 'ecaz'), false, ['ecaz', 'ix']);
  for (const faction of ['harkonnen', 'tleilaxu', 'guild'] as const)
    joinGame(game, newPlayer(faction, faction, faction));
  const actions: AmbassadorRevivalIncomeStep[] = [];
  const act = (actor: string, action: Action) => { game = actAmbassadorRevivalIncome(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceAmbassadorRevivalIncome(game, until, actions); };
  const transition = (step: AmbassadorRevivalIncomeStep,
    until: (state: Game) => boolean): AmbassadorRevivalIncomeTransition => {
    const before = structuredClone(game); act(step.actor, step.action); reach(until);
    return { before, step: structuredClone(step), after: structuredClone(game) };
  };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game);
  act(game.host, { type: 'start' });
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, false);
  assert.deepEqual(game.expansions, ['ecaz', 'ix']);
  assert.ok(game.players.every(player => player.hand.length === 0));
  const originalTreachery = game.deck.map(card => card.id).sort();
  const poisons = game.deck.filter(card => card.kind === 'poison').slice(0, 2);
  const fillers = game.deck.filter(card => card.kind === 'worthless').slice(0, 2);
  const karama = game.deck.find(card => card.effect === 'karama');
  assert.equal(poisons.length, 2); assert.equal(fillers.length, 2); assert.ok(karama);
  const deal = [poisons[0].id, poisons[1].id, fillers[0].id, fillers[1].id, karama.id];
  const dealOrder = deal.map((id, position) => {
    const from = game.deck.findIndex(card => card.id === id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: id };
  });
  const beforeStartingDeal = structuredClone(game);
  let packetCreation: AmbassadorRevivalIncomeTransition | null = null;
  for (let count = 0; game.status === 'setup' && count < 80; count++) {
    const step = nextAmbassadorRevivalIncomeStep(game); assert.ok(step);
    const initializesForces = game.setupStage === 'traitors' && step.action.type === 'traitor' &&
      game.players.filter(player => player.traitorChoices.length > 0).length === 1;
    if (initializesForces) {
      const before = structuredClone(game);
      game = withOriginalIncomePacket(packet.rolls, () => applyAction(game, step.actor, step.action));
      actions.push(structuredClone(step));
      packetCreation = { before, step: structuredClone(step), after: structuredClone(game) };
    } else act(step.actor, step.action);
  }
  assert.equal(game.status, 'playing'); assert.ok(packetCreation);
  const afterSetup = structuredClone(game);
  assert.ok(ambassadorRevivalIncomePlayer(game, owner).hand.some(card => card.id === poisons[0].id));
  assert.ok(ambassadorRevivalIncomePlayer(game, opponent).hand.some(card => card.id === poisons[1].id));
  assert.ok(ambassadorRevivalIncomePlayer(game, entrant).hand.some(card => card.id === karama.id));
  assert.equal(ambassadorRevivalIncomePlayer(game, tleilaxu).faceDancers?.length, 3);
  const ecazToken = game.ecazAmbassadors!.tokens.find(token => token.effect === 'ecaz')!;
  const revivalToken = game.ecazAmbassadors!.tokens.find(token => token.effect === (copied ? 'beneGesserit' : 'tleilaxu'))!;
  assert.equal(ecazToken.zone, 'supply'); assert.equal(revivalToken.zone, 'supply');
  assert.equal(game.ecazAmbassadors!.tokens.find(token => token.effect === 'tleilaxu')!.zone, copied ? 'pool' : 'supply');
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder = [0, 1].map(position => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery);
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0];
    game.spiceDeck.splice(position, 0, card); return { position, from, card: structuredClone(card) };
  });
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  reach(state => state.turn === 1 && state.phase === 4 && !state.response && !state.phaseOpening &&
    state.decision?.kind === 'ecazPlacement');
  const placements = [
    transition({ actor: owner, action: { type: 'decision', token: ecazToken.id, territory: 'arrakeen' } },
      state => !state.response && state.decision?.kind === 'ecazPlacement'),
    transition({ actor: owner, action: { type: 'decision', token: revivalToken.id, territory: 'habbanya_ridge_sietch' } },
      state => !state.response && state.decision?.kind === 'ecazPlacement'),
  ];
  assert.equal(ambassadorRevivalIncomePlayer(placements[0].after).spice,
    ambassadorRevivalIncomePlayer(placements[0].before).spice - 1);
  assert.equal(ambassadorRevivalIncomePlayer(placements[1].after).spice,
    ambassadorRevivalIncomePlayer(placements[1].before).spice - 2);
  act(owner, { type: 'decision', decline: true });
  reach(state => state.phase === 5 && state.active === owner && ambassadorRevivalIncomeClean(state));
  const ownShipment = transition({ actor: owner,
    action: { type: 'ship', amount: 1, territory: 'carthag', sector: 11 } }, ambassadorRevivalIncomeClean);
  reach(state => state.phase === 5 && state.active === opponent && ambassadorRevivalIncomeClean(state));
  const acquisitionArrival = transition({ actor: opponent,
    action: { type: 'ship', amount: 1, territory: 'arrakeen', sector: 10 } },
  state => !state.response && state.pendingAmbassador?.stage === 'offer');
  assert.equal(game.pendingAmbassador!.token, ecazToken.id);
  const acquisition = transition({ actor: owner, action: { type: 'decision', event: game.pendingAmbassador!.event,
    trigger: true, beneficiary: owner, choice: 'duke' } }, ambassadorRevivalIncomeClean);
  assert.equal(game.dukeVidal!.controller, owner); assert.equal(game.dukeVidal!.source, 'ecaz');
  assert.equal(game.dukeVidal!.leader.dead, false);
  reach(state => state.phase === 6 && !state.battle && ambassadorRevivalIncomeClean(state));
  assert.equal(game.active, owner, 'The actual first native circle gives Ecaz the battle choice');
  const beforeBattle = structuredClone(game), battleStep: AmbassadorRevivalIncomeStep = {
    actor: owner, action: { type: 'chooseBattle', territory: 'carthag', target: opponent },
  };
  act(battleStep.actor, battleStep.action);
  reach(state => !!state.battle && ambassadorRevivalIncomeClean(state) && !state.battle.preparation &&
    (!state.battle.preLeader || state.battle.preLeader.closed));
  assert.equal(game.battle!.attacker, owner);
  const enemyLeader = ambassadorRevivalIncomePlayer(game, opponent).leaders
    .filter(leader => !leader.dead && !leader.usedAt).sort((a, b) => a.strength - b.strength)[0]; assert.ok(enemyLeader);
  const planSteps: AmbassadorRevivalIncomeStep[] = [
    { actor: owner, action: { type: 'battlePlan', leader: DUKE_VIDAL_ID, dial: 0, support: 0, weapon: poisons[0].id } },
    { actor: opponent, action: { type: 'battlePlan', leader: enemyLeader.id, dial: 0, support: 0, weapon: poisons[1].id } },
  ];
  for (const step of planSteps) {
    act(step.actor, step.action);
    reach(state => !state.response && !state.phaseOpening && !state.decision);
  }
  const revealed = structuredClone(game);
  reach(state => !state.battle && ambassadorRevivalIncomeClean(state));
  const afterDeath = structuredClone(game);
  assert.equal(game.dukeVidal!.leader.dead, true); assert.equal(game.dukeVidal!.leader.deaths, 1);
  assert.equal(game.dukeVidal!.controller, null);
  assert.equal(ambassadorRevivalIncomePlayer(game).tanks, 0);
  assert.ok(ambassadorRevivalIncomePlayer(game).leaders.every(leader => !leader.dead));
  assert.equal(ambassadorRevivalIncomePlayer(game).forces['carthag:11'], 1);
  assert.equal(ambassadorRevivalIncomePlayer(game, opponent).leaders.find(leader => leader.id === enemyLeader.id)!.dead, true);
  reach(state => state.turn === 2 && state.phase === 5 && state.active === entrant && ambassadorRevivalIncomeClean(state));
  const beforeArrival = structuredClone(game);
  assert.equal(ambassadorRevivalIncomePlayer(game, entrant).shipped, false);
  assert.equal(game.ecazAmbassadors!.tokens.find(token => token.id === revivalToken.id)!.zone, 'placed');
  const arrival = transition({ actor: entrant,
    action: { type: 'ship', amount: 1, territory: 'habbanya_ridge_sietch', sector: 17 } },
  state => !state.response && state.pendingAmbassador?.stage === 'offer');
  const offer = structuredClone(game), event = game.pendingAmbassador!.event;
  assert.equal(game.pendingAmbassador!.token, revivalToken.id);
  const triggerStep: AmbassadorRevivalIncomeStep = { actor: owner,
    action: { type: 'decision', event, trigger: true, beneficiary: owner, choice: 'effect' } };
  act(triggerStep.actor, triggerStep.action);
  let beforeCopy: Game | null = null, copyStep: AmbassadorRevivalIncomeStep | null = null;
  if (copied) {
    assert.equal(game.pendingAmbassador?.stage, 'copy'); beforeCopy = structuredClone(game);
    copyStep = { actor: owner, action: { type: 'decision', event, effect: 'tleilaxu' } };
    act(copyStep.actor, copyStep.action);
  }
  assert.equal(game.pendingAmbassador?.stage, 'revival');
  assert.equal(game.pendingAmbassador!.beneficiary, owner); assert.equal(game.pendingAmbassador!.entrant, entrant);
  assert.equal(game.pendingAmbassador!.effect, 'tleilaxu'); assert.equal(game.decision?.player, owner);
  assert.equal(game.active, entrant); assert.equal(game.turn, 2);
  assert.equal(ambassadorRevivalIncomePlayer(game).tanks, 0);
  assert.ok(ambassadorRevivalIncomePlayer(game).leaders.every(leader => !leader.dead));
  assert.ok(ambassadorRevivalIncomePlayer(game, entrant).hand.some(card => card.id === karama.id));
  assert.deepEqual([...game.deck, ...game.discard, ...game.players.flatMap(player => player.hand)]
    .map(card => card.id).sort(), originalTreachery);
  const currentGrant = structuredClone(game), ownerView = viewGame(game, owner), entrantView = viewGame(game, entrant);
  return { game, lobby, setup, beforeStartingDeal, afterSetup, packetCreation, packet, deal, dealOrder,
    spiceOrder, originalTreachery, originalSpice, placements, ownShipment, acquisitionArrival, acquisition,
    beforeBattle, battleStep, planSteps, revealed, afterDeath, beforeArrival, arrival, offer,
    triggerStep, beforeCopy, copyStep, currentGrant, ownerView, entrantView,
    copied, advanced: false as const, owner, beneficiary: owner, opponent, entrant, tleilaxu, incomeOwner: tleilaxu,
    duke: DUKE_VIDAL_ID, enemyLeader: enemyLeader.id, token: revivalToken.id, acquisitionToken: ecazToken.id,
    event, territory: 'habbanya_ridge_sietch', location: 'habbanya_ridge_sietch:17',
    poison: { ecaz: poisons[0].id, harkonnen: poisons[1].id }, cancelCard: karama.id, cancelActor: entrant,
    entrantContinuation: { actor: entrant, action: { type: 'endMovement' } } as AmbassadorRevivalIncomeStep,
    actions, sourceActionCount: actions.length,
    staging: ['Only five unopened starting-deal positions, two unopened ordinary land Spice positions and original scalar lotteries are selected. Nine recorded draws select the initial native Ambassador packet during the final original traitor choice. Other scalar draws preserve original Fisher–Yates order; UUID/byte entropy remains native. Public Basic Ecaz/Harkonnen/Tleilaxu/Guild setup selects original E3+Ix decks, deals actual Face Dancers and gives Guild the physical Karama. Paid 1+2 Ambassador placements, paid shipments, actual Ecaz-token Duke acquisition and sealed native poison plans produce his first death. Ecaz wins the 0–0 attacker tie at dial 0 with its force intact and no dead native leaders. Original readiness and movement endings reach the next turn; Guild pays and enters the previously placed Tleilaxu or BG marker. The native grant is open before any revival or income action; Guild still holds its original Karama for the owner-controlled cancellation programme. No dealt card, force, resource, death, token, clock, queue or effect receipt is installed. Native Tleilaxu voluntary Face Dance is declined through its original control.'] };
}
export type AmbassadorRevivalIncomeFixture = ReturnType<typeof createAmbassadorRevivalIncomeFixture>;
