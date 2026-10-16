import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { ownedTech } from '../game/tech-tokens';
import { RECRUITS_CARD_ID } from '../game/recruits';
import { assertRecruitsHomeworldInventory } from './fixture-recruits-homeworld';
import {
  createWorldPhaseRecruitsFixture, worldPhaseRecruitsNativePool as pool,
  worldPhaseRecruitsPlayer as player,
} from './fixture-world-phase-recruits';

function rejectsUnchanged(game: Game, actor: string, action: Action): void {
  const before = JSON.stringify(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.equal(JSON.stringify(game), before, 'Rejected spending/returns must preserve the actual programme');
}

const cases = [
  { name: 'Basic World + Tech', advanced: false, strongholds: false },
  { name: 'Advanced World + Tech', advanced: true, strongholds: false },
  { name: 'Advanced World + Tech + earned Strongholds', advanced: true, strongholds: true },
];

for (const options of cases) {
  void test(`${options.name}: original casualties, useful doubled typed returns and one delayed Axlotl payment`, () => {
    const f = createWorldPhaseRecruitsFixture(options);
    const { emperor, fremen, atreides, guild, owner } = f.actors;
    const start = f.game;
    assert.equal(player(start, fremen).reserves, 2);
    assert.equal(player(start, fremen).tanks, 18);
    assert.equal(player(start, fremen).elites!.tanks, 3);
    assert.equal(player(start, atreides).tanks, 10);
    assert.equal(start.techTokens!.production.owner, emperor, 'The real Fremen loss transfers its original token');
    assert.equal(ownedTech(start.techTokens, owner).length, 2);
    assert.equal(start.techTokens!.axlotl.spice, 0);

    assert.deepEqual({ free: f.ordinary.fremen.freeRemaining, limit: f.ordinary.fremen.limit,
      bonus: f.ordinary.fremen.homeworldBonus }, { free: 4, limit: 4, bonus: 1 });
    assert.deepEqual({ free: f.ordinary.atreides.freeRemaining, limit: f.ordinary.atreides.limit },
      { free: 2, limit: 3 });
    const paid = player(f.afterPaidReturn, atreides);
    assert.deepEqual({ revived: paid.revived, free: paid.freeForcesRevived, reserves: paid.reserves,
      tanks: paid.tanks, spice: paid.spice },
    { revived: 3, free: 2, reserves: 13, tanks: 7, spice: player(start, atreides).spice - 2 });
    assert.ok(f.beforePlay.ready.includes(atreides));
    assert.equal(viewGame(f.afterPlay, fremen).revival.freeRemaining, 7);
    assert.equal(viewGame(f.afterPlay, fremen).revival.limit, 7);
    assert.equal(viewGame(f.afterPlay, atreides).revival.freeRemaining, 2,
      'Doubled free allowance subtracts the recorded two free returns, not all three returns');
    assert.equal(viewGame(f.afterPlay, atreides).revival.forcesRemaining, 4);
    const reopened = player(f.beforeFremen, atreides);
    assert.deepEqual({ revived: reopened.revived, free: reopened.freeForcesRevived,
      reserves: reopened.reserves, tanks: reopened.tanks, spice: reopened.spice },
    { revived: 5, free: 4, reserves: 15, tanks: 5, spice: paid.spice });
    assert.deepEqual(pool(f.beforeFremen, atreides), { normal: 15, elite: 0 });

    assert.deepEqual(pool(f.afterTypedReturn, fremen), { normal: 2, elite: 1 });
    const current = viewGame(f.afterTypedReturn, fremen).revival;
    assert.deepEqual({ freeRemaining: current.freeRemaining, forcesRemaining: current.forcesRemaining,
      homeworldBonus: current.homeworldBonus }, { freeRemaining: 5, forcesRemaining: 5, homeworldBonus: 0 });
    assert.equal(current.eliteRemaining, options.advanced ? 0 : 2);
    rejectsUnchanged(f.afterTypedReturn, fremen, { type: 'revive', amount: 6, elite: 0 });
    if (options.advanced)
      rejectsUnchanged(f.afterTypedReturn, fremen, { type: 'revive', amount: 1, elite: 1 });
    const returned = player(f.afterReturns, fremen);
    assert.deepEqual({ revived: returned.revived, free: returned.freeForcesRevived,
      reserves: returned.reserves, tanks: returned.tanks, spice: returned.spice },
    { revived: 6, free: 6, reserves: 8, tanks: 12, spice: player(start, fremen).spice });
    assert.equal(returned.elites!.reserves, 1); assert.equal(returned.elites!.tanks, 2);
    assert.deepEqual(pool(f.afterReturns, fremen), { normal: 7, elite: 1 });
    assert.equal(viewGame(f.afterReturns, fremen).revival.forcesRemaining, 0);
    assert.equal(f.afterReturns.discard.filter(card => card.id === RECRUITS_CARD_ID).length, 1);

    for (const boundary of [f.afterPaidReturn, f.afterPlay, f.beforeFremen,
      f.afterTypedReturn, f.afterReturns, f.beforePhaseEnd]) {
      assert.equal(boundary.techTokens!.axlotl.spice, 2);
      assert.equal(boundary.techTokens!.axlotl.triggeredTurn, 2);
      assert.equal(player(boundary, owner).spice, player(start, owner).spice,
        'Accrued Axlotl spice is not a spendable wallet credit');
    }
    const available = player(f.afterReturns, owner).spice;
    const bribes = viewGame(f.afterReturns, owner).bribeOptions;
    assert.equal(bribes.available, available);
    assert.equal(bribes.blocked, null, 'The spending rejection must be a wallet boundary, not a timing gate');
    assert.equal(bribes.targets.find(target => target.id === fremen)?.maximum, available);
    rejectsUnchanged(f.afterReturns, owner,
      { type: 'bribe', target: fremen, amount: available + f.expected.income });
    const settled = applyAction(f.beforePhaseEnd, f.phaseEndStep.actor, f.phaseEndStep.action);
    assert.equal(settled.phase, 5);
    assert.equal(player(settled, owner).spice, available + 2);
    assert.equal(settled.techTokens!.axlotl.spice, 0);
    assert.equal(settled.techTokens!.axlotl.triggeredTurn, 2);
    assert.equal(player(settled, atreides).spice, paid.spice,
      'Recruits and settlement never refund the earlier paid return');
    assert.equal(player(settled, atreides).revived, 5);
    assert.equal(player(settled, atreides).freeForcesRevived, 4);
    assert.equal(player(settled, fremen).revived, 6);
    assert.equal(player(settled, fremen).freeForcesRevived, 6);

    if (options.strongholds) {
      assert.equal(start.strongholdCards!.claimedTurn, 1);
      assert.equal(start.strongholdCards!.owners.sietch_tabr, emperor);
      assert.equal(start.strongholdCards!.owners.arrakeen, guild);
      assert.equal(start.strongholdCards!.owners.tueks_sietch, guild);
    }
    for (const boundary of [start, f.afterPaidReturn, f.afterPlay, f.afterTypedReturn,
      f.afterReturns, settled]) assertRecruitsHomeworldInventory(boundary);
  });
}

void test('A bulk native low-population request locks its quoted seven, unlike the six separate typed returns', () => {
  const f = createWorldPhaseRecruitsFixture();
  const { fremen } = f.actors;
  const bulk = applyAction(f.beforeFremen, fremen, { type: 'revive', amount: 7, elite: 0 });
  assert.equal(player(bulk, fremen).revived, 7);
  assert.equal(player(bulk, fremen).freeForcesRevived, 7);
  assert.equal(player(bulk, fremen).spice, player(f.beforeFremen, fremen).spice);
  assert.equal(player(bulk, fremen).tanks, 11);
  assert.equal(player(bulk, fremen).elites!.tanks, 3);
  assert.deepEqual(pool(bulk, fremen), { normal: 9, elite: 0 });
  assert.equal(bulk.techTokens!.axlotl.spice, f.expected.income,
    'Another eligible bulk return cannot accrue a second payment in the same original phase');
  assertRecruitsHomeworldInventory(bulk);
});
