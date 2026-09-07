import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  type Game,
  type Action,
} from '../game/engine';
import { baseDeck, ixBattleCards, type Card } from '../game/cards';
import { cashInCards } from '../game/choam-karama';
import type { FactionId } from '../game/catalog';
const cards = [...baseDeck(), ...ixBattleCards()];
const card = (kind: Card['kind']) =>
  structuredClone(cards.find((c) => c.kind === kind)!);
const p = (g: Game, id: string) => g.players.find((p) => p.id === id)!;
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
/** Fixture transfers use the one physical catalog inventory. Replaced setup
 * cards return to its deck; no gameplay action or invalid snapshot is repaired. */
function setHand(g: Game, id: string, selected: Card[]) {
  const owner = p(g, id);
  const keep = new Set(selected.map((c) => c.id));
  assert.equal(keep.size, selected.length);
  const previous = new Map(owner.hand.map((c) => [c.id, c]));
  for (const held of owner.hand)
    if (!keep.has(held.id)) {
      assert.ok(!g.deck.some((c) => c.id === held.id));
      g.deck.push(held);
    }
  owner.hand = selected.map((wanted) => {
    if (previous.has(wanted.id)) return previous.get(wanted.id)!;
    assert.ok(
      !g.players.some(
        (other) =>
          other.id !== id && other.hand.some((c) => c.id === wanted.id),
      ),
    );
    const at = g.deck.findIndex((c) => c.id === wanted.id);
    assert.ok(
      at >= 0,
      `Physical fixture card ${wanted.id} must be in the deck`,
    );
    return g.deck.splice(at, 1)[0];
  });
}
function replaceCard(g: Game, id: string, index: number, replacement: Card) {
  setHand(
    g,
    id,
    p(g, id).hand.map((held, at) => (at === index ? replacement : held)),
  );
}
function fixture(loser: FactionId = 'guild', winner: FactionId = 'emperor') {
  const g = createGame('MRETAIN1', newPlayer('w', 'Winner', winner));
  g.players.push(
    newPlayer('l', 'Defeated ally', loser),
    newPlayer('m', 'Moritani', 'moritani'),
  );
  g.status = 'playing';
  g.phase = 6;
  g.turn = 2;
  g.storm = 18;
  g.order = ['w', 'l', 'm'];
  g.active = 'w';
  g.deck = structuredClone(cards);
  for (const player of g.players) {
    player.forces = player.id === 'm' ? {} : { 'arrakeen:10': 5 };
    player.reserves = player.id === 'm' ? 20 : 15;
    player.spice = 20;
    player.hand = [];
    player.traitors = [];
    for (const l of player.leaders) l.strength = 0;
  }
  p(g, 'm').ally = 'l';
  p(g, 'l').ally = 'm';
  setHand(g, 'l', [card('projectile'), card('snooper'), card('worthless')]);
  return g;
}
function allow(g: Game) {
  for (let i = 0; g.response && i < 40; i++)
    g = applyAction(
      g,
      g.players.find((p) => !g.response!.passed.includes(p.id))!.id,
      { type: 'passResponse' },
    );
  assert.equal(g.response, null);
  return g;
}
function fight(
  state = fixture(),
  opts: {
    weapon?: string | null;
    defense?: string | null;
    hero?: string;
    calls?: string[];
    tooth?: boolean;
    winnerWeapon?: string;
    winnerDefense?: string;
    winnerSupport?: number;
  } = {},
) {
  let g = allow(
    applyAction(state, 'w', {
      type: 'chooseBattle',
      territory: 'arrakeen',
      target: 'l',
    }),
  );
  for (let i = 0; g.battle?.preparation && i < 20; i++)
    g = allow(
      applyAction(g, g.battle.preparation.owner, {
        type: 'declineBattlePower',
      }),
    );
  g = applyAction(g, 'w', {
    type: 'battlePlan',
    dial: 3,
    support: opts.winnerSupport ?? 3,
    leader: p(g, 'w').leaders[0].id,
    weapon: opts.winnerWeapon,
    defense: opts.winnerDefense,
  });
  g = applyAction(g, 'l', {
    type: 'battlePlan',
    dial: 0,
    support: 0,
    leader: opts.hero ?? p(g, 'l').leaders[0].id,
    weapon: opts.weapon === undefined ? p(g, 'l').hand[0].id : opts.weapon,
    defense: opts.defense === undefined ? p(g, 'l').hand[1].id : opts.defense,
  });
  while (g.decision?.kind === 'poisonTooth')
    g = applyAction(g, g.decision.player, {
      type: 'decision',
      activate: opts.tooth ?? false,
    });
  for (const id of ['w', 'l'])
    if (g.battle)
      g = applyAction(g, id, {
        type: 'traitorCall',
        call: opts.calls?.includes(id) ?? false,
      });
  return g;
}
function cleanup(g: Game) {
  for (
    let i = 0;
    g.decision &&
    ['battleLosses', 'battleCards', 'ixSubstitution'].includes(
      g.decision.kind,
    ) &&
    i < 10;
    i++
  ) {
    const d = g.decision;
    g = applyAction(
      g,
      d.player,
      d.kind === 'battleCards'
        ? { type: 'decision', discard: [] }
        : d.kind === 'ixSubstitution'
          ? { type: 'decision', amount: 0 }
          : { type: 'decision', choice: 0 },
    );
  }
  return g;
}
function reject(g: Game, id: string, action: Action) {
  const old = structuredClone(g);
  assert.throws(() => applyAction(g, id, action));
  assert.deepEqual(g, old);
}
function counts(g: Game) {
  return g.players
    .flatMap((p) => p.hand)
    .concat(g.discard)
    .map((c) => c.id)
    .sort();
}

void test('unopposed defeated ally retains exactly one played card automatically through JSON recovery', () => {
  for (const pick of [0, 1]) {
    const before = fixture();
    const inventory = counts(before);
    let g = cleanup(fight(before));
    assert.equal(g.decision?.kind, 'moritaniRetention');
    assert.equal(g.decision?.player, 'l');
    assert.equal(p(g, 'l').tanks, 5);
    assert.equal(p(g, 'w').tanks, 3);
    const played = g.moritaniRetention!.played;
    const keep = played[pick];
    assert.equal(played.length, 2);
    assert.ok(played.every((id) => p(g, 'l').hand.some((c) => c.id === id)));
    const settled = g.players.map((p) => ({
      id: p.id,
      spice: p.spice,
      tanks: p.tanks,
    }));
    g = applyAction(reload(g), 'l', { type: 'decision', keep });
    assert.equal(
      g.response,
      null,
      'no eligible cancellation requires no pass clicks',
    );
    g = allow(reload(g));
    assert.equal(g.moritaniRetention, null);
    assert.equal(g.phase, 7);
    assert.deepEqual(
      g.players.map((p) => ({ id: p.id, spice: p.spice, tanks: p.tanks })),
      settled,
    );
    assert.deepEqual(counts(g), inventory);
    assert.ok(p(g, 'l').hand.some((c) => c.id === keep));
    assert.equal(g.discard.filter((c) => played.includes(c.id)).length, 1);
    reject(g, 'l', { type: 'decision', keep });
  }
});
void test('declining needs no Karama window and keeps unrelated hand cards untouched', () => {
  let g = cleanup(fight());
  const unplayed = p(g, 'l').hand[2].id;
  g = applyAction(g, 'l', { type: 'decision', keep: null });
  assert.equal(g.response, null);
  assert.deepEqual(
    p(g, 'l').hand.map((c) => c.id),
    [unplayed],
  );
  assert.equal(g.discard.length, 2);
});
void test('only the defeated ally may choose one eligible exact card', () => {
  const g = cleanup(fight());
  const id = g.moritaniRetention!.eligible[0];
  reject(g, 'm', { type: 'decision', keep: id });
  reject(g, 'w', { type: 'decision', keep: id });
  for (const keep of [
    undefined,
    [],
    [id],
    p(g, 'l').hand[2].id,
    'opposing-card',
  ])
    reject(g, 'l', { type: 'decision', keep });
});
void test('Karama cancels retention without reversing combat or duplicating disposal', () => {
  let g = cleanup(fight());
  const k = baseDeck().find((c) => c.effect === 'karama')!;
  setHand(g, 'w', [k]);
  const losses = g.players.map((p) => p.tanks);
  g = applyAction(g, 'l', {
    type: 'decision',
    keep: g.moritaniRetention!.eligible[0],
  });
  g = applyAction(reload(g), 'w', { type: 'card', card: k.id, mode: 'cancel' });
  assert.equal(g.moritaniRetention, null);
  assert.deepEqual(
    g.players.map((p) => p.tanks),
    losses,
  );
  assert.equal(g.discard.length, 3);
  assert.equal(p(g, 'l').hand.length, 1);
  assert.equal(g.phase, 7);
});
void test('no alliance and Moritani itself do not receive the losing-ally benefit', () => {
  const g = fixture();
  p(g, 'm').ally = null;
  p(g, 'l').ally = null;
  assert.equal(cleanup(fight(g)).moritaniRetention, undefined);
  const self = fixture('moritani');
  p(self, 'm').faction = 'guild';
  assert.equal(cleanup(fight(self)).moritaniRetention, undefined);
});
void test('a loss with no retainable played card skips the optional decision', () => {
  for (const heroOnly of [false, true]) {
    const g = fixture();
    const hero = card('hero');
    setHand(g, 'l', heroOnly ? [hero] : []);
    const out = cleanup(
      fight(g, {
        weapon: null,
        defense: null,
        ...(heroOnly ? { hero: hero.id } : {}),
      }),
    );
    assert.equal(out.moritaniRetention, undefined);
    assert.equal(out.decision, null);
    assert.equal(out.phase, 7);
    assert.equal(p(out, 'l').hand.length, 0);
    assert.equal(
      out.discard.filter((c) => c.id === hero.id).length,
      heroOnly ? 1 : 0,
    );
  }
});
void test('Cheap Hero cannot be retained but an eligible defense can', () => {
  const g = fixture();
  const hero = card('hero');
  setHand(g, 'l', [...p(g, 'l').hand, hero]);
  const out = cleanup(fight(g, { hero: hero.id }));
  assert.ok(!out.moritaniRetention!.eligible.includes(hero.id));
  const kept = allow(
    applyAction(out, 'l', {
      type: 'decision',
      keep: out.moritaniRetention!.eligible[1],
    }),
  );
  assert.equal(kept.discard.filter((c) => c.id === hero.id).length, 1);
});
void test('used Tooth and Artillery are excluded; unused Tooth remains eligible', () => {
  for (const kind of ['poisonTooth', 'artillery'] as const)
    for (const tooth of [false, true]) {
      const g = fixture();
      const special = card(kind);
      replaceCard(g, 'l', 0, special);
      const out = cleanup(fight(g, { tooth }));
      assert.equal(
        out.moritaniRetention!.eligible.includes(special.id),
        kind === 'poisonTooth' && !tooth,
      );
    }
});
void test('single traitor creates retention; mutual traitors and actual explosions do not', () => {
  const single = fixture();
  p(single, 'w').traitors = [p(single, 'l').leaders[0].id];
  assert.equal(
    cleanup(fight(single, { calls: ['w'] })).decision?.kind,
    'moritaniRetention',
  );
  const mutual = fixture();
  p(mutual, 'w').traitors = [p(mutual, 'l').leaders[0].id];
  p(mutual, 'l').traitors = [p(mutual, 'w').leaders[0].id];
  assert.equal(
    cleanup(fight(mutual, { calls: ['w', 'l'] })).moritaniRetention,
    undefined,
  );
  const boom = fixture();
  setHand(boom, 'w', [card('lasgun')]);
  replaceCard(boom, 'l', 1, card('shield'));
  assert.equal(
    cleanup(fight(boom, { winnerWeapon: p(boom, 'w').hand[0].id }))
      .moritaniRetention,
    undefined,
  );
});
void test('single traitor preempts explosion and Tooth effect-discard', () => {
  const g = fixture();
  p(g, 'w').traitors = [p(g, 'l').leaders[0].id];
  setHand(g, 'w', [card('lasgun')]);
  replaceCard(g, 'l', 1, card('shield'));
  assert.equal(
    cleanup(fight(g, { calls: ['w'], winnerWeapon: p(g, 'w').hand[0].id }))
      .decision?.kind,
    'moritaniRetention',
  );
  const tooth = fixture();
  p(tooth, 'w').traitors = [p(tooth, 'l').leaders[0].id];
  replaceCard(tooth, 'l', 0, card('poisonTooth'));
  const out = cleanup(fight(tooth, { calls: ['w'], tooth: true }));
  assert.ok(out.moritaniRetention!.eligible.includes(card('poisonTooth').id));
});
void test('reservation begins before winner casualty cleanup and blocks cash-in', () => {
  const g = fixture();
  g.advanced = true;
  p(g, 'w').elites = {
    reserves: 3,
    tanks: 0,
    forces: { 'arrakeen:10': 2 },
    revived: 0,
  };
  const out = fight(g, { winnerSupport: 1 });
  assert.equal(out.decision?.kind, 'battleLosses');
  assert.ok(
    out.decision?.kind === 'battleLosses' && out.decision.options.length > 1,
  );
  assert.equal(p(out, 'w').forces['arrakeen:10'], 5);
  assert.equal(p(out, 'w').tanks, 0);
  assert.ok(out.moritaniRetention);
  const reserved = out.moritaniRetention!.played;
  assert.ok(
    cashInCards(out, p(out, 'l')).every((c) => !reserved.includes(c.id)),
  );
  const after = cleanup(reload(out));
  assert.equal(after.decision?.kind, 'moritaniRetention');
  assert.ok(p(after, 'w').tanks > 0);
});
void test('Bene Gesserit cannot convert a reserved Worthless card during retention', () => {
  const g = fixture('beneGesserit');
  g.advanced = true;
  const w = card('worthless');
  setHand(g, 'l', [w, card('snooper')]);
  setHand(g, 'w', [baseDeck().find((c) => c.effect === 'karama')!]);
  let out = cleanup(fight(g));
  out = applyAction(out, 'l', { type: 'decision', keep: w.id });
  reject(out, 'l', { type: 'card', mode: 'cancel', card: w.id });
  assert.equal(out.moritaniRetention?.stage, 'response');
  assert.ok(p(out, 'l').hand.some((c) => c.id === w.id));
});
void test('CHOAM cannot cash in any pending played card, including during winner cleanup', () => {
  const g = fixture();
  g.advanced = true;
  let out = fight(g);
  p(out, 'l').faction = 'choam';
  const k = baseDeck().find((c) => c.effect === 'karama')!;
  setHand(out, 'l', [...p(out, 'l').hand, k]);
  reject(out, 'l', {
    type: 'card',
    mode: 'special',
    card: k.id,
    cards: [out.moritaniRetention!.played[0]],
  });
  out = cleanup(out);
  reject(out, 'l', {
    type: 'card',
    mode: 'special',
    card: k.id,
    cards: [out.moritaniRetention!.played[0]],
  });
});
void test('public retention data contains only revealed played cards and pure views do not leak unplayed hand', () => {
  const g = cleanup(fight());
  const before = structuredClone(g);
  const unplayed = p(g, 'l').hand[2].id;
  for (const id of ['w', 'm']) {
    const view = viewGame(g, id);
    assert.ok(!JSON.stringify(view.moritaniRetention).includes(unplayed));
    assert.equal(view.players.find((p) => p.id === 'l')!.hand, undefined);
  }
  assert.deepEqual(g, before);
});
void test('Harkonnen capture and Face Dancer continuations wait until retention settles', () => {
  const g = fixture('guild', 'harkonnen');
  g.advanced = true;
  g.players.push(newPlayer('t', 'Tleilaxu', 'tleilaxu'));
  g.order.push('t');
  let out = cleanup(fight(g));
  assert.equal(out.decision?.kind, 'moritaniRetention');
  assert.ok(out.pendingCapture);
  assert.ok(out.pendingFaceDance);
  out = applyAction(reload(out), 'l', { type: 'decision', keep: null });
  assert.equal(out.decision?.kind, 'captureOffer');
  out = applyAction(out, 'w', { type: 'decision', accept: false });
  assert.equal(out.decision?.kind, 'faceDance');
  out = applyAction(out, 't', { type: 'decision', reveal: false });
  assert.equal(out.phase, 7);
  assert.equal(out.pendingFaceDance, null);
});

void test('nested Worthless conversion preserves pending card custody whether conversion succeeds or is canceled', () => {
  for (const cancelConversion of [false, true]) {
    const g = fixture();
    g.advanced = true;
    g.players.push(newPlayer('b', 'Bene Gesserit', 'beneGesserit'));
    g.order.push('b');
    const worthless = baseDeck()
      .filter((c) => c.kind === 'worthless')
      .at(-1)!;
    setHand(g, 'b', [worthless]);
    const k = baseDeck().find((c) => c.effect === 'karama')!;
    setHand(g, 'w', [k]);
    let out = cleanup(fight(g));
    const keep = out.moritaniRetention!.eligible[0];
    const played = [...out.moritaniRetention!.played];
    out = applyAction(out, 'l', { type: 'decision', keep });
    out = applyAction(out, 'b', {
      type: 'card',
      card: worthless.id,
      mode: 'cancel',
    });
    assert.equal(out.response?.kind, 'worthlessKarama');
    assert.deepEqual(out.moritaniRetention!.played, played);
    if (cancelConversion) {
      out = applyAction(reload(out), 'w', {
        type: 'card',
        card: k.id,
        mode: 'cancel',
      });
      assert.equal(
        out.response,
        null,
        'exhausted nested blockers allow retention automatically',
      );
      assert.equal(out.moritaniRetention, null);
      assert.ok(p(out, 'l').hand.some((c) => c.id === keep));
    }
    out = allow(reload(out));
    assert.equal(out.moritaniRetention, null);
    assert.equal(
      p(out, 'l').hand.some((c) => c.id === keep),
      cancelConversion,
    );
    for (const id of played)
      assert.equal(
        p(out, 'l').hand.filter((c) => c.id === id).length +
          out.discard.filter((c) => c.id === id).length,
        1,
      );
  }
});

void test('retention resumes the already calculated CHOAM combat income once', () => {
  const g = fixture();
  g.advanced = true;
  g.players.push(newPlayer('c', 'CHOAM', 'choam'));
  g.order.push('c');
  let out = cleanup(fight(g));
  assert.equal(out.decision?.kind, 'moritaniRetention');
  const pending = out.pendingChoamBattleIncome;
  assert.ok(pending);
  const spice = p(out, 'c').spice;
  out = applyAction(reload(out), 'l', { type: 'decision', keep: null });
  assert.equal(
    out.response,
    null,
    'unopposed combat income settles once after retention',
  );
  out = allow(reload(out));
  assert.equal(p(out, 'c').spice, spice + pending.amount);
  assert.equal(out.pendingChoamBattleIncome, null);
});

void test('Karama responders can inspect the declared already-revealed card without receiving the remaining hand', () => {
  const initial = fixture();
  setHand(initial, 'w', [baseDeck().find((c) => c.effect === 'karama')!]);
  let g = cleanup(fight(initial));
  assert.equal(viewGame(g, 'm').moritaniRetentionCard, null);
  const keep = g.moritaniRetention!.eligible[0];
  g = applyAction(g, 'l', { type: 'decision', keep });
  for (const id of ['w', 'l', 'm'])
    assert.deepEqual(
      viewGame(g, id).moritaniRetentionCard,
      p(g, 'l').hand.find((c) => c.id === keep),
    );
  assert.equal(
    viewGame(g, 'w').players.find((p) => p.id === 'l')!.hand,
    undefined,
  );
  g = allow(g);
  assert.equal(viewGame(g, 'm').moritaniRetentionCard, null);
});
