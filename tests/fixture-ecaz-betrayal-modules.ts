import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { MOBILE_LOCATION, MOBILE_STRONGHOLD, splitLocation, territory } from '../game/board';
import { nativeShipmentSources } from '../game/homeworld-options';
import type { NoFieldValue } from '../game/richese-no-field';
import type { SelectedIndependentEntryOptions } from './fixture-selected-independent-nexus-entry';
import {
  actE3IndependentDuke, e3IndependentDukeClean, nextE3IndependentDukeStep,
} from './fixture-e3-independent-nexus-duke';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';

export type EcazBetrayalModulesStep = { actor: string; action: Action };
export type EcazBetrayalModulesOptions = Omit<SelectedIndependentEntryOptions, 'factions' | 'expansions'> & {
  expansions?: Game['expansions'];
  program?: 'typed' | 'richese' | 'advisors' | 'hms';
  marker?: NoFieldValue;
};
export const ecazBetrayalModulesClean = e3IndependentDukeClean;
export const ecazBetrayalModulesPlayer = (game: Game, actor: string) => {
  const player = game.players.find(player => player.id === actor); assert.ok(player); return player;
};
export function actEcazBetrayalModules(game: Game, actor: string, action: Action,
  actions?: EcazBetrayalModulesStep[]): Game {
  return actE3IndependentDuke(game, actor, action, actions);
}
export function advanceEcazBetrayalModules(game: Game, until: (state: Game) => boolean,
  actions: EcazBetrayalModulesStep[] = []): Game {
  for (let count = 0; count < 2600; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'Original Betrayal programme ended before its next opening');
    // An accepted extra allied shipment must reveal the existing marker first.
    // This programme keeps its genuine own shipment concealed by declining the
    // separate optional offer, rather than changing already-deployed custody.
    const step: EcazBetrayalModulesStep | null = !game.response && !game.phaseOpening &&
      !game.pendingTreacheryDiscard && game.decision?.kind === 'richeseAllyOpportunity'
      ? { actor: game.decision.player, action: { type: 'decision', decline: true } }
      : nextE3IndependentDukeStep(game);
    assert.ok(step, `Choose the actual ${game.decision?.kind ?? 'Battle Plan'} at ${game.turn}/${game.phase}`);
    game = actEcazBetrayalModules(game, step.actor, step.action, actions);
  }
  throw Error('Original Ecaz Betrayal module programme did not reach its finite boundary');
}

/** Same normal host entry as the shared selected-entry helper. The two local
 * setup choices are original controls: a sheltered first HMS placement and a
 * BG advisor beside the original six Ecaz counters. Neither relocates a piece. */
function originalSetup(options: EcazBetrayalModulesOptions, ally: 'emperor' | 'richese' | 'beneGesserit' | 'ixians') {
  const defaultExpansions: Game['expansions'] = ['ecaz',
    ...(ally === 'richese' ? ['choam'] as const : ally === 'ixians' ? ['ix'] as const : [])];
  let game = createGame('ECAZBETRAYALMODULES', newPlayer('ecaz', 'Ecaz', 'ecaz'), options.advanced ?? true,
    options.expansions ?? defaultExpansions);
  for (const faction of [ally, 'guild'] as const) joinGame(game, newPlayer(faction, faction, faction));
  const actions: EcazBetrayalModulesStep[] = [];
  const act = (actor: string, action: Action) => { game = actEcazBetrayalModules(game, actor, action, actions); };
  for (const selection of ['ecazTreachery', 'nexusCards', ...(options.skills ? ['leaderSkills'] : [])])
    act(game.host, { type: 'moduleOption', module: selection, enabled: true });
  for (const [type, enabled] of [['homeworlds', options.homeworlds], ['techTokens', options.tech],
    ['strongholdCards', options.strongholds]] as const) if (enabled) act(game.host, { type, enabled: true });
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game);
  act(game.host, game.advanced ? { type: 'start', advancedPreview: true } : { type: 'start' });
  const setup = structuredClone(game);
  for (let count = 0; game.status === 'setup' && count < 180; count++) {
    let step: EcazBetrayalModulesStep | undefined;
    if (game.decision?.kind === 'mobileStronghold' && game.decision.placement)
      step = { actor: game.decision.player, action: { type: 'decision', location: 'polar_sink:0' } };
    else if (game.advanced && ally === 'beneGesserit' && game.setupStage === 'forces' &&
      ecazBetrayalModulesPlayer(game, 'ecaz').reserves === 14 &&
      !ecazBetrayalModulesPlayer(game, ally).advisorSetup && viewGame(game, ally).setupPending.includes(ally))
      step = { actor: ally, action: { type: 'advisorSetup', territory: 'imperial_basin',
        sector: territory('imperial_basin').sectors[0] } };
    else for (const player of game.players) {
      const view = viewGame(game, player.id);
      view.players.find(seat => seat.id === player.id)!.bot = 'Easy';
      const action = botActions(view)[0];
      if (action) { step = { actor: player.id, action }; break; }
    }
    assert.ok(step, 'Original setup must expose its next owned private choice');
    act(step.actor, step.action);
  }
  assert.equal(game.status, 'playing');
  return { lobby, setup, game, actions };
}
function orderBlow(game: Game, worm = false) {
  const front: Game['spiceDeck'] = [];
  if (worm) {
    const at = game.spiceDeck.findIndex(card => 'worm' in card && !card.greatMaker && !card.suppressed && !card.thumper);
    assert.ok(at >= 0); front.push(game.spiceDeck.splice(at, 1)[0]);
  }
  for (let count = 0; count < (game.advanced ? 2 : 1); count++) {
    const at = game.spiceDeck.findIndex(card => 'territory' in card && !card.discovery && card.territory !== 'imperial_basin');
    assert.ok(at >= 0); front.push(game.spiceDeck.splice(at, 1)[0]);
  }
  game.spiceDeck.unshift(...front);
}
/** Actual paid one-spice auction, including the original optional Ixian pool.
 * Desired singleton positions are selected while the original deck is unopened. */
function acquireKarama(game: Game, actions: EcazBetrayalModulesStep[]) {
  assert.equal(game.phase, 2);
  const at = game.deck.findIndex(card => card.effect === 'karama'); assert.ok(at >= 0);
  const card = game.deck.splice(at, 1)[0]; game.deck.unshift(card);
  let bid: EcazBetrayalModulesStep | undefined;
  const before = structuredClone(game);
  for (let count = 0; count < 350; count++) {
    if (ecazBetrayalModulesPlayer(game, 'ecaz').hand.some(held => held.id === card.id)) {
      assert.ok(bid, 'Ecaz must acquire its real Karama through the actual paid auction');
      return { game, card: card.id, before, bid };
    }
    let step: EcazBetrayalModulesStep | null = null;
    if (!game.response && !game.phaseOpening && game.decision?.kind === 'ixAuction') {
      const returned = game.ixAuction!.cards.find(held => held.id !== card.id); assert.ok(returned);
      step = { actor: game.decision.player, action: { type: 'decision', card: returned.id, position: 'bottom' } };
    } else if (ecazBetrayalModulesClean(game) && game.auction?.active === 'ecaz' &&
      game.auction.cards[game.auction.index].id === card.id && game.auction.bid === 0) {
      step = { actor: 'ecaz', action: { type: 'bid', amount: 1, allyPayment: 0 } }; bid = structuredClone(step);
    }
    step ??= nextE3IndependentDukeStep(game); assert.ok(step);
    game = actEcazBetrayalModules(game, step.actor, step.action, actions);
  }
  throw Error('The original auction did not deliver its genuine Karama');
}

/** Original first deal, paid outside group, real worm alliance/closing draw,
 * and original cooccupation. Return before turn-three first Shipment actions.
 * Marker values select only an owner's existing physical token; no concealment,
 * force, stance, receipt, wallet or historical ownership is assigned. */
export function createEcazBetrayalModulesFixture(options: EcazBetrayalModulesOptions = {}) {
  const program = options.program ?? 'typed';
  const ally = program === 'richese' ? 'richese' : program === 'advisors' ? 'beneGesserit' :
    program === 'hms' ? 'ixians' : 'emperor';
  const source = withClassicDiscoveryNexusLottery(() => originalSetup(options, ally));
  let game = structuredClone(source.game);
  const afterSetup = structuredClone(game), actions = [...source.actions];
  const staging = ['Use original host/setup controls and only unopened land, worm, Karama and Ecaz Nexus card ordering; all paid/typed placements remain original actions.'];
  const act = (actor: string, action: Action) => { game = actEcazBetrayalModules(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceEcazBetrayalModules(game, until, actions); };
  const shipments: { before: Game; step: EcazBetrayalModulesStep; after: Game }[] = [];
  const ship = (actor: string, place: string, sector: number, amount: number, elite: number, field?: string) => {
    const homeworldSources = game.homeworlds && !field ? nativeShipmentSources(viewGame(game, actor), amount, elite) : undefined;
    assert.ok(!game.homeworlds || field || homeworldSources);
    const step: EcazBetrayalModulesStep = { actor, action: { type: 'ship', territory: place, sector,
      ...(field ? { noField: field, event: ecazBetrayalModulesPlayer(game, actor).noFieldEvent }
        : { amount, elite, ...(homeworldSources ? { homeworldSources } : {}) }), allyPayment: 0 } };
    const before = structuredClone(game); act(actor, step.action); reach(ecazBetrayalModulesClean);
    shipments.push({ before, step, after: structuredClone(game) });
  };
  orderBlow(game);
  reach(state => state.phase === 2 && ecazBetrayalModulesClean(state));
  const acquired = acquireKarama(game, actions); game = acquired.game;
  reach(state => state.phase === 5 && state.active === ally && ecazBetrayalModulesClean(state));
  ship(ally, 'arrakeen', 10, 1, 0);
  reach(state => state.turn === 2 && state.phase === 1 && ecazBetrayalModulesClean(state));
  const afterFirstTurn = structuredClone(game);
  orderBlow(game, true);
  reach(state => state.nexus && !state.spiceWindow && !state.spiceResolution && ecazBetrayalModulesClean(state));
  const beforeAlliance = structuredClone(game);
  act('ecaz', { type: 'alliance', target: ally }); act(ally, { type: 'alliance', target: 'ecaz' });
  reach(state => state.nexusCards?.phase?.stage === 'drawing' && ecazBetrayalModulesClean(state));
  const cards = game.nexusCards!.cards!, at = cards.deck.indexOf('ecaz'); assert.ok(at >= 0);
  cards.deck.unshift(cards.deck.splice(at, 1)[0]);
  const beforeDraw = structuredClone(game), draw: EcazBetrayalModulesStep = { actor: 'guild', action: {
    type: 'nexusCardChoice', turn: game.turn, card: cards.hands.guild, choice: 'draw', ownRedraws: 0,
  } };
  act(draw.actor, draw.action);
  const afterDraw = structuredClone(game);
  const target = program === 'hms' ? MOBILE_STRONGHOLD : 'imperial_basin';
  const location = program === 'hms' ? MOBILE_LOCATION : `imperial_basin:${territory('imperial_basin').sectors[0]}`;
  let marker: string | undefined, entryMove: EcazBetrayalModulesStep | undefined;
  if (program === 'hms') {
    reach(state => state.phase === 5 && state.active === 'ecaz' && ecazBetrayalModulesClean(state));
    const pointer = game.mobileStronghold!.location!; assert.equal(pointer, 'polar_sink:0');
    const parent = splitLocation(pointer); ship('ecaz', parent.territory, parent.sector, 1, 0);
    entryMove = { actor: 'ecaz', action: { type: 'move', from: pointer, amount: 1, elite: 0,
      territory: MOBILE_STRONGHOLD, sector: 0 } };
    act(entryMove.actor, entryMove.action); reach(ecazBetrayalModulesClean);
  } else {
    reach(state => state.phase === 5 && state.active === ally && ecazBetrayalModulesClean(state));
    if (program === 'richese') {
      marker = ecazBetrayalModulesPlayer(game, ally).noField!.tokens.find(token => token.value === (options.marker ?? 3))!.id;
      ship(ally, target, territory(target).sectors[0], 1, 0, marker);
    } else ship(ally, target, territory(target).sectors[0], program === 'typed' ? 3 : 1,
      program === 'typed' && game.advanced ? 2 : 0);
  }
  const cooccupied = structuredClone(game);
  reach(state => state.turn === 3 && state.phase === 1 && ecazBetrayalModulesClean(state));
  orderBlow(game);
  reach(state => state.turn === 3 && state.phase === 5 && ecazBetrayalModulesClean(state));
  const offer = viewGame(game, 'guild').nexusEcazBetrayal;
  assert.ok(offer && !offer.blocked, offer?.blocked ?? 'The genuine closing card needs a live first-Shipment offer');
  const row = offer.territories.find(row => row.territory === target); assert.ok(row);
  const action: Action = { type: 'nexusEcazBetrayal', event: offer.event, territory: target };
  return { ...source, afterSetup, afterFirstTurn, acquired, beforeAlliance, beforeDraw, draw, afterDraw,
    cooccupied, game, actions, staging, shipments, program, ally, target, location, marker, entryMove,
    owner: 'guild', counter: 'ecaz', karama: acquired.card, offer, row, action };
}
export type EcazBetrayalModulesFixture = ReturnType<typeof createEcazBetrayalModulesFixture>;

/** Resolve actual Karama/allowance response queues without consuming Shipment
 * or Movement. The counter card was paid for in the original first auction. */
export function resolveEcazBetrayalModules(fixture: EcazBetrayalModulesFixture, cancel = false) {
  const actions: EcazBetrayalModulesStep[] = [];
  let game = actEcazBetrayalModules(structuredClone(fixture.game), fixture.owner, fixture.action, actions);
  const declared = structuredClone(game);
  if (cancel) game = actEcazBetrayalModules(game, fixture.counter,
    { type: 'card', card: fixture.karama, mode: 'cancel' }, actions);
  game = advanceEcazBetrayalModules(game, ecazBetrayalModulesClean, actions);
  return { game, declared, actions };
}

/** Finite minimal-legal policy smoke; every candidate comes from its owner's
 * actual view and is accepted through the original response continuation. */
export function smokeEcazBetrayalModules(options: EcazBetrayalModulesOptions = {}) {
  const fixture = createEcazBetrayalModulesFixture(options);
  return (['Easy', 'Medium', 'Hard', 'Brutal'] as const).map(difficulty => {
    const view = viewGame(fixture.game, fixture.owner);
    view.players.find(player => player.id === fixture.owner)!.bot = difficulty;
    const action = botActions(view).find(action => action.type === 'nexusEcazBetrayal' && action.territory === fixture.target);
    assert.ok(action, `${difficulty} must retain the original opening return action`);
    const actions: EcazBetrayalModulesStep[] = [];
    const game = advanceEcazBetrayalModules(actEcazBetrayalModules(structuredClone(fixture.game), fixture.owner, action, actions),
      ecazBetrayalModulesClean, actions);
    return { difficulty, actions: actions.length, phase: game.phase, active: game.active,
      completed: game.nexusEcazBetrayalHistory!.at(-1)!.stage === 'complete' };
  });
}
