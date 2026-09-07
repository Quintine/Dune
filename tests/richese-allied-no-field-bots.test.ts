import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  normalizeAutomaticGame,
  viewGame,
  type Game,
} from '../game/engine';
import { botActions, runBots } from '../game/bots';
import { DIFFICULTIES, type Difficulty } from '../game/bot-profiles';
import { baseDeck } from '../game/cards';
import {
  createRicheseNoField,
  deployRicheseNoField,
} from '../game/richese-no-field';
import type { FactionId } from '../game/catalog';

function fixture(recipient: FactionId = 'emperor') {
  const g = createGame('ALLYNOFIELDBOT', newPlayer('r', 'Richese', 'richese'));
  g.players.push(
    newPlayer('a', 'Recipient', recipient),
    newPlayer('o', 'Observer', 'atreides'),
  );
  g.status = 'playing';
  g.advanced = true;
  g.phase = 5;
  g.turn = 2;
  g.active = 'a';
  g.storm = 18;
  g.order = ['a', 'r', 'o'];
  g.movementRemaining = [...g.order];
  g.players[0].ally = 'a';
  g.players[1].ally = 'r';
  for (const p of g.players) {
    p.hand = [];
    p.forces = {};
    p.spice = 10;
    p.reserves = 20;
  }
  g.players[0].noField = createRicheseNoField([
    'secret0',
    'secret3',
    'secret5',
  ]);
  g.players[0].noFieldEvent = 'allied-inventory-event';
  if (recipient === 'emperor')
    g.players[1].elites = { forces: {}, reserves: 5, tanks: 0, revived: 0 };
  return g;
}
function projection(g: Game, difficulty: Difficulty, id = 'r') {
  const v = viewGame(g, id);
  v.players.find((p) => p.id === id)!.bot = difficulty;
  return v;
}
const offerAction = (g: Game, difficulty: Difficulty) =>
  botActions(projection(normalizeAutomaticGame(g), difficulty)).find(
    (a) => a.type === 'offerRicheseNoField',
  );
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));

void test('all profiles proactively offer during the ally turn and accept an exact typed shipment without spending Richese movement', () => {
  for (const difficulty of DIFFICULTIES) {
    const initial = fixture();
    const action = offerAction(initial, difficulty);
    assert.ok(action, difficulty);
    assert.equal(action.payer, 'r');
    assert.equal(action.event, initial.players[0].noFieldEvent);
    const value = difficulty === 'Easy' ? 3 : 5;
    assert.equal(action.token, `secret${value}`);
    let g = applyAction(initial, 'r', action);
    assert.equal(g.decision?.kind, 'richeseAllyShipment');
    assert.deepEqual(botActions(projection(g, difficulty, 'r')), []);
    assert.equal(viewGame(g, 'o').richeseNoField!.allyOffer, null);
    g = reload(g);
    const accept = botActions(projection(g, difficulty, 'a'))[0];
    assert.equal(accept.accept, true);
    assert.equal(accept.event, g.richeseAllyOffer!.event);
    assert.equal(accept.elite, difficulty === 'Easy' ? 0 : 5);
    g = applyAction(g, 'a', accept);
    assert.equal(g.players[0].spice, 9);
    assert.equal(g.players[1].spice, 10);
    assert.equal(g.players[0].shipped, false);
    assert.equal(g.players[1].shipped, true);
    assert.equal(g.players[0].moved, 0);
    assert.equal(g.players[1].moved, 0);
    assert.equal(g.players[0].reserves, 20);
    assert.equal(g.players[1].reserves, 20 - value);
    assert.equal(
      Object.values(g.players[1].forces).reduce((n, amount) => n + amount, 0),
      value,
    );
    assert.equal(g.players[0].noField!.deployed, null);
    assert.equal(g.players[0].noField!.lastShipped, action.token);
    assert.equal(offerAction(reload(g), difficulty), undefined);
  }
});

void test('all profiles preserve required elite minimum and materialize an existing owner marker only on accepted commit', () => {
  for (const difficulty of DIFFICULTIES) {
    let g = fixture();
    g.players[0].noField = deployRicheseNoField(g.players[0].noField!, {
      tokenId: 'secret5',
      controller: 'r',
      location: { territory: 'arrakeen', sector: 10 },
    });
    g.players[0].reserves = 2;
    g.players[0].tanks = 18;
    g.players[1].reserves = 3;
    g.players[1].tanks = 17;
    g.players[1].elites!.reserves = 3;
    const action = offerAction(g, difficulty)!;
    assert.equal(action.token, 'secret3');
    assert.notEqual(action.territory, 'arrakeen');
    g = applyAction(g, 'r', action);
    assert.ok(g.players[0].noField!.deployed);
    assert.deepEqual(g.players[0].forces, {});
    const accept = botActions(projection(g, difficulty, 'a'))[0];
    assert.equal(accept.elite, 3);
    g = applyAction(reload(g), 'a', accept);
    assert.equal(g.players[0].forces['arrakeen:10'], 2);
    assert.equal(g.players[0].reserves, 0);
    assert.equal(g.players[1].reserves, 0);
    assert.equal(g.players[1].elites!.reserves, 0);
    assert.equal(
      Object.values(g.players[1].elites!.forces).reduce(
        (n, amount) => n + amount,
        0,
      ),
      3,
    );
  }
});

void test('zero or newly blocked offers are declined once, retaining custody and preventing automatic reoffers', () => {
  for (const difficulty of DIFFICULTIES)
    for (const blocked of [false, true]) {
      const initial = fixture();
      let g = applyAction(initial, 'r', {
        type: 'offerRicheseNoField',
        event: initial.players[0].noFieldEvent,
        token: blocked ? 'secret3' : 'secret0',
        territory: 'carthag',
        sector: 11,
        payer: blocked ? 'a' : 'r',
      });
      if (blocked) g.players[1].spice = 0;
      const current = structuredClone(
        g.players.map((p) => ({
          spice: p.spice,
          reserves: p.reserves,
          shipped: p.shipped,
          noField: p.noField,
        })),
      );
      const decline = botActions(projection(g, difficulty, 'a'))[0];
      assert.equal(decline.decline, true);
      assert.equal(decline.event, g.richeseAllyOffer!.event);
      g = applyAction(g, 'a', decline);
      assert.deepEqual(
        g.players.map((p) => ({
          spice: p.spice,
          reserves: p.reserves,
          shipped: p.shipped,
          noField: p.noField,
        })),
        current,
      );
      assert.equal(viewGame(g, 'r').richeseNoField!.allyDeclined, true);
      assert.equal(offerAction(reload(g), difficulty), undefined);
    }
});

void test('offer choices do not use hidden recipient money and respect projection gates and unsupported recipients', () => {
  for (const difficulty of DIFFICULTIES) {
    const g = fixture();
    const original = offerAction(g, difficulty);
    g.players[1].spice = 10000;
    g.players[2].spice = 5000;
    assert.deepEqual(offerAction(g, difficulty), original);
    g.players[0].spice = 0;
    assert.equal(
      offerAction(g, difficulty),
      undefined,
      'no automatic commitment of recipient money',
    );
    const view = projection(fixture(), difficulty);
    view.richeseNoField!.canOfferAlly = false;
    assert.ok(!botActions(view).some((a) => a.type === 'offerRicheseNoField'));
    for (const faction of ['fremen', 'guild'] as const)
      assert.equal(offerAction(fixture(faction), difficulty), undefined);
    const inactive = fixture();
    inactive.active = 'r';
    assert.equal(offerAction(inactive, difficulty), undefined);
    const consumed = fixture();
    consumed.players[1].shipped = true;
    assert.equal(offerAction(consumed, difficulty), undefined);
  }
});

void test('responses and Truthtrance retain priority, and allowed allied shipment finishes without repeating the offer', () => {
  for (const difficulty of DIFFICULTIES) {
    let g = fixture();
    g.players[2].hand = [baseDeck().find((c) => c.effect === 'karama')!];
    g = applyAction(g, 'r', offerAction(g, difficulty)!);
    const accept = botActions(projection(g, difficulty, 'a'))[0];
    g = applyAction(g, 'a', accept);
    assert.equal(g.response?.kind, 'richeseNoField');
    assert.equal(offerAction(g, difficulty), undefined);
    const pass = botActions(projection(g, difficulty, 'o'))[0];
    assert.equal(pass.type, 'passResponse');
    g = applyAction(reload(g), 'o', pass);
    assert.equal(g.response, null);
    assert.equal(g.players[1].shipped, true);
    assert.equal(offerAction(g, difficulty), undefined);
    const v = projection(fixture(), difficulty);
    v.truthtrance = {
      stage: 'priority',
      queue: [],
      passed: [],
    } as unknown as NonNullable<typeof v.truthtrance>;
    assert.equal(botActions(v)[0].type, 'truthPass');
  }
});

void test('actual bot scheduling offers before the active ally ships in either seating order and respects human supplier ownership', () => {
  for (const difficulty of DIFFICULTIES)
    for (const reverse of [false, true]) {
      const g = fixture();
      for (const p of g.players) p.bot = difficulty;
      if (reverse) g.players.reverse();
      const offered = runBots(g, 1);
      assert.equal(offered.decision?.kind, 'richeseAllyShipment');
      assert.equal(offered.richeseAllyOffer!.owner, 'r');
      assert.equal(offered.richeseAllyOffer!.recipient, 'a');
      assert.equal(offered.players.find((p) => p.id === 'a')!.shipped, false);
      const committed = runBots(reload(offered), 1);
      assert.equal(committed.players.find((p) => p.id === 'a')!.shipped, true);
      assert.equal(committed.players.find((p) => p.id === 'r')!.shipped, false);
      const humanSupplier = reload(g);
      humanSupplier.players.find((p) => p.id === 'r')!.bot = undefined;
      const waiting = runBots(humanSupplier, 1);
      assert.equal(waiting.richeseAllyOffer, undefined);
      assert.equal(waiting.decision?.kind, 'richeseAllyOpportunity');
      assert.equal(waiting.decision?.player, 'r');
      assert.equal(waiting.players.find((p) => p.id === 'a')!.shipped, false);
      assert.equal(waiting.botsPending, false);
      assert.deepEqual(runBots(reload(waiting), 1), reload(waiting));
      const passed = applyAction(waiting, 'r', {
        type: 'decision',
        decline: true,
      });
      const ordinary = runBots(passed, 1);
      assert.equal(ordinary.players.find((p) => p.id === 'a')!.shipped, true);
      assert.equal(ordinary.active, 'a');
      const humanOffered = applyAction(
        waiting,
        'r',
        offerAction(waiting, difficulty)!,
      );
      const accepted = runBots(reload(humanOffered), 1);
      assert.equal(accepted.players.find((p) => p.id === 'a')!.shipped, true);
      assert.equal(accepted.players.find((p) => p.id === 'r')!.shipped, false);
      assert.equal(accepted.active, 'a');
    }
});

void test('every profile declines an unaffordable supplier opportunity and autopilot has the same legal ownership', () => {
  for (const difficulty of DIFFICULTIES) {
    const g = fixture();
    g.players[0].spice = 0;
    g.players[0].bot = difficulty;
    g.players[1].bot = difficulty;
    const passed = runBots(g, 1);
    assert.equal(passed.decision, null);
    assert.equal(passed.richeseAllyOffer, undefined);
    assert.equal(passed.players[1].shipped, false);
    assert.equal(runBots(passed, 1).players[1].shipped, true);
    const autopilot = fixture();
    autopilot.players[0].autopilot = difficulty;
    const offered = runBots(autopilot, 1);
    assert.equal(offered.decision?.kind, 'richeseAllyShipment');
    assert.equal(offered.richeseAllyOffer?.owner, 'r');
    const waiting = runBots(offered, 1);
    assert.equal(waiting.botsPending, false);
    assert.equal(waiting.players[1].shipped, false);
  }
});
