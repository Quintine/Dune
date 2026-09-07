import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  type Game,
} from '../game/engine';
import { baseDeck } from '../game/cards';
import { createTechTokens } from '../game/tech-tokens';
import { createAmbassadors } from '../game/ecaz-ambassadors';
import {
  createTerrorState,
  placeTerror,
  returnTerror,
} from '../game/moritani-terror';
import { createDukeVidal, acquireDuke } from '../game/duke-vidal';
import {
  quotePlacementCancellation,
  PlacementCancellationError,
} from '../game/placement-cancellation';
const player = (g: Game, id: string) => g.players.find((p) => p.id === id)!;
const json = (g: Game): Game => JSON.parse(JSON.stringify(g));
type Kind = 'ecaz' | 'terror' | 'duke';
function source(kind: Kind, advanced = true) {
  let g = createGame(
    'PLACEMENTQUOTE',
    newPlayer('o', 'Owner', kind === 'ecaz' ? 'ecaz' : 'moritani'),
    advanced,
    ['ecaz'],
  );
  g.players.push(
    newPlayer('e', 'Emperor', 'emperor'),
    newPlayer('b', 'BG', 'beneGesserit'),
  );
  Object.assign(g, {
    status: 'playing',
    phase: kind === 'ecaz' ? 4 : kind === 'terror' ? 7 : 5,
    turn: 2,
    storm: 18,
    order: ['o', 'e', 'b'],
    deck: baseDeck(),
    ready: [],
  });
  for (const p of g.players)
    Object.assign(p, {
      hand: [],
      forces: {},
      reserves: 20,
      spice: 20,
      traitors: [],
      traitorChoices: [],
    });
  function hold(id: string, name: string) {
    const at = g.deck.findIndex((c) => c.name === name);
    assert.ok(at >= 0);
    const c = g.deck.splice(at, 1)[0];
    player(g, id).hand.push(c);
    return c.id;
  }
  const printed = hold('e', 'Karama'),
    bg = hold('b', 'Baliset');
  if (kind === 'duke') {
    g.dukeVidal = acquireDuke(createDukeVidal(), 'e', 1, 'ally');
    g.active = 'e';
    g.movementRemaining = ['e'];
    for (const p of g.players.slice(0, 2))
      Object.assign(p, {
        forces: { 'arrakeen:10': 3, 'carthag:11': 3 },
        reserves: 14,
      });
    g = applyAction(g, 'e', { type: 'endMovement' });
  } else {
    if (kind === 'ecaz') g.ecazAmbassadors = createAmbassadors(() => 0);
    else g.moritaniTerror = createTerrorState(() => 0.4);
    for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
    const token =
      kind === 'ecaz'
        ? g.ecazAmbassadors!.tokens.find((t) => t.zone === 'supply')!.id
        : g.moritaniTerror!.tokens[0].id;
    g = applyAction(g, 'o', { type: 'decision', token, territory: 'arrakeen' });
  }
  assert.equal(
    g.response?.kind,
    kind === 'ecaz'
      ? 'ecazPlacement'
      : kind === 'terror'
        ? 'moritaniPlacement'
        : 'moritaniDuke',
  );
  return { g, printed, bg };
}
function allow(g: Game) {
  for (let n = 0; g.response && n < 30; n++)
    g = applyAction(
      g,
      g.players.find((p) => !g.response!.passed.includes(p.id))!.id,
      { type: 'passResponse' },
    );
  assert.equal(g.response, null);
  return g;
}
void test('all genuine Basic and Advanced placement declarations quote detached denied receipts without costs or acquisition', () => {
  for (const advanced of [false, true])
    for (const kind of ['ecaz', 'terror', 'duke'] as const) {
      const { g } = source(kind, advanced),
        before = json(g),
        q = quotePlacementCancellation(g, g.response!)!;
      assert.deepEqual(g, before);
      assert.equal(q.kind, g.response!.kind);
      if (q.kind === 'ecazPlacement') {
        assert.equal(q.suffix, 'completePhase');
        assert.equal(q.completedTurn, 2);
        assert.deepEqual(q.ambassadors.tokens, g.ecazAmbassadors!.tokens);
        assert.deepEqual(q.ambassadors.placement, {
          turn: 2,
          count: 0,
          blocked: true,
        });
        q.ambassadors.tokens[0].location = 'mutated';
        assert.deepEqual(g, before);
      } else if (q.kind === 'moritaniPlacement') {
        assert.equal(q.suffix, 'finishMoritaniPlacement');
        assert.equal(q.terror.placementTurn, 2);
        assert.deepEqual(q.terror.tokens, g.moritaniTerror!.tokens);
        q.terror.tokens[0].location = 'mutated';
        assert.deepEqual(g, before);
      } else assert.deepEqual(q, { kind: 'moritaniDuke', suffix: 'nextPhase' });
    }
});
void test('both real Karama forms commit each denial once, preserve physical inventories and restore its actual suffix', () => {
  for (const kind of ['ecaz', 'terror', 'duke'] as const)
    for (const form of ['printed', 'converted'] as const) {
      const { g, printed, bg } = source(kind),
        card = form === 'printed' ? printed : bg,
        actor = form === 'printed' ? 'e' : 'b';
      const before = json(g),
        quote = quotePlacementCancellation(g, g.response!)!;
      const done = allow(
        applyAction(g, actor, { type: 'card', card, mode: 'cancel' }),
      );
      assert.deepEqual(g, before);
      assert.equal(done.discard.filter((c) => c.id === card).length, 1);
      assert.equal(player(done, 'o').spice, 20);
      if (quote.kind === 'ecazPlacement') {
        assert.deepEqual(done.ecazAmbassadors, quote.ambassadors);
        assert.equal(done.ecazPlacementTurn, 2);
        assert.equal(done.pendingEcazPlacement, null);
        assert.equal(done.phase, 5);
        assert.deepEqual(done.movementRemaining, ['o', 'e', 'b']);
      } else if (quote.kind === 'moritaniPlacement') {
        assert.deepEqual(done.moritaniTerror, quote.terror);
        assert.equal(done.pendingMoritaniPlacement, null);
        assert.equal(done.phase, 8);
      } else {
        assert.deepEqual(done.dukeVidal, g.dukeVidal);
        assert.equal(done.phase, 6);
        assert.equal(done.dukeAcquisitionTurn, 2);
      }
    }
});
void test('denial ignores no-longer-useful placement, exhausted finances and changed Duke acquirability', () => {
  const ecaz = source('ecaz').g;
  player(ecaz, 'o').spice = 0;
  ecaz.storm = 10;
  const selected = ecaz.ecazAmbassadors!.tokens.find(
    (t) => t.id === ecaz.pendingEcazPlacement!.token,
  )!;
  selected.zone = 'placed';
  selected.location = 'arrakeen';
  assert.equal(
    quotePlacementCancellation(ecaz, ecaz.response!)?.kind,
    'ecazPlacement',
  );
  const terror = source('terror').g;
  const token = terror.moritaniTerror!.tokens.find(
    (t) => t.id === terror.pendingMoritaniPlacement!.token,
  )!;
  token.status = 'removed';
  token.location = null;
  assert.equal(
    quotePlacementCancellation(terror, terror.response!)?.kind,
    'moritaniPlacement',
  );
  const duke = source('duke').g;
  duke.dukeVidal!.leader.dead = true;
  duke.dukeVidal!.leader.deaths = 1;
  duke.dukeVidal!.leader.capturedBy = 'e';
  player(duke, 'o').forces = {};
  assert.equal(
    quotePlacementCancellation(duke, duke.response!)?.kind,
    'moritaniDuke',
  );
});
void test('Ecaz source stamps, physical identity and frozen incremental price reject corruption', () => {
  const { g } = source('ecaz');
  for (const mutate of [
    (b: Game) => {
      b.phase = 5;
    },
    (b: Game) => {
      b.pendingEcazPlacement!.turn = 1;
    },
    (b: Game) => {
      b.ecazPlacementTurn = 2;
    },
    (b: Game) => {
      b.pendingEcazPlacement!.token = 'unknown';
    },
    (b: Game) => {
      b.pendingEcazPlacement!.territory = 'polar_sink';
    },
    (b: Game) => {
      b.pendingEcazPlacement!.cost = 2;
    },
    (b: Game) => {
      b.ecazAmbassadors!.tokens[0].id = 'forged';
    },
    (b: Game) => {
      b.ecazAmbassadors!.placement = { turn: 2, count: 0, blocked: true };
    },
  ]) {
    const bad = json(g);
    mutate(bad);
    const before = structuredClone(bad);
    assert.throws(
      () => quotePlacementCancellation(bad, bad.response!),
      PlacementCancellationError,
    );
    assert.deepEqual(bad, before);
  }
});
void test('Terror hidden identity, custody and placement stamps are validated without moving or revealing tokens', () => {
  const { g } = source('terror');
  for (const mutate of [
    (b: Game) => {
      b.pendingMoritaniPlacement!.turn = 1;
    },
    (b: Game) => {
      b.moritaniTerror!.placementTurn = 2;
    },
    (b: Game) => {
      b.pendingMoritaniPlacement!.token = 'unknown';
    },
    (b: Game) => {
      b.pendingMoritaniPlacement!.territory = 'mobile_stronghold';
    },
    (b: Game) => {
      b.moritaniTerror!.tokens[1].id = b.moritaniTerror!.tokens[0].id;
    },
    (b: Game) => {
      b.moritaniTerror!.tokens[0].kind = 'bogus' as never;
    },
    (b: Game) => {
      b.moritaniTerror!.tokens[0].status = 'placed';
      b.moritaniTerror!.tokens[0].location = null;
    },
    (b: Game) => {
      b.moritaniTerror!.supplyEpoch = -1;
    },
  ]) {
    const bad = json(g);
    mutate(bad);
    const before = structuredClone(bad);
    assert.throws(
      () => quotePlacementCancellation(bad, bad.response!),
      PlacementCancellationError,
    );
    assert.deepEqual(bad, before);
  }
  const before = viewGame(g, 'e').moritaniTerror;
  const quoted = quotePlacementCancellation(g, g.response!)!;
  assert.equal(quoted.kind, 'moritaniPlacement');
  assert.deepEqual(viewGame(g, 'e').moritaniTerror, before);
  assert.ok(!JSON.stringify(before).includes('sneakAttack'));
});
void test('rotated Terror supply identifiers retain their opaque physical identity on denial', () => {
  const { g } = source('terror');
  const original = g.moritaniTerror!;
  const placed = placeTerror(original, original.tokens[0].id, 'carthag', 1);
  g.moritaniTerror = returnTerror(placed, placed.tokens[0].id, () => 0.2);
  g.pendingMoritaniPlacement!.token = g.moritaniTerror.tokens.find(
    (t) => t.status === 'available',
  )!.id;
  assert.ok(g.pendingMoritaniPlacement!.token.startsWith('terror-supply-'));
  const q = quotePlacementCancellation(g, g.response!)!;
  assert.equal(q.kind, 'moritaniPlacement');
  if (q.kind === 'moritaniPlacement') {
    assert.deepEqual(q.terror.tokens, g.moritaniTerror.tokens);
    assert.equal(q.terror.supplyEpoch, 1);
  }
});
void test('Duke source requires completed movement and one canonical shared disc without acquiring it', () => {
  const { g } = source('duke');
  for (const mutate of [
    (b: Game) => {
      b.dukeAcquisitionTurn = 1;
    },
    (b: Game) => {
      b.movementRemaining = ['o'];
    },
    (b: Game) => {
      b.dukeVidal!.leader.id = 'another-disc';
    },
    (b: Game) => {
      b.dukeVidal!.leader.strength = 5;
    },
    (b: Game) => {
      b.dukeVidal!.controller = 'absent';
    },
    (b: Game) => {
      b.dukeVidal!.source = null;
    },
    (b: Game) => {
      b.dukeVidal!.leader.deaths = -1;
    },
    (b: Game) => {
      player(b, 'e').leaders.push(structuredClone(b.dukeVidal!.leader));
    },
  ]) {
    const bad = json(g);
    mutate(bad);
    const before = structuredClone(bad);
    assert.throws(
      () => quotePlacementCancellation(bad, bad.response!),
      PlacementCancellationError,
    );
    assert.deepEqual(bad, before);
  }
});
void test('only the declared faction owns each cancellation; unrelated responses remain outside this helper', () => {
  for (const kind of ['ecaz', 'terror', 'duke'] as const) {
    const { g } = source(kind);
    assert.throws(
      () => quotePlacementCancellation(g, { ...g.response!, owner: 'e' }),
      PlacementCancellationError,
    );
    assert.throws(
      () => quotePlacementCancellation(g, { ...g.response!, owner: 'missing' }),
      PlacementCancellationError,
    );
    assert.equal(
      quotePlacementCancellation(g, { kind: 'guildIncome', owner: 'e' }),
      null,
    );
  }
});

void test('genuine placement cancellation validates its immediate movement, victory or refund suffix before either cost', () => {
  const cases: [Kind, (g: Game) => void][] = [
    [
      'ecaz',
      (g) => {
        g.order = ['o', 'o', 'b'];
      },
    ],
    [
      'terror',
      (g) => {
        player(g, 'o').ally = 'absent';
      },
    ],
    [
      'duke',
      (g) => {
        g.aid = { e: { recipient: 'o', amount: -50 } };
      },
    ],
  ];
  for (const [kind, mutate] of cases)
    for (const form of ['printed', 'converted'] as const) {
      const { g, printed, bg } = source(kind);
      mutate(g);
      const before = structuredClone(g);
      assert.throws(() =>
        applyAction(g, form === 'printed' ? 'e' : 'b', {
          type: 'card',
          card: form === 'printed' ? printed : bg,
          mode: 'cancel',
        }),
      );
      assert.deepEqual(
        g,
        before,
        `${kind}/${form} must not consume a card or commit a suffix`,
      );
    }
});
void test('already paid BG placement cancellation rejects corrupted suffix on final allowance and valid JSON resumes once', () => {
  for (const kind of ['ecaz', 'terror', 'duke'] as const) {
    const { g, bg } = source(kind);
    const paid = applyAction(g, 'b', {
      type: 'card',
      card: bg,
      mode: 'cancel',
    });
    assert.equal(paid.response?.kind, 'worthlessKarama');
    const bad = json(paid);
    if (kind === 'ecaz') bad.order = ['o', 'o', 'b'];
    if (kind === 'terror') player(bad, 'o').ally = 'absent';
    if (kind === 'duke') bad.aid = { e: { recipient: 'o', amount: -50 } };
    const before = structuredClone(bad);
    assert.throws(() => allow(bad));
    assert.deepEqual(bad, before);
    const done = allow(json(paid));
    assert.equal(done.discard.filter((c) => c.id === bg).length, 1);
    assert.equal(done.response, null);
  }
});
void test('Duke denial stops at a real CHOAM market before refunds or an Ix opening after refunds', () => {
  for (const boundary of ['choam', 'ix'] as const) {
    const { g, printed } = source('duke');
    if (boundary === 'choam') {
      g.players.push(newPlayer('c', 'CHOAM', 'choam'));
      g.order.push('c');
      g.players.at(-1)!.spice = 10;
    } else g.expansions.push('ix');
    g.aid.b = { recipient: 'o', amount: 3 };
    player(g, 'b').spice = 17;
    const done = applyAction(g, 'e', {
      type: 'card',
      card: printed,
      mode: 'cancel',
    });
    assert.deepEqual(done.dukeVidal, g.dukeVidal);
    if (boundary === 'choam') {
      assert.equal(done.phase, 5);
      assert.equal(done.decision?.kind, 'choamMarket');
      assert.equal(player(done, 'b').spice, 17);
      assert.deepEqual(done.aid, g.aid);
    } else {
      assert.equal(done.phase, 6);
      assert.deepEqual(done.phaseOpening, { passed: [], initialize: true });
      assert.equal(player(done, 'b').spice, 20);
      assert.deepEqual(done.aid, {});
      assert.equal(done.active, null);
    }
  }
});
void test('Moritani denial with CHOAM preserves Mentat opening effects and leaves victory for its actual later choice', () => {
  const { g, printed } = source('terror');
  g.players.push(newPlayer('c', 'CHOAM', 'choam'));
  g.order.push('c');
  player(g, 'o').forces = {
    'arrakeen:10': 1,
    'carthag:11': 1,
    'tueks_sietch:5': 1,
  };
  player(g, 'o').reserves = 17;
  player(g, 'o').bribes = 4;
  const done = applyAction(g, 'e', {
    type: 'card',
    card: printed,
    mode: 'cancel',
  });
  assert.equal(done.status, 'playing');
  assert.deepEqual(done.winner, []);
  assert.equal(done.phase, 8);
  assert.equal(player(done, 'o').spice, 20);
  assert.equal(player(done, 'o').bribes, 4);
  assert.deepEqual(done.moritaniTerror!.tokens, g.moritaniTerror!.tokens);
});
void test('countercanceling a BG denial restores the original placement without its blocked receipt or phase suffix', () => {
  for (const kind of ['ecaz', 'terror', 'duke'] as const) {
    const { g, printed, bg } = source(kind);
    const extra = g.deck.splice(
      g.deck.findIndex((c) => c.kind === 'worthless'),
      1,
    )[0];
    player(g, 'b').hand.push(extra);
    const paid = applyAction(g, 'b', {
      type: 'card',
      card: bg,
      mode: 'cancel',
    });
    const restored = applyAction(paid, 'e', {
      type: 'card',
      card: printed,
      mode: 'cancel',
    });
    assert.equal(restored.response?.kind, g.response!.kind);
    assert.equal(restored.phase, g.phase);
    assert.deepEqual(restored.ecazAmbassadors, g.ecazAmbassadors);
    assert.deepEqual(restored.moritaniTerror, g.moritaniTerror);
    assert.deepEqual(restored.dukeVidal, g.dukeVidal);
  }
});

void test('Duke denial uses the current no-battle board and settles shipping income, aid and collection once', () => {
  const { g, printed } = source('duke');
  player(g, 'e').forces = {};
  player(g, 'e').reserves = 20;
  g.aid.b = { recipient: 'o', amount: 3 };
  player(g, 'b').spice = 17;
  g.techTokens = createTechTokens(g.players);
  g.techTokens.heighliners = { owner: 'b', spice: 2, triggeredTurn: 2 };
  const done = applyAction(g, 'e', {
    type: 'card',
    card: printed,
    mode: 'cancel',
  });
  assert.equal(done.phase, 7);
  assert.deepEqual(done.dukeVidal, g.dukeVidal);
  assert.equal(player(done, 'b').spice, 22);
  assert.equal(player(done, 'o').spice, 24);
  assert.equal(done.techTokens!.heighliners.spice, 0);
  assert.deepEqual(done.aid, {});
  assert.equal(
    done.log.filter((l) =>
      l.text.includes('collected 2 spice from Heighliners'),
    ).length,
    1,
  );
});
