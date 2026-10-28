import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { TERRITORIES } from '../game/board';
import { homeworldContext } from '../game/homeworld-game';
import { currentHomeworldOccupationSnapshot, homeworldOccupationMarker, homeworldOccupationSnapshotPresence } from '../game/homeworld-occupation-history';
import { nextIndependentCardModulesStep } from './fixture-independent-card-modules';

const owner = 'richese', native = 'atreides', guild = 'guild';
const source = 'homeworld:atreides', destination = 'homeworld:guild';
const seat = (game: Game, id: string) => {
  const result = game.players.find(player => player.id === id);
  assert.ok(result); return result;
};
const quiet = (game: Game) => !game.response && !game.decision && !game.phaseOpening &&
  !game.truthtrance && !game.pendingTreacheryDiscard;

/** Original native action/response continuations, including a real Guild
 * interception when Advanced allows one. No saved phase or custody is staged. */
function advance(game: Game, until: (game: Game) => boolean): Game {
  let state = game;
  for (let count = 0; count < 2500; count++) {
    if (until(state)) return state;
    assert.notEqual(state.status, 'finished');
    if (state.decision?.kind === 'homeworldShipmentGuild') {
      const decision = state.decision;
      state = applyAction(state, decision.player, { type: 'decision', event: decision.event, allow: true });
      continue;
    }
    const next = nextIndependentCardModulesStep(state);
    assert.ok(next, `Native continuation stopped at ${state.phase}/${state.decision?.kind ?? 'no decision'}.`);
    // Preserve the native Atreides cash needed for its intentional full
    // shipment by passing the actual Richese cache lot, rather than buying it.
    if (next.actor === native && next.action.type === 'richeseBid') {
      state = applyAction(state, native, { type: 'richeseBid', event: next.action.event, amount: 0, allyPayment: 0 });
      continue;
    }
    state = applyAction(state, next.actor, next.action);
  }
  throw Error('The native Homeworld transfer programme did not reach its requested boundary.');
}

/** Actual original lobby/start and force choices. Atreides deliberately ships
 * its whole real reserve to a legal stronghold before the first marker arrives,
 * so that the marker survives the intervening Battle phase without inventing
 * a battle exemption. */
function setup(advanced: boolean): Game {
  let game = createGame('RICHESEWORLDMIXED', newPlayer(native, native, 'atreides'), advanced, ['choam']);
  joinGame(game, newPlayer(owner, owner, 'richese'));
  joinGame(game, newPlayer(guild, guild, 'guild'));
  game = applyAction(game, native, { type: 'homeworlds', enabled: true });
  for (const player of game.players) game = applyAction(game, player.id, { type: 'ready' });
  game = applyAction(game, native, advanced ? { type: 'start', advancedPreview: true } : { type: 'start' });
  // Select one undealt original card position, ensuring Guild has a real
  // physical Karama for the response/stop case. Never add or duplicate cards.
  const karama = game.deck.findIndex(card => card.effect === 'karama');
  assert.ok(karama >= 0 && game.deck.length >= 3);
  [game.deck[2], game.deck[karama]] = [game.deck[karama], game.deck[2]];
  game = advance(game, state => state.status === 'playing');
  assert.ok(seat(game, guild).hand.some(card => card.effect === 'karama'));
  game = advance(game, state => state.phase === 5 && state.active === native && quiet(state));
  const amount = seat(game, native).reserves;
  assert.ok(amount > 0);
  let shipped: Game | null = null;
  for (const target of TERRITORIES.filter(territory => territory.type === 'stronghold')) {
    for (const sector of target.sectors) {
      if (sector === game.storm) continue;
      try {
        shipped = applyAction(game, native, { type: 'ship', territory: target.id, sector, amount,
          elite: 0, allyPayment: 0, homeworldSources: { [source]: { normal: amount, elite: 0 } } });
        break;
      } catch { /* Try another legal native stronghold; rejected actions are immutable. */ }
    }
    if (shipped) break;
  }
  assert.ok(shipped, 'Atreides can ship its real starting reserve to a legal stronghold.');
  game = advance(shipped, quiet);
  assert.equal(seat(game, native).reserves, 0);
  game = applyAction(game, native, { type: 'endMovement' });
  game = advance(game, state => state.phase === 5 && state.active === owner && quiet(state) &&
    !!viewGame(state, owner).homeworldShipment && !!viewGame(state, owner).richeseNoField?.canShip);
  return game;
}


function nextOwnerTurn(game: Game): Game {
  const turn = game.turn;
  game = applyAction(game, owner, { type: 'endMovement' });
  return advance(game, state => state.turn > turn && state.phase === 5 && state.active === owner &&
    quiet(state) && !seat(state, owner).shipped && !!viewGame(state, owner).homeworldShipment &&
    !viewGame(state, owner).homeworldShipment!.blocked);
}

function visitor(game: Game, world: string) {
  return game.homeworlds!.custody!.visitors[world]?.[owner];
}

/** The source counter group and marker arrive in two actual consecutive turns.
 * The native evacuation above ensures neither is invented or protected from battle. */
function prepare(advanced: boolean) {
  let game = setup(advanced);
  let own = viewGame(game, owner);
  game = applyAction(game, owner, { type: 'homeworldShip', event: own.homeworldShipment!.event,
    destination: source, sources: { 'homeworld:richese': { normal: 2, elite: 0 } }, allyPayment: 0 });
  game = advance(game, state => state.phase === 5 && state.active === owner && quiet(state) &&
    seat(state, owner).shipped && !state.pendingHomeworldShipment);
  assert.deepEqual(visitor(game, source), { normal: 2, elite: 0 });
  game = nextOwnerTurn(game);
  assert.deepEqual(visitor(game, source), { normal: 2, elite: 0 });
  own = viewGame(game, owner);
  const info = own.richeseNoField!;
  const token = info.private!.tokens.find(candidate => candidate.value === 3);
  assert.ok(token);
  game = applyAction(game, owner, { type: 'homeworldShip', event: own.homeworldShipment!.event,
    destination: source, sources: {}, noField: token.id, noFieldEvent: info.event, allyPayment: 0 });
  game = advance(game, state => state.phase === 5 && state.active === owner && quiet(state) &&
    seat(state, owner).shipped && !!seat(state, owner).noField?.deployed);
  assert.deepEqual(seat(game, owner).noField!.deployed!.location, { homeworld: source });
  assert.deepEqual(visitor(game, source), { normal: 2, elite: 0 });
  game = nextOwnerTurn(game);
  assert.deepEqual(visitor(game, source), { normal: 2, elite: 0 });
  assert.equal(seat(game, owner).noField!.lastShipped, token.id);
  return { game, token: token.id };
}

function declaration(game: Game, token: string): Action {
  const own = viewGame(game, owner);
  return { type: 'homeworldShip', event: own.homeworldShipment!.event, destination,
    sources: { [source]: { normal: 1, elite: 0 } }, noField: token,
    noFieldEvent: own.richeseNoField!.event, noFieldFrom: source, allyPayment: 0 };
}

function presence(game: Game, world: string) {
  const snapshot = currentHomeworldOccupationSnapshot(homeworldContext(game), game.homeworlds!.custody!,
    homeworldOccupationMarker(game.players));
  return homeworldOccupationSnapshotPresence(snapshot, world);
}

for (const advanced of [false, true]) void test(`${advanced ? 'Advanced' : 'Basic'} mixed marker and physical Homeworld transfer uses one shipment`, () => {
  const ready = prepare(advanced);
  let game = ready.game;
  const before = structuredClone(game), action = declaration(game, ready.token);
  assert.ok(seat(before, owner).spice >= 2, 'The actual Richese seat can pay the two-spice price.');
  assert.deepEqual(presence(before, source), [owner]);
  for (const stale of [{ ...action, noFieldEvent: 'stale-marker-event' }, { ...action, event: 'stale-shipment-event' }]) {
    assert.throws(() => applyAction(game, owner, stale));
    assert.deepEqual(game, before, 'A stale event leaves the real game unchanged.');
  }
  const malformed = { ...action, sources: { [source]: null } } as unknown as Action;
  assert.throws(() => applyAction(game, owner, malformed), 'A null typed source cannot be dropped from a mixed transfer.');
  assert.deepEqual(game, before, 'Rejecting a malformed source leaves the game unchanged.');
  game = applyAction(game, owner, action);
  game = advance(game, state => state.phase === 5 && state.active === owner && quiet(state) &&
    seat(state, owner).shipped && !state.pendingHomeworldShipment);
  assert.equal(seat(game, owner).spice, seat(before, owner).spice - 2);
  assert.equal(seat(game, owner).reserves, seat(before, owner).reserves);
  assert.deepEqual(visitor(game, source), { normal: 1, elite: 0 });
  assert.deepEqual(visitor(game, destination), { normal: 1, elite: 0 });
  assert.equal(seat(game, owner).noField!.deployed!.tokenId, ready.token);
  assert.deepEqual(seat(game, owner).noField!.deployed!.location, { homeworld: destination });
  assert.equal(seat(game, owner).noField!.lastShipped, ready.token);
  assert.deepEqual(presence(game, source), [owner]);
  assert.deepEqual(presence(game, destination).sort(), [guild, owner].sort());
});

void test('Advanced Guild can stop a mixed Homeworld transfer without payment, moving either group, or changing marker history', () => {
  const ready = prepare(true);
  let game = ready.game;
  const before = structuredClone(game);
  game = applyAction(game, owner, declaration(game, ready.token));
  game = advance(game, state => state.decision?.kind === 'homeworldShipmentGuild');
  assert.match(game.log.at(-1)!.text, /one concealed No-Field and 1 physical forces/);
  const karama = seat(game, guild).hand.find(card => card.effect === 'karama'); assert.ok(karama);
  game = applyAction(game, guild, { type: 'card', mode: 'special', card: karama.id });
  game = advance(game, state => state.phase === 5 && state.active === owner && quiet(state) &&
    !state.pendingHomeworldShipment);
  assert.equal(seat(game, owner).shipped, true);
  assert.deepEqual(seat(game, owner).noField, seat(before, owner).noField);
  assert.equal(seat(game, owner).reserves, seat(before, owner).reserves);
  assert.equal(seat(game, owner).spice, seat(before, owner).spice);
  assert.deepEqual(game.homeworlds!.custody, before.homeworlds!.custody);
  assert.deepEqual(presence(game, source), presence(before, source));
  assert.deepEqual(presence(game, destination), presence(before, destination));
});
