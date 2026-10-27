import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { treacheryDeck } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import { homeworldContext, homeworldGameIntegrity } from '../game/homeworld-game';
import { homeworldForceGroups } from '../game/homeworld-custody';
import { nativeShipmentSources } from '../game/homeworld-options';
import type { EmperorHomeworld } from '../game/homeworld-emperor-move';
import type { OrnithopterMode } from '../game/ornithopter';
import { actFamilyAtomics, familyAtomicsPlayer, familyAtomicsReload } from './fixture-family-atomics';
import { nextRicheseStrongholdsNativeStep } from './fixture-richese-strongholds';
import type { StrongholdFactionsNativeStep } from './fixture-stronghold-factions';

export const EMPEROR_WORLD_ORNITHOPTER = 'richese-ornithopter';
export type OrnithopterEmperorWorldStep = StrongholdFactionsNativeStep;
export const actOrnithopterEmperorWorld = actFamilyAtomics;
export const ornithopterEmperorWorldPlayer = familyAtomicsPlayer;
export const ornithopterEmperorWorldReload = familyAtomicsReload;
export const ornithopterEmperorWorldClean = (game: Game) => !game.response && !game.phaseOpening &&
  !game.decision && !game.truthtrance && !game.pendingTreacheryDiscard && !game.pendingShipment;
export function ornithopterEmperorWorldPools(game: Game) {
  return homeworldForceGroups(homeworldContext(game), game.homeworlds!.custody!);
}
export function ornithopterEmperorWorldArmy(game: Game, world: EmperorHomeworld, owner = 'emperor') {
  const pool = ornithopterEmperorWorldPools(game).find(pool => pool.id === world); assert.ok(pool);
  return structuredClone(pool.forces[owner] ?? { normal: 0, elite: 0 });
}
export function ornithopterEmperorWorldInventory(game: Game) {
  homeworldGameIntegrity(game);
  const cards = [...game.deck, ...game.discard, ...(game.richeseCache ?? []), ...(game.richeseRemoved ?? []),
    ...(game.removedTreachery ?? []), ...game.players.flatMap(player => player.hand),
    ...(game.ornithopter ? [game.ornithopter.card] : []),
    ...(game.auction?.cards.slice(game.auction.index + Number(game.currentAuctionSale?.origin === 'normal')) ?? [])]
    .map(card => card.id).sort();
  assert.deepEqual(cards, [...treacheryDeck(game.expansions), ...richeseCards()].map(card => card.id).sort());
  for (const player of game.players)
    assert.equal(player.reserves + player.tanks + Object.values(player.forces).reduce((sum, amount) => sum + amount, 0), 20);
  return { cards, traitors: [...(game.traitorReserve ?? []), ...game.players.flatMap(player =>
    [...player.traitors, ...player.traitorChoices])].sort(),
  spice: [...game.spiceDeck, ...game.spiceDiscard.flat()].map(card => JSON.stringify(card)).sort() };
}
export function nextOrnithopterEmperorWorld(game: Game): OrnithopterEmperorWorldStep | null {
  if (!game.response && !game.phaseOpening && !game.pendingTreacheryDiscard) {
    const decision = game.decision;
    if (decision?.kind === 'richeseCache') return { actor: decision.player, action: { type: 'decision',
      event: game.richeseBidding!.event, card: EMPEROR_WORLD_ORNITHOPTER, method: 'onceAround', direction: 'clockwise' } };
    if (decision?.kind === 'richeseUnbid') return { actor: decision.player, action: {
      type: 'decision', event: game.richeseBidding!.event, keep: false } };
    if (decision?.kind === 'guildTiming') return { actor: decision.player, action: { type: 'decision', take: false } };
    if (decision?.kind === 'richeseAllyOpportunity') return { actor: decision.player, action: { type: 'decision', decline: true } };
  }
  if (ornithopterEmperorWorldClean(game) && game.richeseAuction?.cardId === EMPEROR_WORLD_ORNITHOPTER &&
      !game.richeseAuction.outcome && game.richeseAuction.active === 'emperor' && game.richeseAuction.bid === 0)
    return { actor: 'emperor', action: { type: 'richeseBid', event: game.richeseAuction.event, amount: 1, allyPayment: 0 } };
  return nextRicheseStrongholdsNativeStep(game);
}
export function advanceOrnithopterEmperorWorld(game: Game, until: (state: Game) => boolean,
  actions: OrnithopterEmperorWorldStep[] = []): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original Emperor flight source ended before its requested boundary');
    const next = nextOrnithopterEmperorWorld(game); assert.ok(next, 'Complete the actual native pending control');
    game = actOrnithopterEmperorWorld(game, next.actor, next.action, actions);
  }
  throw Error('The original Emperor/Ornithopter chronology did not reach its finite boundary');
}
export function settleOrnithopterEmperorWorld(game: Game, actions: OrnithopterEmperorWorldStep[] = []): Game {
  return advanceOrnithopterEmperorWorld(game, ornithopterEmperorWorldClean, actions);
}
export function ornithopterEmperorWorldMove(game: Game, origin: EmperorHomeworld,
  normal: number, elite: number, mode?: OrnithopterMode): Action {
  const offer = viewGame(game, 'emperor').homeworldMove; assert.ok(offer);
  return { type: 'emperorHomeworldMove', event: offer.event, origin, normal, elite,
    ...(mode ? { movementCard: EMPEROR_WORLD_ORNITHOPTER, ornithopter: mode }
      : game.ornithopter ? { ornithopterEvent: game.ornithopter.event } : {}) };
}
export function ornithopterEmperorGroundMove(game: Game, mode?: OrnithopterMode): Action {
  return { type: 'move', from: 'imperial_basin:9', territory: 'shield_wall', sector: 9, amount: 1, elite: 0,
    ...(mode ? { movementCard: EMPEROR_WORLD_ORNITHOPTER, ornithopter: mode }
      : game.ornithopter ? { ornithopterEvent: game.ornithopter.event } : {}) };
}

/** Genuine public Homeworld opt-in, printed native World allocation, actual
 * cache1 purchase, and optional typed ordinary shipment. Advanced Homeworld
 * source retains its real no-Semuta profile; no marker is removed to admit it.
 */
export function createOrnithopterEmperorWorldFixture(options: { groundArmy?: boolean; hajr?: boolean } = {}) {
  const groundArmy = options.groundArmy ?? true, owner = 'emperor', richese = 'richese', observer = 'atreides';
  let game = createGame('ORNITHOPTEREMPERORWORLD', newPlayer(richese, 'Richese', 'richese'), true, ['choam']);
  joinGame(game, newPlayer(owner, 'Emperor', 'emperor')); joinGame(game, newPlayer(observer, 'Atreides', 'atreides'));
  const initial = structuredClone(game), actions: OrnithopterEmperorWorldStep[] = [];
  const act = (actor: string, action: Action) => { game = actOrnithopterEmperorWorld(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceOrnithopterEmperorWorld(game, until, actions); };
  act(game.host, { type: 'homeworlds', enabled: true });
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game); act(game.host, { type: 'start', advancedPreview: true });
  const setup = structuredClone(game); assert.equal(game.status, 'setup'); assert.ok(game.players.every(player => !player.hand.length));
  const first = game.deck.find(card => card.kind === 'projectile'), last = game.deck.find(card => card.kind === 'shield');
  const middle = game.deck.find(card => options.hajr ? card.effect === 'hajr' : card.kind === 'snooper'); assert.ok(first && middle && last);
  const deal = [first, middle, last];
  const dealOrder = deal.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card.id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: card.id };
  });
  reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game), setupActions = structuredClone(actions);
  assert.ok(game.homeworlds?.custody); assert.equal(Boolean(game.semutaPreview), false);
  assert.deepEqual(ornithopterEmperorWorldArmy(game, 'homeworld:emperor'), { normal: 15, elite: 0 });
  assert.deepEqual(ornithopterEmperorWorldArmy(game, 'homeworld:emperor:salusa'), { normal: 0, elite: 5 });
  const original = ornithopterEmperorWorldInventory(game), spiceOrder = [0, 1].map(position => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery && card.territory !== 'imperial_basin');
    assert.ok(from >= position); const [card] = game.spiceDeck.splice(from, 1); game.spiceDeck.splice(position, 0, card);
    return { position, from, card: structuredClone(card) };
  });
  let beforeBid: Game | undefined, bid: OrnithopterEmperorWorldStep | undefined, bidAt = -1;
  for (let count = 0; !ornithopterEmperorWorldPlayer(game, owner).hand.some(card => card.id === EMPEROR_WORLD_ORNITHOPTER) && count < 900; count++) {
    const next = nextOrnithopterEmperorWorld(game); assert.ok(next);
    if (next.actor === owner && next.action.type === 'richeseBid' && next.action.amount === 1) {
      beforeBid = structuredClone(game); bid = structuredClone(next); bidAt = actions.length;
    }
    act(next.actor, next.action);
  }
  assert.ok(beforeBid && bid && bidAt >= 0);
  const acquisition = { before: beforeBid, bid, steps: structuredClone(actions.slice(bidAt)), after: structuredClone(game) };
  assert.equal(ornithopterEmperorWorldPlayer(beforeBid, owner).spice - ornithopterEmperorWorldPlayer(game, owner).spice, 1);
  reach(state => state.phase === 5 && state.active === owner && ornithopterEmperorWorldClean(state));
  const beforeShipment = structuredClone(game), beforeShipmentActions = structuredClone(actions);
  let shipment: { before: Game; steps: OrnithopterEmperorWorldStep[]; after: Game } | null = null;
  if (groundArmy) {
    const sources = nativeShipmentSources(viewGame(game, owner), 1, 0); assert.ok(sources);
    const before = structuredClone(game), from = actions.length;
    act(owner, { type: 'ship', territory: 'imperial_basin', sector: 9, amount: 1, elite: 0, allyPayment: 0, homeworldSources: sources });
    reach(ornithopterEmperorWorldClean);
    shipment = { before, steps: structuredClone(actions.slice(from)), after: structuredClone(game) };
    assert.equal(ornithopterEmperorWorldPlayer(before, owner).spice - ornithopterEmperorWorldPlayer(game, owner).spice, 2);
    assert.equal(ornithopterEmperorWorldPlayer(game, owner).forces['imperial_basin:9'], 1);
  }
  const hajr = options.hajr ? middle.id : null;
  assert.equal(Boolean(game.semutaPreview), false); assert.equal(ornithopterEmperorWorldPlayer(game, owner).moved, 0);
  assert.ok(ornithopterEmperorWorldPlayer(game, owner).hand.some(card => card.id === EMPEROR_WORLD_ORNITHOPTER));
  assert.deepEqual(ornithopterEmperorWorldInventory(game), original);
  return { game, sourceGame: structuredClone(game), initial, lobby, setup, afterSetup, owner, richese, observer,
    card: EMPEROR_WORLD_ORNITHOPTER, hajr, groundArmy, source: 'imperial_basin:9', groundDestination: 'shield_wall:9',
    beforeShipment, beforeShipmentActions, acquisition, shipment, original, dealOrder, spiceOrder, setupActions, actions,
    sourceActions: actions, sourceActionCount: actions.length,
    sourceCounts: { setup: setupActions.length, acquisition: acquisition.steps.length, beforeShipment: beforeShipmentActions.length,
      shipment: shipment?.steps.length ?? 0, source: actions.length },
    sourceDisclosure: 'Actual public Advanced preview Richese/Emperor/Atreides +CHOAM deck and actual Homeworld opt-in before readiness/start. No audit initializer, Semuta, Skills, Discovery or Nexus module. ' +
      'Only original unopened starting-card/land-Spice positions and scalar lotteries selected. Emperor really bids1 in the original Richese cache auction to acquire physical Ornithopter; printed World stocks start normal15Kaitain/star5Salusa. ' +
      (groundArmy ? 'Actual typed normal1 shipment from Kaitain to ImperialBasin9 costs2; original remaining14normal/5stars supply World moves. '
        : 'Stop at the actual unused Emperor shipment/movement window, before any force shipment. ') +
      (hajr ? 'Emperor also received the original unopened Hajr in its native starting-deal slot. ' : '') +
      'Counts derive from recorded arrays. No played hand, purse, army, phase, World custody, allowance, flight or receipt is installed.' };
}
export type OrnithopterEmperorWorldFixture = ReturnType<typeof createOrnithopterEmperorWorldFixture>;
