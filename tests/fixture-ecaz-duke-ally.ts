import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, type Action, type Game } from '../game/engine';
import { DUKE_VIDAL_ID } from '../game/duke-vidal';
import { validateNexusCards, NEXUS_FACTIONS } from '../game/nexus-cards';
import { actDukeAmbassador, dukeAmbassadorClean, dukeAmbassadorPlayer,
  nextDukeAmbassadorStep } from './fixture-duke-ambassador';
import { advisorPreparationInventory } from './fixture-advisor-preparation';

export type EcazDukeAllyStep = { actor: string; action: Action };
export const actEcazDukeAlly = actDukeAmbassador;
export const ecazDukeAllyClean = dukeAmbassadorClean;
export const ecazDukeAllyPlayer = dukeAmbassadorPlayer;
export function ecazDukeAllyInventory(game: Game) {
  const treachery = advisorPreparationInventory(game);
  assert.equal(treachery.length, 33, 'The source retains the original base deck without selecting E3 Treachery');
  assert.ok(game.nexusCards?.cards);
  validateNexusCards(game.nexusCards.cards, game.players);
  const cards = game.nexusCards.cards, nexus = [...cards.deck, ...cards.discard,
    ...Object.values(cards.hands).filter(card => card !== null)].sort();
  assert.deepEqual(nexus, [...NEXUS_FACTIONS].sort());
  assert.ok(game.players.every(player => !player.leaders.some(leader => leader.id === DUKE_VIDAL_ID)));
  assert.ok(!(game.traitorReserve ?? []).includes(DUKE_VIDAL_ID));
  assert.ok(game.players.every(player => ![...player.traitors, ...player.traitorChoices].includes(DUKE_VIDAL_ID)));
  return { treachery, nexus };
}
export function ecazDukeAllyPhysical(game: Game) {
  return { active: game.active, movementRemaining: [...(game.movementRemaining ?? [])],
    players: game.players.map(player => ({ id: player.id, spice: player.spice, forces: structuredClone(player.forces),
      reserves: player.reserves, tanks: player.tanks, elites: structuredClone(player.elites),
      shipped: player.shipped, moved: player.moved })) };
}
export function nextEcazDukeAllyStep(game: Game): EcazDukeAllyStep | null {
  if (ecazDukeAllyClean(game) && game.nexusCards?.phase?.stage === 'drawing') {
    const actor = game.nexusCards.phase.eligible.find(id => !game.nexusCards!.phase!.done.includes(id));
    assert.ok(actor);
    return { actor, action: { type: 'nexusCardChoice', turn: game.turn,
      card: game.nexusCards.cards!.hands[actor], choice: 'keep', ownRedraws: 0 } };
  }
  return nextDukeAmbassadorStep(game);
}
export function advanceEcazDukeAlly(game: Game, until: (state: Game) => boolean,
  actions: EcazDukeAllyStep[] = []): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The native existing-ally Duke source ended before its owned boundary');
    const step = nextEcazDukeAllyStep(game);
    assert.ok(step, `Choose the actual ${game.turn}/${game.phase}/${game.decision?.kind} before continuing`);
    game = actEcazDukeAlly(game, step.actor, step.action, actions);
  }
  throw Error('The native existing-ally Duke source did not reach its finite boundary');
}
function orderSpice(game: Game, names: readonly string[]) {
  const cards = names.map(name => {
    const at = game.spiceDeck.findIndex(card => name === 'worm'
      ? 'worm' in card && !card.greatMaker && !card.thumper && !card.suppressed
      : 'territory' in card && !card.discovery && card.territory === name);
    assert.ok(at >= 0, `The original ${name} Spice Card must remain unopened`);
    return game.spiceDeck.splice(at, 1)[0];
  });
  game.spiceDeck.unshift(...cards);
}

/** Native self-acquisition is deliberately left unused through Mentat. A real
 * next-turn Nexus forms the alliance before the reusable token is placed and
 * a different nonally entry earns the existing-ally beneficiary offer. */
export function createEcazDukeAllyFixture(options: { advanced?: boolean } = {}) {
  const advanced = options.advanced ?? false;
  let game = createGame('ECAZDUKEALLY', newPlayer('ecaz', 'Ecaz', 'ecaz'), advanced, ['ecaz']);
  for (const faction of ['atreides', 'emperor', 'guild'] as const)
    joinGame(game, newPlayer(faction, faction, faction));
  const actions: EcazDukeAllyStep[] = [];
  const act = (actor: string, action: Action) => { game = actEcazDukeAlly(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceEcazDukeAlly(game, until, actions); };
  act(game.host, { type: 'moduleOption', module: 'nexusCards', enabled: true });
  for (const player of game.players) act(player.id, { type: 'ready' });
  const initial = structuredClone(game);
  act(game.host, advanced ? { type: 'start', advancedPreview: true } : { type: 'start' });
  const setup = structuredClone(game);
  reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game), originalInventory = ecazDukeAllyInventory(game);
  const token = game.ecazAmbassadors!.tokens.find(token => token.effect === 'ecaz');
  assert.ok(token && token.zone === 'supply');
  const cohort = [...game.ecazAmbassadors!.cohort];
  orderSpice(game, ['broken_land', ...(advanced ? ['south_mesa'] : [])]);
  const placements: { before: Game; action: Action; after: Game }[] = [];
  const place = (territory: string) => {
    reach(state => !state.response && !state.phaseOpening && state.decision?.kind === 'ecazPlacement');
    const before = structuredClone(game), action: Action = { type: 'decision', token: token.id, territory };
    act('ecaz', action);
    reach(state => !state.response && !state.phaseOpening && state.decision?.kind === 'ecazPlacement');
    placements.push({ before, action, after: structuredClone(game) });
    act('ecaz', { type: 'decision', decline: true });
  };
  const shipments: { before: Game; step: EcazDukeAllyStep; after: Game }[] = [];
  const ship = (actor: string, territory: string, sector: number, offer: boolean) => {
    reach(state => state.phase === 5 && state.active === actor && ecazDukeAllyClean(state));
    const before = structuredClone(game), step: EcazDukeAllyStep = { actor,
      action: { type: 'ship', territory, sector, amount: 1, elite: 0, allyPayment: 0 } };
    act(actor, step.action);
    reach(state => offer
      ? !state.response && !state.phaseOpening && state.pendingAmbassador?.stage === 'offer'
      : ecazDukeAllyClean(state));
    shipments.push({ before, step, after: structuredClone(game) });
  };
  place('habbanya_ridge_sietch');
  ship('emperor', 'habbanya_ridge_sietch', 17, true);
  const beforeSelf = structuredClone(game), selfAction: Action = { type: 'decision',
    event: game.pendingAmbassador!.event, trigger: true, beneficiary: 'ecaz', choice: 'duke' };
  act('ecaz', selfAction); reach(ecazDukeAllyClean);
  const afterSelf = structuredClone(game);
  assert.deepEqual([game.dukeVidal!.controller, game.dukeVidal!.source, game.dukeVidal!.acquiredTurn], ['ecaz', 'ecaz', 1]);
  assert.equal(game.ecazAmbassadors!.tokens.find(current => current.id === token.id)!.zone, 'supply');
  reach(state => state.turn === 2 && state.phase === 1 && ecazDukeAllyClean(state));
  const afterMentat = structuredClone(game);
  assert.equal(game.dukeVidal!.controller, 'ecaz', 'The unused ordinary Ecaz acquisition persists across the turn boundary');
  orderSpice(game, ['worm', 'hagga_basin', ...(advanced ? ['red_chasm'] : [])]);
  reach(state => state.nexus && !state.spiceWindow && !state.spiceResolution && ecazDukeAllyClean(state));
  const beforeAlliance = structuredClone(game), allianceStart = actions.length;
  act('ecaz', { type: 'alliance', target: 'atreides' });
  act('atreides', { type: 'alliance', target: 'ecaz' });
  const alliance = { before: beforeAlliance, actions: structuredClone(actions.slice(allianceStart)), after: structuredClone(game) };
  place('carthag');
  ship('atreides', 'carthag', 11, false);
  ship('emperor', 'carthag', 11, true);
  assert.equal(game.turn, 2);
  assert.equal(game.pendingAmbassador!.owner, 'ecaz');
  assert.equal(game.pendingAmbassador!.entrant, 'emperor');
  assert.equal(game.pendingAmbassador!.token, token.id);
  assert.equal(game.dukeVidal!.controller, 'ecaz');
  const event = game.pendingAmbassador!.event;
  const action: Action = { type: 'decision', event, trigger: true, beneficiary: 'atreides', choice: 'duke' };
  return { game, advanced, owner: 'ecaz', holder: 'ecaz', ally: 'atreides', recipient: 'atreides', entrant: 'emperor',
    opponent: 'emperor', duke: DUKE_VIDAL_ID, token: token.id, event, action, initial, setup, afterSetup,
    originalInventory, cohort, placements, shipments, beforeSelf, selfAction, afterSelf, afterMentat, alliance,
    originalDuke: structuredClone(game.dukeVidal!), originalParent: structuredClone(game.pendingAmbassador),
    originalPhysical: ecazDukeAllyPhysical(game), actions, sourceActionCount: actions.length,
    staging: ['Only original unopened Spice positions and native scalar lotteries are selected. Two actual Ecaz-token placements, Emperor entries, native self-acquisition, full unused Mentat, real worm/Nexus alliance and Atreides opposing shipment create this source.'] };
}
export type EcazDukeAllyFixture = ReturnType<typeof createEcazDukeAllyFixture>;
export function grantEcazDukeAlly(fixture: EcazDukeAllyFixture, game = structuredClone(fixture.game),
  actions: EcazDukeAllyStep[] = []) {
  return actEcazDukeAlly(game, fixture.owner, fixture.action, actions);
}
export function finishEcazDukeAlly(fixture: EcazDukeAllyFixture, game: Game,
  actions: EcazDukeAllyStep[] = []) {
  return advanceEcazDukeAlly(game, state => state.turn === fixture.game.turn && !state.pendingAmbassador && ecazDukeAllyClean(state), actions);
}
export function battleEcazDukeAlly(fixture: EcazDukeAllyFixture, game: Game,
  actions: EcazDukeAllyStep[] = [], options: { useDuke?: boolean } = {}) {
  game = advanceEcazDukeAlly(game, state => state.phase === 6 && ecazDukeAllyClean(state), actions);
  assert.ok(game.active === fixture.ally || game.active === fixture.opponent);
  const chooser = game.active;
  game = actEcazDukeAlly(game, chooser, { type: 'chooseBattle', territory: 'carthag',
    target: chooser === fixture.ally ? fixture.opponent : fixture.ally }, actions);
  game = advanceEcazDukeAlly(game, state => !!state.battle && (!state.battle.preLeader || state.battle.preLeader.closed) &&
    !state.battle.preparation && ecazDukeAllyClean(state), actions);
  const beforePlans = structuredClone(game), opponent = [...ecazDukeAllyPlayer(game, fixture.opponent).leaders]
    .filter(leader => !leader.dead && !leader.usedAt).sort((a, b) => a.strength - b.strength)[0];
  const native = [...ecazDukeAllyPlayer(game, fixture.ally).leaders]
    .filter(leader => !leader.dead && !leader.usedAt).sort((a, b) => b.strength - a.strength)[0];
  const useDuke = options.useDuke ?? true;
  assert.ok(opponent && native && (useDuke ? 6 : native.strength) > opponent.strength);
  const plans: EcazDukeAllyStep[] = [
    { actor: fixture.ally, action: { type: 'battlePlan', leader: useDuke ? DUKE_VIDAL_ID : native.id, dial: 0, support: 0 } },
    { actor: fixture.opponent, action: { type: 'battlePlan', leader: opponent.id, dial: 0, support: 0 } },
  ];
  for (const step of plans) game = actEcazDukeAlly(game, step.actor, step.action, actions);
  const sealed = structuredClone(game);
  game = advanceEcazDukeAlly(game, state => !state.battle && ecazDukeAllyClean(state), actions);
  return { game, beforePlans, sealed, plans, actions };
}
