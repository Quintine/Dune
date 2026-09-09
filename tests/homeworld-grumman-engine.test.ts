import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import {
  applyAction,
  createGame,
  newPlayer,
  normalizeAutomaticGame,
  viewGame,
  type Game,
  type Action,
} from '../game/engine';
import { baseDeck, spiceDeck } from '../game/cards';
import type { FactionId } from '../game/catalog';
import { createHomeworldCustody } from '../game/homeworld-custody';
import {
  homeworldContext,
  homeworldGameIntegrity,
} from '../game/homeworld-game';
import { createTerrorState, placeTerror } from '../game/moritani-terror';
import {
  createRicheseNoField,
  deployRicheseNoField,
} from '../game/richese-no-field';
import { createAmbassadors, placeAmbassador } from '../game/ecaz-ambassadors';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';

const player = (g: Game, id: string) => g.players.find((p) => p.id === id)!;
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
/** Explicit Moritani runtime audit setup: real card/token identities and typed
 * force custody, without claiming that the full expansion start is enabled. */
function fixture(
  reserves = 7,
  entrant: FactionId = 'emperor',
  advanced = false,
  enabled = true,
) {
  const g = createGame(
    'GRUMMANENTRY',
    newPlayer('m', 'Moritani', 'moritani'),
    advanced,
  );
  g.players.push(
    newPlayer('e', 'Entrant', entrant),
    newPlayer('a', 'Observer', 'atreides'),
  );
  Object.assign(g, {
    status: 'playing',
    phase: 5,
    turn: 2,
    storm: 18,
    active: 'e',
    order: ['e', 'm', 'a'],
    movementRemaining: ['e', 'm', 'a'],
    deck: baseDeck(),
    spiceDeck: spiceDeck(),
    phaseOpening: null,
  });
  for (const p of g.players) {
    Object.assign(p, {
      forces: {},
      reserves: 20,
      tanks: 0,
      spice: 20,
      hand: [],
      traitors: [],
      traitorChoices: [],
    });
    const special =
      p.faction === 'emperor' ? 5 : p.faction === 'fremen' ? 3 : 0;
    if (special)
      p.elites = { reserves: special, tanks: 0, forces: {}, revived: 0 };
  }
  player(g, 'm').reserves = reserves;
  player(g, 'm').forces = { 'polar_sink:0': 20 - reserves };
  g.moritaniTerror = createTerrorState(() => 0);
  const token = g.moritaniTerror.tokens.find((t) => t.kind === 'robbery')!;
  g.moritaniTerror = placeTerror(g.moritaniTerror, token.id, 'arrakeen', 1);
  if (enabled)
    g.homeworlds = { custody: createHomeworldCustody(homeworldContext(g)) };
  homeworldGameIntegrity(g);
  return g;
}
const ship = (g: Game, amount: number, elite = 0) =>
  applyAction(g, 'e', {
    type: 'ship',
    territory: 'arrakeen',
    sector: 10,
    amount,
    elite,
  });
function reject(g: Game, id: string, action: Action, match: RegExp) {
  const before = structuredClone(g);
  assert.throws(() => applyAction(g, id, action), match);
  assert.deepEqual(g, before);
}
function markerObserver(g: Game) {
  const view = viewGame(g, 'a');
  // Each independently accepted move creates a random selection fence. Its
  // identity is unrelated to the marker's hidden value; retain all other data.
  assert.ok(view.richeseNoField?.event);
  view.richeseNoField!.event = 'accepted-marker-event';
  return view;
}

void test('low Grumman skips two-force entry and permits three in both modes without consuming Terror', () => {
  for (const advanced of [false, true])
    for (const reserves of [7, 8])
      for (const amount of [2, 3]) {
        const initial = fixture(reserves, 'emperor', advanced);
        const token = initial.moritaniTerror!.tokens.find(
          (t) => t.status === 'placed',
        )!;
        const result = ship(initial, amount);
        assert.equal(!!result.pendingTerrorEntry, reserves >= 8 || amount >= 3);
        assert.equal(player(result, 'e').forces['arrakeen:10'], amount);
        assert.equal(player(result, 'e').reserves, 20 - amount);
        assert.equal(
          result.moritaniTerror!.tokens.find((t) => t.id === token.id)!.status,
          'placed',
        );
        homeworldGameIntegrity(result);
        if (result.pendingTerrorEntry) {
          assert.equal(result.pendingTerrorEntry.amount, amount);
          const declined = applyAction(reload(result), 'm', {
            type: 'decision',
            decline: true,
          });
          assert.equal(declined.pendingTerrorEntry, null);
          assert.equal(player(declined, 'e').reserves, 20 - amount);
        }
      }
});

void test('disabled Homeworlds preserve ordinary Terror on a one-force entry', () => {
  const result = ship(fixture(7, 'emperor', false, false), 1);
  assert.equal(result.pendingTerrorEntry?.amount, 1);
  assert.equal(viewGame(result, 'm').terrorEntry?.canReveal, true);
});

void test('elite counters are included once and existing destination forces do not satisfy the entry threshold', () => {
  for (const amount of [2, 3]) {
    const g = fixture(7, 'emperor', true);
    const p = player(g, 'e');
    p.elites = { reserves: 5, tanks: 0, forces: {}, revived: 0 };
    p.reserves = 15;
    p.forces = { 'arrakeen:10': 5 };
    const result = ship(g, amount, 2);
    assert.equal(!!result.pendingTerrorEntry, amount === 3);
    assert.equal(player(result, 'e').forces['arrakeen:10'], 5 + amount);
    assert.equal(player(result, 'e').elites!.forces['arrakeen:10'], 2);
    homeworldGameIntegrity(result);
  }
});

void test('Bene Gesserit advisors count as entering forces while two remain below Grumman minimum', () => {
  for (const amount of [2, 3]) {
    const g = fixture(7, 'beneGesserit', true);
    player(g, 'a').reserves--;
    player(g, 'a').forces = { 'arrakeen:10': 1 };
    player(g, 'e').reserves--;
    player(g, 'e').forces = { 'arrakeen:10': 1 };
    player(g, 'e').advisors = { arrakeen: {} };
    const result = ship(g, amount);
    assert.ok(player(result, 'e').advisors?.arrakeen);
    assert.equal(!!result.pendingTerrorEntry, amount === 3);
    homeworldGameIntegrity(result);
  }
});

void test('a saved reveal and alliance offer recheck low Grumman without mutating the committed arrival', () => {
  const g = ship(fixture(8), 2);
  player(g, 'm').reserves--;
  player(g, 'm').forces['polar_sink:0']++;
  const restored = normalizeAutomaticGame(reload(g));
  const view = viewGame(restored, 'm').terrorEntry!;
  assert.equal(view.canReveal, false);
  assert.match(view.revealBlocked!, /three forces/);
  assert.equal(view.canOfferAlliance, false);
  reject(restored, 'm', { type: 'decision', reveal: true }, /three forces/);
  reject(
    restored,
    'm',
    { type: 'decision', alliance: true },
    /mandatory effect/,
  );
  const declined = applyAction(restored, 'm', {
    type: 'decision',
    decline: true,
  });
  assert.equal(player(declined, 'e').reserves, 18);
  assert.equal(player(declined, 'e').forces['arrakeen:10'], 2);
});

void test('concealed zero, three and five No-Field shipments have the same public one-force Terror eligibility', () => {
  const views = [];
  for (const value of [0, 3, 5]) {
    const g = fixture(7, 'richese');
    g.expansions = ['choam'];
    const p = player(g, 'e');
    p.noField = createRicheseNoField(['zero', 'three', 'five']);
    p.noFieldEvent = 'same-private-event';
    const token = p.noField.tokens.find((t) => t.value === value)!;
    const result = applyAction(g, 'e', {
      type: 'ship',
      noField: token.id,
      event: p.noFieldEvent,
      territory: 'arrakeen',
      sector: 10,
    });
    assert.equal(result.pendingTerrorEntry ?? null, null);
    assert.equal(player(result, 'e').reserves, 20);
    assert.equal(player(result, 'e').noField!.deployed!.tokenId, token.id);
    assert.equal(player(result, 'e').spice, 19);
    homeworldGameIntegrity(result);
    views.push(markerObserver(result));
  }
  assert.deepEqual(views[0], views[1]);
  assert.deepEqual(views[1], views[2]);
});

void test('a moved No-Field counts once with two physical forces, independently of its hidden value', () => {
  for (const amount of [0, 1, 2]) {
    const views = [];
    for (const value of [0, 3, 5]) {
      const g = fixture(7, 'richese');
      g.expansions = ['choam'];
      const p = player(g, 'e');
      p.noField = createRicheseNoField(['zero', 'three', 'five']);
      const token = p.noField.tokens.find((t) => t.value === value)!;
      p.noField = deployRicheseNoField(p.noField, {
        tokenId: token.id,
        controller: p.id,
        location: { territory: 'imperial_basin', sector: 10 },
      });
      p.noFieldEvent = 'same-private-event';
      p.forces = { 'imperial_basin:10': 2 };
      p.reserves = 18;
      p.shipped = true;
      const result = applyAction(g, 'e', {
        type: 'move',
        forces: amount ? { 'imperial_basin:10': amount } : {},
        noField: token.id,
        event: p.noFieldEvent,
        territory: 'arrakeen',
        sector: 10,
      });
      assert.equal(!!result.pendingTerrorEntry, amount === 2);
      if (result.pendingTerrorEntry)
        assert.equal(result.pendingTerrorEntry.amount, 3);
      assert.equal(player(result, 'e').reserves, 18);
      assert.equal(player(result, 'e').noField!.deployed!.tokenId, token.id);
      homeworldGameIntegrity(result);
      views.push(markerObserver(result));
    }
    assert.deepEqual(views[0], views[1]);
    assert.deepEqual(views[1], views[2]);
  }
});

function ambassadorFixture(effect: 'guild' | 'fremen', reserves = 7) {
  let g = fixture(reserves, 'emperor', true);
  g.players[2] = newPlayer('a', 'Ecaz', 'ecaz');
  Object.assign(player(g, 'a'), {
    reserves: 16,
    forces: { 'imperial_basin:10': 4 },
    spice: 20,
    hand: [],
    traitors: [],
  });
  const bg = newPlayer('b', 'Bene Gesserit', 'beneGesserit');
  Object.assign(bg, {
    reserves: 19,
    forces: { 'carthag:11': 1 },
    hand: [],
    traitors: [],
  });
  g.players.push(bg);
  g.order.push(bg.id);
  g.moritaniTerror!.tokens.find(
    (token) => token.status === 'placed',
  )!.location = 'carthag';
  const inventory = createAmbassadors(() => 0);
  const token = inventory.tokens.find(
    (candidate) => candidate.effect === effect,
  )!;
  inventory.cohort = [
    token.id,
    ...inventory.tokens
      .filter(
        (candidate) => candidate.effect !== 'ecaz' && candidate.id !== token.id,
      )
      .slice(0, 4)
      .map((candidate) => candidate.id),
  ];
  for (const candidate of inventory.tokens) {
    candidate.zone =
      candidate.effect === 'ecaz' || inventory.cohort.includes(candidate.id)
        ? 'supply'
        : 'pool';
    candidate.location = null;
  }
  g.ecazAmbassadors = placeAmbassador(inventory, token.id, {
    turn: 1,
    availableSpice: 20,
    destination: {
      id: 'arrakeen',
      stronghold: true,
      inStorm: false,
      allowed: true,
    },
  }).state;
  player(g, 'e').reserves = 19;
  player(g, 'e').forces = { 'imperial_basin:10': 1 };
  player(g, 'e').shipped = true;
  g = applyAction(g, 'e', {
    type: 'move',
    forces: { 'imperial_basin:10': 1 },
    territory: 'arrakeen',
    sector: 10,
  });
  assert.equal(g.pendingAmbassador?.stage, 'offer');
  g = applyAction(g, 'a', {
    type: 'decision',
    event: g.pendingAmbassador!.event,
    trigger: true,
    beneficiary: 'a',
  });
  assert.equal(
    g.pendingAmbassador?.stage,
    effect === 'guild' ? 'ship' : 'move',
  );
  homeworldGameIntegrity(g);
  return g;
}

void test('Guild and Fremen Ambassador views expose the legal two-force cap and server rejects larger batches before mutation', () => {
  for (const effect of ['guild', 'fremen'] as const) {
    const g = ambassadorFixture(effect);
    const entry = viewGame(g, 'a').ambassadorEntry!;
    const destinations =
      effect === 'guild'
        ? entry.shipment!.destinations
        : entry.movement!.sources.find(
            (source) => source.territory === 'imperial_basin',
          )!.destinations;
    const destination = destinations.find(
      (candidate) => candidate.territory === 'carthag',
    )!;
    assert.equal(destination.blocked, null);
    assert.equal(destination.maximum, 2);
    const action: Action = {
      type: 'decision',
      event: entry.event,
      territory: 'carthag',
      sector: 11,
      ...(effect === 'guild'
        ? { amount: 3 }
        : { forces: { 'imperial_basin:10': 3 } }),
    };
    reject(g, 'a', action, /simultaneous Intrusion and Terror/);
    const legal = applyAction(reload(g), 'a', {
      ...action,
      ...(effect === 'guild'
        ? { amount: 2 }
        : { forces: { 'imperial_basin:10': 2 } }),
    });
    assert.equal(legal.decision?.kind, 'intrusion');
    assert.equal(legal.pendingTerrorEntry ?? null, null);
    assert.equal(player(legal, 'a').forces['carthag:11'], 2);
    homeworldGameIntegrity(legal);
    const high = viewGame(ambassadorFixture(effect, 8), 'a').ambassadorEntry!;
    const highDestinations =
      effect === 'guild'
        ? high.shipment!.destinations
        : high.movement!.sources.find(
            (source) => source.territory === 'imperial_basin',
          )!.destinations;
    assert.match(
      highDestinations.find((candidate) => candidate.territory === 'carthag')!
        .blocked!,
      /simultaneous Intrusion and Terror/,
    );
  }
});

void test('all four bots respect the projected count cap for both Ambassador routes', () => {
  for (const effect of ['guild', 'fremen'] as const)
    for (const difficulty of DIFFICULTIES) {
      const g = ambassadorFixture(effect);
      const view = viewGame(g, 'a');
      view.players.find((p) => p.id === 'a')!.bot = difficulty;
      const entry = view.ambassadorEntry!;
      if (effect === 'guild')
        entry.shipment!.destinations = entry.shipment!.destinations.filter(
          (d) => d.territory === 'carthag',
        );
      else
        for (const source of entry.movement!.sources)
          source.destinations = source.destinations.filter(
            (d) => d.territory === 'carthag',
          );
      const action = botActions(view)[0];
      assert.ok(action);
      const amount =
        effect === 'guild'
          ? action.amount
          : Object.values(action.forces as Record<string, number>).reduce(
              (sum, n) => sum + n,
              0,
            );
      assert.equal(amount, 2);
      const result = applyAction(g, 'a', action);
      assert.equal(result.decision?.kind, 'intrusion');
      assert.equal(player(result, 'a').forces['carthag:11'], 2);
    }
});

void test('movement preflight permits the low two-force Intrusion arrival and keeps unsupported three-force ordering immutable', () => {
  for (const reserves of [7, 8]) {
    const g = fixture(reserves, 'emperor', true);
    const bg = newPlayer('b', 'Bene Gesserit', 'beneGesserit');
    bg.reserves = 19;
    bg.forces = { 'arrakeen:10': 1 };
    g.players.push(bg);
    g.order.push(bg.id);
    const p = player(g, 'e');
    p.reserves = 17;
    p.forces = { 'imperial_basin:10': 3 };
    p.shipped = true;
    const move: Action = {
      type: 'move',
      forces: { 'imperial_basin:10': 2 },
      territory: 'arrakeen',
      sector: 10,
    };
    if (reserves === 7) {
      const result = applyAction(g, 'e', move);
      assert.ok(result.decision);
      assert.equal(result.pendingTerrorEntry ?? null, null);
      assert.equal(player(result, 'e').forces['arrakeen:10'], 2);
      homeworldGameIntegrity(result);
    } else reject(g, 'e', move, /Terror combined/);
    reject(
      g,
      'e',
      { ...move, forces: { 'imperial_basin:10': 3 } },
      /Terror combined/,
    );
  }
});

void test('modern Terror receipts reject altered original count, actor, location and cause before view, action or normalization', () => {
  const g = ship(fixture(8), 2);
  player(g, 'm').reserves--;
  player(g, 'm').forces['polar_sink:0']++;
  assert.equal(typeof g.pendingTerrorEntry!.entrySignature, 'string');
  const edits: ((entry: NonNullable<Game['pendingTerrorEntry']>) => void)[] = [
    (entry) => {
      entry.amount = 3;
    },
    (entry) => {
      entry.amount = -1;
    },
    (entry) => {
      entry.elite = 1;
    },
    (entry) => {
      entry.entrant = 'a';
    },
    (entry) => {
      entry.token = 'another-token';
    },
    (entry) => {
      entry.territory = 'carthag';
      entry.sector = 11;
    },
    (entry) => {
      entry.cause = 'movement';
    },
    (entry) => {
      entry.turn++;
    },
    (entry) => {
      entry.phase = 1;
    },
    (entry) => {
      entry.resume = 'wormRide';
    },
    (entry) => {
      entry.ambassadorEvent = 'fake-parent';
    },
    (entry) => {
      entry.entrySignature = 'forged';
    },
  ];
  for (const edit of edits) {
    const corrupted = reload(g);
    edit(corrupted.pendingTerrorEntry!);
    const before = structuredClone(corrupted);
    assert.throws(
      () => viewGame(corrupted, 'm'),
      /original public arrival receipt/,
    );
    assert.throws(
      () => normalizeAutomaticGame(corrupted),
      /original public arrival receipt/,
    );
    reject(
      corrupted,
      'm',
      { type: 'decision', reveal: true },
      /original public arrival receipt/,
    );
    assert.deepEqual(corrupted, before);
  }
  // Missing receipts remain the explicit older-save boundary, not fabricated
  // evidence derived from the two currently present forces.
  const legacy = reload(g);
  delete legacy.pendingTerrorEntry!.entrySignature;
  assert.equal(viewGame(legacy, 'm').terrorEntry!.canReveal, false);
  assert.equal(
    normalizeAutomaticGame(legacy).pendingTerrorEntry!.entrySignature,
    undefined,
  );
});

void test('the original Terror receipt survives alliance cancellation and rejects corruption in actual suspended discard cleanup', () => {
  const allianceSetup = fixture(8);
  const karamaIndex = allianceSetup.deck.findIndex(
    (card) => card.effect === 'karama',
  );
  assert.ok(karamaIndex >= 0);
  const karama = allianceSetup.deck.splice(karamaIndex, 1)[0];
  player(allianceSetup, 'a').hand.push(karama);
  const alliance = ship(allianceSetup, 2);
  const signature = alliance.pendingTerrorEntry!.entrySignature;
  const offered = applyAction(alliance, 'm', {
    type: 'decision',
    alliance: true,
  });
  assert.equal(offered.pendingTerrorEntry!.entrySignature, signature);
  assert.ok(
    ['allianceResponse', 'allianceReply'].includes(
      offered.pendingTerrorEntry!.stage,
    ),
  );
  assert.equal(offered.response?.kind, 'moritaniAlliance');
  const canceled = applyAction(offered, 'a', {
    type: 'card',
    card: karama.id,
    mode: 'cancel',
  });
  assert.equal(canceled.pendingTerrorEntry!.stage, 'offer');
  assert.equal(canceled.pendingTerrorEntry!.allianceBlocked, true);
  assert.equal(canceled.pendingTerrorEntry!.entrySignature, signature);
  const corruptedOffer = reload(offered);
  corruptedOffer.pendingTerrorEntry!.amount = 3;
  assert.throws(
    () => viewGame(corruptedOffer, 'e'),
    /original public arrival receipt/,
  );

  const initial = fixture(7);
  const robbery = initial.moritaniTerror!.tokens.find(
    (token) => token.status === 'placed',
  )!;
  const sabotage = initial.moritaniTerror!.tokens.find(
    (token) => token.kind === 'sabotage',
  )!;
  robbery.status = 'available';
  robbery.location = null;
  sabotage.status = 'placed';
  sabotage.location = 'arrakeen';
  player(initial, 'e').hand.push(initial.deck.shift()!);
  const arrived = ship(initial, 3);
  // Observe the production dispatcher before its public wrapper drains the
  // durable discard. Normalization and corruption checks use public exports.
  const observed: {
    applyActionInner?: (g: Game, id: string, action: Action) => Game;
  } = {};
  runInNewContext(
    ts.transpileModule(
      readFileSync(new URL('../game/engine.ts', import.meta.url), 'utf8') +
        '\nexport { applyActionInner };\n',
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      },
    ).outputText,
    {
      exports: observed,
      require: createRequire(new URL('../game/engine.ts', import.meta.url)),
      crypto,
      structuredClone,
      TextEncoder,
      JSON,
    },
  );
  const pending = reload(
    observed.applyActionInner!(arrived, 'm', {
      type: 'decision',
      reveal: true,
    }),
  );
  const continuation = pending.pendingTreacheryDiscard!.continuation;
  assert.equal(continuation.kind, 'terrorDiscard');
  if (continuation.kind !== 'terrorDiscard')
    throw Error('Missing actual Terror discard.');
  assert.equal(
    continuation.entry.entrySignature,
    arrived.pendingTerrorEntry!.entrySignature,
  );
  assert.equal(pending.pendingTerrorEntry, null);
  const completed = normalizeAutomaticGame(reload(pending));
  assert.equal(completed.pendingTreacheryDiscard, null);
  continuation.entry.amount = 2;
  const before = structuredClone(pending);
  assert.throws(
    () => viewGame(pending, 'm'),
    /original public arrival receipt/,
  );
  assert.throws(
    () => normalizeAutomaticGame(pending),
    /original public arrival receipt/,
  );
  assert.deepEqual(pending, before);
});
