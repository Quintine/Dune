import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceDiscoveryEntry,
  beginDiscoveryEntryArrival,
  createDiscoveryEntryRound,
  discoveryEntryArrivalSignature,
  discoveryEntrySignature,
  finishDiscoveryEntryArrival,
  quoteDiscoveryEntry,
  validateDiscoveryEntryArrivalChild,
  validateDiscoveryEntryRound,
  type DiscoveryEntryContext,
} from '../game/discovery-entry';
import {
  createDiscoveryState,
  type DiscoveryLocationId,
  type DiscoveryOpaqueTokenId,
} from '../game/discoveries';

function context(
  locations: readonly {
    face: DiscoveryLocationId;
    territory: string;
    sector: number;
  }[] = [
    { face: 'jacurutu-sietch', territory: 'meridian', sector: 1 },
  ],
): DiscoveryEntryContext {
  const discoveries = createDiscoveryState(() => 0);
  const ids: DiscoveryOpaqueTokenId[] = [];
  for (const location of locations) {
    const token = discoveries.tokens.find(
      (candidate) => candidate.face === location.face,
    )!;
    Object.assign(token, {
      status: 'placed',
      territory: location.territory,
      sector: location.sector,
      revealedTurn: 2,
      known: [],
      owner: null,
      acquiredTurn: null,
    });
    ids.push(token.id);
  }
  discoveries.newlyRevealed = ids;
  return {
    turn: 3,
    storm: 1,
    order: ['a', 'g', 'f'],
    discoveries,
    players: [
      {
        id: 'a',
        faction: 'atreides',
        ally: null,
        forces: { 'meridian:1': 2, 'meridian:2': 3 },
        elites: { forces: { 'meridian:2': 1 } },
      },
      {
        id: 'g',
        faction: 'guild',
        ally: null,
        forces: {},
      },
      {
        id: 'f',
        faction: 'fremen',
        ally: null,
        forces: {},
      },
    ],
  };
}

void test('a round freezes last-turn revealed locations in token order and players in storm order', () => {
  const g = context([
    { face: 'jacurutu-sietch', territory: 'meridian', sector: 1 },
    { face: 'cistern', territory: 'gara_kulon', sector: 8 },
  ]);
  const before = structuredClone(g);
  const frame = createDiscoveryEntryRound(g, 'entry-round');
  assert.deepEqual(frame.tokens, g.discoveries.newlyRevealed);
  assert.deepEqual(frame.order, g.order);
  assert.equal(frame.cursor, 0);
  assert.equal(frame.stage, 'choose');
  assert.equal(frame.signature, discoveryEntrySignature(frame));
  assert.deepEqual(g, before);

  const none = context();
  none.discoveries.newlyRevealed = [];
  const complete = createDiscoveryEntryRound(none, 'no-entry');
  assert.equal(complete.stage, 'complete');
  assert.equal(complete.arrival, null);
});

void test('a quote offers typed non-advisor source groups outside the storm and accepts any positive subset', () => {
  const g = context();
  const frame = createDiscoveryEntryRound(g, 'typed-entry');
  const before = structuredClone(g);
  const offer = quoteDiscoveryEntry(g, frame, 'a');
  assert.equal(offer.blocked, null);
  assert.deepEqual(offer.sources, [
    { source: 'meridian:2', normal: 2, elite: 1 },
  ]);

  const chosen = quoteDiscoveryEntry(g, frame, 'a', {
    groups: [{ source: 'meridian:2', normal: 1, elite: 1 }],
  });
  assert.deepEqual(chosen.arrival?.groups, [
    { source: 'meridian:2', normal: 1, elite: 1 },
  ]);
  assert.equal(chosen.arrival?.amount, 2);
  assert.equal(chosen.arrival?.elite, 1);
  assert.deepEqual(g, before);

  assert.throws(
    () =>
      quoteDiscoveryEntry(g, frame, 'a', {
        groups: [{ source: 'meridian:1', normal: 1, elite: 0 }],
      }),
    /typed source custody/i,
  );

  const advisor = context();
  Object.assign(advisor.players[0], {
    faction: 'beneGesserit',
    advisors: { meridian: {} },
  });
  const advisorOffer = quoteDiscoveryEntry(
    advisor,
    createDiscoveryEntryRound(advisor, 'advisor-entry'),
    'a',
  );
  assert.match(advisorOffer.blocked ?? '', /non-advisor forces/i);
  assert.deepEqual(advisorOffer.sources, []);
});

void test('full occupancy is a skippable offer and declining walks the token-player cursor to completion', () => {
  const g = context();
  g.players[1].forces = { 'jacurutu-sietch:0': 1 };
  g.players[2].forces = { 'jacurutu-sietch:0': 1 };
  let frame = createDiscoveryEntryRound(g, 'occupied-entry');
  const offer = quoteDiscoveryEntry(g, frame, 'a');
  assert.match(offer.blocked ?? '', /three occupying factions/i);
  assert.throws(
    () =>
      quoteDiscoveryEntry(g, frame, 'a', {
        groups: [{ source: 'meridian:2', normal: 1, elite: 0 }],
      }),
    /three occupying factions/i,
  );

  const originalFrame = frame;
  const original = structuredClone(frame);
  frame = advanceDiscoveryEntry(g, frame, 'a');
  assert.deepEqual(originalFrame, original);
  assert.equal(frame.cursor, 1);
  frame = advanceDiscoveryEntry(g, frame, 'g');
  assert.equal(frame.cursor, 2);
  frame = advanceDiscoveryEntry(g, frame, 'f');
  assert.equal(frame.stage, 'complete');
  assert.equal(frame.cursor, 3);
  assert.equal(frame.arrival, null);
  assert.throws(() => advanceDiscoveryEntry(g, frame, 'a'), /current player/i);
});

void test('an accepted entry remains valid after transfer and binds its exact arrival child', () => {
  const g = context();
  const choose = createDiscoveryEntryRound(g, 'signed-entry');
  const before = structuredClone(choose);
  const arrival = beginDiscoveryEntryArrival(g, choose, 'a', {
    groups: [{ source: 'meridian:2', normal: 1, elite: 1 }],
  });
  assert.deepEqual(choose, before);
  assert.equal(arrival.stage, 'arrival');
  assert.equal(arrival.arrival?.destination, 'jacurutu-sietch');

  const moved = structuredClone(g);
  moved.players[0].forces['meridian:2'] = 1;
  moved.players[0].elites!.forces['meridian:2'] = 0;
  moved.players[0].forces['jacurutu-sietch:0'] = 2;
  moved.players[0].elites!.forces['jacurutu-sietch:0'] = 1;
  assert.doesNotThrow(() => validateDiscoveryEntryRound(moved, arrival));

  const child = {
    owner: 'a',
    territory: 'jacurutu-sietch',
    sector: 0,
    amount: 2,
    elite: 1,
    discoveryEntry: arrival.arrival!.signature,
  };
  assert.doesNotThrow(() =>
    validateDiscoveryEntryArrivalChild(arrival, child),
  );
  assert.throws(
    () =>
      validateDiscoveryEntryArrivalChild(arrival, {
        ...child,
        territory: 'cistern',
      }),
    /signed arrival/i,
  );

  const finished = finishDiscoveryEntryArrival(moved, arrival);
  assert.equal(finished.cursor, 1);
  assert.equal(finished.stage, 'choose');
  assert.equal(finished.arrival, null);
});

void test('resigned turn, token, owner, and arrival mutations are rejected', () => {
  const g = context();
  const frame = createDiscoveryEntryRound(g, 'restore-entry');
  const stale = structuredClone(frame);
  stale.turn = 2;
  stale.signature = discoveryEntrySignature(stale);
  assert.throws(
    () => validateDiscoveryEntryRound(g, stale),
    /original token and player order/i,
  );

  const missing = structuredClone(frame);
  missing.tokens = [];
  missing.cursor = 0;
  missing.stage = 'complete';
  missing.signature = discoveryEntrySignature(missing);
  assert.throws(
    () => validateDiscoveryEntryRound(g, missing),
    /original token and player order/i,
  );

  const arrival = beginDiscoveryEntryArrival(g, frame, 'a', {
    groups: [{ source: 'meridian:2', normal: 1, elite: 0 }],
  });
  const wrongOwner = structuredClone(arrival);
  wrongOwner.arrival!.owner = 'g';
  wrongOwner.arrival!.signature = JSON.stringify('forged');
  wrongOwner.signature = discoveryEntrySignature(wrongOwner);
  assert.throws(
    () => validateDiscoveryEntryRound(g, wrongOwner),
    /exact signed arrival/i,
  );

  const wrongSource = structuredClone(arrival);
  wrongSource.arrival!.groups[0].source = 'arrakeen:9';
  wrongSource.arrival!.signature = discoveryEntryArrivalSignature(
    wrongSource.arrival!,
  );
  wrongSource.signature = discoveryEntrySignature(wrongSource);
  assert.throws(
    () => validateDiscoveryEntryRound(g, wrongSource),
    /revealed destination/i,
  );
});
