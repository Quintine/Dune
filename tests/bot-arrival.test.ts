import assert from 'node:assert/strict';
import test from 'node:test';
import { botArrivalBlock } from '../game/bot-arrival';
import { botActions } from '../game/bots';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import {
  arrivalMove,
  arrivalPlayer,
  movementArrivalGame,
} from './deferred-movement-arrival-fixture';
import {
  addShipmentArrivalAmbassador,
  shipmentArrivalAction,
  shipmentArrivalGame,
  richeseNoFieldArrivalAction,
} from './fixture-deferred-shipment-arrival';

const overlap = /combined with another arrival reaction/;
const profiles = ['Easy', 'Medium', 'Hard', 'Brutal'] as const;

function ownView(game: Game, profile: (typeof profiles)[number] = 'Medium') {
  const view = viewGame(game, game.active!);
  view.players.find((player) => player.id === view.me)!.bot = profile;
  return view;
}

void test('all four profiles avoid the reproduced Ambassador/Terror entries and keep an executable alternative', () => {
  for (const shipment of [false, true]) {
    const game = movementArrivalGame();
    arrivalPlayer(game, game.active!).shipped = !shipment;
    const action: Action = shipment ? shipmentArrivalAction : arrivalMove(game);
    const before = JSON.stringify(game);
    assert.throws(() => applyAction(game, game.active!, action), overlap);
    for (const profile of profiles) {
      const view = ownView(game, profile);
      assert.match(botArrivalBlock(view, action) ?? '', overlap);
      const actions = botActions(view);
      assert.ok(actions.length, profile);
      assert.equal(
        actions.some(
          (candidate) =>
            ['ship', 'move'].includes(candidate.type) &&
            candidate.territory === 'carthag',
        ),
        false,
      );
      const next = applyAction(game, view.me, actions[0]);
      assert.ok(next);
      assert.deepEqual(botActions(JSON.parse(JSON.stringify(view))), actions);
    }
    assert.equal(JSON.stringify(game), before);
  }
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
  const fremen = movementArrivalGame('fremen');
  assert.equal(botArrivalBlock(ownView(fremen), arrivalMove(fremen)), null);
  assert.ok(applyAction(fremen, fremen.active!, arrivalMove(fremen)));
});

void test('shipment detects prospective BG accompaniment including a concealed No-Field without inspecting its denomination', () => {
  const game = shipmentArrivalGame();
  addShipmentArrivalAmbassador(game);
  assert.match(
    botArrivalBlock(ownView(game), shipmentArrivalAction) ?? '',
    overlap,
  );
  assert.throws(
    () => applyAction(game, game.active!, shipmentArrivalAction),
    overlap,
  );
  game.active = 'richese';
  arrivalPlayer(game, 'richese').shipped = false;
  const marker = richeseNoFieldArrivalAction(game);
  assert.match(botArrivalBlock(ownView(game), marker) ?? '', overlap);
  assert.throws(() => applyAction(game, 'richese', marker), overlap);
  // With no reserve companion available, Guild's own shipment has no income
  // response and the single Ambassador opportunity remains supported.
  const bg = arrivalPlayer(game, 'bg');
  bg.forces = { 'polar_sink:0': 20 };
  bg.reserves = 0;
  game.active = 'guild';
  assert.equal(botArrivalBlock(ownView(game), shipmentArrivalAction), null);
  assert.ok(applyAction(game, 'guild', shipmentArrivalAction));
});

void test('Guild income preview preserves a shipment funded entirely by the Guild ally', () => {
  const game = shipmentArrivalGame();
  addShipmentArrivalAmbassador(game);
  const bg = arrivalPlayer(game, 'bg');
  bg.reserves = 0;
  bg.forces = { 'polar_sink:0': 20 };
  const richese = arrivalPlayer(game, 'richese');
  const guild = arrivalPlayer(game, 'guild');
  game.active = richese.id;
  richese.shipped = false;
  richese.ally = guild.id;
  guild.ally = richese.id;
  game.aid[guild.id] = { recipient: richese.id, amount: 2 };
  const ownPaid = { ...shipmentArrivalAction, amount: 4, allyPayment: 0 };
  assert.match(botArrivalBlock(ownView(game), ownPaid) ?? '', overlap);
  assert.throws(() => applyAction(game, richese.id, ownPaid), overlap);
  const guildPaid = { ...ownPaid, allyPayment: 2 };
  assert.equal(botArrivalBlock(ownView(game), guildPaid), null);
  assert.ok(applyAction(game, richese.id, guildPaid));
  richese.spice = 0;
  const automaticShare: Action = { ...guildPaid };
  delete automaticShare.allyPayment;
  assert.equal(botArrivalBlock(ownView(game), automaticShare), null);
  assert.ok(applyAction(game, richese.id, automaticShare));
});

void test('Advanced BG fighter intrusion is distinguished from advisor presence', () => {
  const game = shipmentArrivalGame();
  addShipmentArrivalAmbassador(game);
  const guild = arrivalPlayer(game, 'guild');
  guild.forces = { 'arrakeen:10': 3 };
  guild.reserves = 17;
  guild.shipped = true;
  const bg = arrivalPlayer(game, 'bg');
  bg.forces = { 'carthag:11': 1 };
  bg.reserves = 19;
  const move = {
    type: 'move',
    from: 'arrakeen:10',
    territory: 'carthag',
    sector: 11,
    amount: 3,
  };
  assert.match(botArrivalBlock(ownView(game), move) ?? '', overlap);
  assert.throws(() => applyAction(game, guild.id, move), overlap);
  bg.advisors = { carthag: {} };
  // Advisors need another faction present or automatic stance settlement
  // correctly makes this lone group fighters before either quote.
  const moritani = arrivalPlayer(game, 'moritani');
  moritani.forces = { 'carthag:11': 1 };
  moritani.reserves = 19;
  assert.equal(botArrivalBlock(ownView(game), move), null);
  assert.ok(applyAction(game, guild.id, move));
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
  assert.match(botArrivalBlock(view, arrivalMove(game)) ?? '', overlap);
  assert.match(botArrivalBlock(view, shipmentArrivalAction) ?? '', overlap);
  for (const player of view.players.filter((player) => player.id !== view.me))
    for (const field of ['hand', 'spice', 'traitors', 'faceDancers'])
      Reflect.deleteProperty(player, field);
  // Restore public removed-token faces from the original before comparing.
  view.moritaniTerror = JSON.parse(original).moritaniTerror;
  assert.equal(JSON.stringify(view), original);
});
