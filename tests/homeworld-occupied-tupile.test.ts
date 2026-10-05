import test from 'node:test';
import assert from 'node:assert/strict';
import { nativeHandLimit, type Game } from '../game/engine';
import { HomeworldCustodyError } from '../game/homeworld-custody';
import { homeworldContext } from '../game/homeworld-game';
import {
  completeOccupiedTupileCleanup, createOccupiedTupileState, quoteOccupiedTupileAuthority,
  quoteOccupiedTupileCleanup, syncOccupiedTupileLease, validateOccupiedTupileState,
  type OccupiedTupileState,
} from '../game/homeworld-occupied-tupile';
import { quoteTupileIntelligenceRequest } from '../game/tupile-intelligence';
import { quoteTupileIntelligenceAnswer } from '../game/tupile-intelligence-answer';
import {
  appendTupileIntelligenceObservation, tupileIntelligenceUsedFactions, validateTupileIntelligenceState,
} from '../game/tupile-intelligence-state';
import { quoteMoritaniAtomics } from '../game/moritani-atomics';
import { placeTerror, revealTerror } from '../game/moritani-terror';
import { biddingPhysicalIds, stageBiddingHandSize } from './fixture-homeworld-occupied-bidding';
import { assertDefenseInventory, clearDefenseNative } from './fixture-homeworld-occupied-defenses';
import {
  addTupileForces, discardTupileExcess, freshTupileFixture, occupiedTupileFixture,
  recordTupilePosition, removeTupileForces, restoreTupileNative, TUPILE_WORLD, tupilePlayer,
} from './fixture-homeworld-occupied-tupile';

/** Single parent transaction recipe: choose original held IDs, discard exactly
 * the normal-limit excess, then persist the returned completion ledger. */
function settleAll(game: Game, state: OccupiedTupileState): OccupiedTupileState {
  let next = state;
  for (const receipt of state.cleanups.filter(row => row.status === 'pending')) {
    const quote = quoteOccupiedTupileCleanup(game, next, receipt.event);
    assert.equal(quote.blocked, null);
    discardTupileExcess(game, receipt.player, quote.limit);
    next = completeOccupiedTupileCleanup(game, next, receipt.event, receipt.player);
  }
  return next;
}

void test('fresh setup and opt-in boundary preserve legacy profiles; original one-slot grants use each real receiver capacity', () => {
  const { game, cards } = freshTupileFixture();
  const empty = createOccupiedTupileState(), initial = structuredClone(game);
  assert.equal(quoteOccupiedTupileAuthority(game).status, 'unoccupied');
  assert.equal(syncOccupiedTupileLease(game, empty).state, empty);
  assert.deepEqual(game, initial);
  const occupied = occupiedTupileFixture();
  const quote = quoteOccupiedTupileAuthority(occupied.game);
  assert.equal(quote.provider, 'native');
  assert.equal(quote.source!.occupier, 'occupier');
  assert.deepEqual(quote.holders, ['occupier', 'ally']);
  assert.deepEqual(quote.capacities, [
    { player: 'occupier', normal: 4, occupied: 5 }, { player: 'ally', normal: 8, occupied: 9 },
  ]);
  assert.equal(quote.lowIntelligence, 'suppressed');
  const before = structuredClone(occupied.game), sync = syncOccupiedTupileLease(occupied.game, empty);
  assert.deepEqual(sync.slotHolders, ['occupier', 'ally']);
  assert.deepEqual(occupied.game, before);
  assert.equal(syncOccupiedTupileLease(occupied.game, sync.state).state, sync.state);
  assert.equal(sync.state.leases.length, 1);
  assert.deepEqual(sync.pending, []);
  const legacy = structuredClone(occupied.game);
  delete legacy.homeworldTupilePreview;
  assert.equal(quoteOccupiedTupileAuthority(legacy).status, 'unoccupied');
  assert.equal(quoteOccupiedTupileAuthority(legacy).lowIntelligence, 'available');
  assert.equal(syncOccupiedTupileLease(legacy, empty).state, empty);
  assert.deepEqual(biddingPhysicalIds(game), cards);
  assert.deepEqual(biddingPhysicalIds(occupied.game), occupied.cards);
});

void test('retained Advanced source survives high-native, typed contest, extra armies and turns without another grant', () => {
  const { game, cards } = occupiedTupileFixture(), first = syncOccupiedTupileLease(game, createOccupiedTupileState());
  addTupileForces(game, 'occupier', 2);
  addTupileForces(game, 'fremen', 1, 1);
  restoreTupileNative(game, 11);
  recordTupilePosition(game, 'typed-contest-native-high-and-extra-owner-armies');
  game.turn++;
  recordTupilePosition(game, 'next-original-turn', 'turnStart');
  const before = structuredClone({ game, state: first.state }), quote = quoteOccupiedTupileAuthority(game);
  assert.deepEqual(quote.source, first.authority.source);
  assert.deepEqual(quote.capacities, first.authority.capacities);
  assert.equal(quote.lowIntelligence, 'suppressed');
  const current = syncOccupiedTupileLease(game, first.state);
  assert.equal(current.state, first.state);
  assert.deepEqual(current.pending, []);
  assert.deepEqual({ game, state: first.state }, before);
  assert.deepEqual(biddingPhysicalIds(game), cards);
  assertDefenseInventory(game);
});

void test('Advanced last-force departure closes the original holder lease once and cleanup uses normal 4/8 not occupied 5/9', () => {
  const { game, cards } = occupiedTupileFixture();
  const first = syncOccupiedTupileLease(game, createOccupiedTupileState());
  stageBiddingHandSize(game, 'occupier', 5);
  stageBiddingHandSize(game, 'ally', 9);
  removeTupileForces(game, 'occupier');
  recordTupilePosition(game, 'last-original-force-departure');
  const before = structuredClone({ game, state: first.state }), closed = syncOccupiedTupileLease(game, first.state);
  assert.equal(closed.authority.status, 'unoccupied');
  assert.equal(closed.authority.lowIntelligence, 'available');
  assert.equal(closed.state.current, null);
  assert.deepEqual(closed.slotHolders, []);
  assert.deepEqual(closed.pending.map(row => row.player), ['occupier', 'ally']);
  assert.deepEqual({ game, state: first.state }, before);
  assert.equal(syncOccupiedTupileLease(game, closed.state).state, closed.state);
  for (const [index, limit] of [4, 8].entries()) {
    const receipt = closed.pending[index], plan = quoteOccupiedTupileCleanup(game, closed.state, receipt.event);
    assert.equal(plan.limit, limit);
    assert.equal(plan.excess, 1);
    assert.deepEqual(plan.source, first.authority.source);
    assert.throws(() => completeOccupiedTupileCleanup(game, closed.state, receipt.event, receipt.player), HomeworldCustodyError);
  }
  const settled = settleAll(game, closed.state);
  validateOccupiedTupileState(settled, game);
  assert.deepEqual(settled.cleanups.map(row => row.status), ['completed', 'completed']);
  assert.equal(tupilePlayer(game, 'occupier').hand.length, 4);
  assert.equal(tupilePlayer(game, 'ally').hand.length, 8);
  const done = structuredClone({ game, state: settled });
  assert.throws(() => completeOccupiedTupileCleanup(game, settled, closed.pending[0].event, 'occupier'), HomeworldCustodyError);
  assert.deepEqual({ game, state: settled }, done);
  assert.deepEqual(biddingPhysicalIds(game), cards);
});

void test('reciprocal ally removal and a new ally close only the frozen old ally; asymmetric alliances never grant', () => {
  const { game } = occupiedTupileFixture();
  const first = syncOccupiedTupileLease(game, createOccupiedTupileState());
  stageBiddingHandSize(game, 'ally', 9);
  tupilePlayer(game, 'ally').ally = null;
  const removed = syncOccupiedTupileLease(game, first.state);
  assert.deepEqual(removed.slotHolders, ['occupier']);
  assert.deepEqual(removed.pending.map(row => row.player), ['ally']);
  assert.deepEqual(first.lease!.holders, ['occupier', 'ally']);
  assert.deepEqual(removed.lease!.holders, ['occupier']);
  const settled = settleAll(game, removed.state);
  tupilePlayer(game, 'occupier').ally = 'fremen';
  assert.deepEqual(quoteOccupiedTupileAuthority(game).holders, ['occupier']);
  tupilePlayer(game, 'fremen').ally = 'occupier';
  const changed = syncOccupiedTupileLease(game, settled);
  assert.deepEqual(changed.slotHolders, ['occupier', 'fremen']);
  assert.deepEqual(changed.authority.source, first.authority.source);
  assert.equal(changed.state.leases.length, 3);
  assert.deepEqual(changed.pending, []);
  assert.equal(syncOccupiedTupileLease(game, changed.state).state, changed.state);
  validateOccupiedTupileState(changed.state, game);
});

void test('Advanced turnover and same-player return are new original epochs; pending old cleanup cannot lend new slots or replay', () => {
  const { game } = occupiedTupileFixture(true, false);
  const first = syncOccupiedTupileLease(game, createOccupiedTupileState());
  stageBiddingHandSize(game, 'occupier', 5);
  addTupileForces(game, 'fremen', 0, 1);
  recordTupilePosition(game, 'incoming-typed-contest-retains-owner');
  assert.equal(syncOccupiedTupileLease(game, first.state).state, first.state);
  removeTupileForces(game, 'occupier');
  recordTupilePosition(game, 'old-owner-last-departure-and-new-sole');
  const turnover = syncOccupiedTupileLease(game, first.state);
  assert.equal(turnover.lease!.source.occupier, 'fremen');
  assert.notEqual(turnover.lease!.source.qualification, first.lease!.source.qualification);
  assert.deepEqual(turnover.slotHolders, ['fremen']);
  assert.deepEqual(turnover.pending.map(row => row.player), ['occupier']);
  removeTupileForces(game, 'fremen');
  recordTupilePosition(game, 'successor-last-force-departure');
  const departed = syncOccupiedTupileLease(game, turnover.state);
  addTupileForces(game, 'occupier');
  recordTupilePosition(game, 'same-player-new-sole-return');
  const returned = syncOccupiedTupileLease(game, departed.state);
  assert.equal(returned.lease!.source.occupier, 'occupier');
  assert.notEqual(returned.lease!.source.qualification, first.lease!.source.qualification);
  assert.deepEqual(returned.slotHolders, []);
  const settled = settleAll(game, returned.state), renewed = syncOccupiedTupileLease(game, settled);
  assert.deepEqual(renewed.slotHolders, ['occupier']);
  assert.equal(renewed.state.leases.length, 3);
  assert.throws(() => quoteOccupiedTupileCleanup(game, settled, turnover.pending[0].event), HomeworldCustodyError);
  removeTupileForces(game, 'occupier');
  recordTupilePosition(game, 'returned-owner-new-last-departure');
  const final = syncOccupiedTupileLease(game, settled);
  assert.notEqual(final.pending[0].event, turnover.pending[0].event);
  assert.equal(final.pending[0].lease, 2);
  assert.equal(quoteOccupiedTupileCleanup(game, final.state, final.pending[0].event).excess, 0);
  validateOccupiedTupileState(final.state, game);
});

void test('Basic unobserved turn, contest, native repopulation, competing source and departure remain unknown/read-only, never guessed cleanup', () => {
  for (const mode of ['turn', 'contest', 'nativeHigh', 'departure', 'competitor'] as const) {
    const { game, cards } = occupiedTupileFixture(false);
    const first = syncOccupiedTupileLease(game, createOccupiedTupileState());
    if (mode === 'turn') {
      game.turn++;
      // Controlled incomplete boundary: no current-turn qualification is fabricated.
    } else if (mode === 'nativeHigh') {
      restoreTupileNative(game, 11);
      recordTupilePosition(game, 'pending-native-repopulation');
    } else if (mode === 'departure') {
      removeTupileForces(game, 'occupier');
      recordTupilePosition(game, 'pending-basic-departure');
    } else {
      addTupileForces(game, 'fremen', 1, 1);
      if (mode === 'competitor') removeTupileForces(game, 'occupier');
      recordTupilePosition(game, `pending-basic-${mode}`);
    }
    const before = structuredClone({ game, state: first.state }), quote = quoteOccupiedTupileAuthority(game);
    assert.equal(quote.status, 'unknown');
    assert.equal(quote.lowIntelligence, 'unknown');
    assert.ok(quote.blocked);
    assert.equal(quote.source, null);
    assert.deepEqual(quote.holders, []);
    const result = syncOccupiedTupileLease(game, first.state);
    assert.equal(result.state.current, first.state.current);
    assert.deepEqual(result.pending, []);
    assert.deepEqual({ game, state: first.state }, before);
    assert.deepEqual(biddingPhysicalIds(game), cards);
  }
});

void test('Basic observed continuous turn qualification keeps one existing slot lease without a new cleanup or stacked allowance', () => {
  const { game, cards } = occupiedTupileFixture(false);
  const first = syncOccupiedTupileLease(game, createOccupiedTupileState());
  game.turn++;
  recordTupilePosition(game, 'original-basic-observed-next-turn', 'turnStart');
  const next = syncOccupiedTupileLease(game, first.state);
  assert.equal(next.authority.status, 'occupied');
  assert.equal(next.authority.capacities.find(row => row.player === 'occupier')!.occupied, 5);
  assert.equal(next.authority.capacities.find(row => row.player === 'ally')!.occupied, 9);
  assert.equal(next.state.leases.length, 1);
  assert.equal(next.pending.length, 0);
  assert.deepEqual(biddingPhysicalIds(game), cards);
});

void test('unobserved Advanced writes cannot fabricate a new source or resurrect a closed original epoch', () => {
  const { game } = occupiedTupileFixture(true, false);
  const first = syncOccupiedTupileLease(game, createOccupiedTupileState());
  removeTupileForces(game, 'occupier');
  const closed = syncOccupiedTupileLease(game, first.state);
  assert.equal(closed.authority.status, 'unoccupied');
  addTupileForces(game, 'occupier');
  const stale = structuredClone({ game, state: closed.state });
  assert.throws(() => syncOccupiedTupileLease(game, closed.state), HomeworldCustodyError);
  assert.deepEqual({ game, state: closed.state }, stale);
  const fresh = freshTupileFixture().game;
  clearDefenseNative(fresh, TUPILE_WORLD);
  addTupileForces(fresh, 'occupier');
  const quote = quoteOccupiedTupileAuthority(fresh);
  assert.equal(quote.status, 'unknown');
  assert.equal(quote.source, null);
  assert.equal(syncOccupiedTupileLease(fresh, createOccupiedTupileState()).state.leases.length, 0);
});

void test('native CHOAM cannot receive an allied self-world slot; no alternative provider is chosen', () => {
  const { game } = occupiedTupileFixture(true, false);
  tupilePlayer(game, 'occupier').ally = 'native';
  tupilePlayer(game, 'native').ally = 'occupier';
  const quote = quoteOccupiedTupileAuthority(game);
  assert.equal(quote.status, 'unknown');
  assert.equal(quote.provider, 'native');
  assert.deepEqual(quote.holders, []);
  assert.equal(syncOccupiedTupileLease(game, createOccupiedTupileState()).state.leases.length, 0);
});

void test('strict persisted JSON keeps original source/cleanup epochs and rejects malformed or rewritten grants immutably', () => {
  const { game } = occupiedTupileFixture();
  const first = syncOccupiedTupileLease(game, createOccupiedTupileState());
  removeTupileForces(game, 'occupier');
  recordTupilePosition(game, 'json-original-last-departure');
  const closed = syncOccupiedTupileLease(game, first.state), state = JSON.parse(JSON.stringify(closed.state)) as OccupiedTupileState;
  validateOccupiedTupileState(state, game);
  assert.equal(syncOccupiedTupileLease(game, state).state, state);
  assert.deepEqual(quoteOccupiedTupileCleanup(game, state, closed.pending[0].event).source, first.authority.source);
  const bad = [
    { ...state, signature: 'rewritten' },
    { ...state, current: 0 },
    { ...state, cleanups: state.cleanups.slice(1) },
    { ...state, extra: true },
    { ...state, leases: [{ ...state.leases[0], source: { ...state.leases[0].source, native: 'ally' } }] },
    { ...state, leases: [{ ...state.leases[0], source: { ...state.leases[0].source, signature: 'not original' } }] },
    { ...state, leases: [{ ...state.leases[0], holders: ['occupier', 'native'] }] },
    { ...state, cleanups: [{ ...state.cleanups[0], player: 'fremen' }, state.cleanups[1]] },
  ];
  for (const malformed of bad) {
    // Even a newly computed consistency signature cannot rewrite source identity.
    const signed = { ...malformed, signature: JSON.stringify([1, malformed.leases, malformed.current, malformed.cleanups]) };
    const candidate = malformed.signature === 'rewritten' ? malformed : signed;
    const before = structuredClone({ game, candidate });
    assert.throws(() => validateOccupiedTupileState(candidate as OccupiedTupileState, game), HomeworldCustodyError);
    assert.deepEqual({ game, candidate }, before);
  }
  assert.throws(() => completeOccupiedTupileCleanup(game, state, closed.pending[0].event, 'fremen'), HomeworldCustodyError);
  assert.throws(() => quoteOccupiedTupileCleanup(game, state, 'other-epoch'), HomeworldCustodyError);
});

void test('suppression and Advanced expiry preserve actual historical private intelligence and lifetime faction use', () => {
  const { game } = freshTupileFixture();
  clearDefenseNative(game, TUPILE_WORLD);
  restoreTupileNative(game, 1);
  addTupileForces(game, 'occupier');
  recordTupilePosition(game, 'native-low-contact-without-sole-qualification');
  const request = quoteTupileIntelligenceRequest(homeworldContext(game), game.homeworlds!.custody!, 'native', [],
    quoteOccupiedTupileAuthority(game).status, 'occupier', 'weapons');
  const target = tupilePlayer(game, 'occupier');
  const answer = quoteTupileIntelligenceAnswer(target.hand, target.spice, request.category);
  game.tupileIntelligence = appendTupileIntelligenceObservation(game.tupileIntelligence!, {
    ...request, ...answer, event: 'controlled-actual-original-contact-answer', turn: game.turn, phase: game.phase,
  });
  const observed = structuredClone(game.tupileIntelligence);
  clearDefenseNative(game, TUPILE_WORLD);
  recordTupilePosition(game, 'native-last-force-leaves-sole-occupation');
  const first = syncOccupiedTupileLease(game, createOccupiedTupileState());
  assert.equal(first.authority.lowIntelligence, 'suppressed');
  assert.throws(() => quoteTupileIntelligenceRequest(homeworldContext(game), game.homeworlds!.custody!, 'native',
    tupileIntelligenceUsedFactions(game.tupileIntelligence!), first.authority.status, 'occupier', 'defenses'), HomeworldCustodyError);
  removeTupileForces(game, 'occupier');
  recordTupilePosition(game, 'intelligence-owner-epoch-expires');
  syncOccupiedTupileLease(game, first.state);
  validateTupileIntelligenceState(game.tupileIntelligence!, game.players, game.turn);
  assert.deepEqual(game.tupileIntelligence, observed);
  assert.deepEqual(tupileIntelligenceUsedFactions(game.tupileIntelligence!), ['guild']);
  assert.deepEqual(game.tupileIntelligence!.receipts[0].spice, answer.spice);
  assert.deepEqual(game.tupileIntelligence!.receipts[0].count, answer.count);
});

void test('original Atomics hand reduction composes with one Tupile slot and cleanup returns to penalized normal capacity', () => {
  // Pure-authority composition position, NOT a claim that the current engine
  // enables combined Atomics/Homeworld arrival play. Original setup/cards and
  // the actual original placed/revealed token supply all provenance.
  const { game, cards } = freshTupileFixture(true, 'moritani');
  const owner = tupilePlayer(game, 'occupier'), ally = tupilePlayer(game, 'ally');
  owner.ally = ally.id;
  ally.ally = owner.id;
  clearDefenseNative(game, TUPILE_WORLD);
  addTupileForces(game, owner.id);
  recordTupilePosition(game, 'composition-sole-owner-with-original-ally');
  const token = game.moritaniTerror!.tokens.find(row => row.kind === 'atomics')!;
  game.moritaniTerror = placeTerror(game.moritaniTerror!, token.id, 'arrakeen', game.turn);
  const placed = game.moritaniTerror.tokens.find(row => row.id === token.id)!;
  const plan = quoteMoritaniAtomics({ token: placed, territory: 'arrakeen', moritaniId: owner.id,
    turn: game.turn, aftermath: null, players: game.players.map(player => ({ ...player,
      handSize: player.hand.length, baseHandLimit: nativeHandLimit(player) })) });
  game.moritaniTerror = revealTerror(game.moritaniTerror, token.id);
  game.moritaniAtomics = plan.aftermath;
  for (const casualty of plan.casualties) {
    const player = tupilePlayer(game, casualty.playerId);
    player.forces[casualty.location] -= casualty.normal + casualty.elite;
    player.tanks += casualty.normal + casualty.elite;
    if (casualty.elite) {
      player.elites!.forces[casualty.location] -= casualty.elite;
      player.elites!.tanks += casualty.elite;
    }
  }
  for (const reduction of plan.handReductions) {
    tupilePlayer(game, reduction.playerId).atomicsHandLimitPenalty = true;
    discardTupileExcess(game, reduction.playerId, reduction.limit);
  }
  const first = syncOccupiedTupileLease(game, createOccupiedTupileState());
  assert.deepEqual(first.authority.capacities, [
    { player: 'occupier', normal: 3, occupied: 4 }, { player: 'ally', normal: 7, occupied: 8 },
  ]);
  stageBiddingHandSize(game, 'occupier', 4);
  stageBiddingHandSize(game, 'ally', 8);
  removeTupileForces(game, 'occupier');
  recordTupilePosition(game, 'composition-original-last-departure');
  const closed = syncOccupiedTupileLease(game, first.state);
  assert.deepEqual(closed.pending.map(row => quoteOccupiedTupileCleanup(game, closed.state, row.event).limit), [3, 7]);
  settleAll(game, closed.state);
  assert.equal(owner.hand.length, 3);
  assert.equal(ally.hand.length, 7);
  assert.deepEqual(biddingPhysicalIds(game), cards);
  assertDefenseInventory(game);
});

void test('direct reciprocal ally replacement freezes former-holder cleanup and Basic uncertainty blocks its settlement without changing receipts', () => {
  const { game } = occupiedTupileFixture(false);
  const first = syncOccupiedTupileLease(game, createOccupiedTupileState());
  stageBiddingHandSize(game, 'ally', 9);
  tupilePlayer(game, 'ally').ally = null;
  tupilePlayer(game, 'occupier').ally = 'fremen';
  tupilePlayer(game, 'fremen').ally = 'occupier';
  const replacement = syncOccupiedTupileLease(game, first.state);
  assert.deepEqual(replacement.slotHolders, ['occupier', 'fremen']);
  assert.deepEqual(replacement.pending.map(row => row.player), ['ally']);
  const event = replacement.pending[0].event;
  assert.equal(quoteOccupiedTupileCleanup(game, replacement.state, event).limit, 8);
  assert.equal(quoteOccupiedTupileCleanup(game, replacement.state, event).excess, 1);
  removeTupileForces(game, 'occupier');
  recordTupilePosition(game, 'pending-basic-expiry-with-original-former-ally-cleanup');
  const before = structuredClone({ game, state: replacement.state });
  const unknown = syncOccupiedTupileLease(game, replacement.state);
  assert.equal(unknown.authority.status, 'unknown');
  assert.equal(unknown.state, replacement.state);
  const blocked = quoteOccupiedTupileCleanup(game, replacement.state, event);
  assert.ok(blocked.blocked);
  assert.equal(blocked.receipt.player, 'ally');
  assert.equal(blocked.source.occupier, 'occupier');
  assert.deepEqual({ game, state: replacement.state }, before);
  // A separate conserved hand transfer is not permission to settle unknown expiry.
  stageBiddingHandSize(game, 'ally', 8);
  const blockedBefore = structuredClone({ game, state: replacement.state });
  assert.throws(() => completeOccupiedTupileCleanup(game, replacement.state, event, 'ally'), HomeworldCustodyError);
  assert.deepEqual({ game, state: replacement.state }, blockedBefore);
});

void test('an active Tupile marker without its original occupation profile is unknown and cannot close existing grants', () => {
  const { game } = occupiedTupileFixture();
  const first = syncOccupiedTupileLease(game, createOccupiedTupileState());
  delete game.homeworldOccupationPreview;
  const before = structuredClone({ game, state: first.state });
  const quote = quoteOccupiedTupileAuthority(game);
  assert.equal(quote.status, 'unknown');
  assert.equal(quote.source, null);
  assert.deepEqual(quote.holders, []);
  assert.equal(syncOccupiedTupileLease(game, first.state).state, first.state);
  assert.deepEqual({ game, state: first.state }, before);
});
