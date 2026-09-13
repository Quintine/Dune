import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDiscoveryState, placeDiscovery, projectDiscoveryState, revealDiscoveryToken,
  type DiscoveryOpaqueTokenId,
} from '../game/discoveries';
import {
  completeDiscoveryFlight, discoveryFlightOffer, DiscoveryFlightError, quoteDiscoveryFlight,
  validateDiscoveryFlight,
  type DiscoveryFlightContext, type DiscoveryFlightMovement, type DiscoveryFlightReceipt,
} from '../game/discovery-flight';

function fixture() {
  const supplied = createDiscoveryState(() => 0.999);
  const token = supplied.tokens.find(token => token.face === 'ornithopter')!.id;
  const placed = placeDiscovery(supplied, 'discovery-funeral-plain', () => 0.999);
  const discoveries = revealDiscoveryToken(placed, token, 2, 'p').state;
  const context: DiscoveryFlightContext = {
    status: 'playing', phase: 5, active: 'p', turn: 3, discoveries,
    players: [{ id: 'p', moved: 0 }, { id: 'q', moved: 0 }],
  };
  const move: DiscoveryFlightMovement = {
    player: 'p', origin: 'false_wall_west',
    group: [['false_wall_west:16', 2], ['false_wall_west:17', 1]],
    eliteGroup: { 'false_wall_west:16': 1, 'false_wall_west:17': 0 },
    elite: 1, total: 3, to: 'the_great_flat', sector: 15,
    advisors: false, wantsFighters: false,
  };
  return { context, token, move };
}
const reload = <T>(value: T): T => JSON.parse(JSON.stringify(value));
function rejectedUnchanged<T>(input: T, work: () => unknown) {
  const before = structuredClone(input);
  assert.throws(work, DiscoveryFlightError);
  assert.deepEqual(input, before);
}

void test('Discovery flight quote binds one typed group without spending custody or changing the source state', () => {
  const { context, token, move } = fixture(), before = structuredClone({ context, move });
  const receipt = quoteDiscoveryFlight(context, token, move);
  assert.equal(receipt.token, token);
  assert.equal(receipt.player, 'p');
  assert.equal(receipt.turn, 3);
  assert.equal(receipt.acquiredTurn, 2);
  assert.equal(receipt.move, 0);
  assert.doesNotThrow(() => validateDiscoveryFlight(context, receipt, move));
  assert.equal(context.discoveries!.tokens.find(candidate => candidate.id === token)!.status, 'carried');
  assert.deepEqual({ context, move }, before);
  rejectedUnchanged(context, () => completeDiscoveryFlight(context, receipt, move));
});

void test('turn of acquisition, earlier turn, foreign owner and unavailable physical tokens cannot create flight receipts', () => {
  const { context, token, move } = fixture();
  for (const turn of [1, 2]) {
    const sameTurn = { ...context, turn };
    rejectedUnchanged(sameTurn, () => quoteDiscoveryFlight(sameTurn, token, move));
  }
  for (const wrong of [undefined, '', 'discovery-token-99',
    context.discoveries!.tokens.find(candidate => candidate.face === 'cistern')!.id])
    rejectedUnchanged(context, () => quoteDiscoveryFlight(context, wrong, move));
  const foreign = { ...context, active: 'q' };
  rejectedUnchanged(foreign, () => quoteDiscoveryFlight(foreign, token, { ...move, player: 'q' }));
  for (const changes of [{ status: 'finished' }, { phase: 7 }, { active: 'q' }, { turn: 0 }]) {
    const unavailable = { ...context, ...changes };
    rejectedUnchanged(unavailable, () => quoteDiscoveryFlight(unavailable, token, move));
  }
});

void test('pending owned movement responses and JSON restore retain the exact group without consuming the token', () => {
  const { context, token, move } = fixture(), receipt = quoteDiscoveryFlight(context, token, move);
  const order = { ...move, discoveryFlight: receipt };
  const pending = { ...context, response: { kind: 'choamPower', owner: 'q' }, pendingChoamMove: order };
  const saved = reload(pending), before = structuredClone(saved);
  assert.doesNotThrow(() => validateDiscoveryFlight(saved, saved.pendingChoamMove.discoveryFlight, saved.pendingChoamMove));
  assert.deepEqual(quoteDiscoveryFlight(saved, token, saved.pendingChoamMove), receipt);
  assert.deepEqual(saved, before);
  // Abandoning an invalidated route drops the order, not its unspent token.
  const abandoned = { ...saved, response: null, pendingChoamMove: null };
  assert.equal(discoveryFlightOffer(abandoned, 'p', { movesAllowed: 1 })!.blocked, null);
  assert.deepEqual(abandoned.discoveries, context.discoveries);
});

void test('completed flight removes only the carried token after one committed movement and preserves its acquisition history', () => {
  const { context, token, move } = fixture(), receipt = quoteDiscoveryFlight(context, token, move);
  const committed = reload(context);
  committed.players[0].moved++;
  const before = structuredClone(committed), next = completeDiscoveryFlight(committed, reload(receipt), reload(move));
  const originalToken = context.discoveries!.tokens.find(candidate => candidate.id === token)!;
  assert.deepEqual(next.tokens.find(candidate => candidate.id === token), {
    ...originalToken, status: 'removed', owner: null,
  });
  assert.deepEqual(next.tokens.filter(candidate => candidate.id !== token),
    context.discoveries!.tokens.filter(candidate => candidate.id !== token));
  assert.deepEqual(next.newlyRevealed, context.discoveries!.newlyRevealed);
  assert.deepEqual(committed, before);
  assert.notEqual(next, committed.discoveries);
  const spent = { ...committed, discoveries: next };
  rejectedUnchanged(spent, () => completeDiscoveryFlight(spent, receipt, move));
  rejectedUnchanged(spent, () => quoteDiscoveryFlight(spent, token, move));
  assert.equal(discoveryFlightOffer(spent, 'p'), null);
});

void test('saved receipts reject replay onto another move, changed groups or destinations, and altered token acquisition', () => {
  const { context, token, move } = fixture(), receipt = quoteDiscoveryFlight(context, token, move);
  for (const alter of [
    (order: DiscoveryFlightMovement) => { order.to = 'hagga_basin'; },
    (order: DiscoveryFlightMovement) => { order.sector = 14; },
    (order: DiscoveryFlightMovement) => { order.group = [['false_wall_west:16', 1], ['false_wall_west:17', 2]]; },
    (order: DiscoveryFlightMovement) => { order.eliteGroup = { 'false_wall_west:16': 0, 'false_wall_west:17': 1 }; },
    (order: DiscoveryFlightMovement) => { order.advisors = true; },
    (order: DiscoveryFlightMovement) => { order.lockedTurn = 3; },
  ]) {
    const changed = reload(move); alter(changed);
    rejectedUnchanged(context, () => validateDiscoveryFlight(context, receipt, changed));
  }
  for (const changes of [{ turn: 4 }, { players: [{ id: 'p', moved: 1 }, { id: 'q', moved: 0 }] }]) {
    const changed = { ...context, ...changes };
    rejectedUnchanged(changed, () => validateDiscoveryFlight(changed, receipt, move));
  }
  const laterMove = reload(context); laterMove.players[0].moved = 2;
  rejectedUnchanged(laterMove, () => completeDiscoveryFlight(laterMove, receipt, move));
  const reacquired = reload(context), held = reacquired.discoveries!.tokens.find(candidate => candidate.id === token)!;
  held.acquiredTurn = 1; held.revealedTurn = 1;
  rejectedUnchanged(reacquired, () => validateDiscoveryFlight(reacquired, receipt, move));
  for (const damage of [
    { ...receipt, player: 'q' }, { ...receipt, move: -1 }, { ...receipt, selection: 'changed' },
    { ...receipt, turn: 2 }, { ...receipt, extra: true },
  ]) rejectedUnchanged(context, () => validateDiscoveryFlight(context, damage, move));
});

void test('receipt signature ignores property order and independent Treachery flight fields while binding a selected marker', () => {
  const { context, token, move } = fixture();
  const marked = { ...move, total: 4, noField: { tokenId: 'field-one', event: 'marker-event', from: 'false_wall_west:17' } };
  const receipt = quoteDiscoveryFlight(context, token, marked);
  const equivalent = {
    ...marked, group: [...marked.group].reverse(),
    eliteGroup: { 'false_wall_west:17': 0, 'false_wall_west:16': 1 },
    ornithopterEvent: 'physical-treachery-card-event', ornithopterRange: false,
    discoveryFlight: receipt,
  };
  assert.doesNotThrow(() => validateDiscoveryFlight(context, receipt, equivalent));
  assert.deepEqual(quoteDiscoveryFlight(context, token, equivalent), receipt);
  for (const changes of [{ tokenId: 'other-field' }, { event: 'other-event' }, { from: 'false_wall_west:16' }])
    rejectedUnchanged(context, () => validateDiscoveryFlight(context, receipt,
      { ...marked, noField: { ...marked.noField, ...changes } }));
  const withCard = { ...context, ornithopter: { event: 'physical-treachery-card-event', completed: 0, mode: 'twoGroups' } };
  const before = structuredClone(withCard);
  assert.deepEqual(quoteDiscoveryFlight(withCard, token, equivalent), receipt);
  assert.deepEqual(withCard, before);
});

void test('malformed or motionless canonical groups cannot reserve the Discovery token', () => {
  const { context, token, move } = fixture();
  const malformed: DiscoveryFlightMovement[] = [
    { ...move, source: 'ambassador' },
    { ...move, total: 0, elite: 0, group: [], eliteGroup: {} },
    { ...move, total: 4 },
    { ...move, group: [['false_wall_west:16', 3], ['false_wall_west:16', 1]] },
    { ...move, group: [['false_wall_west:16', 0], ['false_wall_west:17', 3]] },
    { ...move, group: [['arrakeen:10', 2], ['false_wall_west:17', 1]] },
    { ...move, eliteGroup: { 'false_wall_west:16': 3 }, elite: 3 },
    { ...move, eliteGroup: { 'false_wall_west:16': 1, 'not-selected:0': 0 } },
    { ...move, to: 'false_wall_west', sector: 16 },
    { ...move, wantsFighters: true },
  ];
  for (const invalid of malformed) rejectedUnchanged(context, () => quoteDiscoveryFlight(context, token, invalid));
});

void test('private projected offers show a later-turn fixed range, ordinary allowance and response locks without consuming custody', () => {
  const { context, token } = fixture();
  const projected = { ...context, discoveries: projectDiscoveryState(context.discoveries!, 'atreides') };
  const before = structuredClone(projected);
  assert.deepEqual(discoveryFlightOffer(projected, 'p', { movesAllowed: 1 }), {
    token, acquiredTurn: 2, range: 3, blocked: null,
  });
  assert.equal(discoveryFlightOffer(projected, 'q'), null);
  assert.match(discoveryFlightOffer({ ...projected, turn: 2 }, 'p')!.blocked!, /turn after/);
  assert.match(discoveryFlightOffer({ ...projected, phase: 7 }, 'p')!.blocked!, /own Shipment/);
  assert.match(discoveryFlightOffer(projected, 'p', { movesAllowed: 0 })!.blocked!, /No ordinary movement/);
  assert.equal(discoveryFlightOffer(projected, 'p', { blocked: 'Finish the current response.' })!.blocked, 'Finish the current response.');
  // It replaces one action's movement range; neither Kulon nor a card adds to it.
  const otherBenefits = { ...projected, choamMovement: { turn: 3, bonus: 1 }, ornithopter: { mode: 'range3' } };
  assert.equal(discoveryFlightOffer(otherBenefits, 'p')!.range, 3);
  assert.deepEqual(projected, before);
  const badView = reload(projected);
  badView.discoveries.tokens[0].face = null;
  assert.equal(discoveryFlightOffer(badView, 'p'), null);
});

void test('missing or duplicated physical custody cannot authenticate a saved flight', () => {
  const { context, token, move } = fixture(), receipt = quoteDiscoveryFlight(context, token, move);
  const missing = { ...context, discoveries: undefined };
  rejectedUnchanged(missing, () => quoteDiscoveryFlight(missing, token, move));
  const duplicated = reload(context);
  duplicated.discoveries!.tokens[0].id = token as DiscoveryOpaqueTokenId;
  rejectedUnchanged(duplicated, () => validateDiscoveryFlight(duplicated, receipt, move));
  const wrongReceipt = { ...receipt, token: 'invalid' } as unknown as DiscoveryFlightReceipt;
  rejectedUnchanged(context, () => validateDiscoveryFlight(context, wrongReceipt, move));
});
