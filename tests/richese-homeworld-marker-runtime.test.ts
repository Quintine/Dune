import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, createGame, joinGame, newPlayer,
  viewGame, type Action, type Game } from '../game/engine';
import { homeworldContext } from '../game/homeworld-game';
import { homeworldForceGroups } from '../game/homeworld-custody';
import { nextIndependentCardModulesStep } from './fixture-independent-card-modules';

const richese = 'richese', opponent = 'atreides', world = 'homeworld:atreides';
const player = (game: Game, id: string) => {
  const seat = game.players.find(candidate => candidate.id === id); assert.ok(seat); return seat;
};
const clean = (game: Game) => !game.response && !game.decision && !game.phaseOpening &&
  !game.truthtrance && !game.pendingTreacheryDiscard;

/** Follow only the real native decisions and response queues. The Guild's
 * actual Advanced stop opportunity is explicitly allowed and recorded. */
function advance(game: Game, until: (state: Game) => boolean, trace: string[] = []): Game {
  let state = game;
  for (let count = 0; count < 2000; count++) {
    if (until(state)) return state;
    assert.notEqual(state.status, 'finished');
    if (state.response) trace.push(`response:${state.response.kind}`);
    if (state.decision?.kind === 'homeworldShipmentGuild') {
      const d = state.decision; trace.push(`decision:${d.kind}`);
      state = applyAction(state, d.player, { type: 'decision', event: d.event, allow: true });
      continue;
    }
    const step = nextIndependentCardModulesStep(state);
    assert.ok(step, `Native continuation stopped at ${state.phase}/${state.decision?.kind ?? 'no decision'}`);
    state = applyAction(state, step.actor, step.action);
  }
  throw Error('The native Homeworld marker programme did not reach its boundary.');
}

function setup(advanced = true) {
  let game = createGame('RICHESEHOMEWORLDMARKER', newPlayer(richese, richese, 'richese'), advanced, ['choam']);
  joinGame(game, newPlayer(opponent, opponent, 'atreides'));
  joinGame(game, newPlayer('guild', 'guild', 'guild'));
  game = applyAction(game, game.host, { type: 'homeworlds', enabled: true });
  for (const seat of game.players) game = applyAction(game, seat.id, { type: 'ready' });
  // Use the original public start; Advanced explicitly acknowledges preview.
  // No phase, resource, army or marker is assigned by the fixture.
  game = applyAction(game, game.host, advanced ? { type: 'start', advancedPreview: true } : { type: 'start' });
  // Select one position in the original still-undealt deck, so Guild receives
  // a real Karama at its starting-card deal. This makes both the cancel window
  // and the Guild stop observable rather than automatically passed.
  const karama = game.deck.findIndex(card => card.effect === 'karama');
  assert.ok(karama >= 0 && game.deck.length >= 3);
  [game.deck[2], game.deck[karama]] = [game.deck[karama], game.deck[2]];
  game = advance(game, state => state.status === 'playing');
  assert.ok(player(game, 'guild').hand.some(card => card.effect === 'karama'));
  return advance(game, state => state.phase === 5 && state.active === richese && clean(state) &&
    !!viewGame(state, richese).homeworldShipment && !!viewGame(state, richese).richeseNoField?.canShip);
}

function inventory(game: Game) {
  const homes = homeworldForceGroups(homeworldContext(game), game.homeworlds!.custody!);
  return Object.fromEntries(game.players.map(seat => [seat.id, seat.reserves + seat.tanks +
    Object.values(seat.forces).reduce((sum, value) => sum + value, 0) + homes
      .filter(home => home.native !== seat.id)
      .reduce((sum, home) => sum + (home.forces[seat.id]?.normal ?? 0) + (home.forces[seat.id]?.elite ?? 0), 0)]));
}

for (const advanced of [false, true]) for (const value of [0, 3, 5] as const) {
  void test(`${advanced ? 'Advanced' : 'Basic'} Richese ships its ${value} marker to an actual Homeworld battle, reveals and finishes`, () => {
    let game = setup(advanced);
    const initial = structuredClone(game), originalInventory = inventory(game);
    const own = viewGame(game, richese), marker = own.richeseNoField!.private!.tokens.find(token => token.value === value);
    assert.ok(marker); assert.equal(own.homeworldShipment!.blocked, null);
    const declaration: Action = { type: 'homeworldShip', event: own.homeworldShipment!.event,
      destination: world, sources: {}, noField: marker.id, noFieldEvent: own.richeseNoField!.event, allyPayment: 0 };
    game = applyAction(game, richese, declaration);
    assert.equal(game.response?.kind, 'richeseNoField');
    assert.equal(player(game, richese).spice, player(initial, richese).spice,
      'The pending Karama response cannot charge the shipper.');
    assert.deepEqual(player(game, richese).noField, player(initial, richese).noField);
    const trace: string[] = [];
    game = advance(game, state => state.active === richese && state.phase === 5 && clean(state) &&
      player(state, richese).shipped, trace);
    assert.ok(trace.includes('response:richeseNoField'), 'The original Karama opportunity completed.');
    assert.equal(trace.includes('decision:homeworldShipmentGuild'), advanced,
      advanced ? 'The original Advanced Guild stop was allowed.' : 'Basic does not grant the Advanced Guild stop.');
    assert.equal(player(game, richese).spice, player(initial, richese).spice - 1);
    assert.equal(player(game, richese).reserves, player(initial, richese).reserves);
    assert.deepEqual(inventory(game), originalInventory);
    assert.deepEqual(player(game, richese).noField!.deployed!.location, { homeworld: world });
    assert.equal(player(game, richese).noField!.lastShipped, marker.id);
    const observer = viewGame(game, opponent).richeseNoField!;
    assert.equal(observer.private, null);
    assert.deepEqual(observer.public.deployed!.location, { homeworld: world });
    assert.equal(JSON.stringify(observer.public).includes(marker.id), false, 'A face-down marker does not publish its identity.');

    game = applyAction(game, richese, { type: 'endMovement' });
    game = advance(game, state => state.phase === 6 && clean(state) && !state.battle && !!state.active &&
      viewGame(state, state.active).battleChoices.some(choice => choice.territory === world));
    const chooser = game.active!;
    const choice = viewGame(game, chooser).battleChoices.find(candidate => candidate.territory === world)!;
    const target = choice.attacker === chooser ? choice.defender : choice.attacker;
    game = applyAction(game, chooser, { type: 'chooseBattle', territory: world, target });
    game = advance(game, state => !!state.battle && !state.battle.revealed && clean(state) &&
      (!state.battle.preLeader || state.battle.preLeader.closed) && !state.battle.preparation);
    const event = game.battle!.event;
    assert.ok(game.battle!.noFieldPlayers?.includes(richese));
    for (const actor of [richese, opponent]) {
      game = advance(game, state => !!state.battle && !state.battle.revealed && clean(state) &&
        (!state.battle.preLeader || state.battle.preLeader.closed) && !state.battle.preparation);
      const leader = player(game, actor).leaders.find(candidate => !candidate.dead &&
        (!candidate.usedAt || candidate.usedAt === world));
      assert.ok(leader);
      game = applyAction(game, actor, { type: 'battlePlan', dial: 0, support: 0, allyPayment: 0,
        leader: leader.id, weapon: null, defense: null });
      if (actor === richese) assert.ok(player(game, richese).noField!.deployed, 'One seal does not reveal the marker.');
    }
    assert.equal(game.battle!.revealed, true);
    assert.equal(player(game, richese).noField!.deployed, null);
    assert.equal(player(game, richese).reserves, player(initial, richese).reserves - value);
    assert.equal(game.homeworlds!.custody!.visitors[world]?.[richese]?.normal ?? 0, value);
    assert.deepEqual(inventory(game), originalInventory);
    game = advance(game, state => !state.battle && state.lastBattleContext?.event === event && clean(state));
    assert.deepEqual(inventory(game), originalInventory);
  });
}

void test('Karama cancels the proposed Homeworld marker without charging or spending the shipment', () => {
  let game = setup();
  const before = structuredClone(game), own = viewGame(game, richese);
  const token = own.richeseNoField!.private!.tokens.find(candidate => candidate.value === 3)!;
  const karama = player(game, 'guild').hand.find(card => card.effect === 'karama')!;
  game = applyAction(game, richese, { type: 'homeworldShip', event: own.homeworldShipment!.event,
    destination: world, sources: {}, noField: token.id, noFieldEvent: own.richeseNoField!.event, allyPayment: 0 });
  assert.equal(game.response?.kind, 'richeseNoField');
  game = applyAction(game, 'guild', { type: 'card', mode: 'cancel', card: karama.id });
  game = advance(game, state => state.phase === 5 && state.active === richese && clean(state) && !state.pendingHomeworldShipment);
  assert.equal(player(game, richese).spice, player(before, richese).spice);
  assert.equal(player(game, richese).reserves, player(before, richese).reserves);
  assert.equal(player(game, richese).shipped, false);
  assert.deepEqual(player(game, richese).noField, player(before, richese).noField);
  assert.deepEqual(game.homeworlds!.custody, before.homeworlds!.custody);
  assert.equal(game.discard.filter(card => card.id === karama.id).length, 1);
  assert.deepEqual(inventory(game), inventory(before));
  assert.equal(player(game, richese).noFieldBlockedTurn, game.turn);
  assert.equal(viewGame(game, richese).richeseNoField!.canShip, false);
  const option = viewGame(game, richese).homeworldShipment!;
  game = applyAction(game, richese, { type: 'homeworldShip', event: option.event,
    destination: world, sources: { 'homeworld:richese': { normal: 1, elite: 0 } }, allyPayment: 0 });
  game = advance(game, state => state.phase === 5 && state.active === richese && clean(state) &&
    player(state, richese).shipped && !state.pendingHomeworldShipment);
  assert.equal(game.homeworlds!.custody!.visitors[world][richese].normal, 1,
    'The original physical shipment is still available after preventing the marker.');
  assert.equal(player(game, richese).spice, player(before, richese).spice - 1);
  assert.deepEqual(inventory(game), inventory(before));
});

void test('Advanced Guild stops the Homeworld marker before payment or arrival while using the shipment', () => {
  let game = setup();
  const before = structuredClone(game), own = viewGame(game, richese);
  const token = own.richeseNoField!.private!.tokens.find(candidate => candidate.value === 5)!;
  const karama = player(game, 'guild').hand.find(card => card.effect === 'karama')!;
  game = applyAction(game, richese, { type: 'homeworldShip', event: own.homeworldShipment!.event,
    destination: world, sources: {}, noField: token.id, noFieldEvent: own.richeseNoField!.event, allyPayment: 0 });
  game = advance(game, state => state.decision?.kind === 'homeworldShipmentGuild');
  assert.equal(player(game, richese).spice, player(before, richese).spice);
  assert.deepEqual(player(game, richese).noField, player(before, richese).noField);
  game = applyAction(game, 'guild', { type: 'card', mode: 'special', card: karama.id });
  game = advance(game, state => state.phase === 5 && state.active === richese && clean(state) && !state.pendingHomeworldShipment);
  assert.equal(player(game, richese).spice, player(before, richese).spice);
  assert.equal(player(game, richese).reserves, player(before, richese).reserves);
  assert.equal(player(game, richese).shipped, true);
  assert.deepEqual(player(game, richese).noField, player(before, richese).noField);
  assert.deepEqual(game.homeworlds!.custody, before.homeworlds!.custody);
  assert.equal(game.discard.filter(card => card.id === karama.id).length, 1);
  assert.deepEqual(inventory(game), inventory(before));
});
