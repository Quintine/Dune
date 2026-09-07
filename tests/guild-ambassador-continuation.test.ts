import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, newPlayer, type Game } from '../game/engine';
import { createAmbassadors, triggerAmbassador } from '../game/ecaz-ambassadors';
import {
  validateGuildAmbassadorArrivalContext,
  GuildAmbassadorContinuationError,
  type GuildAmbassadorArrivalNext,
} from '../game/guild-ambassador-continuation';

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
const quote = (
  g: Game,
  next: GuildAmbassadorArrivalNext = g.pendingAmbassador!.shipmentReceipt!.next,
) => validateGuildAmbassadorArrivalContext(g, g.pendingAmbassador!.event, next);

void test('each historical child boundary survives JSON, casualties, changed alliance and storm without mutation', () => {
  for (const next of [
    'intrusion',
    'terror',
    'accompany',
    'advisor',
    'finish',
  ] as const)
    for (const copied of [false, true])
      for (const phase of [1, 5]) {
        const g = fixture(next, copied, phase);
        g.storm = 11;
        for (const p of g.players) {
          p.ally = null;
          p.forces = {};
          p.reserves = 0;
          p.tanks = 20;
          p.hand = [];
        }
        const before = JSON.stringify(g);
        const result = quote(reload(g));
        assert.deepEqual(
          result.order,
          g.pendingAmbassador!.shipmentReceipt!.order,
        );
        assert.deepEqual(
          result.advisorArrival,
          g.pendingAmbassador!.shipmentReceipt!.advisorArrival,
        );
        assert.deepEqual(quote(g), result);
        assert.equal(JSON.stringify(g), before);
      }
});

void test('Ecaz self beneficiary and historical HMS destination do not depend on current pointer or forces', () => {
  const own = fixture('terror');
  own.pendingAmbassador!.beneficiary = 'e';
  own.pendingAmbassador!.shipmentReceipt!.order.player = 'e';
  assert.equal(quote(own).order.player, 'e');
  const mobile = fixture('accompany');
  Object.assign(mobile.pendingAmbassador!.shipmentReceipt!.order, {
    territory: 'hidden_mobile_stronghold',
    sector: 0,
  });
  mobile.mobileStronghold = { location: null };
  assert.equal(quote(mobile).order.territory, 'hidden_mobile_stronghold');
  mobile.mobileStronghold.location = 'hagga_basin:12';
  assert.equal(quote(mobile).order.amount, 4);
});

void test('accompanying BG receipt permits original territory sector or Polar Sink and binds its exact shape', () => {
  for (const target of [
    { territory: 'carthag', sector: 11 },
    { territory: 'polar_sink', sector: 0 },
  ]) {
    const g = fixture('finish');
    Object.assign(
      g.pendingAmbassador!.shipmentReceipt!.advisorArrival!,
      target,
    );
    assert.deepEqual(
      quote(g).advisorArrival,
      g.pendingAmbassador!.shipmentReceipt!.advisorArrival,
    );
  }
  const changes: ((g: Game) => void)[] = [
    (g) => {
      delete g.pendingAmbassador!.shipmentReceipt!.advisorArrival;
    },
    (g) => {
      g.pendingAmbassador!.shipmentReceipt!.advisorArrival!.player = 'p';
    },
    (g) => {
      g.pendingAmbassador!.shipmentReceipt!.advisorArrival!.player = 'missing';
    },
    (g) => {
      Object.assign(g.pendingAmbassador!.shipmentReceipt!.advisorArrival!, {
        amount: 2,
      });
    },
    (g) => {
      Object.assign(g.pendingAmbassador!.shipmentReceipt!.advisorArrival!, {
        elite: 1,
      });
    },
    (g) => {
      Object.assign(g.pendingAmbassador!.shipmentReceipt!.advisorArrival!, {
        territory: 'arrakeen',
        sector: 10,
      });
    },
    (g) => {
      g.pendingAmbassador!.shipmentReceipt!.advisorArrival!.sector = 0;
    },
    (g) => {
      g.players.find((p) => p.id === 'b')!.faction = 'guild';
    },
  ];
  for (const change of changes) {
    const g = fixture('finish');
    change(g);
    const before = JSON.stringify(g);
    assert.throws(() => quote(g), GuildAmbassadorContinuationError);
    assert.equal(JSON.stringify(g), before);
  }
  for (const next of ['intrusion', 'terror', 'accompany', 'advisor'] as const) {
    const g = fixture(next);
    g.pendingAmbassador!.shipmentReceipt!.advisorArrival =
      fixture('finish').pendingAmbassador!.shipmentReceipt!.advisorArrival;
    assert.throws(() => quote(g), GuildAmbassadorContinuationError);
  }
});

void test('event, stage, time, physical token and original entrant provenance reject copied-save corruption', () => {
  const changes: ((g: Game) => void)[] = [
    (g) => {
      g.status = 'finished';
    },
    (g) => {
      g.turn++;
    },
    (g) => {
      g.phase = 4;
    },
    (g) => {
      g.pendingAmbassador!.phase = 1;
    },
    (g) => {
      g.pendingAmbassador!.turn--;
    },
    (g) => {
      g.pendingAmbassador!.stage = 'ship';
    },
    (g) => {
      g.pendingAmbassador!.effect = 'fremen';
    },
    (g) => {
      g.pendingAmbassador!.owner = 'p';
    },
    (g) => {
      g.pendingAmbassador!.entrant = 'e';
    },
    (g) => {
      g.pendingAmbassador!.entrant = 'p';
    },
    (g) => {
      g.pendingAmbassador!.beneficiary = 'missing';
    },
    (g) => {
      g.pendingAmbassador!.sector = 11;
    },
    (g) => {
      g.pendingAmbassador!.resume = 'wormRide';
    },
    (g) => {
      g.pendingAmbassador!.token = 'missing';
    },
    (g) => {
      g.ecazAmbassadors!.tokens.find(
        (t) => t.id === g.pendingAmbassador!.token,
      )!.zone = 'supply';
    },
    (g) => {
      g.pendingAmbassador!.copyChoices = [];
    },
    (g) => {
      g.players.find((p) => p.id === 'f')!.faction = 'beneGesserit';
    },
    (g) => {
      g.players.push(reload(g.players[0]));
    },
    (g) => {
      Object.assign(g.pendingAmbassador!, { relocation: {} });
    },
    (g) => {
      Object.assign(g.pendingAmbassador!, { purchaseReceipt: {} });
    },
  ];
  for (const change of changes) {
    const g = fixture('terror', true);
    change(g);
    const before = JSON.stringify(g);
    assert.throws(() => quote(g), GuildAmbassadorContinuationError);
    assert.equal(JSON.stringify(g), before);
  }
  const g = fixture();
  assert.throws(
    () => validateGuildAmbassadorArrivalContext(g, 'replaced', 'accompany'),
    GuildAmbassadorContinuationError,
  );
  assert.throws(() => quote(g, 'terror'), GuildAmbassadorContinuationError);
  Object.assign(g.pendingAmbassador!.shipmentReceipt!, { next: 'invented' });
  assert.throws(() => quote(g), GuildAmbassadorContinuationError);
  const wrongCopy = fixture('terror', true);
  const guild = wrongCopy.ecazAmbassadors!.tokens.find(
    (t) => t.effect === 'guild',
  )!;
  const removed = wrongCopy.ecazAmbassadors!.cohort[1];
  wrongCopy.ecazAmbassadors!.tokens.find((t) => t.id === removed)!.zone =
    'pool';
  wrongCopy.ecazAmbassadors!.cohort[1] = guild.id;
  guild.zone = 'supply';
  assert.throws(() => quote(wrongCopy), GuildAmbassadorContinuationError);
});

void test('physical free shipment receipt rejects prices, No-Fields and invalid typed counts', () => {
  const patches: Record<string, unknown>[] = [
    { player: 'e' },
    { amount: 0 },
    { amount: 5 },
    { amount: 1.5 },
    { amount: Number.MAX_SAFE_INTEGER + 1 },
    { elite: -1 },
    { elite: 5 },
    { elite: 0.5 },
    { cost: 1 },
    { cost: undefined },
    { allyPayment: 1 },
    { advisors: 'false' },
    { territory: 'reserves', sector: 0 },
    { sector: 12 },
    { noField: { tokenId: 'hidden', event: 'old' } },
    { alliedNoField: {} },
  ];
  for (const patch of patches) {
    const g = fixture();
    Object.assign(g.pendingAmbassador!.shipmentReceipt!.order, patch);
    const before = JSON.stringify(g);
    assert.throws(() => quote(g), GuildAmbassadorContinuationError);
    assert.equal(JSON.stringify(g), before);
  }
});

void test('unrelated concealed marker and private inventory do not enter historical receipt validation', () => {
  const g = fixture();
  const original = quote(g);
  Object.assign(g.players[1], {
    noFieldEvent: 'new-marker-event',
    noField: { deployed: null },
    spice: 0,
    hand: [],
    traitors: [],
  });
  assert.deepEqual(quote(g), original);
  const before = JSON.stringify(g);
  const savedRandom = Math.random;
  Math.random = () => {
    throw new Error('Historical quote must not sample random values.');
  };
  try {
    for (let i = 0; i < 5; i++) quote(reload(g));
  } finally {
    Math.random = savedRandom;
  }
  assert.equal(JSON.stringify(g), before);
});

void test('pending BG accompaniment stage has no already-placed advisor receipt', () => {
  const g = fixture('advisor', true, 1);
  const before = JSON.stringify(g);
  assert.equal(quote(reload(g)).advisorArrival, undefined);
  assert.equal(JSON.stringify(g), before);
  g.pendingAmbassador!.shipmentReceipt!.advisorArrival =
    fixture('finish').pendingAmbassador!.shipmentReceipt!.advisorArrival;
  assert.throws(() => quote(g), GuildAmbassadorContinuationError);
});
