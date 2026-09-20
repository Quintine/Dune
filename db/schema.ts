import {
  sqliteTable,
  text,
  integer,
  primaryKey,
} from 'drizzle-orm/sqlite-core';
export const rooms = sqliteTable('rooms', {
  code: text('code').primaryKey(),
  state: text('state').notNull(),
  version: integer('version').notNull().default(0),
  updatedAt: integer('updated_at').notNull(),
});
export const seats = sqliteTable('seats', {
  tokenHash: text('token_hash').primaryKey(),
  revoked: integer('revoked').notNull().default(0),
  roomCode: text('room_code')
    .notNull()
    .references(() => rooms.code, { onDelete: 'cascade' }),
  playerId: text('player_id').notNull(),
});

export const seatRecoveryKeys = sqliteTable(
  'seat_recovery_keys',
  {
    roomCode: text('room_code')
      .notNull()
      .references(() => rooms.code, { onDelete: 'cascade' }),
    playerId: text('player_id').notNull(),
    recoveryHash: text('recovery_hash').notNull(),
    currentOperationHash: text('current_operation_hash'),
  },
  (table) => [primaryKey({ columns: [table.roomCode, table.playerId] })],
);
export const seatRecoveryReceipts = sqliteTable(
  'seat_recovery_receipts',
  {
    roomCode: text('room_code')
      .notNull()
      .references(() => rooms.code, { onDelete: 'cascade' }),
    playerId: text('player_id').notNull(),
    operationHash: text('operation_hash').notNull(),
    recoveryHash: text('recovery_hash').notNull(),
    sessionHash: text('session_hash').notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.roomCode, table.playerId, table.operationHash],
    }),
  ],
);

export const seatHandoverOffers = sqliteTable(
  'seat_handover_offers',
  {
    roomCode: text('room_code')
      .notNull()
      .references(() => rooms.code, { onDelete: 'cascade' }),
    playerId: text('player_id').notNull(),
    offerHash: text('offer_hash').notNull().unique(),
    secretHash: text('secret_hash').notNull(),
    issuerSessionHash: text('issuer_session_hash').notNull(),
    expiresAt: integer('expires_at').notNull(),
    claimOperationHash: text('claim_operation_hash'),
    sessionHash: text('session_hash'),
    claimedAt: integer('claimed_at'),
  },
  (table) => [primaryKey({ columns: [table.roomCode, table.playerId] })],
);

export const seatHandoverClaimReceipts = sqliteTable(
  'seat_handover_claim_receipts',
  {
    roomCode: text('room_code')
      .notNull()
      .references(() => rooms.code, { onDelete: 'cascade' }),
    playerId: text('player_id').notNull(),
    operationHash: text('operation_hash').notNull(),
    offerHash: text('offer_hash').notNull(),
    secretHash: text('secret_hash').notNull(),
    sessionHash: text('session_hash').notNull(),
    claimFence: text('claim_fence').notNull().unique(),
    claimedAt: integer('claimed_at').notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.roomCode, table.playerId, table.operationHash],
    }),
  ],
);

export const seatAiDelegations = sqliteTable(
  'seat_ai_delegations',
  {
    roomCode: text('room_code')
      .notNull()
      .references(() => rooms.code, { onDelete: 'cascade' }),
    ownerId: text('owner_id').notNull(),
    grantId: text('grant_id').notNull().unique(),
    delegateId: text('delegate_id').notNull(),
    difficulty: text('difficulty').notNull(),
    ownerSessionHash: text('owner_session_hash').notNull(),
    delegateSessionHash: text('delegate_session_hash').notNull(),
    expiresAt: integer('expires_at').notNull(),
    usedAt: integer('used_at'),
    revokedAt: integer('revoked_at'),
  },
  (table) => [
    primaryKey({ columns: [table.roomCode, table.ownerId, table.grantId] }),
  ],
);

export const roomEntryReceipts = sqliteTable('room_entry_receipts', {
  operationHash: text('operation_hash').primaryKey(),
  requestHash: text('request_hash').notNull(),
  sessionHash: text('session_hash').notNull(),
  roomCode: text('room_code')
    .notNull()
    .references(() => rooms.code, { onDelete: 'cascade' }),
  playerId: text('player_id').notNull(),
});
