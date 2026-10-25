import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, newPlayer, type Game } from '../game/engine';
import { createHomeworldCustody, HomeworldCustodyError } from '../game/homeworld-custody';
import { homeworldContext } from '../game/homeworld-game';
import { appendHomeworldArrivalAmbassador, homeworldArrivalSignature } from '../game/homeworld-arrival';
import { makeHomeworldRevivalReturn, makeHomeworldRevivalProgress } from '../game/homeworld-revival-return';
import { terrorEntrySignature, validateTerrorEntrySignature } from '../game/terror-entry-receipt';
import {
  revivalOwnsTerrorEntry, validateRevivalTerrorEntry, validateRevivalArrivalSource,
  validateRevivalTerrorPacket, validRevivalEntryParent, validRevivalTerrorPacket,
  type RevivalEntryParent, type RevivalTerrorPacket, type RevivalArrivalDetails,
} from '../game/revival-terror-entry';

type Entry = NonNullable<Game['pendingTerrorEntry']>;
/** Controlled conserved arrival context with a real constructed original-return
 * receipt. No native play or card-disposal chronology is claimed here. */
function fixture(fremen = false) {
  const g = createGame('REVIVALTERRORSOURCE', newPlayer('native', 'Native', fremen ? 'fremen' : 'tleilaxu'), false, ['ix', 'ecaz']);
  g.players.push(newPlayer('bg', 'BG', 'beneGesserit'), newPlayer('m', 'Moritani', 'moritani'), newPlayer('ec', 'Ecaz', 'ecaz'));
  g.status = 'playing'; g.turn = 2; g.phase = 4;
  const native = g.players[0];
  native.reserves = fremen ? 2 : 10; native.tanks = fremen ? 17 : 8;
  native.forces = { 'arrakeen:10': fremen ? 1 : 2 };
  if (fremen) native.elites = { reserves: 1, tanks: 1, forces: { 'arrakeen:10': 1 }, revived: 1 };
  g.homeworlds = { custody: createHomeworldCustody(homeworldContext(g)) };
  const frame = makeHomeworldRevivalReturn({ event: 'original-return', turn: 2, phase: 4, player: 'native', source: 'normal',
    group: fremen ? { amount: 1, elite: 1, free: 1 } : { amount: 3, elite: 0, free: 2 },
    quote: fremen ? { kind: 'fedaykin', normal: 0, elite: 1, beforePopulation: 2, afterPopulation: 3, blocked: null }
      : { kind: 'tleilax', normal: 2, elite: 0, beforePopulation: 9, afterPopulation: 12, blocked: null } });
  frame.stage = 'arrival'; frame.destination = 'arrakeen:10'; frame.resumeResponse = null; frame.resumeSignature = 'null';
  frame.ambassadors = []; frame.arrivalSignature = homeworldArrivalSignature(frame);
  g.homeworldRevivalReturn = frame; g.homeworldRevivalProgress = makeHomeworldRevivalProgress(frame);
  const entry: Entry = { token: 'original-opaque-token', entrant: 'native', territory: 'arrakeen', sector: 10,
    amount: frame.quote.normal + frame.quote.elite, elite: frame.quote.elite,
    cause: 'homeworldRevival', turn: 2, phase: 4, stage: 'offer', resume: 'none', revivalArrival: { event: frame.event } };
  entry.entrySignature = terrorEntrySignature(entry);
  return { g, frame, entry };
}
function spiritual(parent: RevivalEntryParent, territory = 'arrakeen', sector = 10): RevivalEntryParent {
  return { ...structuredClone(parent), spiritual: { event: 'original-spiritual-packet', owner: 'bg', turn: 2, phase: 4,
    territory, sector, amount: 1, revivalEvent: parent.event } };
}
function packet(entry: Entry): RevivalTerrorPacket {
  return { event: entry.entrySignature!, owner: 'm', territory: entry.territory, sector: entry.sector, amount: 2, elite: 0 };
}
const sneakDetails = (source: RevivalTerrorPacket): RevivalArrivalDetails => ({ entrant: source.owner,
  territory: source.territory, sector: source.sector, amount: source.amount, elite: source.elite, cause: 'shipment' });

void test('original native return binds exact force types, clock and board destination without mutation', () => {
  for (const fremen of [false, true]) {
    const { g, entry } = fixture(fremen), before = structuredClone({ g, entry });
    assert.equal(revivalOwnsTerrorEntry(g, entry), true);
    validateRevivalTerrorEntry(g, entry); validateTerrorEntrySignature(entry);
    assert.deepEqual({ g, entry }, before);
  }
});

void test('present metadata rejects stale, foreign, wrong-actor and changed original groups', () => {
  const changes: ((g: Game, entry: Entry) => void)[] = [
    (_g, entry) => { entry.revivalArrival!.event = 'foreign-return'; },
    (_g, entry) => { entry.entrant = 'bg'; }, (_g, entry) => { entry.cause = 'movement'; },
    (_g, entry) => { entry.amount++; }, (_g, entry) => { entry.elite = 1; },
    (_g, entry) => { entry.territory = 'carthag'; entry.sector = 11; },
    (_g, entry) => { entry.turn = 3; }, (_g, entry) => { entry.phase = 5; },
    g => { delete g.homeworldRevivalReturn; },
    g => { g.homeworldRevivalReturn!.stage = 'complete'; },
    g => { g.homeworldRevivalReturn!.group.amount++; },
  ];
  for (const change of changes) {
    const { g, entry } = fixture(); change(g, entry);
    const before = structuredClone({ g, entry });
    assert.throws(() => revivalOwnsTerrorEntry(g, entry), HomeworldCustodyError);
    assert.deepEqual({ g, entry }, before);
  }
});

void test('Spiritual entry uses the exact committed BG packet rather than original native counts or current survivors', () => {
  const { g, entry } = fixture();
  entry.revivalArrival = spiritual(entry.revivalArrival!); entry.entrant = 'bg'; entry.cause = 'advisor'; entry.amount = 1;
  entry.entrySignature = terrorEntrySignature(entry);
  validateRevivalTerrorEntry(g, entry);
  assert.deepEqual(g.players.find(player => player.id === 'bg')!.forces, {});
  for (const patch of [{ entrant: 'native' }, { cause: 'shipment' }, { amount: 2 }, { elite: 1 }])
    assert.throws(() => validateRevivalTerrorEntry(g, { ...entry, ...patch } as Entry), HomeworldCustodyError);
});

void test('Sneak source retains its captured exact revival identity after the original Terror action is gone', () => {
  const { g, entry, frame } = fixture(), terror = packet(entry);
  const parent = { event: frame.event, terror };
  assert.ok(validRevivalTerrorPacket(terror));
  validateRevivalTerrorPacket({ ...g, revivalPlayer: frame.player }, terror, frame.destination!, frame.event);
  validateRevivalArrivalSource(g, parent, sneakDetails(terror));
  const changed = structuredClone(terror); changed.elite = 1;
  assert.equal(validRevivalTerrorPacket(changed), false);
  assert.throws(() => validateRevivalArrivalSource(g, { event: frame.event, terror: changed }, sneakDetails(changed)), HomeworldCustodyError);
  assert.throws(() => validateRevivalTerrorPacket({ ...g, revivalPlayer: frame.player }, terror, frame.destination!, 'foreign-return'), HomeworldCustodyError);
  assert.throws(() => validateRevivalArrivalSource(g, parent, { ...sneakDetails(terror), amount: 1 }), HomeworldCustodyError);
  assert.throws(() => validateRevivalArrivalSource(g, { event: frame.event, terror: { ...terror, owner: 'bg' } }, sneakDetails(terror)), HomeworldCustodyError);
});

void test('captured BG Polar Terror source and subsequent Southern-derived Spiritual packet retain both actual packets', () => {
  const { g, entry, frame } = fixture(true);
  assert.throws(() => validateRevivalArrivalSource(g, spiritual({ event: frame.event }),
    { entrant: 'bg', territory: 'arrakeen', sector: 10, amount: 1, elite: 0, cause: 'advisor' }), HomeworldCustodyError);
  // A committed BG packet from a native T return can reach Polar Nexus Terror;
  // the resulting Sneak record binds that source point, not the revival sector.
  const t = fixture();
  t.entry.revivalArrival = spiritual(t.entry.revivalArrival!, 'polar_sink', 0);
  Object.assign(t.entry, { entrant: 'bg', territory: 'polar_sink', sector: 0, amount: 1, elite: 0, cause: 'advisor' });
  t.entry.nexusPlacements = { [t.entry.token]: 'original-nexus-placement' };
  t.entry.entrySignature = terrorEntrySignature(t.entry);
  validateTerrorEntrySignature(t.entry);
  const terror = packet(t.entry);
  validateRevivalTerrorPacket({ ...t.g, revivalPlayer: t.frame.player }, terror, t.frame.destination!, t.frame.event);
  const southernTerror = packet(entry), combined = spiritual({ event: frame.event, terror: southernTerror }, 'polar_sink', 0);
  const details: RevivalArrivalDetails = { entrant: 'bg', territory: 'polar_sink', sector: 0, amount: 1, elite: 0, cause: 'advisor' };
  const before = structuredClone({ g, combined, details });
  validateRevivalArrivalSource(g, combined, details);
  assert.deepEqual({ g, combined, details }, before);
  assert.throws(() => validateRevivalArrivalSource(g, combined, { ...details, amount: 2 }), HomeworldCustodyError);
});

void test('an owned Ambassador suspended for its physical discard still validates the original return', () => {
  const { g, entry, frame } = fixture();
  const ambassador: NonNullable<Game['pendingAmbassador']> = { event: 'original-ambassador', owner: 'ec', entrant: 'native',
    territory: 'arrakeen', sector: 10, turn: 2, phase: 4, revivalEvent: frame.event,
    token: 'original-ambassador-token', stage: 'offer', copyChoices: [], resume: 'none' };
  appendHomeworldArrivalAmbassador(frame, ambassador);
  // Only the wrapper is controlled: this unit does not claim a real discard.
  g.pendingTreacheryDiscard = { continuation: { kind: 'ambassador', entry: ambassador } } as Game['pendingTreacheryDiscard'];
  g.pendingAmbassador = null;
  const before = structuredClone(g);
  validateRevivalTerrorEntry(g, entry);
  assert.deepEqual(g, before);
});

void test('source-absent legacy entries retain their exact old bytes and never gain revival ownership', () => {
  const { g, entry } = fixture(); delete entry.revivalArrival; entry.cause = 'shipment';
  entry.entrySignature = terrorEntrySignature(entry);
  assert.equal(entry.entrySignature, JSON.stringify([entry.token, entry.entrant, entry.territory, entry.sector,
    entry.amount, entry.elite, entry.cause, entry.turn, entry.phase, entry.resume, null]));
  validateTerrorEntrySignature(entry);
  assert.equal(revivalOwnsTerrorEntry(g, entry), false);
  const noReceipt = { ...entry }; delete noReceipt.entrySignature;
  validateRevivalTerrorEntry(g, noReceipt); validateTerrorEntrySignature(noReceipt);
  assert.equal(revivalOwnsTerrorEntry(g, noReceipt), false);
});

void test('new metadata is signature-bound and malformed optional packets cannot bypass receipt checks', () => {
  const { entry } = fixture(), original = entry.entrySignature;
  entry.revivalArrival = spiritual(entry.revivalArrival!);
  assert.notEqual(terrorEntrySignature(entry), original);
  assert.throws(() => validateTerrorEntrySignature(entry), HomeworldCustodyError);
  assert.equal(validRevivalEntryParent({ event: 'original-return', extra: true }), false);
  assert.equal(validRevivalEntryParent({ event: 'original-return', terror: { event: 'not-json' } }), false);
  assert.equal(validRevivalEntryParent({ event: 'original-return', spiritual: undefined }), false);
  delete entry.entrySignature;
  assert.throws(() => validateTerrorEntrySignature(entry), HomeworldCustodyError);
});
