import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  newPlayer,
  joinGame,
  applyAction,
  viewGame,
  battles,
  type Game,
} from '../game/engine';
import { isAdvisor, fighterCount } from '../game/advisors';
import { baseDeck, spiceDeck } from '../game/cards';

/** Transfer fixture cards from the actual deck; never duplicate another seat's hand. */
function setBattleHand(g: Game, id: string, ids: string[]) {
  const owner = g.players.find((p) => p.id === id)!;
  g.deck.push(...owner.hand);
  owner.hand = [];
  owner.hand = ids.map((cardId) => {
    assert.ok(
      !g.players.some((p) => p.hand.some((card) => card.id === cardId)),
      `Fixture card ${cardId} is already held by another seat`,
    );
    const index = g.deck.findIndex((card) => card.id === cardId);
    assert.ok(
      index >= 0,
      `Physical fixture card ${cardId} must be in the deck`,
    );
    return g.deck.splice(index, 1)[0];
  });
}
function fixture() {
  let g = createGame('ADVISOR2', newPlayer('a', 'Atreides', 'atreides'));
  joinGame(g, newPlayer('b', 'Bene Gesserit', 'beneGesserit'));
  joinGame(g, newPlayer('h', 'Harkonnen', 'harkonnen'));
  g.players.forEach((p) => (p.ready = true));
  g = applyAction(g, 'a', { type: 'start' });
  g = applyAction(g, 'b', { type: 'predict', faction: 'atreides', turn: 3 });
  for (const p of g.players)
    if (p.traitorChoices.length)
      g = applyAction(g, p.id, {
        type: 'traitor',
        leader: p.traitorChoices[0],
      });
  g.advanced = true;
  g.phase = 5;
  g.active = 'a';
  g.order = ['a', 'b', 'h'];
  g.movementRemaining = [...g.order];
  g.storm = 18;
  for (const p of g.players) {
    p.forces = {};
    p.reserves = 20;
    p.spice = 20;
    g.deck.push(...p.hand);
    p.hand = [];
    p.traitors = [];
  }
  return g;
}
function army(
  g: Game,
  id: string,
  forces: Record<string, number>,
  advisors: string[] = [],
) {
  const p = g.players.find((p) => p.id === id)!;
  p.forces = forces;
  p.reserves = 20 - Object.values(forces).reduce((s, n) => s + n, 0);
  p.advisors = Object.fromEntries(advisors.map((t) => [t, {}]));
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
function ready(state: Game) {
  let g = state;
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  return g;
}
function cancel(g: Game) {
  assert.ok(g.response);
  assert.equal(g.players[0].hand[0].effect, 'karama');
  return applyAction(g, 'a', {
    type: 'card',
    mode: 'cancel',
    card: g.players[0].hand[0].id,
  });
}
function move(
  g: Game,
  id: string,
  from: string,
  territory: string,
  sector: number,
  amount: number,
  extra = {},
) {
  return applyAction(g, id, {
    type: 'move',
    from,
    territory,
    sector,
    amount,
    ...extra,
  });
}
void test('advisors coexist without battle, blocking another faction entry or contesting a stronghold win', () => {
  let g = fixture();
  army(g, 'a', { 'arrakeen:10': 2, 'carthag:11': 1, 'sietch_tabr:14': 1 });
  army(g, 'b', { 'arrakeen:10': 1 }, ['arrakeen']);
  assert.deepEqual(battles(g), []);
  g.active = 'h';
  const shipped = applyAction(g, 'h', {
    type: 'ship',
    territory: 'arrakeen',
    sector: 10,
    amount: 1,
  });
  assert.equal(shipped.players[2].forces['arrakeen:10'], 1);
  g.phase = 7;
  g = ready(g);
  assert.deepEqual(g.winner, ['a']);
});
void test('advisors collect no ground spice, stronghold income or ornithopter benefit', () => {
  let g = fixture();
  army(g, 'a', { 'arrakeen:10': 1, 'red_chasm:7': 1 });
  army(g, 'b', { 'arrakeen:10': 1, 'red_chasm:7': 2 }, [
    'arrakeen',
    'red_chasm',
  ]);
  g.spice = { 'red_chasm:7': 8 };
  g.active = 'h';
  g.movementRemaining = ['h'];
  g = applyAction(g, 'h', { type: 'endMovement' });
  assert.equal(g.phase, 7);
  assert.equal(g.players[1].spice, 20);
  assert.equal(g.players[0].spice, 25); // two city income + three collected
  assert.equal(g.spice['red_chasm:7'], 5);
  g.phase = 5;
  g.active = 'b';
  assert.throws(
    () => move(g, 'b', 'red_chasm:7', 'shield_wall', 8, 1),
    /more than 1/,
  );
});
void test('advisor-only forces cannot play Family Atomics', () => {
  const g = fixture();
  army(g, 'a', { 'imperial_basin:10': 1 });
  army(g, 'b', { 'imperial_basin:10': 1 }, ['imperial_basin']);
  g.phase = 0;
  const atomics = baseDeck().find((c) => c.effect === 'atomics')!;
  g.players[1].hand = [atomics];
  assert.throws(
    () => applyAction(g, 'b', { type: 'card', card: atomics.id }),
    /forces on or adjacent/,
  );
});
void test('direct shipments match existing advisors, while a new direct shipment enters as fighters', () => {
  let g = fixture();
  army(g, 'a', { 'arrakeen:10': 1, 'carthag:11': 1 });
  army(g, 'h', { 'arrakeen:10': 1 });
  army(g, 'b', { 'arrakeen:10': 1 }, ['arrakeen']);
  g.active = 'b';
  const joined = applyAction(g, 'b', {
    type: 'ship',
    territory: 'arrakeen',
    sector: 10,
    amount: 2,
  });
  assert.equal(joined.players[1].forces['arrakeen:10'], 3);
  assert.equal(isAdvisor(joined.players[1], 'arrakeen'), true);
  g = applyAction(g, 'b', {
    type: 'ship',
    territory: 'carthag',
    sector: 11,
    amount: 2,
  });
  assert.equal(isAdvisor(g.players[1], 'carthag'), false);
  assert.equal(fighterCount(g.players[1], 'carthag'), 2);
});
void test('moving fighters into existing advisors matches their stance, and the last outsider leaving automatically promotes advisors', () => {
  let g = fixture();
  army(g, 'a', { 'arrakeen:10': 1 });
  army(g, 'b', { 'arrakeen:10': 1, 'imperial_basin:10': 2 }, ['arrakeen']);
  g.active = 'b';
  g = move(g, 'b', 'imperial_basin:10', 'arrakeen', 10, 2);
  assert.equal(g.players[1].forces['arrakeen:10'], 3);
  assert.equal(fighterCount(g.players[1], 'arrakeen'), 0);
  g.active = 'a';
  g = move(g, 'a', 'arrakeen:10', 'imperial_basin', 10, 1);
  assert.equal(isAdvisor(g.players[1], 'arrakeen'), false);
  assert.equal(fighterCount(g.players[1], 'arrakeen'), 3);
});
void test('advisors moving to an empty territory become fighters; optional occupied-territory flips can be canceled after movement', () => {
  const g = fixture();
  g.players[0].hand = [baseDeck().find((c) => c.effect === 'karama')!];
  army(g, 'a', { 'arrakeen:10': 1 });
  army(g, 'h', { 'imperial_basin:10': 1 });
  army(g, 'b', { 'arrakeen:10': 2 }, ['arrakeen']);
  g.active = 'b';
  const moved = move(g, 'b', 'arrakeen:10', 'imperial_basin', 10, 2, {
    fighters: true,
  });
  assert.equal(moved.response?.kind, 'advisorFlip');
  const canceled = cancel(moved);
  assert.equal(isAdvisor(canceled.players[1], 'imperial_basin'), true);
  assert.equal(canceled.players[1].moved, 1);
  assert.equal(canceled.players[1].forces['arrakeen:10'], undefined);
  assert.equal(isAdvisor(allow(moved).players[1], 'imperial_basin'), false);
  g.players[2].forces = {};
  const empty = move(g, 'b', 'arrakeen:10', 'imperial_basin', 10, 2);
  assert.equal(isAdvisor(empty.players[1], 'imperial_basin'), false);
  assert.equal(empty.response, null);
});
void test('intrusion resolves before free accompaniment, with a separate cancelable token flip and same-turn advisor lock', () => {
  let g = fixture();
  g.players[0].hand = [baseDeck().find((c) => c.effect === 'karama')!];
  army(g, 'b', { 'arrakeen:10': 1 });
  g = applyAction(g, 'a', {
    type: 'ship',
    territory: 'arrakeen',
    sector: 10,
    amount: 2,
  });
  assert.equal(g.decision?.kind, 'intrusion');
  assert.throws(
    () => applyAction(g, 'a', { type: 'endMovement' }),
    /pending decision/,
  );
  g = applyAction(g, 'b', { type: 'decision', accept: true });
  assert.equal(g.response?.kind, 'advisorFlip');
  const denied = cancel(g);
  assert.equal(fighterCount(denied.players[1], 'arrakeen'), 1);
  assert.equal(denied.decision?.kind, 'advisor');
  g = allow(g);
  assert.equal(g.decision?.kind, 'advisor');
  g = allow(
    applyAction(g, 'b', { type: 'decision', accept: true, accompany: true }),
  );
  assert.equal(g.players[1].forces['arrakeen:10'], 2);
  assert.equal(g.players[1].advisors!.arrakeen.lockedTurn, 1);
  assert.equal(g.players[1].reserves, 18);
  assert.equal(viewGame(g, 'h').players[1].advisors!.arrakeen.lockedTurn, 1);
});
void test('ordinary movement and repeated entry both trigger intrusion; declining does not consume a later intrusion', () => {
  let g = fixture();
  army(g, 'b', { 'arrakeen:10': 2 });
  army(g, 'a', { 'arrakeen:10': 1, 'imperial_basin:10': 2 });
  g = move(g, 'a', 'imperial_basin:10', 'arrakeen', 10, 1);
  assert.equal(g.decision?.kind, 'intrusion');
  g = applyAction(g, 'b', { type: 'decision', accept: false });
  g.active = 'h';
  g = applyAction(g, 'h', {
    type: 'ship',
    territory: 'imperial_basin',
    sector: 10,
    amount: 1,
  });
  g = applyAction(g, 'b', { type: 'decision', accept: false });
  // Use the existing opponent again; a third fighter faction is correctly blocked.
  g.active = 'a';
  g.players[0].moved = 0;
  g = move(g, 'a', 'imperial_basin:10', 'arrakeen', 10, 1);
  assert.equal(g.decision?.kind, 'intrusion');
});
void test('pre-shipment declaration excludes allies and storm-locked battles, and each accepted territory has a cancellation window', () => {
  let g = fixture();
  g.players[0].hand = [baseDeck().find((c) => c.effect === 'karama')!];
  army(g, 'a', { 'arrakeen:10': 1, 'carthag:11': 1 });
  army(g, 'b', { 'arrakeen:10': 3, 'carthag:11': 2 }, ['arrakeen', 'carthag']);
  g.storm = 11;
  g.phase = 4;
  g = allow(ready(g));
  assert.deepEqual(g.decision, {
    kind: 'advisorBattle',
    player: 'b',
    territories: ['arrakeen'],
  });
  assert.throws(
    () =>
      applyAction(g, 'b', {
        type: 'decision',
        accept: true,
        territory: 'carthag',
      }),
    /cannot prepare/,
  );
  g = applyAction(g, 'b', {
    type: 'decision',
    accept: true,
    territory: 'arrakeen',
  });
  g = cancel(g);
  assert.equal(g.decision, null);
  assert.equal(g.active, 'a');
  assert.equal(isAdvisor(g.players[1], 'arrakeen'), true);
  g.phase = 4;
  g.ready = [];
  g.players[1].ally = 'a';
  g.players[0].ally = 'b';
  g = allow(ready(g));
  assert.equal(g.decision, null);
});
void test('a lasgun/shield explosion kills bystanding advisors but ordinary battles leave them untouched', () => {
  let g = fixture();
  army(g, 'a', { 'arrakeen:10': 2 });
  army(g, 'h', { 'arrakeen:10': 2 });
  army(g, 'b', { 'arrakeen:10': 2 }, ['arrakeen']);
  g.phase = 6;
  g = allow(
    applyAction(g, 'a', {
      type: 'chooseBattle',
      territory: 'arrakeen',
      target: 'h',
    }),
  );
  g = applyAction(g, 'a', { type: 'declineBattlePower' });
  g = applyAction(g, 'a', { type: 'decision', decline: true });
  const shield = baseDeck().find((c) => c.kind === 'shield')!;
  const lasgun = baseDeck().find((c) => c.kind === 'lasgun')!;
  setBattleHand(g, 'a', [shield.id]);
  setBattleHand(g, 'h', [lasgun.id]);
  const prepared = structuredClone(g);
  for (const explosion of [false, true]) {
    let fight = applyAction(prepared, 'a', {
      type: 'battlePlan',
      dial: 0,
      leader: 'atreides-0',
      defense: explosion ? shield.id : null,
    });
    fight = applyAction(fight, 'h', {
      type: 'battlePlan',
      dial: 0,
      leader: 'harkonnen-0',
      weapon: explosion ? lasgun.id : null,
    });
    fight = applyAction(fight, 'a', { type: 'traitorCall', call: false });
    fight = applyAction(fight, 'h', { type: 'traitorCall', call: false });
    assert.equal(fight.players[1].tanks, explosion ? 2 : 0);
    assert.equal(
      fight.players[1].forces['arrakeen:10'] ?? 0,
      explosion ? 0 : 2,
    );
  }
});

void test('new advisors cannot flip into occupied fighters during their arrival turn, and the lock survives a move', () => {
  let g = fixture();
  army(g, 'a', { 'arrakeen:10': 1, 'imperial_basin:10': 1 });
  army(g, 'b', { 'arrakeen:10': 2 }, ['arrakeen']);
  g.players[1].advisors!.arrakeen.lockedTurn = g.turn;
  g.active = 'b';
  const before = structuredClone(g);
  assert.throws(
    () =>
      move(g, 'b', 'arrakeen:10', 'imperial_basin', 10, 1, { fighters: true }),
    /cannot flip/,
  );
  assert.deepEqual(g, before);
  g = move(g, 'b', 'arrakeen:10', 'imperial_basin', 10, 1);
  assert.equal(g.players[1].advisors!.imperial_basin.lockedTurn, g.turn);
  const joined = structuredClone(before);
  joined.players[1].forces['imperial_basin:10'] = 1;
  assert.throws(
    () => move(joined, 'b', 'arrakeen:10', 'imperial_basin', 10, 1),
    /cannot become fighters/,
  );
});
void test('advisor setup waits for Fremen, follows their placement, and becomes fighters only when alone', () => {
  for (const occupied of [false, true]) {
    let g = createGame('ADSETUP2', newPlayer('a', 'Atreides', 'atreides'));
    joinGame(g, newPlayer('b', 'Bene Gesserit', 'beneGesserit'));
    joinGame(g, newPlayer('h', 'Harkonnen', 'harkonnen'));
    joinGame(g, newPlayer('f', 'Fremen', 'fremen'));
    g.players.forEach((p) => (p.ready = true));
    g = applyAction(g, 'a', { type: 'start' });
    g.advanced = true;
    g = applyAction(g, 'b', { type: 'predict', faction: 'atreides', turn: 3 });
    for (const p of g.players)
      if (p.traitorChoices.length)
        g = applyAction(g, p.id, {
          type: 'traitor',
          leader: p.traitorChoices[0],
        });
    g.storm = 18;
    army(g, 'a', occupied ? { 'arrakeen:10': 1 } : {});
    army(g, 'h', {});
    assert.equal(g.setupStage, 'forces');
    const before = structuredClone(g);
    assert.throws(
      () =>
        applyAction(g, 'b', {
          type: 'advisorSetup',
          territory: 'arrakeen',
          sector: 10,
        }),
      /Wait for the current setup step: forces/,
    );
    assert.deepEqual(g, before);
    g = applyAction(g, 'f', {
      type: 'fremenSetup',
      placements: { sietch_tabr: 10 },
    });
    assert.equal(g.status, 'setup');
    g = applyAction(g, 'b', {
      type: 'advisorSetup',
      territory: 'arrakeen',
      sector: 10,
    });
    assert.equal(g.status, 'playing');
    assert.equal(g.players[1].reserves, 19);
    assert.equal(g.players[1].forces['arrakeen:10'], 1);
    assert.equal(isAdvisor(g.players[1], 'arrakeen'), occupied);
  }
});
void test('worm-ride intrusion completes before the spice sequence proceeds, including a canceled flip', () => {
  let g = fixture();
  g.players[0].hand = [baseDeck().find((c) => c.effect === 'karama')!];
  g.players[2].faction = 'fremen';
  army(g, 'h', { 'red_chasm:7': 2 });
  army(g, 'b', { 'imperial_basin:10': 2 });
  g.phase = 1;
  g.turn = 2;
  g.nexus = true;
  g.decision = { kind: 'wormRide', player: 'h', territory: 'red_chasm' };
  g = applyAction(g, 'h', {
    type: 'decision',
    accept: true,
    territory: 'imperial_basin',
    sector: 10,
    forces: { 'red_chasm:7': 2 },
  });
  assert.equal(g.phase, 1);
  assert.equal(g.decision?.kind, 'intrusion');
  g = applyAction(g, 'b', { type: 'decision', accept: true });
  assert.equal(g.response?.advisorResume, 'wormRide');
  const canceled = cancel(g);
  assert.equal(canceled.phase, 2);
  assert.equal(canceled.nexus, false);
  assert.equal(fighterCount(canceled.players[1], 'imperial_basin'), 2);
  const accepted = allow(g);
  assert.equal(accepted.phase, 2);
  assert.equal(isAdvisor(accepted.players[1], 'imperial_basin'), true);
});
void test('advisors die in storm and obsolete stance records are removed without altering force conservation', () => {
  let g = fixture();
  army(g, 'a', { 'red_chasm:7': 2 });
  army(g, 'b', { 'red_chasm:7': 3 }, ['red_chasm']);
  g.phase = 0;
  g.storm = 6;
  g.stormPending = 1;
  g = ready(g);
  assert.equal(g.players[1].tanks, 3);
  assert.equal(g.players[1].advisors!.red_chasm, undefined);
  assert.equal(g.players[1].reserves + g.players[1].tanks, 20);
  assert.equal(g.players[0].tanks, 2);
});
void test('Guild cross-shipping matches existing advisors and preserves their arrival lock', () => {
  let g = fixture();
  g.players[2].faction = 'guild';
  g.players[2].ally = 'b';
  g.players[1].ally = 'h';
  army(g, 'a', { 'arrakeen:10': 1, 'red_chasm:7': 1 });
  army(g, 'b', { 'arrakeen:10': 2, 'red_chasm:7': 1 }, [
    'arrakeen',
    'red_chasm',
  ]);
  g.players[1].advisors!.arrakeen.lockedTurn = g.turn;
  g.active = 'b';
  g = allow(
    applyAction(g, 'b', {
      type: 'guildShip',
      from: 'arrakeen:10',
      territory: 'red_chasm',
      sector: 7,
      amount: 2,
    }),
  );
  assert.equal(g.players[1].advisors!.red_chasm.lockedTurn, g.turn);
  assert.equal(g.players[1].advisors!.arrakeen, undefined);
  assert.equal(g.players[1].forces['red_chasm:7'], 3);
  assert.deepEqual(
    viewGame(JSON.parse(JSON.stringify(g)), 'a').players[1].advisors,
    viewGame(g, 'a').players[1].advisors,
  );
});

void test('accompanying advisors may select a valid sector of the shipment territory, with no reserve loss on a rejected choice', () => {
  let g = fixture();
  g = applyAction(g, 'a', {
    type: 'ship',
    territory: 'imperial_basin',
    sector: 10,
    amount: 1,
  });
  assert.equal(g.decision?.kind, 'advisor');
  const before = structuredClone(g);
  assert.throws(
    () =>
      applyAction(g, 'b', {
        type: 'decision',
        accept: true,
        accompany: true,
        sector: 17,
      }),
    /sector belonging/,
  );
  assert.deepEqual(g, before);
  g = allow(
    applyAction(g, 'b', {
      type: 'decision',
      accept: true,
      accompany: true,
      sector: 11,
    }),
  );
  assert.equal(g.players[1].forces['imperial_basin:11'], 1);
  assert.equal(g.players[1].reserves, 19);
  assert.equal(isAdvisor(g.players[1], 'imperial_basin'), true);
});
void test('worms devour peaceful advisors and clean their territory stance', () => {
  let g = fixture();
  const land = spiceDeck().filter((c) => 'territory' in c);
  const worm = spiceDeck().find((c) => 'worm' in c)!;
  const target = land[0];
  const key = `${target.territory}:${target.sector}`;
  army(g, 'a', { [key]: 1 });
  army(g, 'b', { [key]: 2 }, [target.territory]);
  g.phase = 1;
  g.turn = 2;
  g.spiceDiscard = [[target], []];
  g.spiceDeck = [worm, land[1]];
  g = ready(g);
  assert.equal(g.players[1].tanks, 2);
  assert.equal(g.players[1].advisors![target.territory], undefined);
  assert.equal(g.players[1].reserves, 18);
});
