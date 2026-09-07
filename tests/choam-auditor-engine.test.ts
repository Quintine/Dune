import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  normalizeAutomaticGame,
  viewGame,
  type Game,
  type Action,
} from '../game/engine';
import { baseDeck, ixBattleCards, type Card } from '../game/cards';
import { createAuditorLeader, CHOAM_AUDITOR_ID } from '../game/choam-auditor';
import { richeseCards } from '../game/richese-cards';
import type { FactionId } from '../game/catalog';

const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
const player = (g: Game, id: string) => g.players.find((p) => p.id === id)!;
const send = (g: Game, id: string, action: Action) =>
  applyAction(g, id, action);
function fixture(opponent: FactionId = 'guild', third?: FactionId) {
  const g = createGame('AUDITENGINE', newPlayer('c', 'CHOAM', 'choam'), true, [
    'choam',
  ]);
  g.players.push(newPlayer('o', 'Opponent', opponent));
  if (third) g.players.push(newPlayer('x', 'Third faction', third));
  Object.assign(g, {
    status: 'playing',
    phase: 6,
    turn: 2,
    active: 'c',
    storm: 18,
    order: g.players.map((p) => p.id),
    deck: [...baseDeck(), ...ixBattleCards()],
    richeseCache: richeseCards(),
    discard: [],
  });
  player(g, 'c').leaders.push(createAuditorLeader());
  for (const p of g.players) {
    p.hand = [];
    p.traitors = [];
    p.spice = 20;
    p.forces = p.id === 'x' ? {} : { 'arrakeen:10': 10 };
    p.reserves = p.id === 'x' ? 20 : 10;
    delete p.elites;
  }
  return g;
}
function hold(g: Game, id: string, kind: Card['kind'], effect?: string) {
  const source =
    effect && g.richeseCache!.some((card) => card.effect === effect)
      ? g.richeseCache!
      : g.deck;
  const index = source.findIndex((card) =>
    effect ? card.effect === effect : card.kind === kind,
  );
  assert.ok(index >= 0, effect ?? kind);
  const card = source.splice(index, 1)[0];
  player(g, id).hand.push(card);
  return card.id;
}
function secrets(g: Game, n = 2) {
  return ['shield', 'snooper', 'projectile', 'poison']
    .slice(0, n)
    .map((kind) => hold(g, 'o', kind as Card['kind']));
}
function passResponses(g: Game) {
  for (let limit = 0; g.response && limit < 20; limit++) {
    const id = g.players.find((p) => !g.response!.passed.includes(p.id))!.id;
    g = send(g, id, { type: 'passResponse' });
  }
  assert.equal(g.response, null);
  return g;
}
function begin(g: Game, defending = false) {
  const first = defending ? 'o' : 'c';
  g.order = [
    first,
    defending ? 'c' : 'o',
    ...g.order.filter((id) => id !== 'c' && id !== 'o'),
  ];
  g.active = first;
  g = send(g, first, {
    type: 'chooseBattle',
    territory: 'arrakeen',
    target: defending ? 'c' : 'o',
  });
  for (let limit = 0; limit < 30; limit++) {
    if (g.response) {
      g = passResponses(g);
      continue;
    }
    const b = g.battle!;
    if (b.preLeader && !b.preLeader.closed) {
      const id = [b.attacker, b.defender].find(
        (id) => !b.preLeader!.ready.includes(id),
      )!;
      g = send(g, id, { type: 'battlePreparationReady', event: b.event });
    } else if (b.preparation)
      g = send(g, b.preparation.owner, { type: 'declineBattlePower' });
    else if (g.decision?.kind === 'fullPlanOffer')
      g = send(g, g.decision.player, { type: 'decision', decline: true });
    else return g;
  }
  throw Error('Battle preparation stalled');
}
function plan(g: Game, id: string, extra: Partial<Action> = {}) {
  return send(g, id, {
    type: 'battlePlan',
    leader: id === 'c' ? CHOAM_AUDITOR_ID : player(g, id).leaders[0].id,
    dial: id === 'c' ? 6 : 0,
    support: id === 'c' ? 6 : 0,
    ...extra,
  });
}
function cleanup(g: Game) {
  for (let limit = 0; limit < 30; limit++) {
    if (g.response && g.response.kind !== 'choamAudit') {
      g = passResponses(g);
      continue;
    }
    const d = g.decision;
    if (d?.kind === 'battleCards')
      g = send(g, d.player, { type: 'decision', discard: [] });
    else if (d?.kind === 'battleLosses')
      g = send(g, d.player, { type: 'decision', choice: 0 });
    else if (d?.kind === 'ixSubstitution')
      g = send(g, d.player, { type: 'decision', amount: 0 });
    else return g;
  }
  throw Error('Battle cleanup stalled');
}
function finish(g: Game, calls: string[] = []) {
  for (const id of ['c', 'o'])
    g = send(g, id, { type: 'traitorCall', call: calls.includes(id) });
  return cleanup(g);
}
function offer(g: Game) {
  assert.equal(g.decision?.kind, 'choamAudit');
  return passResponses(
    send(reload(g), 'c', {
      type: 'decision',
      event: g.pendingAuditor!.event,
      audit: true,
    }),
  );
}
function allow(g: Game) {
  if (g.decision?.kind === 'choamAuditPayment')
    return send(reload(g), 'o', {
      type: 'decision',
      event: g.pendingAuditor!.event,
      pay: false,
    });
  return g;
}
function closeMarket(g: Game) {
  return g.decision?.kind === 'choamMarket'
    ? send(g, g.decision.player, { type: 'decision', done: true })
    : g;
}
function inventory(g: Game) {
  return [
    ...g.deck,
    ...g.discard,
    ...(g.richeseCache ?? []),
    ...g.players.flatMap((p) => p.hand),
  ]
    .map((c) => c.id)
    .sort();
}
function unchanged(g: Game, id: string, action: Action) {
  const before = reload(g);
  assert.throws(() => send(g, id, action));
  assert.deepEqual(g, before);
}

void test('Auditor triggers on both battle sides and both outcomes; actual survival alone sets one or two cards', () => {
  for (const defending of [false, true])
    for (const won of [false, true])
      for (const survived of [false, true]) {
        let g = fixture();
        const eligible = secrets(g);
        const weapon = survived ? undefined : hold(g, 'o', 'projectile');
        g = begin(g, defending);
        g = plan(g, 'c', { dial: won ? 6 : 0, support: won ? 6 : 0 });
        g = plan(g, 'o', {
          dial: won ? 0 : 6,
          support: won ? 0 : 6,
          ...(weapon ? { weapon } : {}),
        });
        g = finish(g);
        assert.equal(g.decision?.kind, 'choamAudit');
        assert.equal(g.pendingAuditor!.survived, survived);
        assert.equal(
          player(g, 'c').leaders.find((l) => l.id === CHOAM_AUDITOR_ID)!.dead,
          !survived,
        );
        assert.equal(viewGame(g, 'c').auditor!.count, survived ? 2 : 1);
        const before = inventory(g);
        const hands = g.players.map((p) => p.hand);
        const event = g.pendingAuditor!.event;
        g = closeMarket(allow(offer(g)));
        assert.equal(g.pendingAuditor, null);
        assert.equal(
          g.phase,
          7,
          'Final-battle insight survives the automatic phase transition',
        );
        assert.equal(g.auditorInsight!.event, event);
        assert.equal(g.auditorInsight!.cards.length, survived ? 2 : 1);
        assert.ok(
          g.auditorInsight!.cards.every((c) => eligible.includes(c.id)),
        );
        assert.deepEqual(inventory(g), before);
        assert.deepEqual(
          g.players.map((p) => p.hand),
          hands,
        );
        assert.equal(
          g.log.filter((entry) =>
            /privately inspected .*random opposing hand/.test(entry.text),
          ).length,
          1,
        );
      }
});

void test('used hero, retained Worthless defense and late Portable are excluded by physical battle-use IDs', (t) => {
  let g = fixture();
  const secret = hold(g, 'o', 'shield');
  const hero = hold(g, 'o', 'hero');
  const worthless = hold(g, 'o', 'worthless');
  const portable = hold(g, 'o', 'special', 'portableSnooper');
  g = begin(g);
  g = plan(g, 'c', { dial: 0, support: 0 });
  g = plan(g, 'o', { leader: hero, defense: worthless, dial: 6, support: 6 });
  g = send(g, 'o', {
    type: 'portableSnooper',
    card: portable,
    event: g.battle!.event,
  });
  g = finish(g);
  assert.deepEqual(
    [...g.pendingAuditor!.usedCards].sort(),
    [hero, worthless, portable].sort(),
  );
  assert.ok(player(g, 'o').hand.some((c) => c.id === worthless));
  assert.ok(player(g, 'o').hand.some((c) => c.id === portable));
  assert.equal(viewGame(g, 'c').auditor!.count, 1);
  t.mock.method(crypto, 'getRandomValues', () => {
    throw Error('Full eligible pool must not sample');
  });
  g = allow(offer(g));
  assert.deepEqual(
    g.auditorInsight!.cards.map((c) => c.id),
    [secret],
  );
});

void test('zero eligible cards skip the audit and optional decline changes no hands or spice', () => {
  let empty = fixture();
  empty = closeMarket(finish(plan(plan(begin(empty), 'c'), 'o')));
  assert.equal(empty.pendingAuditor, null);
  assert.equal(empty.auditorInsight ?? null, null);
  assert.equal(empty.phase, 7);
  let g = fixture();
  secrets(g);
  g = finish(plan(plan(begin(g), 'c'), 'o'));
  const hands = g.players.map((p) => p.hand),
    spice = g.players.map((p) => p.spice);
  g = send(g, 'c', {
    type: 'decision',
    event: g.pendingAuditor!.event,
    audit: false,
  });
  assert.equal(g.pendingAuditor, null);
  assert.equal(g.auditorInsight ?? null, null);
  assert.deepEqual(
    g.players.map((p) => p.hand),
    hands,
  );
  assert.deepEqual(
    g.players.map((p) => p.spice),
    spice,
  );
});

void test('payment cancels the whole actual viewable count directly, rejects stale or partial choices, and short balance auto-allows', () => {
  for (const count of [1, 2]) {
    let g = fixture();
    secrets(g, count);
    g.inflation = {
      side: 'double',
      placedTurn: 1,
      updatedTurn: 1,
      flipped: false,
    };
    g = offer(finish(plan(plan(begin(g), 'c'), 'o')));
    assert.equal(g.decision?.kind, 'choamAuditPayment');
    const event = g.pendingAuditor!.event;
    const before = reload(g);
    for (const amount of [0, -1, count + 1, 0.5])
      unchanged(g, 'o', { type: 'decision', event, pay: true, count: amount });
    unchanged(g, 'c', { type: 'decision', event, pay: true, count });
    unchanged(g, 'o', { type: 'decision', event: 'stale', pay: true, count });
    unchanged(g, 'o', { type: 'decision', event, pay: false, count });
    g = send(g, 'o', { type: 'decision', event, pay: true, count });
    assert.equal(player(g, 'c').spice, player(before, 'c').spice + count);
    assert.equal(player(g, 'o').spice, player(before, 'o').spice - count);
    assert.deepEqual(
      g.players.map((p) => p.bribes),
      before.players.map((p) => p.bribes),
    );
    assert.deepEqual(g.aid, before.aid);
    assert.equal(g.auditorInsight ?? null, null);
    unchanged(g, 'o', { type: 'decision', event, pay: true, count });
  }
  let poor = fixture();
  secrets(poor);
  player(poor, 'o').spice = 0;
  poor = offer(finish(plan(plan(begin(poor), 'c'), 'o')));
  assert.equal(poor.pendingAuditor, null);
  assert.equal(poor.auditorInsight!.cards.length, 2);
  assert.equal(player(poor, 'o').spice, 0);
});

void test('successful traitors, double traitors, Artillery, Tooth, Stone and explosion preserve the audit trigger and survival count', () => {
  for (const mode of [
    'ownTraitor',
    'opposingTraitor',
    'bothTraitors',
    'artillery',
    'poisonTooth',
    'stoneBurner',
    'explosion',
  ]) {
    let g = fixture();
    secrets(g);
    const calls: string[] = [];
    if (mode === 'ownTraitor' || mode === 'bothTraitors') {
      player(g, 'c').traitors = [player(g, 'o').leaders[0].id];
      calls.push('c');
    }
    if (mode === 'opposingTraitor' || mode === 'bothTraitors') {
      player(g, 'o').traitors = [CHOAM_AUDITOR_ID];
      calls.push('o');
    }
    const weapon =
      mode === 'artillery' || mode === 'poisonTooth'
        ? hold(g, 'o', mode)
        : mode === 'stoneBurner'
          ? hold(g, 'o', 'special', 'stoneBurner')
          : mode === 'explosion'
            ? hold(g, 'o', 'lasgun')
            : null;
    const defense = mode === 'explosion' ? hold(g, 'c', 'shield') : null;
    g = begin(g);
    g = plan(g, 'c', defense ? { defense } : {});
    g = plan(g, 'o', weapon ? { weapon } : {});
    if (mode === 'poisonTooth')
      g = send(g, 'o', { type: 'decision', activate: true });
    if (mode === 'stoneBurner')
      g = send(g, 'o', {
        type: 'decision',
        event: g.battle!.event,
        mode: 'kill',
      });
    g = finish(g, calls);
    assert.equal(g.decision?.kind, 'choamAudit', mode);
    assert.equal(g.pendingAuditor!.survived, mode === 'ownTraitor', mode);
    assert.equal(
      viewGame(g, 'c').auditor!.count,
      mode === 'ownTraitor' ? 2 : 1,
      mode,
    );
    g = allow(offer(g));
    assert.equal(
      g.auditorInsight!.cards.length,
      mode === 'ownTraitor' ? 2 : 1,
      mode,
    );
  }
});

void test('BG Worthless cancellation and counter-cancellation restore the original audit exactly once', () => {
  for (const counter of [false, true]) {
    let g = fixture('guild', 'beneGesserit');
    secrets(g);
    const worthless = hold(g, 'x', 'worthless');
    hold(g, 'x', 'worthless');
    const karama = hold(g, 'c', 'special', 'karama');
    g = finish(plan(plan(begin(g), 'c'), 'o'));
    const event = g.pendingAuditor!.event;
    g = send(g, 'c', { type: 'decision', event, audit: true });
    assert.equal(g.response?.kind, 'choamAudit');
    const balances = g.players.map((p) => p.spice);
    g = send(g, 'x', { type: 'card', card: worthless, mode: 'cancel' });
    assert.equal(g.response?.kind, 'worthlessKarama');
    assert.equal(g.pendingAuditor!.event, event);
    assert.deepEqual(normalizeAutomaticGame(reload(g)), reload(g));
    if (counter) {
      g = send(reload(g), 'c', { type: 'card', card: karama, mode: 'cancel' });
      assert.equal(g.response?.kind, 'choamAudit');
      assert.equal(g.response?.intent, event);
      g = allow(passResponses(g));
      assert.equal(g.auditorInsight!.event, event);
      assert.equal(g.auditorInsight!.cards.length, 2);
    } else {
      g = passResponses(g);
      assert.equal(g.auditorInsight ?? null, null);
      assert.equal(
        player(g, 'c').hand.some((c) => c.id === karama),
        true,
      );
    }
    assert.equal(g.pendingAuditor, null);
    assert.equal(g.pendingKarama, null);
    assert.equal(g.discard.filter((c) => c.id === worthless).length, 1);
    assert.equal(
      g.discard.filter((c) => c.id === karama).length,
      counter ? 1 : 0,
    );
    assert.deepEqual(
      g.players.map((p) => p.spice),
      balances,
    );
  }
});

void test('private audit snapshot survives reads, allies and phase7 without resampling, then expires when the next battle starts', (t) => {
  let g = fixture('guild', 'emperor');
  const eligible = secrets(g, 3);
  player(g, 'c').ally = 'x';
  player(g, 'x').ally = 'c';
  g = closeMarket(allow(offer(finish(plan(plan(begin(g), 'c'), 'o')))));
  const snapshot = reload(g),
    insight = structuredClone(g.auditorInsight);
  assert.equal(g.phase, 7);
  assert.ok(insight!.cards.every((card) => eligible.includes(card.id)));
  t.mock.method(crypto, 'getRandomValues', () => {
    throw Error('Reads must not resample');
  });
  for (const id of ['c', 'o', 'x']) {
    const view = viewGame(reload(g), id);
    assert.deepEqual(view.auditorInsight, id === 'c' ? insight : null);
    assert.equal(view.auditor, null);
    assert.equal('pendingAuditor' in view, false);
  }
  assert.deepEqual(normalizeAutomaticGame(reload(g)), snapshot);
  assert.deepEqual(g, snapshot);
  t.mock.restoreAll();
  // A second genuine battle in a seeded later Battle phase clears historical inspection.
  g.phase = 6;
  g.active = 'c';
  player(g, 'o').forces = { 'arrakeen:10': 1 };
  player(g, 'o').reserves--;
  g = send(g, 'c', {
    type: 'chooseBattle',
    territory: 'arrakeen',
    target: 'o',
  });
  assert.equal(g.auditorInsight, null);
});

void test('audit completes before Face Dance can kill the previously surviving Auditor', () => {
  let g = fixture('guild', 'tleilaxu');
  secrets(g);
  player(g, 'x').faceDancers = [
    { leader: CHOAM_AUDITOR_ID, revealed: false },
    { leader: player(g, 'o').leaders[1].id, revealed: false },
  ];
  g = finish(plan(plan(begin(g), 'c'), 'o'));
  assert.equal(g.decision?.kind, 'choamAudit');
  assert.equal(g.pendingAuditor!.survived, true);
  assert.ok(g.pendingFaceDance);
  g = allow(offer(g));
  assert.equal(g.auditorInsight!.cards.length, 2);
  assert.equal(g.decision?.kind, 'faceDance');
  const snapshot = structuredClone(g.auditorInsight);
  g = send(g, 'x', {
    type: 'decision',
    reveal: true,
    sources: { reserves: 1 },
    sector: 10,
  });
  assert.equal(
    player(g, 'c').leaders.find((l) => l.id === CHOAM_AUDITOR_ID)!.dead,
    true,
  );
  assert.deepEqual(g.auditorInsight, snapshot);
  assert.equal(g.pendingAuditor, null);
});

void test('legal Distrans during audit payment recomputes the full quote and an emptied hand completes without payment or inspection', () => {
  for (const remaining of [0, 1]) {
    let g = fixture('guild', 'emperor');
    player(g, 'o').ally = 'x';
    player(g, 'x').ally = 'o';
    const transfer = hold(g, 'o', 'shield');
    const distrans = hold(g, 'o', 'special', 'distrans');
    if (remaining) hold(g, 'o', 'snooper');
    g = offer(finish(plan(plan(begin(g), 'c'), 'o')));
    assert.equal(g.decision?.kind, 'choamAuditPayment');
    assert.equal(viewGame(g, 'c').auditor!.count, 2);
    const event = g.pendingAuditor!.event;
    const before = reload(g);
    g = send(reload(g), 'o', {
      type: 'card',
      card: distrans,
      give: transfer,
      target: 'x',
    });
    assert.equal(
      player(g, 'x').hand.some((card) => card.id === transfer),
      true,
    );
    assert.equal(g.discard.filter((card) => card.id === distrans).length, 1);
    assert.deepEqual(inventory(g), inventory(before));
    assert.deepEqual(
      g.players.map((p) => p.spice),
      before.players.map((p) => p.spice),
    );
    if (remaining) {
      assert.equal(g.decision?.kind, 'choamAuditPayment');
      assert.equal(viewGame(g, 'c').auditor!.count, 1);
      unchanged(g, 'o', { type: 'decision', event, pay: true, count: 2 });
      g = send(g, 'o', { type: 'decision', event, pay: true, count: 1 });
      assert.equal(player(g, 'c').spice, player(before, 'c').spice + 1);
      assert.equal(player(g, 'o').spice, player(before, 'o').spice - 1);
    } else {
      assert.equal(g.pendingAuditor, null);
      unchanged(g, 'o', { type: 'decision', event, pay: true, count: 2 });
    }
    assert.equal(g.auditorInsight ?? null, null);
  }
});
