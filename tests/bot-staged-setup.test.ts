import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  initializeBaseGameForAudit,
  newPlayer,
  viewGame,
  type Game,
} from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES, type Difficulty } from '../game/bot-profiles';

function fixture(advanced = false, sisterhood = true, fremen = true) {
  const g = createGame(
    'STAGEDSETUPBOT',
    newPlayer('b', 'First seat', sisterhood ? 'beneGesserit' : 'emperor'),
    advanced,
  );
  g.players.push(
    newPlayer('f', 'Second seat', fremen ? 'fremen' : 'guild'),
    newPlayer('h', 'Harkonnen', 'harkonnen'),
  );
  g.players.forEach((p) => {
    p.ready = true;
  });
  // Advanced exercises the explicit offline initializer, never weakens the public start gate.
  return advanced
    ? initializeBaseGameForAudit(g)
    : applyAction(g, 'b', { type: 'start' });
}
function candidates(g: Game, id: string, difficulty: Difficulty) {
  const view = viewGame(g, id);
  view.players.find((p) => p.id === id)!.bot = difficulty;
  const before = structuredClone(view),
    actions = botActions(view);
  assert.deepEqual(view, before);
  for (const action of actions)
    assert.doesNotThrow(
      () => applyAction(g, id, action),
      `${difficulty}/${id}: ${JSON.stringify(action)}`,
    );
  return actions;
}
function predict(g: Game, difficulty: Difficulty) {
  const actions = candidates(g, 'b', difficulty);
  assert.deepEqual(
    actions.map((a) => a.type),
    ['predict'],
  );
  return applyAction(g, 'b', actions[0]);
}
function traitors(initial: Game, difficulty: Difficulty) {
  let g = initial;
  for (let n = 0; g.setupStage === 'traitors' && n < 6; n++) {
    const pending = viewGame(g, 'b').setupPending;
    assert.ok(pending.length > 0);
    const id = pending[0],
      actions = candidates(g, id, difficulty);
    assert.deepEqual(
      actions.map((a) => a.type),
      ['traitor'],
    );
    g = applyAction(g, id, actions[0]);
  }
  assert.notEqual(g.setupStage, 'traitors');
  return g;
}

void test('all profiles honor prediction before private cards, traitors before forces, and automatic final dealing', () => {
  for (const difficulty of DIFFICULTIES)
    for (const advanced of [false, true]) {
      let g = fixture(advanced);
      assert.equal(g.setupStage, 'prediction');
      assert.deepEqual(viewGame(g, 'b').setupPending, ['b']);
      assert.ok(
        g.players.every(
          (p) =>
            !p.hand.length && !p.traitorChoices.length && !p.traitors.length,
        ),
      );
      assert.ok(
        g.players.every(
          (p) => p.spice === 0 && Object.keys(p.forces).length === 0,
        ),
      );
      assert.deepEqual(candidates(g, 'f', difficulty), []);
      assert.deepEqual(candidates(g, 'h', difficulty), []);
      g = predict(g, difficulty);
      assert.equal(g.setupStage, 'traitors');
      assert.ok(g.players.every((p) => p.hand.length === 0));
      assert.deepEqual(
        candidates(g, 'h', difficulty),
        [],
        'Harkonnen already keeps its dealt traitors without a confirmation.',
      );
      const first = candidates(g, 'b', difficulty)[0];
      assert.equal(first.type, 'traitor');
      g = applyAction(g, 'b', first);
      assert.deepEqual(
        candidates(g, 'b', difficulty),
        [],
        'A finished traitor selection cannot skip ahead to advisor setup.',
      );
      g = traitors(g, difficulty);
      assert.equal(g.setupStage, 'forces');
      assert.deepEqual(viewGame(g, 'b').setupPending, ['f']);
      assert.deepEqual(
        candidates(g, 'b', difficulty),
        [],
        'Fremen place before the Advanced starting advisor.',
      );
      const placement = candidates(g, 'f', difficulty);
      assert.deepEqual(
        placement.map((a) => a.type),
        ['fremenSetup'],
      );
      assert.ok(g.players.every((p) => p.hand.length === 0));
      g = applyAction(g, 'f', placement[0]);
      if (advanced) {
        assert.equal(g.setupStage, 'forces');
        assert.deepEqual(viewGame(g, 'f').setupPending, ['b']);
        const advisors = candidates(g, 'b', difficulty);
        assert.ok(
          advisors.length > 0 &&
            advisors.every((a) => a.type === 'advisorSetup'),
        );
        g = applyAction(g, 'b', advisors[0]);
      }
      assert.equal(g.status, 'playing');
      assert.equal(viewGame(g, 'b').setupStage, null);
      assert.deepEqual(viewGame(g, 'b').setupPending, []);
      assert.ok(
        g.players.every((p) => p.hand.length > 0),
        'Starting cards are dealt without another bot acknowledgement.',
      );
    }
});

void test('absent Bene Gesserit or Fremen skips only the corresponding setup step for every profile', () => {
  for (const difficulty of DIFFICULTIES)
    for (const advanced of [false, true]) {
      let noSisterhood = fixture(advanced, false);
      assert.equal(noSisterhood.setupStage, 'traitors');
      assert.equal(
        candidates(noSisterhood, 'b', difficulty)[0].type,
        'traitor',
      );
      noSisterhood = traitors(noSisterhood, difficulty);
      assert.equal(noSisterhood.setupStage, 'forces');
      noSisterhood = applyAction(
        noSisterhood,
        'f',
        candidates(noSisterhood, 'f', difficulty)[0],
      );
      assert.equal(noSisterhood.status, 'playing');
      let noFremen = predict(fixture(advanced, true, false), difficulty);
      noFremen = traitors(noFremen, difficulty);
      if (advanced) {
        assert.deepEqual(viewGame(noFremen, 'f').setupPending, ['b']);
        noFremen = applyAction(
          noFremen,
          'b',
          candidates(noFremen, 'b', difficulty)[0],
        );
      }
      assert.equal(noFremen.status, 'playing');
    }
});

void test('public stage fences stale private controls without giving an AI an out-of-stage candidate', () => {
  for (const difficulty of DIFFICULTIES) {
    const g = fixture(true);
    for (const id of ['b', 'f']) {
      const view = viewGame(g, id),
        me = view.players.find((p) => p.id === id)!;
      me.bot = difficulty;
      me.traitorChoices = ['harkonnen-0'];
      const actions = botActions(view);
      assert.deepEqual(
        actions.map((a) => a.type),
        id === 'b' ? ['predict'] : [],
      );
      for (const action of actions)
        assert.doesNotThrow(() => applyAction(g, id, action));
    }
  }
});

void test('public setup ownership contains only IDs and rival prediction/traitor identities cannot change a bot choice', () => {
  for (const difficulty of DIFFICULTIES) {
    const g = predict(fixture(true), difficulty);
    const baseline = candidates(g, 'f', difficulty);
    const view = viewGame(g, 'f');
    assert.ok(
      view.setupPending.every((id) => g.players.some((p) => p.id === id)),
    );
    assert.equal(view.players[0].prediction, undefined);
    assert.equal(view.players[0].traitorChoices, undefined);
    const changed = structuredClone(g);
    changed.players[0].prediction = { faction: 'harkonnen', turn: 9 };
    changed.players[0].traitorChoices.reverse();
    changed.players[2].traitors.reverse();
    assert.deepEqual(candidates(changed, 'f', difficulty), baseline);
    assert.deepEqual(viewGame(changed, 'f').setupPending, view.setupPending);
  }
});

void test('legacy setup without a stage retains traitor, prediction and public Fremen wait behavior', () => {
  for (const difficulty of DIFFICULTIES) {
    const g = createGame(
      'LEGACYSETUPBOT',
      newPlayer('b', 'Sisterhood', 'beneGesserit'),
      true,
    );
    g.players.push(newPlayer('f', 'Fremen', 'fremen'));
    g.status = 'setup';
    g.players[0].traitorChoices = ['fremen-0'];
    assert.equal(viewGame(g, 'b').setupStage, null);
    assert.deepEqual(viewGame(g, 'b').setupPending, []);
    const chosen = applyAction(g, 'b', candidates(g, 'b', difficulty)[0]);
    assert.equal(candidates(chosen, 'b', difficulty)[0].type, 'predict');
    const predicted = applyAction(
      chosen,
      'b',
      candidates(chosen, 'b', difficulty)[0],
    );
    assert.deepEqual(candidates(predicted, 'b', difficulty), []);
    assert.equal(candidates(predicted, 'f', difficulty)[0].type, 'fremenSetup');
  }
});
