import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame } from '../game/engine';
import { quoteVictory } from '../game/victory-quote';
import { fremenEcazFinalTurn, finishFremenEcazTurn, fremenEcazCustody } from './fixture-fremen-ecaz-victory';

for (const advanced of [false, true])
  void test(`${advanced ? 'Advanced' : 'Basic'} final-turn co-occupation wins through real readiness without BG prediction or Guild stealing it`, () => {
    const g = fremenEcazFinalTurn(advanced), before = structuredClone(g);
    const done = finishFremenEcazTurn(g);
    assert.deepEqual(done.winner, ['fr', 'ec']);
    assert.deepEqual(g, before);
    assert.deepEqual(fremenEcazCustody(done), fremenEcazCustody(g));
    assert.match(done.log.at(-1)!.text, /Fremen special victory.*Allied Ecaz and Fremen/);
    for (const p of g.players) {
      const view = viewGame(done, p.id);
      assert.equal(view.fremenVictory?.qualifies, true);
      assert.deepEqual(viewGame(JSON.parse(JSON.stringify(done)), p.id), view);
      for (const other of view.players.filter((r) => r.id !== p.id))
        for (const field of ['spice', 'hand', 'traitors', 'prediction']) assert.equal(field in other, false);
    }
    assert.throws(() => applyAction(done, 'fr', { type: 'ready' }));
  });

void test('all four AI profiles complete the same settled qualifying board without changing cards or forces', () => {
  const g = fremenEcazFinalTurn();
  for (const profile of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const done = finishFremenEcazTurn(g, profile);
    assert.deepEqual(done.winner, ['fr', 'ec']);
    assert.deepEqual(fremenEcazCustody(done), fremenEcazCustody(g));
  }
});

void test('prospective guide does not award an early victory and a normal winner retains precedence', () => {
  const g = fremenEcazFinalTurn();
  g.turn = 9;
  assert.equal(viewGame(g, 'ec').fremenVictory?.qualifies, true);
  assert.deepEqual(quoteVictory(g).winner, []);
  g.turn = 10;
  const guild = g.players[2];
  guild.forces = { 'arrakeen:10': 1, 'carthag:11': 1, 'tueks_sietch:5': 1 };
  guild.reserves -= 3;
  assert.deepEqual(finishFremenEcazTurn(g).winner, ['gu']);
});

void test('no alliance, absent Fremen, a third faction and the unresolved Habbanya extension do not create the exception', () => {
  for (const kind of ['unallied', 'fremenAbsent', 'thirdFaction', 'habbanya'] as const) {
    const g = fremenEcazFinalTurn();
    if (kind === 'unallied') for (const p of g.players.slice(0, 2)) p.ally = null;
    if (kind === 'fremenAbsent') { g.players[1].reserves += 3; g.players[1].forces = {}; }
    if (kind === 'thirdFaction') { g.players[2].reserves--; g.players[2].forces['sietch_tabr:14'] = 1; }
    if (kind === 'habbanya') for (const p of g.players.slice(0, 2)) p.forces = { 'habbanya_ridge_sietch:17': 3 };
    assert.equal(viewGame(g, 'ec').fremenVictory?.qualifies, false);
    const done = finishFremenEcazTurn(g);
    assert.deepEqual(done.winner, ['gu']);
    assert.doesNotMatch(done.log.at(-1)!.text, /Fremen special victory/);
  }
});
