import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  normalizeAutomaticGame,
  viewGame,
  type Action,
  type Game,
} from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  nexusTraitorFixture,
  nexusTraitorInventory,
  nexusTraitorBattle,
} from './fixture-nexus-traitors';
import { nexusAllow, nexusReload } from './fixture-nexus-cards';

function fixture(
  options: {
    revealed?: number;
    phase?: number;
    opponentFaction?: 'atreides' | 'richese';
  } = {},
): Game {
  const g = nexusTraitorFixture({
    ownerFaction: 'tleilaxu',
    opponentFaction: options.opponentFaction,
    phase: options.phase,
  });
  const cards = g.nexusCards!.cards!;
  const index = cards.deck.indexOf('tleilaxu');
  assert.ok(index >= 0);
  assert.equal(cards.hands.p, 'harkonnen');
  cards.deck[index] = 'harkonnen';
  cards.hands.p = 'tleilaxu';
  g.players[0].faceDancers!.forEach((card, i) => {
    card.revealed = i < (options.revealed ?? 2);
  });
  nexusTraitorInventory(g);
  return g;
}
function action(g: Game): Action {
  const offer = viewGame(g, 'p').nexusTleilaxu!.cunning!;
  assert.equal(offer.blocked, null);
  return { type: 'nexusFaceDancers', event: offer.event };
}
function refresh(g: Game): Game {
  return applyAction(g, 'p', action(g));
}
function hold(g: Game, owner: string, effect: string): string {
  const source = g.richeseCache?.some((card) => card.effect === effect)
    ? g.richeseCache
    : g.deck;
  const index = source.findIndex((card) => card.effect === effect);
  assert.ok(index >= 0);
  const card = source.splice(index, 1)[0];
  g.players.find((p) => p.id === owner)!.hand.push(card);
  return card.id;
}
function reject(g: Game, id: string, attempted: Action): void {
  const before = JSON.stringify(g);
  assert.throws(() => applyAction(g, id, attempted));
  assert.equal(JSON.stringify(g), before);
}
function inventory(g: Game): string[] {
  return [
    ...g.deck,
    ...g.discard,
    ...(g.richeseCache ?? []),
    ...g.players.flatMap((p) => p.hand),
  ]
    .map((c) => c.id)
    .sort();
}

/** The leader identity moves between existing physical zones before the battle;
 * actual battle resolution and the ordinary reveal create the revealed dancer. */
function actuallyReveal(): Game {
  let g = fixture({ revealed: 0, phase: 6 });
  const owner = g.players[0],
    winner = g.players[1],
    loser = g.players[2];
  const leader = winner.leaders.reduce((best, next) =>
    next.strength > best.strength ? next : best,
  );
  const opposing = loser.leaders.reduce((best, next) =>
    next.strength < best.strength ? next : best,
  );
  assert.ok(leader.strength > opposing.strength);
  if (!owner.faceDancers!.some((c) => c.leader === leader.id)) {
    const displaced = owner.faceDancers![0].leader;
    const index = g.traitorReserve!.indexOf(leader.id);
    if (index >= 0) g.traitorReserve![index] = displaced;
    else {
      const holder = g.players.find((p) => p.traitors.includes(leader.id));
      assert.ok(holder);
      holder.traitors[holder.traitors.indexOf(leader.id)] = displaced;
    }
    owner.faceDancers![0].leader = leader.id;
  }
  for (const p of g.players) {
    p.forces = {};
    p.reserves = 20;
    p.tanks = 0;
  }
  for (const p of [winner, loser]) {
    p.forces = { 'pasty_mesa:5': 3 };
    p.reserves = 17;
  }
  g.active = 'q';
  g.order = ['q', 'r', 'p'];
  g = applyAction(g, 'q', {
    type: 'chooseBattle',
    territory: 'pasty_mesa',
    target: 'r',
  });
  for (const id of ['q', 'r'])
    if (g.battle!.preLeader && !g.battle!.preLeader.closed)
      g = applyAction(g, id, {
        type: 'battlePreparationReady',
        event: g.battle!.event,
      });
  for (const [id, disc] of [
    ['q', leader.id],
    ['r', opposing.id],
  ])
    g = applyAction(g, id, { type: 'battlePlan', leader: disc, dial: 0 });
  for (const id of ['q', 'r'])
    g = applyAction(g, id, { type: 'traitorCall', call: false });
  assert.equal(g.decision?.kind, 'faceDance');
  g = applyAction(g, 'p', {
    type: 'decision',
    reveal: true,
    sources: { reserves: 1 },
    sector: 5,
  });
  assert.equal(g.players[0].faceDancers!.filter((c) => c.revealed).length, 1);
  nexusTraitorInventory(g);
  return g;
}

void test('a real winning-leader Face Dance supplies the revealed card for an atomic Nexus refresh', () => {
  const original = actuallyReveal();
  const replaced = original.players[0].faceDancers!.find(
    (c) => c.revealed,
  )!.leader;
  const next = original.traitorReserve![0];
  const g = refresh(original);
  assert.deepEqual(g.nexusFaceDancerHistory![0].replaced, [replaced]);
  assert.deepEqual(g.nexusFaceDancerHistory![0].drawn, [next]);
  assert.ok(g.traitorReserve!.includes(replaced));
  assert.ok(
    g.players[0].faceDancers!.some((c) => c.leader === next && !c.revealed),
  );
  assert.equal(
    g.players[0].faceDancers!.some((c) => c.leader === replaced),
    false,
  );
  assert.equal(g.nexusCards!.cards!.hands.p, null);
  assert.equal(
    g.nexusCards!.cards!.discard.filter((c) => c === 'tleilaxu').length,
    1,
  );
  assert.deepEqual(normalizeAutomaticGame(nexusReload(g)), nexusReload(g));
  nexusTraitorInventory(g);
});

void test('all revealed dancers refresh together off turn in multiple phases without a choice or acknowledgement', () => {
  for (const phase of [2, 4, 5, 6, 8]) {
    const original = fixture({ phase });
    original.active = 'q';
    const before = structuredClone(original.players[0].faceDancers!);
    const drawn = original.traitorReserve!.slice(0, 2);
    const g = refresh(original);
    assert.deepEqual(g.nexusFaceDancerHistory![0].drawn, drawn);
    assert.deepEqual(g.players[0].faceDancers, [
      before[2],
      ...drawn.map((leader) => ({ leader, revealed: false })),
    ]);
    assert.equal(g.decision, null);
    assert.equal(g.response, null);
    assert.equal(g.active, 'q');
    assert.equal(g.phase, phase);
    nexusTraitorInventory(g);
  }
});

void test('the shared-deck refresh preserves an actual native Prescience cancellation window', () => {
  let g = fixture({ opponentFaction: 'atreides' });
  hold(g, 'r', 'karama');
  g = nexusTraitorBattle(g, false);
  g = applyAction(g, 'q', { type: 'prescience', field: 'dial' });
  const before = nexusReload(g);
  g = refresh(g);
  assert.deepEqual(g.response, before.response);
  assert.deepEqual(g.battle, before.battle);
  g = nexusAllow(nexusReload(g));
  g = applyAction(g, 'p', { type: 'prescienceAnswer', value: 0 });
  assert.equal(g.battle!.prescience!.value, 0);
  nexusTraitorInventory(g);
});

void test('refreshing during an actual paid Nullentropy choice preserves its fee, search and original discard pile', () => {
  let g = fixture({ opponentFaction: 'richese' });
  const box = hold(g, 'q', 'nullentropyBox');
  for (const kind of ['shield', 'projectile']) {
    const index = g.deck.findIndex((c) => c.kind === kind);
    assert.ok(index >= 0);
    g.discard.push(g.deck.splice(index, 1)[0]);
  }
  g.players[1].spice = 10;
  g = applyAction(g, 'q', { type: 'card', card: box });
  assert.equal(g.decision?.kind, 'nullentropy');
  const before = nexusReload(g),
    allCards = inventory(g);
  g = refresh(nexusReload(g));
  assert.deepEqual(g.pendingNullentropy, before.pendingNullentropy);
  assert.deepEqual(g.decision, before.decision);
  assert.deepEqual(g.discard, before.discard);
  assert.equal(g.players[1].spice, 8);
  const selected = g.discard[0].id;
  g = applyAction(nexusReload(g), 'q', {
    type: 'decision',
    event: g.pendingNullentropy!.event,
    card: selected,
  });
  assert.equal(g.players[1].spice, 8);
  assert.ok(g.players[1].hand.some((c) => c.id === selected));
  assert.deepEqual(inventory(g), allCards);
});

void test('active Truthtrance blocks refresh without spending the card or exposing a new dancer', () => {
  let g = fixture();
  const request = action(g),
    truth = hold(g, 'r', 'truthtrance');
  g = applyAction(g, 'r', { type: 'card', card: truth });
  assert.match(
    viewGame(g, 'p').nexusTleilaxu!.cunning!.blocked!,
    /Truthtrance/,
  );
  reject(g, 'p', request);
  assert.equal(g.nexusFaceDancerHistory, undefined);
  assert.equal(g.nexusCards!.cards!.hands.p, 'tleilaxu');
});

void test('ordinary Mentat replacement and Nexus refresh keep their independent usage in either order', () => {
  for (const normalFirst of [false, true]) {
    let g = fixture({ revealed: 1 });
    const normal = (state: Game) =>
      nexusAllow(
        applyAction(state, 'p', {
          type: 'replaceFaceDancer',
          leader: state.players[0].faceDancers!.find((c) => !c.revealed)!
            .leader,
        }),
      );
    if (normalFirst) g = normal(g);
    const used = g.players[0].faceDancerReplacedTurn;
    g = refresh(g);
    assert.equal(g.players[0].faceDancerReplacedTurn, used);
    if (!normalFirst) g = normal(g);
    assert.equal(g.players[0].faceDancerReplacedTurn, g.turn);
    reject(g, 'p', {
      type: 'replaceFaceDancer',
      leader: g.players[0].faceDancers![0].leader,
    });
    nexusTraitorInventory(g);
  }
});

void test('private replacement identities and history never enter another seat projection', () => {
  const initial = fixture(),
    changed = nexusReload(initial);
  [changed.traitorReserve![0], changed.traitorReserve![2]] = [
    changed.traitorReserve![2],
    changed.traitorReserve![0],
  ];
  const one = refresh(initial),
    two = refresh(changed);
  assert.notDeepEqual(
    viewGame(one, 'p').players[0].faceDancers,
    viewGame(two, 'p').players[0].faceDancers,
  );
  for (const id of ['q', 'r']) {
    const a = viewGame(one, id),
      b = viewGame(two, id);
    assert.deepEqual(a.players, b.players);
    assert.deepEqual(a.nexusTleilaxu, b.nexusTleilaxu);
    assert.deepEqual(
      a.log.map((entry) => entry.text),
      b.log.map((entry) => entry.text),
    );
    assert.equal(a.players[0].faceDancers, undefined);
    assert.equal(Object.hasOwn(a, 'nexusFaceDancerHistory'), false);
    assert.equal(Object.hasOwn(a, 'traitorReserve'), false);
  }
});

void test('stale, foreign, subset, duplicate and zero-revealed requests reject without mutation', () => {
  const g = fixture(),
    request = action(g);
  reject(g, 'p', { ...request, event: 'old-event' });
  reject(g, 'q', request);
  reject(g, 'p', { ...request, cards: [g.players[0].faceDancers![0].leader] });
  const done = refresh(g);
  reject(done, 'p', request);
  const empty = fixture({ revealed: 0 });
  assert.match(
    viewGame(empty, 'p').nexusTleilaxu!.cunning!.blocked!,
    /No revealed/,
  );
  reject(empty, 'p', {
    type: 'nexusFaceDancers',
    event: viewGame(empty, 'p').nexusTleilaxu!.cunning!.event,
  });
});

void test('saved replacement receipts reject corrupted identity, source, ownership and duplicate history', () => {
  const done = refresh(fixture());
  for (const mutate of [
    (g: Game) => {
      g.nexusFaceDancerHistory![0].drawn[0] = 'invented';
    },
    (g: Game) => {
      g.nexusFaceDancerHistory![0].source.reserve.reverse();
    },
    (g: Game) => {
      g.nexusFaceDancerHistory![0].owner = 'q';
    },
    (g: Game) => {
      g.nexusFaceDancerHistory![0].turn++;
    },
    (g: Game) => {
      g.nexusFaceDancerHistory!.push(
        structuredClone(g.nexusFaceDancerHistory![0]),
      );
    },
  ]) {
    const changed = nexusReload(done);
    mutate(changed);
    const before = JSON.stringify(changed);
    for (const p of changed.players)
      assert.throws(() => viewGame(changed, p.id));
    assert.throws(() => normalizeAutomaticGame(changed));
    assert.throws(() => applyAction(changed, 'p', { type: 'advanceBots' }));
    assert.equal(JSON.stringify(changed), before);
  }
});

void test('all four profiles perform the real atomic refresh using only their projected offer', () => {
  const initial = fixture();
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(initial, 'p');
    view.players[0].bot = difficulty;
    const before = structuredClone(view),
      actions = botActions(view);
    assert.deepEqual(view, before);
    assert.equal(actions[0]?.type, 'nexusFaceDancers');
    const g = applyAction(initial, 'p', actions[0]);
    assert.equal(g.nexusFaceDancerHistory!.length, 1);
    assert.equal(
      g.players[0].faceDancers!.every((c) => !c.revealed),
      true,
    );
    nexusTraitorInventory(g);
  }
});
