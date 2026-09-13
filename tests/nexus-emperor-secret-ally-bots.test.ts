import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame } from '../game/engine';
import { botActions } from '../game/bots';
import { nexusEmperorRevivalAction } from '../game/nexus-emperor-secret-ally-options';
import {
  nexusEmperorSecretAllyFixture,
  emperorNexusPhysical,
} from './nexus-emperor-secret-ally-fixture';

void test('all four profiles use the actual additional revival without ordinary quota or hidden-information access', () => {
  for (const advanced of [false, true]) {
    for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
      const { g, owner } = nexusEmperorSecretAllyFixture({ advanced });
      const before = g.players.find((player) => player.id === owner)!;
      before.bot = difficulty;
      const view = viewGame(g, owner);
      for (const rival of view.players.filter(
        (player) => player.id !== owner,
      )) {
        for (const key of ['hand', 'spice', 'traitors'])
          Object.defineProperty(rival, key, {
            get() {
              throw new Error('Rival private field read.');
            },
          });
      }
      const [action] = botActions(view);
      assert.equal(action.type, 'nexusEmperorRevive');
      const after = applyAction(g, owner, action);
      const actual = after.players.find((player) => player.id === owner)!;
      assert.equal(actual.reserves, before.reserves + 3);
      assert.equal(actual.tanks, before.tanks - 3);
      assert.equal(actual.spice, before.spice);
      assert.equal(actual.revived, before.revived);
      assert.equal(actual.freeForcesRevived, before.freeForcesRevived);
      assert.deepEqual(emperorNexusPhysical(after), emperorNexusPhysical(g));
      assert.equal(after.nexusCards!.cards!.hands[owner], null);
      assert.equal(
        after.nexusCards!.cards!.discard.filter((card) => card === 'emperor')
          .length,
        1,
      );
      assert.equal(nexusEmperorRevivalAction(viewGame(after, owner), 0), null);
    }
  }
});

void test('Fremen bot choices preserve real elite limits and unavailable grants are not offered', () => {
  for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const { g, owner, observer } = nexusEmperorSecretAllyFixture({
      advanced: true,
      owner: 'p',
      eliteTanks: 2,
    });
    g.players.find((player) => player.id === owner)!.bot = difficulty;
    const before = emperorNexusPhysical(g);
    const [action] = botActions(viewGame(g, owner));
    assert.equal(action.type, 'nexusEmperorRevive');
    const after = applyAction(g, owner, action);
    assert.ok(
      after.players.find((player) => player.id === owner)!.elites!.revived <= 1,
    );
    assert.deepEqual(emperorNexusPhysical(after), before);
    assert.equal(nexusEmperorRevivalAction(viewGame(g, owner), 2), null);
    assert.equal(nexusEmperorRevivalAction(viewGame(g, observer), 0), null);
  }
  const { g, owner } = nexusEmperorSecretAllyFixture({ tanks: 2 });
  assert.ok(
    !botActions(viewGame(g, owner)).some(
      (action) => action.type === 'nexusEmperorRevive',
    ),
  );
});
