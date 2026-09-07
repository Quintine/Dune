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

export const roomEntryReceipts = sqliteTable('room_entry_receipts', {
  operationHash: text('operation_hash').primaryKey(),
  requestHash: text('request_hash').notNull(),
  sessionHash: text('session_hash').notNull(),
  roomCode: text('room_code')
    .notNull()
    .references(() => rooms.code, { onDelete: 'cascade' }),
  playerId: text('player_id').notNull(),
});
