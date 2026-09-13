import test from 'node:test';
import assert from 'node:assert/strict';
import type { BoardContext } from '../game/board-resolution-quote';
import { fremenSpecialVictory } from '../game/fremen-victory';
import { VictoryProgressError } from '../game/victory-progress';

function fixture(advanced = false): BoardContext {
  return {
    advanced,
    storm: 18,
    order: ['x', 'f', 'e', 'r'],
    players: [
      { id: 'f', faction: 'fremen', ally: 'e', forces: {} },
      { id: 'e', faction: 'ecaz', ally: 'f', forces: {} },
      { id: 'x', faction: 'beneGesserit', ally: null, forces: {} },
      { id: 'r', faction: 'richese', ally: null, forces: {} },
    ],
  };
}

function seat(g: BoardContext, id: string) {
  return g.players.find((player) => player.id === id)!;
}

function place(g: BoardContext, id: string, key: string) {
  const player = seat(g, id);
  player.forces = { ...player.forces, [key]: 1 };
}

void test('allied Ecaz co-occupation is ignored only at Sietch Tabr in Basic and Advanced', () => {
  for (const advanced of [false, true]) {
    const g = fixture(advanced);
    place(g, 'f', 'sietch_tabr:14');
    place(g, 'e', 'sietch_tabr:14');
    const result = fremenSpecialVictory(g)!;
    assert.equal(result.player, 'f');
    assert.deepEqual(result.members, ['f', 'e']);
    assert.equal(result.qualifies, true);
    assert.deepEqual(result.sietches, [
      {
        territory: 'sietch_tabr',
        blockers: [],
        ecazCooccupation: true,
      },
      {
        territory: 'habbanya_ridge_sietch',
        blockers: [],
        ecazCooccupation: false,
      },
    ]);
    assert.deepEqual(result.tueksBlockers, []);
  }
});

void test('a valid board without Fremen has no special-victory prospect', () => {
  const g = fixture();
  seat(g, 'f').faction = 'atreides';
  assert.equal(fremenSpecialVictory(g), null);
});

void test('solitary, nonallied and third-party Ecaz presence do not receive the Tabr exception', () => {
  const solitary = fixture();
  place(solitary, 'e', 'sietch_tabr:14');
  assert.deepEqual(fremenSpecialVictory(solitary)!.sietches[0].blockers, ['e']);

  const nonallied = fixture();
  seat(nonallied, 'f').ally = null;
  seat(nonallied, 'e').ally = null;
  place(nonallied, 'f', 'sietch_tabr:14');
  place(nonallied, 'e', 'sietch_tabr:14');
  assert.deepEqual(fremenSpecialVictory(nonallied)!.sietches[0].blockers, [
    'e',
  ]);

  const third = fixture();
  place(third, 'f', 'sietch_tabr:14');
  place(third, 'e', 'sietch_tabr:14');
  place(third, 'r', 'sietch_tabr:14');
  assert.deepEqual(fremenSpecialVictory(third)!.sietches[0].blockers, ['r']);
  assert.equal(fremenSpecialVictory(third)!.qualifies, false);
});

void test('Ecaz co-occupation at Habbanya remains a blocker', () => {
  const g = fixture();
  place(g, 'f', 'habbanya_ridge_sietch:17');
  place(g, 'e', 'habbanya_ridge_sietch:17');
  const result = fremenSpecialVictory(g)!;
  assert.equal(result.sietches[1].ecazCooccupation, true);
  assert.deepEqual(result.sietches[1].blockers, ['e']);
  assert.equal(result.qualifies, false);
});

void test('accompanied BG advisors do not block, while mandatory lone-advisor release restores fighter presence', () => {
  const accompanied = fixture(true);
  place(accompanied, 'f', 'habbanya_ridge_sietch:17');
  place(accompanied, 'x', 'habbanya_ridge_sietch:17');
  seat(accompanied, 'x').advisors = { habbanya_ridge_sietch: {} };
  assert.deepEqual(fremenSpecialVictory(accompanied)!.sietches[1].blockers, []);

  const released = fixture(true);
  place(released, 'x', 'sietch_tabr:14');
  seat(released, 'x').advisors = { sietch_tabr: {} };
  const before = structuredClone(released);
  assert.deepEqual(fremenSpecialVictory(released)!.sietches[0].blockers, ['x']);
  assert.deepEqual(released, before);
});

void test('Tuek blockers preserve Basic and Advanced faction scope and never inspect marker secrets', () => {
  const basic = fixture(false);
  place(basic, 'r', 'tueks_sietch:5');
  assert.deepEqual(fremenSpecialVictory(basic)!.tueksBlockers, []);

  const advanced = fixture(true);
  seat(advanced, 'r').noField = {
    deployed: { location: { territory: 'tueks_sietch', sector: 5 } },
  };
  Object.defineProperty(seat(advanced, 'r').noField!.deployed, 'value', {
    get() {
      throw new Error('Hidden marker denomination read');
    },
  });
  for (const player of advanced.players)
    for (const key of ['hand', 'spice', 'leaders', 'prediction'])
      Object.defineProperty(player, key, {
        get() {
          throw new Error(`Private field read: ${key}`);
        },
      });
  const result = fremenSpecialVictory(advanced)!;
  assert.deepEqual(result.tueksBlockers, ['r']);
  assert.equal(result.qualifies, false);
});

void test('members and blockers follow public order rather than player-array order', () => {
  const g = fixture();
  g.order = ['r', 'e', 'x', 'f'];
  place(g, 'f', 'sietch_tabr:14');
  place(g, 'e', 'sietch_tabr:14');
  place(g, 'r', 'habbanya_ridge_sietch:17');
  place(g, 'x', 'habbanya_ridge_sietch:17');
  assert.deepEqual(fremenSpecialVictory(g), {
    player: 'f',
    members: ['e', 'f'],
    qualifies: false,
    sietches: [
      {
        territory: 'sietch_tabr',
        blockers: [],
        ecazCooccupation: true,
      },
      {
        territory: 'habbanya_ridge_sietch',
        blockers: ['r', 'x'],
        ecazCooccupation: false,
      },
    ],
    tueksBlockers: [],
  });
});

void test('invalid shared board and alliance state is reported through VictoryProgressError', () => {
  const invalid = fixture();
  seat(invalid, 'e').ally = null;
  assert.throws(() => fremenSpecialVictory(invalid), VictoryProgressError);
  const malformed = fixture();
  seat(malformed, 'x').forces = { 'sietch_tabr:99': 1 };
  assert.throws(() => fremenSpecialVictory(malformed), VictoryProgressError);
});
