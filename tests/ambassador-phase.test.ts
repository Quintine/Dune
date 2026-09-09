import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, newPlayer, type Game } from '../game/engine';
import { createHomeworldCustody } from '../game/homeworld-custody';
import { homeworldContext } from '../game/homeworld-game';
import {
  makeHomeworldRevivalReturn,
  makeHomeworldRevivalProgress,
  homeworldRevivalArrivalSignature,
  homeworldRevivalResumeSignature,
  appendHomeworldRevivalAmbassador,
  completeHomeworldRevivalAmbassador,
  validateHomeworldRevivalReturn,
} from '../game/homeworld-revival-return';
import { ambassadorPhaseAllowed } from '../game/ambassador-phase';
import { createAmbassadors, triggerAmbassador } from '../game/ecaz-ambassadors';
import { validateGuildAmbassadorArrivalContext } from '../game/guild-ambassador-continuation';
import { validateAmbassadorRelocationContext } from '../game/karama-movement-cancellation';

function fixture(phase = 4) {
  const g = createGame(
    'REVIVAL-AMBASSADOR',
    newPlayer('f', 'Fremen', 'fremen'),
    true,
  );
  g.players.push(
    newPlayer('e', 'Ecaz', 'ecaz'),
    newPlayer('b', 'BG', 'beneGesserit'),
    newPlayer('i', 'Ixians', 'ixians'),
  );
  g.status = 'playing';
  g.phase = phase;
  g.turn = 2;
  g.players[0].reserves = 4;
  g.players[0].elites = { reserves: 1, tanks: 2, forces: {}, revived: 0 };
  g.homeworlds = { custody: createHomeworldCustody(homeworldContext(g)) };
  const frame = makeHomeworldRevivalReturn({
    event: 'revival-1',
    player: 'f',
    turn: 2,
    phase,
    source: 'ghola',
    card: 'ghola-1',
    group: { amount: 1, elite: 1, free: 0 },
    quote: {
      kind: 'fedaykin',
      normal: 0,
      elite: 1,
      beforePopulation: 3,
      afterPopulation: 4,
      blocked: null,
    },
  });
  frame.stage = 'arrival';
  frame.resumeResponse = null;
  frame.resumeSignature = homeworldRevivalResumeSignature(null);
  frame.destination = 'arrakeen:10';
  frame.ambassadors = [];
  frame.arrivalSignature = homeworldRevivalArrivalSignature(frame);
  g.homeworldRevivalReturn = frame;
  g.homeworldRevivalProgress = makeHomeworldRevivalProgress(frame);
  g.pendingAmbassador = {
    event: 'ambassador-1',
    revivalEvent: frame.event,
    owner: 'e',
    entrant: 'f',
    token: 'token-guild',
    territory: 'arrakeen',
    sector: 10,
    turn: 2,
    phase,
    stage: 'offer',
    copyChoices: [],
    resume: 'none',
  };
  appendHomeworldRevivalAmbassador(frame, g.pendingAmbassador);
  return g;
}

void test('legacy phases remain unchanged and extra phases require the exact signed revival arrival', () => {
  for (let phase = 0; phase <= 8; phase++) {
    const g = fixture(phase);
    assert.equal(ambassadorPhaseAllowed(g), true);
    const legacy = structuredClone(g);
    delete legacy.homeworldRevivalReturn;
    delete legacy.pendingAmbassador!.revivalEvent;
    assert.equal(ambassadorPhaseAllowed(legacy), phase === 1 || phase === 5);
    delete g.pendingAmbassador!.revivalEvent;
    assert.equal(
      ambassadorPhaseAllowed(g),
      false,
      'deleting the tag cannot enable a recorded Ambassador',
    );
  }
});

void test('receipt stage, original entrant, destination, turn and phase cannot be replaced or replayed', () => {
  const original = fixture();
  const edits: ((g: Game) => void)[] = [
    (g) => {
      g.pendingAmbassador!.entrant = 'i';
    },
    (g) => {
      g.pendingAmbassador!.territory = 'carthag';
    },
    (g) => {
      g.pendingAmbassador!.revivalEvent = 'another';
    },
    (g) => {
      g.pendingAmbassador!.event = 'another';
    },
    (g) => {
      g.pendingAmbassador!.phase = 5;
    },
    (g) => {
      g.pendingAmbassador!.turn++;
    },
    (g) => {
      g.homeworldRevivalReturn!.stage = 'complete';
    },
    (g) => {
      g.homeworldRevivalReturn!.ambassadors = [];
    },
    (g) => {
      g.homeworldRevivalReturn!.quote.elite = 2;
    },
    (g) => {
      delete g.homeworldRevivalReturn!.arrivalSignature;
    },
  ];
  for (const edit of edits) {
    const g = structuredClone(original);
    edit(g);
    const saved = JSON.stringify(g);
    assert.equal(ambassadorPhaseAllowed(g), false);
    assert.equal(JSON.stringify(g), saved);
  }
});

void test('secondary BG Ambassador uses its recorded Guild parent without reopening the completed predecessor', () => {
  const g = fixture();
  const frame = g.homeworldRevivalReturn!;
  const parent = structuredClone(g.pendingAmbassador!);
  const child: NonNullable<Game['pendingAmbassador']> = {
    ...parent,
    event: 'ambassador-2',
    entrant: 'b',
    territory: 'carthag',
    sector: 11,
    guildAdvisorOrigin: {
      event: parent.event,
      player: 'i',
      territory: 'carthag',
      sector: 11,
    },
  };
  completeHomeworldRevivalAmbassador(frame, parent.event);
  appendHomeworldRevivalAmbassador(frame, child, parent.event);
  g.pendingAmbassador = child;
  assert.equal(ambassadorPhaseAllowed(g), true);
  assert.equal(
    ambassadorPhaseAllowed(JSON.parse(JSON.stringify(g)) as Game),
    true,
  );
  g.pendingAmbassador = parent;
  assert.equal(ambassadorPhaseAllowed(g), false);
  g.pendingAmbassador = child;
  child.guildAdvisorOrigin!.event = 'unrelated';
  assert.equal(ambassadorPhaseAllowed(g), false);
  child.guildAdvisorOrigin!.event = parent.event;
  child.guildAdvisorOrigin!.player = 'f';
  assert.equal(
    ambassadorPhaseAllowed(g),
    false,
    'Fremen cannot be the accompanying shipment source',
  );
});

void test('arrival append validates first source, unique events, recorded parent and preserves rejected frames', () => {
  const g = fixture();
  const frame = g.homeworldRevivalReturn!;
  const entry = g.pendingAmbassador!;
  for (const [child, parent] of [
    [{ ...entry, event: 'second' }, undefined],
    [{ ...entry, event: 'second', entrant: 'b' }, 'missing'],
    [{ ...entry, entrant: 'b' }, entry.event],
    [{ ...entry, event: 'second', entrant: 'b', turn: 3 }, entry.event],
  ] as const) {
    const saved = JSON.stringify(frame);
    assert.throws(() => appendHomeworldRevivalAmbassador(frame, child, parent));
    assert.equal(JSON.stringify(frame), saved);
  }
  const empty = structuredClone(frame);
  empty.ambassadors = [];
  empty.arrivalSignature = homeworldRevivalArrivalSignature(empty);
  assert.throws(() =>
    appendHomeworldRevivalAmbassador(empty, { ...entry, entrant: 'b' }),
  );
  assert.throws(() =>
    appendHomeworldRevivalAmbassador(empty, { ...entry, territory: 'carthag' }),
  );
  delete empty.arrivalSignature;
  assert.throws(() => validateHomeworldRevivalReturn(g, empty));
});

void test('completed decline keeps an explicit empty arrival proof and no Ambassador grant', () => {
  const g = fixture();
  const frame = g.homeworldRevivalReturn!;
  frame.stage = 'complete';
  g.homeworldRevivalProgress = makeHomeworldRevivalProgress(frame);
  frame.destination = 'decline';
  assert.throws(() => homeworldRevivalArrivalSignature(frame));
  frame.ambassadors = [];
  frame.arrivalSignature = homeworldRevivalArrivalSignature(frame);
  validateHomeworldRevivalReturn(g, frame);
  assert.equal(ambassadorPhaseAllowed(g), false);
});

void test('Guild shipment and copied Fremen relocation continuations accept a real revival-bound phase four receipt', () => {
  for (const effect of ['guild', 'fremen'] as const) {
    const g = fixture();
    const ambassadors = createAmbassadors(() => 0);
    const token = ambassadors.tokens.find(
      (candidate) =>
        candidate.effect === (effect === 'guild' ? 'guild' : 'beneGesserit'),
    )!;
    ambassadors.cohort = [
      token.id,
      ...ambassadors.tokens
        .filter(
          (candidate) =>
            candidate.effect !== 'ecaz' &&
            candidate.effect !== 'fremen' &&
            candidate.id !== token.id,
        )
        .slice(0, 4)
        .map((candidate) => candidate.id),
    ];
    for (const candidate of ambassadors.tokens) {
      candidate.zone =
        candidate.effect === 'ecaz' || ambassadors.cohort.includes(candidate.id)
          ? 'supply'
          : 'pool';
      candidate.location = null;
    }
    token.zone = 'placed';
    token.location = 'arrakeen';
    g.ecazAmbassadors = triggerAmbassador(ambassadors, token.id);
    const entry = g.pendingAmbassador!;
    entry.token = token.id;
    entry.stage = 'arrival';
    entry.effect = effect;
    entry.beneficiary = 'i';
    entry.copyChoices = effect === 'fremen' ? ['fremen'] : [];
    if (effect === 'guild') {
      entry.shipmentReceipt = {
        next: 'accompany',
        order: {
          player: 'i',
          amount: 2,
          elite: 0,
          territory: 'carthag',
          sector: 11,
          cost: 0,
          allyPayment: 0,
          advisors: false,
        },
      };
      assert.equal(
        validateGuildAmbassadorArrivalContext(g, entry.event, 'accompany').order
          .amount,
        2,
      );
      delete entry.revivalEvent;
      assert.throws(() =>
        validateGuildAmbassadorArrivalContext(g, entry.event, 'accompany'),
      );
    } else {
      entry.relocation = {
        next: 'finish',
        order: {
          player: 'i',
          group: [['arrakeen:10', 2]],
          eliteGroup: {},
          elite: 0,
          origin: 'arrakeen',
          total: 2,
          to: 'carthag',
          sector: 11,
          advisors: false,
          wantsFighters: false,
        },
      };
      assert.equal(
        validateAmbassadorRelocationContext(g, entry.event, 'finish').total,
        2,
      );
      delete entry.revivalEvent;
      assert.throws(() =>
        validateAmbassadorRelocationContext(g, entry.event, 'finish'),
      );
    }
  }
});
