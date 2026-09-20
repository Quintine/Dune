import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  index,
  uniqueIndex,
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

export const roomMessages = sqliteTable(
  'room_messages',
  {
    sequence: integer('sequence').primaryKey({ autoIncrement: true }),
    roomCode: text('room_code')
      .notNull()
      .references(() => rooms.code, { onDelete: 'cascade' }),
    id: text('id').notNull(),
    senderId: text('sender_id').notNull(),
    senderSessionHash: text('sender_session_hash').notNull(),
    senderName: text('sender_name').notNull(),
    senderFaction: text('sender_faction').notNull(),
    recipientId: text('recipient_id'),
    recipientName: text('recipient_name'),
    body: text('body').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('room_messages_room_id').on(table.roomCode, table.id),
    index('room_messages_channel').on(
      table.roomCode,
      table.recipientId,
      table.sequence,
    ),
    index('room_messages_sender').on(
      table.roomCode,
      table.senderId,
      table.createdAt,
    ),
  ],
);
