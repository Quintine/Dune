import { runBots } from '../game/bots';
import { createTerrorState, placeTerror } from '../game/moritani-terror';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  newPlayer,
  applyAction,
  viewGame,
  type Game,
  type Action,
  RuleError,
} from '../game/engine';
import {
  createRicheseNoField,
  deployRicheseNoField,
} from '../game/richese-no-field';
import { baseDeck } from '../game/cards';
function fixture(advanced = false) {
  const g = createGame(
    'ALLYNOFIELD',
    newPlayer('r', 'Richese', 'richese'),
    advanced,
    ['choam'],
  );
  g.players.push(
    newPlayer('a', 'Atreides', 'atreides'),
    newPlayer('e', 'Emperor', 'emperor'),
  );
  g.status = 'playing';
  g.phase = 5;
  g.turn = 2;
  g.active = 'a';
  g.order = ['r', 'a', 'e'];
  g.movementRemaining = ['a', 'r', 'e'];
  g.storm = 18;
  g.deck = baseDeck();
  for (const p of g.players) {
    p.forces = {};
    p.reserves = 20;
    p.tanks = 0;
    p.spice = 10;
    p.hand = [];
    p.traitorChoices = [];
    p.traitors = [];
  }
  g.players[0].ally = 'a';
  g.players[1].ally = 'r';
  g.players[0].noField = createRicheseNoField(['zero', 'three', 'five']);
  g.players[0].noFieldEvent = 'event-a';
  return g;
}
const send = (g: Game, id: string, a: Action) => applyAction(g, id, a);
const offer = (
  g: Game,
  token = 'five',
  payer = 'r',
  territory = 'arrakeen',
  sector = 10,
) =>
  send(g, 'r', {
    type: 'offerRicheseNoField',
    token,
    event: g.players[0].noFieldEvent,
    payer,
    territory,
    sector,
  });
const accept = (g: Game, elite = 0) =>
  send(g, 'a', {
    type: 'decision',
    event: g.richeseAllyOffer!.event,
    accept: true,
    elite,
  });
function hold(g: Game, id: string, name: string) {
  const i = g.deck.findIndex((c) => c.name === name);
  assert.ok(i >= 0);
  const c = g.deck.splice(i, 1)[0];
  g.players.find((p) => p.id === id)!.hand.push(c);
  return c.id;
}
function conserve(g: Game) {
  for (const p of g.players)
    assert.equal(
      p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0),
      20,
    );
}
void test('allied tokens0/3/5 materialize immediately for either full payer at exact one/two spice price', () => {
  for (const token of ['zero', 'three', 'five'])
    for (const payer of ['r', 'a'])
      for (const to of ['arrakeen', 'imperial_basin']) {
        let g = fixture();
        g = offer(g, token, payer, to);
        assert.equal(g.decision?.kind, 'richeseAllyShipment');
        assert.equal(g.players[0].spice, 10);
        assert.equal(g.players[0].noField!.deployed, null);
        g = accept(g);
        const n = token === 'zero' ? 0 : token === 'three' ? 3 : 5,
          cost = to === 'arrakeen' ? 1 : 2;
        assert.equal(g.players[1].forces[`${to}:10`] ?? 0, n);
        assert.equal(g.players[1].reserves, 20 - n);
        assert.equal(g.players[0].reserves, 20);
        assert.equal(g.players.find((p) => p.id === payer)!.spice, 10 - cost);
        assert.equal(g.players[1].shipped, true);
        assert.equal(g.players[0].shipped, false);
        assert.equal(g.players[0].noField!.deployed, null);
        assert.equal(g.players[0].noField!.lastShipped, token);
        conserve(g);
      }
});
void test('private offers are identical to nonallies across denominations and preserve exact recipient consent', () => {
  const views = [];
  for (const token of ['zero', 'three', 'five']) {
    const g = offer(fixture(), token);
    views.push(viewGame(g, 'e'));
    assert.equal(viewGame(g, 'e').richeseNoField!.allyOffer, null);
    assert.equal(viewGame(g, 'a').richeseNoField!.private, null);
    assert.ok(viewGame(g, 'a').richeseNoField!.allyOffer);
    assert.equal(JSON.stringify(viewGame(g, 'a')).includes('event-a'), true);
    assert.throws(
      () =>
        send(g, 'e', {
          type: 'decision',
          accept: true,
          event: g.richeseAllyOffer!.event,
        }),
      RuleError,
    );
    const declined = send(g, 'a', {
      type: 'decision',
      decline: true,
      event: g.richeseAllyOffer!.event,
    });
    assert.equal(declined.players[1].shipped, false);
    assert.equal(declined.players[0].noField!.lastShipped, null);
    assert.equal(declined.richeseAllyOffer, null);
  }
  // Event and action logs use the same public text and positions; only private offer data differs.
  for (const v of views) {
    v.log = v.log.map((l) => ({ ...l, time: '' }));
  }
  assert.deepEqual(views[0], views[1]);
  assert.deepEqual(views[1], views[2]);
});
void test('existing own marker reveals only when shipment commits and shared last-use history cannot repeat', () => {
  let g = fixture();
  g.players[0].noField = deployRicheseNoField(g.players[0].noField!, {
    tokenId: 'three',
    controller: 'r',
    location: { territory: 'imperial_basin', sector: 10 },
  });
  assert.throws(() => offer(g, 'three'), /twice in a row/);
  g = offer(g);
  assert.ok(g.players[0].noField!.deployed);
  g = accept(g);
  assert.equal(g.players[0].forces['imperial_basin:10'], 3);
  assert.equal(g.players[0].reserves, 17);
  assert.equal(g.players[0].noField!.lastShipped, 'five');
  assert.equal(g.players[1].forces['arrakeen:10'], 5);
  conserve(g);
  g.active = 'r';
  assert.throws(
    () =>
      send(g, 'r', {
        type: 'ship',
        noField: 'five',
        event: g.players[0].noFieldEvent,
        territory: 'sietch_tabr',
        sector: 14,
      }),
    /twice in a row/,
  );
});
void test('recipient selects scarce-reserve elite mix with physical token conservation', () => {
  let g = fixture(true);
  // Swap the native seats, retaining recipient/observer IDs and the alliance.
  // Two Emperor factions would not be a legal shipment roster.
  const recipient = g.players[1];
  g.players[1] = { ...g.players[2], id: recipient.id, ally: recipient.ally };
  g.players[2] = { ...recipient, id: 'e', ally: null };
  g.players[1].reserves = 3;
  g.players[1].tanks = 17;
  g.players[1].elites = { reserves: 2, tanks: 3, forces: {}, revived: 0 };
  g = offer(g);
  const q = viewGame(g, 'a').richeseNoField!.allyOffer!;
  assert.equal(q.amount, 3);
  assert.equal(q.eliteMin, 2);
  assert.equal(q.eliteMax, 2);
  assert.throws(() => accept(g, 1), RuleError);
  g = accept(JSON.parse(JSON.stringify(g)), 2);
  assert.equal(g.players[1].reserves, 0);
  assert.equal(g.players[1].elites!.reserves, 0);
  assert.equal(g.players[1].elites!.forces['arrakeen:10'], 2);
  conserve(g);
});
void test('Karama cancellation preserves prior hidden marker and permits ordinary allied shipment', () => {
  let g = fixture();
  const k = hold(g, 'e', 'Karama');
  g.players[0].noField = deployRicheseNoField(g.players[0].noField!, {
    tokenId: 'three',
    controller: 'r',
    location: { territory: 'imperial_basin', sector: 10 },
  });
  g = accept(offer(g));
  assert.equal(g.response?.kind, 'richeseNoField');
  assert.equal(g.players[0].noField!.deployed!.tokenId, 'three');
  g = send(JSON.parse(JSON.stringify(g)), 'e', {
    type: 'card',
    mode: 'cancel',
    card: k,
  });
  assert.equal(g.players[0].noField!.deployed!.tokenId, 'three');
  assert.equal(g.players[0].spice, 10);
  assert.equal(g.players[1].shipped, false);
  assert.throws(() => offer(g), /prevented No-Field/);
  g = send(g, 'a', {
    type: 'ship',
    amount: 2,
    territory: 'arrakeen',
    sector: 10,
  });
  assert.equal(g.players[1].forces['arrakeen:10'], 2);
  conserve(g);
});
void test('Guild stopping allied shipment exposes only one marker and retains payer/token custody', () => {
  let g = fixture(true);
  g.players[2].faction = 'guild';
  const k = hold(g, 'e', 'Karama');
  g = accept(offer(g));
  g = send(g, 'e', { type: 'passResponse' });
  assert.equal(g.decision?.kind, 'guildShipment');
  assert.equal(g.decision?.kind === 'guildShipment' ? g.decision.amount : 0, 1);
  assert.equal(g.players[0].noField!.lastShipped, null);
  g = send(g, 'e', { type: 'card', mode: 'special', card: k });
  assert.equal(g.players[1].shipped, true);
  assert.equal(g.players[0].spice, 10);
  assert.equal(g.players[0].noField!.lastShipped, null);
  conserve(g);
});
void test('Guild receives actual payer spice and Heighliner triggers for the ally recipient', () => {
  let g = fixture();
  g.players[2].faction = 'guild';
  g.techTokens = {
    axlotl: { owner: 'e', spice: 0 },
    production: { owner: 'r', spice: 0 },
    heighliners: { owner: 'r', spice: 0 },
  };
  g = accept(offer(g, 'five', 'a', 'imperial_basin'));
  assert.equal(g.players[2].spice, 12);
  assert.equal(g.players[1].spice, 8);
  assert.equal(g.players[0].spice, 10);
  assert.equal(g.techTokens!.heighliners.spice, 2);
  conserve(g);
});
void test('stale acceptance and changed pending reserve allocation cannot cause payment or token replay', () => {
  let g = offer(fixture());
  assert.throws(
    () => send(g, 'a', { type: 'decision', accept: true, event: 'old-event' }),
    /no longer current/,
  );
  const k = hold(g, 'e', 'Karama');
  g = accept(g);
  g.players[1].reserves = 2;
  g.players[1].tanks = 18;
  g = send(g, 'e', { type: 'passResponse' });
  assert.equal(g.response, null);
  assert.equal(g.players[1].shipped, false);
  assert.equal(g.players[0].noField!.lastShipped, null);
  assert.equal(g.players[0].spice, 10);
  assert.ok(k);
  conserve(g);
});
void test('invalid payer, occupancy, repeated token, wrong turn and on-planet Fremen reserves reject atomically', () => {
  const g = fixture(),
    before = structuredClone(g);
  assert.throws(() => offer(g, 'five', 'e'), /ally payer/);
  assert.deepEqual(g, before);
  g.players[1].faction = 'fremen';
  assert.throws(() => offer(g), /on the planet/);
  g.players[1].faction = 'guild';
  assert.throws(() => offer(g), /awaits a ruling/);
  g.players[1].faction = 'atreides';
  g.karamaShipping = { player: 'a', owner: 'r' };
  assert.throws(() => offer(g), /awaits a ruling/);
  g.karamaShipping = null;
  g.active = 'r';
  assert.throws(() => offer(g), /ally’s unused/);
  g.active = 'a';
  g.players[0].forces = { 'arrakeen:10': 1 };
  g.players[0].reserves = 19;
  assert.throws(() => offer(g), /occupied by your ally/);
});

void test('allied two-spice shipments may split payment equally with private recipient consent', () => {
  let g = fixture();
  g.players[0].spice = 1;
  g.players[1].spice = 1;
  g = offer(g, 'five', 'both', 'imperial_basin');
  assert.equal(viewGame(g, 'a').richeseNoField!.allyOffer!.ownerPayment, 1);
  assert.equal(viewGame(g, 'a').richeseNoField!.allyOffer!.recipientPayment, 1);
  g = accept(g);
  assert.equal(g.players[0].spice, 0);
  assert.equal(g.players[1].spice, 0);
  assert.equal(g.players[1].forces['imperial_basin:10'], 5);
  conserve(g);
  assert.throws(() => offer(fixture(), 'five', 'both'), /two-spice/);
  const poor = fixture();
  poor.players[1].spice = 0;
  const offered = offer(poor, 'five', 'both', 'imperial_basin');
  assert.equal(viewGame(offered, 'r').richeseNoField!.allyOffer!.blocked, null);
  assert.ok(viewGame(offered, 'a').richeseNoField!.allyOffer!.blocked);
  assert.throws(() => accept(offered), /recipient needs/);
});

void test('unsupported simultaneous arrivals fail before consent is committed and leave decline available', () => {
  let g = fixture();
  g.players[2].faction = 'moritani';
  const bg = newPlayer('b', 'Bene Gesserit', 'beneGesserit');
  g.players.push(bg);
  g.order.push('b');
  g.moritaniTerror = createTerrorState(() => 0);
  g.moritaniTerror = placeTerror(
    g.moritaniTerror,
    g.moritaniTerror.tokens[0].id,
    'arrakeen',
    1,
  );
  hold(g, 'e', 'Karama');
  g = offer(g);
  const before = structuredClone(g);
  assert.throws(() => accept(g), /combined with another arrival/);
  assert.deepEqual(g, before);
  const automated = structuredClone(g);
  automated.players[1].bot = 'Medium';
  const declined = runBots(automated, 1);
  assert.equal(declined.richeseAllyOffer, null);
  assert.equal(declined.players[1].shipped, false);
  g = send(g, 'a', {
    type: 'decision',
    event: g.richeseAllyOffer!.event,
    decline: true,
  });
  assert.equal(g.pendingShipment, undefined);
  assert.equal(g.response, null);
  assert.equal(g.players[1].shipped, false);
  assert.equal(g.players[0].spice, 10);
});
