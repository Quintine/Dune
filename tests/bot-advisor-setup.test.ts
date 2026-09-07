import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  type Game,
} from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES, type Difficulty } from '../game/bot-profiles';
import { baseDeck } from '../game/cards';
import { MOBILE_STRONGHOLD, TERRITORIES, territory } from '../game/board';
import { isAdvisor } from '../game/advisors';

function fixture(advanced = true, withFremen = true, bgFirst = true): Game {
  const g = createGame(
    'ADVISORSETUPBOT',
    newPlayer('b', 'Sisterhood', 'beneGesserit'),
    advanced,
  );
  g.players.push(
    newPlayer('o', 'Other', withFremen ? 'fremen' : 'atreides'),
    newPlayer('h', 'Harkonnen', 'harkonnen'),
  );
  if (!bgFirst) g.players.reverse();
  Object.assign(g, {
    status: 'setup',
    phase: 0,
    turn: 1,
    storm: 10,
    order: g.players.map((p) => p.id),
  });
  for (const p of g.players)
    Object.assign(p, {
      hand: [],
      forces: {},
      reserves: 20,
      spice: 0,
      traitors: [],
      traitorChoices: [],
    });
  if (!advanced) {
    const bg = g.players.find((p) => p.id === 'b')!;
    bg.reserves = 19;
    bg.forces = { 'polar_sink:0': 1 };
  }
  return g;
}
function actions(g: Game, difficulty: Difficulty, id = 'b') {
  const view = viewGame(g, id);
  view.players.find((p) => p.id === id)!.bot = difficulty;
  const before = structuredClone(view);
  const result = botActions(view);
  assert.deepEqual(view, before);
  for (const action of result)
    assert.doesNotThrow(
      () => applyAction(g, id, action),
      `${difficulty}: ${JSON.stringify(action)}`,
    );
  return result;
}

void test('all profiles complete own traitor and prediction choices while waiting for human or AI Fremen placement', () => {
  for (const difficulty of DIFFICULTIES)
    for (const bgFirst of [false, true])
      for (const fremenBot of [false, true]) {
        let g = fixture(true, true, bgFirst);
        const bg = g.players.find((p) => p.id === 'b')!;
        if (fremenBot) g.players.find((p) => p.id === 'o')!.bot = 'Medium';
        bg.traitorChoices = ['fremen-0', 'harkonnen-0'];
        const traitor = actions(g, difficulty);
        assert.equal(traitor[0].type, 'traitor');
        g = applyAction(g, 'b', traitor[0]);
        const prediction = actions(g, difficulty);
        assert.equal(prediction[0].type, 'predict');
        assert.ok(prediction.every((a) => a.type !== 'advisorSetup'));
        g = applyAction(g, 'b', prediction[0]);
        assert.deepEqual(
          actions(g, difficulty),
          [],
          'Only the real Fremen placement is pending for this bot.',
        );
        assert.equal(g.players.find((p) => p.id === 'b')!.reserves, 20);
        const fremen = actions(g, difficulty, 'o');
        assert.equal(
          fremen[0].type,
          'fremenSetup',
          'BG waiting does not block the Fremen actor.',
        );
        g = applyAction(g, 'o', fremen[0]);
        assert.equal(g.players.find((p) => p.id === 'o')!.reserves, 10);
        assert.ok(
          actions(g, difficulty).every((a) => a.type === 'advisorSetup'),
        );
      }
});

void test('Advanced advisor setup offers every printed sector including storm and two-fighter strongholds, but never mobile stronghold', () => {
  for (const difficulty of DIFFICULTIES) {
    const g = fixture(true, false);
    g.players[1].forces = { 'arrakeen:10': 2 };
    g.players[1].reserves = 18;
    g.players[2].forces = { 'arrakeen:10': 2 };
    g.players[2].reserves = 18;
    g.mobileStronghold = { location: 'red_chasm:7' };
    const choices = actions(g, difficulty);
    assert.ok(
      choices.every(
        (a) => a.type === 'advisorSetup' && a.territory !== MOBILE_STRONGHOLD,
      ),
    );
    assert.deepEqual(
      new Set(choices.map((a) => `${String(a.territory)}:${Number(a.sector)}`)),
      new Set(TERRITORIES.flatMap((t) => t.sectors.map((s) => `${t.id}:${s}`))),
    );
    const occupied = choices.find((a) => a.territory === 'arrakeen')!;
    assert.equal(occupied.sector, g.storm);
    const joined = applyAction(g, 'b', occupied);
    assert.equal(joined.players[0].reserves, 19);
    assert.equal(joined.players[0].forces['arrakeen:10'], 1);
    assert.equal(isAdvisor(joined.players[0], 'arrakeen'), true);
    const empty = applyAction(
      g,
      'b',
      choices.find((a) => a.territory === 'polar_sink')!,
    );
    assert.equal(
      isAdvisor(empty.players[0], 'polar_sink'),
      false,
      'An uncontested starting force becomes a fighter automatically.',
    );
  }
});

void test('Basic BG has no advisor placement and finished or inconsistent reserve custody cannot place a second starting force', () => {
  for (const difficulty of DIFFICULTIES) {
    let basic = fixture(false);
    const prediction = actions(basic, difficulty);
    assert.deepEqual(
      prediction.map((a) => a.type),
      ['predict'],
    );
    basic = applyAction(basic, 'b', prediction[0]);
    assert.deepEqual(actions(basic, difficulty), []);
    let done = fixture(true, false);
    done = applyAction(done, 'b', actions(done, difficulty)[0]);
    assert.ok(done.players[0].advisorSetup);
    const next = actions(done, difficulty);
    assert.deepEqual(
      next.map((a) => a.type),
      ['predict'],
    );
    done = applyAction(done, 'b', next[0]);
    assert.deepEqual(actions(done, difficulty), []);
    const inconsistent = fixture(true, false);
    inconsistent.players[0].reserves = 19;
    assert.deepEqual(
      actions(inconsistent, difficulty).map((a) => a.type),
      ['predict'],
    );
  }
});

void test('advisor setup waiting and destinations depend on public placement, never enemy cards, balances or human versus bot status', () => {
  for (const difficulty of DIFFICULTIES)
    for (const placed of [false, true]) {
      const g = fixture();
      g.players[0].prediction = { faction: 'fremen', turn: 4 };
      if (placed) {
        g.players[1].reserves = 10;
        g.players[1].forces = {
          [`sietch_tabr:${territory('sietch_tabr').sectors[0]}`]: 10,
        };
      }
      const baseline = actions(g, difficulty);
      const changed = structuredClone(g);
      changed.players[1].spice = 1000;
      changed.players[1].hand = baseDeck().slice(0, 4);
      changed.players[1].bot = 'Brutal';
      changed.players[1].traitors = ['beneGesserit-0'];
      assert.deepEqual(actions(changed, difficulty), baseline);
    }
});
