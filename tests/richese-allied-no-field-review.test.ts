import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  newPlayer,
  applyAction,
  viewGame,
  type Game,
  type Action,
} from '../game/engine';
import {
  createRicheseNoField,
  deployRicheseNoField,
} from '../game/richese-no-field';
import { baseDeck } from '../game/cards';
import { createTerrorState, placeTerror } from '../game/moritani-terror';
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
void test('a prior zero marker can share the new allied destination without creating phantom allied occupancy', () => {
  let g = fixture();
  g.players[0].noField = deployRicheseNoField(g.players[0].noField!, {
    tokenId: 'zero',
    controller: 'r',
    location: { territory: 'arrakeen', sector: 10 },
  });
  g.players[2].forces = { 'arrakeen:10': 1 };
  g.players[2].reserves = 19;
  g = offer(g, 'three');
  assert.ok(g.players[0].noField!.deployed);
  g = accept(g);
  assert.deepEqual(g.players[0].forces, {});
  assert.equal(g.players[0].reserves, 20);
  assert.equal(g.players[1].forces['arrakeen:10'], 3);
  assert.equal(g.players[0].noField!.deployed, null);
  assert.equal(g.players[0].noField!.lastShipped, 'three');
  conserve(g);
});
void test('a zero allied shipment triggers Terror after payment while physical reserve and casualty counts remain zero', () => {
  let g = fixture();
  g.players[2] = newPlayer('e', 'Moritani', 'moritani');
  g.players[2].spice = 10;
  g.moritaniTerror = createTerrorState(() => 0);
  const token = g.moritaniTerror.tokens.find((t) => t.kind === 'robbery')!;
  g.moritaniTerror = placeTerror(g.moritaniTerror, token.id, 'arrakeen', 1);
  g = accept(offer(g, 'zero', 'a'));
  assert.equal(g.decision?.kind, 'moritaniTerror');
  assert.equal(g.pendingTerrorEntry?.entrant, 'a');
  assert.equal(g.players[1].spice, 9);
  assert.equal(g.players[1].reserves, 20);
  assert.deepEqual(g.players[1].forces, {});
  assert.equal(g.players[1].shipped, true);
  g = send(JSON.parse(JSON.stringify(g)), 'e', {
    type: 'decision',
    reveal: true,
  });
  assert.equal(g.pendingTerrorEntry?.stage, 'robbery');
  g = send(g, 'e', { type: 'decision', choice: 'spice' });
  assert.equal(g.pendingTerrorEntry, null);
  assert.equal(g.players[1].spice, 4);
  assert.equal(g.players[2].spice, 15);
  assert.equal(g.players[0].spice, 10);
  conserve(g);
  assert.throws(() => accept(g));
});
void test('Guild sees one declared marker for every secret denomination, including after the No-Field response has passed', () => {
  const publicViews = [];
  for (const value of ['zero', 'three', 'five']) {
    let g = fixture(true);
    g.players[2].faction = 'guild';
    hold(g, 'e', 'Karama');
    g = accept(offer(g, value));
    const responseView = viewGame(g, 'e');
    assert.equal(responseView.richeseNoField!.allyOffer, null);
    assert.equal('pendingShipment' in responseView, false);
    assert.equal(responseView.response?.kind, 'richeseNoField');
    g = send(g, 'e', { type: 'passResponse' });
    const v = viewGame(g, 'e');
    assert.equal(v.decision?.kind, 'guildShipment');
    assert.equal(
      v.decision?.kind === 'guildShipment' ? v.decision.amount : null,
      1,
    );
    assert.equal(v.richeseNoField!.private, null);
    assert.equal(v.richeseNoField!.allyOffer, null);
    assert.equal(g.players[0].spice, 10);
    assert.equal(g.players[1].reserves, 20);
    assert.equal(g.players[0].noField!.lastShipped, null);
    v.log = v.log.map((l) => ({ ...l, time: '' }));
    publicViews.push(v);
  }
  assert.deepEqual(publicViews[0], publicViews[1]);
  assert.deepEqual(publicViews[1], publicViews[2]);
});
void test('stale offer remains declineable and a stopped pending declaration cannot reveal a prior marker or charge its payer', () => {
  let g = fixture();
  g.players[0].noField = deployRicheseNoField(g.players[0].noField!, {
    tokenId: 'three',
    controller: 'r',
    location: { territory: 'imperial_basin', sector: 10 },
  });
  g = offer(g);
  const event = g.richeseAllyOffer!.event;
  g.players[0].noFieldEvent = 'changed-token-event';
  const view = viewGame(g, 'a');
  assert.match(view.richeseNoField!.allyOffer!.blocked!, /stale/i);
  const old = structuredClone(g);
  assert.throws(() => accept(g), /stale/i);
  assert.deepEqual(g, old);
  g = send(g, 'a', { type: 'decision', event, decline: true });
  assert.equal(g.decision, null);
  assert.deepEqual(g.players[0].noField, old.players[0].noField);
  assert.equal(g.players[0].spice, 10);
  let stopped = fixture(true);
  stopped.players[2].faction = 'guild';
  hold(stopped, 'e', 'Karama');
  stopped.players[0].noField = old.players[0].noField;
  stopped = accept(offer(stopped));
  stopped = send(stopped, 'e', { type: 'passResponse' });
  assert.equal(stopped.decision?.kind, 'guildShipment');
  stopped.players[1].reserves = 2;
  stopped.players[1].tanks = 18;
  const marker = structuredClone(stopped.players[0].noField);
  stopped = send(JSON.parse(JSON.stringify(stopped)), 'e', {
    type: 'decision',
    allow: true,
  });
  assert.equal(stopped.pendingShipment, null);
  assert.equal(stopped.decision, null);
  assert.equal(stopped.players[1].shipped, false);
  assert.equal(stopped.players[0].spice, 10);
  assert.deepEqual(stopped.players[0].noField, marker);
  assert.deepEqual(stopped.players[1].forces, {});
  conserve(stopped);
});
void test('Heighliner accrual belongs to its owner at phase end and the Guild receives the exact single-payer cost', () => {
  for (const payer of ['r', 'a']) {
    let g = fixture();
    g.players[2].faction = 'guild';
    g.techTokens = {
      axlotl: { owner: 'e', spice: 0 },
      production: { owner: 'r', spice: 0 },
      heighliners: { owner: 'r', spice: 0 },
    };
    g = accept(offer(g, 'zero', payer, 'imperial_basin'));
    assert.equal(g.players[2].spice, 12);
    assert.equal(g.players.find((p) => p.id === payer)!.spice, 8);
    assert.equal(
      g.players.find((p) => p.id === (payer === 'r' ? 'a' : 'r'))!.spice,
      10,
    );
    assert.equal(g.techTokens!.heighliners.spice, 2);
    assert.equal(g.techTokens!.heighliners.triggeredTurn, 2);
    conserve(g);
  }
});
void test('a changed elite allocation aborts commitment without consuming either subtype or a No-Field token', () => {
  let g = fixture(true);
  // Swap the native seats, retaining recipient/observer IDs and the alliance.
  // Two Emperor factions would not be a legal shipment roster.
  const recipient = g.players[1];
  g.players[1] = { ...g.players[2], id: recipient.id, ally: recipient.ally };
  g.players[2] = { ...recipient, id: 'e', ally: null };
  g.players[1].reserves = 3;
  g.players[1].tanks = 17;
  g.players[1].elites = { reserves: 2, tanks: 3, forces: {}, revived: 0 };
  hold(g, 'e', 'Karama');
  g = accept(offer(g), 2);
  assert.equal(g.response?.kind, 'richeseNoField');
  g.players[1].elites!.reserves = 1;
  g.players[1].elites!.tanks = 4;
  g = send(g, 'e', { type: 'passResponse' });
  assert.equal(g.players[1].reserves, 3);
  assert.equal(g.players[1].elites!.reserves, 1);
  assert.equal(g.players[0].noField!.lastShipped, null);
  assert.equal(g.players[0].spice, 10);
  assert.equal(g.players[1].shipped, false);
  conserve(g);
});
void test('offering recipient-funded shipment and viewing its terms do not reveal whether the ally can afford it', () => {
  const ownerTerms = [];
  const outsiderViews = [];
  for (const balance of [0, 10]) {
    let g = fixture();
    g.players[1].spice = balance;
    g = offer(g, 'five', 'a');
    const owner = viewGame(g, 'r'),
      recipient = viewGame(g, 'a'),
      outsider = viewGame(g, 'e');
    assert.equal(owner.richeseNoField!.allyOffer!.blocked, null);
    ownerTerms.push(owner.richeseNoField!.allyOffer);
    outsider.log = outsider.log.map((l) => ({ ...l, time: '' }));
    outsiderViews.push(outsider);
    if (balance === 0) {
      assert.match(
        recipient.richeseNoField!.allyOffer!.blocked!,
        /uncommitted spice/,
      );
      const before = structuredClone(g);
      assert.throws(() => accept(g), /uncommitted spice/);
      assert.deepEqual(g, before);
    } else assert.equal(recipient.richeseNoField!.allyOffer!.blocked, null);
  }
  // The random offer event proves exact consent, not denomination or balance.
  assert.deepEqual(
    { ...ownerTerms[0], event: '' },
    { ...ownerTerms[1], event: '' },
  );
  assert.deepEqual(outsiderViews[0], outsiderViews[1]);
});
