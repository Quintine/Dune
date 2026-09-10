import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  viewGame,
  normalizeAutomaticGame,
  type Game,
} from '../game/engine';
import {
  nexusChoamFixture,
  nexusChoamRequest,
  nexusChoamReload,
} from './fixture-nexus-choam';

for (const effect of ['laLaLa', 'baliset', 'jubba'] as const) {
  void test(`CHOAM Cunning ${effect} binds its original suspended operation before a valid-looking saved replacement`, () => {
    const f = nexusChoamFixture(effect);
    const pending = applyAction(f.g, f.owner, nexusChoamRequest(f));
    const g = nexusChoamReload(pending);
    // Each replacement would be legal by itself. It was not the operation
    // which earned this genuine reaction and cannot replace that saved parent.
    if (effect === 'laLaLa') {
      assert.equal(g.pendingRevival!.amount, 3);
      g.pendingRevival!.amount = 2;
      g.pendingRevival!.normalCost = 2;
      g.pendingRevival!.cost = 2;
    } else if (effect === 'baliset') {
      assert.equal(g.pendingChoamMove!.total, 2);
      g.pendingChoamMove!.total = 1;
      g.pendingChoamMove!.group[0][1] = 1;
    } else {
      assert.equal(g.stormResolution!.distance, 3);
      g.stormResolution!.distance = 4;
    }
    const before = JSON.stringify(g);
    const checks: ((state: Game) => unknown)[] = [
      ...g.players.map((p) => (state: Game) => viewGame(state, p.id)),
      (state) => normalizeAutomaticGame(state),
      (state) =>
        applyAction(state, f.target, {
          type: 'card',
          mode: 'cancel',
          card: f.karama,
        }),
      (state) => applyAction(state, f.owner, { type: 'passResponse' }),
    ];
    for (const check of checks) {
      assert.throws(
        () => check(g),
        /CHOAM|Cunning|original|parent|source|continuation/i,
      );
      assert.equal(JSON.stringify(g), before);
    }
  });
}
