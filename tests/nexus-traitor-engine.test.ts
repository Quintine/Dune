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
  nexusTraitorDraw,
  nexusTraitorReturn,
  nexusTraitorBattle,
  holdNexusTraitor,
} from './fixture-nexus-traitors';
import { nexusReload, nexusReject, nexusAllow } from './fixture-nexus-cards';

void test('real Cunning draws before return and resumes from JSON with one physical Nexus card spent', () => {
  let g = nexusTraitorFixture();
  const before = [...g.players[0].traitors],
    top = g.traitorReserve![0],
    reserve = [...g.traitorReserve!];
  g = nexusTraitorDraw(g);
  assert.deepEqual(g.players[0].traitors, [...before, top]);
  assert.deepEqual(g.traitorReserve, reserve.slice(1));
  assert.equal(g.nexusCards!.cards!.hands.p, null);
  assert.equal(
    g.nexusCards!.cards!.discard.filter((c) => c === 'harkonnen').length,
    1,
  );
  assert.equal(
    viewGame(g, 'p').nexusTraitors!.pending!.choices.filter((c) => c.drawn)
      .length,
    1,
  );
  assert.deepEqual(normalizeAutomaticGame(nexusReload(g)), nexusReload(g));
  g = nexusTraitorReturn(nexusReload(g), [before[0]]);
  assert.equal(g.nexusTraitorPending, null);
  assert.equal(g.nexusTraitorExchanges![0].stage, 'complete');
  assert.deepEqual(g.players[0].traitors, [...before.slice(1), top]);
  assert.deepEqual(
    [...g.traitorReserve!].sort(),
    [...reserve.slice(1), before[0]].sort(),
  );
  nexusTraitorInventory(g);
});
void test('Secret Ally draws two only in Mentat Pause and safely supports Tleilaxu revealed Face Dancers', () => {
  for (const faction of ['emperor', 'tleilaxu'] as const) {
    let g = nexusTraitorFixture({ ownerFaction: faction });
    if (faction === 'tleilaxu') g.players[0].faceDancers![0].revealed = true;
    const before = nexusReload(g),
      drawn = g.traitorReserve!.slice(0, 2);
    g = nexusTraitorDraw(g);
    assert.deepEqual(g.traitorReserve, before.traitorReserve!.slice(2));
    const pending = viewGame(g, 'p').nexusTraitors!.pending!;
    assert.equal(pending.count, 2);
    assert.deepEqual(
      pending.choices.filter((c) => c.drawn).map((c) => c.id),
      drawn,
    );
    if (faction === 'tleilaxu') {
      assert.equal(g.players[0].faceDancers!.length, 5);
      assert.equal(
        pending.choices.some(
          (c) => c.id === before.players[0].faceDancers![0].leader,
        ),
        false,
      );
      nexusReject(
        g,
        'p',
        {
          type: 'nexusTraitorReturn',
          event: pending.event,
          cards: [before.players[0].faceDancers![0].leader, drawn[0]],
        },
        /Return|return/,
      );
    }
    g = nexusTraitorReturn(nexusReload(g), drawn);
    assert.deepEqual(g.players[0].traitors, before.players[0].traitors);
    assert.deepEqual(g.players[0].faceDancers, before.players[0].faceDancers);
    nexusTraitorInventory(g);
  }
  const early = nexusTraitorFixture({ ownerFaction: 'emperor', phase: 6 }),
    offer = viewGame(early, 'p').nexusTraitors!.offer!;
  assert.match(offer.blocked!, /Mentat/);
  nexusReject(
    early,
    'p',
    { type: 'nexusTraitorDraw', event: offer.event, mode: 'secretAlly' },
    /Mentat/,
  );
});
void test('drawn and returnable identities remain private across every seat and JSON saves', () => {
  const initial = nexusTraitorFixture(),
    alternative = nexusReload(initial);
  [alternative.traitorReserve![0], alternative.traitorReserve![1]] = [
    alternative.traitorReserve![1],
    alternative.traitorReserve![0],
  ];
  const one = nexusTraitorDraw(initial),
    two = nexusTraitorDraw(alternative);
  assert.notDeepEqual(
    viewGame(one, 'p').nexusTraitors!.pending!.choices,
    viewGame(two, 'p').nexusTraitors!.pending!.choices,
  );
  for (const id of ['q', 'r']) {
    assert.deepEqual(
      viewGame(one, id).nexusTraitors,
      viewGame(two, id).nexusTraitors,
    );
    assert.deepEqual(viewGame(one, id).nexusTraitors!.pending!.choices, []);
    assert.equal(
      Object.hasOwn(viewGame(one, id), 'nexusTraitorExchanges'),
      false,
    );
  }
  assert.deepEqual(
    viewGame(nexusReload(one), 'p').nexusTraitors,
    viewGame(one, 'p').nexusTraitors,
  );
});
void test('stale, foreign, malformed and replayed draw/return actions reject unchanged', () => {
  let g = nexusTraitorFixture();
  const offer = viewGame(g, 'p').nexusTraitors!.offer!;
  for (const [id, action] of [
    ['p', { type: 'nexusTraitorDraw', event: 'old', mode: 'cunning' }],
    ['q', { type: 'nexusTraitorDraw', event: offer.event, mode: 'cunning' }],
    ['p', { type: 'nexusTraitorDraw', event: offer.event, mode: 'secretAlly' }],
    [
      'p',
      {
        type: 'nexusTraitorDraw',
        event: offer.event,
        mode: 'cunning',
        cards: [],
      },
    ],
  ] as Array<[string, Action]>)
    nexusReject(g, id, action, /Nexus|Traitor/);
  g = nexusTraitorDraw(g);
  const pending = viewGame(g, 'p').nexusTraitors!.pending!,
    id = pending.choices[0].id;
  for (const [owner, action] of [
    ['q', { type: 'nexusTraitorReturn', event: pending.event, cards: [id] }],
    ['p', { type: 'nexusTraitorReturn', event: 'old', cards: [id] }],
    ['p', { type: 'nexusTraitorReturn', event: pending.event, cards: [] }],
    [
      'p',
      { type: 'nexusTraitorReturn', event: pending.event, cards: [id, id] },
    ],
    [
      'p',
      {
        type: 'nexusTraitorReturn',
        event: pending.event,
        cards: [g.players[1].traitors[0]],
      },
    ],
  ] as Array<[string, Action]>)
    nexusReject(g, owner, action, /Nexus|Return|return/);
  g = nexusTraitorReturn(g, [id]);
  nexusReject(
    g,
    'p',
    { type: 'nexusTraitorReturn', event: pending.event, cards: [id] },
    /Nexus|return/,
  );
  nexusReject(
    g,
    'p',
    { type: 'nexusTraitorDraw', event: offer.event, mode: 'cunning' },
    /Nexus|Traitor/,
  );
  nexusTraitorInventory(g);
});
void test('pending exchange blocks ordinary actions and normalization until the owner finishes', () => {
  const g = nexusTraitorDraw(nexusTraitorFixture());
  for (const id of ['p', 'q', 'r'])
    nexusReject(g, id, { type: 'ready' }, /Nexus|return/);
  assert.deepEqual(normalizeAutomaticGame(nexusReload(g)), nexusReload(g));
  assert.deepEqual(applyAction(g, 'q', { type: 'advanceBots' }), g);
});
void test('all four bot levels draw and return through the shared physical offers', () => {
  for (const difficulty of DIFFICULTIES) {
    let g = nexusTraitorFixture();
    g.players[0].bot = difficulty;
    const draw = botActions(viewGame(g, 'p')).find(
      (a) => a.type === 'nexusTraitorDraw',
    );
    assert.ok(draw, difficulty);
    g = applyAction(g, 'p', draw);
    const back = botActions(viewGame(g, 'p')).find(
      (a) => a.type === 'nexusTraitorReturn',
    );
    assert.ok(back, difficulty);
    g = applyAction(g, 'p', back);
    assert.equal(g.nexusTraitorPending, null);
    nexusTraitorInventory(g);
  }
});
void test('altered pending marker, source, hand and completed selection reject save recovery immutably', () => {
  const pending = nexusTraitorDraw(nexusTraitorFixture());
  for (const mutate of [
    (g: Game) => {
      delete g.nexusTraitorPending;
    },
    (g: Game) => {
      delete g.nexusTraitorExchanges;
    },
    (g: Game) => {
      g.nexusTraitorExchanges![0].drawn[0] = 'forged';
    },
    (g: Game) => {
      g.nexusTraitorExchanges![0].source.reserve.reverse();
    },
    (g: Game) => {
      g.players[0].traitors.reverse();
    },
  ]) {
    const g = nexusReload(pending);
    mutate(g);
    const before = nexusReload(g);
    assert.throws(() => viewGame(g, 'p'));
    assert.throws(() => normalizeAutomaticGame(g));
    assert.throws(() => nexusTraitorReturn(g, [g.players[0].traitors[0]]));
    assert.deepEqual(g, before);
  }
  const done = nexusTraitorReturn(pending, [pending.players[0].traitors[0]]);
  done.nexusTraitorExchanges![0].returned = ['forged'];
  assert.throws(() => viewGame(done, 'p'));
});
void test('a declared traitor remains effective when Cunning returns that physical identity before the other call', () => {
  let g = nexusTraitorFixture();
  const target = g.players[1].leaders[0].id;
  holdNexusTraitor(g, 'p', target);
  g = nexusTraitorBattle(g);
  g = applyAction(g, 'p', { type: 'traitorCall', call: true });
  assert.equal(g.battle!.traitorCalls.p, true);
  g = nexusTraitorDraw(g);
  g = nexusTraitorReturn(g, [target]);
  assert.equal(g.players[0].traitors.includes(target), false);
  assert.equal(g.battle!.traitorDeclarations!.p.identity, target);
  g = applyAction(nexusReload(g), 'q', { type: 'traitorCall', call: false });
  assert.equal(g.players[1].tanks, 5);
  assert.match(g.log.map((entry) => entry.text).join('\n'), /traitor/i);
  nexusTraitorInventory(g);
});
void test('an earlier declined traitor call stays false after Cunning draws the matching identity', () => {
  let g = nexusTraitorFixture();
  const target = g.players[1].leaders[0].id;
  holdNexusTraitor(g, 'p', target);
  const replacement = g.traitorReserve![0];
  g.players[0].traitors[g.players[0].traitors.indexOf(target)] = replacement;
  g.traitorReserve![0] = target;
  g = nexusTraitorBattle(g);
  g = applyAction(g, 'p', { type: 'traitorCall', call: false });
  g = nexusTraitorDraw(g);
  assert.ok(g.players[0].traitors.includes(target));
  g = nexusTraitorReturn(g, [
    g.players[0].traitors.find((id) => id !== target)!,
  ]);
  assert.equal(g.battle!.traitorCalls.p, false);
  nexusReject(g, 'p', { type: 'traitorCall', call: true }, /Traitor decision/);
  g = applyAction(g, 'q', { type: 'traitorCall', call: false });
  nexusTraitorInventory(g);
});
void test('Cunning suspends a real native Prescience response without allowing its automatic passes or answer during return', () => {
  let g = nexusTraitorFixture({ opponentFaction: 'atreides' });
  const karamaIndex = g.deck.findIndex((c) => c.effect === 'karama');
  assert.ok(karamaIndex >= 0);
  g.players[2].hand.push(g.deck.splice(karamaIndex, 1)[0]);
  g = nexusTraitorBattle(g, false);
  g = applyAction(g, 'q', { type: 'prescience', field: 'dial' });
  assert.equal(g.response?.kind, 'prescience');
  const response = structuredClone(g.response),
    preparation = structuredClone(g.battle!.preparation);
  g = nexusTraitorDraw(g);
  assert.deepEqual(g.response, response);
  assert.deepEqual(g.battle!.preparation, preparation);
  nexusReject(g, 'r', { type: 'passResponse' }, /Nexus|return/);
  nexusReject(g, 'p', { type: 'prescienceAnswer', value: 0 }, /Nexus|return/);
  assert.deepEqual(normalizeAutomaticGame(nexusReload(g)), nexusReload(g));
  g = nexusTraitorReturn(g, [g.players[0].traitors[0]]);
  g = nexusAllow(g);
  g = applyAction(g, 'p', { type: 'prescienceAnswer', value: 0 });
  assert.equal(g.battle!.prescience!.value, 0);
  nexusTraitorInventory(g);
});

void test('Cunning holds a real post-victory capture decision until its private return finishes', () => {
  let g = nexusTraitorFixture({ advanced: true });
  const target = g.players[1].leaders[0].id;
  holdNexusTraitor(g, 'p', target);
  g = nexusTraitorBattle(g);
  g = applyAction(g, 'p', { type: 'traitorCall', call: true });
  g = applyAction(g, 'q', { type: 'traitorCall', call: false });
  assert.equal(g.decision?.kind, 'captureOffer');
  const decision = structuredClone(g.decision);
  g = nexusTraitorDraw(g);
  assert.deepEqual(g.decision, decision);
  nexusReject(g, 'p', { type: 'decision', accept: false }, /Nexus|return/);
  assert.deepEqual(normalizeAutomaticGame(nexusReload(g)).decision, decision);
  g = nexusTraitorReturn(g, [g.players[0].traitors[0]]);
  assert.deepEqual(g.decision, decision);
  g = applyAction(g, 'p', { type: 'decision', accept: false });
  nexusTraitorInventory(g);
});

void test('fresh Advanced CHOAM and Ix fixtures retain the printed Auditor and Cheap Hero traitor census', () => {
  for (const options of [
    { advanced: true, ownerFaction: 'choam' as const },
    { ix: true },
  ]) {
    let g = nexusTraitorFixture(options);
    const all = [...g.traitorReserve!, ...g.players.flatMap((p) => p.traitors)];
    if (options.ix) assert.ok(all.includes('cheap-hero-traitor'));
    else
      assert.ok(
        all.includes(
          g.players[0].leaders.find((l) => l.id.includes('auditor'))!.id,
        ),
      );
    g = nexusTraitorDraw(g);
    const selected = viewGame(g, 'p')
      .nexusTraitors!.pending!.choices.slice(0, options.ownerFaction ? 2 : 1)
      .map((c) => c.id);
    g = nexusTraitorReturn(g, selected);
    nexusTraitorInventory(g);
  }
});
