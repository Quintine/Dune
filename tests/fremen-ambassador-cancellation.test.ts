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
import {
  quoteMovementCancellation,
  MovementCancellationError,
} from '../game/karama-movement-cancellation';
import {
  quoteMoritaniAllianceCancellation,
  MoritaniAllianceCancellationError,
} from '../game/moritani-alliance-cancellation';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
/** Explicit completed-parent unit contexts; actual dispatcher journeys are
 * covered separately. Canonical token inventories preserve physical identity. */
function fixture(
  kind: 'ownFlip' | 'intrusion' | 'terror',
  copied = false,
  phase = 5,
) {
  const g = createGame('AMB-CANCEL', newPlayer('e', 'Ecaz', 'ecaz'), true);
  g.players.push(
    newPlayer('b', 'BG', 'beneGesserit'),
    newPlayer('m', 'Moritani', 'moritani'),
    newPlayer('p', 'Beneficiary', 'emperor'),
    newPlayer('f', 'Original entrant', phase === 1 ? 'fremen' : 'guild'),
  );
  Object.assign(g, {
    status: 'playing',
    turn: 3,
    phase,
    active: phase === 5 ? 'f' : null,
    storm: 18,
    order: g.players.map((p) => p.id),
    decision: null,
    response: null,
  });
  g.ecazAmbassadors = createAmbassadors(() => 0);
  const effect = copied ? 'beneGesserit' : 'fremen';
  const selected = g.ecazAmbassadors.tokens.find((t) => t.effect === effect)!;
  const rest = g.ecazAmbassadors.tokens
    .filter((t) => !['ecaz', 'fremen', effect].includes(t.effect))
    .slice(0, 4);
  g.ecazAmbassadors.cohort = [selected.id, ...rest.map((t) => t.id)];
  for (const token of g.ecazAmbassadors.tokens) {
    token.zone =
      token.effect === 'ecaz' || g.ecazAmbassadors.cohort.includes(token.id)
        ? 'supply'
        : 'pool';
    token.location = null;
  }
  selected.zone = 'placed';
  selected.location = 'arrakeen';
  g.ecazAmbassadors = triggerAmbassador(g.ecazAmbassadors, selected.id);
  const beneficiary = kind === 'ownFlip' ? 'b' : 'p';
  g.players.find((p) => p.id === 'e')!.ally = beneficiary;
  g.players.find((p) => p.id === beneficiary)!.ally = 'e';
  g.pendingAmbassador = {
    event: 'ambassador:3:entry',
    owner: 'e',
    entrant: 'f',
    token: selected.id,
    territory: 'arrakeen',
    sector: 10,
    turn: 3,
    phase,
    stage: 'arrival',
    beneficiary,
    effect: 'fremen',
    copyChoices: copied ? ['fremen'] : [],
    resume: phase === 1 ? 'wormRide' : 'none',
    relocation: {
      next:
        kind === 'ownFlip'
          ? 'intrusion'
          : kind === 'intrusion'
            ? 'terror'
            : 'finish',
      order: {
        player: beneficiary,
        origin: 'hagga_basin',
        group: [
          ['hagga_basin:13', 2],
          ['hagga_basin:12', 1],
        ],
        eliteGroup: {
          'hagga_basin:13': kind === 'ownFlip' ? 0 : 1,
          'hagga_basin:12': 0,
        },
        elite: kind === 'ownFlip' ? 0 : 1,
        total: 3,
        to: 'carthag',
        sector: 11,
        advisors: kind === 'ownFlip',
        wantsFighters: kind === 'ownFlip',
      },
    },
  };
  let response: ResponseWindow;
  if (kind === 'terror') {
    g.moritaniTerror = createTerrorState(() => 0);
    const token = g.moritaniTerror.tokens.find((t) => t.kind === 'sabotage')!;
    g.moritaniTerror = placeTerror(g.moritaniTerror, token.id, 'carthag', 1);
    g.pendingTerrorEntry = {
      token: token.id,
      entrant: beneficiary,
      territory: 'carthag',
      sector: 11,
      amount: 3,
      elite: 1,
      cause: 'ambassador',
      resume: 'ambassador',
      ambassadorEvent: g.pendingAmbassador.event,
      turn: 3,
      phase,
      stage: 'allianceResponse',
    };
    response = { kind: 'moritaniAlliance', owner: 'm', passed: [] };
  } else
    response = {
      kind: 'advisorFlip',
      owner: 'b',
      location: 'carthag',
      advisors: kind === 'intrusion',
      advisorResume: 'ambassador',
      advisorAmbassadorEvent: g.pendingAmbassador.event,
      passed: [],
    };
  return { g, response };
}

for (const kind of ['ownFlip', 'intrusion', 'terror'] as const)
  void test(`${kind}: historical Ambassador child survives reload, changed alliances and casualties`, () => {
    for (const copied of [false, true])
      for (const phase of [1, 5]) {
        if (!copied && phase === 1) continue;
        const { g, response } = fixture(kind, copied, phase);
        for (const p of g.players) {
          p.ally = null;
          p.forces = {};
          p.tanks = 20;
          p.reserves = 0;
        }
        g.storm = 11; // Later conditions do not revalidate an already completed move.
        const before = JSON.stringify(g);
        for (let i = 0; i < 3; i++) {
          if (kind === 'terror') {
            const quote = quoteMoritaniAllianceCancellation(
              clone(g),
              clone(response),
            )!;
            assert.equal(quote.entry.stage, 'offer');
            assert.equal(quote.entry.allianceBlocked, true);
            assert.equal(
              quote.entry.ambassadorEvent,
              g.pendingAmbassador!.event,
            );
            assert.equal(quote.entry.resume, 'ambassador');
          } else
            assert.deepEqual(
              quoteMovementCancellation(clone(g), clone(response)),
              { kind: 'advisorFlip', successor: 'ambassador' },
            );
        }
        assert.equal(JSON.stringify(g), before);
      }
  });

void test('both advisor paths reject stale parent, consumed-token and typed receipt mutations without changing input', () => {
  const changes: ((g: Game, r: ResponseWindow) => void)[] = [
    (g) => {
      g.pendingAmbassador!.event = 'replaced';
    },
    (g) => {
      g.pendingAmbassador!.turn++;
    },
    (g) => {
      g.pendingAmbassador!.phase = 4;
    },
    (g) => {
      g.pendingAmbassador!.stage = 'move';
    },
    (g) => {
      g.pendingAmbassador!.effect = 'richese';
    },
    (g) => {
      g.pendingAmbassador!.owner = 'm';
    },
    (g) => {
      g.pendingAmbassador!.beneficiary = 'missing';
    },
    (g) => {
      g.pendingAmbassador!.relocation!.next = 'finish';
    },
    (g) => {
      g.pendingAmbassador!.relocation!.order.total++;
    },
    (g) => {
      g.pendingAmbassador!.relocation!.order.eliteGroup['hagga_basin:13'] = 3;
    },
    (g) => {
      g.pendingAmbassador!.relocation!.order.group.push(['hagga_basin:13', 2]);
    },
    (g) => {
      g.ecazAmbassadors!.tokens.find(
        (t) => t.id === g.pendingAmbassador!.token,
      )!.zone = 'supply';
    },
    (g) => {
      g.pendingAmbassador!.copyChoices = [];
    },
    (_, r) => {
      r.advisorAmbassadorEvent = 'stale';
    },
    (_, r) => {
      r.location = 'arrakeen';
    },
    (_, r) => {
      r.advisors = !r.advisors;
    },
    (_, r) => {
      r.advisorFollowup = { shipment: 'f', destination: 'carthag:11' };
    },
    (_, r) => {
      r.advisorRemaining = [];
    },
  ];
  for (const kind of ['ownFlip', 'intrusion'] as const)
    for (const change of changes) {
      const { g, response } = fixture(kind, true);
      change(g, response);
      const before = JSON.stringify({ g, response });
      assert.throws(
        () => quoteMovementCancellation(g, response),
        MovementCancellationError,
      );
      assert.equal(JSON.stringify({ g, response }), before);
    }
});

void test('Terror cancellation binds every original child receipt and rejects forged parent or phase', () => {
  const changes: ((g: Game) => void)[] = [
    (g) => {
      g.pendingTerrorEntry!.ambassadorEvent = 'stale';
    },
    (g) => {
      g.pendingTerrorEntry!.resume = 'none';
    },
    (g) => {
      g.pendingTerrorEntry!.entrant = 'b';
    },
    (g) => {
      g.pendingTerrorEntry!.territory = 'arrakeen';
      g.pendingTerrorEntry!.sector = 10;
    },
    (g) => {
      g.pendingTerrorEntry!.amount++;
    },
    (g) => {
      g.pendingTerrorEntry!.elite = 0;
    },
    (g) => {
      g.pendingAmbassador!.relocation!.next = 'terror';
    },
    (g) => {
      g.pendingAmbassador!.token = 'missing';
    },
    (g) => {
      g.pendingAmbassador!.copyChoices = [];
    },
    (g) => {
      g.pendingAmbassador!.relocation!.order.total = 99;
    },
    (g) => {
      g.phase = 4;
      g.pendingAmbassador!.phase = 4;
      g.pendingTerrorEntry!.phase = 4;
    },
    (g) => {
      g.pendingAmbassador = null;
    },
  ];
  for (const change of changes) {
    const { g, response } = fixture('terror', true, 1);
    change(g);
    const before = JSON.stringify(g);
    assert.throws(
      () => quoteMoritaniAllianceCancellation(g, response),
      MoritaniAllianceCancellationError,
    );
    assert.equal(JSON.stringify(g), before);
  }
});

void test('legacy ordinary advisor and Terror paths retain their original return contract', () => {
  const { g, response } = fixture('intrusion');
  g.pendingAmbassador = null;
  delete response.advisorResume;
  delete response.advisorAmbassadorEvent;
  assert.deepEqual(quoteMovementCancellation(g, response), {
    kind: 'advisorFlip',
    successor: 'none',
  });
  const terror = fixture('terror');
  terror.g.pendingAmbassador = null;
  const entry = terror.g.pendingTerrorEntry!;
  entry.cause = 'movement';
  entry.resume = 'none';
  delete entry.ambassadorEvent;
  assert.equal(
    quoteMoritaniAllianceCancellation(terror.g, terror.response)!.entry.resume,
    'none',
  );
});

void test('historical concealed-marker arrival survives materialization and rejects forged marker source', () => {
  const { g, response } = fixture('terror', true, 1);
  g.players.find((p) => p.id === 'p')!.faction = 'richese';
  const order = g.pendingAmbassador!.relocation!.order;
  Object.assign(order, {
    group: [],
    eliteGroup: {},
    total: 1,
    elite: 0,
    noField: {
      tokenId: 'richese-no-field-0',
      event: 'historical-marker-event',
      from: 'hagga_basin:13',
    },
  });
  Object.assign(g.pendingTerrorEntry!, { amount: 1, elite: 0 });
  // Marker may already be revealed or destroyed by another supported child;
  // this validator does not inspect current hidden denomination or reserves.
  const before = JSON.stringify(g);
  assert.equal(quoteMoritaniAllianceCancellation(g, response)!.entry.amount, 1);
  assert.equal(JSON.stringify(g), before);
  order.noField!.from = 'arrakeen:10';
  assert.throws(
    () => quoteMoritaniAllianceCancellation(g, response),
    MoritaniAllianceCancellationError,
  );
});

void test('a natural Fremen worm entrant cannot have triggered the physical Fremen token', () => {
  for (const kind of ['ownFlip', 'intrusion', 'terror'] as const) {
    const { g, response } = fixture(kind, false, 1);
    if (kind === 'terror')
      assert.throws(
        () => quoteMoritaniAllianceCancellation(g, response),
        MoritaniAllianceCancellationError,
      );
    else
      assert.throws(
        () => quoteMovementCancellation(g, response),
        MovementCancellationError,
      );
  }
});
