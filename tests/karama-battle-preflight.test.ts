import test from 'node:test';
import assert from 'node:assert/strict';
import { baseDeck, type Card } from '../game/cards';
import { applyAction, createGame, newPlayer, type Game } from '../game/engine';
import {
  KaramaBattlePreflightError,
  preflightMoritaniRetentionCancellation,
  validateBattleCleanupContext,
  type BattleCleanupContextInput,
  type MoritaniCancellationInput,
  type ResolvedBattleReceipt,
} from '../game/karama-battle-preflight';

function contextInput(): BattleCleanupContextInput {
  return {
    phase: 6,
    turn: 2,
    battlePresent: false,
    lastBattle: ['w', 'l'],
    playerIds: ['w', 'l', 'm'],
    territoryIds: ['arrakeen', 'carthag'],
    territory: 'arrakeen',
    winner: 'w',
    context: {
      event: 'actual-completed-event',
      turn: 2,
      territory: 'arrakeen',
      combatants: ['w', 'l'],
      winner: 'w',
      result: 'normal',
    },
  };
}
function cancellationInput(): MoritaniCancellationInput {
  const cards = baseDeck();
  const hand = ['projectile', 'snooper', 'worthless'].map((kind) =>
    cards.find((card) => card.kind === kind)!,
  );
  return {
    ...contextInput(),
    responseOwner: 'm',
    pending: {
      owner: 'm',
      player: 'l',
      territory: 'arrakeen',
      turn: 2,
      played: hand.slice(0, 2).map((card) => card.id),
      eligible: hand.slice(0, 2).map((card) => card.id),
      stage: 'response',
      keep: hand[0].id,
    },
    hand,
    physicalCards: cards,
  };
}
function rejectContext(change: (input: BattleCleanupContextInput) => void) {
  const input = contextInput();
  change(input);
  const before = structuredClone(input);
  assert.throws(
    () => validateBattleCleanupContext(input),
    KaramaBattlePreflightError,
  );
  assert.deepEqual(input, before);
}
function rejectCancellation(
  change: (input: MoritaniCancellationInput) => void,
) {
  const input = cancellationInput();
  change(input);
  const before = structuredClone(input);
  assert.throws(
    () => preflightMoritaniRetentionCancellation(input),
    KaramaBattlePreflightError,
  );
  assert.deepEqual(input, before);
}

void test('cleanup quotes preserve modern results with detached receipts and no mutation', () => {
  for (const result of [
    'normal',
    'traitor',
    'legacy',
    'mutualTraitors',
    'explosion',
  ] as const) {
    const input = contextInput();
    const receipt = input.context as ResolvedBattleReceipt;
    receipt.result = result;
    if (result === 'mutualTraitors' || result === 'explosion')
      input.winner = receipt.winner = null;
    const before = structuredClone(input);
    const quote = validateBattleCleanupContext(input);
    assert.deepEqual(quote, { kind: 'existing', context: input.context });
    assert.deepEqual(input, before);
    assert.equal(quote.kind, 'existing');
    if (quote.kind === 'existing') {
      quote.context.combatants.reverse();
      quote.context.event = 'changed';
    }
    assert.deepEqual(input, before);
  }
});
void test('legacy cleanup returns only a detached event-free seed and requires a winner', () => {
  for (const context of [undefined, null]) {
    const input = { ...contextInput(), context };
    const before = structuredClone(input);
    const quote = validateBattleCleanupContext(input);
    assert.deepEqual(quote, {
      kind: 'legacy',
      seed: {
        turn: 2,
        territory: 'arrakeen',
        combatants: ['w', 'l'],
        winner: 'w',
        result: 'legacy',
      },
    });
    if (quote.kind === 'legacy') {
      assert.equal('event' in quote.seed, false);
      quote.seed.combatants.push('m');
    }
    assert.deepEqual(input, before);
    input.winner = null;
    assert.throws(
      () => validateBattleCleanupContext(input),
      KaramaBattlePreflightError,
    );
  }
});
void test('cleanup rejects invalid live table, phase, territory and combatant bindings atomically', () => {
  const mutations: ((input: BattleCleanupContextInput) => void)[] = [
    (i) => {
      i.phase = 5;
    },
    (i) => {
      i.battlePresent = true;
    },
    ...[0, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1].map(
      (turn) => (i: BattleCleanupContextInput) => {
        i.turn = turn;
      },
    ),
    (i) => {
      i.lastBattle = ['w'];
    },
    (i) => {
      i.lastBattle = ['w', 'w'];
    },
    (i) => {
      i.lastBattle = ['w', 'absent'];
    },
    (i) => {
      i.playerIds = ['w', 'l', 'l'];
    },
    (i) => {
      i.territory = 'absent';
    },
    (i) => {
      i.territoryIds = [];
    },
    (i) => {
      i.winner = 'm';
    },
  ];
  for (const mutation of mutations) rejectContext(mutation);
});
void test('modern cleanup independently binds every receipt field and semantic outcome', () => {
  for (const context of [false, true, [], '', 1, {}, { event: 'x' }])
    rejectContext((i) => {
      i.context = context;
    });
  for (const [key, value] of [
    ['event', ''],
    ['event', ' '],
    ['turn', 1],
    ['territory', 'carthag'],
    ['combatants', ['l', 'w']],
    ['combatants', ['w', 'w']],
    ['combatants', ['w', 'l', 'm']],
    ['winner', 'l'],
    ['result', 'invented'],
    ['result', 'explosion'],
    ['result', 'mutualTraitors'],
  ])
    rejectContext((i) => {
      (i.context as Record<string, unknown>)[key as string] = value;
    });
  for (const result of ['normal', 'traitor', 'legacy'])
    rejectContext((i) => {
      i.winner = null;
      Object.assign(i.context as object, { winner: null, result });
    });
});
void test('canceled retention quotes every played card including the selected keep without effects', () => {
  const input = cancellationInput();
  const before = structuredClone(input);
  const quote = preflightMoritaniRetentionCancellation(input);
  assert.equal(quote.player, 'l');
  assert.deepEqual(
    quote.discardIds,
    input.hand.slice(0, 2).map((card) => card.id),
  );
  assert.equal(quote.context.kind, 'existing');
  quote.discardIds.length = 0;
  assert.deepEqual(input, before);
  const legacy = preflightMoritaniRetentionCancellation({
    ...input,
    context: undefined,
  });
  assert.equal(legacy.context.kind, 'legacy');
});
void test('raw pending retention data is rejected with the public preflight error class', () => {
  for (const pending of [
    undefined,
    null,
    false,
    true,
    1,
    '',
    [],
    {},
    { stage: 'response' },
  ])
    rejectCancellation((i) => {
      i.pending = pending;
    });
  const valid = cancellationInput().pending as Record<string, unknown>;
  for (const [key, value] of [
    ['stage', 'choose'],
    ['stage', undefined],
    ['owner', 'w'],
    ['owner', ''],
    ['player', 'm'],
    ['player', 'absent'],
    ['player', 'w'],
    ['turn', 1],
    ['territory', 'carthag'],
    ['played', []],
    ['played', 'bad'],
    ['played', [null]],
    ['played', [valid.keep, valid.keep]],
    ['eligible', []],
    ['eligible', [valid.keep, valid.keep]],
    ['eligible', ['absent']],
    ['keep', undefined],
    ['keep', 'absent'],
  ])
    rejectCancellation((i) => {
      (i.pending as Record<string, unknown>)[key as string] = value;
    });
  rejectCancellation((i) => {
    i.responseOwner = 'w';
  });
});
void test('cancellation requires each committed physical card held exactly once across live zones', () => {
  rejectCancellation((i) => {
    i.hand = i.hand.slice(1);
  });
  rejectCancellation((i) => {
    i.hand = [...i.hand, i.hand[0]];
  });
  rejectCancellation((i) => {
    i.physicalCards = [...i.physicalCards, i.hand[0]];
  });
  rejectCancellation((i) => {
    i.physicalCards = i.physicalCards.filter(
      (card) => card.id !== i.hand[0].id,
    );
  });
  rejectCancellation((i) => {
    i.physicalCards = [];
  });
  rejectCancellation((i) => {
    i.context = { ...(i.context as object), winner: 'l' };
  });
  rejectCancellation((i) => {
    i.phase = 7;
  });
  rejectCancellation((i) => {
    i.battlePresent = true;
  });
  rejectCancellation((i) => {
    i.playerIds = ['w', 'l'];
  });
});

// Real dispatcher fixture. Each selected card is transferred out of the one
// physical deck; no cloned hand cards remain in a second live zone.
function player(g: Game, id: string) {
  return g.players.find((p) => p.id === id)!;
}
function take(g: Game, id: string, predicate: (card: Card) => boolean) {
  const at = g.deck.findIndex(predicate);
  assert.ok(at >= 0);
  const card = g.deck.splice(at, 1)[0];
  player(g, id).hand.push(card);
  return card;
}
function allow(state: Game) {
  let g = state;
  for (let i = 0; g.response && i < 30; i++) {
    const next = g.players.find((p) => !g.response!.passed.includes(p.id));
    assert.ok(next);
    g = applyAction(g, next.id, { type: 'passResponse' });
  }
  assert.equal(g.response, null);
  return g;
}
function genuineRetention() {
  let g = createGame('PREFLIGHT', newPlayer('w', 'Winner', 'emperor'));
  g.players.push(
    newPlayer('l', 'Loser', 'guild'),
    newPlayer('m', 'Moritani', 'moritani'),
  );
  g.status = 'playing';
  g.phase = 6;
  g.turn = 2;
  g.storm = 18;
  g.order = ['w', 'l', 'm'];
  g.active = 'w';
  g.deck = baseDeck();
  for (const p of g.players) {
    p.forces = p.id === 'm' ? {} : { 'arrakeen:10': 5 };
    p.reserves = p.id === 'm' ? 20 : 15;
    p.spice = 20;
    p.hand = [];
    p.traitors = [];
    for (const leader of p.leaders) leader.strength = 0;
  }
  player(g, 'm').ally = 'l';
  player(g, 'l').ally = 'm';
  const weapon = take(g, 'l', (c) => c.kind === 'projectile');
  const defense = take(g, 'l', (c) => c.kind === 'snooper');
  take(g, 'l', (c) => c.kind === 'worthless');
  const karama = take(g, 'w', (c) => c.effect === 'karama');
  g = allow(
    applyAction(g, 'w', {
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
    support: 3,
    leader: player(g, 'w').leaders[0].id,
  });
  g = applyAction(g, 'l', {
    type: 'battlePlan',
    dial: 0,
    support: 0,
    leader: player(g, 'l').leaders[0].id,
    weapon: weapon.id,
    defense: defense.id,
  });
  for (const id of ['w', 'l'])
    g = applyAction(g, id, { type: 'traitorCall', call: false });
  for (
    let i = 0;
    g.decision &&
    ['battleLosses', 'battleCards'].includes(g.decision.kind) &&
    i < 10;
    i++
  )
    g = applyAction(
      g,
      g.decision.player,
      g.decision.kind === 'battleCards'
        ? { type: 'decision', discard: [] }
        : { type: 'decision', choice: 0 },
    );
  assert.equal(g.decision?.kind, 'moritaniRetention');
  g = applyAction(g, 'l', {
    type: 'decision',
    keep: g.moritaniRetention!.eligible[0],
  });
  assert.equal(g.response?.kind, 'moritaniRetention');
  assert.equal(g.moritaniRetention?.stage, 'response');
  return { g, karama };
}
void test('a genuine production retention cancellation agrees with the quote and settles once after JSON recovery', () => {
  for (const legacy of [false, true]) {
    const fixture = genuineRetention();
    const g: Game = JSON.parse(JSON.stringify(fixture.g));
    if (legacy) delete g.lastBattleContext;
    const before = structuredClone(g);
    const quote = preflightMoritaniRetentionCancellation({
      phase: g.phase,
      turn: g.turn,
      battlePresent: !!g.battle,
      lastBattle: g.lastBattle,
      playerIds: g.players.map((p) => p.id),
      territoryIds: ['arrakeen'],
      context: g.lastBattleContext,
      responseOwner: g.response!.owner,
      pending: g.moritaniRetention,
      hand: player(g, 'l').hand,
      physicalCards: [
        ...g.deck,
        ...g.discard,
        ...g.players.flatMap((p) => p.hand),
      ],
    });
    assert.equal(quote.context.kind, legacy ? 'legacy' : 'existing');
    assert.deepEqual(g, before);
    const completed = applyAction(g, 'w', {
      type: 'card',
      card: fixture.karama.id,
      mode: 'cancel',
    });
    assert.deepEqual(g, before);
    for (const id of quote.discardIds) {
      assert.equal(completed.discard.filter((c) => c.id === id).length, 1);
      assert.ok(!player(completed, 'l').hand.some((c) => c.id === id));
    }
    assert.equal(
      completed.discard.filter((c) => c.id === fixture.karama.id).length,
      1,
    );
    assert.equal(completed.phase, 7);
    assert.equal(completed.moritaniRetention, null);
    assert.deepEqual(
      completed.players.map((p) => ({ tanks: p.tanks, spice: p.spice })),
      before.players.map((p) => ({ tanks: p.tanks, spice: p.spice })),
    );
    const inventory = [
      ...completed.deck,
      ...completed.discard,
      ...completed.players.flatMap((p) => p.hand),
    ].map((c) => c.id);
    assert.equal(new Set(inventory).size, inventory.length);
    assert.equal(inventory.length, baseDeck().length);
    const snapshot = structuredClone(completed);
    assert.throws(() =>
      applyAction(completed, 'w', {
        type: 'card',
        card: fixture.karama.id,
        mode: 'cancel',
      }),
    );
    assert.deepEqual(completed, snapshot);
  }
});
