import assert from 'node:assert/strict';
import test from 'node:test';
import type { DatabaseSync, SQLOutputValue } from 'node:sqlite';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { createLeaderSkills } from '../game/leader-skills';
import type { RoomsClock, SeatAuth } from '../db/rooms';
import type * as Rooms from '../db/rooms';
import { startPrototypeRoom } from '../tools/prototype-room';
import { unitStore } from './fixture-nexus-room-store';
import {
  createSpiceBankerIncomeFixture,
  createSpiceBankerIncomeReassignmentFixture,
  nextSpiceBankerIncomeNativeStep,
  quoteSpiceBankerIncomeBattleEconomics,
  stageSpiceBankerIncomeTrainerBattle,
  withSpiceBankerIncomeSetupRandomness,
  type SpiceBankerIncomeFixture,
  type SpiceBankerIncomeFixtureOptions as Options,
} from './fixture-spice-banker-income';

type SqlRow = Record<string, SQLOutputValue>;
interface Fixture extends SpiceBankerIncomeFixture {
  sqlite: DatabaseSync;
  restart(): typeof Rooms;
  hooks: { beforeWrite?: () => Promise<void> };
  tokens: string[];
  auths: SeatAuth[];
  code: string;
  unrelatedCode: string;
  unrelatedToken: string;
  protectedRows: Record<string, SqlRow[]>;
  stock: string[];
  save(game: Game): void;
}
const clock: RoomsClock = { now: () => 10000, sleep: async () => {} };

function records(sqlite: DatabaseSync, excludedRoom?: string) {
  const result: Record<string, SqlRow[]> = {};
  for (const row of sqlite.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()) {
    assert.equal(typeof row.name, 'string');
    const table = String(row.name).replaceAll('"', '""');
    result[String(row.name)] = sqlite.prepare(`SELECT * FROM "${table}"`).all()
      .filter(value => !(row.name === 'rooms' && value.code === excludedRoom));
  }
  return result;
}
function player(game: Game, id: string) {
  const value = game.players.find(seat => seat.id === id);
  assert.ok(value);
  return value;
}
function physical(game: Game) {
  const cards = [...game.deck, ...game.discard, ...game.players.flatMap(seat => seat.hand),
    ...(game.auction?.cards.slice(game.auction.index + Number(game.currentAuctionSale?.origin === 'normal')) ?? [])];
  const ids = cards.map(card => card.id).sort();
  assert.equal(new Set(ids).size, ids.length, 'one physical custodian per original Treachery Card');
  return ids;
}
async function authenticate(f: Fixture, id: string) {
  const index = f.auths.findIndex(auth => auth.playerId === id);
  assert.ok(index >= 0);
  const auth = await f.restart().authenticate(f.code, f.tokens[index]);
  assert.equal(auth.playerId, id);
  return auth;
}
async function act(f: Fixture, game: Game, actor: string, action: Action) {
  await f.restart().act(f.code, await authenticate(f, actor), game.version, action, clock);
  if (action.type === 'advanceBots') await f.restart().continueRoomAutomatic(f.code, clock);
  return f.restart().readRoom(f.code);
}
async function fixture(t: test.TestContext, options: Options = {}): Promise<Fixture> {
  const store = unitStore();
  t.after(() => store.sqlite.close());
  const bankerFaction = options.bankerFaction ?? 'atreides';
  const made = await store.rooms.createRoom('Original Banker faction', bankerFaction, options.advanced ?? true, []);
  const code = made.view.code;
  const tokens = [made.token];
  const factions = [bankerFaction === 'harkonnen' ? 'atreides' : 'harkonnen', 'beneGesserit'] as const;
  for (const faction of [...factions, ...(options.guild ? ['guild'] as const : []),
    ...(options.emperor || options.kind === 'emperor-extra-revival' ? ['emperor'] as const : [])]) {
    const joined = await store.rooms.joinRoom(code, faction, faction);
    assert.ok(joined.token);
    tokens.push(joined.token);
  }
  const auths = await Promise.all(tokens.map(token => store.rooms.authenticate(code, token)));
  let lobby = await store.rooms.readRoom(code);
  for (const auth of auths) {
    await store.rooms.act(code, auth, lobby.version, { type: 'ready' }, clock);
    lobby = await store.rooms.readRoom(code);
  }
  // BG keeps the entry's actual native setup undealt. The fixture consumes that
  // original setup; it cannot reset already dealt cards or replace an offer.
  withSpiceBankerIncomeSetupRandomness(() => startPrototypeRoom(store.sqlite, code, lobby.version, 'banker-income'));
  const setup = await store.rooms.readRoom(code);
  const native = createSpiceBankerIncomeFixture({ ...options, initial: setup });
  assert.equal(native.beforePayment.code, code);
  assert.equal(native.beforePayment.host, lobby.host);
  assert.deepEqual(native.beforePayment.playerPositions, lobby.playerPositions);
  assert.deepEqual(native.beforePayment.players.map(seat => [seat.id, seat.name, seat.faction]),
    lobby.players.map(seat => [seat.id, seat.name, seat.faction]));
  const save = (game: Game) => {
    assert.equal(store.sqlite.prepare('UPDATE rooms SET state=?,version=? WHERE code=?')
      .run(JSON.stringify(game), game.version, code).changes, 1);
  };
  save(native.beforePayment);
  const unrelated = await store.rooms.createRoom('Unrelated private lobby', 'guild', false, []);
  return { ...store, ...native, code, tokens, auths, save, unrelatedCode: unrelated.view.code,
    unrelatedToken: unrelated.token, protectedRows: records(store.sqlite, code), stock: physical(native.beforePayment) };
}
async function restored(f: Fixture, game: Game) {
  const before = records(f.sqlite);
  for (const auth of f.auths) {
    const view = await f.restart().readSeatView(f.code, await authenticate(f, auth.playerId));
    assert.deepEqual(view, viewGame(game, auth.playerId));
    assert.deepEqual(Object.keys(view.spiceBankerIncome!).sort(), ['deferred', 'usedThisPhase']);
    assert.equal(Object.hasOwn(view, 'deck'), false);
    assert.equal(Object.hasOwn(view, 'spiceBankerIncomePayment'), false);
    const projected = JSON.stringify(view);
    const income = JSON.stringify(view.spiceBankerIncome);
    for (const receipt of game.spiceBankerIncome!.sources) {
      assert.equal(projected.includes(receipt.source.event), false, 'native payment event stays private in the entire view');
      assert.equal(projected.includes(receipt.signature), false, 'receipt consistency data stays private in the entire view');
      assert.equal(income.includes(JSON.stringify(receipt.source.bankLegs)), false, 'actual payer legs stay server-only');
    }
    const pendingPayment = game.response?.spiceBankerIncomePayment;
    if (pendingPayment) {
      assert.equal(view.response!.spiceBankerIncomePayment, undefined);
      assert.equal(projected.includes('"spiceBankerIncomePayment":'), false, 'serialized response has no private invoice field');
      assert.equal(projected.includes(pendingPayment.event), false, 'pending native invoice event stays private');
      assert.equal(projected.includes(pendingPayment.signature), false, 'pending invoice signature stays private');
      assert.equal(projected.includes(JSON.stringify(pendingPayment.legs)), false, 'pending own and donor legs stay private');
    }
    for (const seat of view.players)
      if (seat.id !== auth.playerId) assert.equal(seat.hand, undefined);
  }
  assert.deepEqual(await f.restart().readRoom(f.code), game);
  assert.deepEqual(records(f.sqlite), before, 'authenticated projections never award, collect or repair');
  assert.deepEqual(records(f.sqlite, f.code), f.protectedRows);
  assert.deepEqual(physical(game), f.stock);
}
async function rejected(f: Fixture, game: Game, auth: SeatAuth, action: Action, version = game.version) {
  const before = records(f.sqlite);
  await assert.rejects(f.restart().act(f.code, auth, version, action, clock));
  assert.deepEqual(records(f.sqlite), before, 'rejected action changes no currency, card, credential or room');
}
async function settlePayment(f: Fixture, before = f.beforePayment) {
  let game = await act(f, before, f.actor, f.paymentAction);
  for (let steps = 0; (game.response || game.decision?.kind === 'guildShipment') && steps < 30; steps++) {
    const step = nextSpiceBankerIncomeNativeStep(game);
    assert.ok(step);
    game = await act(f, game, step.actor, step.action);
  }
  assert.equal(game.response, null);
  return game;
}
async function finalCollectionStep(f: Fixture, initial: Game) {
  let game = initial;
  for (let steps = 0; steps < 500; steps++) {
    assert.notEqual(game.phase, 8, 'the original final Collection action must still be pending');
    const step = nextSpiceBankerIncomeNativeStep(game);
    assert.ok(step, `native continuation is available in phase ${game.phase}`);
    if (game.phase === 7 && applyAction(game, step.actor, step.action).phase === 8)
      return { game, step };
    game = await act(f, game, step.actor, step.action);
  }
  assert.fail('native Collection completion did not become available');
}

for (const advanced of [false, true]) {
  void test(`SQLite ${advanced ? 'Advanced' : 'Basic'} original auction pays once, holds unavailable income through restart and collects at actual native Mentat`, async t => {
    const f = await fixture(t, { advanced });
    const before = f.beforePayment;
    assert.ok(before.auction?.bidder);
    const payer = before.auction.bidder;
    const card = before.auction.cards[before.auction.index];
    const payerSpice = player(before, payer).spice;
    const ownerSpice = player(before, f.owner).spice;
    const paid = await settlePayment(f);
    assert.equal(player(paid, payer).spice, payerSpice - 4);
    assert.equal(player(paid, payer).hand.filter(held => held.id === card.id).length, 1);
    assert.equal(player(paid, f.owner).spice, ownerSpice);
    assert.deepEqual(viewGame(paid, f.owner).spiceBankerIncome!.deferred, [{ owner: f.owner, amount: 1 }]);
    assert.equal(paid.spiceBankerIncome!.sources.filter(source => source.grant).length, 1);
    await restored(f, paid);
    await rejected(f, paid, await authenticate(f, f.actor), f.paymentAction, before.version);
    const final = await finalCollectionStep(f, paid);
    await restored(f, final.game);
    const funds = player(final.game, f.owner).spice;
    const done = await act(f, final.game, final.step.actor, final.step.action);
    assert.equal(done.phase, 8);
    assert.equal(player(done, f.owner).spice, funds + 1);
    assert.deepEqual(viewGame(done, f.owner).spiceBankerIncome!.deferred, []);
    assert.equal(done.spiceBankerIncome!.collections.length, 1);
    assert.deepEqual(done.spiceBankerIncome!.collections[0].credits, [{ owner: f.owner, amount: 1 }]);
    await Promise.all([f.restart().continueRoomAutomatic(f.code, clock), f.restart().continueRoomAutomatic(f.code, clock)]);
    assert.deepEqual(await f.restart().readRoom(f.code), done);
    await rejected(f, done, await authenticate(f, final.step.actor), final.step.action, final.game.version);
    await restored(f, done);
  });
}

for (const options of [{ amount: 3 }, { ownerIsPayer: true }] satisfies Options[]) {
  void test(`SQLite original auction ${options.amount === 3 ? 'below four' : 'by Banker owner'} cannot produce normal income`, async t => {
    const f = await fixture(t, options);
    const before = f.beforePayment;
    assert.ok(before.auction?.bidder);
    const payer = before.auction.bidder;
    const amount = options.amount ?? 4;
    const done = await settlePayment(f);
    assert.equal(player(done, payer).spice, player(before, payer).spice - amount);
    assert.deepEqual(viewGame(done, f.owner).spiceBankerIncome!.deferred, []);
    assert.equal(done.spiceBankerIncome!.sources.filter(source => source.grant).length, 0);
    await restored(f, done);
  });
}

void test('SQLite duplicate original payment race admits one debit, one physical card and one deferred grant', async t => {
  const f = await fixture(t);
  const before = f.beforePayment;
  assert.ok(before.auction?.bidder);
  const payer = before.auction.bidder;
  const card = before.auction.cards[before.auction.index];
  const auth = await authenticate(f, f.actor);
  let arrivals = 0;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  f.hooks.beforeWrite = async () => { if (++arrivals === 2) release(); await gate; };
  let results: PromiseSettledResult<unknown>[];
  try {
    results = await Promise.allSettled([f.restart(), f.restart()].map(rooms =>
      rooms.act(f.code, auth, before.version, f.paymentAction, clock).finally(release)));
  } finally { delete f.hooks.beforeWrite; }
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter(result => result.status === 'rejected').length, 1);
  const done = await f.restart().readRoom(f.code);
  assert.equal(done.version, before.version + 1);
  assert.equal(player(done, payer).spice, player(before, payer).spice - 4);
  assert.equal(player(done, payer).hand.filter(held => held.id === card.id).length, 1);
  assert.equal(done.spiceBankerIncome!.sources.filter(source => source.grant).length, 1);
  await restored(f, done);
});

void test('SQLite lost original payment CAS cannot leak a speculative grant or retire the original card', async t => {
  const f = await fixture(t);
  const before = f.beforePayment;
  const competing = structuredClone(before);
  competing.version++;
  f.hooks.beforeWrite = async () => {
    delete f.hooks.beforeWrite;
    f.save(competing);
  };
  await assert.rejects(f.restart().act(f.code, await authenticate(f, f.actor), before.version, f.paymentAction, clock));
  assert.deepEqual(await f.restart().readRoom(f.code), competing);
  assert.deepEqual(viewGame(competing, f.owner).spiceBankerIncome!.deferred, []);
  await restored(f, competing);
  const done = await settlePayment(f, competing);
  assert.equal(done.spiceBankerIncome!.sources.filter(source => source.grant).length, 1);
  await restored(f, done);
});

void test('SQLite racing final Collection readiness and automatic recovery credit the original owner atomically once', async t => {
  const f = await fixture(t);
  const paid = await settlePayment(f);
  const { game, step } = await finalCollectionStep(f, paid);
  const funds = player(game, f.owner).spice;
  const auth = await authenticate(f, step.actor);
  let arrivals = 0;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  f.hooks.beforeWrite = async () => { if (++arrivals === 2) release(); await gate; };
  let results: PromiseSettledResult<unknown>[];
  try {
    results = await Promise.allSettled([
      f.restart().act(f.code, auth, game.version, step.action, clock).finally(release),
      f.restart().act(f.code, auth, game.version, step.action, clock).finally(release),
      f.restart().continueRoomAutomatic(f.code, clock),
      f.restart().continueRoomAutomatic(f.code, clock),
    ]);
  } finally { delete f.hooks.beforeWrite; }
  assert.equal(results.slice(0, 2).filter(result => result.status === 'fulfilled').length, 1);
  const done = await f.restart().readRoom(f.code);
  assert.equal(done.phase, 8);
  assert.equal(done.version, game.version + 1);
  assert.equal(player(done, f.owner).spice, funds + 1);
  assert.equal(done.spiceBankerIncome!.collections.length, 1);
  assert.deepEqual(viewGame(done, f.owner).spiceBankerIncome!.deferred, []);
  await Promise.all([f.restart().continueRoomAutomatic(f.code, clock), f.restart().continueRoomAutomatic(f.code, clock)]);
  assert.deepEqual(await f.restart().readRoom(f.code), done);
  await restored(f, done);
});

void test('SQLite foreign credentials, wrong native actor, stale version and forged automatic-income actions cannot mutate payment state', async t => {
  const f = await fixture(t);
  const before = records(f.sqlite);
  const foreign = await f.restart().authenticate(f.unrelatedCode, f.unrelatedToken);
  await assert.rejects(f.restart().authenticate(f.code, f.unrelatedToken));
  await assert.rejects(f.restart().readSeatView(f.code, foreign));
  await assert.rejects(f.restart().readSeatView(f.code, { playerId: f.actor, tokenHash: foreign.tokenHash }));
  assert.deepEqual(records(f.sqlite), before);
  for (const auth of [foreign, { playerId: f.actor, tokenHash: foreign.tokenHash },
    await authenticate(f, f.auths.find(auth => auth.playerId !== f.actor)!.playerId)])
    await rejected(f, f.beforePayment, auth, f.paymentAction);
  const auth = await authenticate(f, f.actor);
  await rejected(f, f.beforePayment, auth, f.paymentAction, f.beforePayment.version - 1);
  for (const action of [{ type: 'spiceBankerIncome', amount: 1 }, { type: 'collectSpiceBankerIncome' },
    { ...f.paymentAction, actor: f.owner }, { ...f.paymentAction, bankerIncome: 1 },
    { ...f.paymentAction, paymentSource: 'bank' }])
    await rejected(f, f.beforePayment, auth, action);
  f.sqlite.prepare('UPDATE seats SET revoked=1 WHERE room_code=? AND player_id=?').run(f.code, f.actor);
  f.protectedRows = records(f.sqlite, f.code);
  await assert.rejects(f.restart().readSeatView(f.code, auth));
  await rejected(f, f.beforePayment, auth, f.paymentAction);
});

void test('SQLite corrupt earned source, recipient, amount, stamps and collection history fail closed without read or recovery repair', async t => {
  const f = await fixture(t);
  const paid = await settlePayment(f);
  const changes: ((game: Game) => void)[] = [
    game => { game.spiceBankerIncome!.sources[0].source.bankLegs[0].amount++; },
    game => { game.spiceBankerIncome!.sources[0].source.event += ':forged'; },
    game => { game.spiceBankerIncome!.sources[0].grant!.owner = f.payer; },
    game => { game.spiceBankerIncome!.sources[0].grant!.stamp += ':reset'; },
    game => { game.spiceBankerIncome!.sources.push(structuredClone(game.spiceBankerIncome!.sources[0])); },
    game => { game.spiceBankerIncome!.head += ':forged'; },
    game => { game.spiceBankerIncome!.signature += ':forged'; },
  ];
  const final = await finalCollectionStep(f, paid);
  const collected = await act(f, final.game, final.step.actor, final.step.action);
  const corruptCollection = structuredClone(collected);
  corruptCollection.spiceBankerIncome!.collections[0].credits[0].amount++;
  for (const corrupt of [...changes.map(change => { const game = structuredClone(paid); change(game); return game; }), corruptCollection]) {
    f.save(corrupt);
    const before = records(f.sqlite);
    const snapshot = structuredClone(corrupt);
    for (const auth of f.auths)
      await assert.rejects(f.restart().readSeatView(f.code, await authenticate(f, auth.playerId)));
    await rejected(f, corrupt, await authenticate(f, f.actor), { type: 'ready' });
    await Promise.allSettled([f.restart().continueRoomAutomatic(f.code, clock), f.restart().continueRoomAutomatic(f.code, clock)]);
    assert.deepEqual(records(f.sqlite), before);
    assert.deepEqual(corrupt, snapshot);
  }
});

void test('SQLite front-shield income cannot fund a native bid before Mentat collection', async t => {
  const f = await fixture(t);
  let game = await settlePayment(f);
  for (let steps = 0; game.phase === 3 && game.auction?.active !== f.owner && steps < 30; steps++) {
    const step = nextSpiceBankerIncomeNativeStep(game);
    assert.ok(step);
    game = await act(f, game, step.actor, step.action);
  }
  assert.equal(game.phase, 3);
  assert.equal(game.auction?.active, f.owner);
  assert.deepEqual(viewGame(game, f.owner).spiceBankerIncome!.deferred, [{ owner: f.owner, amount: 1 }]);
  assert.equal(player(game, f.owner).hand.some(card => card.effect === 'karama'), false,
    'this is an ordinary funded bid, not an authorized free Karama overbid');
  await rejected(f, game, await authenticate(f, f.owner),
    { type: 'bid', amount: player(game, f.owner).spice + 1 });
  await restored(f, game);
});

for (const guild of [false, true]) {
  void test(`SQLite original shipment to ${guild ? 'native Guild' : 'Bank'} preserves its actual recipient and credits only the Bank case`, async t => {
    const f = await fixture(t, { kind: 'shipment', guild });
    const before = f.beforePayment;
    const payer = player(before, f.payer);
    const shipped = Number(f.paymentAction.amount ?? before.pendingShipment?.amount);
    assert.ok(Number.isSafeInteger(shipped) && shipped > 0);
    const recipient = before.players.find(seat => seat.faction === 'guild');
    const done = await settlePayment(f);
    assert.equal(player(done, f.payer).spice, payer.spice - f.amount);
    assert.equal(player(done, f.payer).reserves, payer.reserves - shipped);
    assert.equal(player(done, f.payer).shipped, true);
    if (f.actor !== f.payer)
      assert.equal(player(done, f.actor).reserves, player(before, f.actor).reserves,
        'the native executor does not ship the economic payer’s reserves');
    if (recipient) assert.equal(player(done, recipient.id).spice, recipient.spice + f.amount);
    assert.deepEqual(viewGame(done, f.owner).spiceBankerIncome!.deferred,
      guild ? [] : [{ owner: f.owner, amount: 1 }]);
    await restored(f, done);
  });
}

void test('SQLite genuine free force revival has zero bank payment and never manufactures income', async t => {
  const f = await fixture(t, { kind: 'force-revival' });
  const before = f.beforePayment;
  const funds = player(before, f.actor).spice;
  const tanks = player(before, f.actor).tanks;
  const reserves = player(before, f.actor).reserves;
  const done = await act(f, before, f.actor, { type: 'revive', amount: 1 });
  assert.equal(player(done, f.actor).spice, funds);
  assert.equal(player(done, f.actor).tanks, tanks - 1);
  assert.equal(player(done, f.actor).reserves, reserves + 1);
  assert.deepEqual(viewGame(done, f.owner).spiceBankerIncome!.deferred, []);
  assert.equal(done.spiceBankerIncome!.sources.filter(source => source.grant).length, 0);
  await restored(f, done);
});

void test('SQLite pending native Guild income keeps its funded own and donor invoice private and rejects invoice corruption without repair', async t => {
  const f = await fixture(t, { kind: 'shipment', guild: true, amount: 5, allySplit: 1, stageIncomeCounter: true });
  const before = f.beforePayment;
  assert.ok(player(before, f.owner).hand.some(card => card.effect === 'karama'),
    'an actual held counter keeps the original Guild income window eligible');
  const donor = player(before, f.payer).ally;
  const guild = before.players.find(seat => seat.faction === 'guild');
  assert.ok(donor && guild);
  let pending = await act(f, before, f.actor, f.paymentAction);
  for (let steps = 0; (pending.decision?.kind === 'guildShipment' ||
    pending.response?.kind === 'guildRate') && steps < 30; steps++) {
    assert.equal(pending.phase, before.phase, 'only the original shipment’s native windows may continue');
    const step = nextSpiceBankerIncomeNativeStep(pending);
    assert.ok(step);
    pending = await act(f, pending, step.actor, step.action);
  }
  assert.equal(pending.response?.kind, 'guildIncome');
  const invoice = pending.response!.spiceBankerIncomePayment;
  assert.ok(invoice);
  assert.deepEqual(invoice.legs, [
    { payer: f.payer, amount: 4, recipient: 'player' },
    { payer: donor, amount: 1, recipient: 'player' },
  ]);
  assert.equal(player(pending, f.payer).spice, player(before, f.payer).spice - 4);
  assert.equal(player(pending, donor).spice, player(before, donor).spice, 'native donor escrow was paid before declaration');
  assert.equal(player(pending, f.payer).reserves, player(before, f.payer).reserves - 5);
  assert.equal(player(pending, guild.id).spice, guild.spice, 'original recipient is still awaiting its response');
  assert.deepEqual(viewGame(pending, f.owner).spiceBankerIncome!.deferred, []);
  await restored(f, pending);
  assert.throws(() => viewGame(pending, 'spectator'));
  const privateValues: readonly string[] = [invoice.event, invoice.signature, JSON.stringify(invoice.legs)];
  for (const seat of pending.players) {
    const publicView = viewGame(pending, seat.id);
    assert.equal(publicView.response!.spiceBankerIncomePayment, undefined);
    assert.equal(JSON.stringify(publicView).includes('"spiceBankerIncomePayment":'), false);
    for (const privateValue of privateValues)
      assert.equal(JSON.stringify(publicView).includes(privateValue), false);
  }
  const changes: ((game: Game) => void)[] = [
    game => { delete game.response!.spiceBankerIncomePayment; },
    game => { game.response!.spiceBankerIncomePayment!.event += ':forged'; },
    game => { game.response!.spiceBankerIncomePayment!.signature += ':forged'; },
    game => { game.response!.spiceBankerIncomePayment!.legs[0].amount++; },
    game => { game.response!.spiceBankerIncomePayment!.legs[1].payer = f.payer; },
    game => { game.response!.spiceBankerIncomePayment!.legs[0].recipient = 'bank'; },
    game => { game.response!.spiceBankerIncomePayment!.kind = 'auction'; },
  ];
  const continuation = nextSpiceBankerIncomeNativeStep(pending);
  assert.ok(continuation);
  for (const change of changes) {
    const corrupt = structuredClone(pending);
    change(corrupt);
    f.save(corrupt);
    const rows = records(f.sqlite);
    for (const auth of f.auths)
      await assert.rejects(f.restart().readSeatView(f.code, await authenticate(f, auth.playerId)));
    await rejected(f, corrupt, await authenticate(f, continuation.actor), continuation.action);
    await Promise.allSettled([f.restart().continueRoomAutomatic(f.code, clock), f.restart().continueRoomAutomatic(f.code, clock)]);
    assert.deepEqual(records(f.sqlite), rows, 'corrupt pending invoices cannot be repaired by refresh or automatic recovery');
  }
  f.save(pending);
  let paid = pending;
  for (let steps = 0; paid.response && steps < 30; steps++) {
    const step = nextSpiceBankerIncomeNativeStep(paid);
    assert.ok(step);
    paid = await act(f, paid, step.actor, step.action);
  }
  assert.equal(paid.response, null);
  assert.equal(player(paid, guild.id).spice, guild.spice + 5);
  assert.equal(player(paid, f.payer).spice, player(pending, f.payer).spice);
  assert.deepEqual(player(paid, f.payer).forces, player(pending, f.payer).forces);
  assert.deepEqual(viewGame(paid, f.owner).spiceBankerIncome!.deferred, []);
  await restored(f, paid);
});

void test('SQLite competing original shipment declarations preserve only the winning tariff and delivered group', async t => {
  const f = await fixture(t, { kind: 'shipment' });
  const before = f.beforePayment;
  const auth = await authenticate(f, f.actor);
  const actions = [f.paymentAction, { ...f.paymentAction, amount: 5 }];
  let arrivals = 0;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  f.hooks.beforeWrite = async () => { if (++arrivals === 2) release(); await gate; };
  let results: PromiseSettledResult<unknown>[];
  try {
    results = await Promise.allSettled(actions.map(action =>
      f.restart().act(f.code, auth, before.version, action, clock).finally(release)));
  } finally { delete f.hooks.beforeWrite; }
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  const winner = results.findIndex(result => result.status === 'fulfilled');
  const amount = winner === 0 ? 4 : 5;
  const done = await f.restart().readRoom(f.code);
  assert.equal(player(done, f.payer).spice, player(before, f.payer).spice - amount);
  assert.equal(player(done, f.payer).reserves, player(before, f.payer).reserves - amount);
  assert.equal(done.spiceBankerIncome!.sources.filter(source => source.grant).length, 1);
  assert.deepEqual(viewGame(done, f.owner).spiceBankerIncome!.deferred, [{ owner: f.owner, amount: 1 }]);
  await restored(f, done);
});

for (const fate of ['death', 'capture'] as const) {
  void test(`SQLite original earned currency survives actual native trainer ${fate} and collects for the original faction under the local policy`, async t => {
    const f = await fixture(t, { advanced: true });
    const paid = await settlePayment(f);
    const earned = structuredClone(paid.spiceBankerIncome);
    // The fixture stages conserved battle pieces, then executes the genuine
    // visibility, plans, survival and capture choices; it never edits income.
    const changed = stageSpiceBankerIncomeTrainerBattle(paid, { [fate]: true });
    const trainer = player(changed, f.owner).leaders.find(leader => leader.id === f.leader);
    assert.ok(trainer);
    if (fate === 'death') assert.equal(trainer.dead, true);
    else assert.equal(trainer.capturedBy, changed.players.find(seat => seat.faction === 'harkonnen')!.id);
    assert.deepEqual(changed.spiceBankerIncome, earned);
    assert.deepEqual(viewGame(changed, f.owner).spiceBankerIncome!.deferred, [{ owner: f.owner, amount: 1 }]);
    f.save(changed);
    await restored(f, changed);
    const { game, step } = await finalCollectionStep(f, changed);
    const funds = game.players.map(seat => [seat.id, seat.spice] as const);
    const done = await act(f, game, step.actor, step.action);
    for (const [id, spice] of funds)
      assert.equal(player(done, id).spice, spice + Number(id === f.owner));
    assert.deepEqual(done.spiceBankerIncome!.collections[0].credits, [{ owner: f.owner, amount: 1 }]);
    await Promise.all([f.restart().continueRoomAutomatic(f.code, clock), f.restart().continueRoomAutomatic(f.code, clock)]);
    assert.deepEqual(await f.restart().readRoom(f.code), done);
    await restored(f, done);
  });
}

void test('SQLite two distinct native auction purchases retain both original costs but award only once in their phase', async t => {
  const f = await fixture(t);
  const firstPurchase = f.beforePayment.auction!.cards[f.beforePayment.auction!.index].id;
  const firstBonus = f.beforePayment.deck[0].id;
  const firstHand = player(f.beforePayment, f.payer).hand.map(card => card.id);
  assert.equal(player(f.beforePayment, f.payer).faction, 'harkonnen');
  const first = await settlePayment(f);
  assert.equal(player(first, f.payer).spice, player(f.beforePayment, f.payer).spice - 4);
  assert.notEqual(firstPurchase, firstBonus);
  assert.deepEqual(player(first, f.payer).hand.map(card => card.id).sort(),
    [...firstHand, firstPurchase, firstBonus].sort());
  assert.deepEqual(first.deck.map(card => card.id), f.beforePayment.deck.slice(1).map(card => card.id));
  let game = first;
  for (let steps = 0; game.auction?.active !== f.payer && steps < 30; steps++) {
    const step = nextSpiceBankerIncomeNativeStep(game);
    assert.ok(step);
    game = await act(f, game, step.actor, step.action);
  }
  assert.equal(game.phase, 3);
  assert.equal(game.auction?.active, f.payer);
  const funds = player(game, f.payer).spice;
  const hand = player(game, f.payer).hand.map(card => card.id);
  const acquired = game.auction!.cards[game.auction!.index].id;
  const bonus = game.deck[0].id;
  const deck = game.deck.map(card => card.id);
  assert.equal(hand.includes(acquired), false);
  assert.equal(hand.includes(bonus), false);
  assert.notEqual(acquired, firstPurchase, 'the second purchase is a distinct original auction lot');
  assert.notEqual(acquired, bonus);
  game = await act(f, game, f.payer, { type: 'bid', amount: 4 });
  for (let steps = 0; (!player(game, f.payer).hand.some(card => card.id === acquired) ||
    game.response?.kind === 'harkonnenBonus') && steps < 30; steps++) {
    if (game.decision?.kind === 'auctionPayment')
      game = await act(f, game, f.payer, { type: 'decision', karama: false });
    else {
      const step = nextSpiceBankerIncomeNativeStep(game);
      assert.ok(step);
      game = await act(f, game, step.actor, step.action);
    }
  }
  assert.equal(player(game, f.payer).spice, funds - 4);
  assert.deepEqual(player(game, f.payer).hand.map(card => card.id).sort(), [...hand, acquired, bonus].sort());
  assert.deepEqual(game.deck.map(card => card.id), deck.slice(1), 'the actual native bonus leaves its sole deck custodian once');
  assert.equal(game.spiceBankerIncome!.sources.length, first.spiceBankerIncome!.sources.length + 1);
  assert.equal(game.spiceBankerIncome!.sources.filter(source => source.grant).length, 1);
  assert.notEqual(game.spiceBankerIncome!.sources[0].source.event, game.spiceBankerIncome!.sources[1].source.event);
  assert.deepEqual(game.spiceBankerIncome!.sources.map(receipt => receipt.source.bankLegs),
    [[{ payer: f.payer, amount: 4 }], [{ payer: f.payer, amount: 4 }]]);
  assert.deepEqual(viewGame(game, f.owner).spiceBankerIncome!.deferred, [{ owner: f.owner, amount: 1 }]);
  await restored(f, game);
});

void test('SQLite one funded auction split between actual payers never pools three and one into a qualifying payment', async t => {
  const f = await fixture(t, { amount: 4, allySplit: 1 });
  const before = f.beforePayment;
  const donor = player(before, f.payer).ally;
  assert.ok(donor);
  const done = await settlePayment(f);
  assert.equal(player(done, f.payer).spice, player(before, f.payer).spice - 3);
  assert.equal(player(done, donor).spice, player(before, donor).spice, 'already committed donor escrow is not charged twice');
  const source = done.spiceBankerIncome!.sources.at(-1);
  assert.ok(source);
  assert.deepEqual(source.source.bankLegs, [{ payer: f.payer, amount: 3 }, { payer: donor, amount: 1 }]);
  assert.equal(source.grant, null);
  assert.deepEqual(viewGame(done, f.owner).spiceBankerIncome!.deferred, []);
  await restored(f, done);
});

void test('SQLite the actual returned Banker card can be legally revived and assigned to a different faction without transferring original earned currency', async t => {
  const f = await fixture(t, { advanced: true });
  const paid = await settlePayment(f);
  const originalSource = structuredClone(paid.spiceBankerIncome!.sources[0]);
  // Parent-approved entropy is scoped to the genuine native mutual-death return
  // shuffle. The helper then follows real Mentat and next-turn Revival; it never
  // reorders a started deck, fabricates an offer or edits an income receipt.
  const lifecycle = createSpiceBankerIncomeReassignmentFixture(paid);
  let game = lifecycle.beforeRevival;
  assert.notEqual(lifecycle.actor, lifecycle.originalOwner);
  assert.equal(game.turn, paid.turn + 1);
  assert.equal(game.phase, 4);
  assert.deepEqual(game.spiceBankerIncome!.sources[0], originalSource);
  assert.deepEqual(game.spiceBankerIncome!.collections[0].credits, [{ owner: lifecycle.originalOwner, amount: 1 }]);
  assert.deepEqual(viewGame(game, lifecycle.originalOwner).spiceBankerIncome!.deferred, []);
  assert.equal(game.leaderSkills!.assignments.some(assignment => assignment.skill === 'spice-banker'), false);
  f.save(game);
  await restored(f, game);
  const funds = player(game, lifecycle.actor).spice;
  const originalFunds = player(game, lifecycle.originalOwner).spice;
  const trainer = player(game, lifecycle.actor).leaders.find(leader => leader.id === lifecycle.leader);
  assert.ok(trainer?.dead);
  const price = trainer.strength;
  game = await act(f, game, lifecycle.actor, lifecycle.revivalAction);
  for (let steps = 0; game.response && steps < 30; steps++) {
    const step = nextSpiceBankerIncomeNativeStep(game);
    assert.ok(step);
    game = await act(f, game, step.actor, step.action);
  }
  assert.equal(game.decision?.kind, 'leaderSkillRevival');
  assert.equal(player(game, lifecycle.actor).spice, funds - price);
  assert.equal(player(game, lifecycle.originalOwner).spice, originalFunds);
  assert.equal(player(game, lifecycle.actor).leaders.find(leader => leader.id === lifecycle.leader)!.dead, false);
  assert.equal(game.spiceBankerIncome!.sources.at(-1)!.grant, null, 'future skill assignment cannot award for the earlier revival payment');
  await restored(f, game);
  const event = game.decision!.event;
  game = await act(f, game, lifecycle.actor, { type: 'leaderSkill', event, mode: 'draw' });
  assert.ok(game.leaderSkills!.offers[lifecycle.actor].cards.includes('spice-banker'));
  await restored(f, game);
  const beforeSelection = game;
  const select: Action = { type: 'leaderSkill', event, skill: 'spice-banker', leader: lifecycle.leader };
  game = await act(f, game, lifecycle.actor, select);
  assert.deepEqual(game.leaderSkills!.assignments.find(assignment => assignment.skill === 'spice-banker'),
    { owner: lifecycle.actor, leader: lifecycle.leader, skill: 'spice-banker' });
  const skills = [...game.leaderSkills!.deck, ...Object.values(game.leaderSkills!.offers).flatMap(offer => offer.cards),
    ...game.leaderSkills!.assignments.map(assignment => assignment.skill)];
  assert.deepEqual(skills.sort(), createLeaderSkills(() => 0.5).deck.sort(), 'all fourteen physical skills remain in one custodian');
  assert.deepEqual(game.spiceBankerIncome!.sources[0], originalSource);
  assert.deepEqual(game.spiceBankerIncome!.collections[0].credits, [{ owner: lifecycle.originalOwner, amount: 1 }]);
  assert.equal(player(game, lifecycle.actor).spice, funds - price);
  assert.equal(player(game, lifecycle.originalOwner).spice, originalFunds);
  assert.deepEqual(viewGame(game, lifecycle.actor).spiceBankerIncome!.deferred, []);
  await rejected(f, game, await authenticate(f, lifecycle.actor), select, beforeSelection.version);
  await rejected(f, game, await authenticate(f, lifecycle.actor), select);
  await Promise.all([f.restart().continueRoomAutomatic(f.code, clock), f.restart().continueRoomAutomatic(f.code, clock)]);
  assert.deepEqual(await f.restart().readRoom(f.code), game);
  await restored(f, game);
});

for (const kind of ['force-revival', 'leader-revival', 'kh-revival', 'emperor-extra-revival'] as const) {
  void test(`SQLite actual paid ${kind} preserves native payer, revived beneficiary and allowance while retaining only qualifying bank income`, async t => {
    const f = await fixture(t, { kind, advanced: true,
      ...(kind === 'force-revival' ? { payerFaction: 'emperor', emperor: true } : {}),
      ...(kind === 'kh-revival' ? { bankerFaction: 'harkonnen', payerFaction: 'atreides' } : {}) });
    const before = f.beforePayment;
    const payer = player(before, f.payer);
    const beneficiary = kind === 'emperor-extra-revival' ? player(before, payer.ally!) : payer;
    const trainer = player(before, f.owner).leaders.find(leader => leader.id === f.leader);
    assert.ok(trainer && !trainer.dead && !trainer.capturedBy);
    assert.notEqual(f.owner, payer.id, 'these are another real payer’s bank payment');
    const paid = await settlePayment(f);
    const revived = player(paid, beneficiary.id);
    assert.equal(player(paid, payer.id).spice, payer.spice - f.amount);
    assert.equal(player(paid, f.owner).spice, player(before, f.owner).spice);
    if (kind === 'force-revival') {
      assert.equal(payer.faction, 'emperor', 'native free-one revival leaves two paid forces');
      assert.equal(f.amount, 4);
      assert.equal(revived.reserves, beneficiary.reserves + 3);
      assert.equal(revived.tanks, beneficiary.tanks - 3);
      assert.equal(revived.revived, beneficiary.revived + 3);
      assert.equal(revived.freeForcesRevived, (beneficiary.freeForcesRevived ?? 0) + 1);
    } else if (kind === 'leader-revival') {
      const target = beneficiary.leaders.find(leader => leader.id === f.paymentAction.leader);
      assert.ok(target?.dead);
      assert.equal(revived.leaders.find(leader => leader.id === target.id)!.dead, false);
      assert.equal(revived.leaderRevived, true);
      assert.equal(paid.decision?.kind, 'leaderSkillRevival');
    } else if (kind === 'kh-revival') {
      assert.equal(f.amount, 2, 'KH is its actual native two-spice price, never a fabricated four');
      assert.equal(beneficiary.kwisatz?.dead, true);
      assert.equal(revived.kwisatz?.dead, false);
      assert.equal(revived.kwisatz?.revivalCycle, Math.max(revived.revivalCycle, beneficiary.kwisatz!.revivalCycle ?? 1) + 1);
      assert.equal(revived.leaderRevived, true);
    } else {
      assert.notEqual(payer.id, beneficiary.id);
      assert.equal(payer.faction, 'emperor');
      assert.equal(revived.spice, beneficiary.spice, 'the revived ally does not pay the Emperor’s debit');
      assert.equal(revived.reserves, beneficiary.reserves + 2);
      assert.equal(revived.tanks, beneficiary.tanks - 2);
      assert.equal(revived.revived, beneficiary.revived, 'extra revivals do not consume the normal allowance');
      assert.equal(revived.freeForcesRevived, beneficiary.freeForcesRevived);
      assert.equal(paid.emperorExtra[beneficiary.id], (before.emperorExtra[beneficiary.id] ?? 0) + 2);
    }
    const source = paid.spiceBankerIncome!.sources.at(-1);
    assert.ok(source);
    assert.equal(paid.spiceBankerIncome!.sources.length, before.spiceBankerIncome!.sources.length + 1);
    assert.equal(source.source.kind, kind);
    assert.equal(source.source.turn, before.turn);
    assert.equal(source.source.phase, 4);
    assert.deepEqual(source.source.bankLegs, [{ payer: payer.id, amount: f.amount }]);
    assert.equal(source.source.trainer?.resolved, true, 'the source authority denotes committed native payment');
    assert.deepEqual(viewGame(paid, f.owner).spiceBankerIncome!.deferred,
      kind === 'kh-revival' ? [] : [{ owner: f.owner, amount: 1 }]);
    await rejected(f, paid, await authenticate(f, f.actor), f.paymentAction, before.version);
    await restored(f, paid);
  });
}

for (const options of [
  { trainerSelected: true, amount: 4, expected: 1 },
  { trainerSelected: true, trainerDies: true, amount: 4, expected: 0 },
  { trainerHidden: true, amount: 4, expected: 0 },
  { amount: 3, expected: 0 },
]) {
  void test(`SQLite resolved native support preserves payment and obeys trainer survival, concealment and threshold ${JSON.stringify(options)}`, async t => {
    const { expected, ...native } = options;
    const f = await fixture(t, { kind: 'battle-support', advanced: true, ...native });
    const before = f.beforePayment;
    assert.ok(before.battle?.revealed);
    assert.equal(before.battle.plans[f.payer].support, options.amount);
    assert.deepEqual(viewGame(before, f.owner).spiceBankerIncome!.deferred, []);
    const paid = await settlePayment(f);
    const trainer = player(paid, f.owner).leaders.find(leader => leader.id === f.leader);
    assert.ok(trainer);
    assert.equal(trainer.dead, 'trainerDies' in options && options.trainerDies);
    assert.equal(paid.lastBattleContext?.event, before.battle.event);
    assert.equal(paid.lastBattleContext?.result, 'normal');
    const economics = quoteSpiceBankerIncomeBattleEconomics(before, paid);
    const support = economics.resolution.payments.find(payment => payment.player === f.payer);
    assert.ok(support);
    assert.equal(support.ownPayment, options.amount, 'the original native support debit is not netted against income');
    const bounty = economics.resolution.bounty;
    assert.equal(bounty?.amount ?? 0, trainer.dead ? trainer.strength : 0);
    if (bounty) assert.equal(bounty.player, f.payer, 'the winner earns the real killed-leader bounty');
    for (const id of [f.payer, f.owner]) {
      const debit = economics.resolution.payments.find(payment => payment.player === id)!.ownPayment;
      const collection = economics.nativeCollection.find(receipt => receipt.player === id);
      const nativeIncome = (bounty?.player === id ? bounty.amount : 0) +
        (collection ? collection.strongholds + collection.collected : 0);
      assert.equal(player(paid, id).spice, player(before, id).spice - debit + nativeIncome,
        'original support, native bounty and actual Collection remain separate from deferred Banker income');
    }
    const source = paid.spiceBankerIncome!.sources.at(-1);
    assert.ok(source);
    assert.equal(source.source.kind, 'battle-support');
    assert.deepEqual(source.source.bankLegs, [{ payer: f.payer, amount: options.amount }]);
    if (trainer.dead) assert.equal(source.source.trainer, null);
    else {
      assert.equal(source.source.trainer?.resolved, true);
      assert.equal(source.source.trainer?.selected, 'trainerSelected' in options && options.trainerSelected);
      assert.equal(source.source.trainer?.faceUp, !('trainerSelected' in options || 'trainerHidden' in options));
    }
    assert.equal(source.grant?.amount ?? 0, expected);
    assert.deepEqual(viewGame(paid, f.owner).spiceBankerIncome!.deferred,
      expected ? [{ owner: f.owner, amount: 1 }] : []);
    await rejected(f, paid, await authenticate(f, f.actor), f.paymentAction, before.version);
    await restored(f, paid);
  });
}

void test('SQLite Emperor self-purchase actually pays the Bank, retains its original card and auction counter, and collects deferred income at native Mentat once', async t => {
  const f = await fixture(t, { emperor: true, payerFaction: 'emperor' });
  const before = f.beforePayment;
  const emperor = player(before, f.payer);
  assert.equal(emperor.faction, 'emperor');
  assert.notEqual(emperor.id, f.owner);
  assert.ok(before.auction);
  const card = before.auction.cards[before.auction.index];
  const paid = await settlePayment(f);
  assert.equal(player(paid, emperor.id).spice, emperor.spice - 4, 'self purchase is a real bank debit, not self-recipient income');
  assert.equal(player(paid, emperor.id).hand.filter(held => held.id === card.id).length, 1);
  assert.equal(paid.auction?.index, before.auction.index + 1);
  assert.equal(player(paid, f.owner).spice, player(before, f.owner).spice);
  const receipt = paid.spiceBankerIncome!.sources.at(-1);
  assert.ok(receipt);
  assert.deepEqual(receipt.source.bankLegs, [{ payer: emperor.id, amount: 4 }]);
  assert.deepEqual(viewGame(paid, f.owner).spiceBankerIncome!.deferred, [{ owner: f.owner, amount: 1 }]);
  await restored(f, paid);
  const final = await finalCollectionStep(f, paid);
  const funds = player(final.game, f.owner).spice;
  const collected = await act(f, final.game, final.step.actor, final.step.action);
  assert.equal(collected.phase, 8);
  assert.equal(player(collected, f.owner).spice, funds + 1);
  assert.deepEqual(collected.spiceBankerIncome!.collections.at(-1)!.credits, [{ owner: f.owner, amount: 1 }]);
  assert.deepEqual(viewGame(collected, f.owner).spiceBankerIncome!.deferred, []);
  await Promise.all([f.restart().continueRoomAutomatic(f.code, clock), f.restart().continueRoomAutomatic(f.code, clock)]);
  assert.deepEqual(await f.restart().readRoom(f.code), collected);
  await rejected(f, collected, await authenticate(f, final.step.actor), final.step.action, final.game.version);
  await restored(f, collected);
});
