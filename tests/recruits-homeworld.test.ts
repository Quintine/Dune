import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { RECRUITS_CARD_ID } from '../game/recruits';
import {
  advanceRecruitsHomeworld, assertRecruitsHomeworldInventory,
  createRecruitsHomeworldFixture, recruitsHomeworldClean, recruitsHomeworldPlayer,
} from './fixture-recruits-homeworld';
import {
  createHarassHomeworldArrakisFixture, revealHarassHomeworldArrakisBattle,
  finishHarassHomeworldArrakisBattle,
} from './fixture-harass-homeworld-arrakis';
import { takeHarassCard } from './fixture-harass-withdraw';

const play = { type: 'card', card: RECRUITS_CARD_ID } as const;
function rejectsUnchanged(game: Game, actor: string, action: Action): void {
  const before = JSON.stringify(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.equal(JSON.stringify(game), before);
}
const nativeGroup = (game: Game, actor: string, secondary = false) => {
  const worlds = viewGame(game, actor).homeworlds?.worlds;
  assert.ok(worlds, 'Native revival must retain its actual Homeworld custody view');
  const world = worlds.find(w => w.native === actor && w.secondary === secondary);
  assert.ok(world); return world.forces[actor];
};

for (const advanced of [false, true]) {
  const mode = advanced ? 'Advanced' : 'Basic';
  void test(`${mode} native low Fremen may accept seven free together but never eight or seven additional returns`, () => {
    let game = createRecruitsHomeworldFixture({ advanced }).game;
    const before = recruitsHomeworldPlayer(game, 'fremen');
    const spice = before.spice;
    game = applyAction(game, 'emperor', play);
    rejectsUnchanged(game, 'fremen', { type: 'revive', amount: 8, elite: 0 });
    game = applyAction(game, 'fremen', { type: 'revive', amount: 7, elite: 0 });
    const after = recruitsHomeworldPlayer(game, 'fremen');
    assert.deepEqual({ reserves: after.reserves, tanks: after.tanks, revived: after.revived,
      free: after.freeForcesRevived, spice: after.spice },
    { reserves: 9, tanks: 11, revived: 7, free: 7, spice });
    assert.deepEqual(nativeGroup(game, 'fremen'), { normal: 9, elite: 0 });
    assert.equal(after.elites!.tanks, 3);
    assert.equal(viewGame(game, 'fremen').revival.forcesRemaining, 0);
    rejectsUnchanged(game, 'fremen', { type: 'revive', amount: 1, elite: 0 });
    assert.equal(game.discard.filter(c => c.id === RECRUITS_CARD_ID).length, 1);
    assertRecruitsHomeworldInventory(game);
  });

  void test(`${mode} separate Recruits requests recheck crossed Fremen population and do not grant a paid seventh without Tleilaxu`, () => {
    let game = applyAction(createRecruitsHomeworldFixture({ advanced }).game, 'emperor', play);
    const spice = recruitsHomeworldPlayer(game, 'fremen').spice;
    game = applyAction(game, 'fremen', { type: 'revive', amount: 1, elite: 0 });
    const quote = viewGame(game, 'fremen');
    assert.equal(quote.revival.homeworldBonus, 0);
    assert.equal(quote.revival.freeRemaining, 5);
    assert.equal(quote.recruitsPreview!.rates.find(r => r.player === 'fremen')!.freeRate, 6);
    rejectsUnchanged(game, 'fremen', { type: 'revive', amount: 6, elite: 0 });
    game = applyAction(game, 'fremen', { type: 'revive', amount: 5, elite: 0 });
    const after = recruitsHomeworldPlayer(game, 'fremen');
    assert.equal(after.revived, 6);
    assert.equal(after.freeForcesRevived, 6);
    assert.equal(after.reserves, 8);
    assert.equal(after.spice, spice);
    assert.equal(viewGame(game, 'fremen').revival.limit, 7);
    assert.equal(viewGame(game, 'fremen').revival.forcesRemaining, 0);
    rejectsUnchanged(game, 'fremen', { type: 'revive', amount: 1, elite: 0 });
    assertRecruitsHomeworldInventory(game);
  });

  void test(`${mode} Recruits preserves typed Fedaykin deposits and native special-force revival limits`, () => {
    let game = applyAction(createRecruitsHomeworldFixture({ advanced }).game, 'emperor', play);
    game = applyAction(game, 'fremen', { type: 'revive', amount: 1, elite: 1 });
    game = advanceRecruitsHomeworld(game, recruitsHomeworldClean);
    assert.deepEqual(nativeGroup(game, 'fremen'), { normal: 2, elite: 1 });
    assert.equal(recruitsHomeworldPlayer(game, 'fremen').elites!.tanks, 2);
    assert.equal(viewGame(game, 'fremen').revival.eliteRemaining, advanced ? 0 : 2);
    if (advanced) rejectsUnchanged(game, 'fremen', { type: 'revive', amount: 1, elite: 1 });
    else {
      game = applyAction(game, 'fremen', { type: 'revive', amount: 2, elite: 2 });
      assert.deepEqual(nativeGroup(game, 'fremen'), { normal: 2, elite: 3 });
      assert.equal(recruitsHomeworldPlayer(game, 'fremen').elites!.tanks, 0);
    }
    assertRecruitsHomeworldInventory(game);
  });

  void test(`${mode} recorded paid native returns keep their cost and an already-ready Atreides can use the added free allowance`, () => {
    let game = createRecruitsHomeworldFixture({ advanced }).game;
    const spice = recruitsHomeworldPlayer(game, 'atreides').spice;
    game = applyAction(game, 'atreides', { type: 'revive', amount: 3, elite: 0 });
    game = applyAction(game, 'atreides', { type: 'ready' });
    game = applyAction(game, 'emperor', play);
    const quote = viewGame(game, 'atreides').revival;
    assert.equal(quote.freeRemaining, 2);
    assert.equal(quote.forcesRemaining, 4);
    game = applyAction(game, 'atreides', { type: 'revive', amount: 2, elite: 0 });
    const after = recruitsHomeworldPlayer(game, 'atreides');
    assert.equal(after.spice, spice - 2);
    assert.equal(after.revived, 5);
    assert.equal(after.freeForcesRevived, 4);
    assert.deepEqual(nativeGroup(game, 'atreides'), { normal: 15, elite: 0 });
    assert.equal(after.tanks, 5);
    assert.equal(viewGame(game, 'atreides').revival.freeRemaining, 0);
    assertRecruitsHomeworldInventory(game);
  });

  void test(`${mode} an actual mixed Sardaukar loss revives free through original native destinations`, () => {
    const fixture = createHarassHomeworldArrakisFixture({ advanced, outcome: 'loser' });
    let game = finishHarassHomeworldArrakisBattle(revealHarassHomeworldArrakisBattle(fixture),
      { returns: { [fixture.location]: { normal: 2, elite: 3 } } });
    game = advanceRecruitsHomeworld(game, g => g.turn === 2 && g.phase === 4 && recruitsHomeworldClean(g));
    takeHarassCard(game, fixture.owner, RECRUITS_CARD_ID);
    const spice = recruitsHomeworldPlayer(game, fixture.owner).spice;
    game = applyAction(game, fixture.owner, play);
    game = applyAction(game, fixture.owner, { type: 'revive', amount: 2, elite: 1 });
    const after = recruitsHomeworldPlayer(game, fixture.owner);
    assert.equal(after.reserves, 20);
    assert.equal(after.tanks, 0);
    assert.equal(after.elites!.reserves, 5);
    assert.equal(after.elites!.tanks, 0);
    assert.equal(after.spice, spice);
    assert.equal(after.freeForcesRevived, 2);
    assert.deepEqual(nativeGroup(game, fixture.owner), { normal: 15, elite: advanced ? 0 : 5 });
    if (advanced) assert.deepEqual(nativeGroup(game, fixture.owner, true), { normal: 0, elite: 5 });
    assertRecruitsHomeworldInventory(game);
  });
}
