import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, newPlayer, type Game } from '../game/engine';
import { createHomeworldCustody } from '../game/homeworld-custody';
import { homeworldContext } from '../game/homeworld-game';
import {
  appendHomeworldArrivalAmbassador, completeHomeworldArrivalAmbassador,
  homeworldArrivalSignature, validateHomeworldArrival,
} from '../game/homeworld-arrival';
import {
  makeHomeworldRevivalReturn, makeHomeworldRevivalProgress,
  homeworldRevivalResumeSignature, validateHomeworldRevivalReturn,
} from '../game/homeworld-revival-return';
import { ambassadorPhaseAllowed } from '../game/ambassador-phase';
import { arrivalOverlapSignature, overlapOwnsAmbassadorDiscard, overlapOwnsTerrorDiscard } from '../game/arrival-overlap';
import { terrorEntrySignature } from '../game/terror-entry-receipt';
import type { RevivalEntryParent, RevivalTerrorPacket } from '../game/revival-terror-entry';
import type { SpiritualAdvisorSource } from '../game/spiritual-advisor';

type Ambassador = NonNullable<Game['pendingAmbassador']>;
type Terror = NonNullable<Game['pendingTerrorEntry']>;
type Overlap = NonNullable<Game['pendingArrivalOverlap']>;

/** Controlled completed-transfer witnesses exercise public continuation rules.
 * Native revival, token revelation and the physical Sneak deposit are root's
 * separate producer tests; no current army is used to recreate these receipts. */
function fixture(fedaykin = false, phase = 4) {
  const owner = fedaykin ? 'f' : 't';
  const g = createGame('REVIVAL-TERROR-ARRIVAL', newPlayer(owner, owner, fedaykin ? 'fremen' : 'tleilaxu'), true, ['ecaz', 'ix']);
  g.players.push(newPlayer('m', 'Moritani', 'moritani'), newPlayer('b', 'BG', 'beneGesserit'),
    newPlayer('e', 'Ecaz', 'ecaz'), newPlayer('i', 'Ixians', 'ixians'));
  g.status = 'playing'; g.turn = 2; g.phase = phase;
  g.order = ['e', 'm', owner, 'b', 'i'];
  g.players[0].reserves = fedaykin ? 4 : 11;
  if (fedaykin) g.players[0].elites = { reserves: 1, tanks: 2, forces: {}, revived: 0 };
  g.homeworlds = { custody: createHomeworldCustody(homeworldContext(g)) };
  const frame = makeHomeworldRevivalReturn({ event: 'revival-original', player: owner, turn: 2, phase,
    source: fedaykin ? 'ghola' : 'normal', ...(fedaykin ? { card: 'original-ghola' } : {}),
    group: fedaykin ? { amount: 1, elite: 1, free: 0 } : { amount: 2, elite: 0, free: 2 },
    quote: fedaykin
      ? { kind: 'fedaykin', normal: 0, elite: 1, beforePopulation: 3, afterPopulation: 4, blocked: null }
      : { kind: 'tleilax', normal: 2, elite: 0, beforePopulation: 9, afterPopulation: 11, blocked: null },
  });
  frame.stage = 'arrival'; frame.destination = 'arrakeen:10'; frame.ambassadors = [];
  frame.resumeResponse = null; frame.resumeSignature = homeworldRevivalResumeSignature(null);
  frame.arrivalSignature = homeworldArrivalSignature(frame);
  g.homeworldRevivalReturn = frame; g.homeworldRevivalProgress = makeHomeworldRevivalProgress(frame);
  g.pendingAmbassador = null;
  return { g, frame };
}

function ambassador(g: Game, event: string, entrant: string, sector = 10): Ambassador {
  return { event, owner: 'e', entrant, territory: 'arrakeen', sector, turn: g.turn, phase: g.phase,
    revivalEvent: g.homeworldRevivalReturn!.event, token: 'ambassador-token', stage: 'cards',
    copyChoices: [], resume: 'none' };
}

function spiritual(g: Game, event = 'spiritual-sneak'): SpiritualAdvisorSource {
  return { event, owner: 'b', turn: g.turn, phase: g.phase, territory: 'arrakeen', sector: 10,
    amount: 1, revivalEvent: g.homeworldRevivalReturn!.event };
}

function originalTerror(g: Game): Terror {
  const frame = g.homeworldRevivalReturn!;
  const entry: Terror = { token: 'terror-sneak-token', entrant: frame.player,
    territory: 'arrakeen', sector: 10, amount: frame.quote.normal + frame.quote.elite,
    elite: frame.quote.elite, cause: 'homeworldRevival', turn: g.turn, phase: g.phase,
    resume: 'none', stage: 'offer', revivalArrival: { event: frame.event } };
  entry.entrySignature = terrorEntrySignature(entry);
  return entry;
}

function sneak(g: Game): RevivalTerrorPacket {
  return { event: originalTerror(g).entrySignature!, owner: 'm', territory: 'arrakeen', sector: 10, amount: 2, elite: 0 };
}

function overlap(g: Game, parent: RevivalEntryParent, entrant = g.homeworldRevivalReturn!.player,
  cause: Terror['cause'] = 'homeworldRevival', first: Overlap['first'] = 'ambassador'): Overlap {
  const source = parent.spiritual;
  const record: Overlap = { event: 'arrival-overlap', signature: '', turn: g.turn, phase: g.phase,
    entrant, territory: 'arrakeen', sector: 10, amount: source?.amount ?? g.homeworldRevivalReturn!.quote.normal + g.homeworldRevivalReturn!.quote.elite,
    elite: source ? 0 : g.homeworldRevivalReturn!.quote.elite, cause, resume: 'none', ecaz: 'e', moritani: 'm',
    first, stage: 'first', ambassadorToken: 'ambassador-token', terrorTokens: ['terror-sneak-token'], revivalArrival: parent };
  g.order = first === 'ambassador' ? ['e', 'm', ...g.order.filter(id => id !== 'e' && id !== 'm')]
    : ['m', 'e', ...g.order.filter(id => id !== 'e' && id !== 'm')];
  record.signature = arrivalOverlapSignature(record); g.pendingArrivalOverlap = record;
  return record;
}

void test('a native Moritani Sneak root may surround the one original revived root without replacing it', () => {
  for (const order of ['before', 'after'] as const) {
    const { g, frame } = fixture(), packet = sneak(g);
    const original = ambassador(g, 'ambassador-original', frame.player), child = ambassador(g, 'ambassador-sneak', 'm');
    for (const current of order === 'before' ? [child, original] : [original, child]) {
      appendHomeworldArrivalAmbassador(frame, current, undefined, undefined, current === child ? packet : undefined);
      g.pendingAmbassador = current;
      validateHomeworldRevivalReturn(g, frame);
      assert.equal(ambassadorPhaseAllowed(g), true);
      completeHomeworldArrivalAmbassador(frame, current.event);
    }
    assert.notEqual(frame.ambassadors!.find(record => record.terror)?.terror, packet);
    const before = JSON.stringify(frame);
    assert.throws(() => appendHomeworldArrivalAmbassador(frame, { ...child, event: 'duplicate-sneak' }, undefined, undefined, packet));
    assert.throws(() => appendHomeworldArrivalAmbassador(frame, { ...original, event: 'duplicate-original' }));
    assert.equal(JSON.stringify(frame), before);
    g.pendingAmbassador = null; frame.stage = 'complete';
    g.homeworldRevivalProgress = makeHomeworldRevivalProgress(frame);
    validateHomeworldRevivalReturn(g, frame);
  }
});

void test('Sneak roots retain the phase of an actual Southern return instead of requiring Revival phase', () => {
  for (const phase of [1, 3, 5, 8]) {
    const { g, frame } = fixture(true, phase), child = ambassador(g, 'ambassador-sneak', 'm');
    appendHomeworldArrivalAmbassador(frame, child, undefined, undefined, sneak(g));
    g.pendingAmbassador = child;
    validateHomeworldRevivalReturn(g, frame);
    assert.equal(ambassadorPhaseAllowed(g), true);
    const wrong = structuredClone(g);
    wrong.phase = phase === 8 ? 0 : phase + 1;
    assert.equal(ambassadorPhaseAllowed(wrong), false);
  }
});

void test('Southern permits a BG Spiritual root only with the same committed native Sneak witness', () => {
  const { g, frame } = fixture(true), bg = ambassador(g, 'ambassador-bg', 'b'), source = spiritual(g), packet = sneak(g);
  appendHomeworldArrivalAmbassador(frame, bg, undefined, source, packet);
  g.pendingAmbassador = bg;
  validateHomeworldRevivalReturn(g, frame);
  assert.equal(ambassadorPhaseAllowed(g), true);
  completeHomeworldArrivalAmbassador(frame, bg.event);
  const changed = { ...packet, amount: 3 }, before = JSON.stringify(frame);
  assert.throws(() => appendHomeworldArrivalAmbassador(frame, ambassador(g, 'changed-sneak', 'm'), undefined, undefined, changed));
  assert.equal(JSON.stringify(frame), before);
  const native = ambassador(g, 'ambassador-sneak', 'm');
  appendHomeworldArrivalAmbassador(frame, native, undefined, undefined, packet);
  g.pendingAmbassador = native;
  assert.equal(ambassadorPhaseAllowed(g), true);

  const unbacked = fixture(true), unbackedBg = ambassador(unbacked.g, 'unbacked-bg', 'b');
  appendHomeworldArrivalAmbassador(unbacked.frame, unbackedBg, undefined, spiritual(unbacked.g));
  unbacked.g.pendingAmbassador = unbackedBg;
  assert.equal(ambassadorPhaseAllowed(unbacked.g), false);
});

void test('a captured Polar Spiritual arrival supports its actual Sneak and BG child roots', () => {
  const { g, frame } = fixture();
  const polarSource = { ...spiritual(g, 'spiritual-polar'), territory: 'polar_sink', sector: 0 };
  const trigger: Terror = { ...originalTerror(g), entrant: 'b', territory: 'polar_sink', sector: 0,
    amount: 1, elite: 0, cause: 'advisor', revivalArrival: { event: frame.event, spiritual: polarSource } };
  trigger.entrySignature = terrorEntrySignature(trigger);
  const packet: RevivalTerrorPacket = { event: trigger.entrySignature, owner: 'm', territory: 'polar_sink', sector: 0, amount: 2, elite: 0 };
  const native = { ...ambassador(g, 'polar-sneak-root', 'm'), territory: 'polar_sink', sector: 0 };
  appendHomeworldArrivalAmbassador(frame, native, undefined, undefined, packet);
  g.pendingAmbassador = native;
  validateHomeworldRevivalReturn(g, frame);
  assert.equal(ambassadorPhaseAllowed(g), true);
  completeHomeworldArrivalAmbassador(frame, native.event);
  const bg = { ...ambassador(g, 'polar-bg-child', 'b'), territory: 'polar_sink', sector: 0 };
  appendHomeworldArrivalAmbassador(frame, bg, undefined,
    { ...polarSource, event: 'spiritual-from-polar-sneak' }, packet);
  g.pendingAmbassador = bg;
  validateHomeworldRevivalReturn(g, frame);
  assert.equal(ambassadorPhaseAllowed(g), true);
  const wrong = structuredClone(g);
  const current = wrong.homeworldRevivalReturn!.ambassadors!.at(-1)!;
  current.terror!.territory = 'carthag'; current.terror!.sector = 11;
  assert.throws(() => validateHomeworldArrival(wrong, wrong.homeworldRevivalReturn!, 'revivalEvent'));
});

void test('Sneak Ambassador provenance rejects foreign packets, quantities, historical clocks and synthetic entrants', () => {
  for (const patch of [{ owner: 'b' }, { amount: 0 }, { amount: 6 }, { elite: 1 },
    { territory: 'carthag', sector: 11 }, { card: 'private-card' }, { event: 'unbound-source' }]) {
    const { g, frame } = fixture(), before = JSON.stringify(frame);
    assert.throws(() => {
      appendHomeworldArrivalAmbassador(frame, ambassador(g, 'ambassador-sneak', 'm'), undefined, undefined,
        { ...sneak(g), ...patch } as RevivalTerrorPacket);
      g.pendingAmbassador = ambassador(g, 'ambassador-sneak', 'm');
      validateHomeworldArrival(g, frame, 'revivalEvent');
    });
    if (frame.ambassadors!.length === 0) assert.equal(JSON.stringify(frame), before);
  }
  const { g, frame } = fixture(), original = originalTerror(g);
  original.turn = 1; original.entrySignature = terrorEntrySignature(original);
  appendHomeworldArrivalAmbassador(frame, ambassador(g, 'old-clock', 'm'), undefined, undefined,
    { ...sneak(g), event: original.entrySignature });
  g.pendingAmbassador = ambassador(g, 'old-clock', 'm');
  assert.equal(ambassadorPhaseAllowed(g), false);
  const other = fixture();
  assert.throws(() => appendHomeworldArrivalAmbassador(other.frame, ambassador(other.g, 'synthetic-original', 't'), undefined, undefined, sneak(other.g)));
});

void test('old Spiritual signature rows stay unchanged and native Sneak roots retain Guild suffixes', () => {
  const direct = fixture(), bg = ambassador(direct.g, 'direct-bg', 'b'), source = spiritual(direct.g, 'direct-spiritual');
  appendHomeworldArrivalAmbassador(direct.frame, bg, undefined, source);
  assert.equal(direct.frame.arrivalSignature, JSON.stringify(['homeworldRevivalArrival', direct.frame.signature, 'arrakeen:10',
    [[bg.event, 'b', 'arrakeen:10', null, false, [source.event, 'b', 2, 4, 'arrakeen', 10, 1, direct.frame.event]]]]));
  const { g, frame } = fixture(), root = ambassador(g, 'sneak-root', 'm'), packet = sneak(g);
  appendHomeworldArrivalAmbassador(frame, root, undefined, undefined, packet);
  completeHomeworldArrivalAmbassador(frame, root.event);
  const suffix: Ambassador = { ...ambassador(g, 'guild-bg-suffix', 'b'),
    guildAdvisorOrigin: { event: root.event, player: 'i', territory: 'arrakeen', sector: 10 } };
  assert.throws(() => appendHomeworldArrivalAmbassador(frame, suffix, root.event, undefined, packet));
  appendHomeworldArrivalAmbassador(frame, suffix, root.event);
  g.pendingAmbassador = suffix;
  assert.equal(ambassadorPhaseAllowed(g), true);
});

void test('overlap signatures preserve legacy bytes and bind new revived provenance canonically', () => {
  const { g } = fixture(), parent: RevivalEntryParent = { event: g.homeworldRevivalReturn!.event, spiritual: spiritual(g), terror: sneak(g) };
  const record = overlap(g, parent, 'b', 'advisor');
  const signature = record.signature;
  record.revivalArrival = { terror: { ...parent.terror! }, spiritual: { ...parent.spiritual! }, event: parent.event };
  assert.equal(arrivalOverlapSignature(record), signature);
  delete record.revivalArrival;
  record.phase = 5; record.cause = 'shipment';
  assert.equal(arrivalOverlapSignature(record), JSON.stringify([record.event, record.turn, 5, record.entrant,
    record.territory, record.sector, record.amount, record.elite, 'shipment', record.resume,
    record.ecaz, record.moritani, record.first, record.ambassadorToken, record.terrorTokens]));
});

void test('a bound revived overlap owns each active discard while the primary and its clock remain live', () => {
  const { g, frame } = fixture(), parent = { event: frame.event };
  const current = ambassador(g, 'original-ambassador', frame.player);
  current.arrivalCause = 'homeworldRevival';
  appendHomeworldArrivalAmbassador(frame, current);
  const record = overlap(g, parent);
  record.ambassadorEvent = current.event;
  g.pendingAmbassador = null;
  assert.equal(overlapOwnsAmbassadorDiscard(g, current), true, 'The discard owns the suspended actual Ambassador.');
  assert.equal(overlapOwnsTerrorDiscard(g, originalTerror(g), 'm'), false);
  completeHomeworldArrivalAmbassador(frame, current.event);
  record.stage = 'second';
  const terror = originalTerror(g);
  assert.equal(overlapOwnsTerrorDiscard(g, terror, 'm'), true);
  assert.equal(overlapOwnsTerrorDiscard(g, terror, 'e'), false);
  assert.equal(overlapOwnsTerrorDiscard(g, { ...terror, amount: 1 }, 'm'), false);
  assert.equal(overlapOwnsTerrorDiscard(g, { ...terror, revivalArrival: { event: 'unrelated' } }, 'm'), false);
  const wrongPhase = structuredClone(g); wrongPhase.phase = 5;
  assert.equal(overlapOwnsTerrorDiscard(wrongPhase, terror, 'm'), false);
  const missing = structuredClone(g); delete missing.pendingArrivalOverlap!.revivalArrival;
  missing.pendingArrivalOverlap!.signature = arrivalOverlapSignature(missing.pendingArrivalOverlap!);
  assert.equal(overlapOwnsTerrorDiscard(missing, terror, 'm'), false);
});

void test('Spiritual overlap discard matches the recorded packet, including Southern Sneak context, without private reads', () => {
  const { g, frame } = fixture(true), source = spiritual(g), packet = sneak(g);
  const parent: RevivalEntryParent = { event: frame.event, spiritual: source, terror: packet };
  const bg = ambassador(g, 'sneak-bg-ambassador', 'b'); bg.arrivalCause = 'advisor';
  appendHomeworldArrivalAmbassador(frame, bg, undefined, source, packet);
  const record = overlap(g, parent, 'b', 'advisor'); record.ambassadorEvent = bg.event;
  g.pendingAmbassador = null;
  assert.equal(overlapOwnsAmbassadorDiscard(g, bg), true);
  const changed = structuredClone(g);
  changed.pendingArrivalOverlap!.revivalArrival!.spiritual!.event = 'another-spiritual';
  changed.pendingArrivalOverlap!.signature = arrivalOverlapSignature(changed.pendingArrivalOverlap!);
  assert.equal(overlapOwnsAmbassadorDiscard(changed, bg), false, 'A same-price packet cannot replace the recorded physical source.');
  for (const player of g.players)
    for (const field of ['hand', 'spice', 'forces', 'reserves', 'tanks', 'traitors', 'faceDancers'])
      Object.defineProperty(player, field, { get() { throw new Error(`unrelated ${field}`); } });
  assert.equal(overlapOwnsAmbassadorDiscard(g, bg), true);
});

void test('an out-of-phase Southern overlap can settle Terror first and its original Ambassador second', () => {
  const { g, frame } = fixture(true, 3), parent = { event: frame.event };
  const record = overlap(g, parent, frame.player, 'homeworldRevival', 'terror');
  assert.equal(overlapOwnsTerrorDiscard(g, originalTerror(g), 'm'), true);
  const current = ambassador(g, 'southern-original-ambassador', frame.player);
  current.arrivalCause = 'homeworldRevival';
  appendHomeworldArrivalAmbassador(frame, current);
  record.stage = 'second'; record.ambassadorEvent = current.event;
  g.pendingAmbassador = null;
  assert.equal(overlapOwnsAmbassadorDiscard(g, current), true);
  assert.equal(overlapOwnsTerrorDiscard(g, originalTerror(g), 'm'), false);
});
