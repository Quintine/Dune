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
import { DIFFICULTIES } from '../game/bot-profiles';
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
  type HomeworldForces,
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
function reject(g: Game, player: string, action: Action) {
  const before = structuredClone(g);
  assert.throws(() => applyAction(g, player, action));
  assert.deepEqual(g, before);
}
function explosionAction(g: Game, choice: number): Action {
  return { type: 'decision', event: g.homeworldBattleLoss!.event, choice };
}
function legalBots(g: Game, owner: string, supplementalCards = 0) {
  const candidates: Action[] = [];
  for (const level of DIFFICULTIES) {
    const view = viewGame(reload(g), owner);
    view.players.find((player) => player.id === owner)!.bot = level;
    const before = structuredClone(view);
    const actions = botActions(view);
    assert.ok(
      actions.length,
      `${level} must supply the pending Homeworld choice.`,
    );
    assert.deepEqual(view, before);
    for (const action of actions) {
      assert.equal(action.type, 'decision');
      const snapshot = structuredClone(g);
      const done = applyAction(g, owner, action);
      assert.deepEqual(g, snapshot);
      inventory(done, supplementalCards);
      candidates.push(action);
    }
  }
  return candidates;
}

void test('real Basic Homeworld battle awards native strength without treating the printed bonus as force casualties', () => {
  let g = setup(['atreides', 'guild']);
  invade(g, 'atreides', 'homeworld:guild', 3);
  const before = structuredClone(g);
  g = prepared(g, 'atreides', 'guild', 'homeworld:guild');
  assert.deepEqual(viewGame(g, 'atreides').battle!.traitorVoters, ['guild']);
  g = commit(g, 'atreides', 1);
  assert.deepEqual(viewGame(reload(g), 'guild').battle!.plans, {});
  g = commit(reload(g), 'guild');
  reject(g, 'atreides', { type: 'traitorCall', call: false });
  g = applyAction(reload(g), 'guild', { type: 'traitorCall', call: false });
  assert.equal(g.lastBattleContext!.winner, 'guild');
  assert.equal(g.lastBattleContext!.territory, 'homeworld:guild');
  assert.equal(seat(g, 'guild').reserves, seat(before, 'guild').reserves);
  assert.equal(seat(g, 'guild').tanks, 0);
  assert.equal(seat(g, 'atreides').tanks, 3);
  assert.equal(
    g.homeworlds!.custody!.visitors['homeworld:guild']?.atreides,
    undefined,
  );
  assert.deepEqual(
    g.players.map((player) => player.forces),
    before.players.map((player) => player.forces),
  );
  inventory(g);
  assert.deepEqual(reload(normalizeAutomaticGame(reload(g))), reload(g));
});

void test('two foreign armies at an empty native home resolve automatically after reveal with no fabricated traitor voter', () => {
  let g = setup(['atreides', 'guild', 'harkonnen']);
  invade(g, 'atreides', 'homeworld:harkonnen', 3);
  invade(g, 'guild', 'homeworld:harkonnen', 3);
  const native = seat(g, 'harkonnen');
  native.tanks += native.reserves;
  native.reserves = 0;
  inventory(g);
  g = prepared(g, 'atreides', 'guild', 'homeworld:harkonnen');
  assert.deepEqual(viewGame(g, 'atreides').battle!.traitorVoters, []);
  g = commit(g, 'atreides', 1);
  const saved = reload(g);
  assert.deepEqual(viewGame(saved, 'guild').battle!.plans, {});
  assert.deepEqual(viewGame(saved, 'harkonnen').battle!.plans, {});
  g = commit(saved, 'guild');
  assert.equal(
    g.battle,
    null,
    'No player needs to submit a nonexistent native traitor vote.',
  );
  assert.equal(g.lastBattleContext!.winner, 'atreides');
  assert.equal(seat(g, 'atreides').tanks, 1);
  assert.equal(seat(g, 'guild').tanks, 3);
  assert.deepEqual(
    g.homeworlds!.custody!.visitors['homeworld:harkonnen']!.atreides,
    { normal: 2, elite: 0 },
  );
  assert.equal(seat(g, 'harkonnen').reserves, 0);
  inventory(g);
  assert.deepEqual(reload(normalizeAutomaticGame(reload(g))), reload(g));
});

void test('ordered loser elimination records a sole foreign qualifier before the Basic winner loses its entire dialed army', () => {
  let g = setup(['atreides', 'guild', 'harkonnen']);
  assert.equal(g.homeworlds!.historyVersion, 1);
  assert.ok(g.homeworldOccupationHistory);
  const world = 'homeworld:harkonnen';
  invade(g, 'atreides', world, 3);
  invade(g, 'guild', world, 3);
  seat(g, 'harkonnen').tanks += seat(g, 'harkonnen').reserves;
  seat(g, 'harkonnen').reserves = 0;
  g = prepared(g, 'atreides', 'guild', world);
  assert.equal(
    g.homeworldOccupationHistory!.qualifications.filter(
      (fact) => fact.world === world,
    ).length,
    0,
  );
  g = commit(g, 'atreides', 3);
  g = commit(reload(g), 'guild');
  assert.equal(g.lastBattleContext!.winner, 'atreides');
  assert.equal(seat(g, 'atreides').tanks, 3);
  assert.equal(seat(g, 'guild').tanks, 3);
  assert.equal(g.homeworlds!.custody!.visitors[world], undefined);
  const history = g.homeworldOccupationHistory!;
  const qualifications = history.qualifications.filter(
    (fact) => fact.world === world,
  );
  assert.equal(qualifications.length, 1);
  assert.equal(qualifications[0].player, 'atreides');
  assert.equal(qualifications[0].cause, 'sole');
  const source = history.sources.find(
    (entry) => entry.event === qualifications[0].event,
  )!;
  const snapshot = JSON.parse(history.snapshots[source.snapshot]) as [
    string,
    [string, number, number][],
  ][];
  const armies = snapshot.find(([location]) => location === world)![1];
  assert.deepEqual(
    armies.filter(([, normal, elite]) => normal + elite > 0),
    [['atreides', 3, 0]],
    'The original qualification observes the winner before its own dialed losses.',
  );
  inventory(g);
  const saved = reload(g);
  for (let attempt = 0; attempt < 3; attempt++)
    g = normalizeAutomaticGame(reload(g));
  assert.deepEqual(reload(g), saved);
  assert.deepEqual(
    g.homeworldOccupationHistory,
    saved.homeworldOccupationHistory,
  );
});

void test('simultaneous Lasgun Shield destruction of two invaders at an empty native Homeworld never invents a sole qualifier', () => {
  let g = setup(['atreides', 'guild', 'harkonnen']);
  const world = 'homeworld:harkonnen';
  invade(g, 'atreides', world, 3);
  invade(g, 'guild', world, 3);
  seat(g, 'harkonnen').tanks += seat(g, 'harkonnen').reserves;
  seat(g, 'harkonnen').reserves = 0;
  const laser = hold(g, 'atreides', 'lasgun');
  const shield = hold(g, 'guild', 'shield');
  g = prepared(g, 'atreides', 'guild', world);
  assert.deepEqual(viewGame(g, 'atreides').battle!.traitorVoters, []);
  assert.equal(
    g.homeworldOccupationHistory!.qualifications.filter(
      (fact) => fact.world === world,
    ).length,
    0,
  );
  g = commit(g, 'atreides', 0, { weapon: laser });
  g = commit(reload(g), 'guild', 0, { defense: shield });
  assert.equal(g.lastBattleContext!.winner, null);
  assert.equal(g.battle, null);
  assert.equal(seat(g, 'atreides').tanks, 3);
  assert.equal(seat(g, 'guild').tanks, 3);
  assert.equal(g.homeworlds!.custody!.visitors[world], undefined);
  assert.equal(
    g.homeworldOccupationHistory!.qualifications.filter(
      (fact) => fact.world === world,
    ).length,
    0,
  );
  for (const raw of g.homeworldOccupationHistory!.snapshots) {
    const snapshot = JSON.parse(raw) as [string, [string, number, number][]][];
    const present = snapshot
      .find(([location]) => location === world)![1]
      .filter(([, normal, elite]) => normal + elite > 0);
    assert.ok(
      present.length !== 1 || present[0][0] === 'harkonnen',
      'No sequential half-explosion snapshot may show an invented sole invader.',
    );
  }
  for (const id of [laser, shield])
    assert.equal(g.discard.filter((card) => card.id === id).length, 1);
  inventory(g);
  assert.deepEqual(reload(normalizeAutomaticGame(reload(g))), reload(g));
});

void test('real Lasgun Shield explosion preserves mixed native reserves and offers the printed-strength typed loss choice after mandatory discard', () => {
  let g = setup(['atreides', 'emperor']);
  invade(g, 'atreides', 'homeworld:emperor', 3);
  const laser = hold(g, 'atreides', 'lasgun');
  const shield = hold(g, 'emperor', 'shield');
  const originalNative = seat(g, 'emperor').reserves;
  g = prepared(g, 'atreides', 'emperor', 'homeworld:emperor');
  g = commit(g, 'atreides', 0, { weapon: laser });
  const attackerLeader = g.battle!.plans.atreides.leader!;
  g = commit(reload(g), 'emperor', 0, { defense: shield });
  const defenderLeader = g.battle!.plans.emperor.leader!;
  g = applyAction(g, 'emperor', { type: 'traitorCall', call: false });
  assert.equal(g.decision?.kind, 'homeworldExplosion');
  if (g.decision?.kind !== 'homeworldExplosion')
    throw new Error('Missing native Homeworld explosion choice.');
  assert.equal(g.decision.player, 'emperor');
  assert.deepEqual(
    g.decision.options.map((option) => [option.normal, option.elite]),
    [
      [2, 0],
      [1, 1],
      [0, 2],
    ],
  );
  assert.equal(seat(g, 'atreides').tanks, 3);
  assert.equal(seat(g, 'emperor').tanks, 0);
  for (const card of [laser, shield])
    assert.equal(g.discard.filter((held) => held.id === card).length, 1);
  assert.equal(
    seat(g, 'atreides').leaders.find((leader) => leader.id === attackerLeader)!
      .dead,
    true,
  );
  assert.equal(
    seat(g, 'emperor').leaders.find((leader) => leader.id === defenderLeader)!
      .dead,
    true,
  );
  inventory(g);
  const saved = reload(g);
  assert.deepEqual(reload(normalizeAutomaticGame(reload(saved))), saved);
  reject(saved, 'atreides', explosionAction(saved, 0));
  if (saved.decision?.kind !== 'homeworldExplosion')
    throw new Error('Missing restored native explosion choice.');
  legalBots(saved, 'emperor');
  for (let choice = 0; choice < saved.decision!.options.length; choice++) {
    const losses: HomeworldForces = saved.decision!.options[choice];
    const action = explosionAction(saved, choice);
    const done = applyAction(reload(saved), 'emperor', action);
    assert.equal(seat(done, 'emperor').reserves, originalNative - 2);
    assert.equal(seat(done, 'emperor').tanks, 2);
    assert.equal(seat(done, 'emperor').elites!.tanks, losses.elite);
    assert.equal(done.battle, null);
    assert.equal(done.lastBattleContext!.territory, 'homeworld:emperor');
    assert.equal(done.lastBattleContext!.winner, null);
    for (const card of [laser, shield])
      assert.equal(done.discard.filter((held) => held.id === card).length, 1);
    inventory(done);
    const history = done.homeworldOccupationHistory!;
    assert.ok(history);
    assert.equal(
      history.qualifications.filter(
        (fact) => fact.world === 'homeworld:emperor',
      ).length,
      0,
    );
    const source = history.sources.at(-1)!;
    const snapshot = JSON.parse(history.snapshots[source.snapshot]) as [
      string,
      [string, number, number][],
    ][];
    const native = snapshot
      .find(([world]) => world === 'homeworld:emperor')![1]
      .find(([owner]) => owner === 'emperor')!;
    assert.equal(native[1] + native[2], originalNative - 2);
    assert.equal(native[2], seat(done, 'emperor').elites!.reserves);
    assert.deepEqual(
      reload(normalizeAutomaticGame(reload(done))),
      reload(done),
    );
    reject(done, 'emperor', action);
  }
});

void test('a saved native explosion allocation rejects a same-total Emperor pool swap instead of applying losses to different typed counters', () => {
  let g = setup(['atreides', 'emperor'], true);
  custody(g, [
    {
      homeworld: 'homeworld:emperor',
      player: 'emperor',
      withdraw: { normal: 1, elite: 0 },
      deposit: { normal: 0, elite: 1 },
    },
    {
      homeworld: 'homeworld:emperor:salusa',
      player: 'emperor',
      withdraw: { normal: 0, elite: 1 },
      deposit: { normal: 1, elite: 0 },
    },
  ]);
  invade(g, 'atreides', 'homeworld:emperor', 3);
  const laser = hold(g, 'atreides', 'lasgun');
  const shield = hold(g, 'emperor', 'shield');
  g = prepared(g, 'atreides', 'emperor', 'homeworld:emperor');
  g = commit(g, 'atreides', 0, { weapon: laser });
  g = commit(g, 'emperor', 0, { defense: shield });
  g = applyAction(g, 'emperor', { type: 'traitorCall', call: false });
  assert.equal(g.decision?.kind, 'homeworldExplosion');
  const saved = reload(g);
  const corrupt = reload(saved);
  // Kaitain remains fifteen counters, but its one star moves to Salusa in
  // exchange for one normal. Aggregate reserve/star totals remain unchanged.
  corrupt.homeworlds!.custody!.salusa = { normal: 0, elite: 5 };
  const groups = homeworldForceGroups(
    homeworldContext(corrupt),
    corrupt.homeworlds!.custody!,
  );
  assert.deepEqual(
    groups.find((home) => home.id === 'homeworld:emperor')!.forces.emperor,
    { normal: 15, elite: 0 },
  );
  assert.equal(
    seat(corrupt, 'emperor').reserves,
    seat(saved, 'emperor').reserves,
  );
  assert.equal(
    seat(corrupt, 'emperor').elites!.reserves,
    seat(saved, 'emperor').elites!.reserves,
  );
  reject(corrupt, 'emperor', explosionAction(corrupt, 0));
  const done = applyAction(reload(saved), 'emperor', explosionAction(saved, 0));
  assert.equal(seat(done, 'emperor').tanks, 2);
  assert.deepEqual(done.homeworlds!.custody!.salusa, { normal: 1, elite: 4 });
  inventory(done);
});

void test('an explosion between two invaders automatically reveals and gives only the uninvolved native owner its typed loss choice', () => {
  let g = setup(['atreides', 'guild', 'emperor']);
  invade(g, 'atreides', 'homeworld:emperor', 3);
  invade(g, 'guild', 'homeworld:emperor', 3);
  const laser = hold(g, 'atreides', 'lasgun');
  const shield = hold(g, 'guild', 'shield');
  const nativeLeaders = structuredClone(seat(g, 'emperor').leaders);
  g = prepared(g, 'atreides', 'guild', 'homeworld:emperor');
  assert.deepEqual(viewGame(g, 'atreides').battle!.traitorVoters, []);
  g = commit(g, 'atreides', 0, { weapon: laser });
  g = commit(reload(g), 'guild', 0, { defense: shield });
  assert.equal(g.decision?.kind, 'homeworldExplosion');
  assert.equal(g.decision!.player, 'emperor');
  assert.equal(seat(g, 'atreides').tanks, 3);
  assert.equal(seat(g, 'guild').tanks, 3);
  assert.deepEqual(seat(g, 'emperor').leaders, nativeLeaders);
  reject(reload(g), 'atreides', explosionAction(g, 0));
  const done = applyAction(reload(g), 'emperor', explosionAction(g, 0));
  assert.equal(seat(done, 'emperor').tanks, 2);
  assert.deepEqual(seat(done, 'emperor').leaders, nativeLeaders);
  assert.equal(done.battle, null);
  assert.equal(
    done.homeworlds!.custody!.visitors['homeworld:emperor'],
    undefined,
  );
  inventory(done);
});

void test('normalization restores a previously saved revealed Homeworld battle with no native traitor voters exactly once', () => {
  let g = setup(['atreides', 'guild', 'harkonnen']);
  invade(g, 'atreides', 'homeworld:harkonnen', 3);
  invade(g, 'guild', 'homeworld:harkonnen', 3);
  seat(g, 'harkonnen').tanks += seat(g, 'harkonnen').reserves;
  seat(g, 'harkonnen').reserves = 0;
  g = prepared(g, 'atreides', 'guild', 'homeworld:harkonnen');
  g = commit(g, 'atreides', 1);
  // Reproduce the observed prior persisted frame: both original plans are
  // revealed, but the old engine waited forever for an empty voter set.
  g.battle!.plans.guild = {
    dial: 0,
    support: 0,
    leader: seat(g, 'guild').leaders.find((leader) => leader.strength === 1)!
      .id,
    weapon: null,
    defense: null,
  };
  g.battle!.revealed = true;
  const before = reload(g);
  const done = normalizeAutomaticGame(reload(g));
  assert.deepEqual(g, before);
  assert.equal(done.battle, null);
  assert.equal(done.lastBattleContext!.winner, 'atreides');
  assert.equal(seat(done, 'atreides').tanks, 1);
  assert.equal(seat(done, 'guild').tanks, 3);
  assert.deepEqual(reload(normalizeAutomaticGame(reload(done))), reload(done));
  inventory(done);
});

void test('a real held Portable Snooper gives a nonvoting invader an owned late-defense choice before automatic Homeworld resolution', () => {
  for (const weaponKind of ['poison', 'projectile'])
    for (const use of [false, true]) {
      let g = setup(['atreides', 'guild', 'harkonnen']);
      invade(g, 'atreides', 'homeworld:harkonnen', 3);
      invade(g, 'guild', 'homeworld:harkonnen', 3);
      seat(g, 'harkonnen').tanks += seat(g, 'harkonnen').reserves;
      seat(g, 'harkonnen').reserves = 0;
      g = prepared(g, 'atreides', 'guild', 'homeworld:harkonnen');
      // Explicit single Richese component seam after genuine base setup. The
      // canonical supplemental card has one physical owner; this does not claim
      // that a complete Richese deck, sale or expansion start was exercised.
      const portable = richeseCards().find(
        (card) => card.effect === 'portableSnooper',
      )!;
      seat(g, 'atreides').hand.push(portable);
      const weapon = hold(g, 'guild', weaponKind);
      const leader = seat(g, 'atreides').leaders.find(
        (leader) => leader.strength === 5,
      )!;
      g = commit(g, 'atreides', 1, { leader: leader.id });
      g = commit(reload(g), 'guild', 2, { weapon });
      assert.equal(g.decision?.kind, 'homeworldDefense');
      if (g.decision?.kind !== 'homeworldDefense')
        throw new Error('Missing invader late-defense opportunity.');
      assert.equal(g.decision.player, 'atreides');
      const action: Action = { type: 'decision', event: g.decision.event, use };
      const pending = reload(g);
      for (const candidate of legalBots(pending, 'atreides', 1))
        assert.equal(candidate.use, weaponKind === 'poison');
      assert.deepEqual(
        reload(normalizeAutomaticGame(reload(pending))),
        pending,
      );
      reject(pending, 'guild', action);
      reject(pending, 'atreides', { ...action, event: 'stale' });
      g = applyAction(reload(pending), 'atreides', action);
      assert.equal(
        seat(g, 'atreides').leaders.find(
          (candidate) => candidate.id === leader.id,
        )!.dead,
        !(use && weaponKind === 'poison'),
      );
      assert.equal(
        g.lastBattleContext!.winner,
        use && weaponKind === 'poison' ? 'atreides' : 'guild',
      );
      while (g.decision?.kind === 'battleCards')
        g = applyAction(reload(g), g.decision.player, {
          type: 'decision',
          discard: [],
        });
      assert.equal(g.battle, null);
      reject(g, 'atreides', action);
      assert.equal(
        seat(g, 'atreides').hand.filter((card) => card.id === portable.id)
          .length,
        use && weaponKind === 'projectile' ? 0 : 1,
      );
      assert.equal(
        g.discard.filter((card) => card.id === portable.id).length,
        use && weaponKind === 'projectile' ? 1 : 0,
      );
      inventory(g, 1);
    }
});
