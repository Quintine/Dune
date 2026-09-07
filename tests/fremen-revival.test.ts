import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  type Game,
} from '../game/engine';
import { baseDeck } from '../game/cards';
import { forceRevivalRemaining, newRevivalRules } from '../game/revival';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';

function fixture(tleilaxu = true) {
  const g = createGame('FREEREV', newPlayer('f', 'Fremen', 'fremen'));
  g.players.push(
    newPlayer(
      't',
      tleilaxu ? 'Tleilaxu' : 'Atreides',
      tleilaxu ? 'tleilaxu' : 'atreides',
    ),
    newPlayer('e', 'Emperor', 'emperor'),
  );
  g.status = 'playing';
  g.phase = 4;
  g.order = ['f', 't', 'e'];
  g.revivalRules = newRevivalRules();
  for (const p of g.players) {
    p.reserves = 10;
    p.tanks = 10;
    p.spice = 20;
  }
  return g;
}
function allow(state: Game) {
  let g = state;
  while (g.response)
    g = applyAction(
      g,
      g.players.find((p) => !g.response!.passed.includes(p.id))!.id,
      { type: 'passResponse' },
    );
  return g;
}
function unchangedRejection(g: Game, amount: number) {
  const before = structuredClone(g);
  assert.throws(
    () => applyAction(g, 'f', { type: 'revive', amount }),
    /Forces/,
  );
  assert.deepEqual(g, before);
}

void test('official FAQ permits Fremen to purchase additional revivals under the Tleilaxu five-force allowance', () => {
  let g = applyAction(fixture(), 't', {
    type: 'tleilaxuRevivalLimit',
    target: 'f',
  });
  assert.equal(viewGame(g, 'f').revival.limit, 5);
  assert.equal(viewGame(g, 'f').revival.forcesRemaining, 5);
  g = allow(applyAction(g, 'f', { type: 'revive', amount: 2 }));
  assert.equal(forceRevivalRemaining(g, g.players[0]), 3);
  g = allow(applyAction(g, 'f', { type: 'revive', amount: 1 }));
  assert.equal(g.players[0].spice, 20);
  assert.equal(g.players[0].freeForcesRevived, 3);
  assert.equal(g.players[0].revived, 3);
  assert.equal(g.players[0].tanks, 7);
  g = allow(applyAction(g, 'f', { type: 'revive', amount: 2 }));
  assert.equal(g.players[0].spice, 16);
  assert.equal(g.players[0].freeForcesRevived, 3);
  assert.equal(g.players[0].revived, 5);
  assert.equal(g.players[0].tanks, 5);
  assert.equal(forceRevivalRemaining(g, g.players[0]), 0);
  unchangedRejection(g, 1);
});

void test('without Tleilaxu, free-revival prevention still leaves Fremen no ordinary paid revival method', () => {
  const g = fixture(false);
  g.expansions = ['ix'];
  g.revivalRules!.freeBlocked = ['f'];
  assert.equal(viewGame(g, 'f').revival.forcesRemaining, 0);
  unchangedRejection(g, 1);
  assert.equal(forceRevivalRemaining(g, g.players[2]), 3);
  const paid = allow(applyAction(g, 'e', { type: 'revive', amount: 3 }));
  assert.equal(paid.players[2].revived, 3);
});

void test('Emperor-paid extra returns and Ghola remain separate from Fremen normal revival', () => {
  let g = fixture();
  g.players[0].ally = 'e';
  g.players[2].ally = 'f';
  g = allow(applyAction(g, 'f', { type: 'revive', amount: 3 }));
  g = allow(applyAction(g, 'e', { type: 'emperorRevival', amount: 3 }));
  assert.equal(g.players[0].revived, 3);
  assert.equal(g.players[0].freeForcesRevived, 3);
  assert.equal(g.players[0].spice, 20);
  assert.equal(g.players[2].spice, 14);
  assert.equal(g.emperorExtra.f, 3);
  const ghola = baseDeck().find((c) => c.effect === 'ghola')!;
  g.players[0].hand = [ghola];
  g = allow(applyAction(g, 'f', { type: 'card', card: ghola.id, amount: 4 }));
  assert.equal(g.players[0].tanks, 0);
  assert.equal(g.players[0].reserves, 20);
  assert.equal(g.players[0].revived, 3);
  assert.equal(g.players[0].freeForcesRevived, 3);
});

void test('a stale pending paid Fremen request without Tleilaxu is rejected before any custody changes', () => {
  let g = fixture(false);
  g.revivalRules!.expanded = ['f'];
  g.pendingRevival = {
    player: 'f',
    kind: 'forces',
    amount: 5,
    elite: 0,
    free: 3,
    cost: 4,
    normalCost: 4,
    checks: [],
  };
  g.response = { kind: 'revivalLimit', owner: 't', recipient: 'f', passed: [] };
  g = allow(JSON.parse(JSON.stringify(g)));
  assert.equal(g.pendingRevival, null);
  assert.equal(g.players[0].reserves, 10);
  assert.equal(g.players[0].tanks, 10);
  assert.equal(g.players[0].spice, 20);
  assert.equal(g.players[0].revived, 0);
  assert.equal(g.players[0].freeForcesRevived, 0);
  assert.match(
    g.log.at(-1)!.text,
    /exceeds their current force-revival allowance/,
  );
  g = allow(applyAction(g, 'f', { type: 'revive', amount: 3 }));
  assert.equal(g.players[0].revived, 3);
});

void test('all four AI policies use the correct Fremen paid permission and private allowance', () => {
  for (const difficulty of DIFFICULTIES) {
    const g = fixture();
    g.players[0].bot = difficulty;
    g.revivalRules!.expanded = ['f'];
    const proposals = botActions(viewGame(g, 'f')).filter(
      (a) => a.type === 'revive',
    );
    assert.ok(proposals.length > 0, difficulty);
    assert.ok(
      proposals.some((a) => Number(a.amount) === 5),
      difficulty,
    );
    for (const action of proposals)
      assert.doesNotThrow(() => applyAction(g, 'f', action));
    g.revivalRules!.freeBlocked = ['f'];
    const paid = botActions(viewGame(g, 'f')).filter(
      (a) => a.type === 'revive',
    );
    assert.ok(
      paid.some((a) => Number(a.amount) === 5),
      difficulty,
    );
    for (const action of paid)
      assert.doesNotThrow(() => applyAction(g, 'f', action));
    const baseOnly = fixture(false);
    baseOnly.players[0].bot = difficulty;
    baseOnly.expansions = ['ix'];
    baseOnly.revivalRules!.freeBlocked = ['f'];
    assert.ok(
      botActions(viewGame(baseOnly, 'f')).every((a) => a.type !== 'revive'),
      difficulty,
    );
  }
});

void test('Tleilaxu presence does not itself raise the normal limit, while blocked free revival may be purchased', () => {
  let g = fixture();
  g.revivalRules!.freeBlocked = ['f'];
  assert.equal(viewGame(g, 'f').revival.freeRemaining, 0);
  assert.equal(viewGame(g, 'f').revival.forcesRemaining, 3);
  unchangedRejection(g, 4);
  g = allow(applyAction(g, 'f', { type: 'revive', amount: 3 }));
  assert.equal(g.players[0].spice, 14);
  assert.equal(g.players[0].freeForcesRevived, 0);
  assert.equal(g.players[0].revived, 3);
  assert.equal(g.players[1].spice, 26);
  assert.equal(g.players[0].reserves + g.players[0].tanks, 20);
});

void test('canceling Tleilaxu expanded revival returns no forces and charges no revival fee', () => {
  let g = applyAction(fixture(), 't', {
    type: 'tleilaxuRevivalLimit',
    target: 'f',
  });
  const karama = baseDeck().find((c) => c.effect === 'karama')!;
  g.players[2].hand = [karama];
  g = applyAction(g, 'f', { type: 'revive', amount: 5 });
  assert.equal(g.response?.kind, 'revivalLimit');
  assert.equal(g.players[0].spice, 20);
  assert.equal(g.players[0].tanks, 10);
  g = applyAction(g, 'e', { type: 'card', mode: 'cancel', card: karama.id });
  assert.equal(g.pendingRevival, null);
  assert.equal(g.players[0].spice, 20);
  assert.equal(g.players[0].tanks, 10);
  assert.equal(g.players[0].revived, 0);
  assert.equal(viewGame(g, 'f').revival.forcesRemaining, 3);
  unchangedRejection(g, 5);
  g.revivalRules!.freeBlocked = ['f'];
  g = allow(applyAction(g, 'f', { type: 'revive', amount: 3 }));
  assert.equal(g.players[0].spice, 14);
  assert.equal(g.players[0].revived, 3);
});

void test('a serialized five-force pending revival settles its free and paid portions exactly once', () => {
  let g = applyAction(fixture(), 't', {
    type: 'tleilaxuRevivalLimit',
    target: 'f',
  });
  g.players.find((p) => p.id === 'e')!.hand = [
    baseDeck().find((c) => c.effect === 'karama')!,
  ];
  g = applyAction(g, 'f', { type: 'revive', amount: 5 });
  assert.equal(g.pendingRevival?.free, 3);
  assert.equal(g.pendingRevival?.cost, 4);
  assert.equal(g.players[0].spice, 20);
  g = allow(JSON.parse(JSON.stringify(g)));
  assert.equal(g.pendingRevival, null);
  assert.equal(g.players[0].spice, 16);
  assert.equal(g.players[1].spice, 25); // Four paid spice plus once-per-turn free-revival income.
  assert.equal(g.players[0].tanks, 5);
  assert.equal(g.players[0].reserves, 15);
  assert.equal(g.players[0].revived, 5);
  assert.equal(g.players[0].freeForcesRevived, 3);
  const before = structuredClone(g);
  assert.throws(() => applyAction(g, 'e', { type: 'passResponse' }));
  assert.deepEqual(g, before);
});

void test('actual reactive La La La preserves the Tleilaxu paid exception but grants none without Tleilaxu', () => {
  for (const tleilaxu of [true, false]) {
    let g = fixture(tleilaxu);
    const choam = newPlayer('c', 'CHOAM', 'choam');
    const card = baseDeck().find((c) => c.name === 'La La La')!;
    choam.hand = [card];
    g.players.push(choam);
    g.order.push('c');
    if (tleilaxu)
      g = applyAction(g, 't', { type: 'tleilaxuRevivalLimit', target: 'f' });
    const amount = tleilaxu ? 5 : 3;
    g = applyAction(g, 'f', { type: 'revive', amount });
    assert.equal(g.decision?.kind, 'choamFreeRevival');
    g = applyAction(g, 'c', { type: 'card', mode: 'choam', card: card.id });
    g = allow(JSON.parse(JSON.stringify(g)));
    assert.equal(g.pendingRevival, null);
    assert.equal(g.players[0].spice, 20);
    assert.equal(g.players[0].tanks, 10);
    assert.equal(g.players[0].revived, 0);
    assert.equal(g.players[0].freeForcesRevived, 0);
    assert.equal(viewGame(g, 'f').revival.freeRemaining, 0);
    if (tleilaxu) {
      g = allow(applyAction(g, 'f', { type: 'revive', amount: 5 }));
      assert.equal(g.players[0].spice, 10);
      assert.equal(g.players[1].spice, 30);
      assert.equal(g.players[0].reserves, 15);
      assert.equal(g.players[0].freeForcesRevived, 0);
    } else unchangedRejection(g, 3);
  }
});
