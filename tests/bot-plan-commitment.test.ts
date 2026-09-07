import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  type Game,
} from '../game/engine';
import { baseDeck, ixBattleCards } from '../game/cards';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';

const cards = [...baseDeck(), ...ixBattleCards()];
const card = (kind: string) => cards.find((c) => c.kind === kind)!;
function fixture() {
  let g = createGame('PLANFIX', newPlayer('p', 'Planner', 'emperor'));
  g.players.push(newPlayer('q', 'Inspector', 'atreides'));
  Object.assign(g, {
    status: 'playing',
    phase: 6,
    turn: 2,
    storm: 18,
    active: 'p',
    order: ['p', 'q'],
  });
  for (const p of g.players)
    Object.assign(p, {
      hand: [],
      spice: 10,
      forces: { 'arrakeen:10': 4 },
      reserves: 16,
      traitors: [],
    });
  g.players[0].hand = ['worthless', 'projectile', 'snooper', 'chemistry'].map(
    card,
  );
  g = applyAction(g, 'p', {
    type: 'chooseBattle',
    territory: 'arrakeen',
    target: 'q',
  });
  assert.equal(g.battle!.preparation!.kind, 'prescience');
  return g;
}
function asked(field: string) {
  return applyAction(fixture(), 'q', { type: 'prescience', field });
}
function offered(g: Game) {
  return DIFFICULTIES.map((difficulty) => {
    const v = viewGame(g, 'p');
    v.players[0].bot = difficulty;
    const before = structuredClone(v),
      actions = botActions(v);
    assert.deepEqual(v, before);
    assert.ok(actions.length, difficulty);
    for (const action of actions)
      assert.doesNotThrow(
        () => applyAction(g, 'p', action),
        `${difficulty}: ${JSON.stringify(action)}`,
      );
    return actions;
  });
}
void test('Prescience fixed weapon and defense retain physical slot uniqueness and valid alternate roles for every profile', () => {
  for (const [field, value] of [
    ['weapon', card('worthless').id],
    ['defense', card('chemistry').id],
  ] as const) {
    const g = applyAction(asked(field), 'p', {
      type: 'prescienceAnswer',
      value,
    });
    for (const actions of offered(g)) {
      assert.ok(actions.every((a) => a[field] === value));
      assert.ok(actions.every((a) => !a.weapon || a.weapon !== a.defense));
    }
  }
});
void test('Prescience committed leader and dial constrain the final plans without inventing leaderless combinations', () => {
  for (const [field, value] of [
    ['leader', 'emperor-4'],
    ['dial', 2],
  ] as const) {
    const g = applyAction(asked(field), 'p', {
      type: 'prescienceAnswer',
      value,
    });
    for (const actions of offered(g)) {
      assert.ok(actions.every((a) => a[field] === value));
      assert.ok(actions.every((a) => a.leader !== null));
    }
  }
});
void test('every offered Prescience answer has an authoritative completion and ignores unrevealed opposing cards', () => {
  for (const field of ['weapon', 'defense', 'leader', 'dial']) {
    const g = asked(field),
      changed = structuredClone(g);
    changed.players[1].hand = [card('poison'), card('shield')];
    changed.players[1].spice = 999;
    const a = offered(g),
      b = offered(changed);
    assert.deepEqual(a, b);
    for (const actions of a)
      assert.ok(actions.every((action) => action.type === 'prescienceAnswer'));
  }
});
