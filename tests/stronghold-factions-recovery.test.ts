import assert from 'node:assert/strict';
import test from 'node:test';
import type { DatabaseSync, SQLOutputValue } from 'node:sqlite';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { treacheryDeck } from '../game/cards';
import type { RoomsClock, SeatAuth } from '../db/rooms';
import type * as Rooms from '../db/rooms';
import { startPrototypeRoom } from '../tools/prototype-room';
import { unitStore } from './fixture-nexus-room-store';
import {
  createStrongholdFactionsFixture,
  nextStrongholdFactionsNativeStep,
  quoteStrongholdFactionsBattle,
  type StrongholdFactionsFixture,
  type StrongholdFactionsFixtureOptions as Options,
} from './fixture-stronghold-factions';

const clock: RoomsClock = { now: () => 10000, sleep: async () => {} };
type SqlRow = Record<string, SQLOutputValue>;
interface ProtectedRows {
  seats: SqlRow[];
  entries: SqlRow[];
  keys: SqlRow[];
  receipts: SqlRow[];
}
interface Fixture extends StrongholdFactionsFixture {
  sqlite: DatabaseSync;
  restart(): typeof Rooms;
  hooks: { beforeWrite?: () => Promise<void> };
  code: string;
  tokens: string[];
  auths: SeatAuth[];
  save(game: Game): void;
  admitted: Game;
  unrelated: SqlRow | undefined;
  other: { view: { code: string } };
  credentials: ProtectedRows;
}

function protectedRows(sqlite: DatabaseSync) {
  return {
    seats: sqlite.prepare('SELECT * FROM seats ORDER BY room_code,player_id,token_hash').all(),
    entries: sqlite.prepare('SELECT * FROM room_entry_receipts ORDER BY room_code,player_id,operation_hash').all(),
    keys: sqlite.prepare('SELECT * FROM seat_recovery_keys ORDER BY room_code,player_id').all(),
    receipts: sqlite.prepare('SELECT * FROM seat_recovery_receipts ORDER BY room_code,player_id,operation_hash').all(),
  };
}

function census(game: Game) {
  const cards = [...game.deck, ...game.discard, ...game.players.flatMap(p => p.hand),
    ...(game.ixSetupCards ?? []), ...(game.ixAuction?.cards ?? []),
    ...(game.auction?.cards.slice(game.auction.index + Number(game.currentAuctionSale?.origin === 'normal')) ?? [])];
  assert.deepEqual(cards.map(card => card.id).sort(), treacheryDeck(['ix', 'choam']).map(card => card.id).sort());
  assert.equal(new Set(cards.map(card => card.id)).size, 47);
  for (const player of game.players) {
    assert.equal(player.reserves + player.tanks + Object.values(player.forces).reduce((sum, amount) => sum + amount, 0), 20);
    if (player.faction === 'ixians') {
      assert.ok(player.elites);
      assert.equal(player.elites.reserves + player.elites.tanks + Object.values(player.elites.forces).reduce((sum, amount) => sum + amount, 0), 7);
    }
  }
}

async function fixture(t: test.TestContext, options: Options = {}): Promise<Fixture> {
  const store = unitStore();
  t.after(() => store.sqlite.close());
  const created = await store.rooms.createRoom('Native Ix custody', 'ixians', true, ['ix', 'choam']);
  const code = created.view.code;
  const tokens = [created.token];
  for (const faction of ['choam', 'atreides'] as const) {
    const joined = await store.rooms.joinRoom(code, faction, faction);
    assert.ok(joined.token);
    tokens.push(joined.token);
  }
  const auths = await Promise.all(tokens.map(token => store.rooms.authenticate(code, token)));
  for (const auth of auths) {
    const lobby = await store.restart().readRoom(code);
    await store.restart().act(code, auth, lobby.version, { type: 'ready' }, clock);
  }
  const lobby = await store.restart().readRoom(code);
  startPrototypeRoom(store.sqlite, code, lobby.version, 'stronghold-factions');
  const admitted = await store.restart().readRoom(code);
  const native = createStrongholdFactionsFixture({ ...options, initial: admitted });
  assert.deepEqual(native.initial, admitted, 'fixture consumes the exact original CLI-admitted setup without redealing');
  assert.deepEqual(native.afterSetup.playerPositions, admitted.playerPositions);
  assert.deepEqual(native.afterSetup.players.map(p => [p.id, p.name, p.faction]), admitted.players.map(p => [p.id, p.name, p.faction]));
  census(admitted);
  census(native.game);
  const other = await store.rooms.createRoom('Unrelated retained room', 'guild', false, []);
  const unrelated = store.sqlite.prepare('SELECT * FROM rooms WHERE code=?').get(other.view.code);
  const credentials = protectedRows(store.sqlite);
  const save = (game: Game) => {
    assert.equal(game.code, code);
    assert.equal(store.sqlite.prepare('UPDATE rooms SET state=?,version=? WHERE code=?')
      .run(JSON.stringify(game), game.version, code).changes, 1);
  };
  save(native.beforeFirstMentat);
  return { ...store, ...native, code, tokens, auths, save, admitted, unrelated, other, credentials };
}

async function authenticated(f: Fixture, actor: string) {
  const index = f.auths.findIndex(auth => auth.playerId === actor);
  assert.ok(index >= 0, 'native action belongs to an original credential');
  const auth = await f.restart().authenticate(f.code, f.tokens[index]);
  assert.equal(auth.playerId, actor);
  assert.equal(auth.tokenHash, f.auths[index].tokenHash);
  return auth;
}

async function act(f: Fixture, game: Game, actor: string, action: Action) {
  await f.restart().act(f.code, await authenticated(f, actor), game.version, action, clock);
  const after = await f.restart().readRoom(f.code);
  census(after);
  assert.deepEqual(f.sqlite.prepare('SELECT * FROM rooms WHERE code=?').get(f.other.view.code), f.unrelated);
  return after;
}

async function rejected(f: Fixture, actor: string, action: Action, version?: number) {
  const before = await f.restart().readRoom(f.code);
  const rows = f.sqlite.prepare('SELECT * FROM rooms ORDER BY code').all();
  const credentials = protectedRows(f.sqlite);
  await assert.rejects(f.restart().act(f.code, await authenticated(f, actor), version ?? before.version, action, clock));
  assert.deepEqual(await f.restart().readRoom(f.code), before);
  assert.deepEqual(f.sqlite.prepare('SELECT * FROM rooms ORDER BY code').all(), rows);
  assert.deepEqual(protectedRows(f.sqlite), credentials);
}

async function race(f: Fixture, game: Game, actor: string, actions: [Action, Action]) {
  const auth = await authenticated(f, actor);
  let release!: () => void;
  let arrivals = 0;
  const barrier = new Promise<void>(resolve => { release = resolve; });
  f.hooks.beforeWrite = async () => {
    if (++arrivals === 2) release();
    await barrier;
  };
  try {
    const results = await Promise.allSettled(actions.map(action => f.restart().act(f.code, auth, game.version, action, clock)));
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(results.filter(result => result.status === 'rejected').length, 1);
    const after = await f.restart().readRoom(f.code);
    assert.equal(after.version, game.version + 1);
    census(after);
    return after;
  } finally {
    f.hooks.beforeWrite = undefined;
  }
}

async function drive(f: Fixture, game: Game, stop: (game: Game) => boolean) {
  for (let count = 0; count < 250; count++) {
    if (stop(game)) return game;
    const next = game.decision?.kind === 'choamBattleFunding' && f.fundingAction
      ? f.fundingAction
      : nextStrongholdFactionsNativeStep(game);
    assert.ok(next, 'real native continuation reaches the requested boundary');
    game = await act(f, game, next.actor, next.action);
  }
  throw new Error('Native suffix did not reach its boundary');
}

async function openBattle(f: Fixture) {
  f.save(f.beforeBattle);
  let game = await f.restart().readRoom(f.code);
  game = await act(f, game, f.actor, f.battleAction);
  return drive(f, game, g => g.decision?.kind === 'strongholdCopy' || nextStrongholdFactionsNativeStep(g) === null);
}

async function privateViews(f: Fixture, game: Game) {
  for (const auth of f.auths) {
    const view = await f.restart().readSeatView(f.code, await authenticated(f, auth.playerId));
    assert.deepEqual(view, viewGame(game, auth.playerId));
    assert.deepEqual(view.strongholdCards, game.strongholdCards);
    assert.equal('deck' in view, false);
    for (const player of view.players)
      if (player.id !== auth.playerId) assert.equal(player.hand, undefined);
    if (game.battle && !game.battle.revealed) {
      assert.deepEqual(view.battle!.cards, []);
      assert.deepEqual(view.battle!.plans, game.battle.plans[auth.playerId] ? { [auth.playerId]: game.battle.plans[auth.playerId] } : {});
    }
  }
}

void test('authenticated native END Mentat first claims custody once under duplicate CAS and retains the original seats and 47-card inventory', async t => {
  const f = await fixture(t);
  const before = await f.restart().readRoom(f.code);
  assert.deepEqual(before.strongholdCards, f.admitted.strongholdCards);
  assert.equal(before.strongholdCards!.claimedTurn, 0);
  assert.ok(Object.values(before.strongholdCards!.owners).every(owner => owner === null));
  const { actor, action } = f.firstMentatStep;
  const after = await race(f, before, actor, [action, action]);
  assert.deepEqual(after.strongholdCards, f.afterFirstMentat.strongholdCards);
  assert.equal(after.strongholdCards!.claimedTurn, before.turn);
  assert.equal(after.strongholdCards!.owners.hidden_mobile_stronghold, f.owner);
  assert.deepEqual(protectedRows(f.sqlite), f.credentials);
  await rejected(f, actor, action, before.version);
  await privateViews(f, after);
  f.save(f.beforeBattle);
  assert.deepEqual(f.beforeBattle.strongholdCards, after.strongholdCards, 'custody is retained next turn, not reassigned from current battle control');
  await privateViews(f, await f.restart().readRoom(f.code));
});

void test('actual native HMS copy and sealed plans survive restart and credential recovery; foreign, stale and competing choices are immutable', async t => {
  const f = await fixture(t, { ownerDial: 6, support: 3, opponentDial: 1.5, copy: 'arrakeen' });
  const pending = await openBattle(f);
  assert.equal(pending.decision?.kind, 'strongholdCopy');
  assert.ok(f.copyAction);
  const copyAction = { ...f.copyAction, event: pending.battle!.event };
  if (pending.decision?.kind !== 'strongholdCopy' || f.game.decision?.kind !== 'strongholdCopy')
    throw new Error('Native HMS copy choice missing');
  assert.deepEqual(pending.decision.choices, f.game.decision.choices);
  assert.equal(pending.decision.player, f.owner);
  await f.restart().continueRoomAutomatic(f.code, clock);
  assert.deepEqual(await f.restart().readRoom(f.code), pending);
  await privateViews(f, pending);
  await rejected(f, f.opponent, copyAction);
  await rejected(f, f.owner, { ...copyAction, event: 'foreign-stale-event' });
  await rejected(f, f.owner, { ...copyAction, stronghold: 'carthag' });
  await rejected(f, f.owner, { ...copyAction, stronghold: 17 });
  await rejected(f, f.opponent, f.planActions[1].action);
  const recoverySecret = 'a'.repeat(64), newSessionToken = 'b'.repeat(64);
  const index = f.auths.findIndex(auth => auth.playerId === f.owner);
  await f.restart().setRecoveryKey(f.code, f.auths[index], pending.version, recoverySecret);
  const secured = await f.restart().readRoom(f.code);
  await f.restart().recoverSeat(f.code, {
    playerId: f.owner, recoverySecret,
    operationId: 'ac61a3f0-8dbe-4b15-9f27-a1d55329249c', newSessionToken,
  });
  await assert.rejects(f.restart().authenticate(f.code, f.tokens[index]));
  f.tokens[index] = newSessionToken;
  f.auths[index] = await f.restart().authenticate(f.code, newSessionToken);
  const recovered = await f.restart().readRoom(f.code);
  assert.equal(recovered.version, secured.version + 1);
  assert.deepEqual(recovered.decision, pending.decision);
  assert.deepEqual(recovered.players, pending.players);
  assert.deepEqual(recovered.battle, pending.battle);
  assert.deepEqual(recovered.strongholdCards, pending.strongholdCards);
  const chosen = await race(f, recovered, f.owner, [copyAction, { ...copyAction, stronghold: 'sietch_tabr' }]);
  assert.ok(['arrakeen', 'sietch_tabr'].includes(chosen.battle!.strongholdCopy!));
  assert.deepEqual(chosen.strongholdCards, pending.strongholdCards);
  await rejected(f, f.owner, copyAction, recovered.version);
  let ready = await drive(f, chosen, g => nextStrongholdFactionsNativeStep(g) === null);
  const first = f.planActions[0];
  ready = await act(f, ready, first.actor, first.action);
  assert.equal(ready.battle!.revealed, false);
  await privateViews(f, ready);
  await f.restart().continueRoomAutomatic(f.code, clock);
  assert.deepEqual(await f.restart().readRoom(f.code), ready);
});

for (const funding of [0, 1]) {
void test(`actual native support with ${funding} CHOAM donor spice, income, casualties, Collection and final Mentat settle once after restart and duplicate resolution`, async t => {
  const f = await fixture(t, { ownerDial: 6, support: 3, opponentDial: 1.5, copy: 'arrakeen', counter: true, choamFunding: funding, allyPayment: funding });
  let game = await openBattle(f);
  assert.ok(f.copyAction);
  game = await act(f, game, f.owner, { ...f.copyAction, event: game.battle!.event });
  game = await drive(f, game, g => nextStrongholdFactionsNativeStep(g) === null);
  for (const plan of f.planActions) game = await act(f, game, plan.actor, plan.action);
  assert.equal(game.battle!.revealed, true);
  const quote = quoteStrongholdFactionsBattle(game);
  const wallets = Object.fromEntries(game.players.map(player => [player.id, player.spice]));
  const winnerTanks = game.players.find(player => player.id === f.owner)!.tanks;
  const winnerEliteTanks = game.players.find(player => player.id === f.owner)!.elites!.tanks;
  const payment = quote.payments.find(leg => leg.player === f.owner)!;
  assert.equal(payment.bankSupport, 2);
  assert.equal(payment.cost, 1);
  assert.equal(payment.ownPayment, 1 - funding);
  assert.equal(payment.allyPayment, funding);
  assert.equal(payment.donor, funding ? f.choam : null);
  assert.equal(quote.choamIncome!.owner, f.choam);
  assert.equal(quote.choamIncome!.amount, 1);
  const custody = structuredClone(game.strongholdCards);
  // Resolve only native response/traitor actions, racing the actual final action
  // that retires this battle rather than inserting a fabricated aftermath frame.
  for (let count = 0; count < 100 && game.battle; count++) {
    const next = nextStrongholdFactionsNativeStep(game);
    assert.ok(next);
    const predicted = applyAction(game, next.actor, next.action);
    game = predicted.battle === null
      ? await race(f, game, next.actor, [next.action, next.action])
      : await act(f, game, next.actor, next.action);
  }
  assert.equal(game.battle, null);
  assert.deepEqual(game.strongholdCards, custody);
  for (const leg of quote.payments) wallets[leg.player] -= leg.ownPayment;
  if (quote.bounty) wallets[quote.bounty.player] += quote.bounty.amount;
  for (const income of quote.strongholdIncome) wallets[income.player] += income.amount;
  game = await drive(f, game, g => g.response?.kind === 'choamBattleIncome');
  assert.deepEqual(game.pendingChoamBattleIncome, quote.choamIncome);
  assert.deepEqual(Object.fromEntries(game.players.map(player => [player.id, player.spice])), wallets,
    'native bank support is not wallet cash and CHOAM income is still deferred');
  await f.restart().continueRoomAutomatic(f.code, clock);
  assert.deepEqual(await f.restart().readRoom(f.code), game);
  await privateViews(f, game);
  // Pass the actual counter suffix; only its final eligible response transfers
  // the original native receipt, and concurrent submissions cannot pay twice.
  for (let count = 0; count < 20 && game.response?.kind === 'choamBattleIncome'; count++) {
    const next = nextStrongholdFactionsNativeStep(game);
    assert.ok(next);
    const predicted = applyAction(game, next.actor, next.action);
    game = predicted.pendingChoamBattleIncome === null
      ? await race(f, game, next.actor, [next.action, next.action])
      : await act(f, game, next.actor, next.action);
  }
  assert.equal(game.pendingChoamBattleIncome, null);
  wallets[f.choam] += quote.choamIncome!.amount;
  assert.deepEqual(Object.fromEntries(game.players.map(player => [player.id, player.spice])), wallets);
  game = await drive(f, game, g => g.phase === 8 && !g.response && !g.decision);
  assert.ok(quote.casualties);
  const losses = quote.casualties.options[0];
  const winner = game.players.find(player => player.id === f.owner)!;
  assert.equal(winner.tanks, winnerTanks + losses.normal + losses.elite);
  assert.equal(winner.elites!.tanks, winnerEliteTanks + losses.elite);
  const turn = game.turn;
  for (let count = 0; count < 30 && game.turn === turn && game.status === 'playing'; count++) {
    const next = nextStrongholdFactionsNativeStep(game);
    assert.ok(next);
    const predicted = applyAction(game, next.actor, next.action);
    if (predicted.turn !== turn || predicted.status !== 'playing') {
      const before = game;
      game = await race(f, before, next.actor, [next.action, next.action]);
      await rejected(f, next.actor, next.action, before.version);
    } else game = await act(f, game, next.actor, next.action);
  }
  assert.ok(game.turn === turn + 1 || game.status === 'finished');
  const settled = game;
  await privateViews(f, settled);
  await f.restart().continueRoomAutomatic(f.code, clock);
  assert.deepEqual(await f.restart().readRoom(f.code), settled);
  assert.deepEqual(protectedRows(f.sqlite), f.credentials);
});
}

void test('actual native Auditor payment retains source, original full price and private projection through reload and a competing payment race', async t => {
  const f = await fixture(t, { kind: 'carthag', ownerFaction: 'choam', ownerLeader: 'auditor', opponentWeapon: 'worthless', ownerDial: 3, support: 3, opponentDial: 1.5, counter: true });
  let game = await openBattle(f);
  game = await drive(f, game, g => nextStrongholdFactionsNativeStep(g) === null);
  for (const plan of f.planActions) game = await act(f, game, plan.actor, plan.action);
  game = await drive(f, game, g => g.decision?.kind === 'choamAudit');
  const event = game.pendingAuditor!.event;
  game = await act(f, game, f.choam, { type: 'decision', event, audit: true });
  game = await drive(f, game, g => g.decision?.kind === 'choamAuditPayment');
  const pending = game.pendingAuditor!;
  assert.equal(pending.stage, 'payment');
  const payer = game.players.find(player => player.id === pending.opponent)!;
  const count = viewGame(game, pending.opponent).auditor!.count;
  assert.ok(count > 0);
  const payment: Action = { type: 'decision', event, pay: true, count };
  await f.restart().continueRoomAutomatic(f.code, clock);
  assert.deepEqual(await f.restart().readRoom(f.code), game);
  await privateViews(f, game);
  await rejected(f, f.choam, payment);
  await rejected(f, pending.opponent, { ...payment, event: 'stale-audit' });
  await rejected(f, pending.opponent, { ...payment, count: count + 1 });
  const before = game;
  const after = await race(f, before, pending.opponent, [payment, payment]);
  assert.equal(after.pendingAuditor, null);
  assert.equal(after.players.find(player => player.id === pending.opponent)!.spice, payer.spice - count);
  assert.equal(after.players.find(player => player.id === f.choam)!.spice,
    before.players.find(player => player.id === f.choam)!.spice + count);
  assert.deepEqual(after.strongholdCards, before.strongholdCards);
  await rejected(f, pending.opponent, payment, before.version);
  await privateViews(f, after);
  assert.deepEqual(protectedRows(f.sqlite), f.credentials);
});
