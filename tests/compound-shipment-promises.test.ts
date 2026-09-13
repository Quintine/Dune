import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  normalizeAutomaticGame,
  viewGame,
  type Action,
  type Game,
} from '../game/engine';
import {
  matchesShipment,
  parseShipmentClaim,
  parseShipmentExpression,
  shipmentClaimDestinations,
  shipmentClaimText,
  type ShipmentExpression,
} from '../game/shipment-promises';
import {
  compoundShipmentGame,
  openCompoundShipmentQuestion,
  askCompoundShipment,
  compoundShipmentCustody,
  holdCompoundShipmentCard,
} from './fixture-compound-shipment';

const leaf = (territory: string, minimum: number): ShipmentExpression => ({
  territory,
  minimum,
});
const and = (...terms: ShipmentExpression[]): ShipmentExpression => ({
  op: 'and',
  terms,
});
const or = (...terms: ShipmentExpression[]): ShipmentExpression => ({
  op: 'or',
  terms,
});
const alternative = or(leaf('carthag', 6), leaf('arrakeen', 4));
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
const answer = (g: Game, answer: 'yes' | 'no') =>
  applyAction(reload(g), 'p', { type: 'truthAnswer', answer });
const bind = (g: Game, claim = alternative, value: 'yes' | 'no' = 'yes') =>
  answer(askCompoundShipment(g, claim), value);
const ship = (g: Game, territory: string, amount: number) =>
  applyAction(reload(g), 'p', {
    type: 'ship',
    territory,
    sector: territory === 'carthag' ? 11 : 10,
    amount,
  });
function reject(g: Game, actor: string, action: Action): void {
  const before = structuredClone(g);
  assert.throws(() => applyAction(g, actor, action));
  assert.deepEqual(g, before);
}
function restored(g: Game): Game {
  const saved = reload(g);
  for (const p of g.players)
    assert.deepEqual(viewGame(saved, p.id), viewGame(g, p.id));
  compoundShipmentCustody(saved);
  return saved;
}
function nextShipment(g: Game): Action {
  const next = viewGame(g, 'p').shipmentCompletion?.actions[0];
  assert.ok(next);
  for (const id of ['a', 'o'])
    assert.equal(viewGame(g, id).shipmentCompletion, null);
  return next;
}

void test('shipment trees evaluate one physical event with aggregate AND/OR truth, bounded shipment-only input and legacy leaves', () => {
  const a = leaf('carthag', 4),
    b = leaf('arrakeen', 3);
  for (const [claim, outcomes] of [
    [and(a, b), [false, false, false, false]],
    [or(a, b), [false, true, true, false]],
    [and(a, or(leaf('carthag', 6), b)), [false, false, false, false]],
    [or(and(a, leaf('carthag', 5)), b), [false, false, true, false]],
  ] as const) {
    const parsed = parseShipmentClaim({ claim });
    assert.deepEqual(
      [
        null,
        { territory: 'carthag', amount: 4 },
        { territory: 'arrakeen', amount: 3 },
        { territory: 'carthag', amount: 3 },
      ].map((event) => matchesShipment(parsed, event)),
      outcomes,
    );
    assert.deepEqual(shipmentClaimDestinations(parsed), [
      'carthag',
      'arrakeen',
    ]);
    assert.match(shipmentClaimText(parsed), /ship at least/);
  }
  assert.deepEqual(parseShipmentClaim({ territory: 'carthag', minimum: 4 }), a);
  for (const claim of [
    { op: 'xor', terms: [a, b] },
    { op: 'or', terms: [] },
    { op: 'and', terms: [a] },
    { op: 'or', terms: [a, { kind: 'spice', minimum: 2 }] },
    { op: 'or', terms: [a, { ...b, target: 'o' }] },
    { op: 'and', terms: Array.from({ length: 17 }, () => a) },
    leaf('arrakeen', 0),
    leaf('missing', 4),
  ])
    assert.throws(() => parseShipmentExpression(claim));
  let tooDeep = a;
  for (let n = 0; n < 5; n++) tooDeep = or(a, tooDeep);
  assert.throws(() => parseShipmentExpression(tooDeep));
  assert.throws(() =>
    parseShipmentClaim({ territory: 'carthag', minimum: 4, claim: a }),
  );
});

void test('Basic and Advanced OR Yes remain one obligation and can choose a legal nonfirst branch after JSON restoration', () => {
  for (const advanced of [false, true]) {
    const initial = compoundShipmentGame(advanced);
    initial.storm = 11; // Public storm blocks only the first branch.
    const asked = askCompoundShipment(initial, alternative);
    assert.deepEqual(viewGame(asked, 'p').truthShipmentAnswers, ['yes', 'no']);
    for (const id of ['a', 'o'])
      assert.equal(viewGame(asked, id).truthShipmentAnswers, null);
    reject(asked, 'a', { type: 'truthAnswer', answer: 'yes' });
    const promised = restored(answer(asked, 'yes'));
    assert.deepEqual(promised.shipmentPromises, [
      { turn: 2, player: 'p', asker: 'a', claim: alternative, answer: true },
    ]);
    const next = nextShipment(promised);
    assert.equal(next.type, 'ship');
    assert.equal(next.territory, 'arrakeen');
    assert.equal(next.amount, 4);
    reject(promised, 'p', { type: 'endMovement' });
    const done = restored(applyAction(promised, 'p', next));
    assert.equal(done.players[0].forces['arrakeen:10'], 4);
    assert.equal(done.players[0].reserves, 16);
    assert.equal(done.shipmentPromises?.length, 1);
    assert.equal(done.shipmentPromises?.[0].fulfilled, true);
    assert.equal(
      done.discard.filter((c) => c.effect === 'truthtrance').length,
      1,
    );
    assert.deepEqual(normalizeAutomaticGame(done), done);
  }
});

void test('different-destination AND cannot be Yes; No allows either individual branch without flattening', () => {
  for (const advanced of [false, true]) {
    const asked = askCompoundShipment(
      compoundShipmentGame(advanced),
      and(leaf('carthag', 6), leaf('arrakeen', 4)),
    );
    assert.deepEqual(viewGame(asked, 'p').truthShipmentAnswers, ['no']);
    reject(asked, 'p', { type: 'truthAnswer', answer: 'yes' });
    const promised = answer(asked, 'no');
    for (const [territory, amount] of [
      ['carthag', 6],
      ['arrakeen', 4],
    ] as const) {
      const done = restored(ship(promised, territory, amount));
      assert.equal(done.shipmentPromises?.[0].fulfilled, true);
    }
    assert.equal(
      applyAction(promised, 'p', { type: 'endMovement' }).shipmentPromises?.[0]
        .fulfilled,
      true,
    );
  }
});

void test('nested same-destination thresholds bind the aggregate result, including AND No', () => {
  const expression = and(
    leaf('carthag', 4),
    or(leaf('carthag', 6), leaf('arrakeen', 3)),
  );
  for (const advanced of [false, true]) {
    const asked = askCompoundShipment(
      compoundShipmentGame(advanced),
      expression,
    );
    assert.deepEqual(viewGame(asked, 'p').truthShipmentAnswers, ['yes', 'no']);
    const positive = answer(asked, 'yes');
    assert.equal(nextShipment(positive).amount, 6);
    reject(positive, 'p', {
      type: 'ship',
      territory: 'carthag',
      sector: 11,
      amount: 5,
    });
    reject(positive, 'p', {
      type: 'ship',
      territory: 'arrakeen',
      sector: 10,
      amount: 3,
    });
    assert.equal(
      restored(ship(positive, 'carthag', 6)).shipmentPromises?.[0].fulfilled,
      true,
    );
    const negative = answer(asked, 'no');
    for (const amount of [4, 5])
      assert.equal(
        ship(negative, 'carthag', amount).shipmentPromises?.[0].fulfilled,
        true,
      );
    reject(negative, 'p', {
      type: 'ship',
      territory: 'carthag',
      sector: 11,
      amount: 6,
    });
  }
});

void test('OR No forbids each matching branch and permits fewer forces, another destination or no shipment', () => {
  for (const advanced of [false, true]) {
    const promised = bind(compoundShipmentGame(advanced), alternative, 'no');
    for (const [territory, amount] of [
      ['carthag', 6],
      ['arrakeen', 4],
    ] as const)
      reject(promised, 'p', {
        type: 'ship',
        territory,
        sector: territory === 'carthag' ? 11 : 10,
        amount,
      });
    for (const [territory, amount] of [
      ['carthag', 5],
      ['arrakeen', 3],
      ['imperial_basin', 1],
    ] as const)
      assert.equal(
        restored(ship(promised, territory, amount)).shipmentPromises?.[0]
          .fulfilled,
        true,
      );
    const done = restored(
      applyAction(restored(promised), 'p', { type: 'endMovement' }),
    );
    assert.equal(done.shipmentPromises?.[0].fulfilled, true);
    assert.equal(done.players[0].reserves, 20);
    assert.equal(done.players[0].spice, 20);
  }
});

void test('separate compound and legacy answers remain jointly binding without rewriting old saved leaf shape', () => {
  for (const advanced of [false, true]) {
    let g = bind(compoundShipmentGame(advanced));
    g = applyAction(openCompoundShipmentQuestion(g), 'a', {
      type: 'truthAsk',
      question: {
        kind: 'shipment',
        target: 'p',
        territory: 'carthag',
        minimum: 1,
      },
    });
    g = restored(answer(g, 'no'));
    assert.deepEqual(g.shipmentPromises?.[1], {
      turn: 2,
      player: 'p',
      asker: 'a',
      territory: 'carthag',
      minimum: 1,
      answer: false,
    });
    assert.equal(Object.hasOwn(g.shipmentPromises![1], 'claim'), false);
    assert.equal(nextShipment(g).territory, 'arrakeen');
    reject(g, 'p', {
      type: 'ship',
      territory: 'carthag',
      sector: 11,
      amount: 6,
    });
    const done = restored(ship(g, 'arrakeen', 4));
    assert.ok(done.shipmentPromises?.every((p) => p.fulfilled));
    assert.equal(
      done.discard.filter((c) => c.effect === 'truthtrance').length,
      2,
    );
  }
});

void test('joint expressions select the only remaining threshold interval, not a first positive destination', () => {
  const g = bind(
    bind(compoundShipmentGame(), or(leaf('carthag', 6), leaf('arrakeen', 4))),
    or(leaf('carthag', 1), leaf('arrakeen', 6)),
    'no',
  );
  assert.equal(nextShipment(g).territory, 'arrakeen');
  assert.equal(nextShipment(g).amount, 4);
  for (const amount of [4, 5])
    assert.ok(
      ship(g, 'arrakeen', amount).shipmentPromises?.every((p) => p.fulfilled),
    );
  for (const amount of [3, 6])
    reject(g, 'p', { type: 'ship', territory: 'arrakeen', sector: 10, amount });
});

void test('a later OR branch can depend on real Ghola, retained Karama and recovered outgoing aid preparation', () => {
  for (const advanced of [false, true]) {
    let g = compoundShipmentGame(advanced);
    const p = g.players[0];
    Object.assign(p, {
      reserves: 1,
      tanks: 5,
      forces: { 'arrakeen:10': 14 },
      spice: 3,
      ally: 'o',
    });
    if (p.elites)
      p.elites = {
        reserves: 0,
        tanks: 0,
        forces: { 'arrakeen:10': 5 },
        revived: 0,
      };
    g.players[2].ally = 'p';
    g.storm = 11;
    const ghola = holdCompoundShipmentCard(g, 'p', 'ghola');
    const karama = holdCompoundShipmentCard(g, 'p', 'karama');
    g = applyAction(g, 'p', { type: 'pledgeAid', amount: 2 });
    g = restored(bind(g, or(leaf('carthag', 6), leaf('arrakeen', 6))));
    const actions: Action[] = [];
    for (let n = 0; !g.players[0].shipped && n < 8; n++) {
      const next = nextShipment(g);
      actions.push(next);
      g = restored(applyAction(g, 'p', next));
    }
    assert.equal(g.players[0].shipped, true);
    assert.equal(g.players[0].forces['arrakeen:10'], 20);
    assert.equal(g.players[0].spice, 0);
    assert.equal(g.players[0].tanks, 0);
    assert.equal(g.aid.p.amount, 0);
    assert.ok(actions.some((a) => a.type === 'pledgeAid' && a.amount === 0));
    assert.ok(actions.some((a) => a.card === ghola));
    assert.ok(actions.some((a) => a.card === karama));
    assert.equal(g.shipmentPromises?.[0].fulfilled, true);
  }
});

void test('loss of one OR alternative preserves the whole obligation and voluntary destruction of its surviving branch rejects', () => {
  let g = compoundShipmentGame();
  g.players[0].spice = 2;
  g.players[0].ally = 'o';
  g.players[2].ally = 'p';
  g = applyAction(g, 'o', { type: 'pledgeAid', amount: 6 });
  g = bind(g, or(leaf('carthag', 6), leaf('arrakeen', 2)));
  assert.equal(nextShipment(g).territory, 'carthag');
  g = restored(applyAction(g, 'o', { type: 'pledgeAid', amount: 0 }));
  assert.equal(g.shipmentPromises?.[0].released, undefined);
  assert.equal(nextShipment(g).territory, 'arrakeen');
  reject(g, 'p', { type: 'bribe', target: 'a', amount: 1 });
  assert.equal(ship(g, 'arrakeen', 2).shipmentPromises?.[0].fulfilled, true);
});

void test('hidden rival wealth and card identities do not change the target-private feasible answer set or continuation shape', () => {
  const initial = compoundShipmentGame(true);
  initial.players[0].spice = 3;
  const asked = askCompoundShipment(initial, alternative);
  const changed = reload(asked);
  changed.players[2].spice = 1000;
  holdCompoundShipmentCard(changed, 'o', 'karama');
  assert.deepEqual(viewGame(asked, 'p').truthShipmentAnswers, ['no']);
  assert.deepEqual(
    viewGame(changed, 'p').truthShipmentAnswers,
    viewGame(asked, 'p').truthShipmentAnswers,
  );
  for (const g of [asked, changed]) {
    for (const actor of ['a', 'o']) {
      assert.equal(viewGame(g, actor).truthShipmentAnswers, null);
      assert.equal(viewGame(g, actor).shipmentCompletion, null);
    }
    const done = answer(g, 'no');
    assert.equal(
      done.log.length - g.log.length,
      answer(asked, 'no').log.length - asked.log.length,
    );
    assert.equal(done.truthtrance, null);
    assert.equal(done.response, null);
    assert.equal(done.decision, null);
  }
});

void test('an opponent making every OR branch impossible releases one aggregate obligation exactly once', () => {
  let g = compoundShipmentGame(true);
  g.players[0].spice = 0;
  g.players[0].ally = 'o';
  g.players[2].ally = 'p';
  g = applyAction(g, 'o', { type: 'pledgeAid', amount: 6 });
  g = bind(g);
  g = restored(applyAction(g, 'o', { type: 'pledgeAid', amount: 0 }));
  assert.equal(g.shipmentPromises?.length, 1);
  assert.equal(g.shipmentPromises?.[0].released, true);
  assert.equal(g.shipmentPromises?.[0].fulfilled, undefined);
  const before = g.log.length;
  assert.deepEqual(normalizeAutomaticGame(reload(g)), g);
  const done = restored(applyAction(g, 'p', { type: 'endMovement' }));
  assert.equal(done.shipmentPromises?.[0].released, true);
  assert.equal(done.shipmentPromises?.[0].fulfilled, undefined);
  assert.equal(
    done.log
      .slice(before)
      .filter((entry) => JSON.stringify(entry).includes('no longer binding'))
      .length,
    0,
  );
});

void test('malformed compound questions and saved promises reject before view, action, normalization or autopilot can mutate them', () => {
  const ready = openCompoundShipmentQuestion(compoundShipmentGame());
  const invalid = {
    op: 'or',
    terms: [leaf('carthag', 6), { kind: 'spice', min: 2 }],
  };
  reject(ready, 'a', {
    type: 'truthAsk',
    question: { kind: 'shipment', target: 'p', claim: invalid },
  });
  const pending = askCompoundShipment(compoundShipmentGame(), alternative);
  const promised = answer(pending, 'yes');
  for (const source of [pending, promised]) {
    const g = reload(source);
    if (g.truthtrance?.question)
      Object.assign(g.truthtrance.question, { claim: invalid });
    else Object.assign(g.shipmentPromises![0], { claim: invalid });
    const before = structuredClone(g);
    for (const p of g.players) assert.throws(() => viewGame(g, p.id));
    assert.throws(() => normalizeAutomaticGame(g));
    reject(g, 'p', { type: 'endMovement' });
    reject(g, 'p', { type: 'setAutopilot', enabled: true });
    assert.deepEqual(g, before);
  }
});
