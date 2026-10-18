import assert from 'node:assert/strict';
import { applyAction, createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { location, splitLocation, TERRITORIES } from '../game/board';
import { botEntryAllowed, groundMoveRouteDistance } from '../game/bot-mobility';
import { nexusGuildCunningAction } from '../game/nexus-guild-cunning-options';
import type { OrnithopterMode } from '../game/ornithopter';
import { richeseCards } from '../game/richese-cards';
import { nextRicheseStrongholdsNativeStep } from './fixture-richese-strongholds';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';

const card = richeseCards().find(card => card.effect === 'ornithopter'); assert.ok(card);
export const GUILD_CUNNING_ORNITHOPTER = card.id;
export type GuildCunningOrnithopterStep = { actor: string; action: Action };
export const guildCunningOrnithopterPlayer = (game: Game, actor = 'guild') => {
  const player = game.players.find(player => player.id === actor); assert.ok(player); return player;
};
export const guildCunningOrnithopterClean = (game: Game) => !game.response && !game.phaseOpening &&
  !game.decision && !game.truthtrance && !game.pendingTreacheryDiscard && !game.pendingGuildBetrayal;
export function actGuildCunningOrnithopter(game: Game, actor: string, action: Action,
  actions: GuildCunningOrnithopterStep[] = []): Game {
  const next = withClassicDiscoveryNexusLottery(() => applyAction(game, actor, action));
  actions.push({ actor, action: structuredClone(action) }); return next;
}
/** Consume original neutral native controls without choosing an optional
 * power, physical hand substitution or private Battle Plan. */
export function nextGuildCunningOrnithopterStep(game: Game): GuildCunningOrnithopterStep | null {
  if (game.pendingGuildBetrayal) {
    const actor = game.pendingGuildBetrayal.required.find(actor => !game.pendingGuildBetrayal!.passed.includes(actor));
    assert.ok(actor); return { actor, action: { type: 'guildBetrayalPass', event: game.pendingGuildBetrayal.invoice.event } };
  }
  if (!game.response && !game.phaseOpening) {
    const decision = game.decision;
    if (decision?.kind === 'nexusIxianReplacement') return { actor: decision.player,
      action: { type: 'nexusIxianReplacementPass', event: decision.event } };
    if (decision?.kind === 'guildTiming') return { actor: decision.player, action: { type: 'decision', take: false } };
    if (decision?.kind === 'richeseAllyOpportunity') return { actor: decision.player, action: { type: 'decision', decline: true } };
    if (decision?.kind === 'richeseCache' && game.richeseCache?.some(card => card.id === GUILD_CUNNING_ORNITHOPTER))
      return { actor: decision.player, action: { type: 'decision', event: game.richeseBidding!.event,
        card: GUILD_CUNNING_ORNITHOPTER, method: 'onceAround', direction: 'clockwise' } };
    if (decision?.kind === 'richeseUnbid') return { actor: decision.player,
      action: { type: 'decision', event: game.richeseBidding!.event, keep: false } };
    if (!decision && game.nexusCards?.phase?.stage === 'drawing') {
      const phase = game.nexusCards.phase, actor = phase.eligible.find(actor => !phase.done.includes(actor));
      assert.ok(actor); return { actor, action: { type: 'nexusCardChoice', turn: game.turn,
        card: game.nexusCards.cards!.hands[actor] ?? null, choice: 'keep', ownRedraws: 0 } };
    }
  }
  if (guildCunningOrnithopterClean(game) && game.richeseAuction?.cardId === GUILD_CUNNING_ORNITHOPTER &&
    !game.richeseAuction.outcome && game.richeseAuction.active === 'guild' && game.richeseAuction.bid === 0)
    return { actor: 'guild', action: { type: 'richeseBid', event: game.richeseAuction.event, amount: 1, allyPayment: 0 } };
  if (guildCunningOrnithopterClean(game) && game.auction?.active === 'guild' && game.auction.bid === 0 &&
    game.auction.cards[game.auction.index].effect === 'hajr')
    return { actor: 'guild', action: { type: 'bid', amount: 1, allyPayment: 0 } };
  return nextRicheseStrongholdsNativeStep(game);
}
export function advanceGuildCunningOrnithopter(game: Game, until: (state: Game) => boolean,
  actions: GuildCunningOrnithopterStep[] = []): Game {
  for (let count = 0; count < 2400; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original Cunning/Ornithopter programme ended before its owned control');
    const step = nextGuildCunningOrnithopterStep(game); assert.ok(step, 'Complete the actual private choice before advancing');
    game = actGuildCunningOrnithopter(game, step.actor, step.action, actions);
  }
  throw Error('The original Cunning/Ornithopter programme did not reach its finite boundary');
}
function orderBlow(game: Game, worm = false) {
  const front: Game['spiceDeck'] = [];
  if (worm) {
    const at = game.spiceDeck.findIndex(card => 'worm' in card && !card.greatMaker && !card.suppressed && !card.thumper);
    assert.ok(at >= 0); front.push(game.spiceDeck.splice(at, 1)[0]);
  }
  for (let count = 0; count < (game.advanced ? 2 : 1); count++) {
    const at = game.spiceDeck.findIndex(card => 'territory' in card && !card.discovery); assert.ok(at >= 0);
    front.push(game.spiceDeck.splice(at, 1)[0]);
  }
  game.spiceDeck.unshift(...front);
}

/** Public original host/setup. Native Guild buys the physical cache card and
 * normal Hajr, then receives its actual Guild Nexus through an original closing
 * draw after Richese/Emperor form a reciprocal alliance at the real worm. Only
 * still-unopened deck order/scalar lotteries are selected; no held Nexus,
 * Treachery, force, money, clock or completed grant is installed. */
export function createGuildCunningOrnithopterFixture(options: { advanced?: boolean } = {}) {
  const advanced = options.advanced ?? false;
  let game = createGame('GUILDCUNNINGORNITHOPTER', newPlayer('richese', 'Richese', 'richese'), advanced, ['choam']);
  for (const faction of ['emperor', 'guild'] as const) joinGame(game, newPlayer(faction, faction, faction));
  const actions: GuildCunningOrnithopterStep[] = [];
  const act = (actor: string, action: Action) => { game = actGuildCunningOrnithopter(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceGuildCunningOrnithopter(game, until, actions); };
  act(game.host, { type: 'moduleOption', module: 'nexusCards', enabled: true });
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game);
  act(game.host, advanced ? { type: 'start', advancedPreview: true } : { type: 'start' });
  const setup = structuredClone(game);
  reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game);
  orderBlow(game);
  reach(state => state.phase === 2 && guildCunningOrnithopterClean(state));
  const at = game.deck.findIndex(card => card.effect === 'hajr'); assert.ok(at >= 0, 'Acquire the still-undealt original Hajr');
  const hajr = game.deck[at].id; game.deck.unshift(game.deck.splice(at, 1)[0]);
  const beforePurchases = structuredClone(game);
  reach(state => guildCunningOrnithopterPlayer(state).hand.some(card => card.id === GUILD_CUNNING_ORNITHOPTER) &&
    guildCunningOrnithopterPlayer(state).hand.some(card => card.id === hajr));
  const acquired = structuredClone(game);
  reach(state => state.turn === 2 && state.phase === 1 && guildCunningOrnithopterClean(state));
  const afterFirstTurn = structuredClone(game);
  orderBlow(game, true);
  reach(state => state.nexus && !state.spiceWindow && !state.spiceResolution && guildCunningOrnithopterClean(state));
  const beforeAlliance = structuredClone(game);
  act('richese', { type: 'alliance', target: 'emperor' });
  act('emperor', { type: 'alliance', target: 'richese' });
  reach(state => state.nexusCards?.phase?.stage === 'drawing' && guildCunningOrnithopterClean(state));
  const cards = game.nexusCards!.cards!, index = cards.deck.indexOf('guild'); assert.ok(index >= 0);
  cards.deck.unshift(cards.deck.splice(index, 1)[0]);
  const beforeNexusDraw = structuredClone(game), draw: GuildCunningOrnithopterStep = { actor: 'guild', action: {
    type: 'nexusCardChoice', turn: game.turn, card: cards.hands.guild ?? null, choice: 'draw', ownRedraws: 0,
  } };
  act(draw.actor, draw.action);
  const afterNexusDraw = structuredClone(game);
  reach(state => state.turn === 2 && state.phase === 5 && state.active === 'guild' && guildCunningOrnithopterClean(state));
  const beforeFirstShipment = structuredClone(game), firstShipment: GuildCunningOrnithopterStep = { actor: 'guild', action: {
    type: 'ship', territory: 'imperial_basin', sector: 9, amount: 2, elite: 0, allyPayment: 0,
  } };
  act(firstShipment.actor, firstShipment.action); reach(guildCunningOrnithopterClean);
  return { game, lobby, setup, afterSetup, beforePurchases, acquired, afterFirstTurn, beforeAlliance,
    beforeNexusDraw, draw, afterNexusDraw, beforeFirstShipment, firstShipment,
    afterFirstShipment: structuredClone(game), hajr, card: GUILD_CUNNING_ORNITHOPTER, owner: 'guild',
    source: 'imperial_basin:9', sourceActionCount: actions.length, actions,
    staging: ['Original host selects Nexus before setup. Only unopened Hajr, Spice and closing Guild Nexus positions plus scalar lotteries are selected. Cache1/normal1 purchases, real worm/alliance/draw and native paid reserve shipment2 supply every card, counter, coin and grant source.'] };
}
export type GuildCunningOrnithopterFixture = ReturnType<typeof createGuildCunningOrnithopterFixture>;

export function guildCunningOrnithopterMove(game: Game, from: string, options: {
  range?: number; mode?: OrnithopterMode;
} = {}): Action {
  const view = viewGame(game, 'guild'), own = view.players.find(player => player.id === view.me)!;
  assert.ok((own.forces[from] ?? 0) > 0);
  const target = TERRITORIES.filter(place => place.type === 'sand' || place.type === 'rock')
    .flatMap(place => place.sectors.map(sector => location(place.id, sector)))
    .find(key => {
      const at = splitLocation(key);
      return game.players.every(player => Object.entries(player.forces).every(([source, count]) =>
        count === 0 || splitLocation(source).territory !== at.territory)) &&
        botEntryAllowed(view, own, at.territory, at.sector, 'move', splitLocation(from).territory) &&
        groundMoveRouteDistance(view, own, from, key) === (options.range ?? 1);
    });
  assert.ok(target, 'The original Guild group needs an empty printed destination at the selected range');
  return { type: 'move', from, amount: 1, elite: 0, ...splitLocation(target),
    ...(options.mode ? { movementCard: GUILD_CUNNING_ORNITHOPTER, ornithopter: options.mode }
      : view.ornithopter?.active ? { ornithopterEvent: view.ornithopter.active.event } : {}) };
}

export function completeGuildCunningOrnithopter(fixture: GuildCunningOrnithopterFixture, options: {
  mode?: OrnithopterMode; position?: 'before' | 'after'; early?: 'beforeCunning' | 'afterCunning';
} = {}) {
  const mode = options.mode ?? 'twoGroups', position = options.early === 'beforeCunning' ? 'before' : options.position ?? 'after';
  assert.ok(!options.early || mode === 'twoGroups', 'Only a two-group flight has a group to abandon');
  assert.ok(options.early !== 'afterCunning' || position === 'after');
  let game = structuredClone(fixture.game), firstFlightGroup: Game | null = null, finishedFlight: Game | null = null;
  let firstFlightDestination = '';
  const actions: GuildCunningOrnithopterStep[] = [], moves: {
    kind: 'ordinary' | 'flight-before' | 'flight-after' | 'post-cunning-hajr';
    before: Game; step: GuildCunningOrnithopterStep; after: Game;
  }[] = [];
  const act = (actor: string, action: Action) => { game = actGuildCunningOrnithopter(game, actor, action, actions); };
  const settle = () => { game = advanceGuildCunningOrnithopter(game, guildCunningOrnithopterClean, actions); };
  const hajr = () => { act(fixture.owner, { type: 'card', card: fixture.hajr }); settle(); };
  const move = (kind: typeof moves[number]['kind'], from: string, settings: Parameters<typeof guildCunningOrnithopterMove>[2] = {}) => {
    const before = structuredClone(game), step: GuildCunningOrnithopterStep = {
      actor: fixture.owner, action: guildCunningOrnithopterMove(game, from, settings),
    };
    act(step.actor, step.action); settle();
    moves.push({ kind, before, step, after: structuredClone(game) });
    return location(String(step.action.territory), Number(step.action.sector));
  };
  if (!game.advanced) hajr();
  if (position === 'after') move('ordinary', fixture.source);
  else {
    firstFlightDestination = move('flight-before', fixture.source, { mode, range: mode === 'range3' ? 3 : 1 });
    firstFlightGroup = structuredClone(game);
  }
  if (game.advanced) hajr();
  if (position === 'before' && mode === 'twoGroups' && options.early !== 'beforeCunning')
    move('flight-before', fixture.source);
  if (position === 'before' && options.early !== 'beforeCunning') finishedFlight = structuredClone(game);
  const beforeCunning = structuredClone(game), offer = viewGame(game, fixture.owner).nexusGuildCunning?.offer;
  assert.ok(offer && !offer.blocked, offer?.blocked ?? 'The actual Guild must retain its Cunning declaration');
  const declaration = nexusGuildCunningAction(viewGame(game, fixture.owner), offer.event); assert.ok(declaration);
  act(fixture.owner, declaration);
  const declared = structuredClone(game);
  settle();
  const allowed = structuredClone(game), view = viewGame(game, fixture.owner), own = view.players.find(player => player.id === fixture.owner)!;
  const secondTarget = TERRITORIES.filter(place => place.type === 'sand' || place.type === 'rock')
    .flatMap(place => place.sectors.map(sector => ({ territory: place.id, sector })))
    .find(target => game.players.every(player => Object.entries(player.forces).every(([source, count]) =>
      count === 0 || splitLocation(source).territory !== target.territory)) &&
      botEntryAllowed(view, own, target.territory, target.sector, 'ship'));
  assert.ok(secondTarget, 'Pay for a positive native second shipment into an actually empty territory');
  const beforeSecondShipment = structuredClone(game), secondShipment: GuildCunningOrnithopterStep = { actor: fixture.owner,
    action: { type: 'ship', ...secondTarget, amount: 1, elite: 0, allyPayment: 0 } };
  act(secondShipment.actor, secondShipment.action); settle();
  const afterSecondShipment = structuredClone(game), secondSource = location(secondTarget.territory, secondTarget.sector);
  if (position === 'after') {
    firstFlightDestination = move('flight-after', secondSource, { mode, range: mode === 'range3' ? 3 : 1 });
    firstFlightGroup = structuredClone(game);
    if (mode === 'twoGroups' && options.early !== 'afterCunning') move('flight-after', fixture.source);
    if (options.early !== 'afterCunning') finishedFlight = structuredClone(game);
  } else move('post-cunning-hajr', secondSource);
  const completed = structuredClone(game);
  if (game.phase === 5 && game.active === fixture.owner) act(fixture.owner, { type: 'endMovement' });
  return { game, completed, beforeCunning, declared, allowed, declaration, beforeSecondShipment,
    secondShipment, afterSecondShipment, secondSource, firstFlightGroup: firstFlightGroup!, firstFlightDestination,
    finishedFlight, moves, actions, mode, position, early: options.early ?? null };
}
