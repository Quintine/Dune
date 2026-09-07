import test from 'node:test';
import assert from 'node:assert/strict';
import { baseDeck, ixBattleCards, type Card } from '../game/cards';
import { weaponKills, validBattleCardPair } from '../game/battle-cards';
import {
  applyAction,
  createGame,
  joinGame,
  newPlayer,
  viewGame,
  type Game,
  type Action,
} from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
const all = [...baseDeck(), ...ixBattleCards()];
const card = (kind: Card['kind']) => all.find((c) => c.kind === kind)!;
/** Assign fixture cards by transferring their exact physical IDs from the deck. */
function setHand(g: Game, index: number, selected: Card[]) {
  const owner = g.players[index];
  const ids = new Set(selected.map((c) => c.id));
  assert.equal(ids.size, selected.length);
  const held = new Map(owner.hand.map((c) => [c.id, c]));
  for (const previous of owner.hand)
    if (!ids.has(previous.id)) g.deck.push(previous);
  owner.hand = selected.map((wanted) => {
    if (held.has(wanted.id)) return held.get(wanted.id)!;
    assert.ok(
      !g.players.some(
        (p, i) => i !== index && p.hand.some((c) => c.id === wanted.id),
      ),
      `Another player owns ${wanted.id}`,
    );
    const at = g.deck.findIndex((c) => c.id === wanted.id);
    assert.ok(at >= 0, `Fixture deck must contain ${wanted.id}`);
    return g.deck.splice(at, 1)[0];
  });
}
function fixture() {
  let g = createGame('IXCARDS2', newPlayer('a', 'Atreides', 'atreides'));
  for (const [id, f] of [
    ['g', 'guild'],
    ['e', 'emperor'],
    ['b', 'beneGesserit'],
  ] as const)
    joinGame(g, newPlayer(id, f, f));
  g.players.forEach((p) => (p.ready = true));
  g = applyAction(g, 'a', { type: 'start' });
  g = applyAction(g, 'b', { type: 'predict', faction: 'atreides', turn: 5 });
  for (const p of g.players)
    if (p.traitorChoices.length)
      g = applyAction(g, p.id, {
        type: 'traitor',
        leader: p.traitorChoices[0],
      });
  assert.equal(g.status, 'playing');
  g.phase = 6;
  g.active = 'a';
  g.order = ['a', 'g', 'e', 'b'];
  g.storm = 18;
  // Return dealt cards before replacing setup hands for this battle fixture.
  g.deck.push(...g.players.flatMap((p) => p.hand));
  g.deck.push(...ixBattleCards());
  g.players.forEach((p) => {
    p.forces = ['a', 'g'].includes(p.id) ? { 'arrakeen:10': 5 } : {};
    p.reserves = Object.keys(p.forces).length ? 15 : 20;
    p.hand = [];
    p.traitors = [];
    p.spice = 20;
  });
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
const choose = (g: Game) =>
  allow(
    applyAction(g, 'a', {
      type: 'chooseBattle',
      territory: 'arrakeen',
      target: 'g',
    }),
  );
function prepared(state: Game) {
  let g = choose(state);
  while (g.battle?.preparation)
    g = applyAction(g, g.battle.preparation.owner, {
      type: 'declineBattlePower',
    });
  return g;
}
function plan(g: Game, id: string, choices: Partial<Action> = {}) {
  return applyAction(g, id, {
    type: 'battlePlan',
    dial: 0,
    leader: id === 'a' ? 'atreides-0' : 'guild-0',
    ...choices,
  });
}
function resolve(g: Game) {
  g = applyAction(g, 'a', { type: 'traitorCall', call: false });
  return applyAction(g, 'g', { type: 'traitorCall', call: false });
}
void test('combined and alternate-role cards obey the full projectile/poison defense matrix', () => {
  const defenses = [
    undefined,
    card('shield'),
    card('snooper'),
    card('shieldSnooper'),
    card('weirdingWay'),
    card('chemistry'),
  ];
  const expectations: [Card['kind'], boolean[]][] = [
    ['projectile', [true, false, true, false, false, true]],
    ['poison', [true, true, false, false, true, false]],
    ['poisonBlade', [true, true, true, false, true, true]],
    ['weirdingWay', [true, false, true, false, false, true]],
    ['chemistry', [true, true, false, false, true, false]],
    ['lasgun', [true, true, true, true, true, true]],
  ];
  for (const [kind, kills] of expectations)
    assert.deepEqual(
      defenses.map((d) => weaponKills(card(kind), d)),
      kills,
      kind,
    );
});
void test('alternate roles require the complementary slot and cannot reuse the same card', () => {
  assert.equal(validBattleCardPair(card('chemistry')), false);
  assert.equal(validBattleCardPair(undefined, card('weirdingWay')), false);
  assert.equal(
    validBattleCardPair(card('weirdingWay'), card('chemistry')),
    true,
  );
  assert.equal(
    validBattleCardPair(card('chemistry'), card('weirdingWay')),
    true,
  );
  assert.equal(
    validBattleCardPair(card('chemistry'), card('chemistry')),
    false,
  );
  assert.equal(
    validBattleCardPair(card('poisonBlade'), card('shieldSnooper')),
    true,
  );
});
void test('Poison Blade kills through either single defense but Shield Snooper protects in authoritative combat', () => {
  for (const kind of ['shield', 'snooper', 'shieldSnooper'] as const) {
    const before = fixture();
    setHand(before, 0, [card('poisonBlade')]);
    setHand(before, 1, [card(kind)]);
    let g = plan(prepared(before), 'a', { weapon: card('poisonBlade').id });
    g = plan(g, 'g', { defense: card(kind).id });
    g = resolve(g);
    assert.equal(g.players[1].leaders[0].dead, kind !== 'shieldSnooper');
    assert.equal(g.players[0].forces['arrakeen:10'], 5);
  }
});
void test('Shield Snooper triggers lasgun explosion while Weirding Way does not', () => {
  for (const kind of ['shieldSnooper', 'weirdingWay'] as const) {
    const before = fixture();
    setHand(before, 0, [card('lasgun')]);
    setHand(before, 1, [card(kind), card('poison')]);
    let g = plan(prepared(before), 'a', { weapon: card('lasgun').id });
    g = plan(g, 'g', { defense: card(kind).id, weapon: card('poison').id });
    g = resolve(g);
    assert.equal(
      g.players[0].forces['arrakeen:10'] ?? 0,
      kind === 'shieldSnooper' ? 0 : 5,
    );
    assert.equal(g.players[1].leaders[0].dead, true);
  }
});
void test('server rejects incomplete role swaps without mutating state, and accepts complementary cards', () => {
  const before = fixture();
  setHand(before, 1, [card('chemistry'), card('weirdingWay')]);
  const g = prepared(before),
    frozen = structuredClone(g);
  assert.throws(
    () => plan(g, 'g', { weapon: card('chemistry').id }),
    /another defense/,
  );
  assert.throws(
    () => plan(g, 'g', { defense: card('weirdingWay').id }),
    /another weapon/,
  );
  assert.throws(
    () =>
      plan(g, 'g', {
        weapon: card('weirdingWay').id,
        defense: card('weirdingWay').id,
      }),
    /both slots/,
  );
  assert.deepEqual(g, frozen);
  assert.ok(
    plan(g, 'g', {
      weapon: card('weirdingWay').id,
      defense: card('chemistry').id,
    }).battle?.plans.g,
  );
});
function voiced(hand: Card[], kind: string, must: boolean) {
  const before = fixture();
  setHand(before, 1, hand);
  before.players[0].ally = 'b';
  before.players[3].ally = 'a';
  let g = choose(before);
  g = allow(applyAction(g, 'b', { type: 'voice', kind, must }));
  return applyAction(g, 'a', { type: 'declineBattlePower' });
}
void test('Voice forbids combined cards through either generic type and can name them specifically', () => {
  for (const kind of ['projectile', 'poison', 'poisonBlade']) {
    const g = voiced([card('poisonBlade')], kind, false);
    assert.throws(
      () => plan(g, 'g', { weapon: card('poisonBlade').id }),
      /Voice/,
    );
    assert.ok(plan(g, 'g').battle?.plans.g);
  }
  for (const kind of ['shield', 'snooper', 'shieldSnooper']) {
    const g = voiced([card('shieldSnooper')], kind, true);
    assert.throws(() => plan(g, 'g'), /Voice/);
    assert.ok(
      plan(g, 'g', { defense: card('shieldSnooper').id }).battle?.plans.g,
    );
  }
});
void test('generic Voice prohibition follows the selected role of Chemistry and Weirding Way', () => {
  const hand = [
    card('chemistry'),
    card('weirdingWay'),
    card('poison'),
    card('shield'),
  ];
  const noPoison = voiced(hand, 'poison', false);
  assert.ok(
    plan(noPoison, 'g', {
      weapon: card('weirdingWay').id,
      defense: card('chemistry').id,
    }).battle?.plans.g,
  );
  assert.throws(
    () =>
      plan(noPoison, 'g', {
        weapon: card('chemistry').id,
        defense: card('shield').id,
      }),
    /Voice/,
  );
  const noProjectile = voiced(hand, 'projectile', false);
  assert.ok(
    plan(noProjectile, 'g', {
      weapon: card('poison').id,
      defense: card('weirdingWay').id,
    }).battle?.plans.g,
  );
  assert.throws(
    () => plan(noProjectile, 'g', { weapon: card('weirdingWay').id }),
    /Voice/,
  );
});
void test('Voice compulsion cannot force a held card into its alternate role', () => {
  const chemistry = voiced([card('chemistry'), card('shield')], 'poison', true);
  assert.ok(plan(chemistry, 'g').battle?.plans.g);
  const weirding = voiced(
    [card('weirdingWay'), card('poison')],
    'shield',
    true,
  );
  assert.ok(plan(weirding, 'g').battle?.plans.g);
  const required = voiced(
    [card('weirdingWay'), card('poison')],
    'projectile',
    true,
  );
  assert.throws(
    () =>
      plan(required, 'g', {
        weapon: card('poison').id,
        defense: card('weirdingWay').id,
      }),
    /Voice/,
  );
  assert.ok(
    plan(required, 'g', { weapon: card('weirdingWay').id }).battle?.plans.g,
  );
});
void test('named Voice prohibition applies in both alternate roles', () => {
  for (const kind of ['weirdingWay', 'chemistry'] as const) {
    const g = voiced([card(kind), card('poison'), card('shield')], kind, false);
    assert.throws(
      () => plan(g, 'g', { weapon: card(kind).id, defense: card('shield').id }),
      /Voice/,
    );
    assert.throws(
      () => plan(g, 'g', { weapon: card('poison').id, defense: card(kind).id }),
      /Voice/,
    );
  }
});
void test('prescience reveals only the effective slot, preserves alternate-role legality and keeps the other card private', () => {
  for (const [field, value, choices] of [
    [
      'weapon',
      card('poison').id,
      { weapon: card('poison').id, defense: card('weirdingWay').id },
    ],
    [
      'defense',
      card('weirdingWay').id,
      { weapon: card('poison').id, defense: card('weirdingWay').id },
    ],
    [
      'defense',
      card('shield').id,
      { weapon: card('chemistry').id, defense: card('shield').id },
    ],
    [
      'weapon',
      card('chemistry').id,
      { weapon: card('chemistry').id, defense: card('shield').id },
    ],
  ] as const) {
    const before = fixture();
    setHand(before, 1, [
      card('poison'),
      card('weirdingWay'),
      card('chemistry'),
      card('shield'),
    ]);
    let g = choose(before);
    g = allow(applyAction(g, 'a', { type: 'prescience', field }));
    g = applyAction(g, 'g', { type: 'prescienceAnswer', value });
    const insight = viewGame(g, 'a').battle!.insight!;
    assert.equal(insight.value, value);
    assert.equal(viewGame(g, 'e').battle!.insight, null);
    g = plan(JSON.parse(JSON.stringify(g)), 'g', choices);
    assert.equal(viewGame(g, 'a').battle!.plans.g, undefined);
    assert.throws(() => plan(g, 'a', { weapon: value }), /weapon|defense/);
  }
});
void test('prescience rejects an alternate slot with no possible complementary card', () => {
  for (const [field, kind] of [
    ['weapon', 'chemistry'],
    ['defense', 'weirdingWay'],
  ] as const) {
    const before = fixture();
    setHand(before, 1, [card(kind)]);
    let g = choose(before);
    g = allow(applyAction(g, 'a', { type: 'prescience', field }));
    assert.throws(
      () =>
        applyAction(g, 'g', { type: 'prescienceAnswer', value: card(kind).id }),
      /legal battle plan/,
    );
  }
});
void test('all AI policies find legal expansion-card plans and remain independent of opponent hidden hands', () => {
  for (const difficulty of DIFFICULTIES) {
    const before = fixture();
    setHand(before, 1, ixBattleCards().slice(-4));
    before.players[1].bot = difficulty;
    const g = prepared(before);
    const actions = botActions(viewGame(g, 'g'));
    const accepted = actions.find((action) => {
      try {
        applyAction(g, 'g', action);
        return true;
      } catch {
        return false;
      }
    });
    assert.ok(accepted, difficulty);
    setHand(g, 0, [card('lasgun'), card('shield')]);
    g.deck.reverse();
    assert.deepEqual(botActions(viewGame(g, 'g')), actions);
  }
});

void test('Hard and Brutal use revealed Poison Blade information to select the combined defense', () => {
  for (const difficulty of ['Hard', 'Brutal'] as const) {
    const before = fixture();
    before.players[0].bot = difficulty;
    setHand(before, 0, [
      card('shieldSnooper'),
      card('shield'),
      card('snooper'),
    ]);
    setHand(before, 1, [card('poisonBlade')]);
    let g = choose(before);
    g = allow(applyAction(g, 'a', { type: 'prescience', field: 'weapon' }));
    g = applyAction(g, 'g', {
      type: 'prescienceAnswer',
      value: card('poisonBlade').id,
    });
    const actions = botActions(viewGame(g, 'a'));
    const selected = actions.find((action) => {
      try {
        applyAction(g, 'a', action);
        return true;
      } catch {
        return false;
      }
    });
    assert.equal(selected?.defense, card('shieldSnooper').id, difficulty);
  }
});
