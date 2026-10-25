import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { distance, location, splitLocation, TERRITORIES, territory } from '../game/board';
import { nativeShipmentSources } from '../game/homeworld-options';
import { greatMakerRideAction } from '../game/great-maker-options';
import {
  actE3IndependentDuke, e3IndependentDukeClean, nextE3IndependentDukeStep,
} from './fixture-e3-independent-nexus-duke';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';

export type FremenBetrayalModulesStep = { actor: string; action: Action };
export type FremenBetrayalModulesOptions = {
  advanced?: boolean;
  homeworlds?: boolean;
  skills?: boolean;
  tech?: boolean;
  strongholds?: boolean;
  expansions?: Game['expansions'];
  program?: 'movement' | 'worm';
  /** Earn city ornithopters through a real free reinforcement and board move. */
  city?: boolean;
  /** The real Nexus between Advanced piles may end the native alliance before
   * an empty second-pile appearance after the completed Great Maker. */
  emptyAfterMaker?: boolean;
};
export const fremenBetrayalModulesClean = e3IndependentDukeClean;
export const fremenBetrayalModulesPlayer = (game: Game, actor: string) => {
  const player = game.players.find(player => player.id === actor); assert.ok(player); return player;
};
export const actFremenBetrayalModules = actE3IndependentDuke;
export function advanceFremenBetrayalModules(game: Game, until: (state: Game) => boolean,
  actions: FremenBetrayalModulesStep[] = []): Game {
  for (let count = 0; count < 2200; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original Fremen programme ended before its owned boundary');
    const step = nextE3IndependentDukeStep(game);
    assert.ok(step, `Complete the real ${game.decision?.kind ?? 'Battle Plan'} at ${game.turn}/${game.phase}`);
    game = actFremenBetrayalModules(game, step.actor, step.action, actions);
  }
  throw Error('The original Fremen Betrayal programme did not reach its finite boundary');
}

/** Original lobby selections, original private setup choices and original
 * typed starting placement. The scalar producer only orders unopened decks. */
function originalSetup(options: FremenBetrayalModulesOptions) {
  const discovery = options.program === 'worm';
  let game = createGame('FREMENBETRAYALMODULES', newPlayer('fremen', 'Fremen', 'fremen'),
    options.advanced ?? true, options.expansions ?? (discovery ? [] : ['ix', 'choam', 'ecaz']));
  for (const faction of ['emperor', 'guild'] as const) joinGame(game, newPlayer(faction, faction, faction));
  const actions: FremenBetrayalModulesStep[] = [];
  const act = (actor: string, action: Action) => { game = actFremenBetrayalModules(game, actor, action, actions); };
  for (const selection of ['nexusCards', ...(discovery ? ['discoveries'] : ['ecazTreachery']),
    ...(options.skills !== false ? ['leaderSkills'] : [])])
    act(game.host, { type: 'moduleOption', module: selection, enabled: true });
  for (const [type, enabled] of [['homeworlds', options.homeworlds ?? true], ['techTokens', options.tech ?? true],
    ['strongholdCards', options.strongholds ?? game.advanced]] as const)
    if (enabled) act(game.host, { type, enabled: true });
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game);
  act(game.host, game.advanced ? { type: 'start', advancedPreview: true } : { type: 'start' });
  const setup = structuredClone(game);
  const source = location('sietch_tabr', territory('sietch_tabr').sectors[0]);
  for (let count = 0; game.status === 'setup' && count < 180; count++) {
    let step: FremenBetrayalModulesStep | undefined;
    if (game.setupStage === 'forces' && fremenBetrayalModulesPlayer(game, 'fremen').reserves === 20)
      step = { actor: 'fremen', action: { type: 'fremenSetup', placements: { [source]: 10 },
        ...(game.advanced ? { elitePlacements: { [source]: 1 } } : {}) } };
    else for (const player of game.players) {
      const view = viewGame(game, player.id);
      view.players.find(seat => seat.id === player.id)!.bot = 'Easy';
      const action = botActions(view)[0];
      if (action) { step = { actor: player.id, action }; break; }
    }
    assert.ok(step, 'Original private Fremen setup must expose a legal next control');
    act(step.actor, step.action);
  }
  assert.equal(game.status, 'playing');
  return { lobby, setup, game, actions, source };
}

/** Choose a position only while each physical Spice Card remains unopened. */
function orderSpice(game: Game, choices: string[]) {
  const front: Game['spiceDeck'] = [];
  for (const choice of choices) {
    const at = game.spiceDeck.findIndex(card => choice === 'worm'
      ? 'worm' in card && !card.greatMaker && !card.thumper && !card.suppressed
      : choice === 'maker' ? 'worm' in card && !!card.greatMaker
      : 'territory' in card && !card.discovery && card.territory === choice);
    assert.ok(at >= 0, `The original ${choice} Spice Card must remain unopened`);
    front.push(game.spiceDeck.splice(at, 1)[0]);
  }
  game.spiceDeck.unshift(...front);
}

/** Genuine first setup, turn-two worm, reciprocal alliance and closing draw.
 * Movement keeps its original board source. Worm mode uses two actual paid/
 * free typed shipments before the next pre-blow window; no played state edits. */
export function createFremenBetrayalModulesFixture(options: FremenBetrayalModulesOptions = {}) {
  const program = options.program ?? 'movement';
  const source = withClassicDiscoveryNexusLottery(() => originalSetup({ ...options, program }));
  let game = structuredClone(source.game);
  const actions = [...source.actions], afterSetup = structuredClone(game);
  const act = (actor: string, action: Action) => { game = actFremenBetrayalModules(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceFremenBetrayalModules(game, until, actions); };
  const shipments: { before: Game; step: FremenBetrayalModulesStep; after: Game }[] = [];
  const ship = (actor: string, to: string, sector: number, amount: number, elite: number) => {
    const sources = game.homeworlds ? nativeShipmentSources(viewGame(game, actor), amount, elite) : undefined;
    assert.ok(!game.homeworlds || sources);
    const step: FremenBetrayalModulesStep = { actor, action: { type: 'ship', territory: to, sector,
      amount, elite, allyPayment: 0, ...(sources ? { homeworldSources: sources } : {}) } };
    const before = structuredClone(game); act(actor, step.action); reach(fremenBetrayalModulesClean);
    shipments.push({ before, step, after: structuredClone(game) });
  };
  orderSpice(game, ['broken_land', ...(game.advanced ? ['south_mesa'] : [])]);
  let cityMove: FremenBetrayalModulesStep | undefined;
  if (options.city) {
    reach(state => state.phase === 5 && state.active === 'fremen' && fremenBetrayalModulesClean(state));
    ship('fremen', 'hagga_basin', 12, 1, 0);
    cityMove = { actor: 'fremen', action: { type: 'move', from: 'hagga_basin:12', amount: 1,
      elite: 0, territory: 'carthag', sector: 11 } };
    act(cityMove.actor, cityMove.action); reach(fremenBetrayalModulesClean);
  }
  reach(state => state.turn === 2 && state.phase === 1 && fremenBetrayalModulesClean(state));
  const afterFirstTurn = structuredClone(game);
  orderSpice(game, ['worm', 'red_chasm', ...(game.advanced
    ? [options.emptyAfterMaker ? 'sihaya_ridge' : 'hagga_basin'] : [])]);
  reach(state => state.nexus && !state.spiceWindow && !state.spiceResolution && fremenBetrayalModulesClean(state));
  const beforeAlliance = structuredClone(game);
  act('fremen', { type: 'alliance', target: 'emperor' }); act('emperor', { type: 'alliance', target: 'fremen' });
  reach(state => state.nexusCards?.phase?.stage === 'drawing' && fremenBetrayalModulesClean(state));
  const cards = game.nexusCards!.cards!, at = cards.deck.indexOf('fremen'); assert.ok(at >= 0);
  cards.deck.unshift(cards.deck.splice(at, 1)[0]);
  const beforeDraw = structuredClone(game), draw: FremenBetrayalModulesStep = { actor: 'guild', action: {
    type: 'nexusCardChoice', turn: game.turn, card: cards.hands.guild, choice: 'draw', ownRedraws: 0,
  } };
  act(draw.actor, draw.action);
  const afterDraw = structuredClone(game);
  if (program === 'worm') {
    assert.ok(game.advanced, 'This bounded Great Maker programme uses both real Advanced spice piles');
    const shipped = new Set<string>();
    for (let count = 0; shipped.size < 2 && count < 500; count++) {
      if (game.phase === 5 && fremenBetrayalModulesClean(game) && game.active &&
        ['guild', 'fremen'].includes(game.active) && !shipped.has(game.active)) {
        const actor = game.active;
        if (actor === 'guild') ship(actor, 'red_chasm', 7, 1, 0);
        else ship(actor, 'hagga_basin', 12, 2, 1);
        shipped.add(actor);
      } else {
        const step = nextE3IndependentDukeStep(game); assert.ok(step);
        act(step.actor, step.action);
      }
    }
    assert.equal(shipped.size, 2);
    reach(state => state.turn === 3 && state.phase === 1 && fremenBetrayalModulesClean(state));
    orderSpice(game, ['maker', 'habbanya_erg', 'worm', 'oh_gap']);
  } else reach(state => state.phase === 5 && state.active === 'fremen' && fremenBetrayalModulesClean(state));
  const offer = viewGame(game, 'guild').nexusFremenBetrayal;
  assert.ok(offer && !offer.blocked, offer?.blocked ?? 'The genuine card needs its original advance-declaration window');
  assert.equal(offer.mode, program === 'worm' ? 'worm' : 'movement');
  const play: Action = { type: 'nexusFremenBetrayal', event: offer.event };
  return { ...source, game, program, actions, afterSetup, afterFirstTurn, beforeAlliance, beforeDraw, draw,
    afterDraw, shipments, cityMove, offer, play, emptyAfterMaker: options.emptyAfterMaker ?? false,
    owner: 'guild', rider: 'fremen', victim: 'guild',
    staging: ['Only original undealt Spice/Nexus positions and scalar setup lotteries are selected; all setup, alliances, native source-qualified shipments and moves are actual actions.'] };
}
export type FremenBetrayalModulesFixture = ReturnType<typeof createFremenBetrayalModulesFixture>;

/** An empty printed destination at the requested actual board distance. */
export function fremenBetrayalModulesMove(game: Game, source: string, range: number): Action {
  const candidate = TERRITORIES.filter(row => row.type === 'sand' || row.type === 'rock')
    .flatMap(row => row.sectors.map(sector => location(row.id, sector)))
    .find(to => game.players.every(player => !Object.entries(player.forces).some(([key, count]) =>
      count > 0 && splitLocation(key).territory === splitLocation(to).territory)) &&
      distance(source, to, key => splitLocation(key).sector === game.storm) === range);
  assert.ok(candidate, `An empty printed range-${range} destination must exist from the original source`);
  const to = splitLocation(candidate), own = fremenBetrayalModulesPlayer(game, 'fremen');
  return { type: 'move', from: source, amount: 1, elite: (own.elites?.forces[source] ?? 0) > 0 ? 1 : 0,
    territory: to.territory, sector: to.sector };
}

/** Complete the actual restricted move and the remainder of its native turn. */
export function finishFremenBetrayalMovement(fixture: FremenBetrayalModulesFixture, range = 1) {
  const actions: FremenBetrayalModulesStep[] = [];
  let game = actFremenBetrayalModules(structuredClone(fixture.game), fixture.owner, fixture.play, actions);
  const spent = structuredClone(game), move = fremenBetrayalModulesMove(game, fixture.source, range);
  game = actFremenBetrayalModules(game, fixture.rider, move, actions);
  game = advanceFremenBetrayalModules(game, fremenBetrayalModulesClean, actions);
  const moved = structuredClone(game);
  game = advanceFremenBetrayalModules(game, state => state.turn > fixture.game.turn &&
    state.phase === 1 && fremenBetrayalModulesClean(state), actions);
  return { game, spent, moved, move, actions };
}

/** Real Great Maker votes, native reserve ride in the unspent control, both
 * replacement blows and the ordinary typed native survivor. No board ride is
 * added to the Great Maker and no legal action is synthesized from a save. */
export function finishFremenBetrayalWorm(fixture: FremenBetrayalModulesFixture, spend = true) {
  assert.equal(fixture.program, 'worm');
  const actions: FremenBetrayalModulesStep[] = [], votes: FremenBetrayalModulesStep[] = [],
    rides: { before: Game; action: Action; after: Game }[] = [], ordinaryRides: FremenBetrayalModulesStep[] = [],
    cunningOffers: Game[] = [];
  let game = structuredClone(fixture.game);
  if (spend) game = actFremenBetrayalModules(game, fixture.owner, fixture.play, actions);
  const spent = structuredClone(game);
  for (let count = 0; count < 650; count++) {
    if (game.phase === 2 && fremenBetrayalModulesClean(game))
      return { game, spent, actions, votes, rides, ordinaryRides, cunningOffers };
    const before = structuredClone(game), decision = game.decision;
    let step: FremenBetrayalModulesStep | null;
    if (fixture.emptyAfterMaker && game.nexus && !game.spiceWindow && !game.spiceResolution &&
      fremenBetrayalModulesClean(game) && fremenBetrayalModulesPlayer(game, fixture.rider).ally) {
      step = { actor: fixture.rider, action: { type: 'alliance', target: null } };
    } else if (!game.response && !game.phaseOpening && decision?.kind === 'nexusFremenCunningOffer') {
      cunningOffers.push(structuredClone(game));
      step = { actor: decision.player, action: { type: 'decision', event: decision.event, accept: false } };
    } else if (!game.response && !game.phaseOpening && decision?.kind === 'nexusFremenRideBetrayal') {
      // This unspent control deliberately permits its original native ride;
      // do not let a generic bot policy spend the held prevention card.
      step = { actor: decision.player, action: { type: 'decision', event: decision.event, use: false } };
    } else if (!game.response && !game.phaseOpening && decision?.kind === 'greatMakerVote') {
      step = { actor: decision.player, action: { type: 'decision', event: decision.event, yes: true } };
      votes.push(structuredClone(step));
    } else if (!game.response && !game.phaseOpening && decision?.kind === 'greatMakerRide') {
      const action = greatMakerRideAction(viewGame(game, fixture.rider), 'polar_sink', 0, 1, game.advanced ? 1 : 0);
      assert.ok(action, 'The unspent control uses the original typed reserve-ride control');
      step = { actor: fixture.rider, action };
    } else step = nextE3IndependentDukeStep(game);
    assert.ok(step, 'The native Great Maker continuation must keep its own legal next choice');
    if (decision?.kind === 'wormRide') ordinaryRides.push(structuredClone(step));
    game = actFremenBetrayalModules(game, step.actor, step.action, actions);
    if (decision?.kind === 'greatMakerRide') rides.push({ before, action: step.action, after: structuredClone(game) });
  }
  throw Error('The original Great Maker/worm sequence did not reach Bidding preparation');
}

/** Four finite legal declarations, without difficulty-strength calibration. */
export function smokeFremenBetrayalModules(options: FremenBetrayalModulesOptions = {}) {
  const fixture = createFremenBetrayalModulesFixture(options);
  return (['Easy', 'Medium', 'Hard', 'Brutal'] as const).map(difficulty => {
    const view = viewGame(fixture.game, fixture.owner);
    view.players.find(player => player.id === fixture.owner)!.bot = difficulty;
    const action = botActions(view).find(action => action.type === 'nexusFremenBetrayal'); assert.ok(action, difficulty);
    const game = actFremenBetrayalModules(structuredClone(fixture.game), fixture.owner, action);
    const native = fremenBetrayalModulesPlayer(game, fixture.rider);
    return { difficulty, phase: game.phase, mode: fixture.offer.mode,
      restricted: fixture.offer.mode === 'worm' ? native.fremenNexusWormBlockedTurn === game.turn
        : native.fremenNexusMovementBlockedTurn === game.turn,
      spent: game.nexusCards!.cards!.discard.filter(card => card === 'fremen').length };
  });
}
