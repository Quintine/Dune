import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  type Action,
  type Game,
} from '../game/engine';
import { baseDeck, ixSpecialCards, spiceDeck } from '../game/cards';
import {
  createRicheseNoField,
  deployRicheseNoField,
  type NoFieldValue,
} from '../game/richese-no-field';
import { createTerrorState, placeTerror } from '../game/moritani-terror';
import { TERRITORIES } from '../game/board';

function fixture() {
  const g = createGame('NOFIELDREVIEW', newPlayer('r', 'Richese', 'richese'));
  g.players.push(newPlayer('a', 'Atreides', 'atreides'));
  g.status = 'playing';
  g.phase = 5;
  g.turn = 2;
  g.storm = 18;
  g.active = 'r';
  g.order = ['r', 'a'];
  g.movementRemaining = [...g.order];
  g.deck = baseDeck();
  for (const p of g.players) {
    p.hand = [];
    p.forces = {};
    p.reserves = 20;
    p.spice = 10;
    p.traitors = [];
    p.traitorChoices = [];
  }
  g.players[0].noField = createRicheseNoField([
    'private-zero',
    'private-three',
    'private-five',
  ]);
  g.players[0].noFieldEvent = 'fixture-event';
  return g;
}
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
const token = (g: Game, value: NoFieldValue) =>
  g.players[0].noField!.tokens.find((t) => t.value === value)!.id;
const ship = (
  g: Game,
  value: NoFieldValue = 5,
  territory = 'arrakeen',
  sector = 10,
  extra: Record<string, unknown> = {},
) =>
  applyAction(g, 'r', {
    type: 'ship',
    noField: token(g, value),
    event: g.players[0].noFieldEvent,
    territory,
    sector,
    ...extra,
  });
function marker(
  g: Game,
  value: NoFieldValue = 5,
  territory = 'arrakeen',
  sector = 10,
) {
  g.players[0].noField = deployRicheseNoField(g.players[0].noField!, {
    tokenId: token(g, value),
    controller: 'r',
    location: { territory, sector },
  });
  return g;
}
const revealAction = (g: Game): Action => ({
  type: 'revealNoField',
  token: g.players[0].noField!.deployed!.tokenId,
  event: g.players[0].noFieldEvent,
});
function reject(g: Game, actor: string, action: Action, reason?: RegExp) {
  const before = structuredClone(g);
  if (reason) assert.throws(() => applyAction(g, actor, action), reason);
  else assert.throws(() => applyAction(g, actor, action));
  assert.deepEqual(g, before, 'rejection preserves authoritative input');
}
function passAll(g: Game) {
  for (let i = 0; g.response && i < 20; i++) {
    const p = g.players.find((p) => {
      const c = viewGame(g, p.id).responseControls;
      return c && c.cancelCards.length && !c.hasPassed;
    });
    assert.ok(p, 'response has a remaining legal passer');
    g = applyAction(g, p.id, { type: 'passResponse' });
  }
  assert.equal(g.response, null);
  return g;
}

void test('No-Field payment uses one-force stronghold/sand rates and exact projected allied funding', () => {
  for (const half of [false, true])
    for (const [destination, sector, normalCost] of [
      ['arrakeen', 10, 1],
      ['imperial_basin', 10, 2],
    ] as const) {
      const g = fixture();
      g.players[1] = newPlayer('a', 'Ally', half ? 'guild' : 'atreides');
      g.players[1].hand = [];
      g.players[1].spice = 7;
      g.players[0].ally = 'a';
      g.players[1].ally = 'r';
      g.players[0].spice = 0;
      g.aid.a = { recipient: 'r', amount: 2 };
      const cost = half ? Math.ceil(normalCost / 2) : normalCost;
      const result = ship(g, 5, destination, sector, { allyPayment: cost });
      assert.equal(result.players[0].spice, 0);
      assert.equal(result.aid.a.amount, 2 - cost);
      assert.equal(result.players[0].reserves, 20);
      assert.deepEqual(result.players[0].forces, {});
      assert.equal(
        result.players[1].spice,
        7,
        'a Guild ally does not earn its own contributed payment',
      );
      reject(g, 'r', {
        type: 'ship',
        noField: token(g, 5),
        event: g.players[0].noFieldEvent,
        territory: destination,
        sector,
        allyPayment: cost + 1,
      });
    }
  const paid = fixture();
  paid.players.push(newPlayer('g', 'Guild', 'guild'));
  paid.players[2].spice = 5;
  paid.players[2].hand = [];
  paid.order.push('g');
  const result = ship(paid, 3, 'imperial_basin', 10);
  assert.equal(result.players[0].spice, 8);
  assert.equal(
    result.players[2].spice,
    7,
    'nonallied Guild receives the full payment',
  );
});

void test('pending and committed shipment views disclose identical information for zero, three and five', () => {
  const pending = [],
    committed = [];
  for (const value of [0, 3, 5] as const) {
    const g = fixture();
    g.players[1].hand = [
      g.deck.splice(
        g.deck.findIndex((c) => c.effect === 'karama'),
        1,
      )[0],
    ];
    const offered = ship(g, value);
    assert.equal(offered.response?.kind, 'richeseNoField');
    const pv = viewGame(offered, 'a');
    assert.equal(pv.richeseNoField!.private, null);
    assert.doesNotMatch(
      JSON.stringify(pv),
      /private-zero|private-three|private-five/,
    );
    pending.push(pv);
    const done = passAll(reload(offered));
    const cv = viewGame(done, 'a');
    assert.equal(cv.richeseNoField!.private, null);
    assert.doesNotMatch(
      JSON.stringify(cv),
      /private-zero|private-three|private-five/,
    );
    cv.richeseNoField!.event = 'normalized-random-event';
    committed.push(cv);
  }
  assert.deepEqual(pending[0], pending[1]);
  assert.deepEqual(pending[1], pending[2]);
  assert.deepEqual(committed[0], committed[1]);
  assert.deepEqual(committed[1], committed[2]);
});

void test('ordinary prescience rejects dial without mutation and unpublished plan values stay secret', () => {
  const views = [];
  for (const value of [0, 3, 5] as const) {
    let g = marker(fixture(), value);
    g.phase = 6;
    g.players[1].forces = { 'arrakeen:10': 2 };
    g.players[1].reserves = 18;
    g = applyAction(g, 'r', {
      type: 'chooseBattle',
      territory: 'arrakeen',
      target: 'a',
    });
    for (const id of ['r', 'a'])
      g = applyAction(g, id, { type: 'battlePreparationReady', event: g.battle!.preLeader!.event });
    reject(g, 'a', { type: 'prescience', field: 'dial' }, /No-Field/);
    g = applyAction(g, 'a', { type: 'declineBattlePower' });
    g = applyAction(g, 'r', {
      type: 'battlePlan',
      dial: value,
      leader: g.players[0].leaders[0].id,
    });
    assert.ok(g.players[0].noField!.deployed, 'sealing alone is not reveal');
    const v = viewGame(g, 'a');
    assert.equal(v.battle!.ownForces!.normal, 2);
    assert.equal(v.richeseNoField!.private, null);
    // Independent battles have fresh public IDs; compare the same public event.
    v.battle!.event = 'comparison-battle';
    v.battle!.preLeader!.event = 'comparison-battle';
    views.push(v);
  }
  assert.deepEqual(views[0], views[1]);
  assert.deepEqual(views[1], views[2]);
  let special = marker(fixture());
  special.advanced = true;
  special.phase = 6;
  special.players[1].forces = { 'arrakeen:10': 2 };
  special.players[1].hand = [
    special.deck.splice(
      special.deck.findIndex((c) => c.effect === 'karama'),
      1,
    )[0],
  ];
  special = applyAction(special, 'r', {
    type: 'chooseBattle',
    territory: 'arrakeen',
    target: 'a',
  });
  special = applyAction(special, 'a', { type: 'declineBattlePower' });
  reject(
    special,
    'a',
    {
      type: 'card',
      mode: 'special',
      card: special.players[1].hand[0].id,
      target: 'r',
    },
    /No-Field/,
  );
});

void test('storm only affects the hit sector and preserves a marker in another sector or ordinary shelter', () => {
  const t = TERRITORIES.find(
    (t) =>
      t.type === 'sand' && t.id !== 'imperial_basin' && t.sectors.length > 1,
  )!;
  const [hit, safe] = t.sectors;
  let g = marker(fixture(), 5, t.id, safe);
  g.players[0].forces = { [`${t.id}:${hit}`]: 2 };
  g.players[0].reserves = 18;
  g.phase = 0;
  g.storm = hit === 1 ? 18 : hit - 1;
  g.stormPending = 1;
  g.ready = [];
  g = applyAction(g, 'r', { type: 'ready' });
  g = applyAction(g, 'a', { type: 'ready' });
  assert.equal(g.players[0].tanks, 2);
  assert.equal(g.players[0].reserves, 18);
  assert.equal(g.players[0].noField!.deployed!.location.sector, safe);
  let sheltered = marker(fixture(), 3, 'imperial_basin', 10);
  sheltered.phase = 0;
  sheltered.storm = 9;
  sheltered.stormPending = 1;
  sheltered.ready = [];
  sheltered = applyAction(sheltered, 'r', { type: 'ready' });
  sheltered = applyAction(sheltered, 'a', { type: 'ready' });
  assert.ok(sheltered.players[0].noField!.deployed);
  assert.equal(sheltered.players[0].tanks, 0);
});

void test('a real Thumper worm reveals and devours the marker once without touching another territory', () => {
  const land = spiceDeck().filter((c) => 'territory' in c);
  const thumper = ixSpecialCards().find((c) => c.effect === 'thumper')!;
  for (const value of [0, 3, 5] as const) {
    let g = marker(fixture(), value, land[0].territory, land[0].sector);
    g.phase = 1;
    g.players[1].hand = [thumper];
    g.players[0].forces = { [`${land[1].territory}:${land[1].sector}`]: 2 };
    g.players[0].reserves = 18;
    g.spiceDiscard = [[land[0]], []];
    g.spiceDeck = land.slice(1);
    g = applyAction(g, 'a', { type: 'card', card: thumper.id });
    assert.equal(g.players[0].noField!.deployed, null);
    assert.equal(g.players[0].tanks, value);
    assert.equal(g.players[0].reserves, 18 - value);
    assert.equal(
      g.players[0].forces[`${land[1].territory}:${land[1].sector}`],
      2,
    );
    assert.equal(g.discard.filter((c) => c.id === thumper.id).length, 1);
    reject(reload(g), 'a', { type: 'card', card: thumper.id });
  }
});

void test('voluntary reveal is available in phases zero through five and rejects later or stale reuse events', () => {
  for (let phase = 0; phase <= 8; phase++) {
    const g = marker(fixture(), 3);
    g.phase = phase;
    if (phase < 6) {
      const result = applyAction(g, 'r', revealAction(g));
      assert.equal(result.players[0].reserves, 17);
      assert.equal(result.players[0].noField!.deployed, null);
    } else reject(g, 'r', revealAction(g), /before the Battle/);
  }
  let g = marker(fixture(), 3);
  const stale = revealAction(g);
  g = applyAction(g, 'r', stale);
  g.players[0].shipped = false;
  g = ship(g, 5);
  g = applyAction(g, 'r', revealAction(g));
  g.players[0].shipped = false;
  g = ship(g, 3);
  assert.equal(g.players[0].noField!.deployed!.tokenId, stale.token);
  reject(reload(g), 'r', stale, /stale/);
});

void test('simultaneous entry reactions fail atomically and stale CHOAM continuation cannot move a later marker', () => {
  const g = fixture();
  g.players.push(
    newPlayer('m', 'Moritani', 'moritani'),
    newPlayer('b', 'Bene Gesserit', 'beneGesserit'),
  );
  g.order.push('m', 'b');
  g.moritaniTerror = createTerrorState(() => 0);
  g.moritaniTerror = placeTerror(
    g.moritaniTerror,
    g.moritaniTerror.tokens[0].id,
    'arrakeen',
    1,
  );
  reject(
    g,
    'r',
    {
      type: 'ship',
      noField: token(g, 5),
      event: g.players[0].noFieldEvent,
      territory: 'arrakeen',
      sector: 10,
    },
    /Terror combined/,
  );
  let moving = marker(fixture(), 3, 'imperial_basin', 10);
  moving.players[1] = newPlayer('a', 'CHOAM', 'choam');
  moving.players[1].forces = { 'arrakeen:10': 1 };
  moving = applyAction(moving, 'r', {
    type: 'move',
    forces: {},
    noField: token(moving, 3),
    event: moving.players[0].noFieldEvent,
    territory: 'arrakeen',
    sector: 10,
  });
  assert.equal(moving.decision?.kind, 'choamMovement');
  assert.equal(
    moving.players[0].noField!.deployed!.location.territory,
    'imperial_basin',
  );
  moving = reload(moving);
  moving.players[0].noFieldEvent = 'later-inventory-event';
  const result = applyAction(moving, 'a', { type: 'decision', decline: true });
  assert.equal(result.pendingChoamMove, null);
  assert.equal(result.decision, null);
  assert.equal(
    result.players[0].noField!.deployed!.location.territory,
    'imperial_basin',
  );
  assert.equal(result.players[0].moved, 0);
  assert.equal(result.players[0].reserves, 20);
});

void test('synthetic saved inventory validates custody and preserves public/owner projection boundaries', () => {
  const g = reload(marker(fixture(), 0));
  assert.equal(
    viewGame(g, 'r').richeseNoField!.private!.deployed!.tokenId,
    token(g, 0),
  );
  assert.equal(viewGame(g, 'a').richeseNoField!.private, null);
  const corrupt = reload(g);
  corrupt.players[0].noField!.tokens[1].id =
    corrupt.players[0].noField!.tokens[0].id;
  const before = structuredClone(corrupt);
  assert.throws(() => viewGame(corrupt, 'a'));
  reject(corrupt, 'r', revealAction(corrupt));
  assert.deepEqual(corrupt, before);
  const absent = fixture();
  delete absent.players[0].noField;
  assert.equal(viewGame(absent, 'r').richeseNoField, null);
  reject(
    absent,
    'r',
    {
      type: 'ship',
      noField: 'private-five',
      event: 'fixture-event',
      territory: 'arrakeen',
      sector: 10,
    },
    /not initialized/,
  );
});
