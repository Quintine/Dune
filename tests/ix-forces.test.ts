import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  joinGame,
  newPlayer,
  viewGame,
  type Game,
} from '../game/engine';
import { baseDeck, leaders } from '../game/cards';
import { casualtyOptions } from '../game/combat';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
function fixture(advanced = false) {
  let g = createGame('IXFORCE2', newPlayer('e', 'Emperor', 'emperor'));
  joinGame(g, newPlayer('i', 'Ixians', 'guild'));
  g.players.forEach((p) => {
    p.ready = true;
  });
  g = applyAction(g, 'e', { type: 'start' });
  for (const p of g.players)
    g = applyAction(g, p.id, { type: 'traitor', leader: p.traitorChoices[0] });
  const ix = g.players[1];
  ix.faction = 'ixians';
  ix.leaders = leaders('ixians');
  ix.elites = {
    reserves: 5,
    tanks: 0,
    forces: { 'arrakeen:10': 2 },
    revived: 0,
  };
  g.players.forEach((p) => {
    p.hand = [];
    p.traitors = [];
    p.spice = 20;
    p.forces = { 'arrakeen:10': 8 };
    p.reserves = 12;
  });
  g.phase = 6;
  g.advanced = advanced;
  g.active = 'i';
  g.order = ['i', 'e'];
  g.storm = 18;
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
function prepare(state: Game) {
  return allow(
    applyAction(state, 'i', {
      type: 'chooseBattle',
      territory: 'arrakeen',
      target: 'e',
    }),
  );
}
function battle(state: Game, dial = 6, support = 0) {
  let g = prepare(state);
  g = applyAction(g, 'i', {
    type: 'battlePlan',
    dial,
    support,
    leader: 'ixians-1',
  });
  g = applyAction(g, 'e', { type: 'battlePlan', dial: 0, leader: 'emperor-4' });
  g = applyAction(g, 'i', { type: 'traitorCall', call: false });
  return applyAction(g, 'e', { type: 'traitorCall', call: false });
}
function chooseLoss(state: Game, normal = 4, elite = 2) {
  if (state.decision?.kind === 'ixSubstitution') {
    const ix = state.players.find((p) => p.id === 'i')!;
    assert.equal(
      ix.tanks,
      normal + elite,
      'the unique casualty allocation was applied automatically',
    );
    assert.equal(ix.elites?.tanks, elite);
    assert.equal(state.log.at(-1)?.automatic?.name, 'Battle casualties');
    return state;
  }
  assert.equal(state.decision?.kind, 'battleLosses');
  const d = state.decision;
  if (d?.kind !== 'battleLosses') throw Error('Missing casualties');
  const choice = d.options.findIndex(
    (o) => o.normal === normal && o.elite === elite,
  );
  assert.ok(choice >= 0);
  return applyAction(state, 'i', { type: 'decision', choice });
}
const substitute = (g: Game, count = 2) =>
  applyAction(g, 'i', {
    type: 'decision',
    sources: { 'arrakeen:10': count },
    recover: { 'arrakeen:10': count },
  });
function conserved(g: Game) {
  for (const p of g.players)
    assert.equal(
      p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0),
      20,
    );
  const e = g.players[1].elites!;
  assert.equal(
    e.reserves + e.tanks + Object.values(e.forces).reduce((a, b) => a + b, 0),
    7,
  );
  assert.ok(g.players.every((p) => p.spice >= 0));
}
void test('Ixian lobby records initialize seven cyborgs inside twenty physical forces', () => {
  const p = newPlayer('i', 'Ixians', 'ixians');
  assert.equal(p.reserves, 20);
  assert.equal(p.elites?.reserves, 7);
});
void test('printed six-strength example applies two cyborg and four suboid casualties in basic and advanced combat', () => {
  for (const advanced of [false, true]) {
    const g = chooseLoss(battle(fixture(advanced), 6, advanced ? 2 : 0));
    assert.equal(g.decision?.kind, 'ixSubstitution');
    assert.equal(g.players[1].forces['arrakeen:10'], 2);
    assert.equal(g.players[1].elites?.tanks, 2);
    assert.equal(g.players[1].tanks, 6);
    assert.equal(g.players[1].spice, advanced ? 18 : 20);
    conserved(g);
  }
});
void test('suboids never gain spice strength, including advanced battles and all-suboid armies', () => {
  const forces = {
    normal: 6,
    normalFixedHalf: true,
    elite: 2,
    eliteStrength: 2 as const,
    freeSupport: false,
  };
  assert.deepEqual(casualtyOptions(forces, 6, 3), []);
  assert.deepEqual(casualtyOptions({ ...forces, elite: 0 }, 3, 1), []);
  assert.equal(casualtyOptions({ ...forces, elite: 0 }, 3, 0).length, 1);
  const g = prepare(fixture(true));
  const snapshot = structuredClone(g);
  assert.throws(
    () =>
      applyAction(g, 'i', {
        type: 'battlePlan',
        dial: 6,
        support: 3,
        leader: 'ixians-1',
      }),
    /legal force/,
  );
  assert.deepEqual(g, snapshot);
});
void test('basic Ixians can seal half-strength dials while ordinary basic factions cannot', () => {
  let g = prepare(fixture());
  g = applyAction(g, 'i', {
    type: 'battlePlan',
    dial: 0.5,
    leader: 'ixians-1',
  });
  assert.equal(g.battle?.plans.i.dial, 0.5);
  assert.throws(
    () =>
      applyAction(g, 'e', {
        type: 'battlePlan',
        dial: 0.5,
        leader: 'emperor-4',
      }),
    /integer/,
  );
});
void test('advanced cyborgs count one unsupported and two supported while suboids remain one-half', () => {
  const f = {
    normal: 0,
    normalFixedHalf: true,
    elite: 2,
    eliteStrength: 2 as const,
    freeSupport: false,
  };
  assert.deepEqual(casualtyOptions(f, 2, 0), [
    { normal: 0, elite: 2, paidNormal: 0, paidElite: 0 },
  ]);
  assert.deepEqual(casualtyOptions(f, 2, 1), [
    { normal: 0, elite: 1, paidNormal: 0, paidElite: 1 },
  ]);
  assert.equal(casualtyOptions(f, 4, 2).length, 1);
});
void test('substitution exchanges physical types, preserves total casualties and completes after its response', () => {
  let g = chooseLoss(battle(fixture()));
  g.players[0].hand = [baseDeck().find((c) => c.effect === 'karama')!];
  const before = structuredClone(g);
  g = substitute(g);
  assert.equal(g.response?.kind, 'ixSubstitution');
  assert.deepEqual(g.players[1].elites, before.players[1].elites);
  g = allow(JSON.parse(JSON.stringify(g)));
  assert.equal(g.players[1].forces['arrakeen:10'], 2);
  assert.equal(g.players[1].elites?.forces['arrakeen:10'], 2);
  assert.equal(g.players[1].elites?.tanks, 0);
  assert.equal(g.players[1].tanks, 6);
  assert.equal(g.players[1].battleLosses, 6);
  assert.equal(g.pendingIxSubstitution, null);
  conserved(g);
});
void test('Karama cancels one selected substitution and leaves original cyborg casualties in the tanks', () => {
  const before = fixture();
  const karama = baseDeck().find((c) => c.effect === 'karama')!;
  // Move this physical fixture card out of the shuffled supply before holding it.
  before.deck = before.deck.filter((card) => card.id !== karama.id);
  before.discard = before.discard.filter((card) => card.id !== karama.id);
  before.players[0].hand = [karama];
  let g = substitute(chooseLoss(battle(before)));
  g = applyAction(g, 'e', { type: 'card', card: karama.id, mode: 'cancel' });
  assert.equal(g.players[1].elites?.tanks, 2);
  assert.equal(g.players[1].elites?.forces['arrakeen:10'], undefined);
  assert.equal(g.players[1].forces['arrakeen:10'], 2);
  assert.equal(g.pendingIxSubstitution, null);
  conserved(g);
});
void test('substitution is optional and partial exchanges preserve remaining cyborg deaths', () => {
  const before = chooseLoss(battle(fixture()));
  const declined = applyAction(before, 'i', {
    type: 'decision',
    decline: true,
  });
  assert.equal(declined.players[1].elites?.tanks, 2);
  const partial = allow(substitute(before, 1));
  assert.equal(partial.players[1].elites?.tanks, 1);
  assert.equal(partial.players[1].elites?.forces['arrakeen:10'], 1);
  conserved(partial);
});
void test('wrong ownership, excessive counts, mismatched exchanges and unrelated sectors reject atomically', () => {
  const g = chooseLoss(battle(fixture()));
  const snapshot = structuredClone(g);
  assert.throws(
    () => applyAction(g, 'e', { type: 'decision', decline: true }),
    /pending decision/,
  );
  assert.throws(() => substitute(g, 3), /integer/);
  for (const action of [
    { sources: { 'arrakeen:10': 2 }, recover: { 'arrakeen:10': 1 } },
    { sources: { 'carthag:11': 1 }, recover: { 'arrakeen:10': 1 } },
    { sources: { 'arrakeen:10': 1 }, recover: { 'carthag:11': 1 } },
    { sources: [], recover: {} },
  ])
    assert.throws(
      () => applyAction(g, 'i', { type: 'decision', ...action }),
      /sector|Exchange/,
    );
  assert.deepEqual(g, snapshot);
});
void test('substitution retains cyborgs in their casualty sectors and allows a surviving suboid in another sector of that territory', () => {
  const before = fixture();
  before.players[1].forces = { 'imperial_basin:10': 4, 'imperial_basin:9': 4 };
  before.players[1].elites!.forces = { 'imperial_basin:10': 2 };
  // The pending aftermath fixture retains the exact casualty-sector ledger produced by combat.
  before.players[1].forces = { 'imperial_basin:9': 2 };
  before.players[1].tanks = 6;
  before.players[1].elites!.forces = {};
  before.players[1].elites!.tanks = 2;
  before.players[1].battleLosses = 6;
  before.pendingIxSubstitution = {
    player: 'i',
    territory: 'imperial_basin',
    losses: { 'imperial_basin:10': 2 },
    cards: [],
  };
  before.decision = {
    kind: 'ixSubstitution',
    player: 'i',
    territory: 'imperial_basin',
    losses: { 'imperial_basin:10': 2 },
  };
  const g = allow(
    applyAction(before, 'i', {
      type: 'decision',
      sources: { 'imperial_basin:9': 2 },
      recover: { 'imperial_basin:10': 2 },
    }),
  );
  assert.equal(g.players[1].forces['imperial_basin:9'], undefined);
  assert.equal(g.players[1].elites!.forces['imperial_basin:10'], 2);
  conserved(g);
});
void test('basic cyborg strength has a Karama window; advanced suboid strength has no cancellable benefit', () => {
  const before = fixture();
  const karama = baseDeck().find((c) => c.effect === 'karama')!;
  before.players[0].hand = [karama];
  let g = applyAction(before, 'i', {
    type: 'chooseBattle',
    territory: 'arrakeen',
    target: 'e',
  });
  assert.equal(g.response?.kind, 'eliteStrength');
  g = applyAction(g, 'e', { type: 'card', card: karama.id, mode: 'cancel' });
  assert.throws(
    () =>
      applyAction(g, 'i', { type: 'battlePlan', dial: 6, leader: 'ixians-1' }),
    /legal force/,
  );
  assert.doesNotThrow(() =>
    applyAction(g, 'i', { type: 'battlePlan', dial: 5, leader: 'ixians-1' }),
  );
  const advanced = applyAction(fixture(true), 'i', {
    type: 'chooseBattle',
    territory: 'arrakeen',
    target: 'e',
  });
  assert.equal(advanced.response, null);
});
void test('traitor destruction leaves no survivors to substitute and conserves cyborgs', () => {
  let g = prepare(fixture());
  g.players[0].traitors = ['ixians-1'];
  g = applyAction(g, 'i', { type: 'battlePlan', dial: 0, leader: 'ixians-1' });
  g = applyAction(g, 'e', { type: 'battlePlan', dial: 0, leader: 'emperor-4' });
  g = applyAction(g, 'i', { type: 'traitorCall', call: false });
  g = applyAction(g, 'e', { type: 'traitorCall', call: true });
  assert.notEqual(g.decision?.kind, 'ixSubstitution');
  assert.equal(g.players[1].elites!.tanks, 2);
  conserved(g);
});
void test('all AI levels seal legal basic/advanced Ixian plans and make legal substitutions', () => {
  for (const advanced of [false, true])
    for (const difficulty of DIFFICULTIES) {
      const before = fixture(advanced);
      before.players[1].bot = difficulty;
      const g = prepare(before);
      const actions = botActions(viewGame(g, 'i')).filter(
        (action) => action.type === 'battlePlan',
      );
      assert.ok(actions.length);
      assert.doesNotThrow(() => applyAction(g, 'i', actions[0]));
      const aftermath = chooseLoss(battle(before, 6, advanced ? 2 : 0));
      const action = botActions(viewGame(aftermath, 'i'))[0];
      const result = allow(applyAction(aftermath, 'i', action));
      conserved(result);
      assert.ok(result.players[1].elites!.tanks < 2);
    }
});
void test('Ixian casualty solver matches exhaustive independent suboid/cyborg assignments', () => {
  for (const basic of [false, true])
    for (const strength of [1, 2] as const)
      for (let support = 0; support <= 4; support++)
        for (let half = 0; half <= 16; half++) {
          const expected = new Set<string>();
          for (let suboids = 0; suboids <= 4; suboids++)
            for (let cyborgs = 0; cyborgs <= 3; cyborgs++)
              for (let paid = 0; paid <= cyborgs; paid++) {
                if (basic ? support !== 0 || paid !== 0 : paid !== support)
                  continue;
                const dial =
                  suboids / 2 +
                  (basic
                    ? cyborgs * strength
                    : ((cyborgs - paid) * strength) / 2 + paid * strength);
                if (dial === half / 2) expected.add(`${suboids}:${cyborgs}`);
              }
          const actual = new Set(
            casualtyOptions(
              {
                normal: 4,
                normalFixedHalf: true,
                elite: 3,
                eliteStrength: strength,
                freeSupport: basic,
              },
              half / 2,
              support,
            ).map((o) => `${o.normal}:${o.elite}`),
          );
          assert.deepEqual(
            actual,
            expected,
            `${basic}/${strength}/${support}/${half}`,
          );
        }
});

void test('changing away from Ixians in the lobby removes their force types before a base game starts', () => {
  let g = createGame('IXLOBBY2', newPlayer('i', 'Player', 'ixians'));
  joinGame(g, newPlayer('e', 'Emperor', 'emperor'));
  g = applyAction(g, 'i', { type: 'faction', faction: 'atreides' });
  assert.equal(g.players[0].elites, undefined);
  g.players.forEach((p) => {
    p.ready = true;
  });
  g = applyAction(g, 'i', { type: 'start' });
  assert.ok(g.players.every((p) => !p.elites));
});
