import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { botArrivalBlock } from '../game/bot-arrival';
import { createTerrorState, placeTerror } from '../game/moritani-terror';
import {
  arrivalMove,
  arrivalPlayer,
  movementArrivalGame,
} from './deferred-movement-arrival-fixture';
import {
  shipmentArrivalAction,
  shipmentArrivalGame,
} from './fixture-deferred-shipment-arrival';

const profiles = ['Easy', 'Medium', 'Hard', 'Brutal'] as const;

function ownView(game: Game, profile: (typeof profiles)[number] = 'Medium') {
  const view = viewGame(game, game.active!);
  view.players.find((player) => player.id === view.me)!.bot = profile;
  return view;
}

void test('all four profiles avoid unsupported paired Ambassador and Terror entries', () => {
  for (const shipment of [false, true]) {
    const game = movementArrivalGame();
    arrivalPlayer(game, game.active!).shipped = !shipment;
    const action: Action = shipment ? shipmentArrivalAction : arrivalMove(game);
    const before = JSON.stringify(game);
    assert.throws(() => applyAction(game, game.active!, action));
    for (const profile of profiles) {
      const view = ownView(game, profile);
      const actions = botActions(view);
      assert.equal(
        actions.some(
          (candidate) =>
            ['ship', 'move'].includes(candidate.type) &&
            candidate.territory === 'carthag',
        ),
        false,
      );
      assert.deepEqual(botActions(JSON.parse(JSON.stringify(view))), actions);
    }
    assert.equal(JSON.stringify(game), before);
  }
});

void test('Homeworld-sourced AI shipments avoid unsupported paired entry reactions', () => {
  // Homeworlds now compose with this faction roster through the fresh
  // occupation audit, so the custody comes from real setup instead of a graft.
  const game = movementArrivalGame('tleilaxu', 'both', true);
  arrivalPlayer(game, 'tleilaxu').shipped = false;
  const action: Action = {
    type: 'ship',
    territory: 'carthag',
    sector: 11,
    amount: 1,
    elite: 0,
    homeworldSources: { 'homeworld:tleilaxu': { normal: 1, elite: 0 } },
  };
  assert.throws(() => applyAction(game, 'tleilaxu', action));
  const before = JSON.stringify(game);
  for (const profile of profiles) {
    const view = ownView(game, profile);
    const choices = botActions(view);
    assert.equal(choices.some(candidate => candidate.type === 'ship' &&
      candidate.territory === 'carthag'), false, profile);
  }
  assert.equal(JSON.stringify(game), before);
  game.moritaniTerror = createTerrorState(() => 0.2);
  assert.equal(botArrivalBlock(ownView(game), action), null);
});

void test('Guild cross-planet transport ships into a Terror arrival from its committed income response', () => {
  const game = shipmentArrivalGame();
  const bg = arrivalPlayer(game, 'bg');
  const guild = arrivalPlayer(game, 'guild');
  game.active = bg.id;
  bg.shipped = false;
  bg.ally = guild.id;
  guild.ally = bg.id;
  bg.forces = { 'sietch_tabr:14': 2 };
  bg.reserves = 18;
  const terror = createTerrorState(() => 0.2);
  game.moritaniTerror = placeTerror(terror, terror.tokens[0].id, 'carthag', 2);
  const action: Action = { type: 'guildShip', from: 'sietch_tabr:14', amount: 2,
    territory: 'carthag', sector: 11 };
  const before = JSON.stringify(game);
  // Guild income from the ally went to the bank with nothing left pending, so the
  // supported Terror entry opens in the same commit as the shipped forces.
  const shipped = applyAction(game, bg.id, action);
  const arrived = arrivalPlayer(shipped, 'bg');
  assert.deepEqual(arrived.forces, { 'carthag:11': 2 });
  assert.equal(arrived.shipped, true);
  assert.equal(shipped.decision?.kind, 'moritaniTerror');
  assert.equal(shipped.pendingTerrorEntry?.cause, 'guildTransport');
  assert.equal(shipped.pendingArrivalReaction ?? null, null);
  assert.equal(shipped.response ?? null, null);
  for (const profile of profiles) {
    const view = ownView(game, profile);
    assert.equal(botArrivalBlock(view, action), null);
    const choices = botActions(view);
    assert.equal(choices.some(candidate => candidate.type === 'guildShip' &&
      candidate.territory === 'carthag'), false, profile);
  }
  assert.equal(JSON.stringify(game), before);
  const funded = JSON.parse(before) as Game;
  funded.aid[guild.id] = { recipient: bg.id, amount: 1 };
  const guildPaid = { ...action, allyPayment: 1 };
  assert.equal(botArrivalBlock(ownView(funded), guildPaid), null);
  const paid = applyAction(funded, bg.id, guildPaid);
  assert.equal(paid.decision?.kind, 'moritaniTerror');
  assert.equal(paid.pendingTerrorEntry?.cause, 'guildTransport');
});

void test('single reactions and matching-faction Ambassador immunity remain playable', () => {
  for (const tokens of ['ambassador', 'terror'] as const) {
    const game = movementArrivalGame('tleilaxu', tokens);
    assert.equal(botArrivalBlock(ownView(game), arrivalMove(game)), null);
    assert.equal(
      applyAction(game, game.active!, arrivalMove(game)).decision?.kind,
      'choamMovement',
    );
    for (const profile of profiles)
      assert.ok(
        botActions(ownView(game, profile)).some(
          (action) => action.type === 'move' && action.territory === 'carthag',
        ),
      );
  }
});


void test('arrival filtering never reads hidden rival resources or Terror faces and does not mutate the view', () => {
  const game = movementArrivalGame();
  const view = ownView(game);
  const original = JSON.stringify(view);
  for (const player of view.players.filter((player) => player.id !== view.me))
    for (const field of ['hand', 'spice', 'traitors', 'faceDancers'])
      Object.defineProperty(player, field, {
        configurable: true,
        get: () => {
          throw Error(`Private ${field} read`);
        },
      });
  for (const token of view.moritaniTerror!.tokens)
    Object.defineProperty(token, 'kind', {
      configurable: true,
      get: () => {
        throw Error('Hidden Terror face read');
      },
    });
  botArrivalBlock(view, arrivalMove(game));
  botArrivalBlock(view, shipmentArrivalAction);
  for (const player of view.players.filter((player) => player.id !== view.me))
    for (const field of ['hand', 'spice', 'traitors', 'faceDancers'])
      Reflect.deleteProperty(player, field);
  // Restore public removed-token faces from the original before comparing.
  view.moritaniTerror = JSON.parse(original).moritaniTerror;
  assert.equal(JSON.stringify(view), original);
});
