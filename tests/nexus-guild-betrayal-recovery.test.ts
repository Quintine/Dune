import assert from 'node:assert/strict';
import test from 'node:test';
import type { DatabaseSync, SQLOutputValue } from 'node:sqlite';
import { applyAction, normalizeAutomaticGame, viewGame, type Action, type Game, type GameView } from '../game/engine';
import { botActions } from '../game/bots';
import { homeworldContext, homeworldGameIntegrity } from '../game/homeworld-game';
import { homeworldForceGroups } from '../game/homeworld-custody';
import { NEXUS_FACTIONS, replaceNexusCard, drawNexusCard, validateNexusCards } from '../game/nexus-cards';
import { guildBetrayalResponders, signGuildBetrayalInvoice } from '../game/nexus-guild-betrayal';
import { guildShipmentIncome } from '../game/shipment-price';
import type { RoomsClock, SeatAuth } from '../db/rooms';
import type * as Rooms from '../db/rooms';
import type { FactionId } from '../game/catalog';
import { unitStore } from './fixture-nexus-room-store';
import { createGuildBetrayalFixture, type GuildBetrayalFixture, type GuildBetrayalFixtureOptions } from './fixture-nexus-guild-betrayal';

const clock: RoomsClock = { now: () => 10000, sleep: async () => {} };
const plain = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
type SqlRow = Record<string, SQLOutputValue>;
const use = (event: string): Action => ({ type: 'guildBetrayalUse', event });
const pass = (event: string): Action => ({ type: 'guildBetrayalPass', event });
const forged = (payload: object): Action => payload as Action;
const sum = (counts: Record<string, number>) => Object.values(counts).reduce((a, b) => a + b, 0);
function player(g: Game, id: string) {
  const found = g.players.find(p => p.id === id);
  assert.ok(found, `missing authenticated seat ${id}`);
  return found;
}
function credentials(sqlite: DatabaseSync) {
  return {
    seats: sqlite.prepare('SELECT * FROM seats ORDER BY room_code,player_id,token_hash').all(),
    entries: sqlite.prepare('SELECT * FROM room_entry_receipts ORDER BY room_code,player_id,operation_hash').all(),
    keys: sqlite.prepare('SELECT * FROM seat_recovery_keys ORDER BY room_code,player_id').all(),
    recoveries: sqlite.prepare('SELECT * FROM seat_recovery_receipts ORDER BY room_code,player_id,operation_hash').all(),
  };
}
function physical(g: Game) {
  const ids = [...g.deck, ...g.discard, ...g.players.flatMap(p => p.hand),
    ...(g.auction?.cards.slice(g.auction.index) ?? [])].map(card => card.id).sort();
  assert.equal(new Set(ids).size, ids.length, 'every physical Treachery card has one custodian');
  return ids;
}
function forceInventory(g: Game) {
  homeworldGameIntegrity(g);
  const homes = g.homeworlds?.custody ? homeworldForceGroups(homeworldContext(g), g.homeworlds.custody) : [];
  return g.players.map(p => {
    const visitors = homes.filter(home => home.native !== p.id)
      .map(home => home.forces[p.id] ?? { normal: 0, elite: 0 });
    return {
      id: p.id,
      total: p.reserves + p.tanks + sum(p.forces) + visitors.reduce((n, pool) => n + pool.normal + pool.elite, 0),
      elite: p.elites ? p.elites.reserves + p.elites.tanks + sum(p.elites.forces) +
        visitors.reduce((n, pool) => n + pool.elite, 0) : 0,
    };
  });
}
function delivery(g: Game) {
  return {
    players: g.players.map(p => ({ id: p.id, reserves: p.reserves, tanks: p.tanks,
      forces: p.forces, elites: p.elites ?? null, advisors: p.advisors ?? null,
      shipped: p.shipped, moved: p.moved })),
    custody: g.homeworlds?.custody ?? null,
  };
}
interface Fixture extends GuildBetrayalFixture {
  sqlite: DatabaseSync;
  restart(): typeof Rooms;
  hooks: { beforeWrite?: () => Promise<void> };
  writes: { expected: number; changes: number }[];
  code: string;
  initial: Game;
  tokens: string[];
  auths: SeatAuth[];
  stock: string[];
  forceStock: { id: string; total: number; elite: number }[];
  credentialRows: { seats: SqlRow[]; entries: SqlRow[]; keys: SqlRow[]; recoveries: SqlRow[] };
  unrelatedCode: string;
  unrelatedToken: string;
  unrelatedRow: SqlRow | undefined;
  save(this: void, g: Game): void;
}
async function fixture(t: test.TestContext, options: GuildBetrayalFixtureOptions = {}): Promise<Fixture> {
  const store = unitStore();
  t.after(() => store.sqlite.close());
  const made = await store.rooms.createRoom('Guild Betrayal SQL', 'atreides', options.advanced ?? false, []);
  const code = made.view.code;
  const tokens = [made.token];
  const factions: FactionId[] = ['guild', options.zero ? 'fremen' : 'emperor', ...(options.allyPayment ? ['harkonnen' as const] : [])];
  for (const faction of factions)
    tokens.push((await store.rooms.joinRoom(code, faction, faction)).token!);
  const auths = await Promise.all(tokens.map(token => store.rooms.authenticate(code, token)));
  const madeGame = createGuildBetrayalFixture({ ...options, seatIds: auths.map(auth => auth.playerId) });
  const initial = madeGame.game;
  initial.code = code;
  initial.host = auths[0].playerId;
  initial.version = (await store.rooms.readRoom(code)).version;
  const save = (g: Game) => {
    assert.equal(store.sqlite.prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
      .run(JSON.stringify(g), g.version, code).changes, 1);
  };
  save(initial);
  const unrelated = await store.rooms.createRoom('Unrelated preserved room', 'harkonnen', false, []);
  const unrelatedRow = store.sqlite.prepare('SELECT * FROM rooms WHERE code = ?').get(unrelated.view.code);
  const credentialRows = credentials(store.sqlite);
  const stock = physical(initial);
  const forceStock = forceInventory(initial);
  return { ...store, ...madeGame, code, initial, tokens, auths, save, stock, forceStock, credentialRows,
    unrelatedCode: unrelated.view.code, unrelatedToken: unrelated.token, unrelatedRow };
}
const row = (f: Fixture) => f.sqlite.prepare('SELECT * FROM rooms WHERE code = ?').get(f.code);
function totalChanges(f: Fixture) {
  const changes = f.sqlite.prepare('SELECT total_changes() AS changes').get()?.changes;
  assert.ok(typeof changes === 'number');
  return changes;
}
function protectedRows(f: Fixture) {
  assert.deepEqual(credentials(f.sqlite), f.credentialRows, 'saved authorization hashes and recovery records stay unchanged');
  assert.deepEqual(f.sqlite.prepare('SELECT * FROM rooms WHERE code = ?').get(f.unrelatedCode), f.unrelatedRow);
}
function inventory(f: Fixture, g: Game) {
  assert.deepEqual(physical(g), f.stock);
  assert.deepEqual(forceInventory(g), f.forceStock, 'normal and elite physical force inventory is conserved');
  const cards = g.nexusCards?.cards;
  assert.ok(cards);
  validateNexusCards(cards, g.players);
  assert.deepEqual([...cards.deck, ...cards.discard, ...Object.values(cards.hands).filter(card => card !== null)].sort(),
    [...NEXUS_FACTIONS].sort(), 'one singleton of every Nexus face stays in custody');
  protectedRows(f);
}
async function authenticate(f: Fixture, id: string) {
  const index = f.auths.findIndex(auth => auth.playerId === id);
  assert.ok(index >= 0);
  const auth = await f.restart().authenticate(f.code, f.tokens[index]);
  assert.equal(auth.playerId, id);
  assert.equal(auth.tokenHash, f.auths[index].tokenHash);
  return auth;
}
async function act(f: Fixture, g: Game, id: string, action: Action) {
  await f.restart().act(f.code, await authenticate(f, id), g.version, action, clock);
  return f.restart().readRoom(f.code);
}
async function restored(f: Fixture, g: Game) {
  const before = row(f), changes = totalChanges(f);
  assert.deepEqual(plain(await f.restart().readRoom(f.code)), plain(g));
  assert.deepEqual(plain(normalizeAutomaticGame(g)), plain(g), 'normalization cannot answer a human fee choice');
  const views: GameView[] = [];
  for (const auth of f.auths) {
    const view = await f.restart().readSeatView(f.code, await authenticate(f, auth.playerId));
    assert.deepEqual(plain(view), plain(viewGame(g, auth.playerId)));
    for (const key of ['pendingGuildBetrayal', 'guildBetrayal', 'nexusGuildBetrayalHistory', 'guildBetrayalSourceReceipts'])
      assert.equal(Object.hasOwn(view, key), false, 'source, invoice and durable receipt remain private');
    for (const rival of view.players.filter(p => p.id !== auth.playerId)) {
      for (const key of ['hand', 'traitors', 'spice']) assert.equal(Object.hasOwn(rival, key), false);
    }
    const reaction = view.guildBetrayalReaction;
    if (reaction) {
      assert.deepEqual(Object.keys(reaction).sort(), ['event', 'shipper', 'canPass', 'hasPassed', 'canUse', 'blocked'].sort());
      const first = views[0]?.guildBetrayalReaction;
      if (first) assert.deepEqual({ event: reaction.event, shipper: reaction.shipper },
        { event: first.event, shipper: first.shipper });
      assert.ok(g.players.some(p => p.id === reaction.shipper));
      assert.equal(reaction.canUse, auth.playerId === f.holder &&
        g.nexusCards!.cards!.hands[f.holder] === 'guild' && !reaction.hasPassed);
      if (auth.playerId !== f.holder) assert.equal(reaction.blocked, null);
    }
    views.push(view);
  }
  await Promise.all([f.restart().continueRoomAutomatic(f.code, clock), f.restart().continueRoomAutomatic(f.code, clock)]);
  assert.deepEqual(row(f), before, 'refresh/restart cannot consume or settle a held human opportunity');
  assert.equal(totalChanges(f), changes, 'refresh/restart does not write any durable table');
  inventory(f, g);
  return views;
}
async function rejected(
  f: Fixture, g: Game, auth: SeatAuth, action: Action, version = g.version, expected?: RegExp | { message: string },
) {
  const before = row(f), changes = totalChanges(f), state = plain(g);
  const attempt = f.restart().act(f.code, auth, version, action, clock);
  if (expected) await assert.rejects(attempt, expected);
  else await assert.rejects(attempt);
  assert.equal(totalChanges(f), changes, 'denied mutations cannot change any durable table, including a zero-row credential CAS');
  assert.deepEqual(row(f), before, 'saved room state, version and timestamps stay unchanged');
  assert.deepEqual(plain(g), state, 'rejected mutation does not alter the supplied source state');
  protectedRows(f);
}
async function passOthers(f: Fixture, g: Game) {
  for (const p of g.players) {
    if (p.id === f.holder) continue;
    const reaction = viewGame(g, p.id).guildBetrayalReaction;
    if (reaction?.canPass) g = await act(f, g, p.id, pass(reaction.event));
  }
  assert.equal(viewGame(g, f.holder).guildBetrayalReaction?.canPass, true);
  return g;
}
async function settleNativeResponses(f: Fixture, g: Game) {
  const originalDelivery = structuredClone(delivery(g));
  for (let step = 0; g.response && step < 16; step++) {
    const response = g.response;
    const responder = g.players.find(p => !response.passed.includes(p.id));
    assert.ok(responder);
    g = await act(f, g, responder.id, { type: 'passResponse' });
    assert.deepEqual(delivery(g), originalDelivery, 'native income allowance does not replay already delivered forces');
    await restored(f, g);
  }
  assert.equal(g.response, null, 'all original native response suffixes finish');
  return g;
}
async function allPass(f: Fixture, g: Game) {
  g = await passOthers(f, g);
  await restored(f, g);
  return settleNativeResponses(f, await act(f, g, f.holder, pass(f.event)));
}
function diverted(f: Fixture, g: Game, allyPayment = 0) {
  assert.ok(f.price > 0, 'only an already-funded positive fee can be taken');
  for (const p of g.players) {
    const debit = p.id === f.shipper ? f.price - allyPayment : 0;
    const credit = p.id === f.holder ? f.price : 0;
    assert.equal(p.spice, player(f.initial, p.id).spice - debit + credit,
      'replace the full original receiver, without a second payer or native-income credit');
  }
  if (allyPayment) {
    const donor = f.donor;
    assert.ok(donor, 'the split quote retains its authorized donor');
    assert.equal(player(g, donor).spice, player(f.initial, donor).spice, 'pledged escrow is not withdrawn twice');
    assert.equal(g.aid[donor].amount, f.initial.aid[donor].amount - allyPayment);
  }
  const budget = (state: Game) => state.players.reduce((total, p) => total + p.spice, 0) +
    Object.values(state.aid).reduce((total, aid) => total + aid.amount, 0);
  assert.equal(budget(g), budget(f.initial), 'full bank/default recipient replacement conserves paid spice plus escrow');
  assert.deepEqual(delivery(g), delivery(f.original), 'the exact original cohort is delivered once with native turn flags');
  assert.equal(g.nexusCards!.cards!.hands[f.holder], null);
  assert.equal(g.nexusCards!.cards!.discard.filter(card => card === 'guild').length, 1);
  assert.equal(g.nexusGuildBetrayalHistory!.length, 1);
  assert.equal(g.nexusGuildBetrayalHistory![0].recipient, f.holder);
  assert.equal(g.guildBetrayalSourceReceipts!.length, 1);
  assert.equal(g.guildBetrayal!.status, 'completed');
  assert.equal(viewGame(g, f.holder).guildBetrayalReaction, null);
  inventory(f, g);
}

for (const advanced of [false, true]) {
  for (const scenario of [
    { source: 'reserve', payer: 'holder' },
    { source: 'reserve', payer: 'other' },
    { source: 'reserve', payer: 'guild', allyPayment: 1 },
    { source: 'guildTransport', payer: 'guild' },
    { source: 'guildTransport', payer: 'guild', homeworlds: true },
    { source: 'homeworld', payer: 'holder', homeworlds: true },
    { source: 'homeworld', payer: 'other', homeworlds: true, allyPayment: 1 },
    { source: 'junction', payer: 'other', homeworlds: true },
    { source: 'reserve', payer: 'other', homeworlds: true, occupiedJunction: true },
  ] as const) {
    void test(`SQLite ${advanced ? 'Advanced' : 'Basic'} ${scenario.source} ${scenario.payer}${'homeworlds' in scenario ? ' Homeworld' : ''} funded full fee replacement${'occupiedJunction' in scenario ? ' overrides occupied Junction' : ''} survives authenticated restart`, async t => {
      const f = await fixture(t, { ...scenario, advanced });
      await restored(f, f.initial);
      const done = await act(f, f.initial, f.holder, use(f.event));
      assert.equal(done.version, f.initial.version + 1);
      diverted(f, done, 'allyPayment' in scenario ? scenario.allyPayment : 0);
      if ('occupiedJunction' in scenario) {
        assert.equal(f.initial.homeworlds!.custody!.visitors['homeworld:guild'][f.holder].normal, 1);
        const nativeIncome = player(f.original, f.guild).spice - player(f.initial, f.guild).spice;
        assert.ok(nativeIncome > 0 && nativeIncome < f.price, 'the genuine low-Junction native quote only receives part of this fee');
        assert.equal(player(f.original, f.holder).spice, player(f.initial, f.holder).spice);
        assert.equal(player(done, f.guild).spice, player(f.initial, f.guild).spice, 'Betrayal suppresses native low-Junction income');
        assert.equal(done.response?.kind === 'guildIncome', false, 'no second income allowance survives the replacement');
      }
      await restored(f, done);
      const auth = await authenticate(f, f.holder);
      for (const action of [use(f.event), pass(f.event)]) await rejected(f, done, auth, action);
    });
  }
}
for (const source of ['reserve', 'guildTransport', 'homeworld', 'junction'] as const) {
  void test(`SQLite restored ${source} all-pass retains the Nexus and commits the original native payment and custody once`, async t => {
    const f = await fixture(t, { source, payer: source === 'guildTransport' ? 'guild' : 'other',
      homeworlds: source === 'homeworld' || source === 'junction' });
    await restored(f, f.initial);
    const done = await allPass(f, f.initial);
    assert.deepEqual(done.players.map(p => [p.id, p.spice]), f.original.players.map(p => [p.id, p.spice]));
    assert.deepEqual(done.aid, f.original.aid);
    assert.deepEqual(delivery(done), delivery(f.original));
    assert.equal(done.nexusCards!.cards!.hands[f.holder], 'guild');
    assert.equal(done.nexusCards!.cards!.discard.includes('guild'), false);
    assert.equal(viewGame(done, f.holder).guildBetrayalReaction, null);
    assert.equal(done.nexusGuildBetrayalHistory!.length, 1);
    assert.equal(done.nexusGuildBetrayalHistory![0].recipient, null);
    assert.equal(done.guildBetrayalSourceReceipts!.length, 1);
    assert.equal(done.guildBetrayal!.status, 'completed');
    await restored(f, done);
    await rejected(f, done, await authenticate(f, f.holder), pass(f.event));
  });
}

for (const source of ['reserve', 'guildTransport', 'homeworld', 'junction'] as const) {
  void test(`SQLite simultaneous ${source} Use/final Pass commits one fee and one physical delivery through CAS`, async t => {
    const f = await fixture(t, { source, payer: source === 'guildTransport' ? 'guild' : 'other',
      homeworlds: source === 'homeworld' || source === 'junction' });
    const pending = await passOthers(f, f.initial);
    await restored(f, pending);
    f.writes.length = 0;
    let arrivals = 0;
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    f.hooks.beforeWrite = async () => {
      if (++arrivals === 2) release();
      await gate;
    };
    let results: PromiseSettledResult<unknown>[];
    try {
      const auth = await authenticate(f, f.holder);
      results = await Promise.allSettled([use(f.event), pass(f.event)].map(action =>
        f.restart().act(f.code, auth, pending.version, action, clock).finally(release)));
    } finally { delete f.hooks.beforeWrite; }
    assert.equal(arrivals, 2, 'both authenticated mutations reached the actual SQL version fence');
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(results.filter(result => result.status === 'rejected').length, 1);
    assert.deepEqual(f.writes.map(write => write.changes).sort((a, b) => a - b), [0, 1]);
    let done = await f.restart().readRoom(f.code);
    assert.equal(done.version, pending.version + 1);
    if (results[0].status === 'fulfilled') diverted(f, done);
    else {
      done = await settleNativeResponses(f, done);
      assert.deepEqual(done.players.map(p => [p.id, p.spice]), f.original.players.map(p => [p.id, p.spice]));
      assert.deepEqual(delivery(done), delivery(f.original));
      assert.equal(done.nexusCards!.cards!.hands[f.holder], 'guild');
    }
    await restored(f, done);
  });
}

void test('SQLite credential reauthentication rejects stale, foreign, unsupported and client-owned fee choices without a write', async t => {
  const f = await fixture(t);
  const holder = await authenticate(f, f.holder);
  const foreign = await f.restart().authenticate(f.unrelatedCode, f.unrelatedToken);
  const before = row(f), changes = totalChanges(f);
  await assert.rejects(f.restart().authenticate(f.code, f.unrelatedToken));
  await assert.rejects(f.restart().readSeatView(f.code, foreign));
  await assert.rejects(f.restart().readSeatView(f.code, { playerId: f.holder, tokenHash: foreign.tokenHash }));
  assert.equal(totalChanges(f), changes, 'denied authentication and private reads write no durable table');
  assert.deepEqual(row(f), before);
  protectedRows(f);
  await rejected(f, f.initial, foreign, use(f.event));
  await rejected(f, f.initial, { playerId: f.holder, tokenHash: foreign.tokenHash }, use(f.event));
  await rejected(f, f.initial, holder, use(f.event), f.initial.version - 1);
  await rejected(f, f.initial, await authenticate(f, f.guild), use(f.event));
  for (const action of [
    use(`${f.event}:foreign`), pass(`${f.event}:foreign`),
    forged({ ...use(f.event), amount: f.price }), forged({ ...use(f.event), recipient: f.holder }),
    forged({ ...use(f.event), price: 0 }), forged({ ...use(f.event), source: f.source }),
    forged({ ...pass(f.event), card: 'guild' }), forged({ ...pass(f.event), ignored: true }),
    { type: 'pledgeAid', amount: 1 } as Action,
    f.declaration,
  ]) await rejected(f, f.initial, holder, action);
  const pending = await passOthers(f, f.initial);
  if (pending.version !== f.initial.version)
    await rejected(f, pending, holder, use(f.event), f.initial.version);
  for (const p of pending.players) {
    const reaction = viewGame(pending, p.id).guildBetrayalReaction;
    if (reaction?.hasPassed) await rejected(f, pending, await authenticate(f, p.id), pass(f.event));
  }
  await restored(f, pending);
});

void test('SQLite public fee acknowledgement does not identify the held Nexus face or reveal source, route or cost', async t => {
  const f = await fixture(t, { source: 'homeworld', payer: 'other', homeworlds: true });
  const originalViews = await restored(f, f.initial);
  const before = structuredClone(f.before);
  before.code = f.code;
  before.host = f.initial.host;
  before.version = f.initial.version;
  const cards = before.nexusCards!.cards!;
  const index = cards.deck.indexOf('choam');
  assert.ok(index >= 0);
  assert.equal(cards.hands[f.holder], 'guild');
  cards.deck[index] = 'guild';
  cards.hands[f.holder] = 'choam';
  validateNexusCards(cards, before.players);
  // Change only the private face in the same funded source, not another
  // randomly played setup with a different payer balance or force history.
  let alternative = applyAction(before, f.shipper, f.declaration);
  for (let step = 0; !alternative.pendingGuildBetrayal && step < 20; step++) {
    const decision = alternative.decision;
    assert.ok(decision && ['guildShipment', 'homeworldShipmentGuild'].includes(decision.kind));
    alternative = applyAction(alternative, decision.player, {
      type: 'decision', allow: true,
      ...(decision.kind === 'homeworldShipmentGuild' ? { event: decision.event } : {}),
    });
  }
  assert.ok(alternative.pendingGuildBetrayal);
  f.save(alternative);
  const changedViews = await restored(f, alternative);
  for (const [index, auth] of f.auths.entries()) {
    const original = originalViews[index].guildBetrayalReaction;
    const changed = changedViews[index].guildBetrayalReaction;
    assert.ok(original);
    assert.ok(changed);
    assert.equal(changed.event, original.event, 'the event is selected from the public producer, not the private face');
    assert.equal(changed.shipper, original.shipper);
    assert.equal(changed.canPass, original.canPass);
    assert.equal(changed.hasPassed, original.hasPassed);
    assert.equal(changed.canUse, false);
    if (auth.playerId !== f.holder) assert.deepEqual(plain(changed), plain(original));
  }
  await rejected(f, alternative, await authenticate(f, f.holder), use(f.event));
  const done = await allPass(f, alternative);
  assert.deepEqual(delivery(done), delivery(f.original));
  assert.deepEqual(done.players.map(p => [p.id, p.spice]), f.original.players.map(p => [p.id, p.spice]));
  assert.equal(done.nexusCards!.cards!.hands[f.holder], 'choam');
  await restored(f, done);
});

for (const advanced of [false, true]) {
  void test(`SQLite ${advanced ? 'Advanced' : 'Basic'} a re-signed paid cross-planet source cannot replace the native Guild grant`, async t => {
    const f = await fixture(t, { advanced, source: 'guildTransport', payer: 'other' });
    assert.notEqual(f.shipper, f.guild);
    assert.equal(player(f.initial, f.shipper).ally, f.guild);
    assert.equal(player(f.initial, f.guild).ally, f.shipper);
    await restored(f, f.initial);

    const corrupt = structuredClone(f.initial);
    player(corrupt, f.shipper).ally = null;
    player(corrupt, f.guild).ally = null;
    const pending = corrupt.pendingGuildBetrayal;
    assert.ok(pending?.continuation.source === 'guildTransport');
    assert.ok(pending.invoice.price > 0);
    assert.equal(pending.continuation.fromReserves, false);
    assert.notEqual(pending.continuation.frame.to, 'reserves');
    assert.deepEqual(pending.continuation, f.initial.pendingGuildBetrayal!.continuation,
      'the physically available paid native group, route and tariff are unchanged');
    assert.deepEqual(guildBetrayalResponders(corrupt.nexusCards!.cards!, corrupt.players), pending.required);

    // Amend the saved consistency proof itself, rather than leaving a stale
    // signature that would reject even without an independent native grant.
    // No private validator or reconstruction of its source quote is involved.
    const proof: { players: { id: string; ally: string | null }[] } =
      JSON.parse(pending.invoice.sourceSignature);
    for (const seat of proof.players) seat.ally = player(corrupt, seat.id).ally;
    pending.invoice.sourceSignature = JSON.stringify(proof);
    const native = pending.continuation.frame;
    pending.invoice.originalReceiver = guildShipmentIncome({
      guild: f.guild, shipper: f.shipper, ally: player(corrupt, f.shipper).ally,
      cost: native.cost, allyPayment: native.allyPayment,
      bankOnly: corrupt.karamaShipping?.player === f.shipper,
    }) > 0 ? f.guild : null;
    pending.invoice.signature = signGuildBetrayalInvoice(pending.invoice);
    corrupt.guildBetrayal!.sourceSignature = pending.invoice.sourceSignature;
    const binding: unknown[] = JSON.parse(pending.signature);
    binding[0] = pending.invoice.signature;
    binding[1] = pending.invoice.sourceSignature;
    pending.signature = JSON.stringify(binding);
    f.save(corrupt);

    const before = row(f), changes = totalChanges(f), state = plain(corrupt);
    const denied = { message: 'Native Guild transport requires the Guild or its reciprocal ally.' };
    assert.deepEqual(plain(await f.restart().readRoom(f.code)), state, 'raw restore preserves the damaged source for diagnosis');
    assert.throws(() => normalizeAutomaticGame(corrupt), denied);
    for (const auth of f.auths)
      await assert.rejects(f.restart().readSeatView(f.code, await authenticate(f, auth.playerId)), denied);
    for (const action of [pass(f.event), use(f.event)])
      await rejected(f, corrupt, await authenticate(f, f.holder), action, corrupt.version, denied);
    await Promise.allSettled([f.restart().continueRoomAutomatic(f.code, clock)]);
    assert.equal(totalChanges(f), changes, 'failed read, normalization and authenticated settlement write no durable table');
    assert.deepEqual(row(f), before);
    const saved = await f.restart().readRoom(f.code);
    assert.deepEqual(plain(saved), state, 'fee, forces, held cards, escrow, histories and room version remain untouched');
    assert.deepEqual(plain(corrupt), state);
    inventory(f, saved);
  });
}

for (const source of ['reserve', 'guildTransport', 'homeworld', 'junction'] as const) {
  void test(`SQLite malformed or detached ${source} invoice/source rejects all-seat disclosure, normalization and settlement without writes`, async t => {
    const f = await fixture(t, { source, payer: source === 'guildTransport' ? 'guild' : 'other',
      homeworlds: source === 'homeworld' || source === 'junction' });
    const mutations: { name: string; change(this: void, g: Game): void }[] = [
      { name: 'deleted continuation with pending cursor', change: g => { delete g.pendingGuildBetrayal; } },
      { name: 'deleted cursor with orphan invoice', change: g => { delete g.guildBetrayal; } },
      { name: 'deleted native source receipt collection', change: g => { delete g.guildBetrayalSourceReceipts; } },
      { name: 'deleted independent receipt history', change: g => { delete g.nexusGuildBetrayalHistory; } },
      { name: 'detached event', change: g => { g.guildBetrayal!.event = null; } },
      { name: 'lost pending sequence', change: g => { g.guildBetrayal!.sequence = 0; } },
      { name: 'false completion', change: g => { g.guildBetrayal!.status = 'completed'; } },
      { name: 'changed charged price', change: g => { g.pendingGuildBetrayal!.invoice.price++; } },
      { name: 'changed payer split', change: g => { g.pendingGuildBetrayal!.invoice.ownPayment++; } },
      { name: 'foreign payer', change: g => { g.pendingGuildBetrayal!.invoice.shipper = f.holder; } },
      { name: 'changed original receiver', change: g => { g.pendingGuildBetrayal!.invoice.originalReceiver = f.shipper; } },
      { name: 'changed source signature', change: g => { g.pendingGuildBetrayal!.invoice.sourceSignature += ':forged'; } },
      { name: 'changed producer parent', change: g => { g.pendingGuildBetrayal!.signature += ':forged'; } },
      { name: 'extra invoice key', change: g => { Object.assign(g.pendingGuildBetrayal!.invoice, { recipient: f.holder }); } },
      { name: 'extra continuation key', change: g => { Object.assign(g.pendingGuildBetrayal!.continuation, { action: f.declaration }); } },
      { name: 'foreign acknowledgement', change: g => { g.pendingGuildBetrayal!.required.push(f.guild); } },
      { name: 'fabricated saved pass', change: g => { g.pendingGuildBetrayal!.passed.push(f.holder); } },
      { name: 'missing original upfront funding', change: g => { player(g, f.shipper).spice = 0; } },
      { name: 'source custody moved without delivery', change: g => {
        const p = player(g, f.shipper);
        if (source === 'guildTransport') {
          const location = Object.keys(p.forces).find(key => p.forces[key] > 0);
          assert.ok(location);
          p.forces[location]--;
          p.tanks++;
        } else {
          assert.ok(p.reserves > 0);
          p.reserves--;
          p.tanks++;
        }
      } },
      { name: 'changed native quoted route', change: g => {
        const continuation = g.pendingGuildBetrayal!.continuation;
        switch (continuation.source) {
          case 'reserve': continuation.shipment.amount++; break;
          case 'guildTransport': continuation.frame.amount++; break;
          case 'homeworld': continuation.shipment.amount++; break;
          case 'junction': continuation.transport.destination += ':foreign'; break;
        }
      } },
    ];
    for (const { name, change } of mutations) {
      const corrupt = structuredClone(f.initial);
      change(corrupt);
      f.save(corrupt);
      const before = row(f), changes = totalChanges(f);
      const stock = physical(corrupt);
      assert.deepEqual(plain(await f.restart().readRoom(f.code)), plain(corrupt), 'raw read does not rewrite a damaged save');
      assert.throws(() => normalizeAutomaticGame(corrupt), name);
      for (const auth of f.auths)
        await assert.rejects(f.restart().readSeatView(f.code, await authenticate(f, auth.playerId)), name);
      for (const action of [pass(f.event), use(f.event)])
        await rejected(f, corrupt, await authenticate(f, f.holder), action);
      await Promise.allSettled([f.restart().continueRoomAutomatic(f.code, clock)]);
      assert.deepEqual(row(f), before, name);
      assert.equal(totalChanges(f), changes, name);
      const saved = await f.restart().readRoom(f.code);
      assert.deepEqual(physical(saved), stock, name);
      assert.deepEqual(saved.players.map(p => [p.id, p.reserves, p.forces, p.tanks]), corrupt.players.map(p => [p.id, p.reserves, p.forces, p.tanks]), name);
      protectedRows(f);
    }
  });
}

void test('SQLite own-payment refund requires already available original funds and cannot bootstrap its upfront debit', async t => {
  const f = await fixture(t, { payer: 'holder' });
  assert.equal(f.shipper, f.holder);
  assert.ok(player(f.initial, f.holder).spice >= f.price);
  const corrupt = structuredClone(f.initial);
  player(corrupt, f.holder).spice = f.price - 1;
  f.save(corrupt);
  const before = row(f), changes = totalChanges(f);
  await rejected(f, corrupt, await authenticate(f, f.holder), use(f.event));
  for (const auth of f.auths)
    await assert.rejects(f.restart().readSeatView(f.code, await authenticate(f, auth.playerId)));
  assert.deepEqual(row(f), before);
  assert.equal(totalChanges(f), changes, 'failed upfront funding cannot write any durable table');
  protectedRows(f);
});

void test('SQLite altered authorized aid escrow cannot charge its donor again or settle an unfunded original invoice', async t => {
  const f = await fixture(t, { payer: 'guild', allyPayment: 1 });
  const donor = f.donor;
  assert.ok(donor);
  const mutations: { name: string; change(this: void, g: Game): void }[] = [
    { name: 'deleted escrow', change: g => { delete g.aid[donor]; } },
    { name: 'empty escrow', change: g => { g.aid[donor].amount = 0; } },
    { name: 'foreign donor', change: g => { g.pendingGuildBetrayal!.invoice.donor = f.holder; } },
    { name: 'lost authorization', change: g => { player(g, f.shipper).ally = null; } },
  ];
  for (const { name, change } of mutations) {
    const corrupt = structuredClone(f.initial);
    change(corrupt);
    f.save(corrupt);
    const before = row(f), changes = totalChanges(f);
    await rejected(f, corrupt, await authenticate(f, f.holder), use(f.event));
    assert.deepEqual(row(f), before, name);
    assert.equal(totalChanges(f), changes, name);
    const saved = await f.restart().readRoom(f.code);
    assert.equal(player(saved, donor).spice, player(corrupt, donor).spice, name);
    protectedRows(f);
  }
});

void test('SQLite independent completed receipt survives a later actual shipment and conserved Nexus recycling, but cannot be deleted or detached', async t => {
  const f = await fixture(t, { advanced: false, payer: 'holder' });
  let done = await act(f, f.initial, f.holder, use(f.event));
  diverted(f, done);
  await restored(f, done);
  const firstReceipt = structuredClone(done.nexusGuildBetrayalHistory![0]);
  const firstSource = structuredClone(done.guildBetrayalSourceReceipts![0]);

  // Exercise the physical component's real draw/replacement lifecycle, not a
  // fabricated card or amended invoice. Earlier receipts must not retain a
  // permanent claim to the present discard position or held face.
  const recycled = structuredClone(done);
  assert.ok(recycled.nexusCards?.cards);
  recycled.nexusCards.cards = drawNexusCard(recycled.nexusCards.cards, f.holder, recycled.players, () => 0);
  for (let step = 0; step < 48 && recycled.nexusCards.cards.hands[f.holder] !== 'guild'; step++)
    recycled.nexusCards.cards = replaceNexusCard(recycled.nexusCards.cards, f.holder, recycled.players, () => 0);
  assert.equal(recycled.nexusCards.cards.hands[f.holder], 'guild');
  assert.equal(recycled.nexusCards.cards.discard.includes('guild'), false);
  f.save(recycled);
  await restored(f, recycled);
  await rejected(f, recycled, await authenticate(f, f.holder), use(f.event));

  done = await act(f, recycled, f.holder, { type: 'endMovement' });
  for (let step = 0; step < 500; step++) {
    const actor = done.active ? player(done, done.active) : null;
    const cleanMovement = done.phase === 5 && !done.phaseOpening && !done.response && !done.decision;
    if (cleanMovement && actor && actor.id !== f.holder && !actor.shipped && actor.reserves > 0 && actor.spice >= 2) break;
    if (cleanMovement && actor) {
      done = await act(f, done, actor.id, { type: 'endMovement' });
      continue;
    }
    let request: { id: string; action: Action } | null = null;
    for (const p of done.players) {
      const view = viewGame(done, p.id);
      const own = view.players.find(seat => seat.id === p.id);
      assert.ok(own);
      own.bot = 'Easy';
      let action = botActions(view)[0];
      if (p.id === f.holder && action?.type === 'nexusCardChoice' && view.nexusCards?.choices.includes('keep'))
        action = { type: 'nexusCardChoice', turn: view.turn, card: view.nexusCards.card, choice: 'keep', ownRedraws: 0 };
      if (action) { request = { id: p.id, action }; break; }
    }
    assert.ok(request, 'genuine intervening phases retain a legal authenticated continuation');
    done = await act(f, done, request.id, request.action);
  }
  assert.equal(done.phase, 5);
  assert.ok(!done.phaseOpening && !done.response && !done.decision,
    'the later producer starts only after genuine intervening opportunities finish');
  const laterShipper = done.active;
  assert.ok(laterShipper, 'the next real movement turn retains its seated actor');
  assert.notEqual(laterShipper, f.holder);
  assert.equal(player(done, laterShipper).shipped, false);
  const beforeSecond = structuredClone(done);
  done = await act(f, done, laterShipper, { type: 'ship', territory: 'polar_sink', sector: 0, amount: 1 });
  for (let step = 0; !done.pendingGuildBetrayal && step < 16; step++) {
    const decision = done.decision;
    if (decision?.kind === 'guildShipment') {
      done = await act(f, done, decision.player, { type: 'decision', allow: true });
    } else {
      const response = done.response;
      assert.ok(response, 'the later declaration retains its native permission/rate opportunity');
      const responder = done.players.find(p => !response.passed.includes(p.id));
      assert.ok(responder);
      done = await act(f, done, responder.id, { type: 'passResponse' });
    }
  }
  const reaction = viewGame(done, f.holder).guildBetrayalReaction;
  assert.ok(reaction, 'a later genuinely declared funded shipment opens its own distinct invoice');
  assert.notEqual(reaction.event, f.event);
  assert.equal(reaction.shipper, laterShipper);
  assert.equal(done.guildBetrayal!.sequence, 2);
  assert.deepEqual(done.nexusGuildBetrayalHistory, [firstReceipt]);
  assert.deepEqual(done.guildBetrayalSourceReceipts, [firstSource]);
  await restored(f, done);
  await rejected(f, done, await authenticate(f, f.holder), use(f.event));
  const price = done.pendingGuildBetrayal!.invoice.price;
  const later = await act(f, done, f.holder, use(reaction.event));
  assert.equal(later.nexusGuildBetrayalHistory!.length, 2);
  assert.equal(later.guildBetrayalSourceReceipts!.length, 2);
  assert.deepEqual(later.nexusGuildBetrayalHistory![0], firstReceipt);
  assert.deepEqual(later.guildBetrayalSourceReceipts![0], firstSource);
  assert.equal(player(later, laterShipper).spice, player(beforeSecond, laterShipper).spice - price);
  assert.equal(player(later, f.holder).spice, player(beforeSecond, f.holder).spice + price);
  assert.equal(player(later, laterShipper).reserves, player(beforeSecond, laterShipper).reserves - 1);
  assert.equal(player(later, laterShipper).forces['polar_sink:0'],
    (player(beforeSecond, laterShipper).forces['polar_sink:0'] ?? 0) + 1);
  await restored(f, later);
  for (const event of [f.event, reaction.event])
    await rejected(f, later, await authenticate(f, f.holder), use(event));

  const mutations: { name: string; change(this: void, g: Game): void }[] = [
    { name: 'deleted completed receipt', change: g => { g.nexusGuildBetrayalHistory!.shift(); } },
    { name: 'deleted independent source receipt', change: g => { g.guildBetrayalSourceReceipts!.shift(); } },
    { name: 'deleted receipt cursor', change: g => { delete g.guildBetrayal; } },
    { name: 'deleted receipt collection', change: g => { delete g.nexusGuildBetrayalHistory; } },
    { name: 'altered historical charged fee', change: g => { g.nexusGuildBetrayalHistory![0].invoice.price++; } },
    { name: 'altered historical recipient', change: g => { g.nexusGuildBetrayalHistory![0].recipient = f.guild; } },
    { name: 'detached native source event', change: g => { g.guildBetrayalSourceReceipts![0].event += ':foreign'; } },
    { name: 'detached native source binding', change: g => { g.guildBetrayalSourceReceipts![0].receipt += ':foreign'; } },
    { name: 'reopened completed physical delivery', change: g => { player(g, laterShipper).shipped = false; } },
  ];
  for (const { name, change } of mutations) {
    const corrupt = structuredClone(later);
    change(corrupt);
    f.save(corrupt);
    const before = row(f), changes = totalChanges(f);
    assert.throws(() => normalizeAutomaticGame(corrupt), name);
    for (const auth of f.auths)
      await assert.rejects(f.restart().readSeatView(f.code, await authenticate(f, auth.playerId)), name);
    await rejected(f, corrupt, await authenticate(f, f.holder), use(reaction.event));
    assert.deepEqual(row(f), before, name);
    assert.equal(totalChanges(f), changes, name);
    protectedRows(f);
  }
});

for (const advanced of [false, true]) {
  void test(`SQLite ${advanced ? 'Advanced' : 'Basic'} actual free Fremen shipment has no fee opportunity, award or Nexus consumption`, async t => {
    const f = await fixture(t, { advanced, zero: true, payer: 'other' });
    const before = structuredClone(f.before);
    before.code = f.code;
    before.host = f.initial.host;
    before.version = f.initial.version;
    f.save(before);
    const done = await act(f, before, f.shipper, f.declaration);
    assert.equal(done.pendingGuildBetrayal, null);
    assert.equal(done.guildBetrayal!.sequence, before.guildBetrayal!.sequence);
    assert.deepEqual(done.players.map(p => [p.id, p.spice]), before.players.map(p => [p.id, p.spice]));
    assert.deepEqual(done.nexusCards!.cards, before.nexusCards!.cards);
    assert.deepEqual(delivery(done), delivery(f.original));
    assert.equal(player(done, f.shipper).shipped, true);
    assert.equal(player(done, f.shipper).reserves, player(before, f.shipper).reserves - 2);
    await restored(f, done);
    await rejected(f, done, await authenticate(f, f.holder), use(f.event));
  });
}
