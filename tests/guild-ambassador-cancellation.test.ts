import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  newPlayer,
  type Game,
  type ResponseWindow,
} from '../game/engine';
import { createAmbassadors, triggerAmbassador } from '../game/ecaz-ambassadors';
import { createTerrorState, placeTerror } from '../game/moritani-terror';
import type { GuildAmbassadorArrivalNext } from '../game/guild-ambassador-continuation';
import {
  quoteMovementCancellation,
  MovementCancellationError,
} from '../game/karama-movement-cancellation';
import {
  quoteMoritaniAllianceCancellation,
  MoritaniAllianceCancellationError,
} from '../game/moritani-alliance-cancellation';
import {
  validateTerminalCancellation,
  TerminalCancellationError,
} from '../game/terminal-cancellation';
const reload = <T>(value: T): T => JSON.parse(JSON.stringify(value));
/** Explicit postcommit unit receipt, not a claimed complete dispatcher journey. */
function fixture(
  next: GuildAmbassadorArrivalNext = 'accompany',
  copied = false,
  phase = 5,
) {
  const g = createGame('GUILD-RECEIPT', newPlayer('e', 'Ecaz', 'ecaz'), true);
  g.players.push(
    newPlayer('p', 'Beneficiary', 'ixians'),
    newPlayer('f', 'Original entrant', 'fremen'),
    newPlayer('b', 'BG', 'beneGesserit'),
    newPlayer('m', 'Moritani', 'moritani'),
  );
  Object.assign(g, {
    status: 'playing',
    phase,
    turn: 4,
    storm: 18,
    active: phase === 5 ? 'f' : null,
  });
  g.players[0].ally = 'p';
  g.players[1].ally = 'e';
  const ambassadors = createAmbassadors(() => 0);
  const physical = ambassadors.tokens.find(
    (t) => t.effect === (copied ? 'beneGesserit' : 'guild'),
  )!;
  const others = ambassadors.tokens
    .filter(
      (t) =>
        t.effect !== 'ecaz' && t.effect !== 'guild' && t.id !== physical.id,
    )
    .slice(0, 4);
  ambassadors.cohort = [physical.id, ...others.map((t) => t.id)];
  for (const token of ambassadors.tokens) {
    token.zone =
      token.effect === 'ecaz' || ambassadors.cohort.includes(token.id)
        ? 'supply'
        : 'pool';
    token.location = null;
  }
  physical.zone = 'placed';
  physical.location = 'arrakeen';
  g.ecazAmbassadors = triggerAmbassador(ambassadors, physical.id);
  g.pendingAmbassador = {
    event: 'ambassador:4:1',
    owner: 'e',
    entrant: 'f',
    beneficiary: 'p',
    token: physical.id,
    territory: 'arrakeen',
    sector: 10,
    turn: 4,
    phase,
    stage: 'arrival',
    effect: 'guild',
    copyChoices: copied ? ['guild'] : [],
    resume: phase === 1 ? 'wormRide' : 'none',
    shipmentReceipt: {
      next,
      order: {
        player: 'p',
        amount: 4,
        elite: 2,
        territory: 'carthag',
        sector: 11,
        advisors: false,
        cost: 0,
        allyPayment: 0,
      },
      ...(next === 'finish'
        ? {
            advisorArrival: {
              player: 'b',
              territory: 'carthag',
              sector: 11,
              amount: 1,
              elite: 0,
            } as const,
          }
        : {}),
    },
  };
  return g;
}
type Kind = 'intrusion' | 'primaryTerror' | 'advisorTerror' | 'advisor';
function context(kind: Kind, phase = 5, copied = false) {
  const next =
    kind === 'intrusion'
      ? 'terror'
      : kind === 'primaryTerror'
        ? 'accompany'
        : kind === 'advisorTerror'
          ? 'finish'
          : 'advisor';
  const g = fixture(next, copied, phase);
  const event = g.pendingAmbassador!.event;
  let response: ResponseWindow;
  if (kind === 'intrusion')
    response = {
      kind: 'advisorFlip',
      owner: 'b',
      location: 'carthag',
      advisors: true,
      advisorResume: 'ambassador',
      advisorAmbassadorEvent: event,
      passed: [],
    };
  else if (kind === 'advisor')
    response = {
      kind: 'advisor',
      owner: 'b',
      location: 'carthag:11',
      advisorResume: 'ambassador',
      advisorAmbassadorEvent: event,
      passed: [],
    };
  else {
    g.moritaniTerror = createTerrorState(() => 0);
    const token = g.moritaniTerror.tokens.find((t) => t.kind === 'robbery')!;
    g.moritaniTerror = placeTerror(g.moritaniTerror, token.id, 'carthag', 1);
    const source =
      kind === 'advisorTerror'
        ? g.pendingAmbassador!.shipmentReceipt!.advisorArrival!
        : g.pendingAmbassador!.shipmentReceipt!.order;
    g.pendingTerrorEntry = {
      token: token.id,
      entrant: source.player,
      territory: source.territory,
      sector: source.sector,
      amount: source.amount,
      elite: source.elite,
      turn: g.turn,
      phase: g.phase,
      cause: 'ambassador',
      resume: 'ambassador',
      ambassadorEvent: event,
      stage: 'allianceResponse',
    };
    response = { kind: 'moritaniAlliance', owner: 'm', passed: [] };
  }
  return { g, response };
}
function run(kind: Kind, g: Game, response: ResponseWindow) {
  return kind === 'intrusion'
    ? quoteMovementCancellation(g, response)
    : kind === 'advisor'
      ? validateTerminalCancellation(g, response)
      : quoteMoritaniAllianceCancellation(g, response);
}
const errorClass = (kind: Kind) =>
  kind === 'intrusion'
    ? MovementCancellationError
    : kind === 'advisor'
      ? TerminalCancellationError
      : MoritaniAllianceCancellationError;

for (const kind of [
  'intrusion',
  'primaryTerror',
  'advisorTerror',
  'advisor',
] as const)
  void test(`${kind}: Guild Ambassador cancellation preserves historical shipment through JSON and private changes`, () => {
    for (const phase of [1, 5])
      for (const copied of [false, true]) {
        const { g, response } = context(kind, phase, copied);
        g.storm = 11;
        for (const p of g.players) {
          p.ally = null;
          p.forces = {};
          p.reserves = 0;
          p.tanks = 20;
          p.hand = [];
          p.spice = 0;
        }
        const before = JSON.stringify(g);
        const result = run(kind, reload(g), reload(response));
        if (kind === 'intrusion')
          assert.deepEqual(result, {
            kind: 'advisorFlip',
            successor: 'ambassador',
          });
        else if (kind === 'advisor')
          assert.deepEqual(result, {
            kind: 'advisor',
            owner: 'b',
            successor: 'ambassador',
          });
        else {
          assert.equal(result?.kind, 'moritaniAlliance');
          if (result?.kind !== 'moritaniAlliance') assert.fail();
          assert.equal(result.entry.stage, 'offer');
          assert.equal(result.entry.allianceBlocked, true);
          assert.equal(
            result.entry.ambassadorEvent,
            g.pendingAmbassador!.event,
          );
          assert.equal(
            result.entry.entrant,
            kind === 'advisorTerror' ? 'b' : 'p',
          );
        }
        assert.equal(JSON.stringify(g), before);
      }
  });

void test('every Guild child rejects a changed event, owner, stage or parent without mutation', () => {
  const changes: ((g: Game, r: ResponseWindow) => void)[] = [
    (g) => {
      g.pendingAmbassador!.event = 'stale';
    },
    (g) => {
      g.pendingAmbassador!.turn++;
    },
    (g) => {
      g.pendingAmbassador!.phase = 4;
    },
    (g) => {
      g.pendingAmbassador!.stage = 'ship';
    },
    (g) => {
      g.pendingAmbassador!.effect = 'richese';
    },
    (g) => {
      g.pendingAmbassador!.beneficiary = 'missing';
    },
    (g) => {
      Object.assign(g.pendingAmbassador!.shipmentReceipt!, { next: 'forged' });
    },
    (g) => {
      g.pendingAmbassador!.shipmentReceipt!.order.player = 'e';
    },
    (g) => {
      Object.assign(g.pendingAmbassador!.shipmentReceipt!.order, { cost: 1 });
    },
    (g) => {
      g.pendingAmbassador!.copyChoices = [];
    },
    (_, r) => {
      r.owner = 'p';
    },
  ];
  for (const kind of [
    'intrusion',
    'primaryTerror',
    'advisorTerror',
    'advisor',
  ] as const)
    for (const change of changes) {
      const { g, response } = context(kind, 1, true);
      change(g, response);
      const before = JSON.stringify({ g, response });
      assert.throws(() => run(kind, g, response), errorClass(kind));
      assert.equal(JSON.stringify({ g, response }), before);
    }
});

void test('Intrusion and accompaniment reject crossed responses and permit only the chosen primary destination or Polar Sink', () => {
  for (const kind of ['intrusion', 'advisor'] as const) {
    const mutations: Partial<ResponseWindow>[] = [
      { advisorAmbassadorEvent: 'stale' },
      { location: kind === 'advisor' ? 'arrakeen:10' : 'arrakeen' },
      { advisorFollowup: { shipment: 'f', destination: 'carthag:11' } },
      { advisorRemaining: [] },
    ];
    if (kind === 'intrusion') mutations.push({ advisors: false });
    for (const mutation of mutations) {
      const { g, response } = context(kind);
      Object.assign(response, mutation);
      assert.throws(() => run(kind, g, response), errorClass(kind));
    }
  }
  const polar = context('advisor', 1);
  polar.response.location = 'polar_sink:0';
  polar.g.advanced = false;
  assert.deepEqual(run('advisor', polar.g, polar.response), {
    kind: 'advisor',
    owner: 'b',
    successor: 'ambassador',
  });
  polar.response.location = 'carthag:11';
  assert.throws(
    () => run('advisor', polar.g, polar.response),
    TerminalCancellationError,
  );
  const fremen = context('advisor');
  fremen.g.players.find((p) => p.id === 'p')!.faction = 'fremen';
  assert.throws(
    () => run('advisor', fremen.g, fremen.response),
    TerminalCancellationError,
  );
});

void test('primary and secondary Terror must bind the correct already-placed group', () => {
  for (const kind of ['primaryTerror', 'advisorTerror'] as const) {
    const changes: ((g: Game) => void)[] = [
      (g) => {
        g.pendingTerrorEntry!.entrant = kind === 'primaryTerror' ? 'b' : 'p';
      },
      (g) => {
        g.pendingTerrorEntry!.amount++;
      },
      (g) => {
        g.pendingTerrorEntry!.elite++;
      },
      (g) => {
        g.pendingTerrorEntry!.ambassadorEvent = 'stale';
      },
      (g) => {
        g.pendingTerrorEntry!.resume = 'none';
      },
      (g) => {
        g.pendingTerrorEntry!.phase = 4;
      },
      (g) => {
        g.pendingTerrorEntry!.territory = 'arrakeen';
        g.pendingTerrorEntry!.sector = 10;
      },
    ];
    for (const change of changes) {
      const { g, response } = context(kind);
      change(g);
      assert.throws(
        () => run(kind, g, response),
        MoritaniAllianceCancellationError,
      );
    }
  }
});

void test('legacy source-free advisor cancellation retains its original terminal quote', () => {
  const { g, response } = context('advisor');
  g.pendingAmbassador = null;
  delete response.advisorResume;
  delete response.advisorAmbassadorEvent;
  assert.deepEqual(validateTerminalCancellation(g, response), {
    kind: 'advisor',
    owner: 'b',
  });
  g.phase = 1;
  assert.throws(
    () => validateTerminalCancellation(g, response),
    TerminalCancellationError,
  );
});
