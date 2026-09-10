import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame } from '../game/engine';
import { botActions } from '../game/bots';
import {
  nexusGuildCunningFixture,
  originalGuildCunningTurn,
  nexusGuildCunningAllow,
  settleGuildCunningShipment,
  nexusGuildCunningInventory,
  holdGuildCunningCard,
} from './fixture-nexus-guild-cunning';

void test('all Guild profiles finish the first turn through Cunning then propose a second shipment without ordinary movement', () => {
  for (const profile of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const f = nexusGuildCunningFixture();
    const first = originalGuildCunningTurn(f);
    const v = viewGame(first, f.owner);
    v.players.find((p) => p.id === f.owner)!.bot = profile;
    const action = botActions(v)[0];
    assert.equal(action.type, 'endMovement');
    assert.equal(action.nexus, v.nexusGuildCunning!.offer!.event);
    const g = nexusGuildCunningAllow(applyAction(first, f.owner, action));
    const next = viewGame(g, f.owner);
    next.players.find((p) => p.id === f.owner)!.bot = profile;
    const candidates = botActions(next);
    assert.ok(
      candidates.some((a) => a.type === 'ship' || a.type === 'guildShip'),
    );
    assert.ok(candidates.every((a) => a.type !== 'move'));
    const shipment = candidates.find(
      (a) => a.type === 'ship' || a.type === 'guildShip',
    )!;
    nexusGuildCunningInventory(
      settleGuildCunningShipment(applyAction(g, f.owner, shipment)),
    );
  }
});
void test('all Guild profiles use only an offered unused Hajr after the second shipment and preserve blocked ordinary fallback', () => {
  for (const profile of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const f = nexusGuildCunningFixture();
    const hajr = holdGuildCunningCard(f.g, f.owner, 'hajr');
    const first = originalGuildCunningTurn(f);
    const v = viewGame(first, f.owner);
    v.players.find((p) => p.id === f.owner)!.bot = profile;
    const declared = botActions(v)[0];
    v.nexusGuildCunning!.offer!.blocked = 'Unavailable';
    assert.equal(botActions(v)[0].nexus, undefined);
    let g = nexusGuildCunningAllow(applyAction(first, f.owner, declared));
    g = settleGuildCunningShipment(
      applyAction(g, f.owner, {
        type: 'ship',
        territory: 'carthag',
        sector: 11,
        amount: 3,
      }),
    );
    const after = viewGame(g, f.owner);
    after.players.find((p) => p.id === f.owner)!.bot = profile;
    assert.deepEqual(botActions(after)[0], { type: 'card', card: hajr.id });
    const prepared = applyAction(g, f.owner, botActions(after)[0]);
    const pv = viewGame(prepared, f.owner);
    pv.players.find((p) => p.id === f.owner)!.bot = profile;
    const move = botActions(pv).find((a) => a.type === 'move');
    assert.ok(move);
    nexusGuildCunningInventory(applyAction(prepared, f.owner, move));
  }
});

void test('all Guild profiles skip an unaffordable second shipment to retain their owned unused Hajr', () => {
  for (const profile of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const f = nexusGuildCunningFixture({ spice: 3 }),
      hajr = holdGuildCunningCard(f.g, f.owner, 'hajr');
    const first = originalGuildCunningTurn(f),
      fv = viewGame(first, f.owner);
    fv.players[0].bot = profile;
    const g = nexusGuildCunningAllow(
      applyAction(first, f.owner, botActions(fv)[0]),
    );
    const v = viewGame(g, f.owner);
    v.players[0].bot = profile;
    const skip = botActions(v)[0];
    assert.equal(skip.type, 'nexusGuildSkipShipment');
    const next = applyAction(g, f.owner, skip),
      nv = viewGame(next, f.owner);
    nv.players[0].bot = profile;
    assert.deepEqual(botActions(nv)[0], { type: 'card', card: hajr.id });
    nexusGuildCunningInventory(applyAction(next, f.owner, botActions(nv)[0]));
  }
});

void test('a new answered Truthtrance binds the second shipment and all profiles honor its six-force witness despite shipped true', () => {
  for (const profile of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const f = nexusGuildCunningFixture();
    const truth = holdGuildCunningCard(f.g, f.target, 'truthtrance');
    const first = originalGuildCunningTurn(f);
    const fv = viewGame(first, f.owner);
    fv.players[0].bot = profile;
    let g = nexusGuildCunningAllow(
      applyAction(first, f.owner, botActions(fv)[0]),
    );
    g = applyAction(g, f.target, { type: 'card', card: truth.id });
    for (let n = 0; n < 10 && g.truthtrance?.stage === 'priority'; n++)
      g = applyAction(
        g,
        g.players.find((p) => !g.truthtrance!.passed.includes(p.id))!.id,
        { type: 'truthPass' },
      );
    g = applyAction(g, f.target, {
      type: 'truthAsk',
      question: {
        kind: 'shipment',
        target: f.owner,
        territory: 'carthag',
        minimum: 6,
      },
    });
    assert.ok(viewGame(g, f.owner).truthShipmentAnswers!.includes('yes'));
    g = applyAction(g, f.owner, { type: 'truthAnswer', answer: 'yes' });
    const v = viewGame(g, f.owner);
    v.players[0].bot = profile;
    assert.equal(v.players[0].shipped, true);
    const actions = botActions(v);
    assert.ok(actions.length);
    assert.ok(
      actions.every(
        (a) =>
          a.type === 'ship' &&
          a.territory === 'carthag' &&
          Number(a.amount) >= 6,
      ),
    );
    const done = settleGuildCunningShipment(
      applyAction(g, f.owner, actions[0]),
    );
    assert.ok(
      done.players.find((p) => p.id === f.owner)!.forces['carthag:11'] >= 6,
    );
    assert.ok(done.shipmentPromises!.every((p) => p.fulfilled && !p.released));
    nexusGuildCunningInventory(done);
  }
});
