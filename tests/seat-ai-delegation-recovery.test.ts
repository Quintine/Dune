import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import type { Game } from '../game/engine';
import { unitStore } from './fixture-nexus-room-store';

const UUID = {
  ownerEntry: '71000000-0000-4000-8000-000000000001',
  delegateEntry: '71000000-0000-4000-8000-000000000002',
  observerEntry: '71000000-0000-4000-8000-000000000003',
  grant1: '71000000-0000-4000-8000-000000000011',
  grant2: '71000000-0000-4000-8000-000000000012',
  grant3: '71000000-0000-4000-8000-000000000013',
  grant4: '71000000-0000-4000-8000-000000000014',
  recovery: '71000000-0000-4000-8000-000000000021',
  offer: '71000000-0000-4000-8000-000000000022',
  claim: '71000000-0000-4000-8000-000000000023',
};
const secret = (pair: string) => pair.repeat(32);
const clock = (now: number) => ({
  now: () => now,
  sleep: async () => {},
});

async function fixture() {
  const store = unitStore();
  assert.ok(store.sqlite instanceof DatabaseSync);
  const owner = await store.rooms.createRoom('Owner', 'atreides', false, [], {
    operationId: UUID.ownerEntry,
    sessionToken: secret('11'),
  });
  const code = owner.view.code;
  const delegate = await store.rooms.joinRoom(code, 'Delegate', 'emperor', {
    operationId: UUID.delegateEntry,
    sessionToken: secret('22'),
  });
  const observer = await store.rooms.joinRoom(code, 'Observer', 'fremen', {
    operationId: UUID.observerEntry,
    sessionToken: secret('33'),
  });
  assert.ok(delegate.token);
  assert.ok(observer.token);
  const auths = {
    owner: await store.rooms.authenticate(code, owner.token),
    delegate: await store.rooms.authenticate(code, delegate.token),
    observer: await store.rooms.authenticate(code, observer.token),
  };
  for (const auth of Object.values(auths)) {
    const current = await store.rooms.readRoom(code);
    await store.rooms.act(code, auth, current.version, { type: 'ready' });
  }
  const beforeStart = await store.rooms.readRoom(code);
  await store.rooms.act(code, auths.owner, beforeStart.version, {
    type: 'start',
  });
  return {
    ...store,
    code,
    owner,
    delegate,
    observer,
    ownerId: auths.owner.playerId,
    delegateId: auths.delegate.playerId,
    observerId: auths.observer.playerId,
    auths,
  };
}

const delegation = (
  f: Awaited<ReturnType<typeof fixture>>,
  grantId: string,
) => ({
  grantId,
  delegateId: f.delegateId,
  difficulty: 'Hard' as const,
});

function storedState(f: Awaited<ReturnType<typeof fixture>>) {
  return f.sqlite.prepare('SELECT state FROM rooms WHERE code = ?').get(f.code)!
    .state as string;
}

function withoutDelegationActivation(game: Game) {
  const copy = structuredClone(game);
  delete copy.botsPending;
  delete copy.botNextActionAt;
  copy.version = 0;
  copy.log = [];
  for (const player of copy.players) delete player.autopilot;
  return copy;
}

void test('delegation is private, survives restart, activates once and preserves sealed setup state', async () => {
  const f = await fixture();
  try {
    const beforeState = storedState(f);
    const before = JSON.parse(beforeState) as Game;
    const version = (await f.rooms.readRoom(f.code)).version;
    const saved = await f.rooms.setSeatAiDelegate(
      f.code,
      f.auths.owner,
      version,
      delegation(f, UUID.grant1),
      clock(1000),
    );
    assert.equal(saved.replayed, false);
    assert.equal(storedState(f), beforeState);
    assert.deepEqual(saved.view.seatAiDelegations, [
      {
        grantId: UUID.grant1,
        ownerId: f.ownerId,
        delegateId: f.delegateId,
        difficulty: 'Hard',
        expiresAt: 1000 + f.rooms.SEAT_AI_DELEGATION_TTL_MS,
        usedAt: null,
      },
    ]);
    assert.deepEqual(
      (await f.restart().readSeatView(f.code, f.auths.delegate))
        .seatAiDelegations,
      saved.view.seatAiDelegations,
    );
    const observer = await f.rooms.readSeatView(f.code, f.auths.observer);
    assert.equal(Object.hasOwn(observer, 'seatAiDelegations'), false);
    for (const view of [saved.view, observer]) {
      const text = JSON.stringify(view);
      assert.equal(text.includes('session_hash'), false);
      assert.equal(text.includes(secret('11')), false);
      assert.equal(text.includes(secret('22')), false);
    }

    let reachedBatch = false;
    f.hooks.beforeBatch = async () => {
      reachedBatch = true;
    };
    const beforeFutureVersion = storedState(f);
    await assert.rejects(
      f.rooms.useSeatAiDelegate(
        f.code,
        f.auths.delegate,
        saved.view.version + 1,
        { ownerId: f.ownerId, grantId: UUID.grant1 },
        clock(1750),
      ),
      /table changed/i,
    );
    assert.equal(reachedBatch, false);
    delete f.hooks.beforeBatch;
    assert.equal(storedState(f), beforeFutureVersion);

    let entered!: () => void;
    let release!: () => void;
    const waiting = new Promise<void>((resolve) => (entered = resolve));
    const gate = new Promise<void>((resolve) => (release = resolve));
    f.hooks.beforeBatch = async () => {
      delete f.hooks.beforeBatch;
      entered();
      await gate;
    };
    const pending = f.rooms.useSeatAiDelegate(
      f.code,
      f.auths.delegate,
      saved.view.version,
      { ownerId: f.ownerId, grantId: UUID.grant1 },
      clock(2000),
    );
    await waiting;
    const duplicate = await f
      .restart()
      .useSeatAiDelegate(
        f.code,
        f.auths.delegate,
        saved.view.version,
        { ownerId: f.ownerId, grantId: UUID.grant1 },
        clock(2000),
      );
    release();
    const first = await pending;
    assert.deepEqual(
      [first.replayed, duplicate.replayed].sort(
        (a, b) => Number(a) - Number(b),
      ),
      [false, true],
    );
    const after = await f.rooms.readRoom(f.code);
    assert.equal(after.version, saved.view.version + 1);
    assert.equal(
      after.players.find((player) => player.id === f.ownerId)?.autopilot,
      'Hard',
    );
    assert.equal(after.botsPending, true);
    assert.equal(after.botNextActionAt, 3500);
    assert.match(
      after.log.at(-1)!.text,
      /Delegate activated Hard AI for Owner/,
    );
    assert.equal(
      after.log.filter((entry) => entry.text.includes('one-use delegation'))
        .length,
      1,
    );
    assert.deepEqual(
      withoutDelegationActivation(after),
      withoutDelegationActivation(before),
    );
    assert.deepEqual(
      (await f.rooms.readSeatView(f.code, f.auths.owner)).seatAiDelegations,
      [
        {
          grantId: UUID.grant1,
          ownerId: f.ownerId,
          delegateId: f.delegateId,
          difficulty: 'Hard',
          expiresAt: 1000 + f.rooms.SEAT_AI_DELEGATION_TTL_MS,
          usedAt: 2000,
        },
      ],
    );
  } finally {
    f.sqlite.close();
  }
});

void test('replacement, revoke, expiry and owner control cannot be bypassed by stale consent', async () => {
  const f = await fixture();
  try {
    const view = await f.rooms.readSeatView(f.code, f.auths.owner);
    let reachedBatch = false;
    f.hooks.beforeBatch = async () => {
      reachedBatch = true;
    };
    await assert.rejects(
      f.rooms.setSeatAiDelegate(
        f.code,
        f.auths.owner,
        view.version + 1,
        delegation(f, UUID.grant1),
        clock(500),
      ),
      /table changed/i,
    );
    assert.equal(reachedBatch, false);
    delete f.hooks.beforeBatch;
    const first = await f.rooms.setSeatAiDelegate(
      f.code,
      f.auths.owner,
      view.version,
      delegation(f, UUID.grant1),
      clock(1000),
    );
    const replay = await f.rooms.setSeatAiDelegate(
      f.code,
      f.auths.owner,
      first.view.version,
      delegation(f, UUID.grant1),
      clock(1500),
    );
    assert.equal(replay.replayed, true);
    assert.equal(replay.view.version, first.view.version);
    const replaced = await f.rooms.setSeatAiDelegate(
      f.code,
      f.auths.owner,
      first.view.version,
      delegation(f, UUID.grant2),
      clock(2000),
    );
    assert.deepEqual(
      replaced.view.seatAiDelegations?.map((item) => item.grantId),
      [UUID.grant2],
    );
    const rejectedState = storedState(f);
    await assert.rejects(
      f.rooms.useSeatAiDelegate(
        f.code,
        f.auths.delegate,
        replaced.view.version,
        { ownerId: f.ownerId, grantId: UUID.grant1 },
        clock(2500),
      ),
      /revoked|replaced/,
    );
    assert.equal(storedState(f), rejectedState);
    const revoked = await f.rooms.revokeSeatAiDelegate(
      f.code,
      f.auths.owner,
      replaced.view.version,
      UUID.grant2,
      clock(3000),
    );
    assert.equal(revoked.replayed, false);
    assert.equal(Object.hasOwn(revoked.view, 'seatAiDelegations'), false);
    const revokeReplay = await f.rooms.revokeSeatAiDelegate(
      f.code,
      f.auths.owner,
      replaced.view.version,
      UUID.grant2,
      clock(3500),
    );
    assert.equal(revokeReplay.replayed, true);
    assert.equal(revokeReplay.view.version, revoked.view.version);

    const expiring = await f.rooms.setSeatAiDelegate(
      f.code,
      f.auths.owner,
      revoked.view.version,
      delegation(f, UUID.grant3),
      clock(4000),
    );
    const beforeExpiry = storedState(f);
    await assert.rejects(
      f.rooms.useSeatAiDelegate(
        f.code,
        f.auths.delegate,
        expiring.view.version,
        { ownerId: f.ownerId, grantId: UUID.grant3 },
        clock(4000 + f.rooms.SEAT_AI_DELEGATION_TTL_MS),
      ),
      /expired/,
    );
    assert.equal(storedState(f), beforeExpiry);
    const current = await f.rooms.readRoom(f.code);
    const ownAi = await f.rooms.act(
      f.code,
      f.auths.owner,
      current.version,
      { type: 'setAutopilot', difficulty: 'Easy' },
      clock(5000),
    );
    assert.equal(Object.hasOwn(ownAi, 'seatAiDelegations'), false);
    await assert.rejects(
      f.rooms.useSeatAiDelegate(
        f.code,
        f.auths.delegate,
        ownAi.version,
        { ownerId: f.ownerId, grantId: UUID.grant3 },
        clock(5500),
      ),
      /revoked|replaced/,
    );
  } finally {
    f.sqlite.close();
  }
});

void test('owner control and delegated activation serialize without stale takeback or double enable', async () => {
  for (const winner of ['owner', 'delegate'] as const) {
    const f = await fixture();
    try {
      const initial = await f.rooms.readSeatView(f.code, f.auths.owner);
      const granted = await f.rooms.setSeatAiDelegate(
        f.code,
        f.auths.owner,
        initial.version,
        delegation(f, UUID.grant1),
        clock(1000),
      );
      let entered!: () => void;
      let release!: () => void;
      const waiting = new Promise<void>((resolve) => (entered = resolve));
      const gate = new Promise<void>((resolve) => (release = resolve));
      f.hooks.beforeBatch = async () => {
        delete f.hooks.beforeBatch;
        entered();
        await gate;
      };
      if (winner === 'owner') {
        const pendingUse = f.rooms.useSeatAiDelegate(
          f.code,
          f.auths.delegate,
          granted.view.version,
          { ownerId: f.ownerId, grantId: UUID.grant1 },
          clock(2000),
        );
        await waiting;
        const controlled = await f
          .restart()
          .act(
            f.code,
            f.auths.owner,
            granted.view.version,
            { type: 'setAutopilot', difficulty: null },
            clock(2000),
          );
        release();
        await assert.rejects(
          pendingUse,
          /table, owner, delegate or consent changed/i,
        );
        assert.equal(
          controlled.players.find((player) => player.id === f.ownerId)
            ?.autopilot,
          undefined,
        );
      } else {
        const pendingControl = f.rooms.act(
          f.code,
          f.auths.owner,
          granted.view.version,
          { type: 'setAutopilot', difficulty: null },
          clock(2000),
        );
        await waiting;
        const used = await f
          .restart()
          .useSeatAiDelegate(
            f.code,
            f.auths.delegate,
            granted.view.version,
            { ownerId: f.ownerId, grantId: UUID.grant1 },
            clock(2000),
          );
        assert.equal(used.replayed, false);
        release();
        await assert.rejects(pendingControl, /Another action arrived first/);
        const current = await f.rooms.readSeatView(f.code, f.auths.owner);
        const takenBack = await f.rooms.act(
          f.code,
          f.auths.owner,
          current.version,
          { type: 'setAutopilot', difficulty: null },
          clock(3000),
        );
        assert.equal(
          takenBack.players.find((player) => player.id === f.ownerId)
            ?.autopilot,
          undefined,
        );
      }
      const after = await f.rooms.readRoom(f.code);
      assert.ok(after.version >= granted.view.version + 1);
      assert.ok(
        after.log.filter((entry) => entry.text.includes('one-use delegation'))
          .length <= 1,
      );
    } finally {
      f.sqlite.close();
    }
  }
});

void test('recovery or handover of either bound seat invalidates delegation consent', async () => {
  for (const mode of ['recovery', 'handover'] as const) {
    for (const target of ['owner', 'delegate'] as const) {
      const f = await fixture();
      try {
        let targetAuth = f.auths[target];
        let version = (await f.rooms.readRoom(f.code)).version;
        const recoverySecret = secret(target === 'owner' ? '44' : '55');
        if (mode === 'recovery') {
          const configured = await f.rooms.setRecoveryKey(
            f.code,
            targetAuth,
            version,
            recoverySecret,
          );
          version = configured.view.version;
        }
        const granted = await f.rooms.setSeatAiDelegate(
          f.code,
          f.auths.owner,
          version,
          delegation(f, UUID.grant4),
          clock(1000),
        );
        let newToken: string;
        if (mode === 'recovery') {
          newToken = secret(target === 'owner' ? '66' : '77');
          await f.rooms.recoverSeat(f.code, {
            playerId: targetAuth.playerId,
            recoverySecret,
            operationId: UUID.recovery,
            newSessionToken: newToken,
          });
        } else {
          const offer = {
            offerId: UUID.offer,
            handoverSecret: secret(target === 'owner' ? '88' : '99'),
          };
          await f.rooms.createSeatHandover(
            f.code,
            targetAuth,
            granted.view.version,
            offer,
            clock(1500),
          );
          newToken = secret(target === 'owner' ? 'aa' : 'bb');
          await f.rooms.claimSeatHandover(
            f.code,
            {
              playerId: targetAuth.playerId,
              ...offer,
              operationId: UUID.claim,
              newSessionToken: newToken,
            },
            clock(2000),
          );
        }
        targetAuth = await f.rooms.authenticate(f.code, newToken);
        const delegateAuth =
          target === 'delegate' ? targetAuth : f.auths.delegate;
        const current = await f.rooms.readRoom(f.code);
        const before = storedState(f);
        await assert.rejects(
          f.rooms.useSeatAiDelegate(
            f.code,
            delegateAuth,
            current.version,
            { ownerId: f.ownerId, grantId: UUID.grant4 },
            clock(3000),
          ),
          /credential changed|not available/,
          `${mode} of ${target}`,
        );
        assert.equal(storedState(f), before);
        assert.equal(
          Object.hasOwn(
            await f.rooms.readSeatView(f.code, targetAuth),
            'seatAiDelegations',
          ),
          false,
        );
      } finally {
        f.sqlite.close();
      }
    }
  }
});
