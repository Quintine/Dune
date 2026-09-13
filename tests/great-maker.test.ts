import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  initializeDiscoveryGameForAudit,
  joinGame,
  newPlayer,
  viewGame,
  type Action,
  type Game,
} from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { spiceDeck } from '../game/cards';

const LAND = spiceDeck().filter((card) => 'territory' in card);
const SOURCE = LAND.find((card) => card.territory === 'broken_land')!;

function fixture(): Game {
  let g = createGame('GREATMAKER', newPlayer('f', 'Fremen', 'fremen'));
  joinGame(g, newPlayer('a', 'Atreides', 'atreides'));
  joinGame(g, newPlayer('g', 'Guild', 'guild'));
  joinGame(g, newPlayer('e', 'Emperor', 'emperor'));
  g.discoveryEnabled = true;
  for (const player of g.players)
    g = applyAction(g, player.id, { type: 'ready' });
  g = initializeDiscoveryGameForAudit(g);
  while (g.setupStage === 'traitors') {
    const player = g.players.find(
      (candidate) => candidate.traitorChoices.length,
    );
    assert.ok(player);
    g = applyAction(g, player.id, {
      type: 'traitor',
      leader: player.traitorChoices[0],
    });
  }
  g = applyAction(g, 'f', {
    type: 'fremenSetup',
    placements: { sietch_tabr: 10 },
  });
  assert.equal(g.status, 'playing');
  return g;
}

function ready(state: Game): Game {
  let g = state;
  for (const player of g.players)
    g = applyAction(g, player.id, { type: 'ready' });
  return g;
}

function encounter(priorNexus = false): Game {
  const g = fixture();
  const greatMakerIndex = g.spiceDeck.findIndex(
    (card) => 'worm' in card && card.greatMaker,
  );
  const sourceIndex = g.spiceDeck.findIndex(
    (card) =>
      'territory' in card &&
      card.territory === SOURCE.territory &&
      card.discovery === undefined,
  );
  assert.ok(greatMakerIndex >= 0);
  assert.ok(sourceIndex >= 0);
  const [greatMaker] = g.spiceDeck.splice(greatMakerIndex, 1);
  const adjustedSourceIndex = g.spiceDeck.findIndex(
    (card) =>
      'territory' in card &&
      card.territory === SOURCE.territory &&
      card.discovery === undefined,
  );
  const [source] = g.spiceDeck.splice(adjustedSourceIndex, 1);
  const replacementIndex = g.spiceDeck.findIndex(
    (card) => 'territory' in card && card.discovery === undefined,
  );
  assert.ok(replacementIndex >= 0);
  const [replacement] = g.spiceDeck.splice(replacementIndex, 1);
  assert.ok(
    greatMaker,
    'the Discovery setup must create the physical Great Maker card',
  );
  Object.assign(g, {
    turn: 2,
    phase: 1,
    storm: 18,
    nexus: false,
    summonedBeforeBlow: priorNexus,
    wormRides: priorNexus ? ['red_chasm'] : [],
    spiceSequence: null,
    spiceResolution: null,
    spiceWindow: null,
    response: null,
    decision: null,
    ready: [],
  });
  for (const player of g.players) {
    g.deck.push(...player.hand);
    Object.assign(player, {
      hand: [],
      forces: {},
      reserves: 20,
      tanks: 0,
      ally: null,
    });
  }
  g.players.find((player) => player.id === 'f')!.forces = {
    [`${SOURCE.territory}:${SOURCE.sector}`]: 4,
  };
  g.players.find((player) => player.id === 'f')!.reserves = 16;
  g.players.find((player) => player.id === 'a')!.forces = {
    [`${SOURCE.territory}:${SOURCE.sector}`]: 3,
  };
  g.players.find((player) => player.id === 'a')!.reserves = 17;
  g.spice = { [`${SOURCE.territory}:${SOURCE.sector}`]: 7 };
  g.spiceDiscard = [[source], []];
  g.spiceDeck = [greatMaker, replacement, ...g.spiceDeck];
  const result = ready(g);
  assert.equal(result.turn, 2);
  assert.equal(result.phase, 1);
  assert.equal(result.greatMaker?.stage, 'vote');
  assert.equal(result.decision?.kind, 'greatMakerVote');
  return result;
}

function vote(state: Game, choices: readonly boolean[]): Game {
  let g = state;
  for (const yes of choices) {
    assert.equal(g.decision?.kind, 'greatMakerVote');
    const decision = g.decision;
    g = applyAction(g, decision.player, {
      type: 'decision',
      event: decision.event,
      yes,
    });
  }
  return g;
}

function rejectUnchanged(
  state: Game,
  player: string,
  action: Action,
  message?: RegExp,
) {
  const before = structuredClone(state);
  if (message) assert.throws(() => applyAction(state, player, action), message);
  else assert.throws(() => applyAction(state, player, action));
  assert.deepEqual(state, before);
}

void test('Great Maker waits for every storm-order vote, requires a strict majority, and a tie does not erase an existing Nexus', () => {
  let g = encounter(true);
  const order = [...g.order];
  assert.deepEqual(g.greatMaker?.order, order);
  assert.equal(g.decision?.player, order[0]);

  rejectUnchanged(g, order[1], {
    type: 'decision',
    event: g.greatMaker!.event,
    yes: true,
  });
  g = vote(g, [true, false, true]);
  assert.equal(g.greatMaker?.stage, 'vote');
  assert.equal(g.decision?.player, order[3]);
  assert.equal(
    g.nexus,
    true,
    'the Nexus that existed before the blow remains active',
  );
  g = vote(g, [false]);
  assert.deepEqual(
    g.greatMaker?.votes,
    order.map((player, index) => ({
      player,
      yes: [true, false, true, false][index],
    })),
  );
  assert.equal(
    g.nexus,
    true,
    'a tied Great Maker vote must not erase an earlier Nexus',
  );
  assert.equal(g.greatMaker?.stage, 'ride');
  assert.equal(g.decision?.kind, 'greatMakerRide');
});

void test('Great Maker creates a Nexus only after the complete ordered majority vote', () => {
  let g = encounter();
  g = vote(g, [true, true, true]);
  assert.equal(
    g.nexus,
    false,
    'even a secured majority waits for the remaining voter',
  );
  assert.equal(g.greatMaker?.stage, 'vote');
  g = vote(g, [false]);
  assert.equal(g.nexus, true);
  assert.equal(g.greatMaker?.stage, 'ride');

  let tied = encounter();
  tied = vote(tied, [true, false, true, false]);
  assert.equal(tied.nexus, false);
});

void test('Great Maker resolves ordinary worm devastation, then rides only reserve Fremen forces for free', () => {
  let g = encounter();
  const source = `${SOURCE.territory}:${SOURCE.sector}`;
  const fremen = g.players.find((player) => player.id === 'f')!;
  const atreides = g.players.find((player) => player.id === 'a')!;
  assert.equal(
    fremen.forces[source],
    4,
    'Fremen survive the ordinary worm effect',
  );
  assert.equal(fremen.tanks, 0);
  assert.equal(atreides.forces[source], undefined);
  assert.equal(atreides.tanks, 3);
  assert.equal(g.spice[source], undefined);
  assert.deepEqual(
    g.wormRides,
    [],
    'the board army is not queued as this reserve ride',
  );

  g = vote(g, [false, false, false, false]);
  assert.equal(g.decision?.kind, 'greatMakerRide');
  const event = g.greatMaker!.event;
  const before = {
    reserves: fremen.reserves,
    spice: fremen.spice,
    shipped: fremen.shipped,
    moved: fremen.moved,
    source: fremen.forces[source],
  };
  g = applyAction(g, 'f', {
    type: 'decision',
    event,
    accept: true,
    territory: 'polar_sink',
    sector: 0,
    amount: 2,
    elite: 0,
  });
  const after = g.players.find((player) => player.id === 'f')!;
  assert.equal(after.reserves, before.reserves - 2);
  assert.equal(after.forces['polar_sink:0'], 2);
  assert.equal(
    after.forces[source],
    before.source,
    'board forces stay at the worm territory',
  );
  assert.equal(after.spice, before.spice);
  assert.equal(after.shipped, before.shipped);
  assert.equal(after.moved, before.moved);
  assert.deepEqual(g.wormRides, []);
  assert.equal(g.greatMaker?.stage, 'complete');
  assert.notEqual(g.decision?.kind, 'wormRide');
});

void test('Great Maker rejects malformed, out-of-order, reserve-source and stale decisions without mutation', () => {
  let g = encounter();
  assert.ok(g.decision?.kind === 'greatMakerVote');
  const current = g.decision;
  const next = g.greatMaker!.order[1];
  rejectUnchanged(g, next, {
    type: 'decision',
    event: current.event,
    yes: true,
  });
  rejectUnchanged(g, current.player, {
    type: 'decision',
    event: 'stale',
    yes: true,
  });
  rejectUnchanged(g, current.player, {
    type: 'decision',
    event: current.event,
    yes: true,
    extra: true,
  });
  rejectUnchanged(g, current.player, {
    type: 'decision',
    event: current.event,
    yes: 'yes',
  });

  g = applyAction(g, current.player, {
    type: 'decision',
    event: current.event,
    yes: true,
  });
  rejectUnchanged(g, current.player, {
    type: 'decision',
    event: current.event,
    yes: false,
  });
  g = vote(g, [false, false, false]);
  assert.ok(g.decision?.kind === 'greatMakerRide');
  const ride = g.decision;
  rejectUnchanged(g, 'a', {
    type: 'decision',
    event: ride.event,
    accept: false,
  });
  rejectUnchanged(g, 'f', {
    type: 'decision',
    event: 'stale',
    accept: false,
  });
  rejectUnchanged(g, 'f', {
    type: 'decision',
    event: ride.event,
    accept: false,
    territory: 'polar_sink',
  });
  rejectUnchanged(g, 'f', {
    type: 'decision',
    event: ride.event,
    accept: true,
    from: `${SOURCE.territory}:${SOURCE.sector}`,
    territory: 'polar_sink',
    sector: 0,
    amount: 1,
    elite: 0,
  });
  const declined = applyAction(g, 'f', {
    type: 'decision',
    event: ride.event,
    accept: false,
  });
  rejectUnchanged(declined, 'f', {
    type: 'decision',
    event: ride.event,
    accept: false,
  });
});

void test('Great Maker survives JSON restoration, exposes only public progress, detaches projections, and gives every AI profile legal choices', () => {
  const restored = JSON.parse(JSON.stringify(encounter())) as Game;
  const decision = restored.decision!;
  for (const player of restored.players) {
    const view = viewGame(restored, player.id);
    assert.ok(view.greatMaker);
    assert.equal(view.greatMaker.event, restored.greatMaker!.event);
    assert.deepEqual(view.greatMaker.order, restored.order);
    assert.deepEqual(view.greatMaker.votes, []);
    assert.equal(view.greatMaker.ride, null);
    assert.equal('territory' in view.greatMaker, false);
    assert.equal('ridesBefore' in view.greatMaker, false);
    assert.equal('signature' in view.greatMaker, false);
    assert.equal('pile' in view.greatMaker, false);
    assert.equal('index' in view.greatMaker, false);
  }

  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(restored, decision.player);
    view.players.find((player) => player.id === decision.player)!.bot =
      difficulty;
    const before = structuredClone(view);
    const actions = botActions(view);
    assert.deepEqual(view, before);
    assert.equal(actions.length, 1);
    assert.doesNotThrow(() =>
      applyAction(restored, decision.player, actions[0]),
    );
  }

  const projected = viewGame(restored, decision.player);
  const authoritative = structuredClone(restored);
  projected.greatMaker!.votes.push({ player: 'outside', yes: true });
  projected.greatMaker!.order.reverse();
  assert.deepEqual(
    restored,
    authoritative,
    'a projected vote history must not alias authoritative state',
  );

  let ride = vote(restored, [true, false, true, false]);
  ride = JSON.parse(JSON.stringify(ride)) as Game;
  assert.equal(ride.decision?.kind, 'greatMakerRide');
  for (const player of ride.players) {
    const view = viewGame(ride, player.id);
    assert.equal(view.greatMaker?.ride !== null, player.faction === 'fremen');
  }
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(ride, 'f');
    view.players.find((player) => player.id === 'f')!.bot = difficulty;
    const before = structuredClone(view);
    const actions = botActions(view);
    assert.deepEqual(view, before);
    assert.ok(actions.some((action) => action.accept === true));
    assert.ok(actions.some((action) => action.accept === false));
    for (const action of actions)
      assert.doesNotThrow(
        () => applyAction(ride, 'f', action),
        `${difficulty}: ${JSON.stringify(action)}`,
      );
  }
});
