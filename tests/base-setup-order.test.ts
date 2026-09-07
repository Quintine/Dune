import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  initializeBaseGameForAudit,
  joinGame,
  newPlayer,
  viewGame,
  type Action,
  type Game,
} from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES, type Difficulty } from '../game/bot-profiles';
import { FACTIONS, type FactionId } from '../game/catalog';
import { baseDeck } from '../game/cards';
import { location, territory } from '../game/board';
import { isAdvisor } from '../game/advisors';
import { createTechTokens } from '../game/tech-tokens';

const BASE: FactionId[] = [
  'atreides',
  'harkonnen',
  'emperor',
  'fremen',
  'guild',
  'beneGesserit',
];

function lobby(
  roster: FactionId[] = BASE,
  advanced = true,
  reverse = false,
  difficulty?: Difficulty,
): Game {
  let g = createGame(
    'BASESETUPAUDIT',
    newPlayer(roster[0], roster[0], roster[0]),
    advanced,
  );
  if (reverse)
    g = applyAction(g, roster[0], { type: 'seatPosition', position: 6 });
  for (let i = 1; i < roster.length; i++) {
    joinGame(g, newPlayer(roster[i], roster[i], roster[i]));
    const position = reverse ? 6 - i : i + 1;
    if (g.playerPositions![roster[i]] !== position)
      g = applyAction(g, roster[i], { type: 'seatPosition', position });
  }
  for (const id of roster) g = applyAction(g, id, { type: 'ready' });
  if (difficulty)
    g.players.forEach((p) => {
      p.bot = difficulty;
    });
  return g;
}
function rejectUnchanged(g: Game, player: string, action: Action) {
  const before = structuredClone(g);
  assert.throws(() => applyAction(g, player, action));
  assert.deepEqual(g, before);
}
function predict(g: Game) {
  return applyAction(g, 'beneGesserit', {
    type: 'predict',
    faction: g.players.find((p) => p.faction !== 'beneGesserit')!.faction,
    turn: 4,
  });
}
function assertTraitorInventory(g: Game) {
  const cards = [
    ...(g.traitorReserve ?? []),
    ...g.players.flatMap((p) => [...p.traitors, ...p.traitorChoices]),
  ];
  assert.equal(new Set(cards).size, cards.length);
  assert.deepEqual(
    cards.slice().sort(),
    g.players.flatMap((p) => p.leaders.map((l) => l.id)).sort(),
  );
}
function selectTraitors(state: Game) {
  let g = state;
  for (let count = 0; g.setupStage === 'traitors' && count < 6; count++) {
    assertTraitorInventory(g);
    const p = g.players.find((p) => p.traitorChoices.length);
    assert.ok(p, 'The traitor stage must have an entitled unresolved actor.');
    assert.ok(g.players.every((p) => p.hand.length === 0));
    g = applyAction(g, p.id, { type: 'traitor', leader: p.traitorChoices[0] });
  }
  assert.notEqual(g.setupStage, 'traitors');
  return g;
}
function fremenPlacement(elite = 0): Action {
  const key = location('sietch_tabr', territory('sietch_tabr').sectors[0]);
  return {
    type: 'fremenSetup',
    placements: { [key]: 10 },
    elitePlacements: { [key]: elite },
  };
}
function completeSetup(state: Game, difficulty: Difficulty, reverse = false) {
  let g = state;
  const history: string[] = [];
  for (let step = 0; g.status === 'setup' && step < 30; step++) {
    let progressed = false;
    const ids = g.players.map((p) => p.id);
    if (reverse) ids.reverse();
    for (const id of ids) {
      const view = viewGame(g, id);
      view.players.find((p) => p.id === id)!.bot = difficulty;
      for (const other of view.players.filter((p) => p.id !== id)) {
        assert.equal(other.hand, undefined);
        assert.equal(other.traitors, undefined);
        assert.equal(other.traitorChoices, undefined);
        assert.equal(other.prediction, undefined);
      }
      assert.equal('traitorReserve' in view, false);
      assert.equal('deck' in view, false);
      const beforeView = structuredClone(view);
      const actions = botActions(view);
      assert.deepEqual(
        view,
        beforeView,
        'Setup candidate generation must leave the entitled projection unchanged.',
      );
      for (const action of actions)
        assert.doesNotThrow(
          () => applyAction(g, id, action),
          `${difficulty}/${g.setupStage}/${id}: ${JSON.stringify(action)}`,
        );
      if (!actions.length) continue;
      history.push(`${g.setupStage}:${actions[0].type}`);
      g = applyAction(g, id, actions[0]);
      progressed = true;
      break;
    }
    assert.ok(
      progressed,
      `Unresolved setup stall: ${difficulty} ${g.setupStage} ${g.players.map((p) => p.faction).join(',')}`,
    );
  }
  assert.equal(g.status, 'playing');
  return { game: g, history };
}
function assertComplete(g: Game) {
  assert.equal(g.status, 'playing');
  assert.equal(g.setupStage ?? null, null);
  assert.equal(g.turn, 1);
  assert.equal(g.phase, 0);
  assert.equal(g.storm, 1);
  assert.equal(g.stormDialers.length, 2);
  assert.ok(g.stormDialers.every((id) => g.players.some((p) => p.id === id)));
  for (const p of g.players) {
    assert.equal(p.spice, FACTIONS.find((f) => f.id === p.faction)!.spice);
    assert.equal(
      p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0),
      20,
    );
    assert.equal(p.hand.length, p.faction === 'harkonnen' ? 2 : 1);
    assert.equal(p.traitors.length, p.faction === 'harkonnen' ? 4 : 1);
    assert.equal(p.traitorChoices.length, 0);
    if (g.advanced && (p.faction === 'fremen' || p.faction === 'emperor')) {
      assert.ok(p.elites);
      assert.equal(
        p.elites.reserves +
          p.elites.tanks +
          Object.values(p.elites.forces).reduce((a, b) => a + b, 0),
        p.faction === 'fremen' ? 3 : 5,
      );
      assert.ok(p.elites.reserves <= p.reserves);
      assert.ok(p.elites.tanks <= p.tanks);
      for (const [key, amount] of Object.entries(p.elites.forces))
        assert.ok(amount <= p.forces[key]);
    } else assert.equal(p.elites, undefined);
    if (p.faction === 'fremen') assert.equal(p.reserves, 10);
    if (p.faction === 'beneGesserit') {
      assert.ok(p.prediction);
      assert.equal(p.reserves, 19);
      assert.equal(
        Object.values(p.forces).reduce((a, b) => a + b, 0),
        1,
      );
      if (g.advanced) assert.equal(p.advisorSetup, true);
      else assert.deepEqual(p.forces, { 'polar_sink:0': 1 });
    }
    const own = viewGame(g, p.id).players.find((x) => x.id === p.id)!;
    assert.deepEqual(own.hand, p.hand);
    assert.deepEqual(own.traitors, p.traitors);
    for (const observer of g.players.filter((x) => x.id !== p.id)) {
      const hidden = viewGame(g, observer.id).players.find(
        (x) => x.id === p.id,
      )!;
      assert.equal(hidden.hand, undefined);
      assert.equal(hidden.traitors, undefined);
      assert.equal(hidden.traitorChoices, undefined);
      assert.equal(hidden.prediction, undefined);
    }
  }
  const cards = [...g.deck, ...g.discard, ...g.players.flatMap((p) => p.hand)];
  assert.equal(new Set(cards.map((c) => c.id)).size, cards.length);
  assert.deepEqual(
    cards.map((c) => c.id).sort(),
    baseDeck()
      .map((c) => c.id)
      .sort(),
  );
  assertTraitorInventory(g);
  const heldTraitors = g.players.flatMap((p) => p.traitors);
  assert.equal(new Set(heldTraitors).size, heldTraitors.length);
  assert.ok(
    heldTraitors.every((id) =>
      g.players.some((p) => p.leaders.some((l) => l.id === id)),
    ),
  );
}
function seeded<T>(fn: () => T): T {
  const cryptoObject = globalThis.crypto;
  const original = Object.getOwnPropertyDescriptor(
    cryptoObject,
    'getRandomValues',
  );
  let state = 20260922;
  Object.defineProperty(cryptoObject, 'getRandomValues', {
    configurable: true,
    value: (array: Uint32Array) => {
      assert.ok(array instanceof Uint32Array);
      for (let i = 0; i < array.length; i++) {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        array[i] = state;
      }
      return array;
    },
  });
  try {
    return fn();
  } finally {
    if (original)
      Object.defineProperty(cryptoObject, 'getRandomValues', original);
    else Reflect.deleteProperty(cryptoObject, 'getRandomValues');
  }
}

void test('source order locks private BG prediction before cards, traitors before placements, and treachery after every force choice in Basic and Advanced', () => {
  for (const advanced of [false, true]) {
    const initial = lobby(BASE, advanced);
    const original = structuredClone(initial);
    let g = initializeBaseGameForAudit(initial);
    assert.deepEqual(initial, original);
    assert.equal(g.status, 'setup');
    assert.equal(g.setupStage, 'prediction');
    for (const p of g.players) {
      assert.deepEqual(p.hand, []);
      assert.deepEqual(p.traitors, []);
      assert.deepEqual(p.traitorChoices, []);
      assert.deepEqual(p.forces, {});
      assert.equal(p.spice, 0);
      assert.equal(p.reserves, 20);
      const view = viewGame(g, p.id);
      assert.equal(view.setupStage, 'prediction');
      assert.deepEqual(view.setupPending, ['beneGesserit']);
      assert.equal('deck' in view, false);
      assert.equal('spiceDeck' in view, false);
      assert.deepEqual(view.players.find((x) => x.id === p.id)!.hand, []);
    }
    rejectUnchanged(g, 'atreides', {
      type: 'predict',
      faction: 'fremen',
      turn: 4,
    });
    rejectUnchanged(g, 'beneGesserit', {
      type: 'traitor',
      leader: 'atreides-0',
    });
    rejectUnchanged(g, 'fremen', fremenPlacement());
    rejectUnchanged(g, 'beneGesserit', {
      type: 'advisorSetup',
      territory: 'carthag',
      sector: 11,
    });
    g = predict(g);
    assert.equal(g.setupStage, 'traitors');
    assertTraitorInventory(g);
    assert.deepEqual(
      g.players.find((p) => p.faction === 'beneGesserit')!.prediction,
      { faction: 'atreides', turn: 4 },
    );
    assert.ok(
      g.players.every(
        (p) =>
          p.hand.length === 0 &&
          p.spice === 0 &&
          Object.keys(p.forces).length === 0,
      ),
    );
    for (const p of g.players)
      assert.equal(
        p.faction === 'harkonnen' ? p.traitors.length : p.traitorChoices.length,
        4,
      );
    for (const p of g.players) {
      const view = viewGame(g, p.id);
      const own = view.players.find((x) => x.id === p.id)!;
      assert.deepEqual(own.traitors, p.traitors);
      assert.deepEqual(own.traitorChoices, p.traitorChoices);
      for (const other of view.players.filter((x) => x.id !== p.id)) {
        assert.equal(other.traitors, undefined);
        assert.equal(other.traitorChoices, undefined);
        assert.equal(other.hand, undefined);
      }
      assert.equal('traitorReserve' in view, false);
      const bg = view.players.find((x) => x.faction === 'beneGesserit')!;
      assert.equal(!!bg.prediction, p.faction === 'beneGesserit');
    }
    rejectUnchanged(g, 'beneGesserit', {
      type: 'predict',
      faction: 'harkonnen',
      turn: 9,
    });
    rejectUnchanged(g, 'fremen', fremenPlacement());
    g = selectTraitors(g);
    assert.equal(g.setupStage, 'forces');
    assert.deepEqual(viewGame(g, 'fremen').setupPending, ['fremen']);
    assert.ok(g.players.every((p) => p.hand.length === 0));
    assert.deepEqual(g.players.find((p) => p.faction === 'atreides')!.forces, {
      'arrakeen:10': 10,
    });
    assert.deepEqual(g.players.find((p) => p.faction === 'harkonnen')!.forces, {
      'carthag:11': 10,
    });
    assert.deepEqual(g.players.find((p) => p.faction === 'guild')!.forces, {
      'tueks_sietch:5': 5,
    });
    for (const p of g.players)
      assert.equal(p.spice, FACTIONS.find((f) => f.id === p.faction)!.spice);
    rejectUnchanged(g, 'atreides', {
      type: 'traitor',
      leader: g.players[0].traitors[0],
    });
    if (advanced)
      rejectUnchanged(g, 'beneGesserit', {
        type: 'advisorSetup',
        territory: 'carthag',
        sector: 11,
      });
    g = applyAction(g, 'fremen', fremenPlacement(advanced ? 3 : 0));
    if (advanced) {
      assert.equal(g.setupStage, 'forces');
      assert.deepEqual(viewGame(g, 'beneGesserit').setupPending, [
        'beneGesserit',
      ]);
      assert.ok(g.players.every((p) => p.hand.length === 0));
      g = applyAction(g, 'beneGesserit', {
        type: 'advisorSetup',
        territory: 'carthag',
        sector: 11,
      });
      assert.equal(
        isAdvisor(
          g.players.find((p) => p.faction === 'beneGesserit')!,
          'carthag',
        ),
        true,
      );
    }
    assertComplete(g);
    rejectUnchanged(g, 'beneGesserit', {
      type: 'predict',
      faction: 'guild',
      turn: 7,
    });
    rejectUnchanged(g, 'fremen', fremenPlacement());
  }
});

void test('Fremen initial elite distributions zero through three conserve typed forces; invalid allocations leave the force stage and undealt hands intact', () => {
  for (const elite of [0, 1, 2, 3]) {
    let g = selectTraitors(
      initializeBaseGameForAudit(lobby(['fremen', 'emperor'])),
    );
    const f = g.players[0];
    assert.equal(f.elites!.reserves, 3);
    assert.equal(g.players[1].elites!.reserves, 5);
    const tabr = location('sietch_tabr', territory('sietch_tabr').sectors[0]);
    const south = location(
      'false_wall_south',
      territory('false_wall_south').sectors[0],
    );
    rejectUnchanged(g, f.id, {
      type: 'fremenSetup',
      placements: { [tabr]: 10 },
      elitePlacements: { [tabr]: 4 },
    });
    rejectUnchanged(g, f.id, {
      type: 'fremenSetup',
      placements: { [tabr]: 5, [south]: 5 },
      elitePlacements: { [tabr]: 2, [south]: 2 },
    });
    g = applyAction(g, f.id, {
      type: 'fremenSetup',
      placements: { [tabr]: 5, [south]: 5 },
      elitePlacements: {
        [tabr]: Math.min(elite, 2),
        [south]: Math.max(0, elite - 2),
      },
    });
    assertComplete(g);
    assert.equal(g.players[0].elites!.reserves, 3 - elite);
  }
});

void test('public Advanced start remains gated with forged bypass fields, while the audit seam shares corrected Basic initialization and leaves inputs unchanged', () => {
  const advanced = lobby();
  rejectUnchanged(advanced, advanced.host, { type: 'start' });
  rejectUnchanged(advanced, advanced.host, {
    type: 'start',
    audit: true,
    allowUnsupported: true,
    advanced: false,
  });
  rejectUnchanged(advanced, 'fremen', { type: 'start' });
  const basic = lobby(BASE, false);
  const before = structuredClone(basic);
  const normal = seeded(() =>
    applyAction(basic, basic.host, { type: 'start' }),
  );
  const audit = seeded(() => initializeBaseGameForAudit(basic));
  assert.deepEqual(normal, audit);
  assert.deepEqual(basic, before);
  assert.equal(audit.setupStage, 'prediction');
  for (const mutate of [
    (g: Game) => {
      g.players[0].ready = false;
    },
    (g: Game) => {
      g.players = g.players.slice(0, 1);
    },
    (g: Game) => {
      g.players.push(newPlayer('seventh', 'seventh', 'atreides'));
    },
    (g: Game) => {
      g.players[1].id = g.players[0].id;
    },
    (g: Game) => {
      g.players[1].faction = g.players[0].faction;
    },
    (g: Game) => {
      g.host = 'absent';
    },
    (g: Game) => {
      g.playerPositions![g.players[1].id] = g.playerPositions![g.players[0].id];
    },
    (g: Game) => {
      g.expansions = ['ix'];
    },
    (g: Game) => {
      g.players[1].faction = 'ixians';
    },
    (g: Game) => {
      g.techTokens = createTechTokens();
    },
    (g: Game) => {
      g.players[0].hand = [baseDeck()[0]];
    },
    (g: Game) => {
      g.players[0].spice = 1;
    },
    (g: Game) => {
      g.players[0].forces = { 'arrakeen:10': 1 };
      g.players[0].reserves = 19;
    },
  ]) {
    const malformed = structuredClone(advanced);
    mutate(malformed);
    const original = structuredClone(malformed);
    assert.throws(() => initializeBaseGameForAudit(malformed));
    assert.deepEqual(malformed, original);
  }
  const started = initializeBaseGameForAudit(advanced);
  const snapshot = structuredClone(started);
  assert.throws(() => initializeBaseGameForAudit(started));
  assert.deepEqual(started, snapshot);
});

void test('legacy no-stage setup can finish its already-dealt prediction without dealing another hand', () => {
  let g = completeSetup(
    initializeBaseGameForAudit(lobby(BASE, false)),
    'Medium',
  ).game;
  const hands = g.players.map((p) => structuredClone(p.hand));
  const deck = structuredClone(g.deck);
  g.status = 'setup';
  delete g.setupStage;
  delete g.players.find((p) => p.faction === 'beneGesserit')!.prediction;
  g = predict(g);
  assert.equal(g.status, 'playing');
  assert.deepEqual(
    g.players.map((p) => p.hand),
    hands,
  );
  assert.deepEqual(g.deck, deck);
});

void test(
  'all57base rosters complete shared Advanced setup across four profiles and both physical/actor orders with every proposed action legal',
  { timeout: 180000 },
  () => {
    let count = 0;
    for (let mask = 0; mask < 64; mask++) {
      const roster = BASE.filter((_, i) => mask & (1 << i));
      if (roster.length < 2) continue;
      for (const difficulty of DIFFICULTIES)
        for (const reverse of [false, true]) {
          const before = lobby(roster, true, reverse, difficulty);
          const original = structuredClone(before);
          const initialized = initializeBaseGameForAudit(before);
          assert.deepEqual(before, original);
          assert.equal(initialized.advanced, true);
          assert.equal(
            initialized.setupStage,
            roster.includes('beneGesserit') ? 'prediction' : 'traitors',
          );
          const completed = completeSetup(initialized, difficulty, reverse);
          assertComplete(completed.game);
          if (roster.includes('beneGesserit'))
            assert.equal(completed.history[0], 'prediction:predict');
          assert.ok(
            completed.history.every(
              (step, i) =>
                !step.startsWith('traitors:') ||
                !completed.history
                  .slice(0, i)
                  .some((previous) => previous.startsWith('forces:')),
            ),
          );
          count++;
        }
    }
    assert.equal(count, 456);
  },
);
