import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, newPlayer, type Game } from '../game/engine';
import { createHomeworldCustody } from '../game/homeworld-custody';
import { homeworldContext } from '../game/homeworld-game';
import {
  appendHomeworldArrivalAmbassador,
  completeHomeworldArrivalAmbassador,
  homeworldArrivalSignature,
  validateHomeworldArrival,
} from '../game/homeworld-arrival';
import {
  makeHomeworldRevivalReturn,
  makeHomeworldRevivalProgress,
  homeworldRevivalResumeSignature,
  validateHomeworldRevivalReturn,
} from '../game/homeworld-revival-return';
import { ambassadorPhaseAllowed } from '../game/ambassador-phase';
import type { SpiritualAdvisorSource } from '../game/spiritual-advisor';

type RevivalSpiritual = SpiritualAdvisorSource & { revivalEvent: string };
type Entry = NonNullable<Game['pendingAmbassador']>;

/** Controlled public receipt/continuation context. Actual placement and the
 * original revival entitlement remain the native engine producer's duty. */
function fixture() {
  const g = createGame('REVIVAL-SPIRITUAL', newPlayer('t', 'Tleilaxu', 'tleilaxu'), true, ['ix', 'ecaz']);
  g.players.push(newPlayer('b', 'BG', 'beneGesserit'), newPlayer('e', 'Ecaz', 'ecaz'), newPlayer('i', 'Ixians', 'ixians'));
  g.status = 'playing';
  g.turn = 2;
  g.phase = 4;
  g.players[0].reserves = 11;
  g.homeworlds = { custody: createHomeworldCustody(homeworldContext(g)) };
  const frame = makeHomeworldRevivalReturn({
    event: 'revival-t-2', player: 't', turn: 2, phase: 4, source: 'normal',
    group: { amount: 2, elite: 0, free: 2 },
    quote: { kind: 'tleilax', normal: 2, elite: 0, beforePopulation: 9, afterPopulation: 11, blocked: null },
  });
  frame.stage = 'arrival';
  frame.resumeResponse = null;
  frame.resumeSignature = homeworldRevivalResumeSignature(null);
  frame.destination = 'arrakeen:10';
  frame.ambassadors = [];
  frame.arrivalSignature = homeworldArrivalSignature(frame);
  g.homeworldRevivalReturn = frame;
  g.homeworldRevivalProgress = makeHomeworldRevivalProgress(frame);
  g.pendingAmbassador = null;
  return { g, frame };
}

function entry(event = 'ambassador-bg-1', entrant = 'b', territory = 'arrakeen', sector = 10): Entry {
  return { event, owner: 'e', entrant, territory, sector, turn: 2, phase: 4,
    revivalEvent: 'revival-t-2', token: 'token-guild', stage: 'offer', copyChoices: [], resume: 'none' };
}

function source(patch: Partial<RevivalSpiritual> = {}): RevivalSpiritual {
  return { event: 'spiritual-1', owner: 'b', turn: 2, phase: 4, territory: 'arrakeen', sector: 10,
    amount: 1, revivalEvent: 'revival-t-2', ...patch };
}

void test('a committed Spiritual root opens phase-four Ambassador before the original Tleilax entry', () => {
  const { g, frame } = fixture();
  const bg = entry(), actual = source();
  appendHomeworldArrivalAmbassador(frame, bg, undefined, actual);
  g.pendingAmbassador = bg;
  validateHomeworldRevivalReturn(g, frame);
  assert.equal(ambassadorPhaseAllowed(g), true);
  assert.equal(ambassadorPhaseAllowed(JSON.parse(JSON.stringify(g)) as Game), true);
  assert.deepEqual(frame.ambassadors![0].spiritual, actual);
  assert.notEqual(frame.ambassadors![0].spiritual, actual);
  actual.amount = 2;
  assert.equal(frame.ambassadors![0].spiritual!.amount, 1, 'The accepted public placement source is copied once.');

  completeHomeworldArrivalAmbassador(frame, bg.event);
  const original = entry('ambassador-t-original', 't');
  appendHomeworldArrivalAmbassador(frame, original);
  g.pendingAmbassador = original;
  assert.equal(frame.ambassadors![1].parent, undefined);
  assert.equal(frame.ambassadors![1].spiritual, undefined);
  validateHomeworldRevivalReturn(g, frame);
  assert.equal(ambassadorPhaseAllowed(g), true);
  completeHomeworldArrivalAmbassador(frame, original.event);
  g.pendingAmbassador = null;
  frame.stage = 'complete';
  g.homeworldRevivalProgress = makeHomeworldRevivalProgress(frame);
  validateHomeworldRevivalReturn(g, frame);
  g.pendingAmbassador = bg;
  assert.equal(ambassadorPhaseAllowed(g), false, 'A completed BG root cannot be reopened.');
});

void test('legacy primary rows retain their exact signature bytes without a Spiritual attribute', () => {
  const { g, frame } = fixture();
  const original = entry('ambassador-t-original', 't');
  appendHomeworldArrivalAmbassador(frame, original);
  g.pendingAmbassador = original;
  assert.equal(frame.arrivalSignature, JSON.stringify(['homeworldRevivalArrival', frame.signature,
    'arrakeen:10', [[original.event, 't', 'arrakeen:10', null, false]]]));
  validateHomeworldRevivalReturn(g, frame);
  assert.equal(ambassadorPhaseAllowed(g), true);
});

void test('Spiritual provenance binds the original revival, actual owner, public packet and exact arrival destination', () => {
  for (const patch of [
    { event: '' }, { owner: 'i' }, { owner: 't' }, { revivalEvent: 'other-revival' },
    { turn: 3 }, { phase: 5 }, { territory: 'carthag', sector: 11 },
    { sector: 9 }, { amount: 0 }, { amount: 3 }, { amount: 1.5 },
  ] satisfies Partial<RevivalSpiritual>[]) {
    const { frame } = fixture(), before = JSON.stringify(frame);
    assert.throws(() => appendHomeworldArrivalAmbassador(frame, entry(), undefined, source(patch)));
    assert.equal(JSON.stringify(frame), before);
  }
  for (const actual of [
    { ...source(), card: 'unrelated-card' },
    { ...source(), privateFrame: {} },
    Object.fromEntries(Object.entries(source()).filter(([key]) => key !== 'revivalEvent')),
  ]) {
    const { frame } = fixture(), before = JSON.stringify(frame);
    assert.throws(() => appendHomeworldArrivalAmbassador(frame, entry(), undefined, actual as RevivalSpiritual));
    assert.equal(JSON.stringify(frame), before);
  }
});

void test('a direct Spiritual root accompanies only the original territory or Polar Sink', () => {
  const { g, frame } = fixture();
  const polar = entry('ambassador-bg-polar', 'b', 'polar_sink', 0);
  appendHomeworldArrivalAmbassador(frame, polar, undefined, source({ territory: 'polar_sink', sector: 0, amount: 2 }));
  g.pendingAmbassador = polar;
  assert.equal(ambassadorPhaseAllowed(g), true);

  const unrelated = fixture();
  assert.throws(() => appendHomeworldArrivalAmbassador(unrelated.frame,
    entry('ambassador-bg-elsewhere', 'b', 'carthag', 11), undefined, source({ territory: 'carthag', sector: 11 })));
  const home = fixture();
  home.frame.destination = 'homeworld:i';
  home.frame.arrivalSignature = homeworldArrivalSignature(home.frame);
  assert.throws(() => appendHomeworldArrivalAmbassador(home.frame, polar, undefined,
    source({ territory: 'polar_sink', sector: 0 })));
});

void test('unique Spiritual openings may precede the one original root while duplicate events and unproven roots reject', () => {
  const { g, frame } = fixture();
  const first = entry();
  appendHomeworldArrivalAmbassador(frame, first, undefined, source());
  g.pendingAmbassador = first;
  const stillOpen = JSON.stringify(frame);
  assert.throws(() => appendHomeworldArrivalAmbassador(frame, entry('ambassador-bg-2'), undefined,
    source({ event: 'spiritual-2' })));
  assert.equal(JSON.stringify(frame), stillOpen);
  completeHomeworldArrivalAmbassador(frame, first.event);

  const completed = JSON.stringify(frame);
  assert.throws(() => appendHomeworldArrivalAmbassador(frame, entry('ambassador-bg-replay'), undefined, source()));
  assert.throws(() => appendHomeworldArrivalAmbassador(frame, entry('ambassador-unproven-bg')));
  assert.throws(() => appendHomeworldArrivalAmbassador(frame, entry('ambassador-unproven-i', 'i')));
  assert.throws(() => appendHomeworldArrivalAmbassador(frame, entry('ambassador-wrong-original', 't', 'carthag', 11)));
  assert.equal(JSON.stringify(frame), completed);

  const second = entry('ambassador-bg-2');
  appendHomeworldArrivalAmbassador(frame, second, undefined, source({ event: 'spiritual-2' }));
  g.pendingAmbassador = second;
  assert.equal(ambassadorPhaseAllowed(g), true);
  completeHomeworldArrivalAmbassador(frame, second.event);
  const original = entry('ambassador-t-original', 't');
  appendHomeworldArrivalAmbassador(frame, original);
  completeHomeworldArrivalAmbassador(frame, original.event);
  const before = JSON.stringify(frame);
  assert.throws(() => appendHomeworldArrivalAmbassador(frame, entry('ambassador-original-replay', 't')));
  assert.throws(() => appendHomeworldArrivalAmbassador(frame, entry(), undefined,
    source({ event: 'spiritual-3' })));
  assert.equal(JSON.stringify(frame), before);
});

void test('a Guild accompaniment suffix retains its original parent independently of the later primary root', () => {
  const { g, frame } = fixture();
  const bg = entry();
  appendHomeworldArrivalAmbassador(frame, bg, undefined, source());
  completeHomeworldArrivalAmbassador(frame, bg.event);
  const child: Entry = { ...entry('ambassador-bg-guild-child', 'b', 'carthag', 11),
    guildAdvisorOrigin: { event: bg.event, player: 'i', territory: 'carthag', sector: 11 } };
  const before = JSON.stringify(frame);
  assert.throws(() => appendHomeworldArrivalAmbassador(frame, child, bg.event, source({ event: 'spiritual-child', territory: 'carthag', sector: 11 })));
  assert.equal(JSON.stringify(frame), before);
  appendHomeworldArrivalAmbassador(frame, child, bg.event);
  g.pendingAmbassador = child;
  assert.equal(ambassadorPhaseAllowed(g), true);
  child.guildAdvisorOrigin!.event = 'unrelated';
  assert.equal(ambassadorPhaseAllowed(g), false);
  child.guildAdvisorOrigin!.event = bg.event;
  completeHomeworldArrivalAmbassador(frame, child.event);
  const original = entry('ambassador-t-original', 't');
  appendHomeworldArrivalAmbassador(frame, original);
  g.pendingAmbassador = original;
  assert.equal(ambassadorPhaseAllowed(g), true);
});

void test('phase permission requires the current native BG source and revival tag, without reading hidden inventories', () => {
  const { g, frame } = fixture();
  const bg = entry();
  appendHomeworldArrivalAmbassador(frame, bg, undefined, source());
  g.pendingAmbassador = bg;
  for (const mutate of [
    (copy: Game) => { copy.players.find(player => player.id === 'b')!.faction = 'atreides'; },
    (copy: Game) => { copy.players.push(newPlayer('b', 'Duplicate BG', 'beneGesserit')); },
    (copy: Game) => { copy.pendingAmbassador!.revivalEvent = 'another-revival'; },
    (copy: Game) => { copy.pendingAmbassador!.guildAdvisorOrigin = { event: 'unrelated', player: 'i', territory: 'arrakeen', sector: 10 }; },
    (copy: Game) => { copy.phase = 5; },
  ]) {
    const copy = structuredClone(g);
    mutate(copy);
    const before = JSON.stringify(copy);
    assert.equal(ambassadorPhaseAllowed(copy), false);
    assert.equal(JSON.stringify(copy), before);
  }
  const wrongTag = structuredClone(g);
  wrongTag.pendingAmbassador!.victoryEvent = frame.event;
  delete wrongTag.pendingAmbassador!.revivalEvent;
  assert.throws(() => validateHomeworldArrival(wrongTag, wrongTag.homeworldRevivalReturn!, 'victoryEvent'));
  for (const player of g.players)
    for (const field of ['hand', 'spice', 'forces', 'reserves', 'tanks', 'traitors', 'faceDancers'])
      Object.defineProperty(player, field, { get() { throw new Error(`unrelated ${field}`); } });
  validateHomeworldArrival(g, frame, 'revivalEvent');
  assert.equal(ambassadorPhaseAllowed(g), true);
});

void test('the signed Spiritual row is canonical after JSON reordering and rejects changed public evidence', () => {
  const { g, frame } = fixture();
  const bg = entry();
  appendHomeworldArrivalAmbassador(frame, bg, undefined, source());
  g.pendingAmbassador = bg;
  const signature = frame.arrivalSignature;
  frame.ambassadors![0].spiritual = Object.fromEntries(Object.entries(frame.ambassadors![0].spiritual!).reverse()) as RevivalSpiritual;
  assert.equal(homeworldArrivalSignature(frame), signature);
  validateHomeworldArrival(g, frame, 'revivalEvent');
  frame.ambassadors![0].spiritual!.amount = 2;
  assert.throws(() => validateHomeworldArrival(g, frame, 'revivalEvent'));
  assert.equal(ambassadorPhaseAllowed(g), false);
});
