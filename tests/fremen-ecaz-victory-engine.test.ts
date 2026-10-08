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

void test('Advanced reciprocal Fremen/Ecaz cooccupation qualifies in both sietches while Basic stays Tabr-only', () => {
  for (const advanced of [false, true])
    for (const territory of ['sietch_tabr', 'habbanya_ridge_sietch']) {
      const g = fremenEcazFinalTurn(advanced);
      const key = territory === 'sietch_tabr' ? 'sietch_tabr:14' : 'habbanya_ridge_sietch:17';
      for (const p of g.players.slice(0, 2)) p.forces = { [key]: 3 };
      const before = structuredClone(g);
      const qualifies = advanced || territory === 'sietch_tabr';
      const guide = viewGame(g, 'ec').fremenVictory!;
      assert.equal(guide.qualifies, qualifies);
      const sietch = guide.sietches.find((s) => s.territory === territory)!;
      assert.equal(sietch.ecazCooccupation, true);
      assert.deepEqual(sietch.blockers, qualifies ? [] : ['ec']);
      const done = finishFremenEcazTurn(g);
      assert.deepEqual(done.winner, qualifies ? ['fr', 'ec'] : ['gu']);
      assert.deepEqual(g, before);
      assert.deepEqual(fremenEcazCustody(done), fremenEcazCustody(g));
      if (qualifies) assert.match(done.log.at(-1)!.text, /Fremen special victory/);
      else assert.doesNotMatch(done.log.at(-1)!.text, /Fremen special victory/);
    }
});

void test('solitary or nonallied Ecaz and third parties block in either sietch in Basic and Advanced', () => {
  for (const advanced of [false, true])
    for (const territory of ['sietch_tabr', 'habbanya_ridge_sietch'])
      for (const kind of ['unallied', 'fremenAbsent', 'thirdFaction'] as const) {
        const g = fremenEcazFinalTurn(advanced);
        const key = territory === 'sietch_tabr' ? 'sietch_tabr:14' : 'habbanya_ridge_sietch:17';
        for (const p of g.players.slice(0, 2)) p.forces = { [key]: 3 };
        if (kind === 'unallied') for (const p of g.players.slice(0, 2)) p.ally = null;
        if (kind === 'fremenAbsent') {
          g.players[1].reserves += 3;
          g.players[1].forces = {};
        }
        if (kind === 'thirdFaction') {
          g.players[2].reserves--;
          g.players[2].forces[key] = 1;
        }
        const before = structuredClone(g);
        const guide = viewGame(g, 'ec').fremenVictory!;
        assert.equal(guide.qualifies, false);
        assert.ok(guide.sietches.find((s) => s.territory === territory)!
          .blockers.includes(kind === 'thirdFaction' ? 'gu' : 'ec'));
        const done = finishFremenEcazTurn(g);
        assert.deepEqual(done.winner, ['gu']);
        assert.deepEqual(g, before);
        assert.deepEqual(fremenEcazCustody(done), fremenEcazCustody(g));
        assert.doesNotMatch(done.log.at(-1)!.text, /Fremen special victory/);
      }
});
