import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  type Game,
  type GameView,
} from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES, type Difficulty } from '../game/bot-profiles';
import { baseDeck } from '../game/cards';
import {
  createAmbassadors,
  placeAmbassador,
  type AmbassadorEffect,
} from '../game/ecaz-ambassadors';

function fixture(effect: AmbassadorEffect = 'richese', allied = false) {
  const g = createGame('RICHAMBOTS', newPlayer('ec', 'Ecaz', 'ecaz'));
  g.players.push(
    newPlayer('in', 'Entrant', 'atreides'),
    newPlayer('al', 'Ally', 'fremen'),
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
    Object.assign(p, {
      hand: [],
      forces: {},
      reserves: 20,
      spice: 10,
      traitors: [p.leaders[0].id],
      traitorChoices: [],
    });
  if (allied) {
    g.players[0].ally = 'al';
    g.players[2].ally = 'ec';
  }
  // Construct a valid physical placement checkpoint. Every entry and trigger
  // below uses public actions; no purchase or response state is fabricated.
  const inventory = createAmbassadors(() => 0);
  const effects: AmbassadorEffect[] =
    effect === 'beneGesserit'
      ? ['beneGesserit', 'fremen', 'guild', 'tleilaxu', 'atreides']
      : ['richese', 'fremen', 'guild', 'tleilaxu', 'atreides'];
  inventory.cohort = inventory.tokens
    .filter((t) => effects.includes(t.effect))
    .map((t) => t.id);
  for (const token of inventory.tokens)
    token.zone =
      token.effect === 'ecaz' || inventory.cohort.includes(token.id)
        ? 'supply'
        : 'pool';
  g.ecazAmbassadors = placeAmbassador(
    inventory,
    inventory.tokens.find((t) => t.effect === effect)!.id,
    {
      turn: 1,
      availableSpice: 10,
      destination: {
        id: 'arrakeen',
        stronghold: true,
        inStorm: false,
        allowed: true,
      },
    },
  ).state;
  return g;
}
function enter(g: Game) {
  return applyAction(g, 'in', {
    type: 'ship',
    territory: 'arrakeen',
    sector: 10,
    amount: 1,
  });
}
function view(g: Game, level: Difficulty, id = 'ec') {
  const v = viewGame(g, id);
  v.players.find((p) => p.id === id)!.bot = level;
  return v;
}
function select(v: GameView) {
  const before = structuredClone(v);
  const actions = botActions(v);
  assert.deepEqual(v, before, 'policy does not mutate its projection');
  assert.equal(actions.length, 1);
  return actions[0];
}
function filled(g: Game, id: string) {
  const p = g.players.find((p) => p.id === id)!;
  p.hand.push(...g.deck.splice(0, 4 - p.hand.length));
}
for (const level of DIFFICULTIES) {
  void test(`${level} triggers a useful self purchase which draws immediately and charges once`, () => {
    const source = fixture();
    source.players[0].spice = 3;
    const g = enter(source),
      before = structuredClone(g);
    const a = select(view(g, level));
    assert.deepEqual(a, {
      type: 'decision',
      event: g.pendingAmbassador!.event,
      trigger: true,
      beneficiary: 'ec',
    });
    const done = applyAction(JSON.parse(JSON.stringify(g)) as Game, 'ec', a);
    assert.deepEqual(g, before);
    assert.equal(done.pendingAmbassador, null);
    assert.equal(done.players[0].spice, 0);
    assert.deepEqual(done.players[0].hand, [g.deck[0]]);
    assert.equal(done.deck.length, g.deck.length - 1);
    assert.equal(
      done.ecazAmbassadors!.tokens.find((t) => t.effect === 'richese')!.zone,
      'used',
    );
    assert.equal(done.active, 'in');
    assert.deepEqual(done.movementRemaining, g.movementRemaining);
    assert.equal(done.players[1].forces['arrakeen:10'], 1);
    assert.equal(viewGame(done, 'al').players[0].hand, undefined);
    assert.throws(() => applyAction(done, 'ec', a));
  });
  void test(`${level} leaves an unhelpful self token but offers the same public ally regardless of hidden resources`, () => {
    for (const full of [false, true]) {
      const source = fixture();
      if (full) filled(source, 'ec');
      else source.players[0].spice = 2;
      const g = enter(source);
      const a = select(view(g, level));
      assert.equal(a.decline, true);
      const done = applyAction(g, 'ec', a);
      assert.equal(
        done.ecazAmbassadors!.tokens.find((t) => t.effect === 'richese')!.zone,
        'placed',
      );
    }
    const source = fixture('richese', true);
    source.players[0].spice = 0;
    const g = enter(source);
    const poor = structuredClone(g);
    poor.players[2].spice = 0;
    const full = structuredClone(g);
    filled(full, 'al');
    for (const changed of [poor, full]) {
      assert.deepEqual(
        view(g, level),
        view(changed, level),
        'Ecaz has no ally affordability oracle',
      );
      assert.deepEqual(select(view(g, level)), select(view(changed, level)));
      assert.equal(select(view(changed, level)).beneficiary, 'al');
    }
    const done = applyAction(g, 'ec', select(view(g, level)));
    assert.equal(done.pendingAmbassador, null);
    assert.equal(done.players[2].spice, 7);
    assert.deepEqual(done.players[2].hand, [g.deck[0]]);
    const failed = [poor, full].map((state) =>
      applyAction(state, 'ec', select(view(state, level))),
    );
    for (let i = 0; i < failed.length; i++) {
      const state = [poor, full][i];
      assert.equal(failed[i].pendingAmbassador, null);
      assert.deepEqual(failed[i].players[2], state.players[2]);
      assert.deepEqual(failed[i].deck, state.deck);
      assert.equal(
        failed[i].ecazAmbassadors!.tokens.find((t) => t.effect === 'richese')!
          .zone,
        'used',
      );
    }
    assert.deepEqual(
      failed[0].log,
      failed[1].log,
      'generic failed purchase log does not reveal the cause',
    );
  });
  void test(`${level} BG copy avoids an unusable Richese effect and can resolve the only projected supported choice`, () => {
    let g = enter(fixture('beneGesserit'));
    g = applyAction(g, 'ec', {
      type: 'decision',
      event: g.pendingAmbassador!.event,
      trigger: true,
      beneficiary: 'ec',
    });
    assert.equal(g.pendingAmbassador!.stage, 'copy');
    for (const full of [false, true]) {
      const state = structuredClone(g);
      if (full) filled(state, 'ec');
      else state.players[0].spice = 2;
      const v = view(state, level);
      const a = select(v);
      assert.notEqual(a.effect, 'richese');
      assert.doesNotThrow(() => applyAction(state, 'ec', a));
    }
    // Projected-candidate contract: a smaller server-supported candidate list
    // must remain actionable. The selected effect is still genuinely legal.
    const v = view(g, level);
    v.ambassadorEntry!.copies = v.ambassadorEntry!.copies.filter(
      (c) => c.effect === 'richese',
    );
    assert.equal(v.ambassadorEntry!.copies.length, 1);
    const a = select(v);
    assert.equal(a.effect, 'richese');
    const done = applyAction(g, 'ec', a);
    assert.equal(done.pendingAmbassador, null);
    assert.equal(done.players[0].spice, 7);
    assert.equal(done.players[0].hand.length, 1);
    assert.equal(
      done.ecazAmbassadors!.tokens.find((t) => t.effect === 'beneGesserit')!
        .zone,
      'removed',
    );
    assert.equal(
      done.ecazAmbassadors!.tokens.find((t) => t.effect === 'richese')!.zone,
      'pool',
    );
  });
}
void test('nonowners receive no decision action and draw order is not a bot input', () => {
  const g = enter(fixture());
  const changed = structuredClone(g);
  changed.deck.reverse();
  for (const level of DIFFICULTIES) {
    assert.deepEqual(select(view(g, level)), select(view(changed, level)));
    for (const id of ['in', 'al'])
      assert.deepEqual(botActions(view(g, level, id)), []);
  }
});
