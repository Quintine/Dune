import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  initializeBaseGameForAudit,
  initializeHomeworldGameForAudit,
  joinGame,
  newPlayer,
  normalizeAutomaticGame,
  viewGame,
  type Action,
  type Game,
} from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES, type Difficulty } from '../game/bot-profiles';
import { FACTIONS, type FactionId } from '../game/catalog';
import { location, territory, MOBILE_STRONGHOLD } from '../game/board';

const BASE: FactionId[] = [
  'atreides',
  'harkonnen',
  'emperor',
  'fremen',
  'guild',
  'beneGesserit',
];
const EXPANSION: FactionId[] = [
  'ixians',
  'tleilaxu',
  'emperor',
  'fremen',
  'guild',
  'beneGesserit',
];
const sum = (counts: Record<string, number>) =>
  Object.values(counts).reduce((a, b) => a + b, 0);
const player = (g: Game, id: string) => g.players.find((p) => p.id === id)!;

function lobby(roster: FactionId[] = BASE, advanced = true, enabled = true) {
  const expansions = [
    ...new Set(
      roster.map((id) => FACTIONS.find((f) => f.id === id)!.expansion),
    ),
  ].filter((id) => id !== 'base');
  let g = createGame(
    'HOMEWORLDSETUP',
    newPlayer(roster[0], roster[0], roster[0]),
    advanced,
    expansions,
  );
  for (const id of roster.slice(1)) joinGame(g, newPlayer(id, id, id));
  if (enabled)
    g = applyAction(g, g.host, { type: 'homeworlds', enabled: true });
  for (const id of roster) g = applyAction(g, id, { type: 'ready' });
  return g;
}
function rejectUnchanged(g: Game, id: string, action: Action) {
  const before = structuredClone(g);
  assert.throws(() => applyAction(g, id, action));
  assert.deepEqual(g, before);
}
function assertPrivateViews(g: Game) {
  const first = viewGame(g, g.players[0].id).homeworlds;
  for (const p of g.players) {
    const view = viewGame(g, p.id);
    assert.deepEqual(
      view.homeworlds,
      first,
      'Physical Homeworld counts are public for every seat.',
    );
    assert.equal('deck' in view, false);
    assert.equal('traitorReserve' in view, false);
    for (const other of view.players.filter((other) => other.id !== p.id)) {
      assert.equal(other.hand, undefined);
      assert.equal(other.traitors, undefined);
      assert.equal(other.traitorChoices, undefined);
      assert.equal(other.prediction, undefined);
    }
  }
}
function assertBeforeForces(g: Game) {
  assert.ok(g.setupStage === 'prediction' || g.setupStage === 'traitors');
  assert.equal(g.homeworlds!.custody, null);
  assert.deepEqual(viewGame(g, g.host).homeworlds, { worlds: null });
  for (const p of g.players) {
    assert.equal(p.reserves, 20);
    assert.equal(p.spice, 0);
    assert.deepEqual(p.forces, {});
    assert.deepEqual(p.hand, []);
  }
  assertPrivateViews(g);
}
function toForces(state: Game) {
  let g = state;
  if (g.setupStage === 'prediction') {
    assertBeforeForces(g);
    g = applyAction(g, 'beneGesserit', {
      type: 'predict',
      faction: g.players.find((p) => p.faction !== 'beneGesserit')!.faction,
      turn: 4,
    });
  }
  for (let i = 0; g.setupStage === 'traitors' && i < 6; i++) {
    assertBeforeForces(g);
    const p = g.players.find((p) => p.traitorChoices.length)!;
    assert.ok(p);
    g = applyAction(g, p.id, { type: 'traitor', leader: p.traitorChoices[0] });
  }
  assert.notEqual(g.setupStage, 'traitors');
  assert.ok(g.homeworlds!.custody);
  return g;
}
function fremenPlacement(elite: number): Action {
  const key = location('sietch_tabr', territory('sietch_tabr').sectors[0]);
  return {
    type: 'fremenSetup',
    placements: { [key]: 10 },
    elitePlacements: { [key]: elite },
  };
}
function finishSetup(state: Game, difficulty: Difficulty = 'Easy') {
  let g = state;
  const actions: string[] = [];
  for (let step = 0; g.status === 'setup' && step < 40; step++) {
    assertPrivateViews(g);
    let progressed = false;
    for (const p of g.players) {
      const view = viewGame(g, p.id);
      view.players.find((owner) => owner.id === p.id)!.bot = difficulty;
      const before = structuredClone(view);
      const candidates = botActions(view);
      assert.deepEqual(view, before);
      if (!candidates.length) continue;
      for (const candidate of candidates)
        assert.doesNotThrow(
          () => applyAction(g, p.id, candidate),
          `${difficulty}/${p.id}/${JSON.stringify(candidate)}`,
        );
      actions.push(`${g.decision?.kind ?? g.setupStage}:${candidates[0].type}`);
      g = applyAction(g, p.id, candidates[0]);
      g = JSON.parse(JSON.stringify(g)) as Game;
      progressed = true;
      break;
    }
    assert.ok(
      progressed,
      `Setup stalled at ${g.setupStage}/${g.decision?.kind}`,
    );
  }
  assert.equal(g.status, 'playing');
  assert.equal(g.phase, 0);
  assert.equal(g.turn, 1);
  assert.equal(g.setupStage, undefined);
  return { game: g, actions };
}
function assertInventory(g: Game) {
  const worlds = viewGame(g, g.host).homeworlds!.worlds!;
  assert.equal(
    worlds.length,
    g.players.length +
      Number(g.advanced && g.players.some((p) => p.faction === 'emperor')),
  );
  for (const p of g.players) {
    assert.equal(
      p.reserves + p.tanks + sum(p.forces),
      20,
      `${p.faction} physical counters`,
    );
    const expected =
      p.faction === 'ixians'
        ? 7
        : p.faction === 'emperor'
          ? 5
          : p.faction === 'fremen'
            ? 3
            : 0;
    if (expected) {
      assert.ok(p.elites);
      assert.equal(
        p.elites.reserves + p.elites.tanks + sum(p.elites.forces),
        expected,
        `${p.faction} typed counters`,
      );
    } else assert.equal(p.elites, undefined);
    const own = worlds.filter((w) => w.native === p.id);
    assert.equal(
      own.reduce((n, w) => n + w.forces[p.id].normal + w.forces[p.id].elite, 0),
      p.reserves,
    );
    assert.equal(
      own.reduce((n, w) => n + w.forces[p.id].elite, 0),
      p.elites?.reserves ?? 0,
    );
    assert.ok(own.every((w) => Object.keys(w.forces).length === 1));
  }
  assertPrivateViews(g);
}
function assertCardCustody(g: Game) {
  const physical = [
    ...g.deck,
    ...g.discard,
    ...g.players.flatMap((p) => p.hand),
    ...(g.richeseCache ?? []),
  ];
  assert.equal(new Set(physical.map((card) => card.id)).size, physical.length);
  assert.equal(g.ixSetupCards ?? null, null);
}

void test('Homeworld lobby choice belongs to the host, resets readiness, and preserves both public start gates', () => {
  let g = lobby(['atreides', 'emperor'], false, false);
  rejectUnchanged(g, 'emperor', { type: 'homeworlds', enabled: true });
  rejectUnchanged(g, g.host, { type: 'homeworlds', enabled: 1 });
  g = applyAction(g, g.host, { type: 'homeworlds', enabled: true });
  assert.deepEqual(g.homeworlds, { custody: null });
  assert.ok(g.players.every((p) => !p.ready));
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  rejectUnchanged(g, g.host, { type: 'start' });
  const before = structuredClone(g);
  assert.throws(() => initializeBaseGameForAudit(g));
  assert.deepEqual(g, before);
  g = applyAction(g, g.host, { type: 'homeworlds', enabled: false });
  assert.equal(g.homeworlds, null);
  assert.ok(g.players.every((p) => !p.ready));
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  assert.equal(initializeBaseGameForAudit(g).status, 'setup');
});

void test('Homeworld setup waits for private prediction and every traitor before creating native custody', () => {
  const ready = lobby();
  const before = structuredClone(ready);
  let g = initializeHomeworldGameForAudit(ready);
  assert.deepEqual(ready, before);
  assert.equal(g.setupStage, 'prediction');
  assertBeforeForces(g);
  rejectUnchanged(g, 'fremen', fremenPlacement(3));
  g = toForces(g);
  assert.equal(g.setupStage, 'forces');
  assert.ok(g.players.every((p) => p.hand.length === 0));
  assert.deepEqual(player(g, 'beneGesserit').prediction, {
    faction: 'atreides',
    turn: 4,
  });
  assertInventory(g);
  rejectUnchanged(g, 'beneGesserit', {
    type: 'predict',
    faction: 'emperor',
    turn: 1,
  });
});

void test('the eight supported base and Ix faction setup paths conserve native and special counters in both modes at all four bot levels', () => {
  for (const advanced of [false, true])
    for (const roster of [BASE, EXPANSION])
      for (const difficulty of DIFFICULTIES) {
        const { game: g, actions } = finishSetup(
          initializeHomeworldGameForAudit(lobby(roster, advanced)),
          difficulty,
        );
        assertInventory(g);
        assertCardCustody(g);
        for (const p of g.players) {
          assert.equal(
            p.spice,
            FACTIONS.find((f) => f.id === p.faction)!.spice,
          );
          assert.equal(p.hand.length, p.faction === 'harkonnen' ? 2 : 1);
        }
        if (roster === EXPANSION) {
          assert.ok(actions.some((a) => a === 'ixSetup:decision'));
          assert.equal(player(g, 'ixians').elites!.reserves, 4);
          assert.equal(
            player(g, 'ixians').elites!.forces[location(MOBILE_STRONGHOLD, 0)],
            3,
          );
        }
      }
});

void test('the four factions requiring unfinished expansion decks reject genuine Homeworld setup without replacing decks or lobby metadata', () => {
  for (const roster of [
    ['choam', 'richese'],
    ['ecaz', 'moritani'],
  ] as FactionId[][]) {
    for (const advanced of [false, true]) {
      const g = lobby(roster, advanced);
      const before = structuredClone(g);
      assert.throws(() => initializeHomeworldGameForAudit(g));
      assert.deepEqual(g, before);
      assert.deepEqual(g.deck, []);
      assert.deepEqual(g.homeworlds, { custody: null });
      assert.ok(g.players.every((p) => p.ready && p.reserves === 20));
    }
  }
});

void test('Emperor starts with a single Basic Kaitain inventory or five Sardaukar on Advanced Salusa', () => {
  for (const advanced of [false, true]) {
    const g = finishSetup(
      initializeHomeworldGameForAudit(lobby(['emperor', 'atreides'], advanced)),
    ).game;
    const worlds = viewGame(g, 'emperor').homeworlds!.worlds!;
    const kaitain = worlds.find((w) => w.card === 'kaitain')!;
    const salusa = worlds.find((w) => w.card === 'salusa_secundus');
    assert.deepEqual(kaitain.forces.emperor, {
      normal: 15,
      elite: advanced ? 0 : 5,
    });
    assert.equal(kaitain.population, advanced ? 15 : 20);
    if (advanced) {
      assert.ok(salusa);
      assert.deepEqual(salusa.forces.emperor, { normal: 0, elite: 5 });
      assert.equal(salusa.population, 5);
      assert.equal(salusa.side, 'high');
    } else assert.equal(salusa, undefined);
    assertInventory(g);
  }
});

void test('real mixed Ix setup supports every smaller table size and all three physical special-counter identities together', () => {
  const roster: FactionId[] = [
    'ixians',
    'emperor',
    'fremen',
    'atreides',
    'beneGesserit',
  ];
  for (const advanced of [false, true])
    for (const count of [2, 3, 4, 5]) {
      const { game: g, actions } = finishSetup(
        initializeHomeworldGameForAudit(
          lobby(roster.slice(0, count), advanced),
        ),
      );
      assertInventory(g);
      assertCardCustody(g);
      assert.ok(actions.includes('ixSetup:decision'));
      assert.equal(player(g, 'ixians').elites!.reserves, 4);
      assert.equal(sum(player(g, 'ixians').elites!.forces), 3);
    }
});

void test('native public projection survives JSON restart and is independent of hidden prediction and spice balances', () => {
  const g = finishSetup(initializeHomeworldGameForAudit(lobby())).game;
  const changed = JSON.parse(JSON.stringify(g)) as Game;
  player(changed, 'beneGesserit').prediction = { faction: 'fremen', turn: 9 };
  player(changed, 'emperor').spice += 17;
  const expected = viewGame(g, 'atreides').homeworlds;
  for (const p of changed.players)
    assert.deepEqual(viewGame(changed, p.id).homeworlds, expected);
  assertPrivateViews(changed);
  assert.deepEqual(normalizeAutomaticGame(changed), changed);
});

void test('actual Fremen star placement changes the native typed projection without changing its ten remaining physical reserves', () => {
  for (const advanced of [false, true])
    for (const elite of [0, 1, 3]) {
      let g = toForces(
        initializeHomeworldGameForAudit(lobby(['fremen', 'emperor'], advanced)),
      );
      assert.equal(
        viewGame(g, 'fremen').homeworlds!.worlds!.find(
          (w) => w.native === 'fremen',
        )!.population,
        20,
      );
      g = applyAction(g, 'fremen', fremenPlacement(elite));
      const home = viewGame(g, 'fremen').homeworlds!.worlds!.find(
        (w) => w.native === 'fremen',
      )!;
      assert.deepEqual(home.forces.fremen, {
        normal: 7 + elite,
        elite: 3 - elite,
      });
      assert.equal(home.population, 10);
      assert.equal(sum(player(g, 'fremen').elites!.forces), elite);
      assertInventory(g);
    }
});

void test('setup rejects impossible star placement atomically and preserves the real pending choice for a legal replacement', () => {
  const g = toForces(
    initializeHomeworldGameForAudit(lobby(['fremen', 'emperor'], false)),
  );
  rejectUnchanged(g, 'fremen', fremenPlacement(4));
  assertInventory(applyAction(g, 'fremen', fremenPlacement(3)));
});

function corruptRejected(g: Game) {
  const before = structuredClone(g);
  assert.throws(() => viewGame(g, g.host));
  assert.deepEqual(g, before);
  assert.throws(() => normalizeAutomaticGame(g));
  assert.deepEqual(g, before);
  rejectUnchanged(g, g.host, { type: 'setAutopilot', difficulty: 'Easy' });
}
void test('saved native custody cannot be missing, orphaned, duplicated, or reconstructed during view, action, or normalization', () => {
  const original = finishSetup(
    initializeHomeworldGameForAudit(lobby(['emperor', 'fremen'], true)),
  ).game;
  const mutations: ((g: Game) => void)[] = [
    (g) => {
      g.homeworlds!.custody = null;
    },
    (g) => {
      g.homeworlds!.custody!.salusa = null;
    },
    (g) => {
      g.homeworlds!.custody!.salusa!.elite = 6;
    },
    (g) => {
      g.homeworlds!.custody!.salusa!.normal = -1;
    },
    (g) => {
      g.homeworlds!.custody!.visitors['homeworld:absent'] = {
        emperor: { normal: 1, elite: 0 },
      };
    },
    (g) => {
      g.homeworlds!.custody!.visitors['homeworld:emperor'] = {
        emperor: { normal: 1, elite: 0 },
      };
    },
    (g) => {
      player(g, 'emperor').reserves--;
    },
    (g) => {
      player(g, 'fremen').elites!.reserves--;
    },
    (g) => {
      (g.homeworlds as unknown as Record<string, unknown>).orphan = true;
    },
  ];
  for (const mutate of mutations) {
    const g = JSON.parse(JSON.stringify(original)) as Game;
    mutate(g);
    corruptRejected(g);
  }
  assert.deepEqual(
    normalizeAutomaticGame(JSON.parse(JSON.stringify(original))),
    original,
  );
  const early = initializeHomeworldGameForAudit(lobby());
  early.homeworlds!.custody = structuredClone(original.homeworlds!.custody);
  corruptRejected(early);
});

void test('the Homeworld audit seam refuses a missing module, unready lobby, dirty counters, or an already initialized game without mutating it', () => {
  const candidates = [
    lobby(BASE, false, false),
    lobby(),
    lobby(),
    initializeHomeworldGameForAudit(lobby()),
  ];
  candidates[1].players[0].ready = false;
  candidates[2].players[0].reserves--;
  for (const g of candidates) {
    const before = structuredClone(g);
    assert.throws(() => initializeHomeworldGameForAudit(g));
    assert.deepEqual(g, before);
  }
});

void test('legacy Basic setup without the module preserves untyped base reserves and has no Homeworld view', () => {
  const g = finishSetup(
    initializeBaseGameForAudit(lobby(BASE, false, false)),
  ).game;
  assert.equal(g.homeworlds, undefined);
  assert.equal(viewGame(g, g.host).homeworlds, null);
  assert.ok(g.players.every((p) => p.elites === undefined));
  assert.deepEqual(normalizeAutomaticGame(JSON.parse(JSON.stringify(g))), g);
});
