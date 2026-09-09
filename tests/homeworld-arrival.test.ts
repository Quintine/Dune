import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, newPlayer, type Game } from '../game/engine';
import { createHomeworldCustody } from '../game/homeworld-custody';
import { homeworldContext } from '../game/homeworld-game';
import {
  homeworldArrivalSignature,
  appendHomeworldArrivalAmbassador,
  completeHomeworldArrivalAmbassador,
  validateHomeworldArrival,
} from '../game/homeworld-arrival';
import {
  makeHomeworldVictoryReturn,
  homeworldVictoryObligationSignature,
  homeworldVictoryOfferSignature,
} from '../game/homeworld-victory-return';
import { ambassadorPhaseAllowed } from '../game/ambassador-phase';

function fixture() {
  const g = createGame('ARRIVAL', newPlayer('a', 'Atreides', 'atreides'), true);
  g.players.push(
    newPlayer('h', 'Harkonnen', 'harkonnen'),
    newPlayer('e', 'Ecaz', 'ecaz'),
    newPlayer('b', 'BG', 'beneGesserit'),
  );
  g.turn = 2;
  g.phase = 6;
  g.homeworlds = { custody: createHomeworldCustody(homeworldContext(g)) };
  g.lastBattleContext = {
    event: 'won:2:1',
    turn: 2,
    territory: 'arrakeen',
    combatants: ['a', 'h'],
    winner: 'a',
    result: 'normal',
  };
  g.lastBattleContext.caladanReinforcement = {
    event: g.lastBattleContext.event,
    completed: false,
    stage: 'arrival',
    signature: homeworldVictoryObligationSignature(
      g.lastBattleContext,
      false,
      'arrival',
    ),
  };
  const frame = makeHomeworldVictoryReturn({
    event: 'won:2:1',
    turn: 2,
    player: 'a',
    territory: 'arrakeen',
    result: 'normal',
  });
  const offer = { population: 6, survivors: 1, blocked: null };
  frame.offer = {
    ...offer,
    signature: homeworldVictoryOfferSignature(frame, offer),
  };
  frame.stage = 'arrival';
  frame.destination = 'arrakeen:10';
  frame.ambassadors = [];
  frame.arrivalSignature = homeworldArrivalSignature(frame);
  g.homeworldVictoryReinforcement = frame;
  g.pendingAmbassador = {
    event: 'ambassador:2:6:1',
    owner: 'e',
    entrant: 'a',
    territory: 'arrakeen',
    sector: 10,
    turn: 2,
    phase: 6,
    victoryEvent: frame.event,
    token: 'guild',
    stage: 'offer',
    copyChoices: [],
    resume: 'none',
  };
  appendHomeworldArrivalAmbassador(frame, g.pendingAmbassador);
  return g;
}

void test('shared arrival preserves the persisted signature format while binding a distinct victory source', () => {
  const g = fixture();
  const frame = g.homeworldVictoryReinforcement!;
  assert.equal(
    frame.arrivalSignature,
    JSON.stringify([
      'homeworldRevivalArrival',
      frame.signature,
      'arrakeen:10',
      [['ambassador:2:6:1', 'a', 'arrakeen:10', null, false]],
    ]),
  );
  validateHomeworldArrival(g, frame, 'victoryEvent');
  assert.equal(ambassadorPhaseAllowed(g), true);
  assert.equal(
    ambassadorPhaseAllowed(JSON.parse(JSON.stringify(g)) as Game),
    true,
  );
  assert.throws(() => validateHomeworldArrival(g, frame, 'revivalEvent'));
});

void test('victory phase permission needs both the original battle obligation and exact arrival tag', () => {
  const original = fixture();
  for (const mutate of [
    (g: Game) => {
      delete g.lastBattleContext!.caladanReinforcement;
    },
    (g: Game) => {
      g.lastBattleContext!.winner = 'h';
    },
    (g: Game) => {
      g.lastBattleContext!.event = 'other';
    },
    (g: Game) => {
      delete g.pendingAmbassador!.victoryEvent;
    },
    (g: Game) => {
      g.pendingAmbassador!.revivalEvent = g.pendingAmbassador!.victoryEvent;
    },
    (g: Game) => {
      delete g.homeworldVictoryReinforcement;
    },
  ]) {
    const g = structuredClone(original);
    mutate(g);
    const before = JSON.stringify(g);
    assert.equal(ambassadorPhaseAllowed(g), false);
    assert.equal(JSON.stringify(g), before);
  }
});

void test('shared completion cannot be skipped or replayed and actual BG child keeps its own source tag', () => {
  const g = fixture();
  const frame = g.homeworldVictoryReinforcement!;
  const parent = g.pendingAmbassador!;
  const child = {
    ...parent,
    event: 'ambassador:2:6:2',
    entrant: 'b',
    territory: 'carthag',
    sector: 11,
    guildAdvisorOrigin: {
      event: parent.event,
      player: 'h',
      territory: 'carthag',
      sector: 11,
    },
  };
  const before = JSON.stringify(frame);
  assert.throws(() =>
    appendHomeworldArrivalAmbassador(frame, child, parent.event),
  );
  assert.equal(JSON.stringify(frame), before);
  g.pendingAmbassador = null;
  assert.throws(() => validateHomeworldArrival(g, frame, 'victoryEvent'));
  frame.stage = 'complete';
  assert.throws(() => validateHomeworldArrival(g, frame, 'victoryEvent'));
  frame.stage = 'arrival';
  g.pendingAmbassador = parent;
  completeHomeworldArrivalAmbassador(frame, parent.event);
  assert.throws(() => completeHomeworldArrivalAmbassador(frame, parent.event));
  appendHomeworldArrivalAmbassador(frame, child, parent.event);
  g.pendingAmbassador = child;
  assert.equal(ambassadorPhaseAllowed(g), true);
  completeHomeworldArrivalAmbassador(frame, child.event);
  g.pendingAmbassador = null;
  frame.stage = 'complete';
  validateHomeworldArrival(g, frame, 'victoryEvent');
  g.pendingAmbassador = parent;
  assert.throws(() => validateHomeworldArrival(g, frame, 'victoryEvent'));
});

void test('arrival signatures reject malformed histories without depending on forces or private inventories', () => {
  const g = fixture();
  const frame = g.homeworldVictoryReinforcement!;
  for (const p of g.players)
    for (const key of [
      'hand',
      'spice',
      'forces',
      'reserves',
      'tanks',
      'traitors',
    ])
      Object.defineProperty(p, key, {
        get() {
          throw new Error(`unrelated ${key}`);
        },
      });
  validateHomeworldArrival(g, frame, 'victoryEvent');
  for (const mutate of [
    (value: typeof frame) => {
      value.ambassadors![0].completed = true;
    },
    (value: typeof frame) => {
      value.ambassadors![0].parent = 'self';
    },
    (value: typeof frame) => {
      value.ambassadors![0].destination = 'arrakeen:9';
    },
    (value: typeof frame) => {
      value.ambassadors!.push({ ...value.ambassadors![0] });
    },
  ]) {
    const copy = structuredClone(frame);
    mutate(copy);
    const before = JSON.stringify(copy);
    assert.throws(() => validateHomeworldArrival(g, copy, 'victoryEvent'));
    assert.equal(JSON.stringify(copy), before);
  }
});
