import test from 'node:test';
import { mock } from 'node:test';
import assert from 'node:assert/strict';
import type { DatabaseSync } from 'node:sqlite';
import {
  LEADER_SKILL_CARDS,
  type LeaderSkillId,
} from '../game/leader-skill-cards';
import {
  initializeLeaderSkillsGameForAudit,
  type Action,
  type Game,
} from '../game/engine';
import type { RoomsClock } from '../db/rooms';
import { unitStore } from './fixture-nexus-room-store';

const clock: RoomsClock = { now: () => 10000, sleep: async () => {} };

function assertSkillCustody(game: Game): void {
  assert.ok(game.leaderSkills);
  const physical = [
    ...game.leaderSkills.deck,
    ...game.leaderSkills.assignments.map((assignment) => assignment.skill),
    ...Object.values(game.leaderSkills.offers).flatMap((offer) => offer.cards),
  ];
  const canonical = LEADER_SKILL_CARDS.map((card) => card.id);
  assert.equal(physical.length, 14);
  assert.equal(new Set(physical).size, 14);
  assert.deepEqual([...physical].sort(), [...canonical].sort());
}

function concurrentBarrier() {
  let arrivals = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  return {
    wait: async () => {
      arrivals += 1;
      if (arrivals === 2) release();
      await gate;
    },
    count: () => arrivals,
  };
}

async function fixture(firstSkill?: LeaderSkillId) {
  const store = unitStore();
  const sqlite: DatabaseSync = store.sqlite;
  const created = await store.rooms.createRoom(
    'Leader Skills host',
    'beneGesserit',
    false,
    [],
  );
  const code = created.view.code;
  const tokens = [created.token!];
  for (const [name, faction] of [
    ['Fremen seat', 'fremen'],
    ['Atreides seat', 'atreides'],
  ] as const)
    tokens.push((await store.rooms.joinRoom(code, name, faction)).token!);
  const auths = await Promise.all(
    tokens.map((token) => store.restart().authenticate(code, token)),
  );

  for (const auth of auths) {
    const room = await store.restart().readRoom(code);
    await store
      .restart()
      .act(code, auth, room.version, { type: 'ready' }, clock);
  }
  const ready = await store.restart().readRoom(code);
  const targetIndex = firstSkill
    ? LEADER_SKILL_CARDS.findIndex((card) => card.id === firstSkill)
    : -1;
  let shuffleIndex = LEADER_SKILL_CARDS.length - 1;
  if (firstSkill)
    mock.method(globalThis.crypto, 'getRandomValues', (array: Uint32Array) => {
      array[0] = shuffleIndex-- === targetIndex ? 0 : 0xffffffff;
      return array;
    });
  let initialized: Game;
  try {
    initialized = initializeLeaderSkillsGameForAudit(ready);
  } finally {
    mock.restoreAll();
  }
  if (firstSkill) assert.equal(initialized.leaderSkills!.deck[0], firstSkill);
  sqlite
    .prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
    .run(JSON.stringify(initialized), initialized.version, code);
  return { ...store, sqlite, code, tokens, auths };
}

async function act(
  f: Awaited<ReturnType<typeof fixture>>,
  player: number,
  action: Action,
) {
  const before = await f.restart().readRoom(f.code);
  await f.restart().act(f.code, f.auths[player], before.version, action, clock);
  return f.restart().readRoom(f.code);
}

void test('SQLite restart keeps each private two-card offer and one concurrent selection consumes one card once', async () => {
  const f = await fixture();
  try {
    let game = await f.restart().readRoom(f.code);
    assert.equal(game.status, 'setup');
    assert.equal(game.setupStage, 'prediction');
    game = await act(f, 0, {
      type: 'predict',
      faction: 'atreides',
      turn: 4,
    });
    assert.equal(game.setupStage, 'leaderSkills');
    assertSkillCustody(game);

    const initialOffers = structuredClone(game.leaderSkills!.offers);
    assert.equal(Object.keys(initialOffers).length, 3);
    for (const [index, auth] of f.auths.entries()) {
      const seat = await f.restart().readSeatView(f.code, auth);
      const owner = auth.playerId;
      assert.deepEqual(seat.leaderSkills?.offer, initialOffers[owner]);
      assert.equal(seat.leaderSkills?.assignments.length, 0);
      assert.equal(seat.leaderSkills?.eligibleLeaders.length, 5);
      for (const other of f.auths.filter((candidate) => candidate !== auth))
        assert.notDeepEqual(
          seat.leaderSkills?.offer?.cards,
          initialOffers[other.playerId].cards,
        );
      assert.equal('deck' in seat.leaderSkills!, false);
      assert.equal(seat.players[index].hand?.length, 1);
    }

    const owner = f.auths[0];
    const ownerView = await f.restart().readSeatView(f.code, owner);
    const offer = ownerView.leaderSkills!.offer!;
    const chosenSkill = offer.cards[0];
    const returnedSkill = offer.cards[1];
    const chosenLeader = ownerView.leaderSkills!.eligibleLeaders[0].id;
    const choice: Action = {
      type: 'leaderSkill',
      event: offer.event,
      skill: chosenSkill,
      leader: chosenLeader,
    };
    const beforeVersion = game.version;
    const barrier = concurrentBarrier();
    f.writes.length = 0;
    f.hooks.beforeWrite = barrier.wait;
    const results = await Promise.allSettled([
      f.rooms.act(f.code, owner, beforeVersion, choice, clock),
      f.restart().act(f.code, owner, beforeVersion, choice, clock),
    ]);
    delete f.hooks.beforeWrite;

    assert.equal(barrier.count(), 2);
    assert.equal(
      results.filter((result) => result.status === 'fulfilled').length,
      1,
    );
    assert.equal(
      results.filter((result) => result.status === 'rejected').length,
      1,
    );
    assert.deepEqual(
      f.writes.map((write) => write.changes).sort((a, b) => a - b),
      [0, 1],
    );

    const selected = await f.restart().readRoom(f.code);
    assert.equal(selected.version, beforeVersion + 1);
    assert.equal(selected.leaderSkills!.offers[owner.playerId], undefined);
    assert.deepEqual(
      selected.leaderSkills!.assignments.filter(
        (assignment) => assignment.owner === owner.playerId,
      ),
      [
        {
          owner: owner.playerId,
          leader: chosenLeader,
          skill: chosenSkill,
        },
      ],
    );
    assert.equal(
      selected.leaderSkills!.deck.filter((skill) => skill === returnedSkill)
        .length,
      1,
    );
    assertSkillCustody(selected);

    const ownerAfter = await f.restart().readSeatView(f.code, owner);
    const nextAfter = await f.restart().readSeatView(f.code, f.auths[1]);
    assert.equal(ownerAfter.leaderSkills?.offer, null);
    assert.deepEqual(
      nextAfter.leaderSkills?.offer,
      initialOffers[f.auths[1].playerId],
    );
    assert.deepEqual(
      ownerAfter.leaderSkills?.assignments,
      nextAfter.leaderSkills?.assignments,
    );
    const snapshot = structuredClone(selected);
    await assert.rejects(
      f.restart().act(f.code, owner, beforeVersion, choice, clock),
    );
    assert.deepEqual(await f.restart().readRoom(f.code), snapshot);
  } finally {
    f.sqlite.close();
  }
});

void test('real setup completion preserves prediction, starting hands, assignments and traitor choices across JSON restart', async () => {
  const f = await fixture();
  try {
    let game = await act(f, 0, {
      type: 'predict',
      faction: 'atreides',
      turn: 4,
    });
    assert.equal(game.setupStage, 'leaderSkills');
    const prediction = structuredClone(game.players[0].prediction);
    const startingHands = game.players.map((player) =>
      player.hand.map((card) => card.id),
    );

    for (const [index, auth] of f.auths.entries()) {
      const seat = await f.restart().readSeatView(f.code, auth);
      const offer = seat.leaderSkills!.offer!;
      game = await act(f, index, {
        type: 'leaderSkill',
        event: offer.event,
        skill: offer.cards[0],
        leader: seat.leaderSkills!.eligibleLeaders[0].id,
      });
      assertSkillCustody(game);
    }
    assert.equal(game.setupStage, 'traitors');
    const assignments = structuredClone(game.leaderSkills!.assignments);

    for (const [index] of f.auths.entries()) {
      game = await f.restart().readRoom(f.code);
      const choice = game.players[index].traitorChoices[0];
      assert.ok(choice);
      game = await act(f, index, { type: 'traitor', leader: choice });
    }
    assert.equal(game.setupStage, 'forces');
    const traitors = game.players.map((player) => [...player.traitors]);
    game = await act(f, 1, {
      type: 'fremenSetup',
      placements: { sietch_tabr: 10 },
    });
    assert.equal(game.status, 'playing');
    assert.equal(game.setupStage, undefined);
    assert.deepEqual(game.players[0].prediction, prediction);
    assert.deepEqual(
      game.players.map((player) => player.hand.map((card) => card.id)),
      startingHands,
    );
    assert.deepEqual(
      game.players.map((player) => player.traitors),
      traitors,
    );
    assert.deepEqual(game.leaderSkills!.assignments, assignments);
    assert.deepEqual(game.leaderSkills!.offers, {});
    assertSkillCustody(game);

    const persisted = structuredClone(game);
    assert.deepEqual(await f.restart().readRoom(f.code), persisted);
    for (const [index, auth] of f.auths.entries()) {
      const seat = await f.restart().readSeatView(f.code, auth);
      assert.deepEqual(
        seat.leaderSkills?.assignments,
        assignments.map((assignment) => ({
          ...assignment,
          controller: assignment.owner,
          captured: false,
          faceUp: true,
        })),
      );
      assert.equal(seat.leaderSkills?.offer, null);
      assert.deepEqual(
        seat.players[index].hand?.map((card) => card.id),
        startingHands[index],
      );
      for (const [otherIndex, player] of seat.players.entries())
        if (otherIndex !== index) assert.equal(player.hand, undefined);
    }
  } finally {
    f.sqlite.close();
  }
});

void test('battle death and Ghola revival preserve one private replacement skill through restart and concurrent selection', async () => {
  const f = await fixture('rihani-decipherer');
  try {
    let game = await act(f, 0, {
      type: 'predict',
      faction: 'atreides',
      turn: 4,
    });
    assert.equal(
      game.leaderSkills!.offers[f.auths[0].playerId].cards[0],
      'rihani-decipherer',
    );
    for (const [index, auth] of f.auths.entries()) {
      const seat = await f.restart().readSeatView(f.code, auth);
      const offer = seat.leaderSkills!.offer!;
      game = await act(f, index, {
        type: 'leaderSkill',
        event: offer.event,
        skill: offer.cards[0],
        leader: seat.leaderSkills!.eligibleLeaders[0].id,
      });
    }
    for (const [index] of f.auths.entries()) {
      game = await f.restart().readRoom(f.code);
      game = await act(f, index, {
        type: 'traitor',
        leader: game.players[index].traitorChoices[0],
      });
    }
    game = await act(f, 1, {
      type: 'fremenSetup',
      placements: { sietch_tabr: 10 },
    });
    assert.equal(game.status, 'playing');

    const atreidesAuth = f.auths[2];
    const bgAuth = f.auths[0];
    const atreides = game.players.find(
      (player) => player.id === atreidesAuth.playerId,
    )!;
    const bg = game.players.find((player) => player.id === bgAuth.playerId)!;
    const oldAssignment = game.leaderSkills!.assignments.find(
      (assignment) => assignment.owner === atreides.id,
    )!;
    for (const player of game.players) {
      game.deck.push(...player.hand);
      player.hand = [];
      player.reserves += Object.values(player.forces).reduce(
        (sum, amount) => sum + amount,
        0,
      );
      player.forces = {};
    }
    const gholaIndex = game.deck.findIndex((card) => card.effect === 'ghola');
    const poisonIndex = game.deck.findIndex((card) => card.kind === 'poison');
    assert.ok(gholaIndex >= 0 && poisonIndex >= 0);
    const [ghola] = game.deck.splice(gholaIndex, 1);
    const adjustedPoisonIndex = game.deck.findIndex(
      (card) => card.kind === 'poison',
    );
    const [poison] = game.deck.splice(adjustedPoisonIndex, 1);
    atreides.hand.push(ghola);
    bg.hand.push(poison);
    atreides.reserves -= 5;
    atreides.forces['arrakeen:10'] = 5;
    bg.reserves -= 5;
    bg.forces['arrakeen:10'] = 5;
    Object.assign(game, {
      phase: 6,
      storm: 18,
      order: [atreides.id, bg.id, f.auths[1].playerId],
      active: atreides.id,
      ready: [],
      decision: null,
      response: null,
      phaseOpening: null,
    });
    f.sqlite
      .prepare('UPDATE rooms SET state = ? WHERE code = ?')
      .run(JSON.stringify(game), f.code);

    game = await act(f, 2, {
      type: 'chooseBattle',
      territory: 'arrakeen',
      target: bg.id,
    });
    while (game.decision?.kind === 'leaderSkillVisibility') {
      const owner = f.auths.findIndex(
        (auth) => auth.playerId === game.decision!.player,
      );
      assert.ok(owner >= 0);
      game = await act(f, owner, {
        type: 'leaderSkillVisibility',
        event: game.decision.event,
        hide: true,
      });
    }
    while (game.battle?.preparation) {
      const owner = f.auths.findIndex(
        (auth) => auth.playerId === game.battle!.preparation!.owner,
      );
      assert.ok(owner >= 0);
      game = await act(f, owner, { type: 'declineBattlePower' });
    }
    game = await act(f, 2, {
      type: 'battlePlan',
      dial: 0,
      leader: oldAssignment.leader,
    });
    const bgLeader = game.leaderSkills!.assignments.find(
      (assignment) => assignment.owner === bg.id,
    )!.leader;
    game = await act(f, 0, {
      type: 'battlePlan',
      dial: 1,
      leader: bgLeader,
      weapon: poison.id,
    });
    game = await act(f, 2, { type: 'traitorCall', call: false });
    game = await act(f, 0, { type: 'traitorCall', call: false });

    const dead = game.players
      .find((player) => player.id === atreides.id)!
      .leaders.find((leader) => leader.id === oldAssignment.leader)!;
    assert.equal(dead.dead, true);
    assert.equal(
      game.leaderSkills!.assignments.some(
        (assignment) => assignment.owner === atreides.id,
      ),
      false,
    );
    assert.equal(
      game.leaderSkills!.deck.filter((skill) => skill === oldAssignment.skill)
        .length,
      1,
    );
    assertSkillCustody(game);
    // The seeded winner has a real saved Rihani choice before card cleanup.
    assert.equal(game.decision?.kind, 'rihani');
    const owner = f.auths.findIndex(
      (auth) => auth.playerId === game.decision!.player,
    );
    assert.ok(owner >= 0);
    const seat = await f.restart().readSeatView(f.code, f.auths[owner]);
    assert.equal(seat.automaticContinuationPending, false);
    assert.equal(seat.decision?.kind, 'rihani');
    game = await act(f, owner, {
      type: 'decision',
      event: seat.decision.event,
      draw: false,
    });
    if (game.decision?.kind === 'battleCards')
      game = await act(
        f,
        f.auths.findIndex((auth) => auth.playerId === game.decision!.player),
        { type: 'decision', discard: [] },
      );

    game = await act(f, 2, {
      type: 'card',
      card: ghola.id,
      leader: oldAssignment.leader,
    });
    assert.equal(game.decision?.kind, 'leaderSkillRevival');
    assert.equal(game.discard.filter((card) => card.id === ghola.id).length, 1);
    const undrawn = await f.restart().readSeatView(f.code, atreidesAuth);
    assert.deepEqual(undrawn.leaderSkills!.offer!.cards, []);
    assert.equal(
      (await f.restart().readSeatView(f.code, bgAuth)).leaderSkills!.offer,
      null,
    );

    const event = undrawn.leaderSkills!.offer!.event;
    game = await act(f, 2, {
      type: 'leaderSkill',
      event,
      mode: 'draw',
    });
    const drawn = await f.restart().readSeatView(f.code, atreidesAuth);
    const cards = [...drawn.leaderSkills!.offer!.cards];
    assert.equal(cards.length, 2);
    assert.equal(
      (await f.restart().readSeatView(f.code, bgAuth)).leaderSkills!.offer,
      null,
    );
    const choice: Action = {
      type: 'leaderSkill',
      event,
      skill: cards[0],
      leader: oldAssignment.leader,
    };
    const beforeVersion = game.version;
    const barrier = concurrentBarrier();
    f.writes.length = 0;
    f.hooks.beforeWrite = barrier.wait;
    const results = await Promise.allSettled([
      f.rooms.act(f.code, atreidesAuth, beforeVersion, choice, clock),
      f.restart().act(f.code, atreidesAuth, beforeVersion, choice, clock),
    ]);
    delete f.hooks.beforeWrite;
    assert.equal(barrier.count(), 2);
    assert.equal(
      results.filter((result) => result.status === 'fulfilled').length,
      1,
    );
    assert.equal(
      results.filter((result) => result.status === 'rejected').length,
      1,
    );
    assert.deepEqual(
      f.writes.map((write) => write.changes).sort((a, b) => a - b),
      [0, 1],
    );

    const selected = await f.restart().readRoom(f.code);
    assert.equal(selected.version, beforeVersion + 1);
    assert.deepEqual(
      selected.leaderSkills!.assignments.filter(
        (assignment) => assignment.owner === atreides.id,
      ),
      [
        {
          owner: atreides.id,
          leader: oldAssignment.leader,
          skill: cards[0],
        },
      ],
    );
    assert.equal(
      selected.leaderSkills!.deck.filter((skill) => skill === cards[0]).length,
      0,
    );
    assert.equal(
      selected.leaderSkills!.deck.filter((skill) => skill === cards[1]).length,
      1,
    );
    assertSkillCustody(selected);

    const snapshot = structuredClone(selected);
    await assert.rejects(
      f.restart().act(f.code, atreidesAuth, selected.version, choice, clock),
    );
    assert.deepEqual(await f.restart().readRoom(f.code), snapshot);
  } finally {
    f.sqlite.close();
  }
});
