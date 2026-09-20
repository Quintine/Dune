import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { DatabaseSync } from 'node:sqlite';
import { baseDeck } from '../game/cards';
import { createGame, newPlayer } from '../game/engine';
import { unitStore } from './fixture-nexus-room-store';

const UUID = {
  entry: '10000000-0000-4000-8000-000000000001',
  recovery: '10000000-0000-4000-8000-000000000002',
  offer: '10000000-0000-4000-8000-000000000003',
  replacement: '10000000-0000-4000-8000-000000000004',
  claim: '10000000-0000-4000-8000-000000000005',
  rival: '10000000-0000-4000-8000-000000000006',
};
const secret = (pair: string) => pair.repeat(32);
const digest = (value: string) =>
  createHash('sha256').update(value).digest('hex');
const clock = (now: number) => ({ now: () => now });

async function fixture(
  withRecoveryRotation = false,
  migrationThrough?: string,
) {
  const store = unitStore(undefined, migrationThrough);
  const entry = {
    operationId: UUID.entry,
    sessionToken: secret('10'),
  };
  const created = await store.rooms.createRoom(
    'Original owner',
    'atreides',
    false,
    [],
    entry,
  );
  const code = created.view.code;
  let auth = await store.rooms.authenticate(code, created.token);
  const game = await store.rooms.readRoom(code);
  game.players[0].hand = [baseDeck()[0]];
  game.players[0].traitors = ['emperor-0'];
  store.sqlite
    .prepare('UPDATE rooms SET state = ? WHERE code = ?')
    .run(JSON.stringify(game), code);
  let view = await store.rooms.readSeatView(code, auth);
  const recoverySecret = secret('20');
  let recoveryInput:
    | {
        playerId: string;
        recoverySecret: string;
        operationId: string;
        newSessionToken: string;
      }
    | undefined;
  if (withRecoveryRotation) {
    view = (
      await store.rooms.setRecoveryKey(
        code,
        auth,
        view.version,
        recoverySecret,
      )
    ).view;
    recoveryInput = {
      playerId: created.view.me,
      recoverySecret,
      operationId: UUID.recovery,
      newSessionToken: secret('30'),
    };
    const recovered = await store.rooms.recoverSeat(code, recoveryInput);
    view = recovered.view;
    auth = await store.rooms.authenticate(code, recoveryInput.newSessionToken);
  }
  return {
    ...store,
    code,
    created,
    entry,
    auth,
    view,
    recoverySecret,
    recoveryInput,
  };
}

const offer = (id = UUID.offer, handoverSecret = secret('40')) => ({
  offerId: id,
  handoverSecret,
});
const claim = (
  playerId: string,
  operationId = UUID.claim,
  newSessionToken = secret('50'),
  handover = offer(),
) => ({
  playerId,
  ...handover,
  operationId,
  newSessionToken,
});

function custody(sqlite: DatabaseSync) {
  return JSON.stringify(
    [
      'rooms',
      'seats',
      'seat_recovery_keys',
      'seat_recovery_receipts',
      'room_entry_receipts',
      'seat_handover_offers',
      'seat_handover_claim_receipts',
    ].map((table) =>
      sqlite.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all(),
    ),
  );
}

function batchBarrier(hooks: { beforeBatch?: () => Promise<void> }) {
  let entered!: () => void;
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  hooks.beforeBatch = async () => {
    delete hooks.beforeBatch;
    entered();
    await gate;
  };
  return { waiting, release };
}

void test('voluntary claim preserves exact game state and private seat while revoking every old authority', async () => {
  const f = await fixture(true);
  try {
    const handover = offer();
    const created = await f.rooms.createSeatHandover(
      f.code,
      f.auth,
      f.view.version,
      handover,
      clock(1000),
    );
    assert.equal(created.expiresAt, 1000 + f.rooms.SEAT_HANDOVER_TTL_MS);
    assert.equal(created.replayed, false);
    const state = f.sqlite
      .prepare('SELECT state FROM rooms WHERE code = ?')
      .get(f.code)!.state;
    const body = claim(f.created.view.me);
    const transferred = await f.rooms.claimSeatHandover(
      f.code,
      body,
      clock(2000),
    );
    assert.equal(transferred.transferred, true);
    assert.equal(transferred.replayed, false);
    assert.equal(transferred.view.me, f.created.view.me);
    assert.equal(transferred.view.players[0].faction, 'atreides');
    assert.equal(transferred.view.players[0].hand![0].id, baseDeck()[0].id);
    assert.equal(
      f.sqlite.prepare('SELECT state FROM rooms WHERE code = ?').get(f.code)!
        .state,
      state,
    );
    await assert.rejects(f.rooms.readSeatView(f.code, f.auth), /verified/);
    await assert.rejects(
      f.rooms.recoverSeat(f.code, f.recoveryInput!),
      /could not be verified|no longer active/,
    );
    await assert.rejects(
      f.rooms.createRoom(
        'Original owner',
        'atreides',
        false,
        [],
        f.entry,
      ),
      /no longer active/,
    );
    assert.equal(
      f.sqlite.prepare('SELECT count(*) AS n FROM seat_recovery_keys').get()!
        .n,
      0,
    );
    assert.equal(
      f.sqlite
        .prepare('SELECT count(*) AS n FROM seat_recovery_receipts')
        .get()!.n,
      0,
    );
    const recipientAuth = await f.rooms.authenticate(
      f.code,
      body.newSessionToken,
    );
    const acted = await f.rooms.act(
      f.code,
      recipientAuth,
      transferred.view.version,
      { type: 'ready' },
    );
    assert.equal(acted.players[0].ready, true);
    const restarted = f.restart();
    const replay = await restarted.claimSeatHandover(
      f.code,
      body,
      clock(1000 + f.rooms.SEAT_HANDOVER_TTL_MS + 1),
    );
    assert.equal(replay.replayed, true);
    assert.equal(replay.token, body.newSessionToken);
    assert.equal(replay.view.version, acted.version);
  } finally {
    f.sqlite.close();
  }
});

void test('recovering the issuer invalidates its still-unclaimed handover offer', async () => {
  const f = await fixture();
  try {
    const recoverySecret = secret('21');
    const saved = await f.rooms.setRecoveryKey(
      f.code,
      f.auth,
      f.view.version,
      recoverySecret,
    );
    const handover = offer();
    const offered = await f.rooms.createSeatHandover(
      f.code,
      f.auth,
      saved.view.version,
      handover,
      clock(1000),
    );
    const recovery = {
      playerId: f.created.view.me,
      recoverySecret,
      operationId: UUID.recovery,
      newSessionToken: secret('31'),
    };
    const recovered = await f.rooms.recoverSeat(f.code, recovery);
    await assert.rejects(
      f.rooms.claimSeatHandover(
        f.code,
        claim(f.created.view.me),
        clock(2000),
      ),
      /could not be verified/,
    );
    const newAuth = await f.rooms.authenticate(
      f.code,
      recovery.newSessionToken,
    );
    assert.deepEqual(
      await f.rooms.readSeatView(f.code, newAuth),
      recovered.view,
    );
    assert.equal(
      (await f.rooms.readRoom(f.code)).version,
      offered.view.version + 1,
    );
  } finally {
    f.sqlite.close();
  }
});

void test('claim invalidates the issuer entry receipt that still controlled the seat', async () => {
  const f = await fixture();
  try {
    const offered = await f.rooms.createSeatHandover(
      f.code,
      f.auth,
      f.view.version,
      offer(),
      clock(1000),
    );
    await f.rooms.claimSeatHandover(
      f.code,
      claim(f.created.view.me),
      clock(2000),
    );
    await assert.rejects(
      f.rooms.createRoom(
        'Original owner',
        'atreides',
        false,
        [],
        f.entry,
      ),
      /no longer active/,
    );
    assert.equal(
      (await f.rooms.readRoom(f.code)).version,
      offered.view.version + 1,
    );
  } finally {
    f.sqlite.close();
  }
});

void test('0005 backfills an active 0004 claim for exact replay after upgrade', async () => {
  const f = unitStore(undefined, '0004_flippant_archangel.sql');
  try {
    const code = 'LEGACY05';
    const playerId = UUID.rival;
    const oldSessionHash = digest(secret('10'));
    const handover = offer();
    const body = claim(playerId);
    const game = createGame(
      code,
      newPlayer(playerId, 'Original owner', 'atreides'),
      false,
      [],
    );
    game.players[0].hand = [baseDeck()[0]];
    game.players[0].traitors = ['emperor-0'];
    f.sqlite
      .prepare(
        'INSERT INTO rooms(code,state,version,updated_at) VALUES(?,?,1,?)',
      )
      .run(code, JSON.stringify(game), 1000);
    f.sqlite
      .prepare(
        'INSERT INTO seats(token_hash,room_code,player_id) VALUES(?,?,?)',
      )
      .run(oldSessionHash, code, playerId);
    f.sqlite
      .prepare(
        'INSERT INTO seat_handover_offers(room_code,player_id,offer_hash,secret_hash,issuer_session_hash,expires_at,claim_operation_hash,session_hash,claimed_at) VALUES(?,?,?,?,?,?,NULL,NULL,NULL)',
      )
      .run(
        code,
        playerId,
        digest(handover.offerId),
        digest(handover.handoverSecret),
        oldSessionHash,
        301000,
      );
    const operationHash = digest(body.operationId);
    const sessionHash = digest(body.newSessionToken);
    f.sqlite.exec('BEGIN');
    try {
      f.sqlite
        .prepare(
          'UPDATE rooms SET version = version + 1, updated_at = ? WHERE code = ? AND version = ?',
        )
        .run(2000, code, 1);
      f.sqlite
        .prepare(
          'UPDATE seat_handover_offers SET claim_operation_hash = ?, session_hash = ?, claimed_at = ? WHERE room_code = ? AND player_id = ?',
        )
        .run(operationHash, sessionHash, 2000, code, playerId);
      f.sqlite
        .prepare(
          'UPDATE seats SET revoked = 1 WHERE room_code = ? AND player_id = ? AND revoked = 0',
        )
        .run(code, playerId);
      f.sqlite
        .prepare(
          'INSERT INTO seats(token_hash,room_code,player_id) VALUES (?,?,?)',
        )
        .run(sessionHash, code, playerId);
      f.sqlite.exec('COMMIT');
    } catch (error) {
      f.sqlite.exec('ROLLBACK');
      throw error;
    }
    const stateBeforeUpgrade = f.sqlite
      .prepare('SELECT state FROM rooms WHERE code = ?')
      .get(code)!.state;
    f.sqlite.exec(
      readFileSync(
        new URL('../drizzle/0005_salty_alice.sql', import.meta.url),
        'utf8',
      ),
    );
    const receipt = f.sqlite
      .prepare(
        'SELECT operation_hash,session_hash,claim_fence FROM seat_handover_claim_receipts WHERE room_code = ? AND player_id = ?',
      )
      .get(code, playerId)!;
    assert.equal(receipt.operation_hash, operationHash);
    assert.equal(receipt.session_hash, sessionHash);
    assert.match(receipt.claim_fence as string, /^legacy:/);
    assert.equal(
      (receipt.claim_fence as string).includes(body.newSessionToken),
      false,
    );
    f.sqlite.exec(
      readFileSync(
        new URL('../drizzle/0006_thick_imperial_guard.sql', import.meta.url),
        'utf8',
      ),
    );
    const replay = await f.restart().claimSeatHandover(code, body, clock(3000));
    assert.equal(replay.replayed, true);
    assert.equal(replay.token, body.newSessionToken);
    assert.equal(replay.view.me, playerId);
    assert.equal(replay.view.players[0].hand![0].id, baseDeck()[0].id);
    assert.equal(
      f.sqlite.prepare('SELECT state FROM rooms WHERE code = ?').get(code)!
        .state,
      stateBeforeUpgrade,
    );
  } finally {
    f.sqlite.close();
  }
});

void test('exact claim replay survives a later offer created by the recipient', async () => {
  const f = await fixture();
  try {
    const body = claim(f.created.view.me);
    const offered = await f.rooms.createSeatHandover(
      f.code,
      f.auth,
      f.view.version,
      offer(),
      clock(1000),
    );
    const transferred = await f.rooms.claimSeatHandover(
      f.code,
      body,
      clock(2000),
    );
    const recipientAuth = await f.rooms.authenticate(
      f.code,
      body.newSessionToken,
    );
    const later = await f.rooms.createSeatHandover(
      f.code,
      recipientAuth,
      transferred.view.version,
      offer(UUID.replacement, secret('41')),
      clock(3000),
    );
    const replay = await f.rooms.claimSeatHandover(
      f.code,
      body,
      clock(4000),
    );
    assert.equal(replay.replayed, true);
    assert.equal(replay.token, body.newSessionToken);
    assert.equal(replay.view.version, later.view.version);
    assert.equal(offered.view.version + 2, later.view.version);
  } finally {
    f.sqlite.close();
  }
});

void test('losing exact claim cannot erase recovery configured after the winner', async () => {
  const f = await fixture();
  try {
    const body = claim(f.created.view.me);
    await f.rooms.createSeatHandover(
      f.code,
      f.auth,
      f.view.version,
      offer(),
      clock(1000),
    );
    const barrier = batchBarrier(f.hooks);
    const loser = f.rooms.claimSeatHandover(f.code, body, clock(2000));
    await barrier.waiting;
    const winner = await f.rooms.claimSeatHandover(
      f.code,
      body,
      clock(2000),
    );
    const recipientAuth = await f.rooms.authenticate(
      f.code,
      body.newSessionToken,
    );
    const recoverySecret = secret('22');
    const configured = await f.rooms.setRecoveryKey(
      f.code,
      recipientAuth,
      winner.view.version,
      recoverySecret,
    );
    barrier.release();
    const replay = await loser;
    assert.equal(replay.replayed, true);
    assert.equal(replay.view.version, configured.view.version);
    assert.equal(
      f.sqlite.prepare('SELECT count(*) AS n FROM seat_recovery_keys').get()!
        .n,
      1,
    );
    const recovered = await f.rooms.recoverSeat(f.code, {
      playerId: f.created.view.me,
      recoverySecret,
      operationId: UUID.recovery,
      newSessionToken: secret('32'),
    });
    assert.equal(recovered.recovered, true);
  } finally {
    f.sqlite.close();
  }
});

void test('a concurrent game action wins cleanly over a paused claim', async () => {
  const f = await fixture();
  try {
    const offered = await f.rooms.createSeatHandover(
      f.code,
      f.auth,
      f.view.version,
      offer(),
      clock(1000),
    );
    const barrier = batchBarrier(f.hooks);
    const pending = f.rooms.claimSeatHandover(
      f.code,
      claim(f.created.view.me),
      clock(2000),
    );
    await barrier.waiting;
    const acted = await f.rooms.act(f.code, f.auth, offered.view.version, {
      type: 'ready',
    });
    barrier.release();
    await assert.rejects(pending, /changed/);
    assert.equal(acted.players[0].ready, true);
    await f.rooms.readSeatView(f.code, f.auth);
    assert.equal(
      f.sqlite
        .prepare('SELECT count(*) AS n FROM seat_handover_claim_receipts')
        .get()!.n,
      0,
    );
  } finally {
    f.sqlite.close();
  }
});

void test('issuer recovery wins cleanly over a paused claim', async () => {
  const f = await fixture();
  try {
    const recoverySecret = secret('23');
    const saved = await f.rooms.setRecoveryKey(
      f.code,
      f.auth,
      f.view.version,
      recoverySecret,
    );
    await f.rooms.createSeatHandover(
      f.code,
      f.auth,
      saved.view.version,
      offer(),
      clock(1000),
    );
    const barrier = batchBarrier(f.hooks);
    const pending = f.rooms.claimSeatHandover(
      f.code,
      claim(f.created.view.me),
      clock(2000),
    );
    await barrier.waiting;
    const recovery = {
      playerId: f.created.view.me,
      recoverySecret,
      operationId: UUID.recovery,
      newSessionToken: secret('33'),
    };
    const recovered = await f.rooms.recoverSeat(f.code, recovery);
    barrier.release();
    await assert.rejects(pending, /changed/);
    const recoveredAuth = await f.rooms.authenticate(
      f.code,
      recovery.newSessionToken,
    );
    assert.deepEqual(
      await f.rooms.readSeatView(f.code, recoveredAuth),
      recovered.view,
    );
    assert.equal(
      f.sqlite
        .prepare('SELECT count(*) AS n FROM seat_handover_claim_receipts')
        .get()!.n,
      0,
    );
  } finally {
    f.sqlite.close();
  }
});

void test('owner revocation wins cleanly over a paused claim', async () => {
  const f = await fixture();
  try {
    const offered = await f.rooms.createSeatHandover(
      f.code,
      f.auth,
      f.view.version,
      offer(),
      clock(1000),
    );
    const barrier = batchBarrier(f.hooks);
    const pending = f.rooms.claimSeatHandover(
      f.code,
      claim(f.created.view.me),
      clock(2000),
    );
    await barrier.waiting;
    const revoked = await f.rooms.revokeSeatHandover(
      f.code,
      f.auth,
      offered.view.version,
      UUID.offer,
      clock(2000),
    );
    barrier.release();
    await assert.rejects(pending, /changed/);
    assert.equal(revoked.revoked, true);
    await f.rooms.readSeatView(f.code, f.auth);
    assert.equal(
      f.sqlite
        .prepare('SELECT count(*) AS n FROM seat_handover_claim_receipts')
        .get()!.n,
      0,
    );
  } finally {
    f.sqlite.close();
  }
});

void test('exact concurrent claims replay one rotation while different claims have one winner', async () => {
  for (const same of [true, false]) {
    const f = await fixture();
    try {
      const offered = await f.rooms.createSeatHandover(
        f.code,
        f.auth,
        f.view.version,
        offer(),
        clock(1000),
      );
      const first = claim(f.created.view.me);
      const second = same
        ? first
        : claim(f.created.view.me, UUID.rival, secret('60'));
      const results = await Promise.allSettled([
        f.rooms.claimSeatHandover(f.code, first, clock(2000)),
        f.rooms.claimSeatHandover(f.code, second, clock(2000)),
      ]);
      assert.equal(
        results.filter((result) => result.status === 'fulfilled').length,
        same ? 2 : 1,
      );
      assert.equal(
        (await f.rooms.readRoom(f.code)).version,
        offered.view.version + 1,
      );
      assert.equal(
        f.sqlite
          .prepare('SELECT count(*) AS n FROM seats WHERE revoked = 0')
          .get()!.n,
        1,
      );
      if (same)
        assert.ok(
          results.every(
            (result) =>
              result.status === 'fulfilled' &&
              result.value.token === first.newSessionToken,
          ),
        );
      else
        await assert.rejects(
          f.rooms.claimSeatHandover(f.code, second, clock(2000)),
          /already been claimed/,
        );
    } finally {
      f.sqlite.close();
    }
  }
});

void test('offer replacement, revocation and expiry are version-fenced and retry safe', async () => {
  const f = await fixture();
  try {
    const first = await f.rooms.createSeatHandover(
      f.code,
      f.auth,
      f.view.version,
      offer(),
      clock(1000),
    );
    const replay = await f.rooms.createSeatHandover(
      f.code,
      f.auth,
      f.view.version,
      offer(),
      clock(1001),
    );
    assert.equal(replay.replayed, true);
    assert.equal(replay.view.version, first.view.version);
    const replacement = offer(UUID.replacement, secret('41'));
    const replaced = await f.rooms.createSeatHandover(
      f.code,
      f.auth,
      first.view.version,
      replacement,
      clock(2000),
    );
    await assert.rejects(
      f.rooms.claimSeatHandover(
        f.code,
        claim(f.created.view.me),
        clock(3000),
      ),
      /could not be verified/,
    );
    await assert.rejects(
      f.rooms.revokeSeatHandover(
        f.code,
        f.auth,
        replaced.view.version,
        UUID.offer,
      ),
      /different handover offer/,
    );
    const revoked = await f.rooms.revokeSeatHandover(
      f.code,
      f.auth,
      replaced.view.version,
      UUID.replacement,
      clock(3000),
    );
    assert.equal(revoked.replayed, false);
    const retried = await f.rooms.revokeSeatHandover(
      f.code,
      f.auth,
      replaced.view.version,
      UUID.replacement,
      clock(3001),
    );
    assert.equal(retried.replayed, true);

    const expiring = await f.rooms.createSeatHandover(
      f.code,
      f.auth,
      retried.view.version,
      offer(),
      clock(4000),
    );
    await assert.rejects(
      f.rooms.claimSeatHandover(
        f.code,
        claim(f.created.view.me),
        clock(expiring.expiresAt),
      ),
      /expired/,
    );
  } finally {
    f.sqlite.close();
  }
});

void test('failed recipient credential insertion rolls back claim custody atomically', async () => {
  const f = await fixture(true);
  try {
    await f.rooms.createSeatHandover(
      f.code,
      f.auth,
      f.view.version,
      offer(),
      clock(1000),
    );
    const before = custody(f.sqlite);
    f.sqlite.exec(
      "CREATE TRIGGER reject_handover_session BEFORE INSERT ON seats BEGIN SELECT RAISE(ABORT, 'injected handover insertion failure'); END;",
    );
    await assert.rejects(
      f.rooms.claimSeatHandover(
        f.code,
        claim(f.created.view.me),
        clock(2000),
      ),
      /injected handover insertion failure/,
    );
    assert.equal(custody(f.sqlite), before);
    await f.rooms.readSeatView(f.code, f.auth);
    f.sqlite.exec('DROP TRIGGER reject_handover_session');
    const done = await f.rooms.claimSeatHandover(
      f.code,
      claim(f.created.view.me),
      clock(2000),
    );
    assert.equal(done.transferred, true);
  } finally {
    f.sqlite.close();
  }
});
