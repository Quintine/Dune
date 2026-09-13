import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyAction,
  normalizeAutomaticGame,
  viewGame,
  type Action,
  type Game,
} from '../game/engine';
import {
  addArrivalAmbassador,
  addArrivalTerror,
  arrivalArmy,
  arrivalMove,
  arrivalPlayer,
  arrivalReload,
  arrivalResources,
  holdArrivalCard,
  movementArrivalGame,
  nativeArrivalSource,
} from './deferred-movement-arrival-fixture';

function reject(g: Game, player: string, action: Action, pattern?: RegExp) {
  const before = structuredClone(g);
  if (pattern) assert.throws(() => applyAction(g, player, action), pattern);
  else assert.throws(() => applyAction(g, player, action));
  assert.deepEqual(g, before);
}
const overlap = /Ambassadors combined with another arrival reaction/;

void test('the reproduced Tleilaxu arrival and native Ix/Fremen movement declarations reject known unsupported overlap before prevention windows or RNG', (t) => {
  const games = ['tleilaxu', 'ixians', 'fremen'].map((faction) => {
    const g = movementArrivalGame(faction as 'tleilaxu' | 'ixians' | 'fremen');
    if (faction !== 'tleilaxu') nativeArrivalSource(g);
    if (faction === 'fremen') addArrivalAmbassador(g, 'atreides');
    holdArrivalCard(g, 'choam', 'Karama');
    return g;
  });
  const random = t.mock.method(crypto, 'getRandomValues', () => {
    throw Error('Unsupported arrival sampled RNG');
  });
  const uuid = t.mock.method(crypto, 'randomUUID', () => {
    throw Error('Unsupported arrival allocated an event');
  });
  for (const g of games) {
    reject(g, g.active!, arrivalMove(g), overlap);
    assert.equal(g.pendingChoamMove, undefined);
    assert.equal(g.pendingIxMove, undefined);
    assert.equal(g.pendingFremenMove, undefined);
    assert.equal(g.response, null);
    assert.equal(g.decision, null);
  }
  assert.equal(random.mock.callCount(), 0);
  assert.equal(uuid.mock.callCount(), 0);
});

void test('known unsupported entry rejects before putting a newly played Ornithopter into escrow or creating its event', (t) => {
  const g = movementArrivalGame(),
    card = holdArrivalCard(g, 'tleilaxu', 'Ornithopter');
  const uuid = t.mock.method(crypto, 'randomUUID', () => {
    throw Error('Movement card allocated an event');
  });
  reject(
    g,
    'tleilaxu',
    { ...arrivalMove(g), movementCard: card, ornithopter: 'range3' },
    overlap,
  );
  assert.ok(arrivalPlayer(g, 'tleilaxu').hand.some((c) => c.id === card));
  assert.equal(g.ornithopter, undefined);
  assert.equal(uuid.mock.callCount(), 0);
});

for (const tokens of ['ambassador', 'terror'] as const)
  for (const cancellation of [false, true])
    void test(`${tokens}-only entry stays legal through CHOAM ${cancellation ? 'Baliset cancellation' : 'decline'} and commits once`, () => {
      let g = movementArrivalGame('tleilaxu', tokens);
      const baliset = holdArrivalCard(g, 'choam', 'Baliset'),
        karama = holdArrivalCard(g, 'tleilaxu', 'Karama');
      g = applyAction(g, 'tleilaxu', arrivalMove(g));
      assert.equal(g.decision?.kind, 'choamMovement');
      assert.equal(arrivalPlayer(g, 'tleilaxu').moved, 0);
      if (cancellation) {
        g = applyAction(g, 'choam', {
          type: 'card',
          card: baliset,
          mode: 'choam',
          target: 'tleilaxu',
          territory: 'carthag',
        });
        assert.equal(g.response?.kind, 'choamWorthless');
        g = applyAction(arrivalReload(g), 'tleilaxu', {
          type: 'card',
          card: karama,
          mode: 'cancel',
        });
        assert.equal(g.discard.filter((c) => c.id === karama).length, 1);
        assert.ok(arrivalPlayer(g, 'choam').hand.some((c) => c.id === baliset));
      } else
        g = applyAction(arrivalReload(g), 'choam', {
          type: 'decision',
          decline: true,
        });
      assert.equal(g.pendingChoamMove, null);
      assert.equal(
        g.decision?.kind,
        tokens === 'ambassador' ? 'ecazAmbassador' : 'moritaniTerror',
      );
      assert.deepEqual(arrivalPlayer(g, 'tleilaxu').forces, {
        'carthag:11': 3,
      });
      assert.equal(arrivalPlayer(g, 'tleilaxu').moved, 1);
      const event =
        tokens === 'ambassador' ? g.pendingAmbassador!.event : undefined;
      g = applyAction(
        arrivalReload(g),
        tokens === 'ambassador' ? 'ecaz' : 'moritani',
        { type: 'decision', event, decline: true },
      );
      assert.equal(g.decision, null);
      assert.equal(g.active, 'tleilaxu');
      assert.equal(arrivalPlayer(g, 'tleilaxu').moved, 1);
      reject(g, 'choam', { type: 'decision', decline: true });
    });

void test('a saved CHOAM decline releases an uncommitted unsupported arrival with its precise reason and allows another legal destination', () => {
  let g = movementArrivalGame('tleilaxu', 'ambassador');
  const card = holdArrivalCard(g, 'tleilaxu', 'Ornithopter');
  g = applyAction(g, 'tleilaxu', {
    ...arrivalMove(g),
    movementCard: card,
    ornithopter: 'range3',
  });
  const flight = structuredClone(g.ornithopter);
  // Model the persisted checkpoint: the unsupported second token was already
  // present in a legacy saved CHOAM window, whose declaration spent nothing.
  addArrivalTerror(g);
  const before = structuredClone(g),
    resources = structuredClone(arrivalResources(g));
  for (const p of g.players)
    assert.deepEqual(viewGame(arrivalReload(g), p.id), viewGame(g, p.id));
  assert.deepEqual(normalizeAutomaticGame(arrivalReload(g)), arrivalReload(g));
  reject(g, 'tleilaxu', { type: 'decision', decline: true });
  reject(g, 'choam', { type: 'decision', decline: false });
  const done = applyAction(arrivalReload(g), 'choam', {
    type: 'decision',
    decline: true,
  });
  assert.deepEqual(g, before);
  assert.deepEqual(arrivalResources(done), resources);
  assert.equal(done.pendingChoamMove, null);
  assert.equal(done.decision, null);
  assert.deepEqual(done.ornithopter, flight);
  assert.equal(
    arrivalPlayer(done, 'tleilaxu').hand.some((c) => c.id === card),
    false,
  );
  assert.equal(
    done.discard.some((c) => c.id === card),
    false,
  );
  assert.match(done.log.at(-1)!.text, overlap);
  assert.match(
    done.log.at(-1)!.text,
    /No additional forces, spice, cards or movement allowance were spent/,
  );
  assert.deepEqual(
    normalizeAutomaticGame(arrivalReload(done)),
    arrivalReload(done),
  );
  reject(done, 'choam', { type: 'decision', decline: true });
  reject(done, 'tleilaxu', arrivalMove(done), overlap);
  const retry = applyAction(done, 'tleilaxu', {
    type: 'move',
    forces: { 'arrakeen:10': 3 },
    territory: 'imperial_basin',
    sector: 10,
    ornithopterEvent: done.ornithopter!.event,
  });
  assert.equal(arrivalPlayer(retry, 'tleilaxu').moved, 1);
  assert.deepEqual(arrivalPlayer(retry, 'tleilaxu').forces, {
    'imperial_basin:10': 3,
  });
  assert.equal(retry.ornithopter, null);
  assert.equal(retry.discard.filter((c) => c.id === card).length, 1);
});

void test('legacy invalid-order retry stays unspent while unexpected malformed arrival faults remain rejected', () => {
  let g = movementArrivalGame('tleilaxu', 'ambassador');
  g = applyAction(g, 'tleilaxu', arrivalMove(g));
  const invalid = arrivalReload(g);
  arrivalArmy(invalid, 'tleilaxu', 'arrakeen:10', 2);
  const retried = applyAction(invalid, 'choam', {
    type: 'decision',
    decline: true,
  });
  assert.equal(retried.pendingChoamMove, null);
  assert.equal(arrivalPlayer(retried, 'tleilaxu').moved, 0);
  assert.deepEqual(arrivalPlayer(retried, 'tleilaxu').forces, {
    'arrakeen:10': 2,
  });
  const malformed = arrivalReload(g);
  malformed.ecazAmbassadors!.tokens = {} as NonNullable<
    Game['ecazAmbassadors']
  >['tokens'];
  const before = structuredClone(malformed);
  assert.throws(
    () => applyAction(malformed, 'choam', { type: 'decision', decline: true }),
    TypeError,
  );
  assert.deepEqual(malformed, before);
});
