import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  normalizeAutomaticGame,
  viewGame,
  type Action,
  type Game,
} from '../game/engine';
import { baseDeck } from '../game/cards';
import {
  createAmbassadors,
  placeAmbassador,
  type AmbassadorEffect,
} from '../game/ecaz-ambassadors';
import { createTerrorState, placeTerror } from '../game/moritani-terror';
import type { FactionId } from '../game/catalog';

export function ambassadorFixture(
  effect: AmbassadorEffect = 'emperor',
  entrant: FactionId = 'harkonnen',
): Game {
  const g = createGame('AMBENTRY', newPlayer('ec', 'Ecaz', 'ecaz'));
  g.players.push(
    newPlayer('in', 'Entrant', entrant),
    newPlayer('al', 'Ally', 'atreides'),
  );
  Object.assign(g, {
    status: 'playing',
    phase: 5,
    turn: 2,
    storm: 18,
    active: 'in',
    order: ['in', 'ec', 'al'],
    movementRemaining: ['in', 'ec', 'al'],
    deck: baseDeck(),
  });
  for (const p of g.players)
    Object.assign(p, { forces: {}, reserves: 20, spice: 20, hand: [] });
  g.players[1].traitors = ['guild-1', 'emperor-2'];
  const inventory = createAmbassadors(() => 0);
  const chosen = inventory.tokens.find((t) => t.effect === effect)!;
  const five = [
    chosen,
    ...inventory.tokens.filter(
      (t) =>
        t.effect !== 'ecaz' && t.effect !== effect && t.effect !== 'harkonnen',
    ),
  ]
    .filter((t) => t.effect !== 'ecaz')
    .slice(0, 5);
  inventory.cohort = five.map((t) => t.id);
  for (const t of inventory.tokens) {
    t.zone =
      t.effect === 'ecaz' || inventory.cohort.includes(t.id)
        ? 'supply'
        : 'pool';
    t.location = null;
  }
  g.ecazAmbassadors = placeAmbassador(inventory, chosen.id, {
    turn: 1,
    availableSpice: 20,
    destination: {
      id: 'arrakeen',
      stronghold: true,
      inStorm: false,
      allowed: true,
    },
  }).state;
  return g;
}
const ship: Action = {
  type: 'ship',
  territory: 'arrakeen',
  sector: 10,
  amount: 2,
};
const enter = (g = ambassadorFixture()) => applyAction(g, 'in', ship);
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
const decide = (g: Game, id: string, extra: Omit<Action, 'type'>) =>
  applyAction(g, id, {
    type: 'decision',
    event: g.pendingAmbassador!.event,
    ...extra,
  });
const trigger = (g: Game, beneficiary = 'ec') =>
  decide(g, 'ec', { trigger: true, beneficiary });
function reject(g: Game, id: string, action: Action) {
  const before = structuredClone(g);
  assert.throws(() => applyAction(g, id, action));
  assert.deepEqual(g, before);
}

void test('committed entry interrupts remaining movement; decline retains token and never replays shipment', () => {
  const g = enter();
  assert.deepEqual(g.decision, { kind: 'ecazAmbassador', player: 'ec' });
  assert.equal(g.players[1].spice, 18);
  assert.equal(g.players[1].reserves, 18);
  assert.equal(g.players[1].forces['arrakeen:10'], 2);
  reject(g, 'in', { type: 'endMovement' });
  reject(g, 'in', {
    type: 'decision',
    event: g.pendingAmbassador!.event,
    decline: true,
  });
  reject(g, 'ec', { type: 'decision', event: 'old', decline: true });
  const done = decide(reload(g), 'ec', { decline: true });
  assert.deepEqual(done.players, g.players);
  assert.deepEqual(done.ecazAmbassadors, g.ecazAmbassadors);
  assert.equal(done.pendingAmbassador, null);
  assert.equal(done.decision, null);
  assert.equal(done.active, 'in');
  reject(done, 'in', ship);
});

void test('Emperor credits the chosen current ally exactly once without a response acknowledgement', () => {
  const initial = ambassadorFixture();
  initial.players[0].ally = 'al';
  initial.players[2].ally = 'ec';
  const g = enter(initial);
  assert.deepEqual(
    viewGame(g, 'ec').ambassadorEntry!.beneficiaries.map((b) => b.player),
    ['ec', 'al'],
  );
  assert.deepEqual(viewGame(g, 'in').ambassadorEntry!.beneficiaries, []);
  const result = trigger(reload(g), 'al');
  assert.equal(result.players[2].spice, 25);
  assert.equal(result.players[0].spice, 20);
  assert.equal(result.decision, null);
  assert.equal(result.response, null);
  assert.equal(result.pendingAmbassador, null);
  assert.equal(
    result.ecazAmbassadors!.tokens.find((t) => t.effect === 'emperor')!.zone,
    'used',
  );
  assert.equal(
    result.log.filter((l) => l.automatic?.name === 'Emperor Ambassador').length,
    1,
  );
  assert.deepEqual(normalizeAutomaticGame(reload(result)), reload(result));
  reject(result, 'ec', {
    type: 'decision',
    event: g.pendingAmbassador!.event,
    trigger: true,
    beneficiary: 'al',
  });
  reject(g, 'ec', {
    type: 'decision',
    event: g.pendingAmbassador!.event,
    trigger: true,
    beneficiary: 'in',
  });
});

void test('Atreides snapshots only the beneficiary’s inspected hand, survives reload and never tracks later cards', () => {
  const initial = ambassadorFixture('atreides');
  initial.players[0].ally = 'al';
  initial.players[2].ally = 'ec';
  initial.players[1].hand = initial.deck.splice(0, 3);
  const result = trigger(enter(initial), 'al');
  assert.equal(result.decision, null);
  assert.deepEqual(
    viewGame(result, 'al').ambassadorInsights[0].cards,
    initial.players[1].hand,
  );
  assert.deepEqual(viewGame(result, 'ec').ambassadorInsights, []);
  assert.deepEqual(viewGame(result, 'in').ambassadorInsights, []);
  assert.ok(
    !JSON.stringify(result.log).includes(initial.players[1].hand[0].id),
  );
  result.players[1].hand = [];
  assert.equal(
    viewGame(reload(result), 'al').ambassadorInsights[0].cards.length,
    3,
  );
});

void test('Harkonnen samples a held Traitor only once, including the Tleilaxu physical Face Dancer pool', () => {
  for (const target of ['emperor', 'tleilaxu'] as const) {
    const initial = ambassadorFixture('harkonnen', target);
    if (target === 'tleilaxu') {
      initial.players[1].traitors = [];
      initial.players[1].faceDancers = [
        { leader: 'guild-1', revealed: true },
        { leader: 'emperor-2', revealed: false },
      ];
    }
    const done = trigger(enter(initial));
    const insight = viewGame(done, 'ec').ambassadorInsights[0];
    assert.ok(['guild-1', 'emperor-2'].includes(insight.traitor!));
    assert.deepEqual(insight.cards, []);
    assert.deepEqual(
      viewGame(normalizeAutomaticGame(reload(done)), 'ec')
        .ambassadorInsights[0],
      insight,
    );
    assert.deepEqual(viewGame(done, 'al').ambassadorInsights, []);
    assert.deepEqual(viewGame(done, 'in').ambassadorInsights, []);
    assert.ok(!JSON.stringify(done.log).includes(insight.traitor!));
  }
});

void test('CHOAM beneficiary owns its card choice; duplicate or foreign IDs cannot discard or mint spice', () => {
  const initial = ambassadorFixture('choam');
  initial.players[0].ally = 'al';
  initial.players[2].ally = 'ec';
  initial.players[2].hand = initial.deck.splice(0, 3);
  const g = trigger(enter(initial), 'al');
  assert.equal(g.decision?.player, 'al');
  assert.equal(g.pendingAmbassador?.stage, 'cards');
  assert.deepEqual(viewGame(g, 'ec').ambassadorEntry!.cards, []);
  const ids = initial.players[2].hand.slice(0, 2).map((c) => c.id);
  for (const cards of [[ids[0], ids[0]], ['missing']])
    reject(g, 'al', {
      type: 'decision',
      event: g.pendingAmbassador!.event,
      cards,
    });
  reject(g, 'ec', {
    type: 'decision',
    event: g.pendingAmbassador!.event,
    cards: ids,
  });
  const done = decide(reload(g), 'al', { cards: ids });
  assert.equal(done.players[2].hand.length, 1);
  assert.equal(done.players[2].spice, 26);
  assert.deepEqual(
    done.discard.map((c) => c.id),
    ids,
  );
  assert.equal(done.decision, null);
  const zero = decide(g, 'al', { cards: [] });
  assert.equal(zero.players[2].spice, 20);
  assert.equal(zero.players[2].hand.length, 3);
});

void test('Ixian discards before recycling an empty deck and never spends another player’s choice', () => {
  const initial = ambassadorFixture('ixians');
  initial.players[0].hand = [initial.deck[0]];
  initial.deck = [];
  initial.discard = [];
  const g = trigger(enter(initial));
  assert.equal(g.pendingAmbassador?.stage, 'cards');
  reject(g, 'ec', {
    type: 'decision',
    event: g.pendingAmbassador!.event,
    cards: [],
  });
  const done = decide(reload(g), 'ec', {
    cards: [initial.players[0].hand[0].id],
  });
  assert.deepEqual(done.players[0].hand, initial.players[0].hand);
  assert.deepEqual(done.discard, []);
  assert.deepEqual(done.deck, []);
  assert.equal(done.players[0].spice, 20);
  assert.equal(done.decision, null);
  const empty = enter(ambassadorFixture('ixians'));
  assert.ok(viewGame(empty, 'ec').ambassadorEntry!.beneficiaries[0].blocked);
  reject(empty, 'ec', {
    type: 'decision',
    event: empty.pendingAmbassador!.event,
    trigger: true,
    beneficiary: 'ec',
  });
});

void test('BG copies outside original cohort, can inspect matching Harkonnen, and permanently removes only BG', () => {
  const initial = ambassadorFixture('beneGesserit');
  const beforeHark = structuredClone(
    initial.ecazAmbassadors!.tokens.find((t) => t.effect === 'harkonnen'),
  );
  const g = trigger(enter(initial));
  assert.equal(g.pendingAmbassador?.stage, 'copy');
  assert.ok(
    viewGame(g, 'ec').ambassadorEntry!.copies.some(
      (c) => c.effect === 'harkonnen' && !c.blocked,
    ),
  );
  assert.deepEqual(viewGame(g, 'in').ambassadorEntry!.copies, []);
  reject(g, 'ec', {
    type: 'decision',
    event: g.pendingAmbassador!.event,
    effect: 'ecaz',
  });
  const done = decide(reload(g), 'ec', { effect: 'harkonnen' });
  assert.equal(
    done.ecazAmbassadors!.tokens.find((t) => t.effect === 'beneGesserit')!.zone,
    'removed',
  );
  assert.deepEqual(
    done.ecazAmbassadors!.tokens.find((t) => t.effect === 'harkonnen'),
    beforeHark,
  );
  assert.ok(done.ambassadorInsights![0].traitor);
});

void test('fifth Ambassador recycles only after the beneficiary completes the card effect', () => {
  const initial = ambassadorFixture('choam');
  initial.players[0].hand = initial.deck.splice(0, 2);
  for (const t of initial.ecazAmbassadors!.tokens)
    if (initial.ecazAmbassadors!.cohort.includes(t.id) && t.effect !== 'choam')
      t.zone = t.effect === 'beneGesserit' ? 'removed' : 'used';
  const old = [...initial.ecazAmbassadors!.cohort];
  const g = trigger(enter(initial));
  assert.deepEqual(g.ecazAmbassadors!.cohort, old);
  assert.equal(
    g.ecazAmbassadors!.tokens.filter(
      (t) => t.zone === 'supply' && t.effect !== 'ecaz',
    ).length,
    0,
  );
  const done = decide(reload(g), 'ec', { cards: [] });
  assert.equal(
    done.ecazAmbassadors!.tokens.filter(
      (t) => t.zone === 'supply' && t.effect !== 'ecaz',
    ).length,
    5,
  );
  assert.equal(
    done.log.filter((l) => l.text.startsWith('All five random Ambassadors'))
      .length,
    1,
  );
});

void test('self, ally, advisors and matching physical faction entries do not open an Ambassador opportunity', () => {
  for (const variant of ['self', 'ally', 'matching', 'advisors'] as const) {
    const g = ambassadorFixture(
      'emperor',
      variant === 'advisors'
        ? 'beneGesserit'
        : variant === 'matching'
          ? 'emperor'
          : 'harkonnen',
    );
    if (variant === 'ally') {
      g.players[0].ally = 'in';
      g.players[1].ally = 'ec';
    }
    if (variant === 'advisors') {
      g.advanced = true;
      g.players[0].forces = { 'arrakeen:10': 1 };
      g.players[0].reserves = 19;
      g.players[1].forces = { 'arrakeen:10': 1 };
      g.players[1].reserves = 19;
      g.players[1].advisors = { arrakeen: {} };
    }
    if (variant === 'self') g.active = 'ec';
    const done = applyAction(g, variant === 'self' ? 'ec' : 'in', {
      ...ship,
      ...(variant === 'advisors' ? { advisors: true } : {}),
    });
    assert.equal(done.pendingAmbassador ?? null, null);
    assert.notEqual(done.decision?.kind, 'ecazAmbassador');
  }
});

void test('unresolved simultaneous Terror or Guild income rejects the complete original entry atomically', () => {
  for (const reaction of ['terror', 'guild'] as const) {
    const g = ambassadorFixture();
    if (reaction === 'terror') {
      g.players.push(newPlayer('m', 'Moritani', 'moritani'));
      const terror = createTerrorState(() => 0);
      g.moritaniTerror = placeTerror(
        terror,
        terror.tokens[0].id,
        'arrakeen',
        1,
      );
    } else g.players.push(newPlayer('guild', 'Guild', 'guild'));
    reject(g, 'in', ship);
  }
});

void test('incomplete effect remains visibly unavailable and can be declined without consuming its token', () => {
  for (const effect of ['tleilaxu'] as const) {
    const g = enter(ambassadorFixture(effect));
    assert.match(
      viewGame(g, 'ec').ambassadorEntry!.beneficiaries[0].blocked!,
      /implemented/,
    );
    reject(g, 'ec', {
      type: 'decision',
      event: g.pendingAmbassador!.event,
      trigger: true,
      beneficiary: 'ec',
    });
    const done = decide(g, 'ec', { decline: true });
    assert.deepEqual(done.ecazAmbassadors, g.ecazAmbassadors);
  }
});

void test('exposed city storm returns Ambassadors to supply without triggering or advancing their cohort', () => {
  for (const exposed of [false, true]) {
    let g = ambassadorFixture('beneGesserit');
    g.phase = 0;
    g.storm = 9;
    g.stormPending = 2;
    g.shieldWallDestroyed = exposed;
    const cohort = [...g.ecazAmbassadors!.cohort];
    for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
    const bg = g.ecazAmbassadors!.tokens.find(
      (t) => t.effect === 'beneGesserit',
    )!;
    assert.equal(bg.zone, exposed ? 'supply' : 'placed');
    assert.equal(bg.location, exposed ? null : 'arrakeen');
    assert.deepEqual(g.ecazAmbassadors!.cohort, cohort);
    assert.deepEqual(g.ambassadorInsights ?? [], []);
    assert.equal(
      g.log.filter((l) => l.text.includes('This was destruction')).length,
      exposed ? 1 : 0,
    );
  }
});

void test('Lasgun–shield explosion returns an Ambassador, while overriding traitor victory leaves it placed', () => {
  for (const traitor of [false, true]) {
    let g = ambassadorFixture('emperor');
    g.phase = 6;
    g.active = 'ec';
    g.players[0].forces = { 'arrakeen:10': 3 };
    g.players[0].reserves = 17;
    g.players[1].forces = { 'arrakeen:10': 3 };
    g.players[1].reserves = 17;
    const lasgun = g.deck.splice(
      g.deck.findIndex((c) => c.kind === 'lasgun'),
      1,
    )[0];
    const shield = g.deck.splice(
      g.deck.findIndex((c) => c.kind === 'shield'),
      1,
    )[0];
    g.players[0].hand = [lasgun];
    g.players[1].hand = [shield];
    g.players[0].traitors = traitor ? ['harkonnen-0'] : [];
    g.players[1].traitors = [];
    g.battle = {
      territory: 'arrakeen',
      attacker: 'ec',
      defender: 'in',
      prepared: true,
      plans: {},
      revealed: false,
      traitorCalls: {},
    };
    g = applyAction(g, 'ec', {
      type: 'battlePlan',
      dial: 0,
      leader: 'ecaz-0',
      weapon: lasgun.id,
    });
    g = applyAction(g, 'in', {
      type: 'battlePlan',
      dial: 0,
      leader: 'harkonnen-0',
      defense: shield.id,
    });
    g = applyAction(g, 'ec', { type: 'traitorCall', call: traitor });
    g = applyAction(g, 'in', { type: 'traitorCall', call: false });
    const token = g.ecazAmbassadors!.tokens.find(
      (t) => t.effect === 'emperor',
    )!;
    assert.equal(token.zone, traitor ? 'placed' : 'supply');
    assert.equal(
      g.log.filter((l) => l.text.includes('This was destruction')).length,
      traitor ? 0 : 1,
    );
  }
});
