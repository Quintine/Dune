import assert from 'node:assert/strict';
import test from 'node:test';
import { type Game } from '../game/engine';
import { MOBILE_LOCATION } from '../game/board';
import { createSemutaIxianMovementFixture as fixture, actSemutaIxianMovement as act,
  allowSemutaIxianMovement as allow, semutaIxianMovementPlayer as player,
  semutaIxianMovementInventory as inventory } from './fixture-semuta-ixian-movement';

function spiceTotal(game: Game) {
  return Object.values(game.spice).reduce((sum, amount) => sum + amount, 0) +
    game.players.reduce((sum, p) => sum + p.spice, 0);
}
function forceTotals(game: Game) {
  return game.players.map(p => ({ id:p.id,
    total:p.reserves + p.tanks + Object.values(p.forces).reduce((sum, amount) => sum + amount, 0),
    elites:p.elites ? p.elites.reserves + p.elites.tanks +
      Object.values(p.elites.forces).reduce((sum, amount) => sum + amount, 0) : 0 }));
}
function selections(route: readonly string[], pile: string, amount: number) {
  return route.map(location => ({ location, amount:location === pile ? amount : 0 }));
}

for (const advanced of [false, true]) {
  const mode = advanced ? 'Advanced' : 'Basic';
  void test(`${mode} native HMS collection counts foreign passengers for explicit choices while preserving legacy fallback`, () => {
    const f = fixture({ kind:'mobileStronghold', advanced });
    const source = structuredClone(f.beforeDeclaration), route = f.route!, pile = f.collection[0].location;
    const originalForces = forceTotals(source), originalSpice = spiceTotal(source);
    const ix = player(source, f.owner), foreign = player(source, 'atreides');

    // Stage one Ixian and two foreign fighters aboard using existing counters.
    assert.equal(ix.forces[MOBILE_LOCATION], 6);
    assert.equal(ix.elites!.forces[MOBILE_LOCATION], 3);
    ix.forces[MOBILE_LOCATION] = 1; ix.reserves += 5;
    ix.elites!.forces[MOBILE_LOCATION] = 1; ix.elites!.reserves += 2;
    assert.ok(foreign.reserves >= 2);
    foreign.reserves -= 2;
    foreign.forces[MOBILE_LOCATION] = (foreign.forces[MOBILE_LOCATION] ?? 0) + 2;
    assert.equal(foreign.forces[MOBILE_LOCATION], 2);

    // Concentrate existing spice on a visited sand sector. If the native blow
    // is too small, transfer the difference from a player's existing supply.
    const boardSpice = Object.values(source.spice).reduce((sum, amount) => sum + amount, 0);
    source.spice = { [pile]:boardSpice };
    if (boardSpice < 7) {
      const difference = 7 - boardSpice;
      const donor = source.players.find(p => p.spice >= difference);
      assert.ok(donor);
      donor.spice -= difference; source.spice[pile] += difference;
    }
    assert.equal(spiceTotal(source), originalSpice);
    assert.deepEqual(forceTotals(source), originalForces);
    const before = structuredClone(source);

    assert.throws(() => act(source, f.owner, { type:'decision', route, collect:true,
      collections:selections(route, pile, 7) }));
    assert.deepEqual(source, before, 'Rejected choices do not mutate the game');

    let pending = act(source, f.owner, { type:'decision', route, collect:true,
      collections:selections(route, pile, 6) });
    assert.equal(pending.response?.kind, 'mobileStronghold');
    assert.deepEqual(pending.spice, source.spice, 'A cancelable move does not collect yet');
    let done = allow(pending);
    assert.equal(player(done, f.owner).spice, player(source, f.owner).spice + 6);
    assert.equal(player(done, 'atreides').spice, player(source, 'atreides').spice);
    assert.equal(done.spice[pile] ?? 0, source.spice[pile] - 6);
    assert.equal(spiceTotal(done), originalSpice);
    assert.deepEqual(forceTotals(done), originalForces);
    assert.deepEqual(inventory(done), f.originalInventory);

    // Omitted allocations retain the historical Ixian-only fallback for old
    // clients and queued moves, even though explicit choices count passengers.
    pending = act(source, f.owner, { type:'decision', route, collect:true });
    done = allow(pending);
    assert.equal(player(done, f.owner).spice, player(source, f.owner).spice + 2);
    assert.equal(done.spice[pile] ?? 0, source.spice[pile] - 2);
    assert.equal(spiceTotal(done), originalSpice);
    assert.deepEqual(forceTotals(done), originalForces);
    assert.deepEqual(inventory(done), f.originalInventory);
  });
}
