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
import { baseDeck } from '../game/cards';
import {
  createTerrorState,
  placeTerror,
  type TerrorKind,
} from '../game/moritani-terror';
import { type FactionId } from '../game/catalog';

const player = (g: Game, id: string) =>
  g.players.find((candidate) => candidate.id === id)!;
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
const decide = (g: Game, extra: Omit<Action, 'type'>) =>
  applyAction(g, 'm', { type: 'decision', ...extra });
const shipment: Action = {
  type: 'ship',
  territory: 'arrakeen',
  sector: 10,
  amount: 2,
};
function fixture(kind: TerrorKind = 'robbery', entrant: FactionId = 'emperor') {
  const g = createGame('TERROR01', newPlayer('m', 'Moritani', 'moritani'));
  g.players.push(
    newPlayer('e', 'Entrant', entrant),
    newPlayer('a', 'Atreides', 'atreides'),
  );
  g.status = 'playing';
  g.phase = 5;
  g.turn = 2;
  g.storm = 18;
  g.active = 'e';
  g.order = ['e', 'm', 'a'];
  g.movementRemaining = [...g.order];
  g.deck = baseDeck();
  for (const p of g.players) {
    p.forces = {};
    p.reserves = 20;
    p.spice = 20;
    p.hand = [];
  }
  g.moritaniTerror = createTerrorState(() => 0);
  const token = g.moritaniTerror.tokens.find(
    (candidate) => candidate.kind === kind,
  )!;
  g.moritaniTerror = placeTerror(g.moritaniTerror, token.id, 'arrakeen', 1);
  return g;
}
function rejected(g: Game, id: string, action: Action, pattern?: RegExp) {
  const before = structuredClone(g);
  if (pattern) assert.throws(() => applyAction(g, id, action), pattern);
  else assert.throws(() => applyAction(g, id, action));
  assert.deepEqual(g, before);
}
function hold(g: Game, id: string, count: number) {
  player(g, id).hand.push(...g.deck.splice(0, count));
}
const enter = (g = fixture()) => applyAction(g, 'e', shipment);

void test('shipment opens a private Terror choice after settlement and decline survives reload without replay', () => {
  const initial = fixture();
  const g = enter(initial);
  assert.deepEqual(g.decision, {
    kind: 'moritaniTerror',
    player: 'm',
    entrant: 'e',
    territory: 'arrakeen',
  });
  assert.equal(g.pendingTerrorEntry?.stage, 'offer');
  assert.equal(g.pendingTerrorEntry?.cause, 'shipment');
  assert.equal(player(g, 'e').spice, 18);
  assert.equal(player(g, 'e').reserves, 18);
  assert.equal(player(g, 'e').forces['arrakeen:10'], 2);
  assert.equal(player(g, 'e').shipped, true);
  assert.equal(player(initial, 'e').spice, 20);
  const privateEntry = viewGame(g, 'm').terrorEntry!;
  const publicEntry = viewGame(g, 'e').terrorEntry!;
  assert.equal(privateEntry.kind, 'robbery');
  assert.equal(privateEntry.canReveal, true);
  assert.equal('kind' in publicEntry, false);
  assert.equal('canReveal' in publicEntry, false);
  assert.equal('pendingTerrorEntry' in viewGame(g, 'e'), false);
  rejected(g, 'e', { type: 'decision', decline: true });
  rejected(g, 'e', { type: 'endMovement' });
  const declined = decide(reload(g), { decline: true });
  assert.equal(declined.decision, null);
  assert.equal(declined.pendingTerrorEntry, null);
  assert.deepEqual(declined.players, g.players);
  assert.deepEqual(declined.moritaniTerror, g.moritaniTerror);
  assert.equal(
    'kind' in viewGame(declined, 'e').moritaniTerror!.tokens[0],
    false,
  );
  rejected(declined, 'm', { type: 'decision', decline: true });
  rejected(declined, 'e', shipment);
});

void test('unsupported hidden faces can be declined but cannot be revealed or leaked', () => {
  for (const kind of ['atomics', 'extortion'] as const) {
    const g = enter(fixture(kind));
    assert.equal(viewGame(g, 'm').terrorEntry!.canReveal, false);
    assert.equal('kind' in viewGame(g, 'e').terrorEntry!, false);
    rejected(g, 'm', { type: 'decision', reveal: true });
    const done = decide(g, { decline: true });
    assert.equal(done.decision, null);
    assert.equal(
      done.moritaniTerror!.tokens.find((token) => token.kind === kind)!.status,
      'placed',
    );
  }
});

void test('Moritani and its ally do not trigger Terror when shipping', () => {
  const allied = fixture();
  player(allied, 'm').ally = 'e';
  player(allied, 'e').ally = 'm';
  const allyEntry = enter(allied);
  assert.equal(allyEntry.pendingTerrorEntry ?? null, null);
  assert.equal(allyEntry.decision, null);
  const own = fixture();
  own.active = 'm';
  const ownEntry = applyAction(own, 'm', shipment);
  assert.equal(ownEntry.pendingTerrorEntry ?? null, null);
  assert.equal(ownEntry.decision, null);
});

void test('Robbery transfers half the entrant spice rounded up exactly once after reload', () => {
  const initial = fixture();
  player(initial, 'e').spice = 13;
  const offered = enter(initial);
  const revealed = decide(offered, { reveal: true });
  assert.equal(revealed.pendingTerrorEntry?.stage, 'robbery');
  const token = revealed.moritaniTerror!.tokens.find(
    (candidate) => candidate.kind === 'robbery',
  )!;
  assert.equal(token.status, 'removed');
  assert.equal(token.location, null);
  const publicToken = viewGame(revealed, 'a').moritaniTerror!.tokens.find(
    (candidate) => candidate.id === token.id,
  )!;
  assert.ok('kind' in publicToken);
  assert.equal(publicToken.kind, 'robbery');
  rejected(revealed, 'm', { type: 'decision', reveal: true });
  const done = decide(reload(revealed), { choice: 'spice' });
  assert.equal(player(done, 'e').spice, 5);
  assert.equal(player(done, 'm').spice, 26);
  assert.equal(done.pendingTerrorEntry, null);
  assert.equal(done.decision, null);
  rejected(done, 'm', { type: 'decision', choice: 'spice' });
});

void test('Robbery permits a full hand to draw before requiring a chosen private discard', () => {
  const initial = fixture();
  hold(initial, 'm', 4);
  const top = initial.deck[0];
  const original = player(initial, 'm').hand[1];
  let g = decide(enter(initial), { reveal: true });
  g = decide(g, { choice: 'card' });
  assert.equal(player(g, 'm').hand.length, 5);
  assert.ok(player(g, 'm').hand.some((card) => card.id === top.id));
  assert.equal(g.pendingTerrorEntry?.stage, 'discard');
  assert.equal(g.deck.length, initial.deck.length - 1);
  assert.equal(
    'hand' in viewGame(g, 'e').players.find((p) => p.id === 'm')!,
    false,
  );
  rejected(g, 'm', { type: 'decision', card: 'not-held' });
  const done = decide(reload(g), { card: original.id });
  assert.equal(player(done, 'm').hand.length, 4);
  assert.ok(player(done, 'm').hand.some((card) => card.id === top.id));
  assert.equal(
    done.discard.filter((card) => card.id === original.id).length,
    1,
  );
  assert.equal(done.pendingTerrorEntry, null);
  rejected(done, 'm', { type: 'decision', card: original.id });
});

void test('Robbery with an empty deck finishes without inventing cards or replaying the choice', () => {
  const initial = fixture();
  initial.deck = [];
  const g = decide(enter(initial), { reveal: true });
  const done = decide(g, { choice: 'card' });
  assert.equal(done.pendingTerrorEntry, null);
  assert.equal(player(done, 'm').spice, 20);
  assert.equal(player(done, 'm').hand.length, 0);
  assert.equal(done.deck.length, 0);
  rejected(done, 'm', { type: 'decision', choice: 'spice' });
});

void test('Sabotage discards a victim card once, conceals it from opponents and allows an optional gift', () => {
  const initial = fixture('sabotage');
  hold(initial, 'e', 3);
  hold(initial, 'm', 2);
  const originalIds = player(initial, 'e').hand.map((card) => card.id);
  const gift = player(initial, 'm').hand[0];
  const g = decide(enter(initial), { reveal: true });
  assert.equal(g.pendingTerrorEntry?.stage, 'gift');
  assert.equal(player(g, 'e').hand.length, 2);
  assert.equal(g.discard.length, 1);
  assert.ok(originalIds.includes(g.discard[0].id));
  assert.equal(player(g, 'm').hand.length, 2);
  const publicView = viewGame(g, 'a');
  assert.equal('discard' in publicView, false);
  assert.equal(JSON.stringify(publicView).includes(g.discard[0].id), false);
  const restored = reload(g);
  assert.deepEqual(restored.discard, g.discard);
  rejected(restored, 'm', { type: 'decision', reveal: true });
  const done = decide(restored, { card: gift.id });
  assert.equal(player(done, 'e').hand.length, 3);
  assert.equal(player(done, 'm').hand.length, 1);
  assert.ok(player(done, 'e').hand.some((card) => card.id === gift.id));
  assert.deepEqual(done.discard, g.discard);
  assert.equal(done.pendingTerrorEntry, null);
  rejected(done, 'm', { type: 'decision', card: gift.id });
});

void test('Sabotage with empty hands finishes or permits passing the gift without inventing cards', () => {
  const empty = decide(enter(fixture('sabotage')), { reveal: true });
  assert.equal(empty.pendingTerrorEntry, null);
  assert.equal(empty.decision, null);
  assert.equal(empty.discard.length, 0);
  const initial = fixture('sabotage');
  hold(initial, 'm', 1);
  const revealed = decide(enter(initial), { reveal: true });
  assert.equal(revealed.pendingTerrorEntry?.stage, 'gift');
  assert.equal(revealed.discard.length, 0);
  const done = decide(reload(revealed), { decline: true });
  assert.equal(player(done, 'm').hand.length, 1);
  assert.equal(player(done, 'e').hand.length, 0);
  assert.equal(done.pendingTerrorEntry, null);
});

void test('normal movement triggers after moving forces once, while an internal sector move does not enter a territory', () => {
  const initial = fixture();
  player(initial, 'e').forces = { 'imperial_basin:10': 3 };
  player(initial, 'e').reserves = 17;
  const action: Action = {
    type: 'move',
    from: 'imperial_basin:10',
    territory: 'arrakeen',
    sector: 10,
    amount: 2,
  };
  const entered = applyAction(initial, 'e', action);
  assert.equal(entered.pendingTerrorEntry?.cause, 'movement');
  assert.equal(player(entered, 'e').forces['imperial_basin:10'], 1);
  assert.equal(player(entered, 'e').forces['arrakeen:10'], 2);
  assert.equal(player(entered, 'e').moved, 1);
  const done = decide(reload(entered), { decline: true });
  assert.deepEqual(done.players, entered.players);
  rejected(done, 'e', action);
  // Ordinary strongholds each have one sector. This injected historical location exercises
  // the general same-territory guard independently of present placement restrictions.
  const internal = fixture();
  internal.moritaniTerror!.tokens.find(
    (token) => token.status === 'placed',
  )!.location = 'imperial_basin';
  player(internal, 'e').forces = { 'imperial_basin:10': 3 };
  player(internal, 'e').reserves = 17;
  const shifted = applyAction(internal, 'e', {
    ...action,
    territory: 'imperial_basin',
    sector: 11,
  });
  assert.equal(shifted.pendingTerrorEntry ?? null, null);
  assert.equal(shifted.decision, null);
  assert.equal(player(shifted, 'e').forces['imperial_basin:11'], 2);
});

void test('overlapping Guild income and Bene Gesserit arrival reactions reject the entire shipment atomically', () => {
  for (const faction of ['guild', 'beneGesserit'] as const) {
    const initial = fixture();
    initial.players.push(newPlayer('x', 'Arrival reaction', faction));
    initial.order.push('x');
    rejected(
      initial,
      'e',
      shipment,
      /Terror combined with another arrival reaction/,
    );
  }
  const intrusion = fixture();
  intrusion.advanced = true;
  const bg = newPlayer('b', 'Bene Gesserit', 'beneGesserit');
  bg.forces = { 'arrakeen:10': 1 };
  bg.reserves = 0;
  intrusion.players.push(bg);
  intrusion.order.push('b');
  rejected(
    intrusion,
    'e',
    shipment,
    /Terror combined with another arrival reaction/,
  );
});

void test('Guild cross-shipment settles once and returning forces to reserves has no entry trigger', () => {
  const initial = fixture('robbery', 'guild');
  player(initial, 'e').forces = { 'carthag:11': 3 };
  player(initial, 'e').reserves = 17;
  const action: Action = {
    type: 'guildShip',
    from: 'carthag:11',
    territory: 'arrakeen',
    sector: 10,
    amount: 2,
  };
  const entered = applyAction(initial, 'e', action);
  assert.equal(entered.pendingTerrorEntry?.cause, 'guildTransport');
  assert.equal(player(entered, 'e').spice, 19);
  assert.equal(player(entered, 'e').forces['carthag:11'], 1);
  assert.equal(player(entered, 'e').forces['arrakeen:10'], 2);
  const done = decide(reload(entered), { decline: true });
  assert.deepEqual(done.players, entered.players);
  rejected(done, 'e', action);
  const reserves = applyAction(initial, 'e', {
    ...action,
    territory: 'reserves',
    sector: 0,
  });
  assert.equal(reserves.pendingTerrorEntry ?? null, null);
  assert.equal(reserves.decision, null);
  assert.equal(player(reserves, 'e').reserves, 19);
});

void test('Bene Gesserit accompanied advisor arrival triggers Terror without changing it into a fighter', () => {
  let g = fixture('sabotage', 'beneGesserit');
  g.advanced = true;
  player(g, 'a').forces = { 'arrakeen:10': 1 };
  player(g, 'a').reserves = 19;
  g.decision = {
    kind: 'advisor',
    player: 'e',
    shipment: 'a',
    destination: 'arrakeen:10',
  };
  g = applyAction(g, 'e', { type: 'decision', accept: true, accompany: true });
  assert.equal(
    g.response,
    null,
    'unopposed advisorship settles before the Terror offer',
  );
  assert.equal(g.response, null);
  assert.equal(g.pendingTerrorEntry?.cause, 'advisor');
  assert.equal(g.pendingTerrorEntry?.entrant, 'e');
  assert.equal(player(g, 'e').forces['arrakeen:10'], 1);
  assert.equal(player(g, 'e').reserves, 19);
  assert.ok(player(g, 'e').advisors?.arrakeen);
  assert.equal(player(g, 'e').spice, 20);
  const done = decide(reload(g), { decline: true });
  assert.deepEqual(done.players, g.players);
});

void test('worm entry pauses the remaining ride queue until Terror resolves, then resumes once after reload', () => {
  let g = fixture('robbery', 'fremen');
  g.phase = 1;
  g.active = null;
  player(g, 'e').forces = { 'imperial_basin:10': 3, 'hagga_basin:11': 1 };
  player(g, 'e').reserves = 16;
  g.decision = { kind: 'wormRide', player: 'e', territory: 'imperial_basin' };
  g.wormRides = ['hagga_basin'];
  const ride: Action = {
    type: 'decision',
    accept: true,
    territory: 'arrakeen',
    sector: 10,
    forces: { 'imperial_basin:10': 2 },
  };
  g = applyAction(g, 'e', ride);
  assert.equal(g.pendingTerrorEntry?.cause, 'wormRide');
  assert.equal(g.pendingTerrorEntry?.resume, 'wormRide');
  assert.deepEqual(g.wormRides, ['hagga_basin']);
  assert.equal(player(g, 'e').forces['arrakeen:10'], 2);
  assert.equal(player(g, 'e').forces['imperial_basin:10'], 1);
  rejected(g, 'e', ride);
  const done = decide(reload(g), { decline: true });
  assert.equal(done.pendingTerrorEntry, null);
  assert.deepEqual(done.decision, {
    kind: 'wormRide',
    player: 'e',
    territory: 'hagga_basin',
  });
  assert.deepEqual(done.wormRides, []);
  assert.deepEqual(done.players, g.players);
  rejected(done, 'm', { type: 'decision', decline: true });
});

void test('Sabotage refuses exceptional recipient overflow but leaves a safe optional pass', () => {
  const initial = fixture('sabotage');
  hold(initial, 'm', 1);
  const offered = decide(enter(initial), { reveal: true });
  // A persisted exceptional hand state must not turn the optional gift into an overflow bypass.
  hold(offered, 'e', 4);
  rejected(
    offered,
    'm',
    { type: 'decision', card: player(offered, 'm').hand[0].id },
    /overflow/,
  );
  const passed = decide(offered, { decline: true });
  assert.equal(player(passed, 'e').hand.length, 4);
  assert.equal(player(passed, 'm').hand.length, 1);
  assert.equal(passed.pendingTerrorEntry, null);
});

void test('stale Terror turn or phase metadata cannot settle a persisted decision', () => {
  const offered = enter();
  for (const signed of [true, false])
    for (const field of ['turn', 'phase'] as const) {
      const stale = reload(offered);
      if (!signed) delete stale.pendingTerrorEntry!.entrySignature;
      stale.pendingTerrorEntry![field]--;
      const reason = signed
        ? /original public arrival receipt/
        : /no longer current/;
      rejected(stale, 'm', { type: 'decision', decline: true }, reason);
      rejected(stale, 'm', { type: 'decision', reveal: true }, reason);
    }
});

void test('resolved Truthtrance can satisfy Robbery overflow without leaving a stale forced discard', () => {
  const initial = fixture();
  const index = initial.deck.findIndex((card) => card.effect === 'truthtrance');
  const truth = initial.deck.splice(index, 1)[0];
  assert.ok(truth);
  player(initial, 'm').hand.push(truth);
  hold(initial, 'm', 3);
  let g = decide(decide(enter(initial), { reveal: true }), { choice: 'card' });
  assert.equal(player(g, 'm').hand.length, 5);
  assert.equal(g.pendingTerrorEntry?.stage, 'discard');
  g = applyAction(g, 'm', { type: 'card', card: truth.id });
  while (g.truthtrance?.stage === 'priority') {
    const id = g.players.find(
      (candidate) => !g.truthtrance!.passed.includes(candidate.id),
    )!.id;
    g = applyAction(g, id, { type: 'truthPass' });
  }
  g = applyAction(g, 'm', {
    type: 'truthAsk',
    question: {
      kind: 'fact',
      target: 'e',
      fact: { kind: 'hand', name: 'Shield' },
    },
  });
  g = applyAction(reload(g), 'e', { type: 'truthAnswer', answer: 'no' });
  assert.equal(g.truthtrance, null);
  assert.equal(player(g, 'm').hand.length, 4);
  assert.equal(g.discard.filter((card) => card.id === truth.id).length, 1);
  assert.equal(g.pendingTerrorEntry, null);
  assert.equal(g.decision, null);
  rejected(g, 'm', { type: 'decision', card: player(g, 'm').hand[0].id });
});

void test('changing a hidden face leaves the entrant projection unchanged before revelation', () => {
  const initial = fixture();
  const alternative = structuredClone(initial);
  const robbery = alternative.moritaniTerror!.tokens.find(
    (token) => token.kind === 'robbery',
  )!;
  const sabotage = alternative.moritaniTerror!.tokens.find(
    (token) => token.kind === 'sabotage',
  )!;
  [robbery.kind, sabotage.kind] = [sabotage.kind, robbery.kind];
  const first = enter(initial);
  const second = enter(alternative);
  assert.deepEqual(viewGame(first, 'e'), viewGame(second, 'e'));
  assert.deepEqual(viewGame(first, 'a'), viewGame(second, 'a'));
  assert.notEqual(
    viewGame(first, 'm').terrorEntry!.kind,
    viewGame(second, 'm').terrorEntry!.kind,
  );
});

void test('advanced shipment preserves elite custody through the Terror response and reload', () => {
  const initial = fixture();
  initial.advanced = true;
  player(initial, 'e').elites = {
    reserves: 5,
    tanks: 0,
    forces: {},
    revived: 0,
  };
  const entered = applyAction(initial, 'e', { ...shipment, elite: 1 });
  assert.equal(entered.pendingTerrorEntry?.amount, 2);
  assert.equal(entered.pendingTerrorEntry?.elite, 1);
  assert.equal(player(entered, 'e').elites!.reserves, 4);
  assert.equal(player(entered, 'e').elites!.forces['arrakeen:10'], 1);
  assert.equal(player(entered, 'e').reserves, 18);
  const done = decide(reload(entered), { decline: true });
  assert.deepEqual(done.players, entered.players);
  assert.equal(player(done, 'e').spice, 18);
});
