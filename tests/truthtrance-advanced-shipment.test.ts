import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  initializeBaseGameForAudit,
  joinGame,
  newPlayer,
  normalizeAutomaticGame,
  viewGame,
  type Action,
  type Game,
} from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES, type Difficulty } from '../game/bot-profiles';
import type { FactionId } from '../game/catalog';
import { isAdvisor } from '../game/advisors';

const BASE: FactionId[] = [
  'emperor',
  'atreides',
  'harkonnen',
  'fremen',
  'beneGesserit',
];
const player = (g: Game, id = 'p') => g.players.find((p) => p.id === id)!;
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));

/** Real Advanced initialization and setup, followed by conserved scenario staging. */
function fixture(faction: FactionId = 'emperor', extra: FactionId[] = []) {
  const roster = [...new Set([faction, ...extra, ...BASE])].slice(
    0,
    Math.max(3, 1 + extra.length),
  );
  const ids = ['p', 'a', 'o', 'x', 'y', 'z'];
  let g = createGame(
    'ADVANCEDSHIPTRUTH',
    newPlayer('p', faction, faction),
    true,
  );
  for (let i = 1; i < roster.length; i++)
    joinGame(g, newPlayer(ids[i], roster[i], roster[i]));
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  g = initializeBaseGameForAudit(g);
  for (let n = 0; g.status === 'setup' && n < 30; n++) {
    let advanced = false;
    for (const p of g.players) {
      const view = viewGame(g, p.id);
      view.players.find((other) => other.id === p.id)!.bot = 'Hard';
      const action = botActions(view)[0];
      if (!action) continue;
      g = applyAction(g, p.id, action);
      advanced = true;
      break;
    }
    assert.ok(advanced, 'genuine Advanced setup has an entitled next actor');
  }
  assert.equal(g.status, 'playing');
  assert.equal(g.advanced, true);
  assert.equal(g.setupStage, undefined);
  Object.assign(g, {
    phase: 5,
    turn: 2,
    active: 'p',
    storm: 18,
    order: g.players.map((p) => p.id),
    movementRemaining: g.players.map((p) => p.id),
    response: null,
    decision: null,
    phaseOpening: null,
  });
  for (const p of g.players) {
    g.deck.push(...p.hand);
    p.hand = [];
    p.forces = {};
    p.reserves = 20;
    p.tanks = 0;
    p.spice = 20;
    p.shipped = false;
    p.moved = 0;
    p.revived = 0;
    if (p.advisors) p.advisors = {};
    if (p.elites) {
      p.elites.reserves = p.faction === 'emperor' ? 5 : 3;
      p.elites.tanks = 0;
      p.elites.forces = {};
      p.elites.revived = 0;
    }
  }
  return g;
}

function hold(g: Game, id: string, effectOrKind: string) {
  const index = g.deck.findIndex(
    (c) => c.effect === effectOrKind || c.kind === effectOrKind,
  );
  assert.ok(index >= 0, `available physical ${effectOrKind}`);
  const [card] = g.deck.splice(index, 1);
  player(g, id).hand.push(card);
  return card.id;
}

function pool(
  g: Game,
  reserves: number,
  tanks = 0,
  eliteReserves = 0,
  eliteTanks = 0,
  revived = 0,
) {
  const p = player(g),
    onBoard = 20 - reserves - tanks;
  p.reserves = reserves;
  p.tanks = tanks;
  p.forces = onBoard ? { 'arrakeen:10': onBoard } : {};
  if (p.elites) {
    const total = p.faction === 'emperor' ? 5 : 3;
    const boardElites = total - eliteReserves - eliteTanks;
    p.elites = {
      reserves: eliteReserves,
      tanks: eliteTanks,
      revived,
      forces: boardElites ? { 'arrakeen:10': boardElites } : {},
    };
  }
  assertCustody(g);
}

function assertCustody(g: Game) {
  for (const p of g.players) {
    assert.equal(
      p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0),
      20,
    );
    if (p.elites)
      assert.equal(
        p.elites.reserves +
          p.elites.tanks +
          Object.values(p.elites.forces).reduce((a, b) => a + b, 0),
        p.faction === 'emperor' ? 5 : 3,
      );
  }
  const cards = [...g.deck, ...g.discard, ...g.players.flatMap((p) => p.hand)];
  assert.equal(new Set(cards.map((c) => c.id)).size, cards.length);
}

function openQuestion(state: Game) {
  const g = reload(state),
    card = hold(g, 'a', 'truthtrance');
  let next = applyAction(g, 'a', { type: 'card', card });
  for (let n = 0; next.truthtrance?.stage === 'priority' && n < 10; n++) {
    const actor = next.players.find(
      (p) => !next.truthtrance!.passed.includes(p.id),
    )!;
    next = applyAction(reload(next), actor.id, { type: 'truthPass' });
  }
  assert.equal(next.truthtrance?.stage, 'ask');
  return next;
}

function ask(g: Game, minimum = 6, territory = 'carthag') {
  return applyAction(openQuestion(g), 'a', {
    type: 'truthAsk',
    question: { kind: 'shipment', target: 'p', territory, minimum },
  });
}

function bind(g: Game, minimum = 6, territory = 'carthag', answer = 'yes') {
  return applyAction(reload(ask(g, minimum, territory)), 'p', {
    type: 'truthAnswer',
    answer,
  });
}

function reject(g: Game, id: string, action: Action) {
  const before = structuredClone(g);
  assert.throws(() => applyAction(g, id, action));
  assert.deepEqual(g, before);
}

function allow(state: Game) {
  let g = reload(state);
  for (let n = 0; g.response && n < 20; n++) {
    const actor = g.players.find((p) => !g.response!.passed.includes(p.id));
    assert.ok(actor);
    g = applyAction(reload(g), actor.id, { type: 'passResponse' });
  }
  assert.equal(g.response, null);
  return g;
}

function witness(g: Game) {
  const projected = viewGame(g, 'p');
  const next = projected.shipmentCompletion?.actions[0];
  assert.ok(
    next,
    'a feasible positive answer supplies an executable next step',
  );
  for (const other of g.players.filter((p) => p.id !== 'p'))
    assert.equal(viewGame(g, other.id).shipmentCompletion, null);
  return next;
}

function finish(state: Game, difficulty?: Difficulty) {
  let g = reload(state);
  for (let n = 0; !player(g).shipped && n < 12; n++) {
    if (g.response) {
      g = allow(g);
      continue;
    }
    const next = witness(g);
    if (difficulty) {
      const view = viewGame(g, 'p');
      view.players.find((p) => p.id === 'p')!.bot = difficulty;
      const before = structuredClone(view),
        proposals = botActions(view);
      assert.deepEqual(view, before);
      assert.deepEqual(
        proposals[0],
        next,
        `${difficulty} uses the authoritative first step`,
      );
      for (const action of proposals)
        assert.doesNotThrow(
          () => applyAction(g, 'p', action),
          JSON.stringify(action),
        );
    }
    g = applyAction(reload(g), 'p', next);
    assertCustody(g);
  }
  assert.equal(player(g).shipped, true);
  assert.equal(g.shipmentPromises?.[0].fulfilled, true);
  assert.equal(g.shipmentPromises?.[0].released, undefined);
  return g;
}

void test('Advanced mixed Ghola returns honor the one-elite cap and retain a feasible smaller physical shipment', () => {
  for (const revived of [0, 1]) {
    const g = fixture();
    pool(g, 0, 5, 0, 2, revived);
    const ghola = hold(g, 'p', 'ghola'),
      maximum = revived ? 3 : 4;
    assert.deepEqual(viewGame(ask(g, maximum + 1), 'p').truthShipmentAnswers, [
      'no',
    ]);
    const promised = bind(g, maximum),
      next = witness(promised);
    assert.equal(next.card, ghola);
    assert.equal(next.amount, maximum);
    assert.equal(next.elite, revived ? 0 : 1);
    const done = finish(promised);
    assert.equal(player(done).forces['carthag:11'], maximum);
    assert.equal(
      player(done).elites!.forces['carthag:11'] ?? 0,
      revived ? 0 : 1,
    );
    assert.equal(player(done).elites!.revived, 1);
    assert.equal(player(done).tanks, 5 - maximum);
    assert.equal(done.discard.filter((c) => c.id === ghola).length, 1);
  }
});

void test('Advanced elite-only Tanks permit exactly one Ghola return, or none after the shared quota is spent', () => {
  for (const faction of ['emperor', 'fremen'] as const) {
    const g = fixture(faction);
    pool(g, 0, 2, 0, 2);
    hold(g, 'p', 'ghola');
    const destination = faction === 'fremen' ? 'the_great_flat' : 'carthag';
    assert.deepEqual(
      viewGame(ask(g, 2, destination), 'p').truthShipmentAnswers,
      ['no'],
    );
    const promised = bind(g, 1, destination),
      next = witness(promised);
    assert.equal(next.amount, 1);
    assert.equal(next.elite, 1);
    const done = finish(promised);
    assert.equal(player(done).tanks, 1);
    assert.equal(player(done).elites!.tanks, 1);
    assert.equal(player(done).elites!.revived, 1);
    const exhausted = reload(g);
    player(exhausted).elites!.revived = 1;
    assert.deepEqual(
      viewGame(ask(exhausted, 1, destination), 'p').truthShipmentAnswers,
      ['no'],
    );
  }
});

void test('Advanced Fremen promise counts physical Fedaykin once and fulfills free reserve reinforcement', () => {
  const g = fixture('fremen');
  pool(g, 6, 0, 3);
  player(g).spice = 0;
  const promised = bind(g, 6, 'the_great_flat');
  reject(promised, 'p', {
    type: 'ship',
    territory: 'the_great_flat',
    sector: 15,
    amount: 3,
    elite: 3,
  });
  const done = applyAction(reload(promised), 'p', {
    type: 'ship',
    territory: 'the_great_flat',
    sector: 15,
    amount: 6,
    elite: 3,
  });
  assert.equal(player(done).forces['the_great_flat:15'], 6);
  assert.equal(player(done).elites!.forces['the_great_flat:15'], 3);
  assert.equal(player(done).spice, 0);
  assert.equal(done.shipmentPromises?.[0].fulfilled, true);
  assertCustody(done);
});

void test('Advanced BG joins existing advisors with a qualifying direct shipment and retains its stance', () => {
  const g = fixture('beneGesserit');
  pool(g, 19);
  player(g).forces = { 'carthag:11': 1 };
  player(g).advisors = { carthag: {} };
  player(g, 'a').forces = { 'carthag:11': 1 };
  player(g, 'a').reserves = 19;
  const done = finish(bind(g, 6));
  assert.equal(player(done).forces['carthag:11'], 7);
  assert.equal(isAdvisor(player(done), 'carthag'), true);
  assertCustody(done);
});

void test('a fulfilled Advanced promise survives a saved BG accompaniment choice without counting the free advisor', () => {
  const g = fixture('emperor', ['beneGesserit']);
  const pending = finish(bind(g));
  assert.equal(pending.decision?.kind, 'advisor');
  assert.equal(pending.decision?.player, 'a');
  const promised = structuredClone(pending.shipmentPromises);
  for (const accept of [true, false]) {
    const continued = allow(
      applyAction(reload(pending), 'a', {
        type: 'decision',
        accept,
        accompany: true,
        sector: 11,
      }),
    );
    assert.deepEqual(continued.shipmentPromises, promised);
    assert.equal(player(continued).forces['carthag:11'], 6);
    assert.equal(
      player(continued, 'a').forces['carthag:11'] ?? 0,
      accept ? 1 : 0,
    );
    assert.equal(isAdvisor(player(continued, 'a'), 'carthag'), accept);
    assert.equal(continued.active, 'p');
    assert.equal(
      continued.discard.filter((c) => c.effect === 'truthtrance').length,
      1,
    );
    assertCustody(continued);
  }
});

void test('BG Worthless shipment preparation remains binding while a real response waits and completes once after allowance', () => {
  const g = fixture('beneGesserit');
  player(g).spice = 3;
  const worthless = hold(g, 'p', 'worthless');
  hold(g, 'a', 'karama');
  const asked = ask(g);
  assert.deepEqual(viewGame(asked, 'p').truthShipmentAnswers, ['yes', 'no']);
  for (const id of ['a', 'o'])
    assert.equal(viewGame(asked, id).truthShipmentAnswers, null);
  const promised = applyAction(asked, 'p', {
    type: 'truthAnswer',
    answer: 'yes',
  });
  const next = witness(promised);
  assert.equal(next.card, worthless);
  assert.equal(next.mode, 'shipment');
  const pending = applyAction(reload(promised), 'p', next);
  assert.equal(pending.response?.kind, 'worthlessKarama');
  assert.equal(pending.karamaShipping, null);
  assert.equal(pending.shipmentPromises?.[0].released, undefined);
  assert.equal(pending.shipmentPromises?.[0].fulfilled, undefined);
  assert.equal(pending.discard.filter((c) => c.id === worthless).length, 1);
  const continued = normalizeAutomaticGame(reload(pending));
  assert.equal(continued.response?.kind, 'worthlessKarama');
  const granted = allow(continued);
  assert.equal(granted.karamaShipping?.card, worthless);
  const done = finish(granted);
  assert.equal(player(done).forces['carthag:11'], 6);
  assert.equal(player(done).spice, 0);
  assert.equal(done.discard.filter((c) => c.id === worthless).length, 1);
  assert.equal(
    done.discard.filter((c) => c.effect === 'truthtrance').length,
    1,
  );
});

void test('canceling BG conversion releases an impossible promise once without spending its shipment or spice', () => {
  const g = fixture('beneGesserit');
  player(g).spice = 3;
  const worthless = hold(g, 'p', 'worthless'),
    karama = hold(g, 'a', 'karama');
  const promised = bind(g),
    pending = applyAction(promised, 'p', witness(promised));
  assert.equal(pending.response?.kind, 'worthlessKarama');
  const denied = applyAction(reload(pending), 'a', {
    type: 'card',
    card: karama,
    mode: 'cancel',
  });
  assert.equal(denied.shipmentPromises?.[0].released, true);
  assert.equal(denied.shipmentPromises?.[0].fulfilled, undefined);
  assert.equal(player(denied).shipped, false);
  assert.equal(player(denied).spice, 3);
  assert.equal(denied.pendingKarama, null);
  assert.equal(denied.karamaShipping, null);
  for (const card of [worthless, karama])
    assert.equal(denied.discard.filter((c) => c.id === card).length, 1);
  const continued = normalizeAutomaticGame(reload(denied));
  assert.equal(
    continued.log.filter((l) =>
      l.text.includes('no longer fulfill a Truthtrance shipment'),
    ).length,
    1,
  );
  assert.doesNotThrow(() =>
    applyAction(continued, 'p', { type: 'endMovement' }),
  );
  reject(continued, 'a', { type: 'card', card: karama, mode: 'cancel' });
  assertCustody(continued);
});

void test('an opposing BG conversion cancellation preserves a promise when an owned physical Karama still fulfills it', () => {
  const g = fixture('beneGesserit');
  player(g).spice = 3;
  const worthless = hold(g, 'p', 'worthless');
  const retained = hold(g, 'p', 'karama'),
    counter = hold(g, 'a', 'karama');
  const promised = bind(g);
  assert.equal(witness(promised).card, worthless);
  const pending = applyAction(promised, 'p', witness(promised));
  const denied = applyAction(reload(pending), 'a', {
    type: 'card',
    card: counter,
    mode: 'cancel',
  });
  assert.equal(denied.shipmentPromises?.[0].released, undefined);
  assert.equal(witness(denied).card, retained);
  const done = finish(denied);
  assert.equal(player(done).forces['carthag:11'], 6);
  assert.equal(player(done).spice, 0);
  for (const card of [worthless, retained, counter])
    assert.equal(done.discard.filter((c) => c.id === card).length, 1);
});

void test('Advanced Yes rejects movement, skip and voluntary evasion; No permits every nonmatching choice', () => {
  const g = fixture();
  pool(g, 6, 0, 2);
  player(g).spice = 6;
  const movement: Action = {
    type: 'move',
    from: 'arrakeen:10',
    territory: 'imperial_basin',
    sector: 10,
    amount: 1,
    elite: 0,
  };
  const positive = bind(g);
  for (const action of [
    movement,
    { type: 'endMovement' },
    { type: 'bribe', target: 'a', amount: 1 },
    { type: 'ship', territory: 'carthag', sector: 11, amount: 5, elite: 1 },
  ])
    reject(positive, 'p', action);
  const done = finish(positive);
  assert.doesNotThrow(() =>
    applyAction(reload(done), 'p', { type: 'endMovement' }),
  );
  const negative = bind(g, 6, 'carthag', 'no');
  reject(negative, 'p', {
    type: 'ship',
    territory: 'carthag',
    sector: 11,
    amount: 6,
    elite: 2,
  });
  for (const action of [
    movement,
    { type: 'endMovement' },
    { type: 'ship', territory: 'carthag', sector: 11, amount: 5, elite: 1 },
  ]) {
    const allowed = applyAction(reload(negative), 'p', action);
    assert.equal(allowed.shipmentPromises?.[0].fulfilled, true);
    assertCustody(allowed);
  }
});

void test('all four profiles execute private typed Ghola and BG conversion witnesses through saved continuations', () => {
  for (const difficulty of DIFFICULTIES)
    for (const faction of ['emperor', 'beneGesserit'] as const) {
      const g = fixture(faction);
      if (faction === 'emperor') {
        pool(g, 2, 5, 0, 2);
        hold(g, 'p', 'ghola');
        player(g).spice = 6;
      } else {
        player(g).spice = 3;
        hold(g, 'p', 'worthless');
        hold(g, 'a', 'karama');
      }
      player(g).bot = difficulty;
      const asked = ask(g),
        view = viewGame(asked, 'p');
      const answers = botActions(view);
      assert.equal(answers.length, 1);
      assert.equal(answers[0].type, 'truthAnswer');
      assert.ok(
        view.truthShipmentAnswers!.some(
          (answer) => answer === answers[0].answer,
        ),
      );
      assert.doesNotThrow(() => applyAction(reload(asked), 'p', answers[0]));
      // The profile may strategically prefer No; a legally selected Yes must
      // still be fulfilled through the profile's authoritative preparation path.
      const promised = applyAction(reload(asked), 'p', {
        type: 'truthAnswer',
        answer: 'yes',
      });
      const done = finish(promised, difficulty);
      assert.equal(player(done).forces['carthag:11'], 6);
      assert.equal(player(done).spice, 0);
      assert.equal(
        done.discard.filter((c) => c.effect === 'truthtrance').length,
        1,
      );
    }
});

void test('unrelated opponent cards and wealth cannot change Advanced answer or completion projections', () => {
  const g = fixture();
  pool(g, 2, 5, 0, 2);
  hold(g, 'p', 'ghola');
  hold(g, 'o', 'harvester');
  const asked = ask(g),
    altered = reload(asked);
  const rival = player(altered, 'o');
  altered.deck.push(...rival.hand);
  rival.hand = [];
  hold(altered, 'o', 'hajr');
  rival.spice = 999;
  assert.deepEqual(viewGame(altered, 'p'), viewGame(asked, 'p'));
  const original = applyAction(asked, 'p', {
    type: 'truthAnswer',
    answer: 'yes',
  });
  const changed = applyAction(altered, 'p', {
    type: 'truthAnswer',
    answer: 'yes',
  });
  assert.deepEqual(viewGame(changed, 'p'), viewGame(original, 'p'));
  assert.deepEqual(witness(changed), witness(original));
  for (const difficulty of DIFFICULTIES) {
    const left = viewGame(original, 'p'),
      right = viewGame(changed, 'p');
    left.players.find((p) => p.id === 'p')!.bot = difficulty;
    right.players.find((p) => p.id === 'p')!.bot = difficulty;
    assert.deepEqual(botActions(left), botActions(right));
  }
});

void test('Advanced Guild and selected expansions reject unsupported questions immutably before binding or discard', () => {
  for (const scope of ['guild', 'expansion'] as const) {
    const g = fixture('emperor', scope === 'guild' ? ['guild'] : []);
    if (scope === 'expansion') g.expansions = ['ix'];
    const pending = openQuestion(g);
    reject(pending, 'a', {
      type: 'truthAsk',
      question: {
        kind: 'shipment',
        target: 'p',
        territory: 'carthag',
        minimum: 6,
      },
    });
    assert.equal(pending.shipmentPromises?.length ?? 0, 0);
    assert.equal(
      pending.discard.filter((c) => c.effect === 'truthtrance').length,
      0,
    );
    assert.equal(
      player(pending, 'a').hand.filter((c) => c.effect === 'truthtrance')
        .length,
      1,
    );
  }
});
