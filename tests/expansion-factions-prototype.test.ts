import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyAction,
  createGame,
  initializeFactionExpansionsGameForAudit,
  initializeHomeworldGameForAudit,
  initializeNexusGameForAudit,
  joinGame,
  newPlayer,
  normalizeAutomaticGame,
  viewGame,
  type Action,
  type Game,
} from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES, type Difficulty } from '../game/bot-profiles';
import { FACTIONS, faction, type FactionId } from '../game/catalog';
import { CHOAM_AUDITOR_ID, spiceDeck, treacheryDeck } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import { traitorDeck } from '../game/traitors';
import { MOBILE_LOCATION } from '../game/board';
import {
  ECAZ_START_FORCES,
  ECAZ_START_LOCATIONS,
  quoteEcazStartingForces,
} from '../game/ecaz-setup';

const combinations = [
  ['ix'],
  ['choam'],
  ['ecaz'],
  ['ix', 'choam'],
  ['ix', 'ecaz'],
  ['choam', 'ecaz'],
  ['ix', 'choam', 'ecaz'],
];
const sum = (forces: Record<string, number>) =>
  Object.values(forces).reduce((a, b) => a + b, 0);
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
function rosterFor(expansions: string[]): FactionId[] {
  const selected = FACTIONS.filter((f) => expansions.includes(f.expansion)).map(
    (f) => f.id,
  );
  return [
    ...selected,
    ...(
      ['fremen', 'beneGesserit', 'atreides', 'harkonnen'] as FactionId[]
    ).slice(0, 6 - selected.length),
  ];
}
function lobby(
  expansions = ['choam'],
  advanced = false,
  roster = rosterFor(expansions),
): Game {
  let g = createGame(
    'FACTIONS',
    newPlayer(roster[0], roster[0], roster[0]),
    advanced,
    expansions,
  );
  for (const id of roster.slice(1)) joinGame(g, newPlayer(id, id, id));
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  return g;
}
function privateViews(g: Game) {
  const saved = reload(g);
  for (const p of g.players) {
    const view = viewGame(g, p.id);
    assert.deepEqual(viewGame(saved, p.id), view);
    assert.equal('deck' in view, false);
    assert.equal('traitorReserve' in view, false);
    for (const other of view.players.filter((other) => other.id !== p.id)) {
      assert.equal(other.hand, undefined);
      assert.equal(other.traitors, undefined);
      assert.equal(other.traitorChoices, undefined);
      assert.equal(other.faceDancers, undefined);
      assert.equal(other.spice, undefined);
    }
    if (g.ixSetupCards && p.faction !== 'ixians')
      assert.equal(view.ixTechnology, null);
    if (g.players.some((other) => other.noField)) {
      assert.equal(!!view.richeseNoField?.private, p.faction === 'richese');
      if (p.faction !== 'richese')
        for (const token of g.players.find(
          (other) => other.faction === 'richese',
        )!.noField!.tokens)
          assert.equal(JSON.stringify(view).includes(token.id), false);
    }
    if (g.moritaniTerror) {
      assert.equal(
        view.moritaniTerror!.tokens.length,
        p.faction === 'moritani' ? 6 : 0,
      );
      if (p.faction === 'moritani')
        assert.ok(
          view.moritaniTerror!.tokens.every((token) => 'kind' in token),
        );
    }
  }
  return saved;
}
function inventory(g: Game) {
  const expected = [
    ...treacheryDeck(g.expansions),
    ...(g.players.some((p) => p.faction === 'richese') ? richeseCards() : []),
  ];
  const cards = [
    ...g.deck,
    ...g.discard,
    ...g.players.flatMap((p) => p.hand),
    ...(g.ixSetupCards ?? []),
    ...(g.richeseCache ?? []),
  ];
  assert.deepEqual(
    cards.map((c) => c.id).sort(),
    expected.map((c) => c.id).sort(),
  );
  assert.equal(new Set(cards.map((c) => c.id)).size, cards.length);
  assert.ok(cards.every((c) => !c.id.startsWith('ecaz-')));
  assert.equal(
    g.spiceDeck.length + g.spiceDiscard.flat().length,
    spiceDeck(g.expansions.includes('ix')).length,
  );
  for (const p of g.players)
    assert.equal(p.reserves + p.tanks + sum(p.forces), 20, p.id);
  if (g.setupStage !== 'prediction') {
    const traitors = [
      ...(g.traitorReserve ?? []),
      ...g.players.flatMap((p) => [
        ...p.traitors,
        ...p.traitorChoices,
        ...(p.faceDancers ?? []).map((c) => c.leader),
      ]),
    ];
    assert.deepEqual(
      traitors.slice().sort(),
      traitorDeck(g.players, g.expansions.includes('ix')).sort(),
    );
    assert.equal(new Set(traitors).size, traitors.length);
  }
}
function setup(state: Game, difficulty: Difficulty) {
  let g = state;
  const history: string[] = [];
  for (let step = 0; g.status === 'setup' && step < 40; step++) {
    inventory(g);
    g = privateViews(g);
    let next: Game | undefined;
    for (const p of g.players) {
      const view = viewGame(g, p.id);
      view.players.find((player) => player.id === p.id)!.bot = difficulty;
      const before = structuredClone(view);
      const actions = botActions(view);
      assert.deepEqual(view, before);
      for (const action of actions) {
        const candidate = applyAction(g, p.id, action);
        next ??= candidate;
      }
      if (next) {
        const action = actions[0];
        history.push(
          action.type === 'decision' ? g.decision!.kind : action.type,
        );
        if (g.decision?.kind === 'moritaniSetup') {
          assert.equal(g.setupStage, undefined);
          assert.ok(
            g.players.every(
              (player) =>
                player.hand.length === (player.faction === 'harkonnen' ? 2 : 1),
            ),
          );
          assert.ok(
            g.players.every(
              (player) => player.faction !== 'ecaz' || player.reserves === 14,
            ),
          );
        }
        break;
      }
    }
    assert.ok(
      next,
      `${g.expansions.join(',')}/${difficulty}: stalled ${g.setupStage}/${g.decision?.kind}/${viewGame(g, g.host).setupPending.join(',')}`,
    );
    g = next;
  }
  assert.equal(g.status, 'playing');
  assert.equal(g.turn, 1);
  assert.equal(g.phase, 0);
  inventory(g);
  privateViews(g);
  return { game: g, history };
}
function reject(g: Game, operation = initializeFactionExpansionsGameForAudit) {
  const before = structuredClone(g);
  assert.throws(() => operation(g));
  assert.deepEqual(g, before);
}
function rejectAction(g: Game, player: string, action: Action) {
  const before = structuredClone(g);
  assert.throws(() => applyAction(g, player, action));
  assert.deepEqual(g, before);
}

for (const expansions of combinations)
  void test(`genuine ${expansions.join('+')} faction setup supports Basic and Advanced with every AI profile and private JSON continuation`, () => {
    for (const advanced of [false, true])
      for (const difficulty of DIFFICULTIES) {
        const initial = lobby(expansions, advanced),
          before = structuredClone(initial);
        const started = initializeFactionExpansionsGameForAudit(initial);
        assert.deepEqual(initial, before);
        assert.equal(started.leaderSkills, undefined);
        assert.equal(
          started.deck.length,
          expansions.includes('ix')
            ? 47
            : expansions.includes('choam')
              ? 35
              : 33,
        );
        const { game: g, history } = setup(started, difficulty);
        assert.deepEqual(g.expansions, expansions);
        for (const p of g.players) {
          assert.equal(p.spice, faction(p.faction).spice);
          assert.equal(p.hand.length, p.faction === 'harkonnen' ? 2 : 1);
        }
        const ecaz = g.players.find((p) => p.faction === 'ecaz');
        if (ecaz) {
          assert.equal(ecaz.reserves, 14);
          assert.equal(sum(ecaz.forces), 6);
          assert.ok(
            Object.keys(ecaz.forces).every((key) =>
              ECAZ_START_LOCATIONS.includes(key),
            ),
          );
          assert.equal(g.ecazAmbassadors!.tokens.length, 11);
          assert.equal(
            g.ecazAmbassadors!.tokens.filter((t) => t.zone === 'supply').length,
            6,
          );
          assert.equal(g.ecazAmbassadors!.cohort.length, 5);
          if (g.players.some((p) => p.faction === 'fremen'))
            assert.ok(
              history.indexOf('fremenSetup') < history.indexOf('ecazSetup'),
            );
          if (advanced && g.players.some((p) => p.faction === 'beneGesserit'))
            assert.ok(
              history.indexOf('ecazSetup') < history.indexOf('advisorSetup'),
            );
        }
        const moritani = g.players.find((p) => p.faction === 'moritani');
        if (moritani) {
          assert.equal(moritani.reserves, 14);
          assert.equal(sum(moritani.forces), 6);
          assert.equal(g.moritaniTerror!.tokens.length, 6);
          assert.equal(history.at(-1), 'moritaniSetup');
          assert.ok(g.dukeVidal);
          assert.ok(
            g.players.every(
              (p) => !p.leaders.some((l) => l.id === g.dukeVidal!.leader.id),
            ),
          );
        }
        const richese = g.players.find((p) => p.faction === 'richese');
        if (richese) {
          assert.equal(g.richeseCache!.length, 10);
          assert.deepEqual(
            richese.noField!.tokens.map((t) => t.value).sort((a, b) => a - b),
            [0, 3, 5],
          );
          assert.equal(richese.reserves, 20);
        }
        const choam = g.players.find((p) => p.faction === 'choam');
        if (choam)
          assert.equal(
            choam.leaders.some((l) => l.id === CHOAM_AUDITOR_ID),
            advanced,
          );
        const ix = g.players.find((p) => p.faction === 'ixians');
        if (ix) {
          assert.deepEqual(ix.forces, { [MOBILE_LOCATION]: 6 });
          assert.deepEqual(ix.elites!.forces, { [MOBILE_LOCATION]: 3 });
          assert.equal(ix.elites!.reserves, 4);
          assert.equal(g.mobileStronghold!.location, null);
        }
        const tleilaxu = g.players.find((p) => p.faction === 'tleilaxu');
        if (tleilaxu) assert.equal(tleilaxu.faceDancers!.length, 3);
        reject(g);
      }
  });

void test('faction prototype handles two through six seats and preserves the public start gates', () => {
  const roster: FactionId[] = [
    'choam',
    'richese',
    'atreides',
    'harkonnen',
    'guild',
    'emperor',
  ];
  for (const count of [2, 3, 4, 5, 6])
    for (const advanced of [false, true]) {
      const g = lobby(['choam'], advanced, roster.slice(0, count));
      rejectAction(g, g.host, { type: 'start' });
      assert.equal(
        setup(initializeFactionExpansionsGameForAudit(g), 'Medium').game.players
          .length,
        count,
      );
    }
});

void test('Ecaz starting-force quote accepts exact six-force Basin allocations and rejects invalid or ambiguous input purely', () => {
  assert.equal(ECAZ_START_FORCES, 6);
  assert.deepEqual(ECAZ_START_LOCATIONS, [
    'imperial_basin:9',
    'imperial_basin:10',
    'imperial_basin:11',
  ]);
  const input = {
    'imperial_basin:9': 2,
    'imperial_basin:10': 4,
    'imperial_basin:11': 0,
  };
  assert.deepEqual(quoteEcazStartingForces(input), {
    'imperial_basin:9': 2,
    'imperial_basin:10': 4,
  });
  for (const bad of [
    null,
    [],
    {},
    { 'imperial_basin:9': 5 },
    { 'imperial_basin:9': 7 },
    { 'imperial_basin:9': 5.5, 'imperial_basin:10': 0.5 },
    { 'imperial_basin:9': -1, 'imperial_basin:10': 7 },
    { 'imperial_basin:09': 6 },
    { imperial_basin: 6 },
    { 'arrakeen:10': 6 },
    { 'imperial_basin:9': '6' },
  ]) {
    const before = structuredClone(bad);
    assert.throws(() => quoteEcazStartingForces(bad));
    assert.deepEqual(bad, before);
  }
});

void test('Ecaz splits six forces once between Fremen and Advanced BG, then excludes Imperial Basin from Moritani final placement', () => {
  let g = initializeFactionExpansionsGameForAudit(
    lobby(['ecaz'], true, ['ecaz', 'moritani', 'fremen', 'beneGesserit']),
  );
  const actionsFor = (id: string) => {
    const view = viewGame(g, id);
    view.players.find((p) => p.id === id)!.bot = 'Medium';
    return botActions(view);
  };
  for (
    let step = 0;
    !(
      g.setupStage === 'forces' &&
      viewGame(g, g.host).setupPending[0] === 'ecaz'
    ) && step < 20;
    step++
  ) {
    const actor = g.players.find((p) => actionsFor(p.id).length > 0)!;
    assert.ok(actor);
    g = applyAction(reload(g), actor.id, actionsFor(actor.id)[0]);
  }
  assert.deepEqual(viewGame(g, g.host).setupPending, ['ecaz']);
  assert.equal(g.players.find((p) => p.faction === 'fremen')!.reserves, 10);
  assert.ok(g.players.every((p) => p.hand.length === 0));
  const split = {
    type: 'ecazSetup',
    placements: {
      'imperial_basin:9': 2,
      'imperial_basin:10': 2,
      'imperial_basin:11': 2,
    },
  };
  rejectAction(g, 'beneGesserit', {
    type: 'advisorSetup',
    territory: 'polar_sink',
    sector: 0,
  });
  rejectAction(g, 'fremen', split);
  rejectAction(g, 'ecaz', {
    type: 'ecazSetup',
    placements: { 'imperial_basin:9': 5 },
  });
  rejectAction(g, 'ecaz', { ...split, elitePlacements: {} });
  g = applyAction(privateViews(g), 'ecaz', split);
  assert.deepEqual(g.players[0].forces, split.placements);
  assert.equal(g.players[0].reserves, 14);
  assert.deepEqual(viewGame(g, g.host).setupPending, ['beneGesserit']);
  rejectAction(g, 'ecaz', split);
  g = applyAction(privateViews(g), 'beneGesserit', {
    type: 'advisorSetup',
    territory: 'polar_sink',
    sector: 0,
  });
  assert.deepEqual(g.decision, { kind: 'moritaniSetup', player: 'moritani' });
  assert.ok(g.players.every((p) => p.hand.length === 1));
  rejectAction(g, 'moritani', {
    type: 'decision',
    territory: 'imperial_basin',
    sector: 9,
  });
  rejectAction(g, 'moritani', {
    type: 'decision',
    territory: 'polar_sink',
    sector: 0,
  });
  for (const [reserves, forces] of [
    [20, {}],
    [14, { 'arrakeen:10': 6 }],
  ] as const) {
    const incomplete = reload(g);
    incomplete.players[0].reserves = reserves;
    incomplete.players[0].forces = forces;
    rejectAction(incomplete, 'moritani', {
      type: 'decision',
      territory: 'carthag',
      sector: 11,
    });
    incomplete.decision = null;
    const before = structuredClone(incomplete),
      normalized = normalizeAutomaticGame(incomplete);
    assert.deepEqual(incomplete, before);
    assert.equal(normalized.status, 'setup');
    assert.equal(normalized.decision, null);
  }
  g = applyAction(privateViews(g), 'moritani', {
    type: 'decision',
    territory: 'arrakeen',
    sector: 10,
  });
  assert.equal(g.status, 'playing');
  assert.equal(g.players[1].reserves, 14);
  assert.deepEqual(g.players[1].forces, { 'arrakeen:10': 6 });
  rejectAction(g, 'ecaz', split);
  inventory(g);
});

void test('a stale or partially played lobby cannot redeal faction inventories, leaders, or optional modules', () => {
  const mutations: Array<(g: Game) => void> = [
    (g) => {
      g.expansions = [];
    },
    (g) => {
      g.expansions = ['ecaz-treachery'];
    },
    (g) => {
      g.expansions.push('choam');
    },
    (g) => {
      g.players[0].ready = false;
    },
    (g) => {
      g.host = 'missing';
    },
    (g) => {
      g.turn = 2;
    },
    (g) => {
      g.advanced = 'advanced' as unknown as boolean;
    },
    (g) => {
      g.status = 'setup';
    },
    (g) => {
      g.players[0].spice = 1;
    },
    (g) => {
      g.players[0].reserves = 19;
    },
    (g) => {
      g.richeseCache = [];
    },
    (g) => {
      g.richeseRemoved = [];
    },
    (g) => {
      g.ecazAmbassadors = { tokens: [], cohort: [], placement: null };
    },
    (g) => {
      g.moritaniTerror = { tokens: [] };
    },
    (g) => {
      g.dukeVidal = {} as NonNullable<Game['dukeVidal']>;
    },
    (g) => {
      g.mobileStronghold = { location: null };
    },
    (g) => {
      g.ixSetupCards = [];
    },
    (g) => {
      g.players[1].noField = {} as NonNullable<
        Game['players'][number]['noField']
      >;
    },
    (g) => {
      g.players[1].noFieldEvent = 'old';
    },
    (g) => {
      g.players[0].faceDancers = [];
    },
    (g) => {
      g.players[0].leaders[0].capturedBy = g.players[1].id;
    },
    (g) => {
      g.players[0].leaders[0].gholaBy = g.players[1].id;
    },
    (g) => {
      g.players[0].leaders[0].dead = true;
    },
    (g) => {
      g.players[0].leaders[0].deaths = 1;
    },
    (g) => {
      g.players[0].leaders[0].usedAt = 'arrakeen';
    },
    (g) => {
      g.players[0].leaders[0].strength++;
    },
    (g) => {
      g.players[0].revived = 1;
    },
    (g) => {
      g.players[0].freeForcesRevived = 1;
    },
    (g) => {
      g.players[0].leaderRevived = true;
    },
    (g) => {
      g.players[0].revivalCycle = 1;
    },
    (g) => {
      g.homeworlds = { custody: null };
    },
    (g) => {
      g.nexusCards = { cards: null, phase: null };
    },
    (g) => {
      g.leaderSkills = {} as NonNullable<Game['leaderSkills']>;
    },
    (g) => {
      g.discoveryEnabled = true;
    },
    (g) => {
      g.discoveries = {} as NonNullable<Game['discoveries']>;
    },
    (g) => {
      g.techTokens = {} as NonNullable<Game['techTokens']>;
    },
    (g) => {
      g.strongholdCards = {} as NonNullable<Game['strongholdCards']>;
    },
  ];
  for (const mutate of mutations) {
    const g = lobby();
    mutate(g);
    reject(g);
  }
  const absentFaction = lobby(['choam']);
  absentFaction.players[0] = {
    ...newPlayer('ecaz', 'Ecaz', 'ecaz'),
    ready: true,
  };
  absentFaction.host = 'ecaz';
  reject(absentFaction);
  const tooMany = lobby(['ix']);
  tooMany.players.push({
    ...newPlayer('guild', 'Guild', 'guild'),
    ready: true,
  });
  reject(tooMany);
  const alone = lobby(['choam'], false, ['choam']);
  reject(alone);
});

void test('accepting the Ecaz deck selector does not open existing Homeworld or Nexus expansion gates', () => {
  for (const expansions of [['choam'], ['ecaz'], ['ix', 'ecaz']]) {
    const home = lobby(expansions, true);
    home.homeworlds = { custody: null };
    reject(home, initializeHomeworldGameForAudit);
    const nexus = lobby(expansions, true);
    nexus.nexusCards = { cards: null, phase: null };
    reject(nexus, initializeNexusGameForAudit);
  }
});
