import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  initializeHomeworldGameForAudit,
  joinGame,
  newPlayer,
  normalizeAutomaticGame,
  viewGame,
  type Action,
  type Game,
} from '../game/engine';
import { botActions } from '../game/bots';
import type { FactionId } from '../game/catalog';
import { baseDeck } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import {
  homeworldContext,
  homeworldGameIntegrity,
} from '../game/homeworld-game';
import {
  homeworldForceGroups,
  quoteHomeworldCustody,
  type HomeworldCustodyChange,
} from '../game/homeworld-custody';

const seat = (g: Game, id: string) =>
  g.players.find((player) => player.id === id)!;
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
const sum = (counts: Record<string, number>) =>
  Object.values(counts).reduce((a, b) => a + b, 0);

function inventory(g: Game, supplementalCards = 0) {
  homeworldGameIntegrity(g);
  const groups = homeworldForceGroups(
    homeworldContext(g),
    g.homeworlds!.custody!,
  );
  for (const player of g.players) {
    const visitors = groups
      .filter((home) => home.native !== player.id)
      .map((home) => home.forces[player.id] ?? { normal: 0, elite: 0 });
    assert.equal(
      player.reserves +
        player.tanks +
        sum(player.forces) +
        visitors.reduce((n, pool) => n + pool.normal + pool.elite, 0),
      20,
    );
    if (player.elites)
      assert.equal(
        player.elites.reserves +
          player.elites.tanks +
          sum(player.elites.forces) +
          visitors.reduce((n, pool) => n + pool.elite, 0),
        player.faction === 'emperor' ? 5 : player.faction === 'fremen' ? 3 : 7,
      );
  }
  const cards = [
    ...g.deck,
    ...g.discard,
    ...g.players.flatMap((player) => player.hand),
  ];
  assert.equal(cards.length, baseDeck().length + supplementalCards);
  assert.equal(new Set(cards.map((card) => card.id)).size, cards.length);
}
function setup(roster: FactionId[], advanced = false) {
  let g = createGame(
    'HOMEWORLDBATTLEENGINE',
    newPlayer(roster[0], roster[0], roster[0]),
    advanced,
  );
  for (const faction of roster.slice(1))
    joinGame(g, newPlayer(faction, faction, faction));
  g = applyAction(g, g.host, { type: 'homeworlds', enabled: true });
  for (const player of g.players)
    g = applyAction(g, player.id, { type: 'ready' });
  g = initializeHomeworldGameForAudit(g);
  for (let step = 0; g.status === 'setup' && step < 30; step++) {
    let next: Game | undefined;
    for (const player of g.players) {
      const view = viewGame(g, player.id);
      view.players.find((owner) => owner.id === player.id)!.bot = 'Easy';
      const action = botActions(view)[0];
      if (action) {
        next = applyAction(g, player.id, action);
        break;
      }
    }
    assert.ok(next, 'Genuine audit setup must have a legal decision.');
    g = next;
  }
  assert.equal(g.status, 'playing');
  for (const player of g.players) g.deck.push(...player.hand.splice(0));
  Object.assign(g, {
    phase: 6,
    phaseOpening: null,
    response: null,
    decision: null,
    active: roster[0],
    order: roster,
    ready: [],
    storm: 18,
  });
  inventory(g);
  return g;
}
function custody(g: Game, changes: HomeworldCustodyChange[]) {
  const quote = quoteHomeworldCustody(
    homeworldContext(g),
    g.homeworlds!.custody!,
    changes,
  );
  g.homeworlds!.custody = quote.state;
  for (const update of quote.players) {
    const player = seat(g, update.id);
    player.reserves = update.reserves;
    if (player.elites) player.elites.reserves = update.eliteReserves;
  }
  inventory(g);
}
function invade(
  g: Game,
  player: string,
  destination: string,
  normal: number,
  elite = 0,
) {
  // Explicit conserved invasion position, not a claim that invasion shipment
  // actions are open: withdraw the exact native pieces before depositing them.
  custody(g, [
    {
      homeworld: `homeworld:${seat(g, player).faction}`,
      player,
      withdraw: { normal, elite },
      deposit: { normal: 0, elite: 0 },
    },
    {
      homeworld: destination,
      player,
      withdraw: { normal: 0, elite: 0 },
      deposit: { normal, elite },
    },
  ]);
}
function hold(g: Game, player: string, kind: string) {
  const index = g.deck.findIndex((card) => card.kind === kind);
  assert.ok(index >= 0);
  const [card] = g.deck.splice(index, 1);
  seat(g, player).hand.push(card);
  return card.id;
}
function prepared(state: Game, actor: string, target: string, home: string) {
  let g = applyAction(state, actor, {
    type: 'chooseBattle',
    territory: home,
    target,
  });
  for (
    let step = 0;
    (g.response || g.battle?.preparation || g.decision) && step < 30;
    step++
  ) {
    if (g.response) {
      const owner = g.players.find(
        (player) => !g.response!.passed.includes(player.id),
      )!;
      g = applyAction(g, owner.id, { type: 'passResponse' });
    } else if (g.battle?.preparation)
      g = applyAction(g, g.battle.preparation.owner, {
        type: 'declineBattlePower',
      });
    else {
      assert.equal(g.decision!.kind, 'fullPlanOffer');
      g = applyAction(g, g.decision!.player, {
        type: 'decision',
        decline: true,
      });
    }
  }
  assert.equal(g.response, null);
  assert.equal(g.decision, null);
  assert.equal(g.battle!.territory, home);
  assert.equal(g.battle!.preparation ?? null, null);
  inventory(g);
  return g;
}
function commit(
  g: Game,
  player: string,
  dial = 0,
  extras: Partial<Action> = {},
) {
  const leader =
    seat(g, player).leaders.find((leader) => leader.strength === 1) ??
    seat(g, player).leaders[0];
  return applyAction(g, player, {
    type: 'battlePlan',
    dial,
    support: 0,
    leader: leader.id,
    ...extras,
  });
}
// Real base-game setup and battle actions, with canonical supplemental Richese
// cards physically introduced only after setup. This is a component seam, not
// evidence for a complete Richese expansion start or card sale.
function pendingDefense(withBox = false): Game {
  let g = setup(['atreides', 'emperor', 'guild']);
  invade(g, 'atreides', 'homeworld:emperor', 3);
  g = prepared(g, 'atreides', 'emperor', 'homeworld:emperor');
  const portable = richeseCards().find(
    (card) => card.effect === 'portableSnooper',
  )!;
  seat(g, 'atreides').hand.push(portable);
  if (withBox) {
    const box = richeseCards().find(
      (card) => card.effect === 'nullentropyBox',
    )!;
    seat(g, 'atreides').hand.push(box);
    g.discard.push(...g.deck.splice(0, 2));
  }
  const weapon = hold(g, 'emperor', 'poison');
  g = commit(g, 'atreides', 1);
  g = commit(g, 'emperor', 0, { weapon });
  assert.equal(g.decision, null);
  g = applyAction(g, 'emperor', { type: 'traitorCall', call: false });
  assert.equal(g.decision?.kind, 'homeworldDefense');
  assert.equal(g.decision?.player, 'atreides');
  inventory(g, withBox ? 2 : 1);
  return reload(g);
}

function rejectEveryBoundary(g: Game, action: Action) {
  const before = structuredClone(g);
  for (const player of g.players) {
    assert.throws(() => viewGame(g, player.id));
    assert.deepEqual(g, before, 'Rejected read must preserve the saved state.');
  }
  assert.throws(() => normalizeAutomaticGame(g));
  assert.deepEqual(
    g,
    before,
    'Rejected normalization must preserve the saved state.',
  );
  assert.throws(() => applyAction(g, 'atreides', action));
  assert.deepEqual(g, before, 'Rejected action must preserve the saved state.');
}

const corruptions: [
  string,
  (g: Game, decision: NonNullable<Game['decision']>) => void,
][] = [
  [
    'stale event',
    (_g, decision) => {
      assert.equal(decision.kind, 'homeworldDefense');
      if (decision.kind === 'homeworldDefense') decision.event = 'stale';
    },
  ],
  [
    'noncombatant owner',
    (_g, decision) => {
      decision.player = 'guild';
    },
  ],
  [
    'already-passed owner',
    (g) => {
      g.battle!.homeworldDefensePassed = ['atreides'];
    },
  ],
  [
    'missing native vote',
    (g) => {
      delete g.battle!.traitorCalls.emperor;
    },
  ],
];

void test('a genuine native-voter Homeworld late-defense continuation survives JSON without replaying its vote', () => {
  const g = pendingDefense();
  assert.deepEqual(reload(normalizeAutomaticGame(reload(g))), g);
  for (const player of g.players)
    assert.doesNotThrow(() => viewGame(g, player.id));
  assert.equal(g.battle!.traitorCalls.emperor, false);
  const next = applyAction(g, 'atreides', {
    type: 'decision',
    event: g.battle!.event,
    use: false,
  });
  assert.equal(next.battle, null);
  inventory(next, 1);
});

void test('corrupt saved Homeworld late-defense ownership, event and completed-vote parents reject at every boundary unchanged', () => {
  const pending = pendingDefense();
  for (const [name, corrupt] of corruptions) {
    const g = reload(pending);
    corrupt(g, g.decision!);
    assert.doesNotThrow(() => {
      rejectEveryBoundary(g, {
        type: 'decision',
        event: pending.battle!.event,
        use: false,
      });
    }, name);
  }
});

void test('paid Box search preserves its real Homeworld late-defense parent and validates corruption before selection', () => {
  let g = pendingDefense(true);
  const before = reload(g);
  const box = seat(g, 'atreides').hand.find(
    (card) => card.effect === 'nullentropyBox',
  )!;
  const spice = seat(g, 'atreides').spice;
  g = applyAction(g, 'atreides', { type: 'card', card: box.id });
  assert.equal(g.decision?.kind, 'nullentropy');
  assert.deepEqual(g.pendingNullentropy!.resume.decision, before.decision);
  assert.equal(seat(g, 'atreides').spice, spice - 2);
  const selection: Action = {
    type: 'decision',
    event: g.pendingNullentropy!.event,
    card: g.discard[0].id,
  };
  const saved = reload(g);
  const unchanged = structuredClone(saved);
  for (const player of g.players)
    assert.doesNotThrow(() => viewGame(saved, player.id));
  assert.deepEqual(reload(normalizeAutomaticGame(reload(saved))), saved);
  for (const [name, corrupt] of corruptions) {
    const broken = reload(saved);
    corrupt(broken, broken.pendingNullentropy!.resume.decision!);
    assert.doesNotThrow(() => rejectEveryBoundary(broken, selection), name);
  }
  const resumed = applyAction(saved, 'atreides', selection);
  assert.equal(resumed.pendingNullentropy, null);
  assert.deepEqual(resumed.decision, before.decision);
  assert.equal(seat(resumed, 'atreides').spice, spice - 2);
  inventory(resumed, 2);
  assert.deepEqual(
    saved,
    unchanged,
    'Valid selection must also leave its input unchanged.',
  );
});

void test('a paid Box search cannot hide a missing or corrupted native explosion casualty receipt', () => {
  let g = setup(['atreides', 'emperor']);
  invade(g, 'atreides', 'homeworld:emperor', 3);
  const weapon = hold(g, 'atreides', 'lasgun');
  const defense = hold(g, 'emperor', 'shield');
  g = prepared(g, 'atreides', 'emperor', 'homeworld:emperor');
  g = commit(g, 'atreides', 0, { weapon });
  g = commit(g, 'emperor', 0, { defense });
  g = applyAction(g, 'emperor', { type: 'traitorCall', call: false });
  assert.equal(g.decision?.kind, 'homeworldExplosion');
  const before = reload(g);
  const box = richeseCards().find((card) => card.effect === 'nullentropyBox')!;
  seat(g, 'emperor').hand.push(box);
  g = applyAction(g, 'emperor', { type: 'card', card: box.id });
  assert.deepEqual(g.pendingNullentropy!.resume.decision, before.decision);
  const selection: Action = {
    type: 'decision',
    event: g.pendingNullentropy!.event,
    card: g.discard[0].id,
  };
  const mutations: [string, (saved: Game) => void][] = [
    [
      'missing receipt',
      (saved) => {
        delete saved.homeworldBattleLoss;
      },
    ],
    [
      'stale saved event',
      (saved) => {
        const decision = saved.pendingNullentropy!.resume.decision;
        assert.equal(decision?.kind, 'homeworldExplosion');
        if (decision?.kind === 'homeworldExplosion') decision.event = 'stale';
      },
    ],
    [
      'zero saved allocation',
      (saved) => {
        const decision = saved.pendingNullentropy!.resume.decision;
        assert.equal(decision?.kind, 'homeworldExplosion');
        if (decision?.kind === 'homeworldExplosion')
          decision.options = [{ normal: 0, elite: 0 }];
      },
    ],
  ];
  for (const [name, corrupt] of mutations) {
    const broken = reload(g);
    corrupt(broken);
    const unchanged = reload(broken);
    for (const player of broken.players)
      assert.throws(() => viewGame(broken, player.id), name);
    assert.throws(() => normalizeAutomaticGame(broken), name);
    assert.throws(() => applyAction(broken, 'emperor', selection), name);
    assert.deepEqual(broken, unchanged, name);
  }
  assert.deepEqual(reload(normalizeAutomaticGame(reload(g))), reload(g));
  const resumed = applyAction(g, 'emperor', selection);
  assert.deepEqual(resumed.decision, before.decision);
  assert.deepEqual(resumed.homeworldBattleLoss, before.homeworldBattleLoss);
  inventory(resumed, 1);
  const done = applyAction(resumed, 'emperor', {
    type: 'decision',
    event: resumed.homeworldBattleLoss!.event,
    choice: 1,
  });
  assert.equal(done.homeworldBattleLoss, null);
  assert.equal(seat(done, 'emperor').tanks, seat(before, 'emperor').tanks + 2);
  inventory(done, 1);
});
