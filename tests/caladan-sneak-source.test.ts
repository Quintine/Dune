import assert from 'node:assert/strict';
import test from 'node:test';
import { createGame, newPlayer, type Game } from '../game/engine';
import { createHomeworldCustody, HomeworldCustodyError } from '../game/homeworld-custody';
import { homeworldContext } from '../game/homeworld-game';
import { createTerrorState } from '../game/moritani-terror';
import { terrorEntrySignature, terrorSelectionSignature } from '../game/terror-entry-receipt';
import {
  makeHomeworldVictoryReturn, homeworldVictoryOfferSignature, homeworldVictoryObligationSignature,
} from '../game/homeworld-victory-return';
import {
  appendHomeworldArrivalAmbassador, completeHomeworldArrivalAmbassador, homeworldArrivalSignature,
  validateHomeworldArrival, type HomeworldArrivalFrame,
} from '../game/homeworld-arrival';
import {
  createCaladanSneakReceipt, validateCaladanSneakHistory, validateCaladanTerrorPacket,
  validCaladanEntryParent, caladanEntryParentTuple, validateCaladanChildArrival,
  type CaladanEntryParent, type CaladanTerrorHistoryContext,
} from '../game/caladan-arrival';

const uuid = '00112233-4455-4677-8899-aabbccddeeff';
const otherUUID = '11112233-4455-4677-8899-aabbccddeeff';

/** Controlled provenance unit: signed victory/arrival records, selected removed
 * Sneak token and private stacked candidates are scenario inputs. This does not
 * claim a native battle, placement, reserve debit or second-token chronology. */
function fixture() {
  const g = createGame('CALADANSNEAKSOURCE', newPlayer('a', 'Atreides', 'atreides'), true, ['ecaz']);
  g.players.push(newPlayer('m', 'Moritani', 'moritani'), newPlayer('bg', 'BG', 'beneGesserit'), newPlayer('ec', 'Ecaz', 'ecaz'));
  Object.assign(g, { status: 'playing', turn: 2, phase: 6 });
  Object.assign(g.players[0], { reserves: 5, tanks: 12, forces: { 'arrakeen:10': 3 } });
  g.homeworlds = { custody: createHomeworldCustody(homeworldContext(g)) };
  const context = { event: 'original-victory', turn: 2, territory: 'arrakeen', winner: 'a', result: 'normal' } as NonNullable<Game['lastBattleContext']>;
  const frame = makeHomeworldVictoryReturn({ event: context.event, turn: 2, player: 'a', territory: 'arrakeen', result: 'normal' });
  frame.stage = 'arrival'; frame.destination = 'arrakeen:10'; frame.ambassadors = [];
  frame.offer = { population: 6, survivors: 2, blocked: null,
    signature: homeworldVictoryOfferSignature(frame, { population: 6, survivors: 2, blocked: null }) };
  frame.arrivalSignature = homeworldArrivalSignature(frame);
  context.caladanReinforcement = { event: frame.event, completed: false, stage: 'arrival',
    signature: homeworldVictoryObligationSignature(context, false, 'arrival') };
  g.lastBattleContext = context; g.homeworldVictoryReinforcement = frame;
  g.moritaniTerror = createTerrorState(() => 0);
  const token = g.moritaniTerror.tokens.find(candidate => candidate.kind === 'sneakAttack')!;
  token.status = 'removed'; token.location = null;
  const hidden = g.moritaniTerror.tokens.filter(candidate => candidate.id !== token.id).slice(0, 2);
  for (const candidate of hidden) { candidate.status = 'placed'; candidate.location = 'arrakeen'; }
  const entry: NonNullable<Game['pendingTerrorEntry']> = { token: token.id,
    candidates: [token.id, ...hidden.map(candidate => candidate.id)], entrant: 'a', territory: 'arrakeen',
    sector: 10, amount: 1, elite: 0, cause: 'caladanReinforcement', victoryEvent: frame.event,
    turn: 2, phase: 6, stage: 'sneakAttack', resume: 'none' };
  entry.selectionSignature = terrorSelectionSignature(entry); entry.entrySignature = terrorEntrySignature(entry);
  g.pendingTerrorEntry = entry; g.decision = { kind: 'moritaniTerror', player: 'm', entrant: 'a', territory: 'arrakeen' };
  return { g, frame, entry, hidden: hidden.map(candidate => candidate.id) };
}
function committed(amount = 2) {
  const f = fixture(), result = createCaladanSneakReceipt(f.g, f.entry, 'm', amount, uuid);
  // Controlled ledger append represents the caller's post-transfer step. This
  // unit does not claim to have operated the native transfer itself.
  f.frame.terrorArrivals = [result.receipt];
  return { ...f, ...result };
}
function history(f: ReturnType<typeof committed>): CaladanTerrorHistoryContext {
  return { turn: f.frame.turn, phase: 6, players: f.g.players, victoryPlayer: f.frame.player,
    terrorArrivals: f.frame.terrorArrivals! };
}

void test('Caladan Sneak quotes an opaque public packet and sanitized used-token history without private stack identities', () => {
  const f = fixture(), before = structuredClone(f.g);
  const result = createCaladanSneakReceipt(f.g, f.entry, 'm', 2, uuid);
  assert.deepEqual(result.packet, { event: uuid, owner: 'm', territory: 'arrakeen', sector: 10, amount: 2, elite: 0 });
  assert.notEqual(result.packet.event, f.entry.entrySignature);
  assert.equal(result.receipt.token, f.entry.token);
  assert.deepEqual(Object.keys(result.receipt.trigger).sort(), ['amount', 'cause', 'elite', 'entrant', 'sector', 'territory', 'victoryEvent']);
  for (const id of f.hidden) {
    assert.ok(!JSON.stringify(result.packet).includes(id));
    assert.ok(!JSON.stringify(result.receipt).includes(id));
  }
  assert.doesNotMatch(JSON.stringify(result.receipt), /candidates|selectionSignature|entrySignature|"players"|"hand"/);
  assert.notEqual(result.packet, result.receipt.packet);
  assert.deepEqual(f.g, before);
  f.g.decision = null; // applyAction clears its owned decision during dispatch.
  assert.doesNotThrow(() => createCaladanSneakReceipt(f.g, f.entry, 'm', 2, otherUUID));
});

void test('the current selected Sneak stage owner source and positive packet count remain required before debit', () => {
  for (const variant of ['owner', 'zero', 'oversize', 'raw-event', 'stage', 'source'] as const) {
    const f = fixture();
    const entry = variant === 'source' ? { ...f.entry, amount: 2 } : f.entry;
    if (variant === 'stage') f.entry.stage = 'offer';
    const before = structuredClone(f.g);
    assert.throws(() => createCaladanSneakReceipt(f.g, entry, variant === 'owner' ? 'ec' : 'm',
      variant === 'zero' ? 0 : variant === 'oversize' ? 6 : 2,
      variant === 'raw-event' ? f.entry.entrySignature! : uuid), HomeworldCustodyError);
    assert.deepEqual(f.g, before);
  }
});

void test('opaque history validates its original source after resources token custody and the latest battle have changed', () => {
  const f = committed();
  validateCaladanTerrorPacket(history(f), f.packet, f.frame.destination!, f.frame.event);
  validateCaladanSneakHistory(f.g);
  f.g.players.find(player => player.id === 'm')!.reserves = 0;
  f.g.players[0].forces = {};
  f.g.moritaniTerror!.tokens = [];
  f.frame.stage = 'complete'; f.g.lastBattleContext = undefined; f.g.turn = 3; f.g.phase = 8;
  assert.doesNotThrow(() => validateCaladanSneakHistory(f.g));
  const modified = { ...f.packet, amount: 3 };
  assert.throws(() => validateCaladanTerrorPacket(history(f), modified, f.frame.destination!, f.frame.event), HomeworldCustodyError);
  assert.throws(() => validateCaladanTerrorPacket(history(f), f.packet, 'carthag:11', f.frame.event), HomeworldCustodyError);
});

void test('new Moritani and Spiritual child entries bind their own packets and cannot reuse the original Caladan force', () => {
  const f = committed(), parent: CaladanEntryParent = { event: f.frame.event, terror: f.packet };
  const direct = { entrant: 'm', territory: 'arrakeen', sector: 10, amount: 2, elite: 0, cause: 'shipment' };
  assert.ok(validCaladanEntryParent(parent));
  validateCaladanChildArrival(f.g, parent, direct);
  assert.throws(() => validateCaladanChildArrival(f.g, parent, { ...direct, entrant: 'a', amount: 1, cause: 'caladanReinforcement' }), HomeworldCustodyError);
  const spiritual: CaladanEntryParent = { ...parent, spiritual: { event: 'actual-bg-packet', owner: 'bg', turn: 2,
    phase: 6, territory: 'polar_sink', sector: 0, amount: 1, victoryEvent: f.frame.event } };
  const advisor = { entrant: 'bg', territory: 'polar_sink', sector: 0, amount: 1, elite: 0, cause: 'advisor' };
  validateCaladanChildArrival(f.g, spiritual, advisor);
  assert.deepEqual(caladanEntryParentTuple(spiritual), ['caladanArrival', f.frame.event,
    ['actual-bg-packet', 'bg', 2, 6, 'polar_sink', 0, 1, f.frame.event],
    [uuid, 'm', 'arrakeen', 10, 2, 0]]);
  assert.equal(validCaladanEntryParent({ event: f.frame.event, spiritual: spiritual.spiritual }), false);
  assert.equal(validCaladanEntryParent({ ...parent, spiritual: undefined }), false);
  assert.throws(() => validateCaladanChildArrival(f.g, spiritual, { ...advisor, amount: 2 }), HomeworldCustodyError);
  assert.throws(() => validateCaladanChildArrival(f.g, { ...parent, terror: { ...f.packet, event: otherUUID } }, direct), HomeworldCustodyError);
});

void test('phase-six Ambassador history resolves opaque Caladan packets and their Spiritual roots without storing private stack signatures', () => {
  const f = committed();
  const entry: NonNullable<Game['pendingAmbassador']> = { event: 'sneak-ambassador', owner: 'ec', entrant: 'm',
    territory: 'arrakeen', sector: 10, turn: 2, phase: 6, victoryEvent: f.frame.event,
    token: 'controlled-ambassador-token', stage: 'offer', copyChoices: [], resume: 'none' };
  appendHomeworldArrivalAmbassador(f.frame, entry, undefined, undefined, f.packet);
  f.g.pendingAmbassador = entry;
  validateHomeworldArrival(f.g, f.frame, 'victoryEvent');
  completeHomeworldArrivalAmbassador(f.frame, entry.event); f.g.pendingAmbassador = null;
  const source = { event: 'spiritual-packet', owner: 'bg', turn: 2, phase: 6,
    territory: 'polar_sink', sector: 0, amount: 1, victoryEvent: f.frame.event };
  const bg = { ...entry, event: 'spiritual-ambassador', entrant: 'bg', territory: 'polar_sink', sector: 0 };
  appendHomeworldArrivalAmbassador(f.frame, bg, undefined, source, f.packet); f.g.pendingAmbassador = bg;
  validateHomeworldArrival(f.g, f.frame, 'victoryEvent');
  for (const id of f.hidden) assert.ok(!f.frame.arrivalSignature!.includes(id));
  assert.ok(!f.frame.arrivalSignature!.includes(f.entry.entrySignature!));
});

void test('legacy phase-four Spiritual bytes and phase-six Guild child bytes stay unchanged', () => {
  const old: HomeworldArrivalFrame = { event: 'old-return', turn: 2, phase: 4, player: 't', stage: 'arrival',
    signature: 'old-original-signature', destination: 'arrakeen:10', ambassadors: [] };
  old.arrivalSignature = homeworldArrivalSignature(old);
  const source = { event: 'old-spiritual', owner: 'bg', turn: 2, phase: 4, territory: 'arrakeen', sector: 10,
    amount: 1, revivalEvent: old.event };
  appendHomeworldArrivalAmbassador(old, { event: 'old-ambassador', entrant: 'bg', territory: 'arrakeen', sector: 10,
    turn: 2, phase: 4 }, undefined, source);
  assert.equal(old.arrivalSignature, JSON.stringify(['homeworldRevivalArrival', old.signature, old.destination,
    [['old-ambassador', 'bg', 'arrakeen:10', null, false, ['old-spiritual', 'bg', 2, 4, 'arrakeen', 10, 1, old.event]]]]));
  const guild: HomeworldArrivalFrame = { event: 'old-victory', turn: 2, phase: 6, player: 'a', stage: 'arrival',
    signature: 'old-victory-signature', destination: 'arrakeen:10', ambassadors: [
      { event: 'guild-parent', entrant: 'a', destination: 'arrakeen:10', completed: true },
      { event: 'guild-bg-child', entrant: 'bg', destination: 'polar_sink:0', parent: 'guild-parent', completed: false },
    ] };
  assert.equal(homeworldArrivalSignature(guild), JSON.stringify(['homeworldRevivalArrival', guild.signature, guild.destination,
    [['guild-parent', 'a', 'arrakeen:10', null, true], ['guild-bg-child', 'bg', 'polar_sink:0', 'guild-parent', false]]]));
});
