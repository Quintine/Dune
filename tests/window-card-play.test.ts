import assert from 'node:assert/strict';
import test from 'node:test';
import { WINDOW_CARD_EFFECTS, karamaShipmentOpportunities, parseKaramaShipmentSource, windowCardNativeEffect, windowCardOpportunity,
  type WindowCardGame } from '../game/window-card-play';

function storm(): WindowCardGame {
  return { status: 'playing', phase: 0, turn: 3, shieldWallDestroyed: false };
}
function blow(): WindowCardGame {
  return { ...storm(), phase: 1, spiceWindow: { event: 'spice-blow:1', territory: 'hagga_basin', sector: 5, harvested: false } };
}
function auction(): WindowCardGame {
  return { ...storm(), phase: 3, auction: { cards: [{ id: 'private-card:1' }, { id: 'private-card:2' }], index: 0 } };
}
function publicAuction(): WindowCardGame {
  return { ...storm(), phase: 3, auction: { bid: 4, bidder: 'respondent', remaining: 2 }, bidPromiseLot: { turn: 3, lot: 1 } };
}
const shipmentSource = (recipient: string, turn = 3) => JSON.stringify(['karamaShipment', turn, recipient, 'original']);
function shipments(): WindowCardGame {
  return { ...storm(), phase: 5, active: 'first', movementRemaining: ['first', 'later', 'done'],
    players: [{ id: 'first', shipped: false }, { id: 'later', shipped: false }, { id: 'done', shipped: true }],
    karamaShipping: null };
}

void test('window roles expose a shared exhaustive tuple and exact native printed-card mapping', () => {
  assert.deepEqual(WINDOW_CARD_EFFECTS, ['weather', 'atomics', 'harvester', 'karamaAuction', 'karamaShipment', 'thumper']);
  assert.deepEqual(WINDOW_CARD_EFFECTS.map(windowCardNativeEffect), ['weather', 'atomics', 'harvester', 'karama', 'karama', 'thumper']);
});

void test('Thumper binds the public first-reveal entitlement without any hidden deck or physical-card source', () => {
  const source = { ...storm(), phase: 1, thumperWindowOpen: true }, before = structuredClone(source);
  assert.deepEqual(windowCardOpportunity(source, 'thumper'), { effect: 'thumper', source: 'first-spice-reveal:3', turn: 3 });
  assert.equal(windowCardOpportunity(source, 'thumper', 'first-spice-reveal:3')!.source, 'first-spice-reveal:3');
  assert.equal(windowCardOpportunity(source, 'thumper', 'first-spice-reveal:4'), null);
  assert.equal(windowCardOpportunity({ ...source, turn: 4 }, 'thumper')!.source, 'first-spice-reveal:4');
  assert.deepEqual(source, before);
});

void test('an explicitly open first-reveal entitlement survives temporary controls and summoned-worm or Nexus state', () => {
  const source = { ...storm(), phase: 1, thumperWindowOpen: true };
  for (const waiting of [{ response: {} }, { decision: {} }, { truthtrance: {} }, { phaseOpening: {} },
    { nexus: true }, { spiceResolution: { kind: 'summonedWorm' } }, { spiceSequence: { skipped: [] } },
    { spiceWindow: blow().spiceWindow }])
    assert.equal(windowCardOpportunity({ ...source, ...waiting }, 'thumper')!.source, 'first-spice-reveal:3');
});

void test('first real reveal or printed Thumper closes the first-reveal source through later Nexus and second-blow windows', () => {
  const source = { ...storm(), phase: 1, thumperWindowOpen: false };
  for (const later of [{}, { nexus: true }, { spiceSequence: {} }, { spiceResolution: {} },
    { spiceWindow: blow().spiceWindow }, { response: {} }])
    assert.equal(windowCardOpportunity({ ...source, ...later }, 'thumper'), null);
  for (const invalid of [{ phase: 0 }, { phase: 2 }, { status: 'setup' }, { turn: 0 }, { turn: 1.5 },
    { turn: Number.MAX_SAFE_INTEGER + 1 }, { thumperWindowOpen: 'yes' }, { thumperWindowOpen: null }])
    assert.equal(windowCardOpportunity({ ...source, thumperWindowOpen: true, ...invalid } as WindowCardGame, 'thumper'), null);
});

void test('legacy absent Thumper flag retains the original native clean first-reveal fallback', () => {
  const source = { ...storm(), phase: 1 };
  assert.equal(windowCardOpportunity(source, 'thumper')!.source, 'first-spice-reveal:3');
  for (const started of [{ spiceSequence: {} }, { spiceResolution: {} }, { spiceWindow: blow().spiceWindow }, { nexus: true }])
    assert.equal(windowCardOpportunity({ ...source, ...started }, 'thumper'), null);
  for (const waiting of [{ response: {} }, { decision: {} }, { truthtrance: {} }, { phaseOpening: {} }])
    assert.equal(windowCardOpportunity({ ...source, ...waiting }, 'thumper')!.source, 'first-spice-reveal:3');
});

void test('shipment-price windows retain every unused original entitlement while new questions select only the active recipient', () => {
  const source = shipments(), before = structuredClone(source);
  assert.deepEqual(karamaShipmentOpportunities(source), [
    { effect: 'karamaShipment', turn: 3, source: shipmentSource('first'), recipient: 'first' },
    { effect: 'karamaShipment', turn: 3, source: shipmentSource('later'), recipient: 'later' },
  ]);
  assert.equal(windowCardOpportunity(source, 'karamaShipment')!.source, shipmentSource('first'));
  assert.equal(windowCardOpportunity(source, 'karamaShipment', shipmentSource('later'))!.source, shipmentSource('later'));
  assert.equal(windowCardOpportunity({ ...source, active: 'later' }, 'karamaShipment', shipmentSource('first'))!.source,
    shipmentSource('first'));
  assert.deepEqual(source, before);
});

void test('shipment source decoding identifies original and Cunning beneficiaries even after a grant or shipment closes them', () => {
  assert.deepEqual(parseKaramaShipmentSource(shipmentSource('first')), { turn: 3, recipient: 'first', kind: 'original' });
  const source = JSON.stringify(['karamaShipment', 3, 'first', 'cunning', 'cunning:1']);
  assert.deepEqual(parseKaramaShipmentSource(source), { turn: 3, recipient: 'first', kind: 'cunning', event: 'cunning:1' });
  for (const invalid of [undefined, null, [], '{}', `${source} `,
    JSON.stringify(['karamaShipment', 0, 'first', 'original']),
    JSON.stringify(['karamaShipment', 3.5, 'first', 'original']),
    JSON.stringify(['karamaShipment', Number.MAX_SAFE_INTEGER + 1, 'first', 'original']),
    JSON.stringify(['karamaShipment', 3, ' first', 'original']),
    JSON.stringify(['karamaShipment', 3, 'first', 'cunning']),
    JSON.stringify(['karamaShipment', 3, 'first', 'cunning', '']),
    JSON.stringify(['karamaShipment', 3, 'first', 'original', 'extra'])])
    assert.equal(parseKaramaShipmentSource(invalid), null);
  assert.equal(windowCardOpportunity({ ...shipments(), karamaShipping: { player: 'first' } }, 'karamaShipment',
    shipmentSource('first')), null);
  assert.equal(parseKaramaShipmentSource(shipmentSource('first'))!.recipient, 'first');
});

void test('a shipment-price grant closes only its beneficiary and actual shipment or turn completion closes that original source', () => {
  const source = shipments();
  const granted = { ...source, karamaShipping: { player: 'first' } };
  assert.equal(windowCardOpportunity(granted, 'karamaShipment'), null);
  assert.deepEqual(karamaShipmentOpportunities(granted).map(window => window.recipient), ['later']);
  const shipped = { ...source, players: source.players!.map(player => ({ ...player, shipped: true })) };
  assert.deepEqual(karamaShipmentOpportunities(shipped), []);
  const finished = { ...source, active: 'later', movementRemaining: ['later', 'done'] };
  assert.equal(windowCardOpportunity(finished, 'karamaShipment', shipmentSource('first')), null);
  assert.equal(windowCardOpportunity({ ...source, phase: 6 }, 'karamaShipment', shipmentSource('first')), null);
  assert.equal(windowCardOpportunity({ ...source, turn: 4 }, 'karamaShipment', shipmentSource('first')), null);
});

void test('temporary native modal priority preserves original shipment entitlements without offering an inactive question', () => {
  for (const modal of [{ response: {} }, { decision: {} }, { truthtrance: {} }, { phaseOpening: {} }]) {
    const source = { ...shipments(), active: 'later', ...modal };
    assert.equal(windowCardOpportunity(source, 'karamaShipment')!.source, shipmentSource('later'));
    assert.equal(windowCardOpportunity(source, 'karamaShipment', shipmentSource('first'))!.source, shipmentSource('first'));
  }
  assert.equal(windowCardOpportunity(storm(), 'weather', 'storm:3')!.source, 'storm:3');
  assert.equal(windowCardOpportunity(storm(), 'weather', 'storm:4'), null);
  assert.equal(windowCardOpportunity(auction(), 'karamaAuction', 'ordinary-auction:3:2'), null);
});

void test('current Cunning second shipment has its own event source and never reopens an unused original shipment', () => {
  const source = shipments(), receipt = { turn: 3, owner: 'first', event: 'cunning:1' };
  const second = { ...source, nexusGuildCunningHistory: [{ receipt, stage: 'secondShipment' }] };
  const expected = JSON.stringify(['karamaShipment', 3, 'first', 'cunning', 'cunning:1']);
  assert.equal(windowCardOpportunity(second, 'karamaShipment')!.source, expected);
  const projected = { ...source, players: source.players!.map(({ id }) => ({ id })),
    karamaShipmentWindows: karamaShipmentOpportunities(second) };
  assert.equal(windowCardOpportunity(projected, 'karamaShipment')!.source, expected);
  assert.equal(windowCardOpportunity(second, 'karamaShipment', shipmentSource('first')), null);
  assert.equal(windowCardOpportunity({ ...second, active: 'later' }, 'karamaShipment', expected), null);
  assert.equal(windowCardOpportunity({ ...second, karamaShipping: { player: 'first' } }, 'karamaShipment', expected), null);
  for (const stage of ['pending', 'extraMove', 'completed', 'canceled']) {
    const closed = { ...source, nexusGuildCunningHistory: [{ receipt, stage }] };
    assert.equal(windowCardOpportunity(closed, 'karamaShipment'), null);
    assert.equal(windowCardOpportunity(closed, 'karamaShipment', shipmentSource('first')), null);
    assert.ok(windowCardOpportunity(closed, 'karamaShipment', shipmentSource('later')));
  }
  const old = { ...source, nexusGuildCunningHistory: [{ receipt: { ...receipt, turn: 2 }, stage: 'completed' }] };
  assert.equal(windowCardOpportunity(old, 'karamaShipment')!.source, shipmentSource('first'));
});

void test('public shipment projections require no shipped history and return copies of strictly coherent source rows', () => {
  const native = shipments(), windows = karamaShipmentOpportunities(native);
  const source = { ...native, players: native.players!.map(({ id }) => ({ id })), karamaShipmentWindows: windows };
  const before = structuredClone(source), projected = karamaShipmentOpportunities(source);
  assert.deepEqual(projected, windows);
  assert.notEqual(projected, windows);
  assert.notEqual(projected[0], windows[0]);
  projected[0].recipient = 'changed-copy';
  assert.deepEqual(source, before);
  assert.equal(windowCardOpportunity(source, 'karamaShipment', shipmentSource('later'))!.source, shipmentSource('later'));
});

void test('malformed public shipment windows cannot invent a recipient turn entitlement or Cunning source', () => {
  const native = shipments(), window = karamaShipmentOpportunities(native)[0];
  for (const invalid of [{ ...window, recipient: 'unseated' }, { ...window, turn: 2 }, { ...window, effect: 'karamaAuction' },
    { ...window, source: '' }, { ...window, source: `${window.source} ` }, { ...window, source: shipmentSource('later') },
    { ...window, source: JSON.stringify(['karamaShipment', 3, 'first', 'cunning']) },
    { ...window, source: JSON.stringify(['karamaShipment', 3, 'first', 'cunning', '']) },
    { ...window, card: 'private-card' }])
    assert.deepEqual(karamaShipmentOpportunities({ ...native, karamaShipmentWindows: [invalid] } as WindowCardGame), []);
  for (const invalid of [[window, window], [window, { ...window,
    source: JSON.stringify(['karamaShipment', 3, 'first', 'cunning', 'cunning:1']) }]])
    assert.deepEqual(karamaShipmentOpportunities({ ...native, karamaShipmentWindows: invalid }), []);
  assert.deepEqual(karamaShipmentOpportunities({ ...native, active: 'later', karamaShipmentWindows: [{ ...window,
    source: JSON.stringify(['karamaShipment', 3, 'first', 'cunning', 'cunning:1']) }] }), []);
  assert.deepEqual(karamaShipmentOpportunities({ ...native, movementRemaining: ['later'], active: 'later',
    karamaShipmentWindows: [window] }), []);
  assert.deepEqual(karamaShipmentOpportunities({ ...native, karamaShipping: { player: 'first' },
    karamaShipmentWindows: [window] }), []);
});

void test('malformed native shipment metadata cannot create a price opportunity', () => {
  const source = shipments();
  for (const invalid of [{ players: [{ id: 'first' }] }, { players: [{ id: 'first', shipped: false }, { id: 'first', shipped: false }] },
    { movementRemaining: ['first', 'first'] }, { movementRemaining: ['missing'] }, { movementRemaining: null },
    { active: 'missing' }, { karamaShipping: { player: 'missing' } }, { status: 'setup' }, { turn: 0 },
    { nexusGuildCunningHistory: [{ receipt: { turn: 4, owner: 'first', event: 'cunning:1' }, stage: 'secondShipment' }] },
    { nexusGuildCunningHistory: [{ receipt: { turn: 3, owner: 'missing', event: 'cunning:1' }, stage: 'secondShipment' }] }])
    assert.deepEqual(karamaShipmentOpportunities({ ...source, ...invalid }), []);
});

void test('ordinary Karama binds the same public current-lot source from native and projected auction shapes', () => {
  const expected = { effect: 'karamaAuction', source: 'ordinary-auction:3:1', turn: 3 };
  assert.deepEqual(windowCardOpportunity(auction(), 'karamaAuction'), expected);
  assert.deepEqual(windowCardOpportunity(publicAuction(), 'karamaAuction'), expected);
  assert.deepEqual(windowCardOpportunity({ ...auction(), bidPromiseLot: { turn: 3, lot: 1 } }, 'karamaAuction'), expected);
  const otherFace = { ...auction(), auction: { cards: [{ id: 'different-hidden-card' }], index: 0 } };
  assert.deepEqual(windowCardOpportunity(otherFace, 'karamaAuction'), expected);
});

void test('ordinary lot responses and a winning unpaid invoice retain Karama source until actual lot close', () => {
  for (const source of [auction(), publicAuction()]) {
    for (const modal of [{ response: { kind: 'karama' } }, { decision: { kind: 'auctionPayment', player: 'respondent' } },
      { truthtrance: {} }, { phaseOpening: {} }])
      assert.equal(windowCardOpportunity({ ...source, ...modal }, 'karamaAuction')!.source, 'ordinary-auction:3:1');
    for (const exclusion of [{ richeseAuction: {} }, { currentAuctionSale: {} }, { ixAuction: {} },
      { phase: 4 }, { status: 'setup' }, { auction: null }])
      assert.equal(windowCardOpportunity({ ...source, ...exclusion }, 'karamaAuction'), null);
  }
});

void test('Karama lot progression changes only the public source and never mutates physical auction metadata', () => {
  const source = auction(), before = structuredClone(source);
  assert.equal(windowCardOpportunity(source, 'karamaAuction')!.source, 'ordinary-auction:3:1');
  assert.equal(windowCardOpportunity({ ...source, auction: { cards: [{}, {}], index: 1 } }, 'karamaAuction')!.source,
    'ordinary-auction:3:2');
  assert.equal(windowCardOpportunity({ ...publicAuction(), bidPromiseLot: { turn: 3, lot: 2 } }, 'karamaAuction')!.source,
    'ordinary-auction:3:2');
  assert.equal(windowCardOpportunity({ ...source, turn: 4 }, 'karamaAuction')!.source, 'ordinary-auction:4:1');
  assert.deepEqual(source, before);
});

void test('malformed or exhausted native auction arrays and indices cannot fall back to a public lot', () => {
  for (const native of [{ cards: [], index: 0 }, { cards: [{}], index: 1 }, { cards: [{}], index: -1 },
    { cards: [{}], index: 0.5 }, { cards: [{}], index: Number.MAX_SAFE_INTEGER + 1 },
    { cards: [null], index: 0 }, { cards: [undefined], index: 0 }, { cards: ['private-card'], index: 0 },
    { cards: {}, index: 0 }, { cards: [{}] }, { index: 0 }, { cards: [{}], index: undefined }]) {
    assert.equal(windowCardOpportunity({ ...auction(), auction: native }, 'karamaAuction'), null);
    assert.equal(windowCardOpportunity({ ...publicAuction(), auction: native }, 'karamaAuction'), null);
  }
});

void test('projected lot metadata is positive safe coherent and cannot invent an absent ordinary auction', () => {
  for (const bidPromiseLot of [null, undefined, { turn: 3, lot: 0 }, { turn: 3, lot: -1 }, { turn: 3, lot: 1.5 },
    { turn: 3, lot: Number.MAX_SAFE_INTEGER + 1 }, { turn: 4, lot: 1 }, { turn: 3, lot: '1' },
    { turn: 3, lot: 1, card: 'private-card' }, { lot: 1 }])
    assert.equal(windowCardOpportunity({ ...publicAuction(), bidPromiseLot } as WindowCardGame, 'karamaAuction'), null);
  assert.equal(windowCardOpportunity({ ...auction(), bidPromiseLot: { turn: 3, lot: 2 } }, 'karamaAuction'), null);
  assert.equal(windowCardOpportunity({ ...publicAuction(), auction: [] }, 'karamaAuction'), null);
  assert.equal(windowCardOpportunity({ ...storm(), phase: 3, auction: {} }, 'karamaAuction'), null);
});

void test('Weather and Family Atomics share the exact original current Storm source before movement', () => {
  assert.deepEqual(windowCardOpportunity(storm(), 'weather'), { effect: 'weather', source: 'storm:3', turn: 3 });
  assert.deepEqual(windowCardOpportunity(storm(), 'atomics'), { effect: 'atomics', source: 'storm:3', turn: 3 });
  assert.equal(windowCardOpportunity({ ...storm(), turn: 4 }, 'weather')!.source, 'storm:4');
});

void test('actual Storm close and movement resolution end the window while legacy absent open flag remains valid', () => {
  for (const effect of ['weather', 'atomics'] as const) {
    assert.equal(windowCardOpportunity({ ...storm(), stormCardWindowOpen: false }, effect), null);
    assert.equal(windowCardOpportunity({ ...storm(), stormResolution: { event: 'storm-movement:1' } }, effect), null);
    assert.equal(windowCardOpportunity({ ...storm(), phase: 1 }, effect), null);
    assert.ok(windowCardOpportunity({ ...storm(), stormCardWindowOpen: true }, effect));
  }
});

void test('a destroyed Shield Wall closes only Family Atomics rather than the remaining Weather window', () => {
  const source = { ...storm(), shieldWallDestroyed: true };
  assert.equal(windowCardOpportunity(source, 'atomics'), null);
  assert.equal(windowCardOpportunity(source, 'weather')!.source, 'storm:3');
});

void test('temporary responses, decisions, phase openings and Truth preserve the native global source', () => {
  for (const blocker of ['response', 'decision', 'phaseOpening', 'truthtrance'] as const) {
    assert.equal(windowCardOpportunity({ ...storm(), [blocker]: {} }, 'weather')!.source, 'storm:3');
    assert.equal(windowCardOpportunity({ ...blow(), [blocker]: {} }, 'harvester')!.source, 'spice-blow:1');
  }
});

void test('a current Harvester window binds its actual blow event and preserves later distinct blow identity', () => {
  const source = blow();
  assert.deepEqual(windowCardOpportunity(source, 'harvester'), { effect: 'harvester', source: 'spice-blow:1', turn: 3 });
  source.spiceWindow!.event = 'spice-blow:2';
  assert.equal(windowCardOpportunity(source, 'harvester')!.source, 'spice-blow:2');
  assert.equal(windowCardOpportunity({ ...source, phase: 2 }, 'harvester'), null);
});

void test('Harvester uses existing unlimited physical stacking and replay availability without a per-window count cap', () => {
  const source = blow();
  source.spiceWindow!.harvested = true;
  assert.equal(windowCardOpportunity(source, 'harvester'), null, 'Legacy harvested-only windows are closed');
  for (const harvesters of [1, 2, 20, 100, Number.MAX_SAFE_INTEGER]) {
    source.spiceWindow!.harvesters = harvesters;
    assert.equal(windowCardOpportunity(source, 'harvester')!.source, 'spice-blow:1');
  }
  source.spiceWindow!.harvesterClosed = true;
  assert.equal(windowCardOpportunity(source, 'harvester'), null);
});

void test('legacy fresh blows get the specified deterministic source without mutating their original state', () => {
  const source = blow(); delete source.spiceWindow!.event;
  const before = structuredClone(source);
  assert.equal(windowCardOpportunity(source, 'harvester')!.source, 'legacy-spice-blow:3:hagga_basin:5');
  assert.deepEqual(source, before);
  const otherSector = { ...source, spiceWindow: { ...source.spiceWindow!, sector: 6 } };
  assert.notEqual(windowCardOpportunity(otherSector, 'harvester')!.source, windowCardOpportunity(source, 'harvester')!.source);
});

void test('invalid public source metadata and unavailable game windows do not create a native opportunity', () => {
  for (const source of [{ ...storm(), status: 'setup' }, { ...storm(), turn: 0 }, { ...storm(), turn: 1.5 },
    { ...storm(), turn: Number.MAX_SAFE_INTEGER + 1 }])
    assert.equal(windowCardOpportunity(source, 'weather'), null);
  for (const source of [{ ...blow(), spiceWindow: null }, { ...blow(), spiceWindow: { ...blow().spiceWindow!, event: '' } },
    { ...blow(), spiceWindow: { ...blow().spiceWindow!, territory: ' hagga_basin' } },
    { ...blow(), spiceWindow: { ...blow().spiceWindow!, sector: -1 } },
    { ...blow(), spiceWindow: { ...blow().spiceWindow!, harvesters: NaN } }])
    assert.equal(windowCardOpportunity(source, 'harvester'), null);
  assert.equal(windowCardOpportunity(storm(), 'unknown' as never), null);
});
