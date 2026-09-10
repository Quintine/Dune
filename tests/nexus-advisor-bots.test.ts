import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame } from '../game/engine';
import { DIFFICULTIES } from '../game/bot-profiles';
import { botActions } from '../game/bots';
import { nexusAdvisorBotActions } from '../game/nexus-advisor-options';
import {
  nexusAdvisorFixture,
  nexusAdvisorInventory,
  beginNexusAdvisorFlip,
  allowNexusAdvisorFlip,
  holdAdvisorKarama,
} from './fixture-nexus-advisors';

void test('all profiles announce favorable whole advisor groups and settle one conserved real conversion', () => {
  const initial = nexusAdvisorFixture();
  for (const difficulty of DIFFICULTIES) {
    const v = viewGame(initial, 'p');
    v.players[0].bot = difficulty;
    const before = structuredClone(v);
    const actions = botActions(v);
    assert.equal(actions.length, 1);
    assert.equal(actions[0].type, 'nexusAdvisors');
    assert.deepEqual([...(actions[0].territories as string[])].sort(), [
      'arrakeen',
      'pasty_mesa',
    ]);
    assert.deepEqual(v, before);
    const g = allowNexusAdvisorFlip(applyAction(initial, 'p', actions[0]));
    assert.equal(g.players[0].advisors?.arrakeen, undefined);
    assert.equal(g.players[0].advisors?.pasty_mesa, undefined);
    assert.ok(g.players[0].advisors?.carthag);
    assert.deepEqual(g.players[0].forces, initial.players[0].forces);
    assert.equal(g.players[0].spice, initial.players[0].spice);
    assert.equal(g.players[0].moved, initial.players[0].moved);
    assert.equal(g.players[0].shipped, initial.players[0].shipped);
    nexusAdvisorInventory(g);
  }
});

void test('advisor policy respects blocked groups and uses only public fighter presence', () => {
  const v = viewGame(nexusAdvisorFixture(), 'p');
  v.players[0].bot = 'Brutal';
  const offer = v.nexusAdvisors!.offer!;
  offer.territories.find((t) => t.territory === 'arrakeen')!.blocked =
    'Fresh advisor conversion awaits its ruling.';
  for (const player of v.players)
    for (const key of ['hand', 'traitors', 'faceDancers', 'spice'])
      Object.defineProperty(player, key, {
        get() {
          throw new Error(`Private ${key} read`);
        },
      });
  assert.deepEqual(nexusAdvisorBotActions(v)[0]?.territories, ['pasty_mesa']);
  v.players[1].forces['pasty_mesa:5'] = 10;
  assert.deepEqual(nexusAdvisorBotActions(v), []);
  v.players[1].forces = {};
  assert.deepEqual(nexusAdvisorBotActions(v), []);
  Object.defineProperty(v.players[1], 'noField', {
    value: {
      deployed: {
        location: { territory: 'pasty_mesa', sector: 5 },
        get value() {
          throw new Error('Read No-Field denomination');
        },
        get tokenId() {
          throw new Error('Read No-Field identity');
        },
      },
      get tokens() {
        throw new Error('Read private No-Field inventory');
      },
    },
  });
  assert.deepEqual(nexusAdvisorBotActions(v)[0]?.territories, ['pasty_mesa']);
});

void test('response bots use the ordinary whole-use Karama controls when their fighters are threatened', () => {
  const initial = nexusAdvisorFixture();
  const card = holdAdvisorKarama(initial);
  const g = beginNexusAdvisorFlip(initial, ['arrakeen', 'pasty_mesa']);
  for (const difficulty of DIFFICULTIES) {
    const v = viewGame(g, 'q');
    v.players.find((p) => p.id === 'q')!.bot = difficulty;
    const action = botActions(v)[0];
    assert.ok(action);
    if (difficulty === 'Easy' || difficulty === 'Medium')
      assert.deepEqual(action, { type: 'passResponse' });
    else assert.deepEqual(action, { type: 'card', card, mode: 'cancel' });
  }
});
