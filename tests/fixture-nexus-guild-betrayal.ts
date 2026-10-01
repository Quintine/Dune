import assert from 'node:assert/strict';
import {applyAction, createGame, initializeGuildBetrayalGameForAudit, joinGame, newPlayer, viewGame,
  type Action, type Game} from '../game/engine';
import {botActions} from '../game/bots';
import type {FactionId} from '../game/catalog';
import {TERRITORIES, splitLocation} from '../game/board';
import {botEntryAllowed, fremenReserveEntry} from '../game/bot-mobility';
import {guildTransportQuote} from '../game/transport-quote';
import {junctionTransportChoice} from '../game/junction-transport-options';
import {homeworldShipmentChoice} from '../game/homeworld-shipment-options';
import {drawNexusCard, validateNexusCards} from '../game/nexus-cards';
import {homeworldGameIntegrity} from '../game/homeworld-game';
import {orderNexusSpice} from './fixture-nexus-cards';

export type GuildBetrayalFixtureOptions = {
  /** Newly admitted saved setup; preserve its identities and physical setup. */
  initial?: Game;
  advanced?: boolean;
  homeworlds?: boolean;
  source?: 'reserve' | 'guildTransport' | 'homeworld' | 'junction';
  payer?: 'holder' | 'guild' | 'other';
  allyPayment?: number;
  seatIds?: string[];
  nexusFace?: 'guild' | 'choam';
  zero?: boolean;
  occupiedJunction?: boolean;
};
export type GuildBetrayalFixture = {
  game: Game;
  before: Game;
  original: Game;
  declaration: Action;
  holder: string;
  guild: string;
  shipper: string;
  donor: string | null;
  event: string;
  price: number;
  source: 'reserve' | 'guildTransport' | 'homeworld' | 'junction';
};

/** Complete only already declared native permission, acknowledgement and income
 * windows. Never creates or replays a shipment action. */
export function settleGuildBetrayalFixture(state: Game): Game {
  let game = state;
  for (let step = 0; step < 100; step++) {
    const frame = game.pendingGuildBetrayal;
    if (frame) {
      const id = frame.required.find(seat => !frame.passed.includes(seat))!;
      game = applyAction(game, id, {type: 'guildBetrayalPass', event: frame.invoice.event});
    } else if (game.decision?.kind === 'guildShipment') {
      game = applyAction(game, game.decision.player, {type: 'decision', allow: true});
    } else if (game.decision?.kind === 'homeworldShipmentGuild') {
      game = applyAction(game, game.decision.player,
        {type: 'decision', allow: true, event: game.decision.event});
    } else if (game.response) {
      const id = game.players.find(p => !game.response!.passed.includes(p.id))!.id;
      game = applyAction(game, id, {type: 'passResponse'});
    } else return game;
  }
  throw new Error('Native Guild fixture settlement did not complete.');
}

function stepGuildFixture(game: Game): Game {
  for (const p of game.players) {
    const view = viewGame(game, p.id);
    view.players.find(seat => seat.id === p.id)!.bot = 'Easy';
    const action = botActions(view)[0];
    if (action) return applyAction(game, p.id, action);
  }
  throw new Error(`Native fixture has no legal action at ${game.status}/${game.turn}/${game.phase}/${game.decision?.kind}`);
}
function enterGuildFixtureMovement(state: Game, minimumTurn = 1): Game {
  let game = state;
  let orderedTurn = 0;
  for (let step = 0; step < 700; step++) {
    if (game.status === 'playing' && game.turn >= minimumTurn && game.phase === 5 &&
        !game.phaseOpening && !game.response && !game.decision) return game;
    if (game.status === 'playing' && game.phase === 1 && orderedTurn !== game.turn) {
      orderNexusSpice(game, ['land', 'land']);
      orderedTurn = game.turn;
    }
    game = stepGuildFixture(game);
  }
  throw new Error('Genuine Guild fixture did not reach Shipment and Movement.');
}
function holdGuildFixtureFace(game: Game, holder: string, face: 'guild' | 'choam'): void {
  // Arrange only the conserved physical Nexus inventory, before any invoice.
  // Public held-card presence is identical across hidden-face fixture variants.
  let cards = game.nexusCards!.cards!;
  for (const p of game.players) {
    const held = cards.hands[p.id];
    if (held !== null) {cards.deck.push(held); cards.hands[p.id] = null;}
  }
  for (const p of game.players.filter(seat => !seat.ally)) {
    const desired = p.id === holder ? face : p.faction === 'guild' ? 'atreides' : 'fremen';
    let index = cards.deck.indexOf(desired);
    if (index < 0) {
      index = cards.discard.indexOf(desired);
      assert.ok(index >= 0, 'The actual singleton face is available.');
      cards.deck.unshift(cards.discard.splice(index, 1)[0]);
    } else cards.deck.unshift(cards.deck.splice(index, 1)[0]);
    cards = drawNexusCard(cards, p.id, game.players, () => 0);
  }
  game.nexusCards!.cards = cards;
  validateNexusCards(cards, game.players);
}

function clearGuildFixtureHands(game: Game): void {
  for (const p of game.players) game.deck.push(...p.hand.splice(0));
}

function reserveDeclaration(game: Game, shipper: string, amount: number, allyPayment = 0): Action {
  const view = viewGame(game, shipper);
  const payer = view.players.find(p => p.id === shipper)!;
  const candidates = TERRITORIES.filter(t => payer.faction === 'fremen' ?
    fremenReserveEntry(t.id) : t.type === 'stronghold');
  // Prefer a peaceful destination if this shipment prepares a later turn.
  candidates.sort((a, b) => Number(game.players.some(p => p.id !== shipper &&
    Object.keys(p.forces).some(key => splitLocation(key).territory === a.id && p.forces[key] > 0))) -
    Number(game.players.some(p => p.id !== shipper &&
      Object.keys(p.forces).some(key => splitLocation(key).territory === b.id && p.forces[key] > 0))));
  for (const t of candidates) for (const sector of t.sectors) {
    if (sector !== game.storm && botEntryAllowed(view, payer, t.id, sector, 'ship'))
      return {type: 'ship', territory: t.id, sector, amount, allyPayment};
  }
  throw new Error('No current storm-safe native reserve destination.');
}

function fundGuildFixtureSpice(game: Game, id: string, minimum: number, excluded: string | null = null): void {
  const recipient = game.players.find(p => p.id === id)!;
  for (const giver of game.players.filter(p => p.id !== id && p.id !== excluded)) {
    const amount = Math.min(Math.max(0, minimum - recipient.spice), giver.spice);
    giver.spice -= amount;
    recipient.spice += amount;
  }
  assert.ok(recipient.spice >= minimum, 'Upfront spice is transferred, not minted.');
}

function transportDeclaration(game: Game, shipper: string, amount: number, allyPayment: number): Action | null {
  const payer = game.players.find(p => p.id === shipper)!;
  const view = viewGame(game, shipper);
  for (const [key, count] of Object.entries(payer.forces)) {
    if (count < amount || splitLocation(key).sector === game.storm) continue;
    const forces = {[key]: amount};
    if (!game.homeworlds && payer.faction === 'guild') {
      const action: Action = {type: 'guildShip', forces, territory: 'reserves', allyPayment};
      if (!guildTransportQuote(view, action).unavailableReasons.length) return action;
    } else for (const t of TERRITORIES.filter(t => t.type !== 'stronghold')) {
      for (const sector of t.sectors) {
        const action: Action = {type: 'guildShip', forces, territory: t.id, sector, allyPayment};
        if (!guildTransportQuote(view, action).unavailableReasons.length) return action;
      }
    }
  }
  return null;
}

function prepareGuildFixtureTransport(state: Game, shipper: string, amount: number): Game {
  let game = state;
  for (let opportunity = 0; opportunity < 10; opportunity++) {
    while (game.active !== shipper) game = applyAction(game, game.active!, {type: 'endMovement'});
    // Native bidding on a later real turn may spend the earlier preparation
    // budget. Re-establish conserved upfront funds before quoting transport.
    fundGuildFixtureSpice(game, shipper, amount);
    if (transportDeclaration(game, shipper, amount, 0)) return game;
    // The actual storm may cover every initial group. Establish a real source
    // with an ordinary paid shipment, then advance the actual turn and storm.
    const turn = game.turn;
    game = settleGuildBetrayalFixture(applyAction(game, shipper,
      reserveDeclaration(game, shipper, amount)));
    while (game.phase === 5) game = applyAction(game, game.active!, {type: 'endMovement'});
    game = enterGuildFixtureMovement(game, turn + 1);
    clearGuildFixtureHands(game);
  }
  throw new Error('Native turn progression did not produce a legal Guild transport source.');
}

/** Final identities precede actual setup. All source frames below are declared
 * through native actions; no fee, card, force, signed frame or escrow is minted. */
export function createGuildBetrayalFixture(options: GuildBetrayalFixtureOptions = {}): GuildBetrayalFixture {
  const source = options.source ?? 'reserve';
  const ids = options.seatIds ?? options.initial?.players.map(p => p.id) ?? ['holder', 'guild', 'other', 'donor'];
  const guild = options.initial?.players.find(p => p.faction === 'guild')?.id ?? ids[1];
  const holder = options.initial?.players.find(p => p.id !== guild && (!options.zero || p.faction !== 'fremen'))?.id ??
    options.initial?.players.find(p => p.id !== guild)?.id ?? ids[0];
  const other = options.initial ? options.initial.players.find(p => options.zero ? p.faction === 'fremen' :
    p.id !== guild && p.id !== holder)?.id ?? holder : ids[2];
  assert.ok(holder && guild && other);
  const donor = (options.allyPayment ?? 0) > 0 ? options.initial?.players.find(p =>
    p.id !== holder && p.id !== guild && p.id !== other)?.id ?? ids[3] ?? 'donor' : null;
  const roster: [string, FactionId][] = options.initial ? options.initial.players.map(p => [p.id, p.faction]) :
    [[holder, 'atreides'], [guild, 'guild'], [other, options.zero ? 'fremen' : 'emperor'],
      ...(donor ? [[donor, 'harkonnen'] as [string, FactionId]] : [])];
  let game: Game;
  if (options.initial) {
    game = structuredClone(options.initial);
    assert.equal(game.status, 'setup', 'Only the newly admitted setup can be prepared.');
    assert.equal(game.guildBetrayalPreview, true);
    assert.equal(game.guildBetrayal?.sequence, 0);
    assert.equal(game.pendingGuildBetrayal, null);
    if (options.seatIds) assert.deepEqual(game.players.map(p => p.id), options.seatIds);
    if (donor) assert.ok(game.players.some(p => p.id === donor), 'The admitted roster must contain the actual donor.');
    if (options.zero) assert.equal(game.players.find(p => p.id === other)!.faction, 'fremen');
    if (options.advanced !== undefined) assert.equal(game.advanced, options.advanced);
    if (options.homeworlds !== undefined) assert.equal(!!game.homeworlds, options.homeworlds);
    if (options.occupiedJunction || source === 'homeworld' || source === 'junction')
      assert.ok(game.homeworlds, 'This adapter needs genuinely seeded Homeworlds.');
    for (const p of game.players) viewGame(game, p.id);
  } else {
    game = createGame('GUILDBETRAYALAUDIT', newPlayer(holder, 'Atreides', 'atreides'),
      options.advanced ?? false, []);
    for (const [id, faction] of roster.slice(1)) joinGame(game, newPlayer(id, faction, faction));
    if (options.homeworlds || options.occupiedJunction || source === 'homeworld' || source === 'junction')
      game = applyAction(game, holder, {type: 'homeworlds', enabled: true});
    game.nexusCards = {cards: null, phase: null};
    for (const p of game.players) game = applyAction(game, p.id, {type: 'ready'});
    game = initializeGuildBetrayalGameForAudit(game);
  }
  game = enterGuildFixtureMovement(game);
  // Returning dealt physical hands to the same deck removes unrelated optional
  // card responses, without changing setup, physical identities or deck size.
  clearGuildFixtureHands(game);

  if (options.occupiedJunction) {
    assert.notEqual(source, 'junction', 'Low occupied Junction cannot invent a high-population sponsorship.');
    // Native Guild empties Junction through a real reserve shipment, and the
    // holder physically enters through a real Homeworld shipment. No preplaced
    // invader or forged occupation record is used.
    const guildPlayer = game.players.find(p => p.id === guild)!;
    const giver = game.players.find(p => p.id === other)!;
    const needed = Math.max(0, Math.ceil(guildPlayer.reserves / 2) - guildPlayer.spice);
    assert.ok(giver.spice >= needed);
    giver.spice -= needed;
    guildPlayer.spice += needed;
    const turn = game.turn;
    while (game.phase === 5) {
      const actor = game.active!;
      if (actor === guild) {
        game = settleGuildBetrayalFixture(applyAction(game, actor,
          reserveDeclaration(game, actor, guildPlayer.reserves)));
      } else if (actor === holder) {
        const invader = game.players.find(p => p.id === actor)!;
        const choice = homeworldShipmentChoice(viewGame(game, actor), 'homeworld:guild',
          {[`homeworld:${invader.faction}`]: {normal: 1, elite: 0}});
        assert.ok(choice.action, choice.blocked ?? 'A genuine Guild invasion must be legal.');
        game = settleGuildBetrayalFixture(applyAction(game, actor, choice.action));
      }
      game = applyAction(game, actor, {type: 'endMovement'});
    }
    game = enterGuildFixtureMovement(game, turn + 1);
    clearGuildFixtureHands(game);
    assert.equal(game.players.find(p => p.id === guild)!.reserves, 0);
    assert.equal(game.homeworlds!.custody!.visitors['homeworld:guild'][holder].normal, 1);
    homeworldGameIntegrity(game);
  }

  const shipper = source === 'guildTransport' ? options.payer === 'other' ? other : guild : options.zero ? other :
    options.payer === 'holder' ? holder : options.payer === 'guild' ? guild : other;
  const amount = options.occupiedJunction ? 3 : 2;
  if (source === 'guildTransport' && shipper !== guild) {
    assert.equal(donor, null, 'A native Guild ally uses the actual Guild grant, not a second alliance.');
    game.players.find(p => p.id === shipper)!.ally = guild;
    game.players.find(p => p.id === guild)!.ally = shipper;
    const cards = game.nexusCards!.cards!;
    for (const id of [shipper, guild]) {
      const face = cards.hands[id];
      if (face !== null) {cards.discard.push(face); cards.hands[id] = null;}
    }
  }
  for (const [id, minimum] of [[shipper, options.zero ? 0 : amount],
    ...(donor ? [[donor, options.allyPayment ?? 0]] : [])] as [string, number][])
    fundGuildFixtureSpice(game, id, minimum, donor);
  if (source === 'guildTransport') game = prepareGuildFixtureTransport(game, shipper, amount);
  else while (game.active !== shipper) game = applyAction(game, game.active!, {type: 'endMovement'});
  if (donor) {
    assert.notEqual(shipper, holder, 'An allied own payer cannot hold a Nexus card.');
    // Arrange a conserved reciprocal alliance before creating any source frame.
    // The native pledge action performs the actual donor debit/escrow custody.
    const payer = game.players.find(p => p.id === shipper)!;
    const ally = game.players.find(p => p.id === donor)!;
    payer.ally = donor; ally.ally = shipper;
    const cards = game.nexusCards!.cards!;
    for (const id of [shipper, donor]) {
      const face = cards.hands[id];
      if (face !== null) {cards.discard.push(face); cards.hands[id] = null;}
    }
    game = applyAction(game, donor, {type: 'pledgeAid', amount: options.allyPayment});
  }
  holdGuildFixtureFace(game, holder, options.nexusFace ?? 'guild');
  if (source === 'junction') {
    const option = viewGame(game, guild).junctionTransport!;
    game = applyAction(game, guild, {type: 'offerJunctionTransport', event: option.offerEvent, rate: 'full'});
  }
  const payment = options.allyPayment ?? 0;
  const payer = game.players.find(p => p.id === shipper)!;
  let declaration: Action;
  if (source === 'reserve') declaration = reserveDeclaration(game, shipper, amount, payment);
  else if (source === 'guildTransport') {
    const action = transportDeclaration(game, shipper, amount, payment);
    assert.ok(action, 'The current native Guild quote must authorize the exact source and route.');
    declaration = action;
  } else if (source === 'homeworld') {
    const choice = homeworldShipmentChoice(viewGame(game, shipper),
      shipper === guild ? 'homeworld:atreides' : 'homeworld:guild',
      {[`homeworld:${payer.faction}`]: {normal: amount, elite: 0}}, payment);
    assert.ok(choice.action, choice.blocked ?? 'The current paid Homeworld route must be legal.');
    declaration = choice.action;
  } else {
    const view = viewGame(game, shipper);
    let action: Action | null = null;
    for (const t of TERRITORIES.filter(t => t.type === 'stronghold')) {
      for (const sector of t.sectors) {
        if (sector === game.storm) continue;
        const choice = junctionTransportChoice(view, `${t.id}:${sector}`,
          {[`homeworld:${payer.faction}`]: {normal: amount, elite: 0}}, payment);
        if (choice.action) {action = choice.action; break;}
      }
      if (action) break;
    }
    assert.ok(action, 'A current storm-safe Junction quote must authorize the route.');
    declaration = action;
  }
  const before = structuredClone(game);
  game = applyAction(game, shipper, declaration);
  for (let step = 0; !game.pendingGuildBetrayal && !game.players.find(p => p.id === shipper)!.shipped && step < 20; step++) {
    const decision = game.decision;
    assert.ok(decision && ['guildShipment', 'homeworldShipmentGuild'].includes(decision.kind), 'Native permission precedes payment.');
    game = applyAction(game, decision.player, {type: 'decision', allow: true,
      ...(decision.kind === 'homeworldShipmentGuild' ? {event: decision.event} : {})});
  }
  const event = game.pendingGuildBetrayal?.invoice.event ?? '';
  const price = game.pendingGuildBetrayal?.invoice.price ?? 0;
  assert.equal(!!game.pendingGuildBetrayal, !options.zero);
  validateNexusCards(game.nexusCards!.cards!, game.players);
  if (game.homeworlds) homeworldGameIntegrity(game);
  const original = settleGuildBetrayalFixture(game);
  return {game, before, original, declaration, holder, guild, shipper, donor, event, price, source};
}
