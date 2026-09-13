import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DISCOVERY_CARD_PLACEMENTS,
  DISCOVERY_LOCATION_BY_ID,
  DISCOVERY_LOCATION_IDS,
  DISCOVERY_LOCATIONS,
  DISCOVERY_SPICE_CARDS,
  DISCOVERY_TOKEN_BY_ID,
  DISCOVERY_TOKENS,
  JACURUTU_SIETCH,
  clearNewlyRevealed,
  consumeOrnithopter,
  createDiscoveryState,
  isDiscoveryLocationId,
  isDiscoveryTokenId,
  placeDiscovery,
  projectDiscoveryState,
  rememberDiscoveryFace,
  revealDiscoveryToken,
  validateDiscoveryState,
  type DiscoveryState,
  type DiscoveryTokenFace,
} from '../game/discoveries';

const ordered = () => createDiscoveryState(() => 0.999);
const reload = (state: DiscoveryState) =>
  JSON.parse(JSON.stringify(state)) as DiscoveryState;
const tokenWithFace = (state: DiscoveryState, face: DiscoveryTokenFace) =>
  state.tokens.find((token) => token.face === face)!;

void test('printed cards and immutable token metadata preserve the sourced inventory and placements', () => {
  assert.deepEqual(DISCOVERY_SPICE_CARDS, [
    {
      territory: 'hagga_basin',
      amount: 6,
      sector: 12,
      discovery: 'discovery-hagga-basin',
    },
    {
      territory: 'rock_outcroppings',
      amount: 6,
      sector: 13,
      discovery: 'discovery-rock-outcroppings',
    },
    {
      territory: 'sihaya_ridge',
      amount: 6,
      sector: 9,
      discovery: 'discovery-sihaya-ridge',
    },
    {
      territory: 'wind_pass_north',
      amount: 6,
      sector: 17,
      discovery: 'discovery-wind-pass-north',
    },
    {
      territory: 'funeral_plain',
      amount: 6,
      sector: 15,
      discovery: 'discovery-funeral-plain',
    },
    {
      territory: 'oh_gap',
      amount: 6,
      sector: 10,
      discovery: 'discovery-old-gap',
    },
  ]);
  assert.deepEqual(DISCOVERY_CARD_PLACEMENTS, {
    'discovery-hagga-basin': {
      type: 'hiereg',
      territory: 'gara_kulon',
      sector: 8,
    },
    'discovery-rock-outcroppings': {
      type: 'hiereg',
      territory: 'meridian',
      sector: 1,
    },
    'discovery-sihaya-ridge': {
      type: 'hiereg',
      territory: 'cielago_east',
      sector: 3,
    },
    'discovery-wind-pass-north': {
      type: 'smuggler',
      territory: 'plastic_basin',
      sector: 13,
    },
    'discovery-funeral-plain': {
      type: 'smuggler',
      territory: 'pasty_mesa',
      sector: 7,
    },
    'discovery-old-gap': {
      type: 'smuggler',
      territory: 'false_wall_west',
      sector: 17,
    },
  });
  assert.deepEqual(
    DISCOVERY_TOKENS.map(({ id, type, kind }) => ({ id, type, kind })),
    [
      { id: 'jacurutu-sietch', type: 'hiereg', kind: 'location' },
      { id: 'cistern', type: 'hiereg', kind: 'location' },
      {
        id: 'ecological-testing-station',
        type: 'hiereg',
        kind: 'location',
      },
      { id: 'shrine', type: 'hiereg', kind: 'location' },
      {
        id: 'orgiz-processing-station',
        type: 'smuggler',
        kind: 'location',
      },
      { id: 'treachery-card-stash', type: 'smuggler', kind: 'instant' },
      { id: 'spice-stash', type: 'smuggler', kind: 'instant' },
      { id: 'ornithopter', type: 'smuggler', kind: 'carried' },
    ],
  );
  assert.equal(JACURUTU_SIETCH, 'jacurutu-sietch');
  assert.deepEqual(DISCOVERY_LOCATION_IDS, [
    'jacurutu-sietch',
    'cistern',
    'ecological-testing-station',
    'shrine',
    'orgiz-processing-station',
  ]);
  assert.equal(DISCOVERY_LOCATION_BY_ID[JACURUTU_SIETCH].stronghold, true);
  assert.equal(DISCOVERY_TOKEN_BY_ID.ornithopter.location, null);
  assert.equal(isDiscoveryLocationId('cistern'), true);
  assert.equal(isDiscoveryLocationId('ornithopter'), false);
  assert.equal(isDiscoveryTokenId('discovery-token-8'), true);
  assert.equal(isDiscoveryTokenId('discovery-token-9'), false);
  assert.ok(Object.isFrozen(DISCOVERY_SPICE_CARDS));
  assert.ok(DISCOVERY_SPICE_CARDS.every(Object.isFrozen));
  assert.ok(Object.isFrozen(DISCOVERY_TOKENS));
  assert.ok(DISCOVERY_TOKENS.every(Object.isFrozen));
  assert.ok(Object.isFrozen(DISCOVERY_LOCATIONS));
  assert.ok(DISCOVERY_LOCATIONS.every(Object.isFrozen));
});

void test('setup shuffles eight secret faces behind stable opaque physical IDs and survives JSON', () => {
  let calls = 0;
  const state = createDiscoveryState(() => {
    calls++;
    return 0.999;
  });
  assert.equal(calls, 7);
  assert.deepEqual(
    state.tokens.map((token) => token.id),
    Array.from({ length: 8 }, (_, index) => `discovery-token-${index + 1}`),
  );
  assert.deepEqual(
    state.tokens.map((token) => token.face),
    DISCOVERY_TOKENS.map((token) => token.id),
  );
  assert.ok(
    state.tokens.every(
      (token) =>
        token.status === 'supply' &&
        token.territory === null &&
        token.sector === null &&
        token.revealedTurn === null &&
        token.owner === null &&
        token.known.length === 0,
    ),
  );
  assert.notDeepEqual(
    createDiscoveryState(() => 0).tokens.map((token) => token.face),
    state.tokens.map((token) => token.face),
  );
  validateDiscoveryState(reload(state));
  for (const draw of [-1, 1, NaN, Infinity])
    assert.throws(() => createDiscoveryState(() => draw), /random draws/);
});

void test('placement draws only the required type and uses the printed token destination without mutation', () => {
  const initial = ordered();
  const before = reload(initial);
  const hiereg = placeDiscovery(initial, 'discovery-rock-outcroppings', () => 0);
  const placedHiereg = hiereg.tokens.find((token) => token.status === 'placed')!;
  assert.deepEqual(
    {
      id: placedHiereg.id,
      type: placedHiereg.type,
      face: placedHiereg.face,
      territory: placedHiereg.territory,
      sector: placedHiereg.sector,
    },
    {
      id: 'discovery-token-1',
      type: 'hiereg',
      face: 'jacurutu-sietch',
      territory: 'meridian',
      sector: 1,
    },
  );
  const smuggler = placeDiscovery(initial, 'discovery-funeral-plain', () => 0);
  const placedSmuggler = smuggler.tokens.find(
    (token) => token.status === 'placed',
  )!;
  assert.deepEqual(
    [
      placedSmuggler.id,
      placedSmuggler.type,
      placedSmuggler.face,
      placedSmuggler.territory,
      placedSmuggler.sector,
    ],
    ['discovery-token-5', 'smuggler', 'orgiz-processing-station', 'pasty_mesa', 7],
  );
  assert.deepEqual(initial, before);
  assert.notEqual(hiereg.tokens, initial.tokens);
  assert.notEqual(hiereg.tokens[0].known, initial.tokens[0].known);
});

void test('unavailable types and bad randomness reject before consuming custody', () => {
  let state = ordered();
  for (const card of [
    'discovery-hagga-basin',
    'discovery-rock-outcroppings',
    'discovery-sihaya-ridge',
    'discovery-hagga-basin',
  ] as const)
    state = placeDiscovery(state, card, () => 0);
  const before = reload(state);
  let calls = 0;
  assert.throws(
    () =>
      placeDiscovery(state, 'discovery-hagga-basin', () => {
        calls++;
        return 0;
      }),
    /No hiereg/,
  );
  assert.equal(calls, 0);
  assert.deepEqual(state, before);
  const initial = ordered();
  for (const draw of [-0.1, 1, NaN, Infinity]) {
    assert.throws(
      () => placeDiscovery(initial, 'discovery-hagga-basin', () => draw),
      /random draws/,
    );
    assert.deepEqual(initial, ordered());
  }
});

void test('private projection hides supply order and hidden faces except for eligible or informed factions', () => {
  let state = placeDiscovery(
    ordered(),
    'discovery-rock-outcroppings',
    () => 0,
  );
  state = placeDiscovery(state, 'discovery-funeral-plain', () => 0);
  const hiereg = state.tokens.find(
    (token) => token.status === 'placed' && token.type === 'hiereg',
  )!;
  const smuggler = state.tokens.find(
    (token) => token.status === 'placed' && token.type === 'smuggler',
  )!;
  const publicView = projectDiscoveryState(state);
  assert.equal(publicView.supplyCount, 6);
  assert.deepEqual(
    publicView.tokens.map((token) => token.face),
    [null, null],
  );
  assert.equal('known' in publicView.tokens[0], false);
  assert.equal(projectDiscoveryState(state, 'fremen').tokens[0].face, hiereg.face);
  assert.equal(projectDiscoveryState(state, 'fremen').tokens[1].face, null);
  assert.equal(projectDiscoveryState(state, 'guild').tokens[0].face, null);
  assert.equal(
    projectDiscoveryState(state, 'guild').tokens[1].face,
    smuggler.face,
  );
  const informed = rememberDiscoveryFace(state, hiereg.id, 'atreides');
  assert.equal(
    projectDiscoveryState(informed, 'atreides').tokens[0].face,
    hiereg.face,
  );
  assert.equal(projectDiscoveryState(informed, 'harkonnen').tokens[0].face, null);
  const reordered = reload(state);
  reordered.tokens.reverse();
  assert.deepEqual(
    projectDiscoveryState(reordered).tokens
      .map((token) => ({ ...token, id: 'opaque' }))
      .sort((a, b) => String(a.type).localeCompare(String(b.type))),
    publicView.tokens
      .map((token) => ({ ...token, id: 'opaque' }))
      .sort((a, b) => String(a.type).localeCompare(String(b.type))),
  );
});

void test('location reveal remains on the board, becomes public, and tracks one migration window', () => {
  const placed = placeDiscovery(
    ordered(),
    'discovery-rock-outcroppings',
    () => 0,
  );
  const token = placed.tokens.find((candidate) => candidate.status === 'placed')!;
  const before = reload(placed);
  const revealed = revealDiscoveryToken(placed, token.id, 4);
  assert.deepEqual(revealed.outcome, {
    kind: 'location',
    location: 'jacurutu-sietch',
  });
  const face = revealed.state.tokens.find((candidate) => candidate.id === token.id)!;
  assert.equal(face.status, 'placed');
  assert.equal(face.territory, 'meridian');
  assert.equal(face.sector, 1);
  assert.equal(face.revealedTurn, 4);
  assert.deepEqual(revealed.state.newlyRevealed, [token.id]);
  assert.equal(projectDiscoveryState(revealed.state).tokens[0].face, token.face);
  assert.deepEqual(placed, before);
  assert.throws(
    () => revealDiscoveryToken(revealed.state, token.id, 4),
    /hidden placed/,
  );
  const cleared = clearNewlyRevealed(revealed.state);
  assert.deepEqual(cleared.newlyRevealed, []);
  assert.equal(cleared.tokens.find((candidate) => candidate.id === token.id)!.revealedTurn, 4);
  validateDiscoveryState(reload(cleared));
});

void test('stash outcomes remove one face while Ornithopter transfers and consumes exact custody', () => {
  const cases = [
    {
      face: 'treachery-card-stash' as const,
      draw: 0.3,
      outcome: { kind: 'treachery-card-stash' },
    },
    {
      face: 'spice-stash' as const,
      draw: 0.6,
      outcome: { kind: 'spice-stash', amount: 7 },
    },
  ];
  for (const entry of cases) {
    const placed = placeDiscovery(
      ordered(),
      'discovery-funeral-plain',
      () => entry.draw,
    );
    const token = tokenWithFace(placed, entry.face);
    const result = revealDiscoveryToken(placed, token.id, 6);
    assert.deepEqual(result.outcome, entry.outcome);
    const removed = tokenWithFace(result.state, entry.face);
    assert.equal(removed.status, 'removed');
    assert.equal(removed.territory, null);
    assert.equal(removed.sector, null);
    assert.equal(removed.revealedTurn, 6);
    assert.equal(removed.acquiredTurn, 6);
    validateDiscoveryState(reload(result.state));
  }

  const placed = placeDiscovery(
    ordered(),
    'discovery-funeral-plain',
    () => 0.999,
  );
  const ornithopter = tokenWithFace(placed, 'ornithopter');
  const before = reload(placed);
  assert.throws(
    () => revealDiscoveryToken(placed, ornithopter.id, 7),
    /receiving player/,
  );
  assert.deepEqual(placed, before);
  const carried = revealDiscoveryToken(placed, ornithopter.id, 7, 'player-a');
  assert.deepEqual(carried.outcome, {
    kind: 'ornithopter',
    owner: 'player-a',
  });
  assert.deepEqual(
    {
      status: tokenWithFace(carried.state, 'ornithopter').status,
      owner: tokenWithFace(carried.state, 'ornithopter').owner,
      acquiredTurn: tokenWithFace(carried.state, 'ornithopter').acquiredTurn,
    },
    { status: 'carried', owner: 'player-a', acquiredTurn: 7 },
  );
  const consumed = consumeOrnithopter(carried.state, 'player-a');
  assert.equal(tokenWithFace(consumed, 'ornithopter').status, 'removed');
  assert.equal(tokenWithFace(consumed, 'ornithopter').owner, null);
  assert.throws(
    () => consumeOrnithopter(consumed, 'player-a'),
    /carry exactly one Ornithopter/,
  );
  validateDiscoveryState(reload(consumed));
});

void test('malformed census, private knowledge, placement and migration state reject unchanged', () => {
  const mutations: ((state: DiscoveryState) => void)[] = [
    (state) => {
      state.tokens.pop();
    },
    (state) => {
      state.tokens[1].id = state.tokens[0].id;
    },
    (state) => {
      state.tokens[1].face = state.tokens[0].face;
    },
    (state) => {
      state.tokens[0].type = 'smuggler';
    },
    (state) => {
      state.tokens[0].known = ['unknown' as never];
    },
    (state) => {
      state.tokens[0].status = 'placed';
    },
    (state) => {
      state.tokens[0].owner = 'player-a';
    },
    (state) => {
      state.newlyRevealed.push('discovery-token-1');
    },
    (state) => {
      Object.assign(state.tokens[0], { leakedFace: 'secret' });
    },
    (state) => {
      state.version = 2 as 1;
    },
  ];
  for (const mutate of mutations) {
    const state = ordered();
    mutate(state);
    const before = JSON.stringify(state);
    assert.throws(() => validateDiscoveryState(state));
    let calls = 0;
    assert.throws(() =>
      placeDiscovery(state, 'discovery-hagga-basin', () => {
        calls++;
        return 0;
      }),
    );
    assert.equal(calls, 0);
    assert.equal(JSON.stringify(state), before);
  }

  const frozen = placeDiscovery(
    ordered(),
    'discovery-rock-outcroppings',
    () => 0,
  );
  frozen.tokens.forEach((token) => {
    Object.freeze(token.known);
    Object.freeze(token);
  });
  Object.freeze(frozen.tokens);
  Object.freeze(frozen.newlyRevealed);
  Object.freeze(frozen);
  const next = rememberDiscoveryFace(
    frozen,
    frozen.tokens.find((token) => token.status === 'placed')!.id,
    'atreides',
  );
  validateDiscoveryState(next);
  assert.notEqual(next.tokens, frozen.tokens);
});
