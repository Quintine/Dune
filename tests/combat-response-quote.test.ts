import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { baseDeck } from '../game/cards';
import type { FactionId } from '../game/catalog';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  type Game,
} from '../game/engine';
import {
  quoteCombatResponse,
  CombatResponseQuoteError,
  type CombatResponseInput,
  type CombatResponseKind,
} from '../game/combat-response-quote';

function fixture(): CombatResponseInput {
  return {
    status: 'playing',
    phase: 6,
    advanced: true,
    territoryIds: ['red_chasm'],
    players: [
      { id: 'f', faction: 'fremen' },
      { id: 'a', faction: 'atreides', ally: 'c' },
      { id: 'b', faction: 'beneGesserit', ally: 'f' },
      { id: 'c', faction: 'choam', ally: 'a' },
    ],
    battle: {
      attacker: 'f',
      defender: 'a',
      territory: 'red_chasm',
      revealed: false,
      plans: {},
      powerChecks: [
        { kind: 'eliteStrength', owner: 'f' },
        { kind: 'fremenSupport', owner: 'f' },
        { kind: 'kwisatz', owner: 'a' },
        { kind: 'choamBattleAid', owner: 'c' },
      ],
    },
  };
}
const next = { kind: 'next' } as const;
void test('the finite quote follows the existing declaration order without mutation or private fields', () => {
  const input = fixture(),
    before = structuredClone(input),
    q = quoteCombatResponse(input, next);
  assert.deepEqual(q.response, {
    kind: 'eliteStrength',
    owner: 'f',
    passed: [],
  });
  assert.deepEqual(q.powerChecks, [
    { kind: 'fremenSupport', owner: 'f' },
    { kind: 'kwisatz', owner: 'a' },
    { kind: 'choamBattleAid', owner: 'c' },
  ]);
  assert.deepEqual(input, before);
  q.powerChecks!.reverse();
  assert.deepEqual(input, before);
  assert.deepEqual(Object.keys(q).sort(), [
    'decision',
    'patches',
    'powerChecks',
    'response',
  ]);
});
void test('each allowed or canceled check updates only its own flag and advances exactly one response', () => {
  for (const canceled of [false, true])
    for (const kind of [
      'eliteStrength',
      'fremenSupport',
      'kwisatz',
      'choamBattleAid',
    ] as const) {
      const input = fixture(),
        checks = input.battle!.powerChecks as {
          kind: CombatResponseKind;
          owner: string;
        }[],
        index = checks.findIndex((c) => c.kind === kind),
        response = checks[index];
      input.battle!.powerChecks = checks.slice(index + 1);
      const q = quoteCombatResponse(input, {
        kind: 'response',
        response,
        canceled,
      });
      const expected =
        kind === 'eliteStrength'
          ? canceled
            ? { eliteBlocked: ['f'] }
            : {}
          : {
              [kind === 'fremenSupport'
                ? 'fremenSupportBlocked'
                : kind === 'kwisatz'
                  ? 'kwisatzBlocked'
                  : 'choamAidBlocked']: canceled,
            };
      assert.deepEqual(q.patches, expected);
      assert.equal(q.response?.kind ?? null, checks[index + 1]?.kind ?? null);
      assert.equal(q.decision, null);
    }
});
void test('Basic Ix elite checks survive, Advanced Ix checks do not; Emperor elites are unavailable against Fremen', () => {
  const input = fixture();
  input.advanced = false;
  input.players[0].faction = 'ixians';
  input.battle!.powerChecks = [{ kind: 'eliteStrength', owner: 'f' }];
  assert.equal(
    quoteCombatResponse(input, next).response?.kind,
    'eliteStrength',
  );
  input.advanced = true;
  assert.throws(() => quoteCombatResponse(input, next), /faction benefit/);
  input.players[0].faction = 'emperor';
  input.players[1].faction = 'fremen';
  assert.throws(() => quoteCombatResponse(input, next), /faction benefit/);
});
void test('declared checks require no current elite count, unlocked KH token or CHOAM payer funds', () => {
  const input = fixture();
  // No force, tank, KH or spice data is supplied to this finite successor.
  input.battle!.powerChecks = [
    { kind: 'kwisatz', owner: 'a' },
    { kind: 'choamBattleAid', owner: 'c' },
  ];
  assert.equal(quoteCombatResponse(input, next).response?.kind, 'kwisatz');
  input.players[1].ally = undefined;
  assert.throws(() => quoteCombatResponse(input, next), /faction benefit/);
});
void test('empty and legacy absent queues preserve their distinct shapes', () => {
  const input = fixture();
  delete input.battle!.powerChecks;
  assert.equal(quoteCombatResponse(input, next).powerChecks, undefined);
  assert.equal(quoteCombatResponse(input, next).response, null);
  input.battle!.powerChecks = [];
  assert.deepEqual(quoteCombatResponse(input, next).powerChecks, []);
});
void test('malformed battle, flags, foreign kinds and repeated/reversed queue owners reject atomically', () => {
  const mutations: ((g: CombatResponseInput) => void)[] = [
    (g) => {
      g.phase = 5;
    },
    (g) => {
      g.battle = null;
    },
    (g) => {
      g.battle!.revealed = true;
    },
    (g) => {
      g.battle!.territory = 'unknown';
    },
    (g) => {
      g.battle!.territory = 'hidden_mobile_stronghold';
    },
    (g) => {
      g.battle!.defender = 'f';
    },
    (g) => {
      g.battle!.plans = [];
    },
    (g) => {
      g.battle!.plans = { outsider: {} };
    },
    (g) => {
      g.battle!.powerChecks = {};
    },
    (g) => {
      g.battle!.powerChecks = [{ kind: 'advisor', owner: 'b' }];
    },
    (g) => {
      g.battle!.powerChecks = [{ kind: 'kwisatz', owner: 'f' }];
    },
    (g) => {
      g.battle!.powerChecks = [
        { kind: 'eliteStrength', owner: 'f' },
        { kind: 'eliteStrength', owner: 'f' },
      ];
    },
    (g) => {
      g.battle!.powerChecks = [
        { kind: 'kwisatz', owner: 'a' },
        { kind: 'fremenSupport', owner: 'f' },
      ];
    },
    (g) => {
      g.battle!.eliteBlocked = ['outsider'];
    },
    (g) => {
      g.battle!.eliteBlocked = ['f', 'f'];
    },
    (g) => {
      g.battle!.kwisatzBlocked = 'yes';
    },
  ];
  for (const mutate of mutations) {
    const input = fixture();
    mutate(input);
    const before = structuredClone(input);
    assert.throws(
      () => quoteCombatResponse(input, next),
      CombatResponseQuoteError,
    );
    assert.deepEqual(input, before);
  }
  const input = fixture();
  assert.throws(
    () =>
      quoteCombatResponse(input, {
        kind: 'response',
        response: { kind: 'kwisatz', owner: 'a' },
        canceled: true,
      }),
    /precede/,
  );
});
void test('finishing preparation offers any seated eligible Advanced Atreides once, including an unrelated spectator', () => {
  const input = fixture();
  input.players[1].faction = 'guild';
  input.players = [...input.players, { id: 'spectator', faction: 'atreides' }];
  input.battle!.powerChecks = [];
  assert.deepEqual(
    quoteCombatResponse(input, { kind: 'finishPreparation' }).decision,
    { kind: 'fullPlanOffer', player: 'spectator' },
  );
  input.battle!.fullPlanOffered = true;
  assert.equal(
    quoteCombatResponse(input, { kind: 'finishPreparation' }).decision,
    null,
  );
  input.battle!.fullPlanOffered = false;
  input.players.at(-1)!.specialKaramaUsed = true;
  assert.equal(
    quoteCombatResponse(input, { kind: 'finishPreparation' }).decision,
    null,
  );
  input.players.at(-1)!.specialKaramaUsed = false;
  input.battle!.plans = { f: { dial: 0 } };
  assert.equal(
    quoteCombatResponse(input, { kind: 'finishPreparation' }).decision,
    null,
  );
});
void test('Voice cancellation preserves already advanced allied Prescience preparation and all plan values', () => {
  const input = fixture();
  input.battle!.powerChecks = [];
  input.battle!.voice = { target: 'a', kind: 'poison', must: false };
  input.battle!.preparation = {
    kind: 'prescience',
    owner: 'a',
    beneficiary: 'a',
  };
  input.battle!.plans = { f: { dial: 2, weapon: 'private-weapon' } };
  const before = structuredClone(input);
  const q = quoteCombatResponse(input, {
    kind: 'response',
    response: { kind: 'voice', owner: 'b' },
    canceled: true,
  });
  assert.deepEqual(q.patches, { deleteVoice: true });
  assert.equal(q.decision, null);
  assert.deepEqual(input, before);
  assert.ok(!JSON.stringify(q).includes('private-weapon'));
  input.battle!.preparation = {
    kind: 'prescienceAnswer',
    owner: 'a',
    beneficiary: 'a',
  };
  assert.throws(
    () =>
      quoteCombatResponse(input, {
        kind: 'response',
        response: { kind: 'voice', owner: 'b' },
        canceled: true,
      }),
    /remaining Prescience/,
  );
  delete input.battle!.preparation;
  assert.deepEqual(
    quoteCombatResponse(input, {
      kind: 'response',
      response: { kind: 'voice', owner: 'b' },
      canceled: true,
    }).patches,
    { deleteVoice: true },
  );
});
void test('allied Prescience cancellation removes the answer restriction and finishes preparation without exposing its value', () => {
  const input = fixture();
  input.players[1].faction = 'guild';
  input.players = [
    ...input.players,
    { id: 'provider', faction: 'atreides', ally: 'a' },
  ];
  input.battle!.powerChecks = [];
  input.battle!.prescience = {
    player: 'a',
    field: 'weapon',
    value: 'private-weapon',
  };
  input.battle!.preparation = {
    kind: 'prescienceAnswer',
    owner: 'f',
    beneficiary: 'a',
  };
  const op = {
    kind: 'response',
    response: { kind: 'prescience', owner: 'provider' },
    canceled: true,
  } as const;
  const q = quoteCombatResponse(input, op);
  assert.deepEqual(q.patches, {
    deletePrescience: true,
    deletePreparation: true,
    fullPlanOffered: true,
  });
  assert.deepEqual(q.decision, { kind: 'fullPlanOffer', player: 'provider' });
  assert.ok(!JSON.stringify(q).includes('private-weapon'));
  input.battle!.prescience = { player: 'f', field: 'weapon' };
  assert.throws(() => quoteCombatResponse(input, op), /beneficiary/);
});

// Observes only unchanged internal validation; no production test seam.
const observed = {} as {
  validateKaramaUse: (
    g: Game,
    p: Game['players'][number],
    use: { kind: 'cancel'; response: NonNullable<Game['response']> },
    card: Game['deck'][number],
  ) => void;
};
const engineURL = new URL('../game/engine.ts', import.meta.url);
runInNewContext(
  ts.transpileModule(
    readFileSync(engineURL, 'utf8') + '\nexport {validateKaramaUse};',
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText,
  {
    exports: observed,
    require: createRequire(engineURL),
    crypto: webcrypto,
    structuredClone,
    TextEncoder,
    JSON,
  },
);
function actual(
  factions: FactionId[] = [
    'fremen',
    'atreides',
    'beneGesserit',
    'choam',
    'guild',
  ],
  advanced = true,
) {
  const ids = ['f', 'a', 'b', 'c', 'g'];
  let g = createGame(
    'COMBATQUOTE',
    newPlayer(ids[0], ids[0], factions[0]),
    advanced,
    ['ix', 'choam'],
  );
  for (let i = 1; i < factions.length; i++)
    g.players.push(newPlayer(ids[i], ids[i], factions[i]));
  Object.assign(g, {
    status: 'playing',
    phase: 6,
    turn: 2,
    storm: 18,
    active: 'f',
    order: g.players.map((p) => p.id),
    deck: baseDeck(),
    discard: [],
    response: null,
    decision: null,
    phaseOpening: null,
  });
  for (const p of g.players) {
    p.hand = [];
    p.spice = 10;
    p.traitors = [];
    p.forces = ['f', 'a'].includes(p.id) ? { 'red_chasm:7': 3 } : {};
    p.reserves = ['f', 'a'].includes(p.id) ? 17 : 20;
    if (['fremen', 'emperor', 'ixians'].includes(p.faction))
      p.elites = {
        reserves: 2,
        tanks: 0,
        forces: p.id === 'f' ? { 'red_chasm:7': 1 } : {},
        revived: 0,
      };
  }
  const give = (id: string, effect: string) => {
    const at = g.deck.findIndex((c) =>
      effect === 'worthless' ? c.kind === 'worthless' : c.effect === effect,
    );
    assert.ok(at >= 0);
    const card = g.deck.splice(at, 1)[0];
    g.players.find((p) => p.id === id)!.hand.push(card);
    return card;
  };
  const printed = give('g', 'karama'),
    bg = give('b', 'worthless');
  g.players[2].ally = 'f';
  if (factions[3] === 'choam') {
    g.players[1].ally = 'c';
    g.players[3].ally = 'a';
  }
  g = applyAction(g, 'f', {
    type: 'chooseBattle',
    territory: 'red_chasm',
    target: 'a',
  });
  if (g.decision?.kind === 'choamBattleFunding')
    g = applyAction(g, 'c', { type: 'decision', amount: 0 });
  return { g, printed, bg };
}
function passOne(state: Game) {
  let g = state;
  const original = g.response!.kind;
  for (let i = 0; g.response?.kind === original && i < 20; i++) {
    const p = g.players.find((p) => !g.response!.passed.includes(p.id));
    assert.ok(p);
    g = applyAction(g, p.id, { type: 'passResponse' });
  }
  return g;
}
function toCheck(state: Game, kind: CombatResponseKind) {
  let g = state;
  for (let i = 0; g.response && g.response.kind !== kind && i < 10; i++)
    g = passOne(g);
  assert.equal(g.response?.kind, kind);
  return g;
}
for (const form of ['printed', 'bg'] as const) {
  void test(`genuine ${form} declarations cancel every combat check with one physical cost and keep the next declaration order`, () => {
    for (const kind of [
      'eliteStrength',
      'fremenSupport',
      'kwisatz',
      'choamBattleAid',
    ] as const) {
      const f = actual();
      let g = toCheck(f.g, kind);
      const actor = form === 'printed' ? 'g' : 'b',
        card = f[form],
        before = structuredClone(g);
      g = applyAction(g, actor, {
        type: 'card',
        card: card.id,
        mode: 'cancel',
      });
      assert.deepEqual(before, toCheck(f.g, kind));
      if (form === 'bg') {
        assert.equal(g.response?.kind, 'worthlessKarama');
        g = passOne(JSON.parse(JSON.stringify(g)) as Game);
      }
      assert.equal(g.discard.filter((c) => c.id === card.id).length, 1);
      const flags = {
        eliteStrength: g.battle!.eliteBlocked?.includes('f'),
        fremenSupport: g.battle!.fremenSupportBlocked,
        kwisatz: g.battle!.kwisatzBlocked,
        choamBattleAid: g.battle!.choamAidBlocked,
      };
      assert.equal(flags[kind], true);
      assert.equal(g.battle!.revealed, false);
      for (const p of g.players)
        assert.equal(viewGame(g, p.id).battle!.revealed, false);
    }
  });
  void test(`genuine ${form} cancellation rejects malformed source and next checks before cost, RNG or event creation`, (t) => {
    const f = actual(),
      actor = form === 'printed' ? 'g' : 'b',
      card = f[form];
    const random = t.mock.method(crypto, 'getRandomValues', () => {
        throw Error('No random draw');
      }),
      uuid = t.mock.method(crypto, 'randomUUID', () => {
        throw Error('No event');
      });
    const mutations: ((g: Game) => void)[] = [
      (g) => {
        g.response!.owner = 'g';
      },
      (g) => {
        g.battle!.powerChecks![0] = { kind: 'eliteStrength', owner: 'g' };
      },
      (g) => {
        g.battle!.powerChecks![0] = { kind: 'advisor', owner: 'b' } as never;
      },
      (g) => {
        g.battle!.powerChecks!.reverse();
      },
      (g) => {
        g.battle!.territory = 'unknown';
      },
      (g) => {
        g.battle!.territory = 'hidden_mobile_stronghold';
      },
      (g) => {
        g.battle!.plans = { outsider: {} } as never;
      },
    ];
    for (const mutate of mutations) {
      const bad = structuredClone(f.g);
      mutate(bad);
      const before = structuredClone(bad);
      assert.throws(() =>
        observed.validateKaramaUse(
          bad,
          bad.players.find((p) => p.id === actor)!,
          { kind: 'cancel', response: bad.response! },
          card,
        ),
      );
      assert.throws(() =>
        applyAction(bad, actor, {
          type: 'card',
          card: card.id,
          mode: 'cancel',
        }),
      );
      assert.deepEqual(bad, before);
      assert.equal(
        bad.discard.some((c) => c.id === card.id),
        false,
      );
    }
    assert.equal(random.mock.callCount(), 0);
    assert.equal(uuid.mock.callCount(), 0);
  });
}
function allowAll(state: Game) {
  let g = state;
  for (let i = 0; g.response && i < 20; i++) g = passOne(g);
  assert.equal(g.response, null);
  return g;
}
void test('an actual printed Voice cancellation preserves the already advanced Prescience decision and can continue to legal plans', () => {
  const f = actual();
  let g = allowAll(f.g);
  assert.equal(g.battle!.preparation?.kind, 'voice');
  g = applyAction(g, 'b', { type: 'voice', kind: 'poison', must: false });
  assert.equal(g.response?.kind, 'voice');
  assert.equal(g.battle!.preparation?.kind, 'prescience');
  const preparation = structuredClone(g.battle!.preparation);
  const corruptPreparation = structuredClone(g);
  corruptPreparation.battle!.preparation!.kind = 'voice';
  const corruptBefore = structuredClone(corruptPreparation);
  assert.throws(
    () =>
      applyAction(corruptPreparation, 'g', {
        type: 'card',
        card: f.printed.id,
        mode: 'cancel',
      }),
    /remaining Prescience/,
  );
  assert.deepEqual(corruptPreparation, corruptBefore);
  const bad = structuredClone(g);
  bad.battle!.voice!.target = 'f';
  assert.throws(
    () =>
      applyAction(bad, 'g', {
        type: 'card',
        card: f.printed.id,
        mode: 'cancel',
      }),
    /Voice/,
  );
  g = applyAction(g, 'g', { type: 'card', card: f.printed.id, mode: 'cancel' });
  assert.equal(g.battle!.voice, undefined);
  assert.deepEqual(g.battle!.preparation, preparation);
  g = applyAction(g, 'a', { type: 'declineBattlePower' });
  assert.equal(g.decision?.kind, 'fullPlanOffer');
  g = applyAction(g, 'a', { type: 'decision', decline: true });
  g = applyAction(g, 'f', {
    type: 'battlePlan',
    leader: g.players[0].leaders[0].id,
    dial: 0,
    support: 0,
  });
  assert.equal(g.battle!.plans.f.dial, 0);
  assert.equal(g.discard.filter((c) => c.id === f.printed.id).length, 1);
});
for (const form of ['printed', 'bg'] as const)
  void test(`actual ${form} Prescience cancellation clears its unanswered element and opens the existing full-plan offer once`, () => {
    const f = actual();
    let g = allowAll(f.g);
    g = applyAction(g, 'b', { type: 'declineBattlePower' });
    g = applyAction(g, 'a', { type: 'prescience', field: 'weapon' });
    assert.equal(g.response?.kind, 'prescience');
    const actor = form === 'printed' ? 'g' : 'b',
      card = f[form];
    const bad = structuredClone(g);
    bad.battle!.preparation!.owner = 'a';
    const before = structuredClone(bad);
    assert.throws(
      () =>
        applyAction(bad, actor, {
          type: 'card',
          card: card.id,
          mode: 'cancel',
        }),
      /answer/,
    );
    assert.deepEqual(bad, before);
    g = applyAction(g, actor, { type: 'card', card: card.id, mode: 'cancel' });
    if (form === 'bg') g = passOne(JSON.parse(JSON.stringify(g)) as Game);
    assert.equal(g.battle!.prescience, undefined);
    assert.equal(g.battle!.preparation, undefined);
    assert.equal(g.battle!.fullPlanOffered, true);
    assert.deepEqual(g.decision, { kind: 'fullPlanOffer', player: 'a' });
    assert.equal(g.discard.filter((c) => c.id === card.id).length, 1);
    for (const viewer of ['f', 'a', 'c', 'g'])
      if (viewer !== actor)
        assert.equal(
          viewGame(g, viewer).players.find((p) => p.id === actor)!.hand,
          undefined,
        );
  });
void test('a genuine Basic Ix elite cancellation uses the same finite successor and retains its physical cyborg', () => {
  const f = actual(
    ['ixians', 'emperor', 'beneGesserit', 'harkonnen', 'guild'],
    false,
  );
  assert.equal(f.g.response?.kind, 'eliteStrength');
  const before = structuredClone(f.g.players[0].elites);
  const g = applyAction(f.g, 'g', {
    type: 'card',
    card: f.printed.id,
    mode: 'cancel',
  });
  assert.deepEqual(g.battle!.eliteBlocked, ['f']);
  assert.deepEqual(g.players[0].elites, before);
  assert.equal(g.response, null);
  assert.equal(g.decision, null);
});
