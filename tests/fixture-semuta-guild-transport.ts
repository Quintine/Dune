import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeSemutaGameForAudit, joinGame, newPlayer,
  viewGame, type Action, type Game,
} from '../game/engine';
import { TERRITORIES } from '../game/board';
import { presenceAt } from '../game/force-presence';
import { homeworldShipmentChoice } from '../game/homeworld-shipment-options';
import { guildHomeworldShipmentChoice } from '../game/guild-homeworld-shipment-options';
import { nextSemutaGuildIncomeNativeStep } from './fixture-semuta-guild-income';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';

export type SemutaGuildRoute = 'reserve' | 'cross' | 'return' | 'world' | 'homeworldReturn' | 'homeworldForeign';
export type SemutaGuildStep = { actor: string; action: Action };
const player = (game: Game, actor: string) => game.players.find(p => p.id === actor)!;
const clean = (game: Game) => !game.response && !game.decision && !game.phaseOpening && !game.pendingTreacheryDiscard;

/** No played hand/army/wallet/phase is staged: real cache purchase gives Guild
 * Semuta, a real normal auction gives Emperor Karama, and native play reaches
 * the original Guild turn. Only original undealt lotteries/deck order are selected. */
export function createSemutaGuildTransport(options: {
  route?: SemutaGuildRoute;
  cancel?: 'rate' | 'permission';
  poor?: boolean;
  advanced?: boolean;
} = {}) {
  const route = options.route ?? 'reserve', kind = options.cancel ?? 'rate';
  const homeworlds = route === 'world' || route === 'homeworldReturn' || route === 'homeworldForeign';
  let game = createGame('SEMUTAGUILDNATIVE', newPlayer('r', 'Richese', 'richese'),
    options.advanced ?? true, ['choam']);
  for (const [id, name, faction] of [['g', 'Guild', 'guild'], ['a', 'Atreides', 'atreides'], ['e', 'Emperor', 'emperor']] as const)
    joinGame(game, newPlayer(id, name, faction));
  if (homeworlds) game = applyAction(game, 'r', { type: 'homeworlds', enabled: true });
  for (const seat of game.players) game = applyAction(game, seat.id, { type: 'ready' });
  game = withClassicDiscoveryNexusLottery(() => initializeSemutaGameForAudit(game));
  const actions: SemutaGuildStep[] = [];
  const act = (actor: string, action: Action) => {
    actions.push({ actor, action }); game = applyAction(game, actor, action);
  };
  const reach = (until: (state: Game) => boolean) => {
    for (let n = 0; !until(game) && n < 1600; n++) {
      assert.notEqual(game.status, 'finished');
      const next = nextSemutaGuildIncomeNativeStep(game); act(next.actor, next.action);
    }
    assert.ok(until(game), `Original Semuta programme stalled at ${game.turn}/${game.phase}/${game.decision?.kind}`);
  };
  reach(state => state.status === 'playing');
  const setup = structuredClone(game);
  const index = game.deck.findIndex(card => card.effect === 'karama'); assert.ok(index >= 0);
  const karama = game.deck.splice(index, 1)[0]; game.deck.unshift(karama);
  for (const position of [0, 1]) {
    const at = game.spiceDeck.findIndex((card, i) => i >= position && 'territory' in card);
    assert.ok(at >= position); game.spiceDeck.splice(position, 0, game.spiceDeck.splice(at, 1)[0]);
  }
  reach(state => state.decision?.kind === 'richeseCache');
  act('r', { type: 'decision', event: game.richeseBidding!.event,
    card: 'richese-semuta-drug', method: 'onceAround', direction: 'counterclockwise' });
  reach(state => !!state.richeseAuction && !state.richeseAuction.outcome &&
    state.richeseAuction.active === 'g' && clean(state));
  act('g', { type: 'richeseBid', event: game.richeseAuction!.event, amount: 1 });
  reach(state => player(state, 'g').hand.some(card => card.id === 'richese-semuta-drug') && clean(state));
  const boughtSemuta = structuredClone(game);
  reach(state => !!state.auction && state.auction.index === 0 && state.auction.active === 'e' && clean(state));
  act('e', { type: 'bid', amount: 1 });
  reach(state => player(state, 'e').hand.some(card => card.id === karama.id) && clean(state));
  const boughtKarama = structuredClone(game);
  reach(state => state.phase === 5 && state.active === 'g' && clean(state));
  if (options.poor) {
    const excess = player(game, 'g').spice - 2; assert.ok(excess >= 0);
    if (excess) act('g', { type: 'bribe', target: 'e', amount: excess });
  }
  const beforeAction = structuredClone(game);
  const destination = TERRITORIES.find(t => t.type === 'sand' &&
    t.sectors.some(s => s !== game.storm) && game.players.every(p => presenceAt(p, t.id) === 0));
  assert.ok(destination); const sector = destination.sectors.find(s => s !== game.storm)!;
  const source = Object.entries(player(game, 'g').forces).find(([key, amount]) =>
    amount >= 2 && Number(key.split(':')[1]) !== game.storm)?.[0];
  assert.ok(source);
  let target = `${destination.id}:${sector}`, action: Action;
  if (route === 'reserve') action = { type: 'ship', territory: destination.id, sector, amount: 2, elite: 0, allyPayment: 0 };
  else if (route === 'cross' || route === 'return') {
    if (route === 'return') target = 'reserves';
    action = { type: 'guildShip', from: source, territory: route === 'return' ? 'reserves' : destination.id,
      sector: route === 'return' ? 0 : sector, amount: 2, elite: 0, allyPayment: 0 };
  } else {
    target = route === 'homeworldReturn' ? 'homeworld:guild' : 'homeworld:atreides';
    const sources = { [route === 'world' ? 'homeworld:guild' : source]: { normal: 2, elite: 0 } };
    const quote = route === 'world' ? homeworldShipmentChoice(viewGame(game, 'g'), target, sources)
      : guildHomeworldShipmentChoice(viewGame(game, 'g'), target, sources);
    assert.ok(quote.action, quote.blocked ?? undefined); action = quote.action;
  }
  act('g', action);
  if (game.decision?.kind === 'guildShipment') act('g', { type: 'decision', allow: true });
  else if (game.decision?.kind === 'homeworldShipmentGuild')
    act('g', { type: 'decision', event: game.decision.event, allow: true });
  if (kind === 'rate') {
    for (let n = 0; game.response?.kind === 'guildTransportPermission' && n < 20; n++) {
      const next = nextSemutaGuildIncomeNativeStep(game); act(next.actor, next.action);
    }
  }
  assert.equal(game.response?.kind, kind === 'rate' ? 'guildRate' : 'guildTransportPermission');
  assert.ok(viewGame(game, 'e').responseControls?.cancelCards.includes(karama.id));
  return { setup, boughtSemuta, boughtKarama, beforeAction, beforeCost: structuredClone(game),
    game, route, kind, source, target, destination: destination.id, sector, action, actions,
    guild: 'g', holder: 'g', spender: 'e', karama: karama.id, semuta: 'richese-semuta-drug',
    cancel: { type: 'card', mode: 'cancel', card: karama.id } as Action,
    provenance: [
      'Original Semuta setup; selected original undealt lottery and conserved unplayed Spice/Treachery deck order.',
      'Guild buys actual public Semuta cache lot for1; Emperor buys actual normal Karama auction for1.',
      'Original native Guild turn, original source forces and actual permission/interception; optional real outgoing bribe only.',
    ] };
}

export function reactSemutaGuildTransport(game: Game, claim: boolean) {
  const pending = game.pendingTreacheryDiscard; assert.ok(pending);
  const reaction = pending.reaction;
  assert.ok(reaction?.stage === 'offer');
  const event = pending.batch.event;
  if (claim) return applyAction(game, 'g', { type: 'semutaCommit', event });
  for (const seat of game.players.filter(p => !reaction.passed.includes(p.id)))
    game = applyAction(game, seat.id, { type: 'semutaPass', event });
  return game;
}
