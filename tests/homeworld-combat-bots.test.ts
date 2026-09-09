import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  initializeHomeworldGameForAudit,
  joinGame,
  newPlayer,
  normalizeAutomaticGame,
  viewGame,
  type Game,
} from '../game/engine';
import { botActions } from '../game/bots';
import { botBattleChoices } from '../game/bot-battle-choices';
import { DIFFICULTIES } from '../game/bot-profiles';
import { homeworldGameIntegrity } from '../game/homeworld-game';

const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
function invaded(advanced: boolean) {
  let g = createGame(
    'HOMEWORLDCOMBATBOTS',
    newPlayer('e', 'Emperor', 'emperor'),
    advanced,
  );
  joinGame(g, newPlayer('a', 'Atreides', 'atreides'));
  g = applyAction(g, 'e', { type: 'homeworlds', enabled: true });
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  g = initializeHomeworldGameForAudit(g);
  while (g.setupStage === 'traitors') {
    const p = g.players.find((p) => p.traitorChoices.length)!;
    g = applyAction(g, p.id, { type: 'traitor', leader: p.traitorChoices[0] });
  }
  assert.equal(g.status, 'playing');
  for (const p of g.players) g.deck.push(...p.hand.splice(0));
  // Genuine setup; only conserved invasion positions and the phase are staged.
  // Transport itself has its own gate and is not certified by this fixture.
  g.players[0].reserves -= 3;
  g.players[1].reserves -= 2;
  g.homeworlds!.custody!.visitors = {
    'homeworld:atreides': { e: { normal: 3, elite: 0 } },
    'homeworld:emperor': { a: { normal: 2, elite: 0 } },
  };
  Object.assign(g, {
    phase: 6,
    active: 'e',
    order: ['e', 'a'],
    phaseOpening: null,
    response: null,
    decision: null,
    ready: [],
    storm: 18,
  });
  homeworldGameIntegrity(g);
  return g;
}

void test('Homeworld battle candidates use the authoritative ordered frontier without pretending reserves are board forces', () => {
  const g = invaded(false);
  const view = viewGame(g, 'e');
  const before = structuredClone(view);
  const choices = botBattleChoices(view);
  assert.equal(choices.length, 2);
  assert.ok(
    choices.every((choice) =>
      String(choice.territory).startsWith('homeworld:'),
    ),
  );
  for (const choice of choices) {
    const next = applyAction(g, 'e', choice);
    assert.equal(next.battle!.territory, choice.territory);
    homeworldGameIntegrity(next);
  }
  assert.deepEqual(view, before);
  const none = { ...view, battleChoices: [] };
  assert.deepEqual(botBattleChoices(none), []);
  assert.deepEqual(botBattleChoices(viewGame(g, 'a')), []);
});

void test('all four AI levels finish native and invading Homeworld battles with legal sealed plans across JSON refresh', () => {
  for (const advanced of [false, true])
    for (const difficulty of DIFFICULTIES) {
      let g = invaded(advanced);
      const source = g;
      const initial = structuredClone(g);
      const nativeBonuses = new Set<string>();
      let plans = 0;
      for (let step = 0; g.phase === 6 && step < 100; step++) {
        g = normalizeAutomaticGame(reload(g));
        if (g.phase !== 6) break;
        let advancedState: Game | undefined;
        for (const p of g.players) {
          const view = viewGame(g, p.id);
          view.players.find((own) => own.id === p.id)!.bot = difficulty;
          for (const other of view.players.filter(
            (other) => other.id !== p.id,
          )) {
            assert.equal(other.hand, undefined);
            assert.equal(other.traitors, undefined);
          }
          if (view.battle?.native) nativeBonuses.add(view.battle.native);
          const choices = botActions(view);
          if (!choices.length) continue;
          // Every advertised candidate must remain legal; do not filter away
          // rejected candidates to make a bot look successful.
          for (const choice of choices)
            assert.doesNotThrow(
              () => applyAction(reload(g), p.id, choice),
              JSON.stringify({ advanced, difficulty, choice }),
            );
          const choice = choices[0];
          if (choice.type === 'battlePlan') plans++;
          advancedState = applyAction(reload(g), p.id, choice);
          break;
        }
        assert.ok(
          advancedState,
          `No legal next decision for ${difficulty}, Advanced=${advanced}`,
        );
        g = advancedState;
        homeworldGameIntegrity(g);
      }
      assert.notEqual(
        g.phase,
        6,
        `${difficulty} must settle the complete battle phase`,
      );
      assert.ok(plans >= 4, 'Both invading/native pairs sealed real plans.');
      assert.deepEqual([...nativeBonuses].sort(), ['a', 'e']);
      assert.deepEqual(source, initial);
    }
});
