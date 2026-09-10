import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  normalizeAutomaticGame,
  viewGame,
  type Game,
} from '../game/engine';
import { quotePlacementCancellation } from '../game/placement-cancellation';
import { placeTerror } from '../game/moritani-terror';
import {
  grummanCollectionFixture,
  enterGrummanCollection,
  addGrummanToken,
  holdGrummanCard,
  grummanToken,
  grummanPlayer,
  grummanReload,
  grummanInventory,
} from './fixture-grumman-collection';

function pendingPlacement(advanced = false, low = false) {
  const initial = grummanCollectionFixture({ advanced });
  const karama = holdGrummanCard(initial, 'a', 'karama');
  let g = addGrummanToken(enterGrummanCollection(initial));
  if (low) {
    // Conserved later position: the existing legal stack outlives its creating
    // high-side population. Actual phase actions record this physical change.
    grummanPlayer(g, 'm').reserves--;
    grummanPlayer(g, 'm').forces['polar_sink:0']++;
  }
  for (const player of g.players)
    g = applyAction(g, player.id, { type: 'ready' });
  assert.equal(g.phase, 8);
  assert.equal(g.decision?.kind, 'moritaniPlacement');
  g = applyAction(g, 'm', {
    type: 'decision',
    token: grummanToken(g, 'assassination').id,
    territory: 'carthag',
  });
  assert.equal(g.response?.kind, 'moritaniPlacement');
  assert.equal(
    g.moritaniTerror!.tokens.filter((token) => token.location === 'arrakeen')
      .length,
    2,
  );
  return { g, action: { type: 'card', card: karama.id, mode: 'cancel' } };
}

void test('real Basic and Advanced Grumman stacks survive printed Karama canceling the separate Mentat placement', () => {
  for (const advanced of [false, true]) {
    const { g, action } = pendingPlacement(advanced);
    const before = grummanReload(g);
    const result = applyAction(grummanReload(g), 'a', action);
    assert.deepEqual(g, before);
    assert.deepEqual(result.moritaniTerror!.tokens, g.moritaniTerror!.tokens);
    assert.equal(result.moritaniTerror!.placementTurn, g.turn);
    assert.equal(result.pendingMoritaniPlacement, null);
    assert.equal(
      result.discard.filter((card) => card.id === action.card).length,
      1,
    );
    assert.equal(grummanPlayer(result, 'm').spice, 24);
    assert.equal(grummanToken(result, 'assassination').status, 'available');
    assert.throws(
      () =>
        placeTerror(
          result.moritaniTerror!,
          grummanToken(result, 'assassination').id,
          'carthag',
          g.turn,
        ),
      /already been used/,
    );
    assert.throws(() => applyAction(result, 'a', action));
    assert.deepEqual(normalizeAutomaticGame(grummanReload(result)), result);
    for (const id of ['a', 'g']) {
      const projected = viewGame(result, id);
      assert.ok(
        projected.moritaniTerror!.tokens.every((token) => !('kind' in token)),
      );
      assert.equal(
        projected.players.find((player) => player.id === 'm')!.hand,
        undefined,
      );
    }
    grummanInventory(result);
  }
});

void test('placement denial preserves an earlier stack at low population and the pure quote accepts a later turn without private hands', () => {
  const { g, action } = pendingPlacement(true, true);
  assert.equal(grummanPlayer(g, 'm').reserves, 7);
  const result = applyAction(grummanReload(g), 'a', action);
  assert.deepEqual(result.moritaniTerror!.tokens, g.moritaniTerror!.tokens);
  grummanInventory(result);
  // This is a pure future-turn eligibility probe, not a fabricated live phase
  // transition. Existing placement history remains unchanged.
  const later = grummanReload(g);
  later.turn++;
  later.pendingMoritaniPlacement!.turn = later.turn;
  for (const player of later.players)
    for (const field of ['hand', 'spice', 'traitors'])
      Object.defineProperty(player, field, {
        get() {
          throw new Error('Private field read: ' + field);
        },
      });
  const quote = quotePlacementCancellation(later, later.response!);
  assert.equal(quote?.kind, 'moritaniPlacement');
  if (quote?.kind !== 'moritaniPlacement')
    assert.fail('Missing placement denial');
  assert.deepEqual(quote.terror.tokens, g.moritaniTerror!.tokens);
  assert.equal(quote.terror.placementTurn, later.turn);
});

void test('denial tolerates changed placement feasibility but rejects malformed custody and source records without cost', () => {
  const { g, action } = pendingPlacement();
  const changedPlacements: [string, (bad: Game) => void][] = [
    [
      'removed source',
      (bad) => {
        grummanToken(bad, 'assassination').status = 'removed';
      },
    ],
    [
      'extortion source',
      (bad) => {
        const token = grummanToken(bad, 'extortion');
        token.status = 'extortion';
        bad.pendingMoritaniPlacement!.token = token.id;
      },
    ],
    [
      'same source and target',
      (bad) => {
        bad.pendingMoritaniPlacement!.token = grummanToken(bad, 'robbery').id;
        bad.pendingMoritaniPlacement!.territory = 'arrakeen';
      },
    ],
    [
      'occupied destination',
      (bad) => {
        bad.pendingMoritaniPlacement!.territory = 'arrakeen';
      },
    ],
  ];
  // Denying a declared placement does not attempt it again. Changed source
  // availability or an occupied target must not turn cancellation into a move.
  for (const [label, edit] of changedPlacements) {
    const changed = grummanReload(g);
    edit(changed);
    const before = grummanReload(changed);
    const quoted = quotePlacementCancellation(changed, changed.response!);
    assert.equal(quoted?.kind, 'moritaniPlacement', label);
    const canceled = applyAction(changed, 'a', action);
    assert.deepEqual(
      canceled.moritaniTerror!.tokens,
      changed.moritaniTerror!.tokens,
      label,
    );
    assert.equal(canceled.moritaniTerror!.placementTurn, changed.turn, label);
    assert.deepEqual(changed, before, label);
    grummanInventory(canceled);
  }
  const edits: [string, (bad: Game) => void][] = [
    [
      'non-stronghold target',
      (bad) => {
        bad.pendingMoritaniPlacement!.territory = 'polar_sink';
      },
    ],
    [
      'missing token',
      (bad) => {
        bad.pendingMoritaniPlacement!.token = 'not-a-token';
      },
    ],
    [
      'duplicate physical ID',
      (bad) => {
        bad.moritaniTerror!.tokens[0].id = bad.moritaniTerror!.tokens[1].id;
      },
    ],
    [
      'duplicate physical face',
      (bad) => {
        bad.moritaniTerror!.tokens[0].kind = bad.moritaniTerror!.tokens[1].kind;
      },
    ],
    [
      'malformed status',
      (bad) => {
        Object.assign(grummanToken(bad, 'assassination'), {
          status: 'invented',
        });
      },
    ],
    [
      'stale declaration',
      (bad) => {
        bad.pendingMoritaniPlacement!.turn--;
      },
    ],
    [
      'wrong faction owner',
      (bad) => {
        bad.response!.owner = 'a';
      },
    ],
    [
      'duplicate response owner',
      (bad) => {
        bad.players.push(structuredClone(grummanPlayer(bad, 'm')));
      },
    ],
  ];
  for (const [label, edit] of edits) {
    const bad = grummanReload(g);
    edit(bad);
    const before = grummanReload(bad);
    assert.throws(
      () => quotePlacementCancellation(bad, bad.response!),
      /./,
      label,
    );
    assert.throws(() => applyAction(bad, 'a', action), /./, label);
    assert.deepEqual(bad, before, label);
  }
});
