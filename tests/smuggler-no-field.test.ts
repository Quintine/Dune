import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyAction,
  viewGame,
  normalizeAutomaticGame,
  type Game,
  type Action,
} from '../game/engine';
import { quoteSmugglerNoField } from '../game/smuggler-no-field';
import { presenceAt } from '../game/force-presence';
import {
  smugglerNoFieldGame,
  smugglerNoFieldAction,
  conserveNoFieldForces,
} from './smuggler-no-field-fixture';

function reject(g: Game, actor: string, action: Action) {
  const original = JSON.stringify(g);
  assert.throws(() => applyAction(g, actor, action));
  assert.equal(JSON.stringify(g), original);
}
function karama(g: Game, player = 'h') {
  const i = g.deck.findIndex((c) => c.effect === 'karama');
  assert.ok(i >= 0);
  const card = g.deck.splice(i, 1)[0];
  g.players.find((p) => p.id === player)!.hand.push(card);
  return card.id;
}

void test('each hidden No-Field value ships one separate Smuggler force at the unchanged marker price', () => {
  for (const value of [0, 3, 5] as const) {
    const original = smugglerNoFieldGame();
    const action = smugglerNoFieldAction(original, value);
    const shipped = applyAction(original, 'r', action);
    assert.equal(shipped.players[0].spice, 9);
    assert.equal(shipped.players[2].spice, 11);
    assert.equal(shipped.players[0].reserves, 19);
    assert.equal(shipped.players[0].forces['arrakeen:10'], 1);
    assert.equal(presenceAt(shipped.players[0], 'arrakeen'), 2);
    assert.equal(shipped.players[0].noField!.deployed!.tokenId, action.noField);
    assert.equal(original.players[0].reserves, 20);
    conserveNoFieldForces(shipped);
    const other = JSON.stringify(viewGame(shipped, 'h'));
    assert.equal(other.includes(String(action.noField)), false);
    assert.equal(other.includes('noFieldSkillProof'), false);
    const restored = JSON.parse(JSON.stringify(shipped));
    const revealed = applyAction(restored, 'r', {
      type: 'revealNoField',
      event: restored.players[0].noFieldEvent,
      token: action.noField,
    });
    assert.equal(revealed.players[0].forces['arrakeen:10'], 1 + value);
    assert.equal(revealed.players[0].reserves, 19 - value);
    conserveNoFieldForces(revealed);
    reject(revealed, 'r', action);
  }
});

void test('a scarce reserve pays the companion once; later No-Field reveal uses only the remaining supply', () => {
  for (const reserves of [1, 2]) {
    const g = smugglerNoFieldGame();
    g.players[0].reserves = reserves;
    g.players[0].tanks = 20 - reserves;
    let done = applyAction(g, 'r', smugglerNoFieldAction(g));
    done = applyAction(done, 'r', {
      type: 'revealNoField',
      event: done.players[0].noFieldEvent,
      token: done.players[0].noField!.deployed!.tokenId,
    });
    assert.equal(done.players[0].forces['arrakeen:10'], reserves);
    assert.equal(done.players[0].reserves, 0);
    conserveNoFieldForces(done);
  }
  const empty = smugglerNoFieldGame();
  empty.players[0].reserves = 0;
  empty.players[0].tanks = 20;
  reject(empty, 'r', smugglerNoFieldAction(empty));
  const plain = applyAction(empty, 'r', smugglerNoFieldAction(empty, 0, false));
  assert.equal(plain.players[0].reserves, 0);
  assert.equal(plain.players[0].spice, 9);
  assert.deepEqual(plain.players[0].forces, {});
  conserveNoFieldForces(plain);
});

void test('optional decline and desert pricing preserve the full one-marker price', () => {
  for (const smuggler of [false, undefined]) {
    const g = smugglerNoFieldGame();
    const done = applyAction(g, 'r', { ...smugglerNoFieldAction(g), smuggler });
    assert.equal(done.players[0].reserves, 20);
    assert.equal(done.players[0].spice, 9);
    assert.deepEqual(done.players[0].forces, {});
  }
  const g = smugglerNoFieldGame();
  const done = applyAction(g, 'r', {
    ...smugglerNoFieldAction(g),
    territory: 'wind_pass',
    sector: 14,
  });
  assert.equal(done.players[0].spice, 8);
  assert.equal(done.players[2].spice, 12);
  assert.equal(done.players[0].forces['wind_pass:14'], 1);
  conserveNoFieldForces(done);
});

void test('Smuggler companion requires native living public custody and a wholly empty territory', () => {
  const g = smugglerNoFieldGame();
  assert.ok(quoteSmugglerNoField(g, 'r', 'arrakeen'));
  for (const owner of ['r', 'h']) {
    const occupied = smugglerNoFieldGame();
    const p = occupied.players.find((p) => p.id === owner)!;
    p.reserves--;
    p.forces['wind_pass:15'] = 1;
    assert.equal(quoteSmugglerNoField(occupied, 'r', 'wind_pass'), null);
    reject(occupied, 'r', {
      ...smugglerNoFieldAction(occupied),
      territory: 'wind_pass',
      sector: 14,
    });
  }
  const hidden = viewGame(g, 'r');
  hidden.leaderSkills!.assignments.find((a) => a.owner === 'r')!.faceUp = false;
  assert.equal(quoteSmugglerNoField(hidden, 'r', 'arrakeen'), null);
  for (const absent of [
    { dead: true },
    { capturedBy: 'h' },
    { gholaBy: 'h' },
  ]) {
    const unavailable = smugglerNoFieldGame();
    const leader = unavailable.players[0].leaders.find(
      (l) =>
        l.id ===
        unavailable.leaderSkills!.assignments.find((a) => a.owner === 'r')!
          .leader,
    )!;
    Object.assign(leader, absent);
    assert.equal(quoteSmugglerNoField(unavailable, 'r', 'arrakeen'), null);
  }
});

void test('initial Karama cancellation preserves the companion, spice, token history and ordinary shipment opportunity', () => {
  const g = smugglerNoFieldGame();
  const card = karama(g);
  const pending = applyAction(g, 'r', smugglerNoFieldAction(g));
  assert.equal(pending.response?.kind, 'richeseNoField');
  assert.equal(pending.pendingShipment?.amount, 1);
  assert.equal(pending.pendingShipment?.smugglerCompanion?.amount, 1);
  const canceled = applyAction(JSON.parse(JSON.stringify(pending)), 'h', {
    type: 'card',
    mode: 'cancel',
    card,
  });
  assert.equal(canceled.players[0].reserves, 20);
  assert.equal(canceled.players[0].spice, 10);
  assert.equal(canceled.players[0].noField!.lastShipped, null);
  assert.equal(canceled.players[0].shipped, false);
  const fallback = applyAction(canceled, 'r', {
    type: 'ship',
    amount: 1,
    territory: 'arrakeen',
    sector: 10,
  });
  assert.equal(fallback.players[0].reserves, 19);
  conserveNoFieldForces(fallback);
});

void test('Advanced Guild allows the saved companion once and hides its private declaration proof', () => {
  const g = smugglerNoFieldGame(true);
  const action = smugglerNoFieldAction(g);
  const pending = applyAction(g, 'r', action);
  assert.equal(pending.decision?.kind, 'guildShipment');
  assert.equal(pending.pendingShipment?.amount, 1);
  assert.equal(pending.players[0].reserves, 20);
  for (const p of pending.players) {
    const view = JSON.stringify(viewGame(pending, p.id));
    assert.equal(view.includes('noFieldSkillProof'), false);
    if (p.id !== 'r')
      assert.equal(view.includes(String(action.noField)), false);
  }
  const done = applyAction(JSON.parse(JSON.stringify(pending)), 'g', {
    type: 'decision',
    allow: true,
  });
  assert.equal(done.players[0].reserves, 19);
  assert.equal(done.players[0].forces['arrakeen:10'], 1);
  conserveNoFieldForces(done);
  reject(done, 'g', { type: 'decision', allow: true });
});

void test('both saved No-Field stages reject changed companion, proof, destination and missing continuation before mutation', () => {
  for (const advanced of [false, true]) {
    const g = smugglerNoFieldGame(advanced);
    if (!advanced) karama(g);
    const pending = applyAction(g, 'r', smugglerNoFieldAction(g));
    const corruptions: ((g: Game) => void)[] = [
      (x) => {
        delete x.pendingShipment!.smugglerCompanion;
      },
      (x) => {
        x.pendingShipment!.smugglerCompanion!.leader = 'stale';
      },
      (x) => {
        delete x.pendingShipment!.noFieldSkillProof;
      },
      (x) => {
        x.pendingShipment!.noFieldSkillProof = 'stale';
      },
      (x) => {
        x.pendingShipment!.amount = 2;
      },
      (x) => {
        x.pendingShipment!.cost = 0;
      },
      (x) => {
        x.pendingShipment!.territory = 'carthag';
      },
      (x) => {
        x.pendingShipment = null;
      },
      (x) => {
        x.response = null;
        x.decision = null;
      },
      (x) => {
        x.players[0].reserves = 0;
        x.players[0].tanks = 20;
      },
      (x) => {
        x.players[1].reserves--;
        x.players[1].forces['arrakeen:10'] = 1;
      },
    ];
    for (const corrupt of corruptions) {
      const bad = structuredClone(pending);
      corrupt(bad);
      assert.throws(() => viewGame(bad, 'r'));
      assert.throws(() => normalizeAutomaticGame(bad));
      reject(
        bad,
        advanced ? 'g' : 'h',
        advanced ? { type: 'decision', allow: true } : { type: 'pass' },
      );
    }
  }
});
