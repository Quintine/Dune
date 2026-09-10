import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame } from '../game/engine';
import { DIFFICULTIES } from '../game/bot-profiles';
import { botActions } from '../game/bots';
import { casualtyOptions } from '../game/combat';
import {
  nexusSardaukarFixture,
  nexusSardaukarInventory,
  beginNexusSardaukar,
  allowNexusSardaukar,
  prepareSardaukarBattle,
} from './fixture-nexus-sardaukar';

void test('all profiles declare actual Cunning then seal a physically legal boosted plan after allowance', () => {
  const initial = nexusSardaukarFixture();
  for (const difficulty of DIFFICULTIES) {
    const v = viewGame(initial, 'p');
    v.players[0].bot = difficulty;
    const before = structuredClone(v);
    const declaration = botActions(v)[0];
    assert.equal(declaration.type, 'nexusSardaukar');
    assert.deepEqual(v, before);
    const g = prepareSardaukarBattle(
      allowNexusSardaukar(applyAction(initial, 'p', declaration)),
    );
    const boosted = viewGame(g, 'p');
    boosted.players[0].bot = difficulty;
    const plans = botActions(boosted);
    assert.ok(plans.length);
    for (const plan of plans) {
      assert.equal(plan.type, 'battlePlan');
      const losses = casualtyOptions(
        boosted.battle!.ownForces!,
        Number(plan.dial),
        Number(plan.support),
      );
      assert.ok(losses.length);
      assert.ok(losses.every((loss) => loss.elite === 0 && loss.normal <= 7));
    }
    const sealed = applyAction(g, 'p', plans[0]);
    nexusSardaukarInventory(sealed);
    assert.deepEqual(sealed.players[0].elites, initial.players[0].elites);
    assert.equal(sealed.battle!.plans.p.dial, plans[0].dial);
  }
});

void test('Emperor offer policy never reads private cards or an opposing sealed plan', () => {
  const v = viewGame(nexusSardaukarFixture(), 'p');
  v.players[0].bot = 'Brutal';
  for (const p of v.players)
    for (const field of ['hand', 'traitors', 'faceDancers', 'spice'])
      Object.defineProperty(p, field, {
        get() {
          throw new Error(`Private ${field} read`);
        },
      });
  Object.defineProperty(v.battle!, 'plans', {
    get() {
      throw new Error('Read sealed plan');
    },
  });
  assert.equal(botActions(v)[0].type, 'nexusSardaukar');
});

void test('native enhancement uses ordinary Karama response policy before any boosted planning', () => {
  const initial = nexusSardaukarFixture();
  const index = initial.deck.findIndex((c) => c.effect === 'karama');
  const card = initial.deck.splice(index, 1)[0];
  initial.players[1].hand.push(card);
  const g = beginNexusSardaukar(initial);
  for (const difficulty of DIFFICULTIES) {
    const v = viewGame(g, 'q');
    v.players.find((p) => p.id === 'q')!.bot = difficulty;
    const action = botActions(v)[0];
    assert.deepEqual(
      action,
      difficulty === 'Easy' || difficulty === 'Medium'
        ? { type: 'passResponse' }
        : { type: 'card', card: card.id, mode: 'cancel' },
    );
    assert.equal(v.nexusSardaukar!.active, false);
  }
});
